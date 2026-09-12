/**
 * Generates the INSERT block that seeds public.unchained_insights from
 * lib/insights.ts.
 *
 * ─── Why this is a script and not a hand-written INSERT ───────────────────
 * The one article on the site is roughly nine thousand words of prose
 * containing apostrophes, typographic quotes and em dashes. Retyping it into
 * a SQL literal means a human transcribing nine thousand words and quoting
 * every apostrophe correctly — which is not a task a human does correctly, and
 * the failure mode is a silently altered sentence on a published page rather
 * than a syntax error somebody notices.
 *
 * So the migration's seed is generated from the file the website actually
 * renders. The output is committed into the migration, not produced at apply
 * time: migrations in this directory are pasted into the Studio SQL editor by
 * hand, so the SQL has to be in the file. Re-running this script and diffing
 * is how the two are kept honest.
 *
 * ─── Usage ───────────────────────────────────────────────────────────────
 *     node scripts/generate-insight-seed.mjs
 *
 * Writes the block between the INSIGHT_SEED_BEGIN and INSIGHT_SEED_END markers
 * in supabase/migrations/20260912000002_unchained_cms_insights.sql, in place.
 *
 * ─── How a .ts module is loaded here, with no build step ──────────────────
 * Node strips TypeScript types natively on this runtime, so the only thing it
 * cannot do with lib/insights.ts is resolve the `@/` alias — which is a
 * tsconfig path mapping, not something Node has ever known about.
 *
 * `module.registerHooks` supplies exactly that one missing rule, in-process and
 * synchronously. The alternative was vite's SSR loader, which would have read
 * the same alias out of vitest.config.ts; it is not reachable from here (vite
 * is a transitive dependency of vitest under pnpm's strict layout, and this
 * script is not a test), and pulling in a dependency to resolve one prefix
 * would be the larger change.
 */

import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { registerHooks } from 'node:module';

const ROOT = fileURLToPath(new URL('..', import.meta.url));

/**
 * The two resolution rules TypeScript has and Node does not.
 *
 * 1. `@/x` → the project root, matching the `paths` mapping in tsconfig.json
 *    and the `resolve.alias` in vitest.config.ts.
 * 2. Extensionless specifiers, which TypeScript source always writes and Node
 *    always rejects. This applies to RELATIVE imports too, not only aliased
 *    ones — `lib/cms/seo.ts` imports `./sanitize`, and an earlier version of
 *    this hook handled only `@/` and so could not load it.
 *
 * Anything else is handed straight back to Node. In particular `next`, which
 * lib/insights.ts imports for a TYPE only: type-only imports are erased before
 * this hook ever sees them, so the package is never actually resolved.
 */
function resolveTs(basePath) {
  // `.ts` first because every module in this repository is TypeScript, with a
  // directory index as the only other form the codebase uses.
  return [basePath, `${basePath}.ts`, `${basePath}/index.ts`].find(
    (path) => path.endsWith('.ts') && existsSync(path),
  );
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier.startsWith('@/')) {
      const candidate = resolveTs(`${ROOT}${specifier.slice(2)}`);
      if (!candidate) {
        throw new Error(`Cannot resolve "${specifier}" under ${ROOT}`);
      }
      return { url: pathToFileURL(candidate).href, shortCircuit: true };
    }

    // A relative import with no extension, resolved against the importer.
    if (specifier.startsWith('.') && !/\.[a-z]+$/i.test(specifier)) {
      const candidate = resolveTs(
        fileURLToPath(new URL(specifier, context.parentURL)),
      );
      if (candidate) {
        return { url: pathToFileURL(candidate).href, shortCircuit: true };
      }
    }

    return nextResolve(specifier, context);
  },
});

const MIGRATION = new URL(
  '../supabase/migrations/20260912000002_unchained_cms_insights.sql',
  import.meta.url,
);

const BEGIN = '-- INSIGHT_SEED_BEGIN';
const END = '-- INSIGHT_SEED_END';

/**
 * A SQL string literal.
 *
 * Doubling the apostrophe is the whole of SQL string escaping, and it is the
 * only transformation applied: the text is otherwise passed through byte for
 * byte, which is the point of generating this rather than writing it.
 *
 * A NUL byte cannot be stored in a Postgres text column at all, so it is
 * refused here rather than sent and rejected 9,000 words later.
 */
function sqlString(value) {
  if (value.includes('\u0000')) {
    throw new Error('A NUL byte cannot be stored in a text column.');
  }
  return `'${value.replaceAll("'", "''")}'`;
}

function sqlNullable(value) {
  return value === undefined || value === null ? 'NULL' : sqlString(value);
}

/** A TEXT[] literal, built from an array of strings. */
function sqlTextArray(values) {
  if (!values || values.length === 0) return "'{}'::text[]";
  return `ARRAY[${values.map(sqlString).join(', ')}]::text[]`;
}

/**
 * The article body as a JSONB literal.
 *
 * JSON.stringify produces the exact structure
 * unchained_insight_sections_valid() validates — an array of objects with
 * `heading`, `body` and an optional `points` — because that structure is the
 * site's own InsightSection type. The two agree by construction rather than by
 * a mapping somebody maintains.
 *
 * Keys are written explicitly rather than spreading the section, so a field
 * added to InsightSection in the future fails this script instead of silently
 * being dropped from the seed.
 */
function sqlSections(sections) {
  const shaped = sections.map((section) => {
    const known = ['heading', 'body', 'points'];
    const unknown = Object.keys(section).filter((k) => !known.includes(k));
    if (unknown.length > 0) {
      throw new Error(
        `InsightSection gained a field this script does not know how to seed: ${unknown.join(', ')}`,
      );
    }
    return {
      heading: section.heading,
      body: section.body,
      ...(section.points ? { points: section.points } : {}),
    };
  });
  return `${sqlString(JSON.stringify(shaped))}::jsonb`;
}

/** A DATE literal, or NULL. */
function sqlDate(value) {
  if (!value) return 'NULL';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error(`Not an ISO calendar date: ${value}`);
  }
  return `DATE ${sqlString(value)}`;
}

/**
 * One VALUES row.
 *
 * ─── The two fields that are NOT carried over ─────────────────────────────
 * `author` and `tags` are left empty. lib/insights.ts has never had either,
 * and the brief is explicit that the CMS must represent reality: inventing a
 * by-line for an article that was published without one would be fabricating
 * provenance, and inventing tags would be inventing a taxonomy the site does
 * not use.
 *
 * ─── draft ────────────────────────────────────────────────────────────────
 * `draft: true` in the source becomes `published = FALSE` here, so an article
 * that is unfinished in the file arrives unfinished in the database rather
 * than being published by the act of migrating it.
 */
function valuesRow(article) {
  const published = article.draft !== true;
  return `  (
    ${sqlString(article.slug)},
    ${sqlString(article.title)},
    ${sqlString(article.description)},
    ${sqlString(article.lede)},
    ${sqlString(article.pillar)},
    ${sqlSections(article.sections)},
    ${sqlTextArray(article.relatedSlugs)},
    ${sqlNullable(article.caseStudySlug)},
    ${sqlNullable(article.ogImage)},
    ${published ? 'TRUE' : 'FALSE'},
    ${sqlDate(article.publishedAt)},
    ${sqlDate(article.updatedAt)}
  )`;
}

function buildSeed(articles) {
  const rows = articles.map(valuesRow).join(',\n');

  return `${BEGIN}
-- Generated by scripts/generate-insight-seed.mjs from lib/insights.ts.
-- Do not edit by hand: re-run the script instead, so the prose here and the
-- prose the site falls back to cannot diverge through a manual correction to
-- one of them.
--
-- ${articles.length} article${articles.length === 1 ? '' : 's'}.

INSERT INTO public.unchained_insights (
  slug, title, description, lede, pillar, sections,
  related_slugs, case_study_slug, og_image,
  published, published_on, revised_on
) VALUES
${rows}
ON CONFLICT (slug) DO NOTHING;
${END}`;
}

async function main() {
  const { insights: articles } = await import(
    pathToFileURL(`${ROOT}lib/insights.ts`).href
  );

  if (!Array.isArray(articles) || articles.length === 0) {
    throw new Error('lib/insights.ts exported no articles.');
  }

  const seed = buildSeed(articles);

  const sql = await readFile(MIGRATION, 'utf8');
  const start = sql.indexOf(BEGIN);
  const stop = sql.indexOf(END);
  if (start === -1 || stop === -1) {
    throw new Error(`Seed markers not found in ${MIGRATION.pathname}`);
  }

  await writeFile(
    MIGRATION,
    sql.slice(0, start) + seed + sql.slice(stop + END.length),
    'utf8',
  );

  const bytes = Buffer.byteLength(seed, 'utf8');
  console.log(
    `Seeded ${articles.length} article(s), ${bytes.toLocaleString()} bytes of SQL.`,
  );
  for (const a of articles) {
    console.log(
      `  ${a.draft ? 'draft    ' : 'published'}  ${a.slug}  (${a.sections.length} sections)`,
    );
  }
}

await main();

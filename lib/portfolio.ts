import { rpcEndpoint } from '@/lib/commercial/config';
import {
  STATUS_META,
  fallbackProjects,
  type Project,
  type ProjectStatus,
} from '@/lib/projects';

/**
 * The public website's second question: "what is the portfolio?"
 *
 * ─── What this file is not ────────────────────────────────────────────────
 * There is ONE portfolio and it is public.unchained_projects, published from
 * the admin panel. Nothing here decides what appears on the site: which rows
 * are public is `WHERE p.published` inside list_public_projects(), and the
 * order is that function's ORDER BY. A line of the form
 * `if (project.status === 'dismissed') …` in this repository would be a second
 * source of truth and a bug the day somebody changes a project in the panel.
 *
 * That is also what makes the panel and this website incapable of disagreeing:
 * the panel writes the table, the site reads the function over it, and neither
 * holds a copy of the publication rule.
 *
 * ─── Why fetch and not @supabase/supabase-js ──────────────────────────────
 * The same argument lib/commercial/resolver.ts makes: one RPC over PostgREST
 * is one POST, and the client library would add tens of kilobytes to a landing
 * page whose dependency list is deliberately short.
 *
 * ─── This runs on the server, and only on the server ──────────────────────
 * Every caller is a server component or a route module. That is not an
 * optimisation — a client-side fetch would put the portfolio behind a request
 * the visitor waits for and a crawler may not make, on the page whose whole
 * purpose is to be indexed. The pages stay prerendered; see `revalidate`.
 */

/**
 * How long a prerendered page may go on showing a portfolio it read earlier.
 *
 * Ten minutes. Long enough that the site is served from cache essentially
 * always, short enough that publishing a project in the panel and then looking
 * at the site is not a confusing experience.
 *
 * ─── Where this number actually takes effect ──────────────────────────────
 * On each route, as `export const revalidate = 600`, written out as a literal
 * because Next requires that value to be statically analysable and will not
 * follow an import to find it. This constant is therefore documentation and a
 * single place to change deliberately — not the value the framework reads. The
 * routes that must be kept in step with it are:
 *
 *   app/page.tsx           app/work/page.tsx
 *   app/work/[slug]/page.tsx           app/sitemap.ts
 *
 * ─── Why time-based and not a webhook from the panel ──────────────────────
 * On-demand revalidation needs the caller to hold a secret, and the caller
 * would be the admin panel — a Vite SPA, whose every environment variable is
 * inlined into a bundle the browser downloads. A "secret" there is public, and
 * a public revalidation endpoint is an invitation to make this site rebuild
 * itself on request. Doing it properly means an edge function holding the
 * token and the panel calling that; until that exists, ten minutes is the
 * honest interval rather than a broken instant one.
 */
export const PORTFOLIO_REVALIDATE_SECONDS = 600;

const projectsEndpoint = rpcEndpoint('list_public_projects');

const REQUEST_TIMEOUT_MS = 8000;

/**
 * Control characters, zero-width characters and bidirectional overrides.
 *
 * Copied deliberately from lib/commercial/resolver.ts rather than shared: both
 * modules sanitise text that arrives from the database, and the day one of
 * them needs a different class is the day sharing it would be wrong. The
 * reasoning is the same — the risk is not markup injection, since React
 * escapes output already, but a stored string carrying a bidi override that
 * rearranges the sentence around it on screen.
 *
 * The one difference: the line feed is NOT in the class. The resolver
 * sanitises names, where a newline is never wanted; this sanitises a
 * project's summary, its challenge and its solution, which are prose somebody
 * may have written in paragraphs. Stripping their line breaks would run those
 * paragraphs together on the detail page.
 */
const UNDISPLAYABLE =
  /[\u0000-\u0009\u000B-\u001F\u007F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069]/g;

/** Every column the RPC returns. Every one of them is untrusted. */
interface ProjectRow {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  category?: unknown;
  status?: unknown;
  featured?: unknown;
  detailed?: unknown;
  year?: unknown;
  industry?: unknown;
  services?: unknown;
  technologies?: unknown;
  capabilities?: unknown;
  thumbnail?: unknown;
  thumbnail_width?: unknown;
  thumbnail_height?: unknown;
  hero_image?: unknown;
  summary?: unknown;
  challenge?: unknown;
  solution?: unknown;
  outcome?: unknown;
  external_url?: unknown;
}

/**
 * A displayable string, or null.
 *
 * Multi-line fields — the summary, the challenge, the solution — keep their
 * paragraph breaks, so newlines are stripped only from the single-line ones.
 * `collapse` is what says which is which.
 */
function text(
  value: unknown,
  max: number,
  collapse = true,
): string | null {
  if (typeof value !== 'string') return null;
  const stripped = value.replace(UNDISPLAYABLE, ' ');
  const clean = collapse
    ? stripped.replace(/\s+/g, ' ').trim()
    : stripped.replace(/[^\S\n]+/g, ' ').trim();
  return clean === '' ? null : clean.slice(0, max);
}

function bool(value: unknown): boolean {
  return value === true;
}

/** A four-digit year as the model states it, or undefined. */
function year(value: unknown): string | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 2000 || n > 2100) return undefined;
  return String(n);
}

/** A positive integer, or undefined. */
function size(value: unknown): number | undefined {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isInteger(n) || n < 1 || n > 10000) return undefined;
  return n;
}

/**
 * A list of short labels, with the empties dropped.
 *
 * Returns undefined rather than [] for an empty list, because the components
 * render these sections conditionally on the property being present and an
 * empty array would produce a heading over nothing.
 */
function labels(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const clean = value
    .map((entry) => text(entry, 80))
    .filter((entry): entry is string => entry !== null);
  return clean.length > 0 ? clean : undefined;
}

/** A site-relative asset path, or undefined. */
function assetPath(value: unknown): string | undefined {
  const clean = text(value, 300);
  if (!clean || !clean.startsWith('/') || clean.startsWith('//')) {
    return undefined;
  }
  return clean;
}

/** An absolute http(s) URL, or undefined. */
function externalUrl(value: unknown): string | undefined {
  const clean = text(value, 300);
  if (!clean) return undefined;
  try {
    const parsed = new URL(clean);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return undefined;
    }
  } catch {
    return undefined;
  }
  return clean;
}

/**
 * A status the site knows how to render, or undefined.
 *
 * Checked against STATUS_META rather than a literal list, so the vocabulary is
 * stated once. The database's CHECK constraint says the same thing, and this
 * is the second wall: a status added to the table before the badge that
 * renders it exists would otherwise reach a component that has no entry for
 * it and draw a card with no status at all.
 */
function status(value: unknown): ProjectStatus | undefined {
  return typeof value === 'string' && value in STATUS_META
    ? (value as ProjectStatus)
    : undefined;
}

/**
 * One row as the site's own model, or null when the row cannot be rendered.
 *
 * The four required fields are required because every surface uses them: a
 * project with no slug has no URL, and one with no title, description or
 * category is a card with nothing on it. A row missing any of them is dropped
 * rather than filled in — this data is published content, and inventing a
 * category to keep a row alive would put a word on the website that nobody
 * wrote.
 *
 * Everything else degrades: a broken thumbnail path becomes no image, an
 * unrecognised status becomes the default the column has, and the card still
 * renders.
 */
export function toProject(row: ProjectRow | null | undefined): Project | null {
  if (!row || typeof row !== 'object') return null;

  const slug = text(row.slug, 100);
  const title = text(row.title, 120);
  const description = text(row.description, 600);
  const category = text(row.category, 80);

  if (!slug || !title || !description || !category) return null;
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;

  const thumbnail = assetPath(row.thumbnail);
  const width = size(row.thumbnail_width);
  const height = size(row.thumbnail_height);

  const summary = text(row.summary, 1000, false);
  const challenge = text(row.challenge, 2000, false);
  const solution = text(row.solution, 2000, false);

  // `detailed` promises a page at /work/<slug> that renders these three. The
  // database refuses the combination, so this can only be reached by a row
  // written around it — in which case the honest answer is that the project
  // has no detail page, not a page with three empty sections.
  const detailed =
    bool(row.detailed) && Boolean(summary && challenge && solution);

  return {
    slug,
    title,
    description,
    category,
    status: status(row.status) ?? 'in-development',
    // A flagship with no detail page would render as a full-width card
    // linking nowhere, which is the same constraint the table enforces.
    featured: bool(row.featured) && detailed,
    detailed,
    year: year(row.year),
    industry: text(row.industry, 120) ?? undefined,
    services: labels(row.services),
    technologies: labels(row.technologies),
    capabilities: labels(row.capabilities),
    thumbnail,
    // Both or neither, and only alongside the image they measure.
    thumbnailSize:
      thumbnail && width && height ? { width, height } : undefined,
    heroImage: assetPath(row.hero_image),
    summary: summary ?? undefined,
    challenge: challenge ?? undefined,
    solution: solution ?? undefined,
    outcome: text(row.outcome, 600, false) ?? undefined,
    externalUrl: externalUrl(row.external_url),
  };
}

/**
 * The published portfolio, newest first.
 *
 * ─── When this falls back to lib/projects.ts, and when it does not ────────
 * Falls back:
 *   · no database configured — a preview deploy, a checkout with no .env;
 *   · the request failed, timed out, or answered with something that is not
 *     a list of rows;
 *   · every row that came back was unrenderable.
 * In all three the site has learned nothing about the portfolio, and showing
 * the last known-good one is better than showing an agency with no work.
 *
 * Does NOT fall back:
 *   · the request succeeded and returned zero published projects.
 * That is an answer, not a failure. Falling back there would mean the panel
 * can add a project and can edit one, but can never remove the last one —
 * the site would resurrect it on the next build, and no amount of looking at
 * the panel would explain why.
 *
 * ─── It never throws ──────────────────────────────────────────────────────
 * Every caller is a page being prerendered. An exception here would fail the
 * build, or take down a route at revalidation time, over a portfolio that has
 * a perfectly good offline answer sitting in the same repository.
 */
export async function loadProjects(): Promise<Project[]> {
  if (!projectsEndpoint) return fallbackProjects;

  let rows: unknown;

  try {
    const response = await fetch(projectsEndpoint.url, {
      method: 'POST',
      headers: {
        apikey: projectsEndpoint.anonKey,
        Authorization: `Bearer ${projectsEndpoint.anonKey}`,
        'Content-Type': 'application/json',
      },
      // The function takes no arguments; PostgREST still expects a JSON body.
      body: '{}',
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      // ─── Do not put `cache: 'no-store'` here ──────────────────────────
      // It was here, and it cost the site its prerendering: in the App
      // Router an explicit no-store fetch does not merely skip the Data
      // Cache, it opts the whole route out of static rendering. `next build`
      // then reports /, /work, /work/[slug] and /sitemap.xml as ƒ — rendered
      // on demand, on every request, per visitor — which for a landing page
      // is the opposite of what this migration was for.
      //
      // Declaring the interval instead keeps the routes prerendered. Next's
      // Data Cache stores GET responses only, so this POST is re-sent on
      // each render; what the number does is leave the route eligible for
      // static generation, and the page output is then held for the same
      // interval by the segment's `revalidate`.
      next: { revalidate: PORTFOLIO_REVALIDATE_SECONDS },
    });

    if (!response.ok) return fallbackProjects;
    rows = await response.json();
  } catch {
    // A timeout, a DNS failure, a body that is not JSON. Nothing to report to
    // the visitor: the page renders a portfolio either way.
    return fallbackProjects;
  }

  if (!Array.isArray(rows)) return fallbackProjects;

  const projects = rows
    .map((row) => toProject(row as ProjectRow))
    .filter((project): project is Project => project !== null);

  // Zero rows from a successful call is an empty portfolio and is respected.
  // Zero USABLE rows out of rows that did arrive is a database saying
  // something this site cannot read, which is a failure like any other.
  if (projects.length === 0 && rows.length > 0) return fallbackProjects;

  return dedupe(projects);
}

/**
 * At most one project per slug, and at most one flagship.
 *
 * Both are enforced by the database — a UNIQUE column and a partial unique
 * index — so this cannot fire against the real table. It exists because the
 * things it protects are not display glitches: two rows sharing a slug would
 * give /work/<slug> two candidate pages, and two flagships would make the
 * homepage's layout depend on which one `find` reached first. Deciding it here
 * means the answer is the same whatever the site is reading.
 *
 * First wins, in both cases, because the list arrives in the order the site
 * renders and the first is the one a reader would call the real one.
 */
function dedupe(projects: Project[]): Project[] {
  const seen = new Set<string>();
  let flagshipTaken = false;

  return projects.reduce<Project[]>((kept, project) => {
    if (seen.has(project.slug)) return kept;
    seen.add(project.slug);

    if (project.featured) {
      if (flagshipTaken) {
        kept.push({ ...project, featured: false });
        return kept;
      }
      flagshipTaken = true;
    }

    kept.push(project);
    return kept;
  }, []);
}

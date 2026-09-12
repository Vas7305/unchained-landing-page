'use client';

/**
 * The words a project shows, in the language the visitor is reading.
 *
 * ─── The problem this solves, which is not a small one ────────────────────
 * Before the CMS, a project's prose did not live on the project. It lived in
 * lib/i18n/dictionaries/*.ts under keys built from the slug —
 * `project.tancerca.description`, `project.tancerca.challenge` — and the
 * components read it with `t(('project.' + project.slug + '.' + name) as
 * TranslationKey)`.
 *
 * That worked, and gave the eight projects in the repository genuine
 * six-language copy. But it means the words are keyed by SLUG in a file that
 * ships in the bundle, so a project created in the panel has no keys at all —
 * and `t()` returns the key itself when it misses. A project added by an
 * editor would have rendered the literal string
 * "project.acme-corp.description" on the public website, in every language
 * including English.
 *
 * The `as TranslationKey` cast is why that never failed to compile: it asserts
 * a key exists for a string the compiler cannot check.
 *
 * ─── The resolution order, and why it is this way round ───────────────────
 * Per FIELD, not per project:
 *
 *   1. the CMS translation for this locale, if the field was translated;
 *   2. the dictionary entry for this project and field, if one exists;
 *   3. the project row itself, which is written in the default locale.
 *
 * (1) before (2): a translation entered in the panel is the editorial
 * decision somebody made most recently, and the panel is where translations
 * are maintained from now on.
 *
 * (2) before (3): this is what makes the change safe. The eight existing
 * projects keep their hand-written Spanish, Italian, French, German and
 * Russian copy exactly as it is, with nothing to migrate and no risk of a
 * published page reverting to English the day this ships. The dictionary
 * becomes a legacy layer that is read and never written; as projects are
 * translated in the panel it empties out on its own.
 *
 * (3) always terminates the chain, so there is no input for which this returns
 * a key, a placeholder, or an empty string where the page expects a sentence.
 */

import { useLanguage } from '@/lib/i18n/LanguageProvider';
import type { Locale } from '@/lib/i18n/config';
import type { ListKey, TranslationKey } from '@/lib/i18n/dictionaries';
import { localize } from '@/lib/cms/localized';
import type { Project, ProjectCopy } from '@/lib/projects';

/** The fields a component renders as words. */
export type ResolvedProjectCopy = Pick<
  Project,
  | 'title'
  | 'description'
  | 'category'
  | 'industry'
  | 'summary'
  | 'challenge'
  | 'solution'
  | 'outcome'
  | 'services'
  | 'technologies'
  | 'capabilities'
  | 'thumbnailAlt'
  | 'heroImageAlt'
>;

/**
 * Whether the dictionary actually holds a key.
 *
 * `t()` returns the key when it misses — `dictionary[key] ?? dictionaries[en][key] ?? key`
 * in LanguageProvider — so a miss is detectable by comparing the answer with
 * what was asked. That is the whole test, and it is exact: no translation in
 * any of the six dictionaries is the literal string `project.<slug>.<field>`.
 *
 * Checking rather than using the value directly is the point. Without it, step
 * 2 of the chain would "succeed" for every project the dictionary has never
 * heard of and put a key on the page.
 */
function dictionaryText(
  t: (key: TranslationKey) => string,
  slug: string,
  field: string,
): string | undefined {
  const key = `project.${slug}.${field}` as TranslationKey;
  const value = t(key);
  return value === key ? undefined : value;
}

/**
 * The list equivalent.
 *
 * `tList()` returns `lists[key] ?? listDictionaries[en][key]`, which is
 * `undefined` on a total miss rather than the key — a different fallback from
 * `t()`, so this cannot be written the same way. An empty list is treated as a
 * miss too: a heading over no bullets is the failure the caller is trying to
 * avoid.
 */
function dictionaryList(
  tList: (key: ListKey) => readonly string[],
  slug: string,
  field: string,
): string[] | undefined {
  const value = tList(`project.${slug}.${field}` as ListKey) as
    | readonly string[]
    | undefined;
  return value && value.length > 0 ? [...value] : undefined;
}

/** The two dictionary readers, as the provider supplies them. */
export interface Dictionaries {
  t: (key: TranslationKey) => string;
  tList: (key: ListKey) => readonly string[];
}

/**
 * Resolve one project's copy for a locale.
 *
 * ─── Why this is a plain function and the hook wraps it ───────────────────
 * The resolution order is the load-bearing part of this module — it is what
 * stops a CMS-created project rendering `project.acme-corp.description` on the
 * public site — and it has to be testable.
 *
 * As a hook it would need a React renderer and a DOM environment, which this
 * project's test suite does not have (`environment: 'node'` in
 * vitest.config.ts). Written as a function over its inputs, the whole chain is
 * exercised by lib/cms/projectCopy.test.ts with two plain callbacks.
 *
 * Step 1 returns the project unchanged for the default locale, so the steps
 * below fall through to the dictionary and then to the row — which for English
 * are the same words.
 */
export function resolveProjectCopy(
  project: Project,
  locale: Locale,
  { t, tList }: Dictionaries,
): ResolvedProjectCopy {
  const translated = localize<ProjectCopy>(
    project,
    project.translations,
    locale,
  );

  const has = (field: keyof ProjectCopy) =>
    project.translations?.[locale]?.[field] !== undefined;

  const textField = (
    field: 'title' | 'description' | 'category' | 'industry' | 'summary'
      | 'challenge' | 'solution' | 'outcome',
  ): string | undefined => {
    if (has(field)) return translated[field];
    return dictionaryText(t, project.slug, field) ?? project[field];
  };

  const listField = (
    field: 'services' | 'technologies' | 'capabilities',
  ): string[] | undefined => {
    if (has(field)) return translated[field];
    return dictionaryList(tList, project.slug, field) ?? project[field];
  };

  return {
    // `title` is the one field with no dictionary key, by design: a project's
    // name is a proper noun and is not translated. It still goes through the
    // CMS translation, because a name CAN legitimately differ in a script the
    // reader uses — a Russian page may want the Cyrillic form.
    title: has('title') ? translated.title : project.title,
    description: textField('description') ?? project.description,
    category: textField('category') ?? project.category,
    industry: textField('industry'),
    summary: textField('summary'),
    challenge: textField('challenge'),
    solution: textField('solution'),
    outcome: textField('outcome'),
    services: listField('services'),
    technologies: listField('technologies'),
    capabilities: listField('capabilities'),
    // Alt text has never had a dictionary key — it did not exist before the
    // media library — so its chain is the CMS translation, then the row.
    thumbnailAlt: has('thumbnailAlt')
      ? translated.thumbnailAlt
      : project.thumbnailAlt,
    heroImageAlt: has('heroImageAlt')
      ? translated.heroImageAlt
      : project.heroImageAlt,
  };
}

/**
 * The same resolution, for a component.
 *
 * A hook only so it can read the locale and the dictionaries from context,
 * which is also what makes it re-run when the visitor switches language — the
 * mechanism every translated string on the site already uses.
 */
export function useProjectCopy(project: Project): ResolvedProjectCopy {
  const { t, tList, locale } = useLanguage();
  return resolveProjectCopy(project, locale, { t, tList });
}

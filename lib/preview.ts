/**
 * Rendering unpublished content, for the person holding a preview link.
 *
 * ─── What makes this safe ─────────────────────────────────────────────────
 * Nothing in this file decides who may see a draft. The token does, and the
 * decision is made inside the database:
 * public.preview_project(token) / public.preview_insight(token) look the token
 * up by its sha256, check that it has not expired and has not been revoked,
 * and return one row — the one the token was minted for — or nothing at all.
 *
 * So this module has no authorization logic to get wrong. It passes a string
 * through and renders whatever comes back, and every failure mode — a missing
 * token, a typo, an expired link, a revoked one, a token for the other content
 * type — arrives here identically, as no row.
 *
 * ─── Why this is a separate module from portfolio.ts and editorial.ts ─────
 * Those two are the PUBLIC surface and their defining property is that they
 * cannot return a draft. Adding a token parameter to them would mean the
 * function that renders the live site is one argument away from rendering an
 * unpublished one, and that argument would be reachable from a query string.
 *
 * Keeping preview in its own module means the public loaders have no code path
 * to drafts at all, which is a property that can be checked by reading them.
 *
 * ─── These routes are never cached ────────────────────────────────────────
 * `cache: 'no-store'`, which elsewhere in this codebase is called out as a
 * mistake because it opts a route out of static rendering. Here that is the
 * intent: a preview must show what the editor saved thirty seconds ago, and
 * the route is deliberately dynamic. It is also the one place where a cached
 * response would be a security problem rather than a staleness problem — a
 * shared cache holding a draft keyed by a URL that contains its own token.
 */

import { rpcEndpoint } from '@/lib/commercial/config';
import { toProject } from '@/lib/portfolio';
import { toInsight } from '@/lib/editorial';
import type { Project } from '@/lib/projects';
import type { InsightArticle } from '@/lib/insights';
import { bool, record } from '@/lib/cms/sanitize';
import { isLocale, type Locale } from '@/lib/i18n/config';

const REQUEST_TIMEOUT_MS = 8000;

/** What a preview page needs beyond the content itself. */
export interface PreviewState {
  /** Whether this content is currently on the public site. */
  published: boolean;
  archived: boolean;
  /** The locale the link was minted for, if it named one. */
  locale?: Locale;
}

export type PreviewResult<T> = { content: T; state: PreviewState } | null;

/**
 * A token that could plausibly have been issued.
 *
 * 64 lower-case hex characters, matching issue_preview_token(). Checked before
 * the request so a URL carrying rubbish — a truncated copy-paste, a crawler
 * appending a tracking parameter — costs a round trip and a database lookup
 * rather than being sent. The database applies the same rule again.
 */
function looksLikeToken(value: unknown): value is string {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

/** One row from a preview RPC, or null. */
async function callPreview(
  fn: 'preview_project' | 'preview_insight',
  token: string,
): Promise<Record<string, unknown> | null> {
  const endpoint = rpcEndpoint(fn);
  if (!endpoint) return null;

  try {
    const response = await fetch(endpoint.url, {
      method: 'POST',
      headers: {
        apikey: endpoint.anonKey,
        Authorization: `Bearer ${endpoint.anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ p_token: token }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: 'no-store',
    });

    if (!response.ok) return null;

    const rows: unknown = await response.json();
    if (!Array.isArray(rows) || rows.length === 0) return null;

    return record(rows[0]);
  } catch {
    // A timeout, a DNS failure, a body that is not JSON. There is nothing to
    // fall back to — unlike the public loaders, a preview has no offline
    // answer — so this becomes a not-found page.
    return null;
  }
}

/** The publication state and requested locale, read off a preview row. */
function readState(row: Record<string, unknown>): PreviewState {
  const locale = row.preview_locale;
  return {
    published: bool(row.published),
    archived: bool(row.archived),
    ...(isLocale(locale) ? { locale } : {}),
  };
}

/**
 * The project a token names, draft or not.
 *
 * Reuses toProject() — the same reader the live site uses — so a preview
 * renders through exactly the code path the published page will. A preview
 * that used a more permissive reader would show the editor a page the public
 * site would then decline to render.
 *
 * One consequence worth stating: a draft too incomplete for toProject() to
 * accept (no title, no category) previews as nothing. That is the correct
 * answer, and it is the same answer publishing it would give.
 */
export async function loadPreviewProject(
  token: unknown,
): Promise<PreviewResult<Project>> {
  if (!looksLikeToken(token)) return null;

  const row = await callPreview('preview_project', token);
  if (!row) return null;

  const content = toProject(row);
  if (!content) return null;

  return { content, state: readState(row) };
}

/** The article a token names, draft or not. See loadPreviewProject(). */
export async function loadPreviewInsight(
  token: unknown,
): Promise<PreviewResult<InsightArticle>> {
  if (!looksLikeToken(token)) return null;

  const row = await callPreview('preview_insight', token);
  if (!row) return null;

  // `draft: true` relaxes the two fields the database requires only at publish
  // time — the date and the body — so an article being written can be
  // previewed. See toInsight().
  const content = toInsight(row, { draft: true });
  if (!content) return null;

  return { content, state: readState(row) };
}

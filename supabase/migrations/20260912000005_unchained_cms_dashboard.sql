-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business CMS: the content dashboard
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260912000001..000004 — the CMS tables and unchained_manages_content()
--
-- Creates:
--     unchained_content_stats()          the counts the landing page shows
--     unchained_recent_content()         what changed lately, across types
--     unchained_translation_coverage()   which locales are behind
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- The CMS landing page needs seven numbers and two short lists. Computed in
-- the browser that is nine queries, four of which fetch entire tables to count
-- them; computed here it is three calls returning a few dozen bytes.
--
-- ─── The rule these three functions are written against ───────────────────
-- "Do not build analytics that are not actually supported by the data."
--
-- So there are no trends, no week-over-week deltas and no view counts. This
-- database records what content exists and when it changed; it does not record
-- who read it, and a dashboard implying otherwise would be inventing a
-- measurement. Every number below is a COUNT over a state that is actually
-- stored.
--
-- ─── Why SECURITY DEFINER for a read the caller could do themselves ───────
-- These are convenience aggregates over tables the caller can already read
-- under the module's SELECT policy, so the privilege buys no data — it buys
-- the counts being one round trip instead of nine.
--
-- Each therefore re-asks the authorization question itself, rather than
-- inheriting it from RLS that no longer applies. `has_product_access` and not
-- `unchained_manages_content`: seeing that the portfolio holds nine projects
-- is not an editorial act, and a commercial opening the Unchained admin should
-- not hit an error on a summary screen.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor. Safe to run twice.

-- ─── 1. The counts ────────────────────────────────────────────────────────
-- One row, one column per number the landing page prints. A row rather than a
-- JSON blob so the shape is in the signature and the panel's types can be
-- derived from it.

CREATE OR REPLACE FUNCTION public.unchained_content_stats()
RETURNS TABLE (
  projects_total      INTEGER,
  projects_published  INTEGER,
  projects_draft      INTEGER,
  projects_archived   INTEGER,
  insights_total      INTEGER,
  insights_published  INTEGER,
  insights_draft      INTEGER,
  insights_archived   INTEGER,
  media_total         INTEGER,
  media_bytes         BIGINT,
  -- Live preview links. Worth a number on the dashboard because an unpublished
  -- page with a working public URL is the one piece of CMS state that is easy
  -- to forget and unwise to leave lying around.
  preview_links_live  INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  SELECT
    -- The three project states are mutually exclusive by the constraints in
    -- 20260912000001: archived implies not published, so draft is "neither".
    (SELECT count(*)::INTEGER FROM public.unchained_projects),
    (SELECT count(*)::INTEGER FROM public.unchained_projects
      WHERE published AND archived_at IS NULL),
    (SELECT count(*)::INTEGER FROM public.unchained_projects
      WHERE NOT published AND archived_at IS NULL),
    (SELECT count(*)::INTEGER FROM public.unchained_projects
      WHERE archived_at IS NOT NULL),

    (SELECT count(*)::INTEGER FROM public.unchained_insights),
    (SELECT count(*)::INTEGER FROM public.unchained_insights
      WHERE published AND archived_at IS NULL),
    (SELECT count(*)::INTEGER FROM public.unchained_insights
      WHERE NOT published AND archived_at IS NULL),
    (SELECT count(*)::INTEGER FROM public.unchained_insights
      WHERE archived_at IS NOT NULL),

    (SELECT count(*)::INTEGER FROM public.unchained_media),
    -- COALESCE because sum() over an empty library is NULL, and a dashboard
    -- showing "— MB" for "nothing uploaded yet" reads as a broken query.
    (SELECT COALESCE(sum(size_bytes), 0)::BIGINT FROM public.unchained_media),

    (SELECT count(*)::INTEGER FROM public.unchained_preview_tokens
      WHERE revoked_at IS NULL AND expires_at > now())
  WHERE public.has_product_access('unchained');
$fn$;

REVOKE ALL ON FUNCTION public.unchained_content_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_content_stats() TO authenticated;

-- ─── 2. What changed lately ───────────────────────────────────────────────
-- Both content types in one list, newest first, so the dashboard does not have
-- to interleave two queries in the browser and guess at the ordering.
--
-- `kind` is what the panel turns into a link: 'project' → the project editor,
-- 'insight' → the article editor. It is the same vocabulary
-- unchained_preview_tokens.content_type uses, deliberately — one word for one
-- thing across the whole module.

CREATE OR REPLACE FUNCTION public.unchained_recent_content(p_limit INTEGER DEFAULT 8)
RETURNS TABLE (
  kind        TEXT,
  id          UUID,
  slug        TEXT,
  title       TEXT,
  state       TEXT,
  updated_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  SELECT * FROM (
    SELECT
      'project'::TEXT AS kind,
      p.id, p.slug, p.title,
      -- The three-state vocabulary the UI badges, derived here rather than in
      -- the browser so the panel's list and its filters cannot disagree about
      -- what "draft" means.
      CASE
        WHEN p.archived_at IS NOT NULL THEN 'archived'
        WHEN p.published                THEN 'published'
        ELSE                                 'draft'
      END AS state,
      p.updated_at
    FROM public.unchained_projects p

    UNION ALL

    SELECT
      'insight'::TEXT,
      a.id, a.slug, a.title,
      CASE
        WHEN a.archived_at IS NOT NULL THEN 'archived'
        WHEN a.published                THEN 'published'
        ELSE                                 'draft'
      END,
      a.updated_at
    FROM public.unchained_insights a
  ) recent
  WHERE public.has_product_access('unchained')
  ORDER BY recent.updated_at DESC
  -- Clamped: a caller asking for a million rows would turn a dashboard widget
  -- into a full table scan of both content types.
  LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 8), 50));
$fn$;

REVOKE ALL ON FUNCTION public.unchained_recent_content(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_recent_content(INTEGER) TO authenticated;

-- ─── 3. Translation coverage ──────────────────────────────────────────────
-- For each active locale, how much of the PUBLISHED content has a published
-- translation. This is the one number a six-language site actually needs on a
-- dashboard, and it is the question the panel's per-item translation matrix
-- cannot answer at a glance.
--
-- ─── The denominator is published content, not all content ────────────────
-- Counting drafts would mean the coverage figure drops every time somebody
-- starts writing something, which is both wrong and demoralising. A draft has
-- nothing to translate yet; what matters is whether what is ON THE SITE is
-- readable in each language.
--
-- The default locale is included and will read 100%, because the parent rows
-- ARE the default locale. That is not a rounding artefact — it is the fact the
-- other rows are measured against, and hiding it would make the table look
-- like five languages with no baseline.

CREATE OR REPLACE FUNCTION public.unchained_translation_coverage()
RETURNS TABLE (
  locale              TEXT,
  label               TEXT,
  is_default          BOOLEAN,
  projects_total      INTEGER,
  projects_translated INTEGER,
  insights_total      INTEGER,
  insights_translated INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  WITH published_projects AS (
    SELECT id FROM public.unchained_projects
     WHERE published AND archived_at IS NULL
  ),
  published_insights AS (
    SELECT id FROM public.unchained_insights
     WHERE published AND archived_at IS NULL
  )
  SELECT
    l.code,
    l.label,
    l.is_default,
    (SELECT count(*)::INTEGER FROM published_projects),
    CASE WHEN l.is_default
      THEN (SELECT count(*)::INTEGER FROM published_projects)
      ELSE (
        SELECT count(*)::INTEGER
          FROM published_projects pp
         WHERE EXISTS (
                 SELECT 1 FROM public.unchained_project_translations t
                  WHERE t.project_id = pp.id AND t.locale = l.code AND t.published
               )
      )
    END,
    (SELECT count(*)::INTEGER FROM published_insights),
    CASE WHEN l.is_default
      THEN (SELECT count(*)::INTEGER FROM published_insights)
      ELSE (
        SELECT count(*)::INTEGER
          FROM published_insights pi
         WHERE EXISTS (
                 SELECT 1 FROM public.unchained_insight_translations t
                  WHERE t.insight_id = pi.id AND t.locale = l.code AND t.published
               )
      )
    END
  FROM public.unchained_locales l
  WHERE l.active
    AND public.has_product_access('unchained')
  ORDER BY l.display_order, l.code;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_translation_coverage() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_translation_coverage() TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The three functions run, and the project counts partition the table. If the
-- three states ever stop summing to the total, one of the lifecycle
-- constraints has been relaxed and a row is in two states at once.
DO $blk$
DECLARE
  s RECORD;
BEGIN
  SELECT * INTO s FROM public.unchained_content_stats();

  IF s IS NULL THEN
    -- Applying as the table owner through the SQL editor, has_product_access()
    -- may be false: there is no auth.uid() in that session. The functions are
    -- correct; there is simply nothing for them to report. Say so rather than
    -- failing a migration over it.
    RAISE NOTICE '[skip] content stats returned no row — no authenticated caller in this session';
  ELSE
    IF s.projects_published + s.projects_draft + s.projects_archived
       <> s.projects_total THEN
      RAISE EXCEPTION '[fail] project states do not partition the table: %+%+% <> %',
        s.projects_published, s.projects_draft, s.projects_archived, s.projects_total;
    END IF;
    IF s.insights_published + s.insights_draft + s.insights_archived
       <> s.insights_total THEN
      RAISE EXCEPTION '[fail] insight states do not partition the table';
    END IF;
    RAISE NOTICE '[ok] content stats: % projects (% published), % insights (% published)',
      s.projects_total, s.projects_published, s.insights_total, s.insights_published;
  END IF;

  -- Both list functions must at least execute without error, whatever the
  -- session's identity.
  PERFORM public.unchained_recent_content(5);
  PERFORM public.unchained_translation_coverage();
  RAISE NOTICE '[ok] recent content and translation coverage execute';
END;
$blk$;

DO $blk$
BEGIN
  IF has_function_privilege('anon', 'public.unchained_content_stats()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can read the content dashboard';
  END IF;
  IF has_function_privilege('anon', 'public.unchained_recent_content(integer)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can list recently changed content';
  END IF;
  IF has_function_privilege('anon', 'public.unchained_translation_coverage()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can read translation coverage';
  END IF;
  RAISE NOTICE '[ok] the dashboard is closed to anon';
END;
$blk$;

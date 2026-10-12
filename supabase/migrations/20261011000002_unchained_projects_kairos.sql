-- ════════════════════════════════════════════════════════════
-- Phase 10.2 — Kairós joins the published portfolio
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260907000002_unchained_projects.sql   unchained_projects, its constraints
--   20260912000001_unchained_cms_core.sql   published_at, set by the trigger
--
-- Changes:
--     one row in public.unchained_projects — slug 'kairos', published
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- Kairós is our own day counter: it counts the days since a marked day,
-- announces every tenth one, and keeps a daily check and a daily alarm per
-- counter. It is local-first — no account, no server — and ships as an
-- Android app and an installable web app. It is published as `completed`,
-- with an interactive demo of its dashboard (components/demo/apps/kairos).
--
-- ─── Why a migration and not the panel ────────────────────────────────────
-- As 20261011000001 gives for Merxis POS: lib/projects.ts carries the same
-- row, and entering both in one commit is the only way the two cannot
-- disagree at birth. After this file the row is the panel's.
--
-- ─── Not `detailed`, and no external URL ──────────────────────────────────
-- No summary, challenge or solution has been written yet, so the card and the
-- demo carry the project. There is no public address to link to: the app
-- lives on the device.
--
-- ─── The description follows the CONTENT RULE ─────────────────────────────
-- It says what the product does and no outcome: no install count, no user
-- figure.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor rather than running `supabase db push`.
-- ON CONFLICT (slug) DO NOTHING, so applying it twice changes nothing.

INSERT INTO public.unchained_projects (
  slug, title, description, category, status,
  published, featured, detailed, year, display_order,
  industry, thumbnail, thumbnail_width, thumbnail_height
) VALUES
  (
    'kairos',
    'Kairós',
    'Our own day counter: mark the day that matters and Kairós counts every day since, celebrates each ten-day milestone, keeps a daily check and a daily alarm — on Android, iPhone or the web, with your data kept only on your device.',
    'Habit & Milestone Tracker App',
    'completed',
    TRUE, FALSE, FALSE, 2026, 10,
    'Personal habits & wellbeing',
    '/work/kairos.webp', 1355, 580
  )
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The row landed, is published, and the public function returns it — the
-- function is what the website reads.
DO $blk$
DECLARE
  v_published BOOLEAN;
  v_seen      INTEGER;
BEGIN
  SELECT published INTO v_published
  FROM public.unchained_projects
  WHERE slug = 'kairos';

  IF v_published IS NULL THEN
    RAISE EXCEPTION '[fail] kairos was not inserted';
  END IF;

  IF NOT v_published THEN
    RAISE EXCEPTION '[fail] kairos exists but is not published';
  END IF;

  SELECT count(*) INTO v_seen
  FROM public.list_public_projects()
  WHERE slug = 'kairos';

  IF v_seen <> 1 THEN
    RAISE EXCEPTION '[fail] list_public_projects() returned % rows for kairos', v_seen;
  END IF;

  RAISE NOTICE '[ok] kairos is published and public';
END;
$blk$;

-- The flagship did not move: adding a project is not a claim about which one
-- leads the homepage.
DO $blk$
DECLARE
  v_featured TEXT;
BEGIN
  SELECT slug INTO v_featured FROM public.unchained_projects WHERE featured;
  IF v_featured IS DISTINCT FROM 'tancerca' THEN
    RAISE WARNING '[check] the flagship is %, the homepage expects tancerca',
      COALESCE(v_featured, 'none');
  ELSE
    RAISE NOTICE '[ok] flagship is still tancerca';
  END IF;
END;
$blk$;

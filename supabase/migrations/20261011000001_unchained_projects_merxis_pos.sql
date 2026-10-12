-- ════════════════════════════════════════════════════════════
-- Phase 10.1 — Merxis POS joins the published portfolio
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260907000002_unchained_projects.sql   unchained_projects, its constraints
--   20260912000001_unchained_cms_core.sql   published_at, set by the trigger
--
-- Changes:
--     one row in public.unchained_projects — slug 'merxis-pos', published
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- Merxis POS is our own point of sale for small shops: checkout, inventory,
-- expenses and profit, on a phone (Android) or in the browser (PWA), working
-- offline. It is shipped and in use, so it is published as `completed`, with
-- an interactive demo of its till, its sales list and its cash closing
-- (components/demo/apps/merxis-pos).
--
-- ─── Why a migration and not the panel ────────────────────────────────────
-- The same reason 20260907000003 gives for VectorForge: the panel cannot put
-- the project in a checkout with no database behind it, so lib/projects.ts
-- carries the same row, and entering both in one commit is the only way the
-- two cannot disagree at birth. After this file the row is the panel's.
--
-- ─── Not `detailed` ───────────────────────────────────────────────────────
-- A detail page needs a summary, a challenge and a solution, and none has been
-- written yet. The card and the demo carry the project until one is.
--
-- ─── The description follows the CONTENT RULE ─────────────────────────────
-- It says what the product does, in the words of its own store listing, and
-- no outcome: no store count, no sales volume, no user figure.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor rather than running `supabase db push`.
-- ON CONFLICT (slug) DO NOTHING, so applying it twice changes nothing.

INSERT INTO public.unchained_projects (
  slug, title, description, category, status,
  published, featured, detailed, year, display_order,
  industry, thumbnail, thumbnail_width, thumbnail_height, external_url
) VALUES
  (
    'merxis-pos',
    'Merxis POS',
    'Our own point of sale for shops, corner stores, cafés and small businesses: checkout, inventory, expenses and real profit, on a phone or a computer — and it keeps working offline.',
    'Point of Sale App',
    'completed',
    TRUE, FALSE, FALSE, 2026, 9,
    'Retail & small business',
    '/work/merxis-pos.png', 1360, 579,
    'https://counter-store.vercel.app'
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
  WHERE slug = 'merxis-pos';

  IF v_published IS NULL THEN
    RAISE EXCEPTION '[fail] merxis-pos was not inserted';
  END IF;

  IF NOT v_published THEN
    RAISE EXCEPTION '[fail] merxis-pos exists but is not published';
  END IF;

  SELECT count(*) INTO v_seen
  FROM public.list_public_projects()
  WHERE slug = 'merxis-pos';

  IF v_seen <> 1 THEN
    RAISE EXCEPTION '[fail] list_public_projects() returned % rows for merxis-pos', v_seen;
  END IF;

  RAISE NOTICE '[ok] merxis-pos is published and public';
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

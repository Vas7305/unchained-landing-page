-- ════════════════════════════════════════════════════════════
-- Phase 10.4 — Merxis POS moves to its own domain
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20261011000001_unchained_projects_merxis_pos.sql   the 'merxis-pos' row
--
-- Changes:
--     public.unchained_projects.external_url for slug 'merxis-pos'
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- 20261011000001 published Merxis POS with its Vercel address,
-- https://counter-store.vercel.app. The product now lives at
-- https://www.merxispos.com, and that is where "Visitar el producto en vivo"
-- (detail.visitLive) on the project page and the demo page should point.
--
-- ─── Why a new file and not an edit to 20261011000001 ─────────────────────
-- That file has already been applied, and its insert is ON CONFLICT DO
-- NOTHING, so editing it would change nothing in a database that has the row.
-- lib/projects.ts carries the same URL for builds with no database.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor after 20261011000001. An UPDATE to the same
-- value, so applying it twice changes nothing.

UPDATE public.unchained_projects
SET external_url = 'https://www.merxispos.com'
WHERE slug = 'merxis-pos';

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertion
-- ═══════════════════════════════════════════════════════════════════════════

-- The public function is what the website reads, so the URL is checked there.
DO $blk$
DECLARE
  v_url TEXT;
BEGIN
  SELECT external_url INTO v_url
  FROM public.list_public_projects()
  WHERE slug = 'merxis-pos';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[fail] merxis-pos is not published — apply 20261011000001 first';
  END IF;

  IF v_url IS DISTINCT FROM 'https://www.merxispos.com' THEN
    RAISE EXCEPTION '[fail] merxis-pos external_url is %', COALESCE(v_url, 'null');
  END IF;

  RAISE NOTICE '[ok] merxis-pos links to www.merxispos.com';
END;
$blk$;

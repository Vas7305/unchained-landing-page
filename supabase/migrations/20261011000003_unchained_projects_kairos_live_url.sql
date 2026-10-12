-- ════════════════════════════════════════════════════════════
-- Phase 10.3 — Kairós gets its live address
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20261011000002_unchained_projects_kairos.sql   the 'kairos' row
--
-- Changes:
--     public.unchained_projects.external_url for slug 'kairos'
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- 20261011000002 published Kairós with no external URL, because it had no
-- public address then. It has one now: the web app is deployed at
-- https://kairos-alpha-eight.vercel.app. With external_url set, the project
-- page and the demo page show "Visitar el producto en vivo" (detail.visitLive)
-- beside the demo, as they do for Merxis POS.
--
-- ─── Why a new file and not an edit to 20261011000002 ─────────────────────
-- That file may already have been applied, and its insert is ON CONFLICT DO
-- NOTHING, so editing it would change nothing in a database that has the row.
-- lib/projects.ts carries the same URL for builds with no database.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor after 20261011000002. An UPDATE to the same
-- value, so applying it twice changes nothing.

UPDATE public.unchained_projects
SET external_url = 'https://kairos-alpha-eight.vercel.app'
WHERE slug = 'kairos';

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
  WHERE slug = 'kairos';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[fail] kairos is not published — apply 20261011000002 first';
  END IF;

  IF v_url IS DISTINCT FROM 'https://kairos-alpha-eight.vercel.app' THEN
    RAISE EXCEPTION '[fail] kairos external_url is %', COALESCE(v_url, 'null');
  END IF;

  RAISE NOTICE '[ok] kairos links to its live product';
END;
$blk$;

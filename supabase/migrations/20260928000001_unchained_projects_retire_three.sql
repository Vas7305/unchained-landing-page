-- ════════════════════════════════════════════════════════════
-- Phase 10 — Frito, Unchained OS and VectorForge leave the public site
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260907000002_unchained_projects.sql          unchained_projects
--   20260907000003_unchained_projects_vectorforge.sql  the vector-forge row
--   20260912000001_unchained_cms_core.sql          archived_at, and the touch
--                                                  trigger that unpublishes on
--                                                  archive
--
-- Changes:
--     three rows in public.unchained_projects — archived, and therefore
--     unpublished: 'frito', 'unchained-os', 'vector-forge'
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- The homepage is being rebuilt around what a client can buy, and the
-- portfolio behind it is narrowed to the five projects that demonstrate those
-- offers: TanCerca, Lanna Kamilina, Lazara Sersa, Mensalere and Klassisches
-- Ballet. The other three are not client-facing examples of anything the site
-- sells, and are retired from the public site — /work, their detail pages,
-- their demos and the sitemap.
--
-- ─── Archived, not deleted, and not merely unpublished ────────────────────
-- Archive is the CMS's "retired but recoverable" state. It keeps every field,
-- every translation and the original published_at, and it is the state the
-- panel's status filter shows as retired rather than as an unfinished draft —
-- which is what these are. Restoring one is clearing archived_at and
-- publishing it again from the panel; nothing here has to be re-entered.
--
-- `published` is not set by this file. unchained_projects_touch() sets it to
-- FALSE on the transition into archive, and the
-- unchained_projects_archived_not_published CHECK guarantees the result — so
-- the public function, which filters on `published` alone, stops returning
-- these rows the moment this commits.
--
-- ─── The code half of the same change ─────────────────────────────────────
-- The three demos were deleted from the repository in the same commit, and the
-- three rows were removed from lib/projects.ts `fallbackProjects`, so a build
-- with no database behind it agrees with the table. The thumbnails under
-- public/work/ are kept: they are what these rows point at, and an archived
-- row restored in the panel should come back with its image.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`. The UPDATE only touches rows that
-- are not archived yet, so applying it twice changes nothing the second time.
-- Until it is applied, the live site keeps listing the three projects — as
-- cards without a demo, since the demo code is gone.

UPDATE public.unchained_projects
   SET archived_at = now()
 WHERE slug IN ('frito', 'unchained-os', 'vector-forge')
   AND archived_at IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- None of the three is published, and none is visible through the function
-- the website reads. Checked through list_public_projects() as well as the
-- column, because the function is the contract the site depends on.
DO $blk$
DECLARE
  v_published INTEGER;
  v_visible   INTEGER;
BEGIN
  SELECT count(*) INTO v_published
  FROM public.unchained_projects
  WHERE slug IN ('frito', 'unchained-os', 'vector-forge') AND published;

  IF v_published <> 0 THEN
    RAISE EXCEPTION '[fail] % retired project(s) are still published', v_published;
  END IF;

  SELECT count(*) INTO v_visible
  FROM public.list_public_projects()
  WHERE slug IN ('frito', 'unchained-os', 'vector-forge');

  IF v_visible <> 0 THEN
    RAISE EXCEPTION '[fail] list_public_projects() still returns % retired project(s)',
      v_visible;
  END IF;

  RAISE NOTICE '[ok] frito, unchained-os and vector-forge are off the public site';
END;
$blk$;

-- Nothing else moved. The flagship is still TanCerca, and the five projects
-- the homepage is built around are still published — this file retires three
-- rows, it does not reshape the portfolio around them.
--
-- WARNING rather than EXCEPTION: none of this is something the UPDATE above
-- could have caused, and an editor who has since unpublished one of the five
-- in the panel is not a reason to refuse the archive. It is a reason to look.
DO $blk$
DECLARE
  v_featured TEXT;
  v_kept     INTEGER;
BEGIN
  SELECT slug INTO v_featured FROM public.unchained_projects WHERE featured;
  IF v_featured IS DISTINCT FROM 'tancerca' THEN
    RAISE WARNING '[check] the flagship is %, the homepage expects tancerca',
      COALESCE(v_featured, 'none');
  END IF;

  SELECT count(*) INTO v_kept
  FROM public.list_public_projects()
  WHERE slug IN ('tancerca', 'lanna-kamilina', 'lazara-sersa', 'mensalere',
                 'klassisches-ballet');
  IF v_kept <> 5 THEN
    RAISE WARNING '[check] % of the five homepage projects are public', v_kept;
  ELSE
    RAISE NOTICE '[ok] five projects public, flagship is %', v_featured;
  END IF;
END;
$blk$;

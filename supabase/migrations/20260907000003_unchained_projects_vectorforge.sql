-- ════════════════════════════════════════════════════════════
-- Phase 9.1 — VectorForge joins the published portfolio
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260907000002_unchained_projects.sql   unchained_projects, its constraints
--
-- Changes:
--     one row in public.unchained_projects — slug 'vector-forge', published
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- VectorForge is the desktop application we use to produce the vector, icon
-- and favicon assets behind the rest of the portfolio. It reached 1.0 and a
-- signed Windows installer, which by this site's own rule — a project's name,
-- story and detail page are published when it ships, not before — is the point
-- at which it belongs on /work with a case study rather than as a placeholder.
--
-- ─── Why a migration and not the panel ────────────────────────────────────
-- The panel is where the portfolio is edited, and after this file the row is
-- the panel's to change like any other. What the panel cannot do is put the
-- project in a checkout that has no database behind it: lib/projects.ts still
-- has to carry the same row, because a preview deploy or a local build with no
-- .env renders that list instead. Entering it in both places at once — one
-- commit, one review — is the only way the two cannot disagree at birth.
--
-- ─── Why `internal` and not `completed` ───────────────────────────────────
-- STATUS_META reads: completed is "Built, shipped and live"; internal is
-- "Built and owned by Unchained Business". VectorForge is shipped, but it is
-- not sold and has no public URL — it is our own tool, in daily use on our own
-- projects. `internal` is the status that says that without implying a market
-- it does not have. It is the first row to carry it, so /work now draws the
-- Internal Product entry in its status legend.
--
-- ─── No external_url, and no invented outcome ─────────────────────────────
-- There is no page for a visitor to visit: the product is an installer, not a
-- website, and the column takes an http(s) URL or nothing. The outcome follows
-- the CONTENT RULE on that column — it states what the deliverable is (a
-- shipped 1.0 in daily use) rather than a download count or a saving nobody
-- measured.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`. The INSERT is ON CONFLICT (slug) DO
-- NOTHING, so applying it twice — or applying it after somebody has already
-- edited the project in the panel — changes nothing the second time.

INSERT INTO public.unchained_projects (
  slug, title, description, category, status,
  published, featured, detailed, year, display_order,
  industry, services, technologies, capabilities,
  thumbnail, thumbnail_width, thumbnail_height, hero_image,
  summary, challenge, solution, outcome, external_url
) VALUES
  (
    'vector-forge',
    'VectorForge',
    'A desktop asset production workstation we built for our own work: it traces raster artwork into clean vector files, retouches and compresses images, and generates the complete icon and favicon packages every launch needs — processed entirely on the machine.',
    'Desktop Application',
    'internal',
    TRUE, FALSE, TRUE, 2026, 8,
    'Design tooling & asset production',
    ARRAY['Product architecture', 'Product design', 'Desktop application development', 'Release engineering'],
    ARRAY['Tauri 2', 'Rust', 'React', 'TypeScript', 'Zustand', 'Vite'],
    ARRAY['Desktop applications (Tauri + Rust)', 'Raster-to-vector tracing', 'Native image processing', 'Icon & favicon generation', 'Batch job orchestration', 'Offline-first architecture', 'Signed installers & auto-update', 'Design system implementation'],
    -- A PNG rather than the .webp every other card carries: this is the
    -- screenshot as it was captured, and there is no image toolchain in this
    -- repository to convert it with. next.config.ts sets images.unoptimized, so
    -- the file is served exactly as it sits on disk either way.
    '/work/vector-forge.png', NULL, NULL, NULL,
    'VectorForge is the asset pipeline behind our own projects: a Windows desktop application that converts raster artwork into production-ready SVG, retouches and optimises images, and produces the full icon, favicon and web-asset packages a site or app launch requires — with every file processed on the machine rather than uploaded to a service.',
    'Every project we ship needs the same set of assets: a logo as clean SVG, favicons at a dozen sizes, application icons per platform, images compressed without being degraded. Producing them meant a chain of free web converters and one-off scripts — brand artwork uploaded to services we do not control, settings nobody recorded, and output that differed depending on who prepared it and on what day. It was slow on every project, and it was never twice the same.',
    'We built the pipeline as a desktop application. A Rust core does the work — raster-to-vector tracing in four tuned modes (logo, icon, illustration, precision), SVG rendering and optimisation, classical image adjustments, and icon-set generation — while a React interface keeps every setting visible and every result reviewable before it is committed. Projects keep their assets, versions and lineage on disk, so an enhancement is a new version rather than an overwritten file; a batch queue applies one recipe to a whole folder; and export produces a validated ZIP with a manifest instead of a folder assembled by hand. It ships as a signed Windows installer on its own update channel.',
    'A shipped 1.0 in daily use: the tool that now produces the vector, icon and favicon assets behind the rest of this portfolio, running offline on the machine that holds the artwork.',
    NULL
  )
ON CONFLICT (slug) DO NOTHING;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The row landed, it is published, and it carries the prose its detail page
-- renders. `detailed` is checked against the columns rather than the flag
-- alone, because lib/portfolio.ts drops the flag when the prose is missing —
-- a row that passed here on the flag would still render as an ordinary card.
DO $blk$
DECLARE
  v_row public.unchained_projects%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM public.unchained_projects
  WHERE slug = 'vector-forge';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[fail] vector-forge was not inserted';
  END IF;

  IF NOT v_row.published THEN
    RAISE EXCEPTION '[fail] vector-forge exists but is not published';
  END IF;

  IF NOT (v_row.detailed
          AND v_row.summary IS NOT NULL
          AND v_row.challenge IS NOT NULL
          AND v_row.solution IS NOT NULL) THEN
    RAISE EXCEPTION '[fail] vector-forge has no detail page to link to';
  END IF;

  RAISE NOTICE '[ok] vector-forge published as % (%)', v_row.status, v_row.year;
END;
$blk$;

-- The flagship did not move. Adding a project is not a claim about which one
-- leads the homepage, and the partial unique index would not have caught a
-- second featured row being refused — it would have caught it being accepted.
DO $blk$
DECLARE
  v_featured TEXT;
  v_published INTEGER;
BEGIN
  SELECT slug INTO v_featured FROM public.unchained_projects WHERE featured;
  IF v_featured IS DISTINCT FROM 'tancerca' THEN
    RAISE EXCEPTION '[fail] the flagship should still be tancerca, found %',
      COALESCE(v_featured, 'none');
  END IF;

  SELECT count(*) INTO v_published
  FROM public.unchained_projects WHERE published;
  IF v_published < 8 THEN
    RAISE EXCEPTION '[fail] expected at least eight published projects, found %',
      v_published;
  END IF;

  RAISE NOTICE '[ok] % published projects, flagship is %', v_published, v_featured;
END;
$blk$;

-- The public function shows it. list_public_projects() is what the website
-- reads, and a row that is published but invisible through the function would
-- be a portfolio entry nobody outside the panel ever sees.
DO $blk$
DECLARE
  v_seen INTEGER;
BEGIN
  SELECT count(*) INTO v_seen
  FROM public.list_public_projects()
  WHERE slug = 'vector-forge';

  IF v_seen <> 1 THEN
    RAISE EXCEPTION '[fail] list_public_projects() returned % rows for vector-forge',
      v_seen;
  END IF;

  RAISE NOTICE '[ok] vector-forge is visible through list_public_projects()';
END;
$blk$;

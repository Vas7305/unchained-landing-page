-- ════════════════════════════════════════════════════════════
-- Phase 9 — Unchained Business projects: the published portfolio
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   has_product_access()
--   20260905000004_unchained_leads.sql        unchained_manages_leads()
--
-- Creates:
--     unchained_projects                 the portfolio, one row per project
--     unchained_projects_touch()         updated_at + updated_by on UPDATE
--     unchained_projects_stamp_author()  updated_by on INSERT
--     list_public_projects()             the entire public surface of this module
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- /unchained/projects has, until now, drawn a fixed empty state. Its comment
-- said why: "work already shown on the public Unchained Business site stays
-- where it is until someone deliberately enters it, because copying it in
-- automatically would create records nobody reviewed." That reasoning was
-- about an unattended import. It was never an argument against the module
-- existing, and it is satisfied by this file — the seven rows seeded in §4 are
-- a transcription of lib/projects.ts reviewed line by line as part of this
-- change, not a job that ran over a table nobody read.
--
-- After this the portfolio has one home. lib/projects.ts stops being the
-- source of truth and becomes the fallback the site renders when it has no
-- database behind it, exactly as commercial routing already falls back.
--
-- ─── Why a table and not the file it replaces ─────────────────────────────
-- The file works, and for a portfolio that changes twice a year it would have
-- kept working. What it cannot do is let somebody who is not holding a
-- checkout publish a project: every edit is a commit, a review and a deploy.
-- The panel exists so the people who run the business can change what the
-- business says about itself. A portfolio is the most obvious thing in that
-- category, and it was the one module still requiring an engineer.
--
-- ─── `published` is not `status` ──────────────────────────────────────────
-- Two different questions that a single field would confuse:
--   status     what is TRUE of the work — shipped, being built, abandoned.
--   published  whether the site says anything about it AT ALL.
-- A dismissed project stays on the site (Klassisches Ballet does today, and
-- saying so is more honest than deleting it). An in-development project may be
-- drafted here for weeks before anyone outside sees it. Collapsing the two
-- would mean the only way to hide a draft is to lie about its status.
--
-- Nothing anonymous can read an unpublished row: §5 grants anon no table
-- access at all, and the function in §6 filters on `published` before the
-- caller is involved.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`, which would replay history against
-- live production. Every object uses IF NOT EXISTS, CREATE OR REPLACE or
-- DROP-then-CREATE on its own name, so it is safe to run twice.

-- ─── 1. The table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unchained_projects (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identity ──────────────────────────────────────────────────────────
  -- The slug is the URL: /work/<slug>. UNIQUE because two rows claiming one
  -- address is not a display problem to be resolved at render time, it is a
  -- second page that can never be reached. The pattern admits lower-case words
  -- joined by single hyphens and nothing else — no leading, trailing or
  -- doubled hyphen — so a slug cannot be written that needs escaping, or that
  -- normalises to another row's.
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  -- One or two sentences. This is the card text on the homepage grid and on
  -- /work, so it is the only prose most visitors read about the project.
  description   TEXT NOT NULL,
  -- The label under the title: "Marketplace Platform", "Event Website".
  category      TEXT NOT NULL,

  -- ── What is true of the work, and what the site says about it ─────────
  status        TEXT NOT NULL DEFAULT 'in-development',
  -- FALSE by default: a new row is a draft. A project appears on the website
  -- because somebody set this, never because they created the record.
  published     BOOLEAN NOT NULL DEFAULT FALSE,
  -- The flagship. At most one, enforced by a partial unique index below — the
  -- site renders `projects.find(p => p.featured)`, which silently picks one of
  -- several rather than reporting the ambiguity.
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  -- Whether this project has enough published detail to warrant /work/<slug>.
  -- Constrained below: it cannot be set without the prose that page renders.
  detailed      BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Ordering ──────────────────────────────────────────────────────────
  -- Most recent first, and equal years fall back to display_order. The file
  -- this replaces relied on its own line order for that tie-break; a table has
  -- no line order, so the tie-break is a column rather than a coincidence of
  -- the order rows happened to be inserted in.
  year          SMALLINT,
  display_order INTEGER NOT NULL DEFAULT 0,

  -- ── The card ──────────────────────────────────────────────────────────
  industry      TEXT,
  -- Empty arrays, not NULL. "No technologies listed" and "technologies not
  -- filled in" render identically, and a nullable array means every reader
  -- writes COALESCE before it can iterate.
  services      TEXT[] NOT NULL DEFAULT '{}',
  technologies  TEXT[] NOT NULL DEFAULT '{}',
  -- What the project proves we can build. Used INSTEAD OF invented metrics —
  -- see the content rule on `outcome` below.
  capabilities  TEXT[] NOT NULL DEFAULT '{}',

  thumbnail     TEXT,
  -- The intrinsic pixel size of `thumbnail`, needed only where the image is
  -- shown uncropped (the flagship card). Both or neither: a width without a
  -- height cannot size anything, and storing half of it invites a reader to
  -- treat the pair as present.
  thumbnail_width  INTEGER,
  thumbnail_height INTEGER,
  hero_image    TEXT,

  -- ── The detail page ───────────────────────────────────────────────────
  summary       TEXT,
  challenge     TEXT,
  solution      TEXT,
  -- CONTENT RULE, carried over from lib/projects.ts unchanged: never record an
  -- outcome we cannot substantiate. Capability language ("launch-ready
  -- platform", "production marketplace architecture") is always preferable to
  -- an invented metric. The database cannot enforce this one, which is why it
  -- is written where the column is defined rather than in a style guide.
  outcome       TEXT,
  external_url  TEXT,

  -- ── Provenance ────────────────────────────────────────────────────────
  -- updated_by is taken from auth.uid() server-side by the triggers in §2 and
  -- never accepted from the client, for the reason unchained_settings gives: a
  -- client-supplied "who changed this" is a claim, not a record.
  -- ON DELETE SET NULL: the change still happened after the account is gone.
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unchained_projects_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 100),

  CONSTRAINT unchained_projects_title_present
    CHECK (length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_projects_description_present
    CHECK (length(btrim(description)) BETWEEN 1 AND 600),
  CONSTRAINT unchained_projects_category_present
    CHECK (length(btrim(category)) BETWEEN 1 AND 80),

  -- The five states the site knows how to render, and no sixth. STATUS_META in
  -- lib/projects.ts maps each to a badge; a status outside that map produces a
  -- card with no badge and no error, which is the failure hardest to notice.
  -- Written as a CHECK rather than an enum for the reason the rest of this
  -- schema uses CHECKs: adding a state is one ALTER, not a type migration.
  CONSTRAINT unchained_projects_status_known
    CHECK (status IN ('completed', 'in-development', 'concept', 'internal', 'dismissed')),

  CONSTRAINT unchained_projects_year_plausible
    CHECK (year IS NULL OR year BETWEEN 2000 AND 2100),

  CONSTRAINT unchained_projects_industry_length
    CHECK (industry IS NULL OR length(btrim(industry)) BETWEEN 1 AND 120),

  -- Images are site-relative paths (/work/tancerca.webp), never absolute URLs.
  -- An off-site image would make the site's rendering depend on a host nobody
  -- here controls, and next.config.ts sets images.unoptimized precisely because
  -- every asset is expected to be local.
  CONSTRAINT unchained_projects_thumbnail_path
    CHECK (thumbnail IS NULL OR (thumbnail ~ '^/[^[:space:]]*$' AND length(thumbnail) <= 300)),
  CONSTRAINT unchained_projects_hero_image_path
    CHECK (hero_image IS NULL OR (hero_image ~ '^/[^[:space:]]*$' AND length(hero_image) <= 300)),

  CONSTRAINT unchained_projects_thumbnail_size_paired
    CHECK (
      (thumbnail_width IS NULL) = (thumbnail_height IS NULL)
      AND (thumbnail_width  IS NULL OR thumbnail_width  BETWEEN 1 AND 10000)
      AND (thumbnail_height IS NULL OR thumbnail_height BETWEEN 1 AND 10000)
    ),

  -- A size describes an image. Without one there is nothing for it to measure,
  -- and the pair would be read as the dimensions of whatever placeholder the
  -- card falls back to.
  CONSTRAINT unchained_projects_thumbnail_size_needs_thumbnail
    CHECK (thumbnail_width IS NULL OR thumbnail IS NOT NULL),

  CONSTRAINT unchained_projects_summary_length
    CHECK (summary   IS NULL OR length(btrim(summary))   BETWEEN 1 AND 1000),
  CONSTRAINT unchained_projects_challenge_length
    CHECK (challenge IS NULL OR length(btrim(challenge)) BETWEEN 1 AND 2000),
  CONSTRAINT unchained_projects_solution_length
    CHECK (solution  IS NULL OR length(btrim(solution))  BETWEEN 1 AND 2000),
  CONSTRAINT unchained_projects_outcome_length
    CHECK (outcome   IS NULL OR length(btrim(outcome))   BETWEEN 1 AND 600),

  -- A scheme is required, and only the two a browser can follow — the same
  -- rule, for the same reason, as unchained_settings_website_url_format. A bare
  -- "tancercadeti.com" becomes a relative link the moment anything renders it
  -- as an href, landing the visitor on a page of ours that does not exist.
  CONSTRAINT unchained_projects_external_url_format
    CHECK (external_url IS NULL OR (length(external_url) <= 300
       AND external_url ~ '^https?://[^[:space:]]+$')),

  -- `detailed` gives the project a page at /work/<slug>, and that page renders
  -- the summary, the challenge and the solution. Without them it is a heading
  -- over three empty sections. The flag is therefore not a preference — it is a
  -- claim about the row's completeness, and the database is where that claim
  -- can be made true rather than merely remembered.
  CONSTRAINT unchained_projects_detailed_has_prose
    CHECK (
      NOT detailed
      OR (summary IS NOT NULL AND challenge IS NOT NULL AND solution IS NOT NULL)
    ),

  -- The flagship is the largest thing on the homepage, and the site gives it a
  -- detail page to link to. A featured row that is not detailed renders as a
  -- full-width card linking nowhere.
  CONSTRAINT unchained_projects_featured_is_detailed
    CHECK (NOT featured OR detailed)
);

-- At most one flagship — in the whole table rather than among the published
-- ones. Two featured rows where one is a draft would be a conflict waiting for
-- the moment somebody publishes the draft, and finding it then means finding
-- it in production.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unchained_projects_one_featured
  ON public.unchained_projects (featured)
  WHERE featured;

-- The order the site reads them in: newest first, undated last, ties broken by
-- display_order. Partial, on `published`, because that is the only set the
-- public function ever scans and the drafts have no bearing on it.
CREATE INDEX IF NOT EXISTS idx_unchained_projects_published_order
  ON public.unchained_projects (year DESC NULLS LAST, display_order ASC, slug ASC)
  WHERE published;

-- ─── 2. updated_at and updated_by, written by the server ──────────────────
-- Its own function rather than the module's unchained_touch_updated_at(),
-- which sets the timestamp only — the same argument unchained_settings_touch()
-- makes: both columns are provenance, both must be unforgeable, so they are
-- written in one place. A caller that could set updated_by could attribute its
-- own edit to somebody else.
--
-- id and created_at are pinned to their previous values for the same reason.
-- An UPDATE that rewrote created_at would pass every constraint in §1 and
-- quietly destroy the only record of when the project was entered.
--
-- SECURITY INVOKER is right here — auth.uid() reads the request's JWT and does
-- not depend on who owns the function — but search_path is still pinned empty,
-- as every function in this schema is.

CREATE OR REPLACE FUNCTION public.unchained_projects_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  NEW.updated_by := (SELECT auth.uid());
  NEW.id         := OLD.id;
  NEW.created_at := OLD.created_at;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_projects_touch ON public.unchained_projects;
CREATE TRIGGER trg_unchained_projects_touch
  BEFORE UPDATE ON public.unchained_projects
  FOR EACH ROW EXECUTE FUNCTION public.unchained_projects_touch();

-- On INSERT there is no OLD row to pin against and the timestamp defaults
-- already cover the clock. What still has to be written server-side is who did
-- it: unlike the settings singleton, rows here are created by the panel, and a
-- project whose first author is a client-supplied uuid records nothing.

CREATE OR REPLACE FUNCTION public.unchained_projects_stamp_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_projects_stamp_author ON public.unchained_projects;
CREATE TRIGGER trg_unchained_projects_stamp_author
  BEFORE INSERT ON public.unchained_projects
  FOR EACH ROW EXECUTE FUNCTION public.unchained_projects_stamp_author();

-- ─── 3. Row level security ────────────────────────────────────────────────
-- Read: anybody with access to the module, drafts included. A portfolio is the
-- business's public face — there is nothing in one of these rows that one
-- member of the module should be kept from seeing, and a commercial writing to
-- a prospect needs to know what is being built as much as a manager does.
--
-- Write: managers, via unchained_manages_leads(). This is published content:
-- what it says goes out under the company's name, so it is held at the same
-- level as the business profile rather than open to everybody in the module.
-- NOT is_super_admin(), for the reason unchained_settings gives — the
-- super-admin carve-out exists for pay, and holding a project description at
-- that level would mean the one person who can change payroll is the only one
-- who can fix a typo on the homepage.
--
-- anon appears in NO policy here, and that is the whole design of §6.

ALTER TABLE public.unchained_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_projects_read ON public.unchained_projects;
CREATE POLICY unchained_projects_read ON public.unchained_projects
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_projects_manage ON public.unchained_projects;
CREATE POLICY unchained_projects_manage ON public.unchained_projects
  FOR ALL
  USING (public.unchained_manages_leads())
  WITH CHECK (public.unchained_manages_leads());

-- ─── 4. The seven projects the site publishes today ───────────────────────
-- A transcription of lib/projects.ts as it stood on 2026-09-07, in its source
-- order, with `published` set on every one because every one is on the site
-- right now. Applying this file must reproduce the current website exactly —
-- not an improved version of it, and not a subset.
--
-- ON CONFLICT (slug) DO NOTHING, not an UPSERT: running this file a second
-- time must not revert a project somebody has since edited in the panel. The
-- seed is a starting point, and after the first apply the table is the record.
--
-- The five unnamed-until-they-ship entries keep the file's own rule: a
-- project's name, story and detail page are published when it ships, not
-- before. That is why only TanCerca carries prose and `detailed`.

INSERT INTO public.unchained_projects (
  slug, title, description, category, status,
  published, featured, detailed, year, display_order,
  industry, services, technologies, capabilities,
  thumbnail, thumbnail_width, thumbnail_height, hero_image,
  summary, challenge, solution, outcome, external_url
) VALUES
  (
    'tancerca',
    'TanCerca',
    'A marketplace and digital commerce platform designed and developed by Unchained Business.',
    'Marketplace Platform',
    'completed',
    TRUE, TRUE, TRUE, 2026, 1,
    'Local commerce & delivery',
    ARRAY['Product architecture', 'Product design', 'Full-stack development', 'Operational systems'],
    ARRAY['Next.js', 'TypeScript', 'PostgreSQL', 'Payments', 'PWA', 'Cloud infrastructure'],
    ARRAY['Marketplace architecture', 'Merchant systems & dashboards', 'Consumer experience (PWA)', 'Delivery infrastructure', 'Subscriptions & payments', 'Referral systems', 'Backend infrastructure', 'Operational workflows'],
    '/work/tancerca.webp', 747, 546, '/work/tancerca-hero.webp',
    'TanCerca is our first completed flagship product: a marketplace connecting local merchants with nearby customers, including the merchant tooling, delivery coordination and payment infrastructure the marketplace runs on.',
    'A marketplace is not one product — it is three, and they have to work in sync. Merchants need tooling that fits how they actually run a shop. Customers need an experience fast and simple enough to use one-handed. And the operation between them needs orders, delivery and money to move reliably without someone manually holding it together. Building all three as one coherent system, rather than three disconnected apps, was the core problem.',
    'We designed the platform around a single domain model shared by every surface, then built outward: merchant dashboards for catalogue, orders and fulfilment; a consumer PWA built for repeat use and low-bandwidth conditions; and the operational layer underneath — payments, subscriptions, referrals, delivery coordination and reporting. Every part was specified before it was built, which is the same sequence we apply to client work.',
    'A launch-ready, full-stack commerce platform running in production — the most complete demonstration of what we can build end to end.',
    'https://www.tancercadeti.com'
  ),
  (
    'lanna-kamilina',
    'Lanna Kamilina',
    'A Russian-language site for a beauty salon open in central Moscow since 1999 — service catalogue, master profiles, work gallery and online booking with live availability.',
    'Salon & Booking Website',
    'in-development',
    TRUE, FALSE, FALSE, 2026, 2,
    'Beauty & personal care',
    '{}', '{}', '{}',
    '/work/lanna-kamilina.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'lazara-sersa',
    'Lazara Sersa Makeup Artist',
    'A brand and portfolio site for a makeup artist working across beauty, editorial, fashion and celebrity work.',
    'Portfolio Website',
    'in-development',
    TRUE, FALSE, FALSE, 2026, 3,
    'Beauty & editorial',
    '{}', '{}', '{}',
    '/work/lazara-sersa.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'klassisches-ballet',
    'Klassisches Ballet',
    'A launch and reservation site for the official European debut gala of a classical ballet company — a single-night cultural event.',
    'Event Website',
    'dismissed',
    TRUE, FALSE, FALSE, 2025, 4,
    'Performing arts & culture',
    '{}', '{}', '{}',
    '/work/klassisches-ballet.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'mensalere',
    'Mensalere',
    'A platform connecting people with psychology professionals for private online consultations, with professional profiles and online appointment booking.',
    'Online Consultation Platform',
    'in-development',
    TRUE, FALSE, FALSE, 2026, 5,
    'Mental health & wellbeing',
    '{}', '{}', '{}',
    '/work/mensalere.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'frito',
    'Frito',
    'A mobile dating app for meeting new people in Cuba, with the marketing and download site behind its iOS and Android launch.',
    'Mobile App',
    'in-development',
    TRUE, FALSE, FALSE, 2026, 6,
    'Social & dating',
    '{}', '{}', '{}',
    '/work/frito.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  ),
  (
    'unchained-os',
    'Unchained OS',
    'Our own private equity operating system: deal analysis and comparison, pipeline CRM, capital allocation, multi-investor management and fund performance tracking.',
    'Internal Software',
    'in-development',
    TRUE, FALSE, FALSE, 2026, 7,
    'Private equity & investment operations',
    '{}', '{}', '{}',
    '/work/unchained-os.webp', NULL, NULL, NULL,
    NULL, NULL, NULL, NULL, NULL
  )
ON CONFLICT (slug) DO NOTHING;

-- ─── 5. Table privileges ──────────────────────────────────────────────────
-- Belt and braces over RLS, as every earlier phase did it. RLS with no matching
-- anon policy already denies anon, but that is one accidental
-- `CREATE POLICY ... TO public` away from being untrue.
--
-- The REVOKE names authenticated as well as anon, for the reason spelled out in
-- 20260907000001: Supabase ships ALTER DEFAULT PRIVILEGES granting ALL to
-- anon, authenticated and service_role, so those grants exist from the moment
-- CREATE TABLE runs and the REVOKE is what actually withholds them. Here the
-- grant that follows is the full set, so the REVOKE changes nothing for
-- authenticated — it is written anyway so the two lines read as one statement
-- of what this role holds, rather than as a grant layered over an inheritance.
--
-- service_role is deliberately left alone: it bypasses RLS by design and is how
-- an edge function or a migration would ever need to rewrite these rows.

REVOKE ALL ON TABLE public.unchained_projects FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_projects TO authenticated;

-- ─── 6. The public surface ────────────────────────────────────────────────
-- public.list_public_projects() → every published project, in the order the
-- site renders them.
--
-- This function is the ENTIRE public surface of this module, and it is the
-- reason the table underneath needs no anonymous SELECT policy: the website
-- asks for the portfolio and receives the portfolio, instead of receiving the
-- table and deciding for itself which rows it was supposed to show. It is the
-- same shape as resolve_commercial_contact() and for the same reasons.
--
-- ─── Why SECURITY DEFINER ─────────────────────────────────────────────────
-- RLS on the table denies anon outright. A SECURITY INVOKER function would
-- inherit that denial and return nothing for exactly the caller it exists to
-- serve.
--
-- The privilege is contained by the function's shape, not by trust in the
-- caller:
--   · it takes no arguments, so there is no predicate to inject;
--   · `WHERE p.published` is inside the function, so a draft is unreachable no
--     matter what the caller does;
--   · it returns a fixed column list — no display_order, no updated_by, no
--     created_at, nothing about who wrote the row;
--   · it is STABLE and performs no write, so it cannot be used to change
--     anything.
--
-- Every column it returns is already printed on the public website. What an
-- anonymous caller learns here that a visitor could not is nothing.
--
-- ─── Why one call and not one per page ────────────────────────────────────
-- The whole published set fits in one small answer, and the homepage needs all
-- of it anyway. A get_public_project(slug) alongside this would be a second
-- surface to secure, and a second place for the two to disagree about which
-- rows are public, in exchange for a few kilobytes on one route.
--
-- `id` IS returned, unlike the resolver's contact id, because a project id
-- identifies a published page rather than a person, and the site has a real use
-- for a key that is stable across a title being corrected.

CREATE OR REPLACE FUNCTION public.list_public_projects()
RETURNS TABLE (
  id               UUID,
  slug             TEXT,
  title            TEXT,
  description      TEXT,
  category         TEXT,
  status           TEXT,
  featured         BOOLEAN,
  detailed         BOOLEAN,
  year             SMALLINT,
  industry         TEXT,
  services         TEXT[],
  technologies     TEXT[],
  capabilities     TEXT[],
  thumbnail        TEXT,
  thumbnail_width  INTEGER,
  thumbnail_height INTEGER,
  hero_image       TEXT,
  summary          TEXT,
  challenge        TEXT,
  solution         TEXT,
  outcome          TEXT,
  external_url     TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  SELECT
    p.id,
    p.slug,
    p.title,
    p.description,
    p.category,
    p.status,
    p.featured,
    p.detailed,
    p.year,
    p.industry,
    p.services,
    p.technologies,
    p.capabilities,
    p.thumbnail,
    p.thumbnail_width,
    p.thumbnail_height,
    p.hero_image,
    p.summary,
    p.challenge,
    p.solution,
    p.outcome,
    p.external_url
  FROM public.unchained_projects p
  WHERE p.published
  -- The order the site renders in, decided here rather than in the browser, so
  -- that the panel's list and the live page cannot disagree about it. slug
  -- last: two rows sharing a year and a display_order still produce a stable
  -- answer instead of one that depends on the plan.
  ORDER BY p.year DESC NULLS LAST, p.display_order ASC, p.slug ASC;
$fn$;

-- Revoke first, then grant explicitly: a CREATE OR REPLACE keeps the existing
-- ACL, so re-running this file must not silently accumulate a grant somebody
-- added by hand.
--
-- anon is granted on purpose. It is the whole design: the site calls this with
-- the anon key and must never hold table access. The alternative would be a
-- SELECT policy on unchained_projects, which would expose every draft along
-- with every published row.

REVOKE ALL ON FUNCTION public.list_public_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_projects() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════
-- These run when the file is applied and abort it if the schema does not
-- behave as the commentary above claims. A migration that says a thing and
-- does not do it is worse than one that says nothing.

-- The seed landed, and it is the site as it stands: seven published projects,
-- one of them the flagship.
DO $blk$
DECLARE
  v_total     INTEGER;
  v_published INTEGER;
  v_featured  TEXT;
BEGIN
  SELECT count(*) INTO v_total FROM public.unchained_projects;
  IF v_total < 7 THEN
    RAISE EXCEPTION '[fail] expected the seven seeded projects, found %', v_total;
  END IF;

  SELECT count(*) INTO v_published FROM public.unchained_projects WHERE published;
  IF v_published < 7 THEN
    RAISE EXCEPTION '[fail] expected seven published projects, found %', v_published;
  END IF;

  SELECT slug INTO v_featured FROM public.unchained_projects WHERE featured;
  IF v_featured IS DISTINCT FROM 'tancerca' THEN
    RAISE EXCEPTION '[fail] the flagship should be tancerca, found %',
      COALESCE(v_featured, 'none');
  END IF;

  RAISE NOTICE '[ok] % projects, % published, flagship is %',
    v_total, v_published, v_featured;
END;
$blk$;

-- The public function returns the site's order. Note what is NOT in the ORDER
-- BY: `featured`. TanCerca comes first because it is 2026 and display_order 1,
-- and the site picks the flagship out by its flag — conflating the two here
-- would make the homepage's layout depend on a sort it does not read.
DO $blk$
DECLARE
  v_expected INTEGER;
  v_count    INTEGER;
  v_first    TEXT;
  v_last     TEXT;
BEGIN
  SELECT count(*) INTO v_expected FROM public.unchained_projects WHERE published;
  SELECT count(*) INTO v_count    FROM public.list_public_projects();

  IF v_count <> v_expected THEN
    RAISE EXCEPTION '[fail] list_public_projects() returned % of % published rows',
      v_count, v_expected;
  END IF;

  SELECT p.slug INTO v_first FROM public.list_public_projects() p LIMIT 1;
  IF v_first <> 'tancerca' THEN
    RAISE EXCEPTION '[fail] the portfolio should open with tancerca, found %', v_first;
  END IF;

  -- Klassisches Ballet is 2025 and every other seeded project is 2026, so the
  -- oldest sorts last. This is the rule byYearDesc() applied in TypeScript,
  -- asserted where it now lives.
  SELECT p.slug INTO v_last
    FROM public.list_public_projects() p
   OFFSET v_count - 1 LIMIT 1;
  IF v_last <> 'klassisches-ballet' THEN
    RAISE EXCEPTION '[fail] the oldest project should sort last, found %', v_last;
  END IF;

  RAISE NOTICE '[ok] list_public_projects() returns % rows, newest first', v_count;
END;
$blk$;

-- An unpublished row is invisible through the public function. This is the
-- property the `published` column exists for, so it is tested with an actual
-- row rather than trusted to the WHERE clause being read correctly.
DO $blk$
DECLARE
  v_seen INTEGER;
BEGIN
  INSERT INTO public.unchained_projects (slug, title, description, category, published)
  VALUES ('migration-self-test', 'Draft', 'Not for publication.', 'Self test', FALSE);

  SELECT count(*) INTO v_seen
    FROM public.list_public_projects()
   WHERE slug = 'migration-self-test';

  IF v_seen <> 0 THEN
    RAISE EXCEPTION '[fail] an unpublished project was returned by list_public_projects()';
  END IF;

  DELETE FROM public.unchained_projects WHERE slug = 'migration-self-test';
  RAISE NOTICE '[ok] an unpublished project is not returned to the public';
END;
$blk$;

-- The constraints refuse the five mistakes that actually get made in this
-- table: a second flagship, a detail page with nothing on it, a status the site
-- cannot render, a slug that is not one, and an image hosted somewhere else.
DO $blk$
BEGIN
  BEGIN
    UPDATE public.unchained_projects SET featured = TRUE WHERE slug = 'frito';
    RAISE EXCEPTION '[fail] a second flagship was accepted';
  EXCEPTION
    -- The featured row must also be detailed, so whichever of the two guards
    -- fires first, the second flagship is refused.
    WHEN unique_violation OR check_violation THEN
      RAISE NOTICE '[ok] there can be only one flagship';
  END;

  BEGIN
    UPDATE public.unchained_projects SET detailed = TRUE WHERE slug = 'frito';
    RAISE EXCEPTION '[fail] a detail page with no prose was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] detailed requires a summary, a challenge and a solution';
  END;

  BEGIN
    UPDATE public.unchained_projects SET status = 'shipped' WHERE slug = 'frito';
    RAISE EXCEPTION '[fail] an unknown status was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] status is limited to the five the site can render';
  END;

  BEGIN
    INSERT INTO public.unchained_projects (slug, title, description, category)
    VALUES ('Not A Slug', 'x', 'x', 'x');
    RAISE EXCEPTION '[fail] a malformed slug was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] a slug must be url-safe';
  END;

  BEGIN
    INSERT INTO public.unchained_projects (slug, title, description, category, thumbnail)
    VALUES ('remote-image', 'x', 'x', 'x', 'https://example.com/x.webp');
    RAISE EXCEPTION '[fail] an off-site thumbnail was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] images must be site-relative paths';
  END;
END;
$blk$;

-- The provenance columns are written by the server. Applied from Studio there
-- is no auth.uid(), so updated_by lands NULL — what is asserted here is that
-- the trigger OVERWROTE whatever the statement supplied, which is the property
-- that makes the column a record rather than a claim.
DO $blk$
DECLARE
  v_before  TIMESTAMPTZ;
  v_created TIMESTAMPTZ;
  v_after   TIMESTAMPTZ;
  v_by      UUID;
BEGIN
  SELECT updated_at, created_at INTO v_before, v_created
    FROM public.unchained_projects WHERE slug = 'frito';

  UPDATE public.unchained_projects
     SET industry   = '[migration self-test]',
         updated_at = 'epoch'::TIMESTAMPTZ,
         updated_by = '00000000-0000-0000-0000-000000000001'::UUID,
         created_at = 'epoch'::TIMESTAMPTZ
   WHERE slug = 'frito';

  SELECT updated_at, updated_by INTO v_after, v_by
    FROM public.unchained_projects WHERE slug = 'frito';

  IF v_after = 'epoch'::TIMESTAMPTZ OR v_after < v_before THEN
    RAISE EXCEPTION '[fail] the trigger did not overwrite updated_at (got %)', v_after;
  END IF;
  IF v_by IS NOT DISTINCT FROM '00000000-0000-0000-0000-000000000001'::UUID THEN
    RAISE EXCEPTION '[fail] a client-supplied updated_by was kept';
  END IF;
  IF (SELECT created_at FROM public.unchained_projects WHERE slug = 'frito') <> v_created THEN
    RAISE EXCEPTION '[fail] created_at was rewritten by an UPDATE';
  END IF;

  -- Leave nothing behind. This is the file's own test value, not content.
  UPDATE public.unchained_projects SET industry = 'Social & dating' WHERE slug = 'frito';

  RAISE NOTICE '[ok] updated_at and updated_by are written by the server, not the caller';
END;
$blk$;

-- The table is not reachable by the website's anon key. Supabase's ALTER
-- DEFAULT PRIVILEGES grants to anon explicitly, so this checks that the REVOKE
-- above landed — not merely that nothing granted anon by accident.
DO $blk$
DECLARE
  v_priv TEXT;
BEGIN
  FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF has_table_privilege('anon', 'public.unchained_projects', v_priv) THEN
      RAISE EXCEPTION '[fail] anon can still % public.unchained_projects', v_priv;
    END IF;
  END LOOP;
  RAISE NOTICE '[ok] public.unchained_projects — not reachable by anon';

  IF NOT has_table_privilege('authenticated', 'public.unchained_projects', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.unchained_projects', 'INSERT')
     OR NOT has_table_privilege('authenticated', 'public.unchained_projects', 'UPDATE')
     OR NOT has_table_privilege('authenticated', 'public.unchained_projects', 'DELETE') THEN
    RAISE EXCEPTION '[fail] authenticated must hold full CRUD, with RLS deciding who uses it';
  END IF;
  RAISE NOTICE '[ok] authenticated holds CRUD; the policies decide who may use it';
END;
$blk$;

-- RLS is on, and both policies exist under the names the commentary uses.
DO $blk$
DECLARE
  v_enabled BOOLEAN;
  v_count   INTEGER;
BEGIN
  SELECT c.relrowsecurity INTO v_enabled
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'unchained_projects';

  IF NOT COALESCE(v_enabled, FALSE) THEN
    RAISE EXCEPTION '[fail] row level security is not enabled on public.unchained_projects';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'unchained_projects'
     AND policyname IN ('unchained_projects_read', 'unchained_projects_manage');

  IF v_count <> 2 THEN
    RAISE EXCEPTION '[fail] expected both project policies, found %', v_count;
  END IF;
  RAISE NOTICE '[ok] RLS enabled, read and manage policies in place';
END;
$blk$;

-- Guard the security properties of the public function itself. A future
-- CREATE OR REPLACE that drops SECURITY DEFINER would make the public path
-- silently return nothing — the site would fall back to lib/projects.ts and
-- nobody would see an error; one that drops the pinned search_path would
-- reintroduce the 2026-08 defect class.
DO $blk$
DECLARE
  v_secdef   BOOLEAN;
  v_config   TEXT[];
  v_provolat CHAR;
  v_entry    TEXT;
BEGIN
  SELECT p.prosecdef, p.proconfig, p.provolatile
    INTO v_secdef, v_config, v_provolat
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'list_public_projects';

  IF NOT v_secdef THEN
    RAISE EXCEPTION '[fail] list_public_projects must be SECURITY DEFINER or the public path returns nothing';
  END IF;
  IF v_provolat <> 's' THEN
    RAISE EXCEPTION '[fail] list_public_projects must be STABLE, so it cannot be used to write';
  END IF;

  SELECT c INTO v_entry FROM unnest(COALESCE(v_config, ARRAY[]::TEXT[])) c
   WHERE c LIKE 'search_path=%';

  IF v_entry IS NULL THEN
    RAISE EXCEPTION '[fail] list_public_projects does not pin search_path at all (proconfig: %)',
      COALESCE(array_to_string(v_config, ','), 'nothing');
  END IF;
  -- 'search_path=' is 12 characters, so the value starts at 13.
  IF btrim(substr(v_entry, 13), '"''') <> '' THEN
    RAISE EXCEPTION '[fail] list_public_projects must pin search_path empty (found: %)', v_entry;
  END IF;

  RAISE NOTICE '[ok] list_public_projects is SECURITY DEFINER, STABLE, search_path pinned empty';
END;
$blk$;

-- Both trigger functions are pinned to an empty search_path, like every other
-- function in this schema.
DO $blk$
DECLARE
  v_name  TEXT;
  v_cfg   TEXT[];
  v_entry TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY['unchained_projects_touch', 'unchained_projects_stamp_author'] LOOP
    SELECT p.proconfig INTO v_cfg
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_name;

    SELECT c INTO v_entry FROM unnest(COALESCE(v_cfg, ARRAY[]::TEXT[])) c
     WHERE c LIKE 'search_path=%';

    IF v_entry IS NULL THEN
      RAISE EXCEPTION '[fail] public.%() does not pin search_path', v_name;
    END IF;
    IF btrim(substr(v_entry, 13), '"''') <> '' THEN
      RAISE EXCEPTION '[fail] public.%() must pin search_path empty (found: %)', v_name, v_entry;
    END IF;
  END LOOP;
  RAISE NOTICE '[ok] both project trigger functions — search_path pinned empty';
END;
$blk$;

NOTIFY pgrst, 'reload schema';

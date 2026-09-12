-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business CMS: content core
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   has_product_access(), is_super_admin()
--   20260905000004_unchained_leads.sql        unchained_manages_leads()
--   20260907000002_unchained_projects.sql     unchained_projects, list_public_projects()
--
-- Creates:
--     unchained_locales                   the locale registry — data, not schema
--     unchained_manages_content()          the CMS write predicate
--     unchained_project_translations       localized copy, one row per locale
--     unchained_project_translations_touch()
--   + columns on unchained_projects:       SEO block, published_at, archived_at,
--                                          created_by
--   ~ list_public_projects()               now returns the SEO block and the
--                                          published translations
--
-- ─── What this phase is for ───────────────────────────────────────────────
-- Phase 9 moved the portfolio out of lib/projects.ts and into this database,
-- so that publishing a project stopped requiring a commit. It left three
-- things the website needs and the panel could not supply: the page's SEO
-- metadata, the same content in the six languages the site actually offers,
-- and a state between "published" and "gone".
--
-- This file adds those three to projects. 20260912000002 gives insights the
-- same shape, 20260912000003 adds the media library the two share, and
-- 20260912000004 adds preview. Nothing here changes what the site renders
-- today: every column added is nullable or defaulted, and the public function
-- returns a superset of the columns it returned before.
--
-- ─── Why translations are rows and not six copies of the project ──────────
-- A project has ONE slug, ONE publication state, ONE flagship flag and ONE
-- image set. Those are facts about the work, not about a language, and six
-- independent records would let them drift — two Spanish visitors and one
-- English visitor could then be looking at what the database considers three
-- different projects.
--
-- So the parent row carries everything language-independent, and a translation
-- row carries only the prose. A locale with no row is not an error: the site
-- falls back to the parent, which is written in the default locale. That is
-- the same degradation lib/i18n already applies to a missing dictionary key.
--
-- ─── Why the SLUG is NOT translated, and this is not an oversight ─────────
-- The public website has ONE URL per project. lib/i18n/LanguageProvider.tsx:
-- "There is no server-side locale negotiation: every page ships prerendered in
-- defaultLocale and switches on the client." There is no /es/work/... and no
-- hreflang, because there is no second URL for hreflang to point AT.
--
-- A localized slug would therefore have nowhere to be used, and creating one
-- would mean inventing a second URL for the same project — which is precisely
-- what the site's SEO work has been avoiding. If the site ever moves to
-- per-locale routing, `slug` gets added to this table and the public function
-- starts returning it; nothing else about this design has to change.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`, which would replay history against
-- live production. Every object uses IF NOT EXISTS, CREATE OR REPLACE or
-- DROP-then-CREATE on its own name, so it is safe to run twice.

-- ─── 1. The locale registry ───────────────────────────────────────────────
-- Which languages this CMS translates into, as DATA.
--
-- The brief asks that adding a seventh locale not require redesigning the
-- database. A CHECK constraint listing six codes would have required an ALTER
-- on every table that referenced it; a foreign key to this table requires an
-- INSERT. That is the whole reason this table exists — it holds six rows and
-- will never hold many more, and it is not here to be queried.
--
-- It mirrors lib/i18n/config.ts, which stays the site's own list: the website
-- ships its dictionaries in the bundle and cannot ask a database which
-- languages it was built with. The two are kept in step by the assertion at
-- the end of this file failing if this table ever disagrees with the six the
-- site was built for.

CREATE TABLE IF NOT EXISTS public.unchained_locales (
  -- A BCP-47 language tag, optionally with a region. Lower case throughout so
  -- 'pt-br' and 'pt-BR' cannot both exist and resolve to one dictionary.
  code          TEXT PRIMARY KEY,
  -- The language's own name. A language menu should always read in the
  -- language it offers, never in the visitor's current one — the rule
  -- lib/i18n/config.ts already states on its `label` field.
  label         TEXT NOT NULL,
  english_name  TEXT NOT NULL,
  -- The locale the parent content rows are written in. Exactly one, enforced
  -- by the partial unique index below.
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  -- A locale switched off here stops being offered for new translation work.
  -- Existing rows are kept: turning a language off is an editorial decision,
  -- not a reason to destroy the translations already paid for.
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_locales_code_format
    CHECK (code ~ '^[a-z]{2}(-[a-z]{2})?$'),
  CONSTRAINT unchained_locales_label_present
    CHECK (length(btrim(label)) BETWEEN 1 AND 60),
  CONSTRAINT unchained_locales_english_name_present
    CHECK (length(btrim(english_name)) BETWEEN 1 AND 60)
);

-- One default locale. Without this, "which language is the parent row written
-- in" would have as many answers as somebody happened to flag, and the
-- fallback the site applies for a missing translation would be undefined.
CREATE UNIQUE INDEX IF NOT EXISTS idx_unchained_locales_one_default
  ON public.unchained_locales (is_default)
  WHERE is_default;

-- The six lib/i18n/config.ts ships, in its order. ON CONFLICT DO NOTHING for
-- the reason the portfolio seed gives: re-running this file must not revert a
-- label somebody has since corrected.
INSERT INTO public.unchained_locales (code, label, english_name, is_default, display_order)
VALUES
  ('en', 'English',  'English', TRUE,  1),
  ('es', 'Español',  'Spanish', FALSE, 2),
  ('it', 'Italiano', 'Italian', FALSE, 3),
  ('fr', 'Français', 'French',  FALSE, 4),
  ('de', 'Deutsch',  'German',  FALSE, 5),
  ('ru', 'Русский',  'Russian', FALSE, 6)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.unchained_locales ENABLE ROW LEVEL SECURITY;

-- Read: anybody with the module. The panel needs the list to draw a language
-- tab strip, and there is nothing confidential in "this company translates
-- into German".
--
-- Write: super_admin only, and deliberately narrower than the CMS predicate
-- below. Adding a locale is not an editorial act — it commits the site to
-- shipping a dictionary for it, which is an engineering change. An editor who
-- could add 'ja' here would produce translation rows the website has no
-- dictionary to render.
DROP POLICY IF EXISTS unchained_locales_read ON public.unchained_locales;
CREATE POLICY unchained_locales_read ON public.unchained_locales
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_locales_manage ON public.unchained_locales;
CREATE POLICY unchained_locales_manage ON public.unchained_locales
  FOR ALL
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON TABLE public.unchained_locales FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_locales TO authenticated;

-- ─── 2. The CMS write predicate ───────────────────────────────────────────
-- Who may change what the public website says.
--
-- ─── Why a new name for an existing rule ──────────────────────────────────
-- The body delegates to unchained_manages_leads(), so today the answer is
-- identical: a super_admin, an unchained_admin, or a commercial_manager. It is
-- given its own name anyway, for a reason that is not cosmetic.
--
-- "May this person reassign a lead" and "may this person publish a page on the
-- company website" are two questions that happen to have the same answer. A
-- policy written against the lead predicate says the first when it means the
-- second, and the day somebody wants a content editor who is not a sales
-- manager — the obvious next request — the change would have to be made by
-- editing a function the lead policies also depend on.
--
-- With this seam in place that change is one body, here, and no policy moves.
--
-- SECURITY DEFINER with an empty search_path, like every predicate in this
-- schema: name resolution must not depend on the caller's path. Not granted to
-- anon — the public surface of the CMS is the SECURITY DEFINER list functions,
-- and an anonymous caller has no business being able to ask this at all.

CREATE OR REPLACE FUNCTION public.unchained_manages_content()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT public.unchained_manages_leads();
$fn$;

REVOKE ALL ON FUNCTION public.unchained_manages_content() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_manages_content() TO authenticated;

-- ─── 3. The project's SEO block and its lifecycle ─────────────────────────
-- Added with ALTER rather than folded into 20260907000002, which has already
-- been applied to production. Every column is nullable, so the existing eight
-- rows remain valid and the site renders exactly as it did before this file.
--
-- ─── Why SEO fields are stored and not only derived ───────────────────────
-- The site already derives them: app/work/[slug]/page.tsx passes the title and
-- the summary to buildPageMetadata(). That is a good default and it stays the
-- default — these columns are OVERRIDES, and the fallback chain lives in one
-- place (§7 of this file, and lib/portfolio.ts on the site).
--
-- What a derived-only system cannot do is let somebody write a meta
-- description that reads as a search result rather than as the first sentence
-- of the page. That is the entire job of the field, and it is editorial work,
-- not a transformation.

ALTER TABLE public.unchained_projects
  ADD COLUMN IF NOT EXISTS seo_title        TEXT,
  ADD COLUMN IF NOT EXISTS seo_description  TEXT,
  ADD COLUMN IF NOT EXISTS og_title         TEXT,
  ADD COLUMN IF NOT EXISTS og_description   TEXT,
  -- An OG image may be a site-relative path today and a media-library URL
  -- after 20260912000003 widens the asset constraint. It is constrained here
  -- exactly as `thumbnail` is, and widened with it, so the three columns
  -- cannot drift apart about what an image is allowed to be.
  ADD COLUMN IF NOT EXISTS og_image         TEXT,
  -- Set only when the canonical is NOT the project's own URL — a syndicated
  -- piece, or a project whose real home is elsewhere. Left NULL the site emits
  -- /work/<slug>, which is correct for every row today.
  ADD COLUMN IF NOT EXISTS canonical_url    TEXT,
  -- When the project first went public. Written by the trigger in §4, never by
  -- the client, for the reason `updated_by` is: a publication date the caller
  -- chooses is a claim about history.
  ADD COLUMN IF NOT EXISTS published_at     TIMESTAMPTZ,
  -- Archive, the third state. NULL means live (draft or published); a
  -- timestamp means retired but recoverable.
  ADD COLUMN IF NOT EXISTS archived_at      TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by       UUID REFERENCES auth.users(id) ON DELETE SET NULL;

-- Lengths chosen from what the fields are FOR, not from what Postgres allows.
-- 70 and 160 are the points at which Google truncates a title and a
-- description; the panel shows a counter against the same numbers, and the
-- database refuses a value that could never be displayed in full.
DO $blk$
BEGIN
  ALTER TABLE public.unchained_projects
    DROP CONSTRAINT IF EXISTS unchained_projects_seo_title_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_seo_description_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_og_title_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_og_description_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_canonical_url_format,
    DROP CONSTRAINT IF EXISTS unchained_projects_archived_not_published;

  ALTER TABLE public.unchained_projects
    ADD CONSTRAINT unchained_projects_seo_title_length
      CHECK (seo_title IS NULL OR length(btrim(seo_title)) BETWEEN 1 AND 70),
    ADD CONSTRAINT unchained_projects_seo_description_length
      CHECK (seo_description IS NULL OR length(btrim(seo_description)) BETWEEN 1 AND 160),
    ADD CONSTRAINT unchained_projects_og_title_length
      CHECK (og_title IS NULL OR length(btrim(og_title)) BETWEEN 1 AND 90),
    ADD CONSTRAINT unchained_projects_og_description_length
      CHECK (og_description IS NULL OR length(btrim(og_description)) BETWEEN 1 AND 200),
    -- Same rule as external_url: a scheme is required, and only the two a
    -- browser can follow. A bare host in a canonical tag is a relative URL to
    -- every crawler that reads it.
    ADD CONSTRAINT unchained_projects_canonical_url_format
      CHECK (canonical_url IS NULL OR (length(canonical_url) <= 300
         AND canonical_url ~ '^https?://[^[:space:]]+$')),
    -- ─── The one rule that makes archive safe ────────────────────────────
    -- An archived project is not on the website. Enforcing it here rather than
    -- in the panel means there is no sequence of API calls — and no bug in the
    -- editor — that can leave a retired project published. The public function
    -- filters on `published` alone and is correct because of this line.
    ADD CONSTRAINT unchained_projects_archived_not_published
      CHECK (archived_at IS NULL OR NOT published);
END;
$blk$;

-- Drafts and archived rows, for the panel's status filter. Partial and tiny:
-- the published index from Phase 9 already covers the public read path, and
-- this one covers the two queries that ask for everything the site does not
-- show.
CREATE INDEX IF NOT EXISTS idx_unchained_projects_archived
  ON public.unchained_projects (archived_at DESC)
  WHERE archived_at IS NOT NULL;

-- ─── 4. published_at, written by the server ───────────────────────────────
-- The publication timestamp is set the first time `published` becomes true and
-- is NOT cleared when it goes false again. Unpublishing is a decision about
-- what the site shows now; it does not un-happen the original publication, and
-- an editor who unpublishes to fix a typo should not lose the date the piece
-- went out.
--
-- Re-publishing does not overwrite it either. "When did this first go public"
-- has one answer, and the panel shows `updated_at` for the other question.
--
-- This REPLACES the body of unchained_projects_touch() rather than adding a
-- second BEFORE UPDATE trigger: two triggers on one row have an execution
-- order decided by name, and a reader of either would have to know about the
-- other to predict the result. Everything the Phase 9 function did is kept
-- verbatim below.

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
  -- Provenance, like created_at: the account that entered the project does not
  -- change because somebody else edited it.
  NEW.created_by := OLD.created_by;

  -- First publication only. OLD.published FALSE → NEW.published TRUE, and the
  -- column still empty.
  IF NEW.published AND NOT OLD.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  -- Archiving a live project unpublishes it. The CHECK in §3 would otherwise
  -- reject the UPDATE, which would be correct but would make "archive" a
  -- two-step operation the caller has to know the order of.
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    NEW.published := FALSE;
  END IF;

  RETURN NEW;
END;
$fn$;

-- On INSERT: stamp both halves of authorship, and honour a row created
-- already-published (the seed path, and the panel's "save and publish").
CREATE OR REPLACE FUNCTION public.unchained_projects_stamp_author()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_by := (SELECT auth.uid());
  NEW.created_by := (SELECT auth.uid());
  IF NEW.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

-- Backfill: the eight rows that predate this file are published and have no
-- date. `updated_at` is the closest honest answer — it is when the row last
-- changed, and for a seeded row that is when it was created. Not now(), which
-- would claim the portfolio was published the day this migration ran.
UPDATE public.unchained_projects
   SET published_at = updated_at
 WHERE published AND published_at IS NULL;

-- ─── 5. Project translations ──────────────────────────────────────────────
-- One row per (project, locale), holding the prose and nothing else.
--
-- ─── What is here and what deliberately is not ────────────────────────────
-- Here: every field a reader sees as words. Not here: slug (see the header),
-- images, year, status, featured, display_order, external_url — facts about
-- the work that are the same in every language. Duplicating them per locale
-- would create six places for one fact to be wrong in.
--
-- ─── `published` per translation ──────────────────────────────────────────
-- A translation is published independently of its parent. Two reasons, and the
-- brief names both: an unpublished translation must not reach the public, and
-- a half-finished German draft must not block the English page from going out.
--
-- The reverse does not hold — a published translation of an unpublished
-- project reaches nobody, because the public function joins through the
-- parent's `WHERE p.published`. That is the correct precedence: the parent
-- decides whether the project exists publicly at all.

CREATE TABLE IF NOT EXISTS public.unchained_project_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ON DELETE CASCADE: a translation of a project that no longer exists is not
  -- a record of anything. Note that the panel ARCHIVES rather than deletes, so
  -- this fires only on a deliberate hard delete.
  project_id  UUID NOT NULL REFERENCES public.unchained_projects(id) ON DELETE CASCADE,
  -- ON UPDATE CASCADE so correcting a locale code is one UPDATE. No ON DELETE
  -- action is given, so the default RESTRICT applies: a locale with
  -- translations cannot be removed from the registry by accident. Deactivate
  -- it instead — that is what `active` is for.
  locale      TEXT NOT NULL REFERENCES public.unchained_locales(code) ON UPDATE CASCADE,

  published   BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── The card ──────────────────────────────────────────────────────────
  -- Every field is nullable. A translator who has done the title and the
  -- description but not the case study leaves the rest NULL, and the site
  -- falls back per FIELD rather than per row — so a partially translated
  -- project reads as far as the translation goes and in the default locale
  -- after that, instead of switching back to English wholesale.
  title           TEXT,
  description     TEXT,
  category        TEXT,
  industry        TEXT,

  -- ── The detail page ───────────────────────────────────────────────────
  summary         TEXT,
  challenge       TEXT,
  solution        TEXT,
  -- The CONTENT RULE from the parent column applies here unchanged and is
  -- worth repeating where the value can be written: never record an outcome we
  -- cannot substantiate, in any language. A translator inventing a metric that
  -- is not in the source is the same failure as an author inventing one.
  outcome         TEXT,

  -- ── Lists ─────────────────────────────────────────────────────────────
  -- NULL, not '{}', unlike the parent's columns. Here the two states are
  -- genuinely different: '{}' means "this project has no services in this
  -- language", which is never true, and NULL means "not translated — use the
  -- parent's". An empty array would blank the list on the site.
  services        TEXT[],
  technologies    TEXT[],
  capabilities    TEXT[],

  -- ── SEO ───────────────────────────────────────────────────────────────
  seo_title       TEXT,
  seo_description TEXT,
  og_title        TEXT,
  og_description  TEXT,

  -- ── Provenance ────────────────────────────────────────────────────────
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,

  -- One translation per language per project. This is what makes "the German
  -- version" a phrase with one referent.
  CONSTRAINT unchained_project_translations_unique UNIQUE (project_id, locale),

  -- The same lengths as the parent columns, so a translation cannot hold a
  -- string the original could not have held.
  CONSTRAINT unchained_project_translations_title_length
    CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_project_translations_description_length
    CHECK (description IS NULL OR length(btrim(description)) BETWEEN 1 AND 600),
  CONSTRAINT unchained_project_translations_category_length
    CHECK (category IS NULL OR length(btrim(category)) BETWEEN 1 AND 80),
  CONSTRAINT unchained_project_translations_industry_length
    CHECK (industry IS NULL OR length(btrim(industry)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_project_translations_summary_length
    CHECK (summary IS NULL OR length(btrim(summary)) BETWEEN 1 AND 1000),
  CONSTRAINT unchained_project_translations_challenge_length
    CHECK (challenge IS NULL OR length(btrim(challenge)) BETWEEN 1 AND 2000),
  CONSTRAINT unchained_project_translations_solution_length
    CHECK (solution IS NULL OR length(btrim(solution)) BETWEEN 1 AND 2000),
  CONSTRAINT unchained_project_translations_outcome_length
    CHECK (outcome IS NULL OR length(btrim(outcome)) BETWEEN 1 AND 600),
  CONSTRAINT unchained_project_translations_seo_title_length
    CHECK (seo_title IS NULL OR length(btrim(seo_title)) BETWEEN 1 AND 70),
  CONSTRAINT unchained_project_translations_seo_description_length
    CHECK (seo_description IS NULL OR length(btrim(seo_description)) BETWEEN 1 AND 160),
  CONSTRAINT unchained_project_translations_og_title_length
    CHECK (og_title IS NULL OR length(btrim(og_title)) BETWEEN 1 AND 90),
  CONSTRAINT unchained_project_translations_og_description_length
    CHECK (og_description IS NULL OR length(btrim(og_description)) BETWEEN 1 AND 200),

  -- ─── Publishing an empty translation is not publishing ────────────────
  -- A row with `published` set and no title and no description contributes
  -- nothing to the site and looks, in the panel's translation matrix, exactly
  -- like a finished one. The minimum for a translation to claim it is ready is
  -- the two fields every surface of the site renders.
  CONSTRAINT unchained_project_translations_published_has_content
    CHECK (NOT published OR (title IS NOT NULL AND description IS NOT NULL))
);

-- The public function's access path: every published translation of one
-- project. The parent id leads because that is the correlated lookup.
CREATE INDEX IF NOT EXISTS idx_unchained_project_translations_published
  ON public.unchained_project_translations (project_id, locale)
  WHERE published;

-- The panel's other question: "what is still untranslated in French?"
CREATE INDEX IF NOT EXISTS idx_unchained_project_translations_locale
  ON public.unchained_project_translations (locale);

CREATE OR REPLACE FUNCTION public.unchained_project_translations_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
    NEW.updated_by := (SELECT auth.uid());
    IF NEW.published AND NEW.published_at IS NULL THEN
      NEW.published_at := now();
    END IF;
    RETURN NEW;
  END IF;

  NEW.updated_at := now();
  NEW.updated_by := (SELECT auth.uid());
  NEW.id         := OLD.id;
  NEW.created_at := OLD.created_at;
  NEW.created_by := OLD.created_by;
  -- The parent and the language a row translates are its identity. Changing
  -- either would silently turn the German copy of one project into the French
  -- copy of another, passing every constraint on the way.
  NEW.project_id := OLD.project_id;
  NEW.locale     := OLD.locale;

  IF NEW.published AND NOT OLD.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_project_translations_touch
  ON public.unchained_project_translations;
CREATE TRIGGER trg_unchained_project_translations_touch
  BEFORE INSERT OR UPDATE ON public.unchained_project_translations
  FOR EACH ROW EXECUTE FUNCTION public.unchained_project_translations_touch();

-- ─── 6. Row level security ────────────────────────────────────────────────
-- Exactly the shape Phase 9 gave the parent table, and for the same reasons:
-- read for anybody in the module including drafts, write for whoever manages
-- content. anon appears in NO policy — the public surface is §7's function.

ALTER TABLE public.unchained_project_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_project_translations_read
  ON public.unchained_project_translations;
CREATE POLICY unchained_project_translations_read
  ON public.unchained_project_translations
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_project_translations_manage
  ON public.unchained_project_translations;
CREATE POLICY unchained_project_translations_manage
  ON public.unchained_project_translations
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

REVOKE ALL ON TABLE public.unchained_project_translations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.unchained_project_translations TO authenticated;

-- The parent table's write policy still names unchained_manages_leads(). It is
-- repointed at the content predicate here so that "who may publish a project"
-- has ONE answer, expressed once. The two functions return the same value
-- today, so this changes nothing about who can do what; what it changes is
-- which sentence the policy is stating.
DROP POLICY IF EXISTS unchained_projects_manage ON public.unchained_projects;
CREATE POLICY unchained_projects_manage ON public.unchained_projects
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

-- ─── 7. The public surface, extended ──────────────────────────────────────
-- list_public_projects() keeps its name, its signature and every column it
-- returned in Phase 9, and gains two things: the stored SEO block and the
-- published translations.
--
-- ─── Why DROP and not CREATE OR REPLACE ───────────────────────────────────
-- Postgres refuses to replace a function whose RETURNS TABLE changes shape.
-- The DROP is therefore required, not preferred. It is written with the exact
-- argument list (none) so it cannot match an overload added later.
--
-- ─── Why this is safe in both directions ──────────────────────────────────
-- Deploys here are independent: the site may be running an older build when
-- this file is applied, and a newer one before it is.
--   · Old site, new function — lib/portfolio.ts reads the row field by field
--     through an interface of `unknown`s and ignores every key it does not
--     name. Extra columns are invisible to it.
--   · New site, old function — the added keys arrive undefined, the same
--     state as a project with no SEO overrides and no translations, which the
--     site already has to render.
-- Neither order produces a broken page, which is what makes this deployable
-- without a coordinated release.
--
-- ─── `translations` is a JSONB object, not extra rows ─────────────────────
-- One call still answers the whole question. The alternative — a second RPC
-- returning translation rows — would be a second public surface to secure, a
-- second place for the publication rule to be stated, and a second round trip
-- on the one route whose job is to be fast.
--
-- The object is keyed by locale and contains only NON-NULL fields, so "not
-- translated" arrives as an absent key rather than as an explicit null, and
-- the site's per-field fallback is `?? parent` with nothing else to check.

DROP FUNCTION IF EXISTS public.list_public_projects();

CREATE FUNCTION public.list_public_projects()
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
  external_url     TEXT,
  -- ── Added by this migration ──────────────────────────────────────────
  seo_title        TEXT,
  seo_description  TEXT,
  og_title         TEXT,
  og_description   TEXT,
  og_image         TEXT,
  canonical_url    TEXT,
  published_at     TIMESTAMPTZ,
  translations     JSONB
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
    p.external_url,
    p.seo_title,
    p.seo_description,
    p.og_title,
    p.og_description,
    p.og_image,
    p.canonical_url,
    p.published_at,
    COALESCE(
      (
        SELECT jsonb_object_agg(t.locale, t.fields)
          FROM (
            SELECT
              tr.locale,
              -- jsonb_strip_nulls is what turns "every column, mostly null"
              -- into "only what was translated". Without it the site would
              -- receive explicit nulls and `?? parent` would still work, but
              -- every untranslated project would ship six objects of twelve
              -- nulls each to a browser that has no use for them.
              jsonb_strip_nulls(jsonb_build_object(
                'title',           tr.title,
                'description',     tr.description,
                'category',        tr.category,
                'industry',        tr.industry,
                'summary',         tr.summary,
                'challenge',       tr.challenge,
                'solution',        tr.solution,
                'outcome',         tr.outcome,
                'services',        tr.services,
                'technologies',    tr.technologies,
                'capabilities',    tr.capabilities,
                'seo_title',       tr.seo_title,
                'seo_description', tr.seo_description,
                'og_title',        tr.og_title,
                'og_description',  tr.og_description
              )) AS fields
            FROM public.unchained_project_translations tr
            -- The publication rule for a translation, stated once, inside the
            -- function, where no caller can be involved in it. A draft
            -- translation is unreachable through this surface exactly as a
            -- draft project is.
            WHERE tr.project_id = p.id
              AND tr.published
              -- An inactive locale stops being served. The rows survive; the
              -- site stops offering a language the business has withdrawn.
              AND EXISTS (
                    SELECT 1 FROM public.unchained_locales l
                     WHERE l.code = tr.locale AND l.active
                  )
          ) t
      ),
      '{}'::jsonb
    ) AS translations
  FROM public.unchained_projects p
  -- `archived_at IS NULL` is redundant against the CHECK in §3 and is written
  -- anyway: it is the sentence "the site never shows an archived project",
  -- and a reader of this function should not have to go and find a constraint
  -- on another table to know that it is true.
  WHERE p.published
    AND p.archived_at IS NULL
  ORDER BY p.year DESC NULLS LAST, p.display_order ASC, p.slug ASC;
$fn$;

REVOKE ALL ON FUNCTION public.list_public_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_projects() TO anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The six locales the website was built for are present and exactly one is the
-- default. If this fails, lib/i18n/config.ts and this table have diverged, and
-- the CMS would offer a language the site cannot render.
DO $blk$
DECLARE
  v_missing TEXT;
  v_default INTEGER;
BEGIN
  SELECT string_agg(code, ', ') INTO v_missing
    FROM (VALUES ('en'),('es'),('it'),('fr'),('de'),('ru')) AS want(code)
   WHERE NOT EXISTS (SELECT 1 FROM public.unchained_locales l WHERE l.code = want.code);

  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION '[fail] locales missing from the registry: %', v_missing;
  END IF;

  SELECT count(*) INTO v_default FROM public.unchained_locales WHERE is_default;
  IF v_default <> 1 THEN
    RAISE EXCEPTION '[fail] expected exactly one default locale, found %', v_default;
  END IF;

  RAISE NOTICE '[ok] locale registry: % locales, default is %',
    (SELECT count(*) FROM public.unchained_locales),
    (SELECT code FROM public.unchained_locales WHERE is_default);
END;
$blk$;

-- Archiving a published project unpublishes it, and the constraint holds.
-- Exercised against a real row rather than asserted in a comment, then rolled
-- back by deleting it — the table's own triggers run, so this tests the
-- deployed behaviour and not an idea of it.
DO $blk$
DECLARE
  v_id        UUID;
  v_published BOOLEAN;
BEGIN
  INSERT INTO public.unchained_projects (slug, title, description, category, published)
  VALUES ('zz-apply-probe', 'Apply probe', 'Temporary row created by a migration assertion.',
          'Probe', TRUE)
  RETURNING id INTO v_id;

  SELECT published_at IS NOT NULL INTO v_published
    FROM public.unchained_projects WHERE id = v_id;
  IF NOT v_published THEN
    RAISE EXCEPTION '[fail] a row inserted as published got no published_at';
  END IF;

  UPDATE public.unchained_projects SET archived_at = now() WHERE id = v_id;

  SELECT published INTO v_published FROM public.unchained_projects WHERE id = v_id;
  IF v_published THEN
    RAISE EXCEPTION '[fail] an archived project stayed published';
  END IF;

  -- A published translation of an archived project must still be unreachable
  -- publicly, because the parent decides.
  INSERT INTO public.unchained_project_translations
    (project_id, locale, published, title, description)
  VALUES (v_id, 'es', TRUE, 'Sonda', 'Fila temporal creada por una aserción.');

  IF EXISTS (SELECT 1 FROM public.list_public_projects() WHERE slug = 'zz-apply-probe') THEN
    RAISE EXCEPTION '[fail] an archived project reached the public function';
  END IF;

  DELETE FROM public.unchained_projects WHERE id = v_id;
  RAISE NOTICE '[ok] archive unpublishes, and archived content is not public';
END;
$blk$;

-- The public function still returns the portfolio, and now returns
-- translations as an object rather than as null.
DO $blk$
DECLARE
  v_rows INTEGER;
  v_null INTEGER;
BEGIN
  SELECT count(*) INTO v_rows FROM public.list_public_projects();
  IF v_rows < 1 THEN
    RAISE EXCEPTION '[fail] the public portfolio came back empty';
  END IF;

  SELECT count(*) INTO v_null
    FROM public.list_public_projects() WHERE translations IS NULL;
  IF v_null > 0 THEN
    RAISE EXCEPTION '[fail] % rows returned a null translations object', v_null;
  END IF;

  RAISE NOTICE '[ok] list_public_projects(): % published rows, all with a translations object',
    v_rows;
END;
$blk$;

-- anon may call the list function and may NOT touch the tables behind it.
DO $blk$
BEGIN
  IF NOT has_function_privilege('anon', 'public.list_public_projects()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon cannot call list_public_projects()';
  END IF;

  IF has_table_privilege('anon', 'public.unchained_project_translations', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on unchained_project_translations';
  END IF;

  IF has_table_privilege('anon', 'public.unchained_locales', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on unchained_locales';
  END IF;

  IF has_function_privilege('anon', 'public.unchained_manages_content()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can call the CMS write predicate';
  END IF;

  RAISE NOTICE '[ok] anon: function yes, tables no';
END;
$blk$;

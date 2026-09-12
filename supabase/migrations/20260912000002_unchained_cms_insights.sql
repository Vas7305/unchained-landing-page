-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business CMS: insights
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   has_product_access()
--   20260912000001_unchained_cms_core.sql     unchained_locales,
--                                             unchained_manages_content()
--
-- Creates:
--     unchained_insight_sections_valid()   the body's shape, as a CHECK
--     unchained_insights                   the editorial layer
--     unchained_insight_translations       localized copy, one row per locale
--     unchained_insights_touch()
--     list_public_insights()               the entire public surface
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- lib/insights.ts opens by describing itself: "a typed array is the entire
-- content system. Adding an article object below publishes it to /insights."
-- That is a defensible system for a site whose articles are written by the
-- person holding the checkout. It is the wrong one for a business that wants
-- to publish on its own schedule, and it is the last content type on the site
-- that still requires a commit, a review and a deploy to change a sentence.
--
-- This gives insights the shape projects already have: a table, a draft state,
-- translations, an SEO block, and one SECURITY DEFINER function as the whole
-- public surface. lib/insights.ts stays in the repository as the fallback the
-- site renders when it has no database behind it — exactly the role
-- lib/projects.ts plays for the portfolio.
--
-- ─── Why the body is JSONB and not a rich-text blob or a block table ──────
-- Three options were available and the brief rules out the extremes: "Do not
-- build a huge proprietary page builder. Prefer a maintainable content
-- representation."
--
--   · HTML in a column would let an editor paste anything into a page that
--     React currently escapes, and would make the site's typography depend on
--     markup nobody reviewed.
--   · A `sections` table with an `order` column is the textbook answer and
--     costs a join, a reordering endpoint and a second place for an article to
--     be half-saved. A section has no identity of its own — nothing links to
--     one, nothing queries across them — so the normalisation buys nothing.
--   · A JSONB array matches the shape the site's components are ALREADY
--     written against (InsightSection in lib/insights.ts: heading, body[],
--     points?[]), which means the public function can hand the site the exact
--     structure it renders today, and the fallback file and the table cannot
--     disagree about what an article is.
--
-- The third is chosen, and the structure is validated by a CHECK rather than
-- trusted — see §1. "JSONB" must not mean "whatever the client sent".
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor rather than running `supabase db push`.
-- Safe to run twice.

-- ─── 1. What an article body is allowed to be ─────────────────────────────
-- A JSONB array of sections. Each section: a non-empty `heading` string, a
-- `body` array of one or more non-empty strings, and an optional `points`
-- array of non-empty strings. No other keys.
--
-- ─── Why this is a function and not an inline CHECK expression ────────────
-- The expression is twenty lines of jsonb_array_elements and type tests. In a
-- CHECK it would be unreadable, unreachable by a test, and duplicated the
-- moment insight TRANSLATIONS needed the same rule — which they do, in §4.
--
-- IMMUTABLE because a CHECK constraint requires it, and it genuinely is: the
-- answer depends on the argument and on nothing else. No search_path is
-- consulted for the same reason every other function here pins one — the body
-- is schema-qualified throughout.
--
-- NULL in, TRUE out. "No body" is a valid state for a draft; whether a
-- PUBLISHED article may have an empty body is a different question, answered
-- by a separate constraint in §2.

CREATE OR REPLACE FUNCTION public.unchained_insight_sections_valid(p_sections JSONB)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT
    p_sections IS NULL
    OR (
      jsonb_typeof(p_sections) = 'array'
      -- An upper bound so a single article cannot become a megabyte of JSON
      -- that every render of /insights has to parse.
      AND jsonb_array_length(p_sections) <= 40
      AND NOT EXISTS (
        SELECT 1
          FROM jsonb_array_elements(p_sections) AS s(section)
         WHERE
           jsonb_typeof(s.section) <> 'object'
           -- Exactly the three keys the site renders, and no fourth. A stray
           -- key is not harmless: it is content somebody wrote that no page
           -- will ever display, and it will be noticed as data loss.
           OR EXISTS (
                SELECT 1 FROM jsonb_object_keys(s.section) AS k(key)
                 WHERE k.key NOT IN ('heading', 'body', 'points')
              )
           OR jsonb_typeof(s.section -> 'heading') IS DISTINCT FROM 'string'
           OR length(btrim(s.section ->> 'heading')) NOT BETWEEN 1 AND 200
           OR jsonb_typeof(s.section -> 'body') IS DISTINCT FROM 'array'
           OR jsonb_array_length(s.section -> 'body') NOT BETWEEN 1 AND 40
           OR EXISTS (
                SELECT 1
                  FROM jsonb_array_elements(s.section -> 'body') AS p(para)
                 WHERE jsonb_typeof(p.para) <> 'string'
                    OR length(btrim(p.para #>> '{}')) NOT BETWEEN 1 AND 4000
              )
           -- `points` is optional. Present, it must be a non-empty array of
           -- non-empty strings: an empty list would render as a bullet list
           -- with no bullets, which is a heading over nothing.
           OR (
                s.section ? 'points'
                AND (
                  jsonb_typeof(s.section -> 'points') <> 'array'
                  OR jsonb_array_length(s.section -> 'points') NOT BETWEEN 1 AND 40
                  OR EXISTS (
                       SELECT 1
                         FROM jsonb_array_elements(s.section -> 'points') AS b(point)
                        WHERE jsonb_typeof(b.point) <> 'string'
                           OR length(btrim(b.point #>> '{}')) NOT BETWEEN 1 AND 1000
                     )
                )
              )
      )
    );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_insight_sections_valid(JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_insight_sections_valid(JSONB) TO authenticated;

-- ─── 1b. Rules about the contents of a TEXT[] ─────────────────────────────
-- "Every element of this array is a slug" and "every element is a short
-- label" are both statements about each element, and the natural way to write
-- one is `NOT EXISTS (SELECT 1 FROM unnest(col) …)`.
--
-- ─── Postgres refuses that, and this is not a style preference ────────────
--     ERROR:  0A000: cannot use subquery in check constraint
--
-- A CHECK expression may not contain a subquery, at all. The restriction is
-- syntactic and it is about correctness rather than taste: a constraint is
-- re-evaluated only for the row being written, so one that could read other
-- rows would be enforced at write time and then silently violated by a later
-- write elsewhere. `unnest()` of the row's own column is harmless in
-- principle, but the parser does not special-case it.
--
-- A FUNCTION CALL is allowed, and the function's body may contain whatever it
-- likes. So the same rule moves one level down — which is the pattern
-- unchained_insight_sections_valid() above already establishes for the same
-- reason, and these two are its siblings rather than a new idea.
--
-- Both are IMMUTABLE (a CHECK requires it) and genuinely are: the answer
-- depends on the arguments and on nothing else.

/** Every element is a slug, and there are not too many of them. */
CREATE OR REPLACE FUNCTION public.unchained_slug_list_ok(
  p_values TEXT[],
  p_max_count INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT
    p_values IS NULL
    OR (
      COALESCE(array_length(p_values, 1), 0) <= p_max_count
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p_values) AS v(value)
         WHERE v.value IS NULL
            OR v.value !~ '^[a-z0-9]+(-[a-z0-9]+)*$'
      )
    );
$fn$;

/** Every element is a non-empty label within a length bound. */
CREATE OR REPLACE FUNCTION public.unchained_label_list_ok(
  p_values TEXT[],
  p_max_count INTEGER,
  p_max_length INTEGER
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT
    p_values IS NULL
    OR (
      COALESCE(array_length(p_values, 1), 0) <= p_max_count
      AND NOT EXISTS (
        SELECT 1 FROM unnest(p_values) AS v(value)
         WHERE v.value IS NULL
            OR length(btrim(v.value)) NOT BETWEEN 1 AND p_max_length
      )
    );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_slug_list_ok(TEXT[], INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_label_list_ok(TEXT[], INTEGER, INTEGER)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_slug_list_ok(TEXT[], INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_label_list_ok(TEXT[], INTEGER, INTEGER)
  TO authenticated;

-- ─── 2. The table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unchained_insights (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- ── Identity ──────────────────────────────────────────────────────────
  -- /insights/<slug>. The same pattern and the same reasoning as
  -- unchained_projects.slug: two rows claiming one address is a second page
  -- that can never be reached.
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  -- The meta description AND the excerpt on the index card — one field,
  -- because the site has always used one (`description` in lib/insights.ts)
  -- and splitting it would create two things to write and one of them would
  -- rot. An explicit SEO override is available below for the case where the
  -- card text and the search result genuinely need to differ.
  description   TEXT NOT NULL,
  -- The opening paragraph shown under the title, before the first heading.
  lede          TEXT,

  -- ── Taxonomy ──────────────────────────────────────────────────────────
  -- The article's single primary pillar, matching lib/site.ts. Written as a
  -- CHECK rather than a table because — unlike locales — these three are the
  -- site's information architecture: adding a fourth means building a pillar
  -- page for it, which is an engineering change and should read as one.
  pillar        TEXT NOT NULL,
  -- Free-form tags, for the panel's filtering and for nothing on the public
  -- site yet. Empty array rather than NULL, like the parent project columns.
  tags          TEXT[] NOT NULL DEFAULT '{}',
  -- The by-line. Nullable: the site does not print one today, and inventing
  -- an author for the articles that predate this column would be fabricating
  -- provenance. `created_by` records who entered the row, which is a different
  -- question.
  author        TEXT,

  -- ── The body ──────────────────────────────────────────────────────────
  sections      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- ── Links the article rests on ────────────────────────────────────────
  -- Editorially chosen, never generated from keyword similarity — the rule
  -- lib/insights.ts states on `relatedSlugs`. Slugs rather than foreign keys
  -- so an article may name one that is still a draft; the public function
  -- resolves them and drops what is not published, which is what the site's
  -- resolveRelated() already does.
  related_slugs   TEXT[] NOT NULL DEFAULT '{}',
  -- A project slug whose evidence the article rests on. Also not a foreign
  -- key: the projects table is a different content type with its own
  -- lifecycle, and an article should not become undeletable because it cites
  -- a project.
  case_study_slug TEXT,

  -- ── Media ─────────────────────────────────────────────────────────────
  cover_image   TEXT,
  og_image      TEXT,

  -- ── Lifecycle ─────────────────────────────────────────────────────────
  -- FALSE by default: a new article is a draft, and appears on the site
  -- because somebody published it rather than because they started writing.
  published     BOOLEAN NOT NULL DEFAULT FALSE,
  featured      BOOLEAN NOT NULL DEFAULT FALSE,
  archived_at   TIMESTAMPTZ,
  -- The EDITORIAL date, the one printed on the article and used to sort the
  -- index. A DATE and not a timestamp because that is what the site renders
  -- (formatInsightDate parses `${iso}T00:00:00Z`), and because an article is
  -- dated to a day, not to a minute.
  published_on  DATE,
  -- Only set when an article is materially revised. lib/insights.ts calls this
  -- `updatedAt`; it is named differently here so it cannot be confused with
  -- the `updated_at` row-audit column two lines below, which changes on every
  -- save including a typo fix and must never reach a reader.
  revised_on    DATE,
  -- When it first went public, written by the trigger. The same distinction
  -- unchained_projects draws: `published_on` is editorial and may be
  -- backdated, this is the audit record and may not.
  published_at  TIMESTAMPTZ,

  -- ── SEO ───────────────────────────────────────────────────────────────
  seo_title       TEXT,
  seo_description TEXT,
  og_title        TEXT,
  og_description  TEXT,
  canonical_url   TEXT,

  -- ── Provenance ────────────────────────────────────────────────────────
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unchained_insights_slug_format
    CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) BETWEEN 1 AND 100),
  CONSTRAINT unchained_insights_title_present
    CHECK (length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT unchained_insights_description_present
    CHECK (length(btrim(description)) BETWEEN 1 AND 300),
  CONSTRAINT unchained_insights_lede_length
    CHECK (lede IS NULL OR length(btrim(lede)) BETWEEN 1 AND 1000),
  CONSTRAINT unchained_insights_author_length
    CHECK (author IS NULL OR length(btrim(author)) BETWEEN 1 AND 120),

  -- The three pillars in lib/site.ts. A fourth value here would produce an
  -- article filed under a pillar with no page, which the site would render as
  -- a link to a 404.
  CONSTRAINT unchained_insights_pillar_known
    CHECK (pillar IN ('software-development', 'business-automation', 'growth-systems')),

  CONSTRAINT unchained_insights_sections_shape
    CHECK (public.unchained_insight_sections_valid(sections)),

  -- Slugs in this array must be slugs. Without this an editor could store a
  -- path or a full URL and the site would build /insights//insights/foo.
  -- Expressed through a function because a CHECK may not contain a subquery —
  -- see §1b.
  CONSTRAINT unchained_insights_related_slugs_format
    CHECK (public.unchained_slug_list_ok(related_slugs, 12)),
  CONSTRAINT unchained_insights_case_study_slug_format
    CHECK (case_study_slug IS NULL OR case_study_slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),

  -- Tags are labels, not prose.
  CONSTRAINT unchained_insights_tags_format
    CHECK (public.unchained_label_list_ok(tags, 20, 60)),

  -- Images: site-relative today, widened alongside the project columns by
  -- 20260912000003 when the media library arrives.
  CONSTRAINT unchained_insights_cover_image_path
    CHECK (cover_image IS NULL OR (cover_image ~ '^/[^[:space:]]*$' AND length(cover_image) <= 300)),
  CONSTRAINT unchained_insights_og_image_path
    CHECK (og_image IS NULL OR (og_image ~ '^/[^[:space:]]*$' AND length(og_image) <= 300)),

  CONSTRAINT unchained_insights_seo_title_length
    CHECK (seo_title IS NULL OR length(btrim(seo_title)) BETWEEN 1 AND 70),
  CONSTRAINT unchained_insights_seo_description_length
    CHECK (seo_description IS NULL OR length(btrim(seo_description)) BETWEEN 1 AND 160),
  CONSTRAINT unchained_insights_og_title_length
    CHECK (og_title IS NULL OR length(btrim(og_title)) BETWEEN 1 AND 90),
  CONSTRAINT unchained_insights_og_description_length
    CHECK (og_description IS NULL OR length(btrim(og_description)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_insights_canonical_url_format
    CHECK (canonical_url IS NULL OR (length(canonical_url) <= 300
       AND canonical_url ~ '^https?://[^[:space:]]+$')),

  CONSTRAINT unchained_insights_revised_after_published
    CHECK (revised_on IS NULL OR published_on IS NULL OR revised_on >= published_on),

  -- ─── What "published" requires ────────────────────────────────────────
  -- The brief: "Publishing should fail safely if required information is
  -- missing." For an article that is a date to print, a lede to open with and
  -- a body to read. An article published without them is an index card linking
  -- to an empty page — and the failure is silent, because every one of those
  -- fields is legitimately empty while it is being written.
  CONSTRAINT unchained_insights_published_is_complete
    CHECK (
      NOT published
      OR (published_on IS NOT NULL
          AND lede IS NOT NULL
          AND jsonb_array_length(sections) >= 1)
    ),

  CONSTRAINT unchained_insights_archived_not_published
    CHECK (archived_at IS NULL OR NOT published)
);

-- The index the public function reads: published articles, newest first. The
-- site's own ordering rule (byNewestFirst) stated where the rows live.
CREATE INDEX IF NOT EXISTS idx_unchained_insights_published_order
  ON public.unchained_insights (published_on DESC NULLS LAST, slug ASC)
  WHERE published;

CREATE INDEX IF NOT EXISTS idx_unchained_insights_pillar
  ON public.unchained_insights (pillar);

-- ─── 3. Triggers ──────────────────────────────────────────────────────────
-- One function for INSERT and UPDATE, the shape the translations trigger in
-- 20260912000001 uses. Same rules: provenance is written server-side, identity
-- and creation facts are pinned, archiving unpublishes.

CREATE OR REPLACE FUNCTION public.unchained_insights_touch()
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

  IF NEW.published AND NOT OLD.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    NEW.published := FALSE;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_insights_touch ON public.unchained_insights;
CREATE TRIGGER trg_unchained_insights_touch
  BEFORE INSERT OR UPDATE ON public.unchained_insights
  FOR EACH ROW EXECUTE FUNCTION public.unchained_insights_touch();

-- ─── 4. Insight translations ──────────────────────────────────────────────
-- The same design as unchained_project_translations, for the same reasons. The
-- slug, the pillar, the dates, the images and the related links stay on the
-- parent: they are facts about the article, not about a language.

CREATE TABLE IF NOT EXISTS public.unchained_insight_translations (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  insight_id  UUID NOT NULL REFERENCES public.unchained_insights(id) ON DELETE CASCADE,
  locale      TEXT NOT NULL REFERENCES public.unchained_locales(code) ON UPDATE CASCADE,

  published   BOOLEAN NOT NULL DEFAULT FALSE,

  title           TEXT,
  description     TEXT,
  lede            TEXT,
  -- NULL means "the body is not translated", and the site renders the
  -- parent's. An empty array would mean "this article has no body in French",
  -- which is never what anybody intends.
  sections        JSONB,

  seo_title       TEXT,
  seo_description TEXT,
  og_title        TEXT,
  og_description  TEXT,

  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  published_at TIMESTAMPTZ,

  CONSTRAINT unchained_insight_translations_unique UNIQUE (insight_id, locale),

  CONSTRAINT unchained_insight_translations_title_length
    CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 160),
  CONSTRAINT unchained_insight_translations_description_length
    CHECK (description IS NULL OR length(btrim(description)) BETWEEN 1 AND 300),
  CONSTRAINT unchained_insight_translations_lede_length
    CHECK (lede IS NULL OR length(btrim(lede)) BETWEEN 1 AND 1000),
  CONSTRAINT unchained_insight_translations_sections_shape
    CHECK (public.unchained_insight_sections_valid(sections)),
  CONSTRAINT unchained_insight_translations_seo_title_length
    CHECK (seo_title IS NULL OR length(btrim(seo_title)) BETWEEN 1 AND 70),
  CONSTRAINT unchained_insight_translations_seo_description_length
    CHECK (seo_description IS NULL OR length(btrim(seo_description)) BETWEEN 1 AND 160),
  CONSTRAINT unchained_insight_translations_og_title_length
    CHECK (og_title IS NULL OR length(btrim(og_title)) BETWEEN 1 AND 90),
  CONSTRAINT unchained_insight_translations_og_description_length
    CHECK (og_description IS NULL OR length(btrim(og_description)) BETWEEN 1 AND 200),

  -- An article is read, not skimmed: a published translation that has the
  -- title but not the body would drop a reader from a French index card onto
  -- an English page. Title, description and a non-empty body are the minimum.
  CONSTRAINT unchained_insight_translations_published_has_content
    CHECK (
      NOT published
      OR (title IS NOT NULL
          AND description IS NOT NULL
          AND sections IS NOT NULL
          AND jsonb_array_length(sections) >= 1)
    )
);

CREATE INDEX IF NOT EXISTS idx_unchained_insight_translations_published
  ON public.unchained_insight_translations (insight_id, locale)
  WHERE published;

CREATE INDEX IF NOT EXISTS idx_unchained_insight_translations_locale
  ON public.unchained_insight_translations (locale);

CREATE OR REPLACE FUNCTION public.unchained_insight_translations_touch()
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
  NEW.insight_id := OLD.insight_id;
  NEW.locale     := OLD.locale;

  IF NEW.published AND NOT OLD.published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_insight_translations_touch
  ON public.unchained_insight_translations;
CREATE TRIGGER trg_unchained_insight_translations_touch
  BEFORE INSERT OR UPDATE ON public.unchained_insight_translations
  FOR EACH ROW EXECUTE FUNCTION public.unchained_insight_translations_touch();

-- ─── 5. Row level security ────────────────────────────────────────────────

ALTER TABLE public.unchained_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_insights_read ON public.unchained_insights;
CREATE POLICY unchained_insights_read ON public.unchained_insights
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_insights_manage ON public.unchained_insights;
CREATE POLICY unchained_insights_manage ON public.unchained_insights
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

REVOKE ALL ON TABLE public.unchained_insights FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_insights TO authenticated;

ALTER TABLE public.unchained_insight_translations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_insight_translations_read
  ON public.unchained_insight_translations;
CREATE POLICY unchained_insight_translations_read
  ON public.unchained_insight_translations
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_insight_translations_manage
  ON public.unchained_insight_translations;
CREATE POLICY unchained_insight_translations_manage
  ON public.unchained_insight_translations
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

REVOKE ALL ON TABLE public.unchained_insight_translations FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE
  ON TABLE public.unchained_insight_translations TO authenticated;

-- ─── 6. The public surface ────────────────────────────────────────────────
-- public.list_public_insights() → every published article, newest first, with
-- its published translations. The same shape and the same contract as
-- list_public_projects(): no arguments, a fixed column list, `WHERE published`
-- inside the function, STABLE, no writes.
--
-- ─── related_slugs is filtered HERE ───────────────────────────────────────
-- The site's resolveRelated() drops a slug that names a draft or an article
-- that was never written. Doing the same inside the function means an
-- anonymous caller cannot learn the slug of an unpublished draft by reading
-- another article's related list — which is a small leak, but it is a leak of
-- exactly the kind the whole draft/published boundary exists to prevent.

CREATE OR REPLACE FUNCTION public.list_public_insights()
RETURNS TABLE (
  id              UUID,
  slug            TEXT,
  title           TEXT,
  description     TEXT,
  lede            TEXT,
  pillar          TEXT,
  tags            TEXT[],
  author          TEXT,
  sections        JSONB,
  related_slugs   TEXT[],
  case_study_slug TEXT,
  cover_image     TEXT,
  og_image        TEXT,
  featured        BOOLEAN,
  published_on    DATE,
  revised_on      DATE,
  seo_title       TEXT,
  seo_description TEXT,
  og_title        TEXT,
  og_description  TEXT,
  canonical_url   TEXT,
  translations    JSONB
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  SELECT
    a.id,
    a.slug,
    a.title,
    a.description,
    a.lede,
    a.pillar,
    a.tags,
    a.author,
    a.sections,
    -- Only the related articles that are themselves published and not
    -- archived. COALESCE because array_agg over no rows is NULL and the column
    -- is read as a list.
    COALESCE(
      (
        SELECT array_agg(r.slug ORDER BY r.ord)
          FROM (
            SELECT s.slug, s.ord
              FROM unnest(a.related_slugs) WITH ORDINALITY AS s(slug, ord)
             WHERE EXISTS (
                     SELECT 1 FROM public.unchained_insights o
                      WHERE o.slug = s.slug
                        AND o.published
                        AND o.archived_at IS NULL
                        -- An article listing itself would render a "read next"
                        -- link back to the page the reader is on.
                        AND o.slug <> a.slug
                   )
          ) r
      ),
      '{}'::text[]
    ) AS related_slugs,
    a.case_study_slug,
    a.cover_image,
    a.og_image,
    a.featured,
    a.published_on,
    a.revised_on,
    a.seo_title,
    a.seo_description,
    a.og_title,
    a.og_description,
    a.canonical_url,
    COALESCE(
      (
        SELECT jsonb_object_agg(t.locale, t.fields)
          FROM (
            SELECT
              tr.locale,
              jsonb_strip_nulls(jsonb_build_object(
                'title',           tr.title,
                'description',     tr.description,
                'lede',            tr.lede,
                'sections',        tr.sections,
                'seo_title',       tr.seo_title,
                'seo_description', tr.seo_description,
                'og_title',        tr.og_title,
                'og_description',  tr.og_description
              )) AS fields
            FROM public.unchained_insight_translations tr
            WHERE tr.insight_id = a.id
              AND tr.published
              AND EXISTS (
                    SELECT 1 FROM public.unchained_locales l
                     WHERE l.code = tr.locale AND l.active
                  )
          ) t
      ),
      '{}'::jsonb
    ) AS translations
  FROM public.unchained_insights a
  WHERE a.published
    AND a.archived_at IS NULL
  ORDER BY a.published_on DESC NULLS LAST, a.slug ASC;
$fn$;

REVOKE ALL ON FUNCTION public.list_public_insights() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_insights() TO anon, authenticated;

-- ─── 7. The articles the site publishes today ─────────────────────────────
-- Generated from lib/insights.ts by scripts/generate-insight-seed.mjs rather
-- than retyped, so the prose in the table is byte-for-byte the prose that is
-- on the website. See §7 of docs/cms.md.
--
-- ON CONFLICT (slug) DO NOTHING, like the portfolio seed: re-running this file
-- must not revert an article somebody has since edited in the panel.

-- INSIGHT_SEED_BEGIN
-- Generated by scripts/generate-insight-seed.mjs from lib/insights.ts.
-- Do not edit by hand: re-run the script instead, so the prose here and the
-- prose the site falls back to cannot diverge through a manual correction to
-- one of them.
--
-- 1 article.

INSERT INTO public.unchained_insights (
  slug, title, description, lede, pillar, sections,
  related_slugs, case_study_slug, og_image,
  published, published_on, revised_on
) VALUES
  (
    'custom-software-or-saas',
    'Custom Software or SaaS? A Framework for Deciding',
    'A practical framework for deciding when to buy SaaS, build custom software, combine both, or wait — based on strategic value, workflow complexity, economics and total cost of ownership.',
    'Build or buy is usually argued as a technology preference. It is closer to a capital allocation decision: a few parts of an operation are worth owning outright, most are not, and the difference is knowable before anyone writes code.',
    'software-development',
    '[{"heading":"The question is usually asked backwards","body":["The conversation tends to arrive in the same shape: should we buy this product, or build something of our own? Framed that way it is a question about technology, and it gets answered with preferences — the operations lead has used the product before, the technical adviser would rather own the stack, and whoever controls the budget picks between two positions that were never really compared.","The more useful question is narrower. Not “should we build custom software?” but “where does owning this software create enough value to justify the cost and complexity of owning it?” Ownership is not a one-off: it is a commitment to keep paying for something in exchange for control over it. That trade is excellent in some parts of a business and indefensible in others.","It is also not a single decision. A company does not become a custom software company or a SaaS company; it makes this call separately for a dozen workflows — invoicing, scheduling, support, fulfilment, reporting — and the right answer differs across them. Most healthy setups are mostly bought, with a small owned core carrying the work nobody else does the same way.","What follows is how to make that call one workflow at a time — including the cases where the honest answer is that neither option is appropriate yet."]},{"heading":"Start with the problem, not the software","body":["Most build-versus-buy conversations start at the end. There is already a shortlist of products, or a proposal for a system, which means a solution is being evaluated before the problem has been written down. The cost of that is invisible at the time and obvious a year later, when the company is running a tool that solved a problem it turned out not to have.","Four things need establishing first, and none of them requires a technology decision. What the workflow actually is, including the informal steps — the spreadsheet someone maintains on the side, the re-keying between two systems that never made it into the process document. Where it breaks, and who absorbs the breakage. What that breakage costs, in hours, errors and delayed revenue. And whether the workflow is something customers choose you for, or plumbing that has to work.","This is also where a good number of custom software requests dissolve. A company convinced it needs a bespoke CRM often has a data problem and an accountability problem underneath: three systems disagree about who owns an account, and nobody is responsible for reconciling them. New software settles neither question. It encodes the confusion and charges for the privilege."],"points":["What is the workflow, including the steps nobody documented?","Where does it break, and who absorbs the breakage today?","What does that cost per month — in hours, errors, delays and lost revenue?","Is this workflow a reason customers choose us, or is it plumbing?","If we changed nothing for another year, what would that cost?"]},{"heading":"When buying is the better decision","body":["For most workflows in most businesses, buying wins, and it is not close. Payroll, accounting, email, support ticketing, standard CRM — these are solved problems, and a vendor amortises the cost of solving them across thousands of customers. No internal team matches that arithmetic on a workflow that looks the same everywhere.","Speed is the other half of it. A configured product is running in weeks, at a price you can read off a page, and a wrong choice costs a subscription and a migration rather than two quarters of development budget. That bounded downside is worth more than it looks for a decision made under uncertainty — which most of these are.","Mature products also carry the unglamorous eighty per cent nobody budgets for when they build: permissions and roles, audit trails, exports, mobile access, single sign-on, backups, an uptime record, and a support team that answers when something breaks at month end.","Choosing SaaS is not the lesser decision. Buying the commodity is precisely how a company affords to build the one thing that is genuinely its own."],"points":["The workflow is essentially the same as it is at comparable companies.","Doing it better than average is not why customers choose you.","Implementation speed matters more than control.","Customisation needs stop at configuration — fields, roles, templates, rules.","The vendor’s roadmap is heading somewhere you can live with.","If you had to leave in three years, you could get your data out and move."]},{"heading":"When custom software starts to make sense","body":["Custom software earns its place on evidence rather than on the promise of flexibility, and the signals are already visible in how the business runs.","The clearest is the accumulation of workarounds. Every export into a spreadsheet, every field used for something other than its name, every rule the team follows because the tool cannot express it — each is a small permanent tax, and together they measure how far the product sits from the actual process. When that tax is large and recurring, it becomes comparable with the cost of building something that does not levy it.","The second is orchestration. A single system rarely needs replacing; the problem is usually that four of them each hold part of the truth and a person is the integration layer, moving records between them and resolving disagreements by hand. That role is expensive, error-prone and impossible to scale, and it is the shape of problem a custom layer solves well.","The third is differentiation. If the process is a reason customers choose you — how you route jobs, how you price, how you deliver faster than the alternative — then renting it means your advantage is a configuration a competitor can subscribe to on the same terms tomorrow. Owning the software is one of the few ways to keep an operational advantage from being copied at that speed.","Scale finishes the argument rather than starting it: friction that costs a little per transaction becomes a real number at volume, and per-seat pricing works against you as you grow — but only once the volume is real, never on projected usage."],"points":["The products would require you to change the process, not the settings.","People are the integration layer between systems that ought to talk.","The workflow is part of why customers choose you, not just how work gets done.","The cost of the workaround scales with volume, and volume is growing.","You need control over data or roadmap for a reason you can state.","The system will still matter in three years, and someone will own it."]},{"heading":"A framework for weighing the decision","body":["The framework below is nine dimensions. Score each from 1 to 5 for the specific workflow under discussion — not for the company as a whole, and not for a category of software. The value is not in the total; it is that the dimensions get argued separately, with evidence, instead of collapsing into a single opinion held by whoever is most senior in the room."],"points":["Strategic differentiation — if a competitor bought the same product tomorrow, how much of your advantage would disappear?","Workflow uniqueness — how much of the process would have to change to fit the product, and would that change be an improvement or a loss?","Integration complexity — how many systems have to agree, and who reconciles them today?","Expected usage and scale — how many people and transactions, now and in twenty-four months?","Economic impact — what does the friction cost per month, in numbers you can defend?","Required control — what happens if pricing changes, the vendor is acquired, or the feature you depend on is deprecated?","Time-to-value — what does a six-month wait cost, against two weeks of configuration?","Internal capability — who owns this after launch, and is that a named commitment or an assumption?","Long-term ownership cost — can you fund years two and three, not only the build?"]},{"heading":"How to read the scores","body":["The first six dimensions argue for building as they rise. The last three are constraints rather than justifications: heavy time pressure, no internal owner, or no budget beyond the build does not make buying more attractive in principle — it makes building unaffordable in practice, whatever the first six say.","Three readings come up repeatedly. If differentiation and workflow uniqueness are both low, stop there: buy the product, configure it, and spend the attention somewhere it earns more. If both are high and the economic impact is high, building is likely to be worth it, provided the constraints allow. And if the six are split — high on integration and economics, low on differentiation — the answer is usually neither pure option.","There is one more use for the exercise, and it is the one people skip. If you cannot put a number on economic impact, or name who will own the system after launch, the decision is not ready to be made — a finding rather than a failure, and far cheaper to reach in a scoring conversation than in month four of a build."]},{"heading":"The cost that gets left out","body":["Development cost is the part of custom software that appears in the proposal, and it is not the part that decides whether the decision was right. A system that runs is a system somebody maintains.","Past the build there is hosting, dependency upgrades, security patching, monitoring and the response when monitoring fires, backups, support for the people using it, the documentation that keeps it transferable, and the continuing development any system in active use requires. None of it is optional and all of it is annual. Where there is no budget line for year two, the honest conclusion is that the system should not be built in year one.","Subscriptions compound in their own way. Per-seat pricing scales with headcount rather than with value received, and the capability you actually needed is often in the tier above or sold as an add-on. Then there is implementation, data migration, the connectors that keep the product talking to everything else, and the labour of the workarounds it forces. Switching cost is the one that moves: it grows with every month of data and process you place inside the product, which is why a tool that was a good decision in year one can be an expensive one by year four without anything about it having changed.","Compare over one horizon — three to five years is usually enough — and keep a third column for changing nothing, since the status quo has a running cost too, and it is the one the business is already paying."],"points":["Build column: development, infrastructure, security, monitoring, support, documentation, upgrades, continuing development.","Buy column: subscriptions at projected headcount, tier changes, add-ons, implementation, migration, integrations, workarounds.","Both columns: the cost of the transition itself, and of leaving in three years.","Third column: what the current way of working costs over the same period."]},{"heading":"Most good answers are hybrids","body":["The binary framing is largely an artefact of who is selling: vendors compare themselves against building, agencies compare themselves against buying. Operators do both, and what the good arrangements share is a refusal to build anything that can be bought, and a refusal to rent the part of the operation that makes the business worth choosing.","Hybrids fail in a predictable way, so they need one rule. For every important entity — customer, order, invoice, job — decide which system holds the truth, and make every other system a reader of it. The custom layer should depend on documented, stable interfaces, and the seam between bought and built should be as thin as you can make it. Without that discipline a hybrid becomes two systems that disagree, which is worse than either option alone.","Our own product is built on that split. TanCerca is a marketplace with merchant tooling, delivery coordination and an operational layer we designed and built, running on payment and cloud infrastructure we did not build and had no reason to. The custom part is the part that had to match how local merchants and couriers work."],"points":["SaaS for accounting, payroll and email; custom for the workflow the business runs on.","An existing CRM as the record of customers, with a custom operational layer for the pipeline specific to you.","SaaS systems of record, with a custom reporting surface for what the built-in dashboards will not answer.","Existing communication tools, with custom orchestration deciding what happens, when, and to whom."]},{"heading":"A sequence you can run this month","body":["Turning any of this into a decision takes a sequence, and it is short enough to run in a couple of weeks without stopping the business.","Step three is where most of the value sits. Companies routinely mistake familiarity for uniqueness: a process is not distinctive because it is yours, but because doing it differently produces a different result for the customer. Honesty there is what keeps a build proposal from becoming an expensive way to preserve a habit.","Waiting is a real outcome, not a failure to decide. If the problem is undefined, if the process still changes every few weeks, if the volume is too low for the friction to cost anything meaningful, or if the process itself is broken, neither buying nor building will help — automating a broken process produces the same mess, faster and harder to see. Stabilise the workflow by hand for a quarter, instrument it enough to know what it costs, and revisit with numbers. A deliberate decision to wait, with a date on it, is a decision. Drifting is not."],"points":["Define the operational problem in writing, including the informal steps.","Quantify what it costs today — hours, errors, delays, revenue.","Separate what is genuinely unique about the process from what is merely familiar.","Evaluate real SaaS options against the workflow, not against a feature list.","Document the gaps and the workarounds each option would require.","Estimate total cost of ownership for build, buy and status quo over one horizon.","Score the nine dimensions, and argue the ones you disagree about.","Decide: buy, build, combine — or wait, with a date to revisit."]},{"heading":"Build only what is worth owning","body":["The principle underneath all of this is easy to state and harder to apply: build the parts of your digital infrastructure that create meaningful strategic or economic value, and buy the parts that do not.","The two failure modes are symmetrical. Building the commodity is expensive and invisible — a custom invoicing system that does what a subscription does, with a maintenance burden attached and nothing gained. Renting the differentiator is cheap now and capped later: the operation runs inside somebody else’s product, at their pace, with a ceiling set by their roadmap. The first mistake shows up in the budget, the second in the strategy, and it is much harder to reverse.","Most companies end up mostly bought, with a small custom core. The discipline is in keeping that core small and making sure it is the right part.","Where the answer is genuinely unclear, the useful next step is not a proposal. It is an hour with the workflow written down, the numbers on the table and the real alternatives compared — which is how our software development work starts, and often enough it ends with a recommendation to buy something and get on with the business."]}]'::jsonb,
    '{}'::text[],
    'tancerca',
    NULL,
    TRUE,
    DATE '2026-09-02',
    NULL
  )
ON CONFLICT (slug) DO NOTHING;
-- INSIGHT_SEED_END

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The body validator refuses what it says it refuses. Each of these is a shape
-- an editor could produce by accident, and each must be impossible to store.
DO $blk$
BEGIN
  IF NOT public.unchained_insight_sections_valid(NULL) THEN
    RAISE EXCEPTION '[fail] a null body was rejected — a draft must be allowed to be empty';
  END IF;
  IF NOT public.unchained_insight_sections_valid('[]'::jsonb) THEN
    RAISE EXCEPTION '[fail] an empty body was rejected';
  END IF;
  IF NOT public.unchained_insight_sections_valid(
       '[{"heading":"H","body":["p"],"points":["a"]}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] a well-formed section was rejected';
  END IF;
  IF public.unchained_insight_sections_valid('{"heading":"H"}'::jsonb) THEN
    RAISE EXCEPTION '[fail] an object was accepted where an array is required';
  END IF;
  IF public.unchained_insight_sections_valid('[{"body":["p"]}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] a section with no heading was accepted';
  END IF;
  IF public.unchained_insight_sections_valid('[{"heading":"H","body":[]}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] a section with an empty body was accepted';
  END IF;
  IF public.unchained_insight_sections_valid('[{"heading":"H","body":"p"}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] a string body was accepted where an array is required';
  END IF;
  IF public.unchained_insight_sections_valid(
       '[{"heading":"H","body":["p"],"html":"<script>"}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] an unknown key was accepted into a section';
  END IF;
  IF public.unchained_insight_sections_valid('[{"heading":"H","body":["p"],"points":[]}]'::jsonb) THEN
    RAISE EXCEPTION '[fail] an empty points list was accepted';
  END IF;
  RAISE NOTICE '[ok] the article body validator accepts and refuses as documented';
END;
$blk$;

-- The two array validators, which exist because a CHECK cannot hold a
-- subquery. Each case below is a value an editor could produce.
DO $blk$
BEGIN
  -- An empty list and a NULL are both "nothing to check".
  IF NOT public.unchained_slug_list_ok(NULL, 12) THEN
    RAISE EXCEPTION '[fail] a null slug list was rejected';
  END IF;
  IF NOT public.unchained_slug_list_ok('{}'::text[], 12) THEN
    RAISE EXCEPTION '[fail] an empty slug list was rejected';
  END IF;
  IF NOT public.unchained_slug_list_ok(ARRAY['a-real-slug', 'another'], 12) THEN
    RAISE EXCEPTION '[fail] a list of valid slugs was rejected';
  END IF;
  IF public.unchained_slug_list_ok(ARRAY['https://example.com/a'], 12) THEN
    RAISE EXCEPTION '[fail] a full URL was accepted where a slug is required';
  END IF;
  IF public.unchained_slug_list_ok(ARRAY['/insights/a'], 12) THEN
    RAISE EXCEPTION '[fail] a path was accepted where a slug is required';
  END IF;
  IF public.unchained_slug_list_ok(ARRAY['Not A Slug'], 12) THEN
    RAISE EXCEPTION '[fail] a title was accepted where a slug is required';
  END IF;
  IF public.unchained_slug_list_ok(ARRAY[NULL]::text[], 12) THEN
    RAISE EXCEPTION '[fail] a null element was accepted into a slug list';
  END IF;
  IF public.unchained_slug_list_ok(ARRAY['a', 'b', 'c'], 2) THEN
    RAISE EXCEPTION '[fail] a list longer than its limit was accepted';
  END IF;

  IF NOT public.unchained_label_list_ok(ARRAY['A tag', 'Another'], 20, 60) THEN
    RAISE EXCEPTION '[fail] a list of valid labels was rejected';
  END IF;
  IF public.unchained_label_list_ok(ARRAY[repeat('x', 61)], 20, 60) THEN
    RAISE EXCEPTION '[fail] an over-long label was accepted';
  END IF;
  IF public.unchained_label_list_ok(ARRAY['   '], 20, 60) THEN
    RAISE EXCEPTION '[fail] a whitespace-only label was accepted';
  END IF;

  RAISE NOTICE '[ok] the array validators accept and refuse as documented';
END;
$blk$;

-- And the constraints that call them actually reject a bad write. The
-- validators being correct is not the same claim as the table using them.
DO $blk$
DECLARE
  v_id UUID;
BEGIN
  BEGIN
    INSERT INTO public.unchained_insights
      (slug, title, description, pillar, related_slugs)
    VALUES ('zz-array-probe', 'Array probe', 'Temporary row.',
            'software-development', ARRAY['https://example.com/a']);
    RAISE EXCEPTION '[fail] a full URL was stored in related_slugs';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.unchained_insights
      (slug, title, description, pillar, tags)
    VALUES ('zz-array-probe', 'Array probe', 'Temporary row.',
            'software-development', ARRAY[repeat('x', 61)]);
    RAISE EXCEPTION '[fail] an over-long tag was stored';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.unchained_insights
    (slug, title, description, pillar, related_slugs, tags)
  VALUES ('zz-array-probe', 'Array probe', 'Temporary row.',
          'software-development', ARRAY['a-real-slug'], ARRAY['A tag'])
  RETURNING id INTO v_id;

  DELETE FROM public.unchained_insights WHERE id = v_id;
  RAISE NOTICE '[ok] the array constraints are wired to the table';
END;
$blk$;

-- Publishing refuses an incomplete article, and archiving unpublishes a
-- complete one. Exercised on a real row, then removed.
DO $blk$
DECLARE
  v_id        UUID;
  v_published BOOLEAN;
BEGIN
  INSERT INTO public.unchained_insights (slug, title, description, pillar)
  VALUES ('zz-apply-probe', 'Apply probe',
          'Temporary row created by a migration assertion.', 'software-development')
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.unchained_insights SET published = TRUE WHERE id = v_id;
    RAISE EXCEPTION '[fail] an article with no date, lede or body was published';
  EXCEPTION WHEN check_violation THEN
    NULL;  -- expected
  END;

  UPDATE public.unchained_insights
     SET published_on = CURRENT_DATE,
         lede         = 'A probe.',
         sections     = '[{"heading":"H","body":["p"]}]'::jsonb,
         published    = TRUE
   WHERE id = v_id;

  IF NOT EXISTS (SELECT 1 FROM public.list_public_insights() WHERE slug = 'zz-apply-probe') THEN
    RAISE EXCEPTION '[fail] a published article did not reach the public function';
  END IF;

  UPDATE public.unchained_insights SET archived_at = now() WHERE id = v_id;
  SELECT published INTO v_published FROM public.unchained_insights WHERE id = v_id;
  IF v_published THEN
    RAISE EXCEPTION '[fail] an archived article stayed published';
  END IF;

  IF EXISTS (SELECT 1 FROM public.list_public_insights() WHERE slug = 'zz-apply-probe') THEN
    RAISE EXCEPTION '[fail] an archived article reached the public function';
  END IF;

  DELETE FROM public.unchained_insights WHERE id = v_id;
  RAISE NOTICE '[ok] publishing validates, archiving unpublishes, drafts stay private';
END;
$blk$;

-- anon may call the list function and may not read the tables.
DO $blk$
BEGIN
  IF NOT has_function_privilege('anon', 'public.list_public_insights()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon cannot call list_public_insights()';
  END IF;
  IF has_table_privilege('anon', 'public.unchained_insights', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on unchained_insights';
  END IF;
  IF has_table_privilege('anon', 'public.unchained_insight_translations', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on unchained_insight_translations';
  END IF;
  RAISE NOTICE '[ok] anon: function yes, tables no';
END;
$blk$;

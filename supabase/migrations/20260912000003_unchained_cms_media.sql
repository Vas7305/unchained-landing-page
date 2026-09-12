-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business CMS: the media library
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   has_product_access()
--   20260912000001_unchained_cms_core.sql     unchained_manages_content()
--   20260912000002_unchained_cms_insights.sql unchained_insights
--
-- Creates:
--     storage bucket 'unchained-cms-media'    public read, managed write
--     storage.objects policies for it
--     unchained_media                         the library's metadata
--     unchained_media_touch()
--     unchained_media_reference_ok()          what an image column may hold
--   + alt-text columns on projects, insights and both translation tables
--   ~ widened image CHECKs on projects and insights
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- Every image on the public site today is a file in public/work/, committed to
-- the repository. That is why the image columns are constrained to
-- site-relative paths, and why adding a project screenshot is still a commit
-- even though adding the project itself no longer is.
--
-- This is the last step of that migration: a bucket the panel can upload to, a
-- table recording what each file is, and image columns that accept either form
-- so nothing published today has to move.
--
-- ─── Why the bucket is PUBLIC, and why that is not a leak ─────────────────
-- A signed URL expires. An og:image is fetched by Facebook, by LinkedIn, by
-- Slack and by Google, days or months after the page was published and with no
-- session of any kind — every one of those fetches would 404 against a signed
-- URL, and the share preview would be blank. The same is true of the <img> a
-- crawler requests.
--
-- So the bucket is public, and the security question becomes "what is allowed
-- IN it" rather than "who may read it". The answer is enforced in three
-- places: only a content manager may write (the INSERT policy below), only
-- images may be written (the MIME allow-list on the bucket), and there is a
-- size cap. A private file must not be put here — this bucket is the
-- website's asset directory, and everything in it is published by definition.
--
-- ─── Product isolation ────────────────────────────────────────────────────
-- The brief asks that a TanCerca administrator not reach Unchained media
-- because both use Supabase. In this architecture they cannot: since
-- 2026-09-05 Unchained owns a SEPARATE Supabase project, and a TanCerca
-- administrator has no auth.users row here at all — no session, no JWT, no
-- policy to evaluate. The bucket is isolated by the same mechanism the tables
-- are, which is the strongest form of it available.
--
-- The policies below are written as though that were not true, because the
-- product boundary should not depend on a deployment fact remaining unchanged.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor. Safe to run twice.

-- ─── 1. The bucket ────────────────────────────────────────────────────────
-- Created through storage.buckets directly. The Studio UI would do the same
-- thing, but a bucket created by hand is a piece of production configuration
-- with no record of who made it or what it was meant to allow.
--
-- 10 MB and an image-only MIME list. The site's largest existing asset is a
-- few hundred kilobytes; the cap is there to stop somebody putting a video or
-- a PDF export in the website's image directory, not to be a quota.
--
-- ON CONFLICT DO UPDATE, unlike every seed in this project: the limits are
-- configuration rather than content, so re-applying this file should correct a
-- bucket somebody widened by hand in the dashboard. `public` is deliberately
-- included — a bucket flipped to private would silently blank every share
-- preview on the site, and that is exactly the kind of drift this should undo.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'unchained-cms-media',
  'unchained-cms-media',
  TRUE,
  10485760,
  ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/avif', 'image/gif', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
  SET public             = EXCLUDED.public,
      file_size_limit    = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ─── 2. Storage policies ──────────────────────────────────────────────────
-- storage.objects has RLS enabled by Supabase already. These four policies say
-- who may do what IN THIS BUCKET; they name the bucket in every clause, so
-- they cannot affect another bucket created later.
--
-- Read is granted to anon and authenticated explicitly even though the bucket
-- is public: `public` controls whether the object endpoint serves without a
-- token, and a SELECT policy is what the storage API evaluates for listing.
-- Without it the panel's media grid would be empty while the website's images
-- loaded, which is a confusing way to discover the difference.

DROP POLICY IF EXISTS unchained_cms_media_read ON storage.objects;
CREATE POLICY unchained_cms_media_read ON storage.objects
  FOR SELECT
  USING (bucket_id = 'unchained-cms-media');

-- Write, in all three forms, is for content managers only — the same predicate
-- that decides who may publish a page, because uploading an image to the
-- website's asset directory is publishing.
DROP POLICY IF EXISTS unchained_cms_media_insert ON storage.objects;
CREATE POLICY unchained_cms_media_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'unchained-cms-media'
    AND public.unchained_manages_content()
  );

DROP POLICY IF EXISTS unchained_cms_media_update ON storage.objects;
CREATE POLICY unchained_cms_media_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'unchained-cms-media'
    AND public.unchained_manages_content()
  )
  WITH CHECK (
    bucket_id = 'unchained-cms-media'
    AND public.unchained_manages_content()
  );

DROP POLICY IF EXISTS unchained_cms_media_delete ON storage.objects;
CREATE POLICY unchained_cms_media_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'unchained-cms-media'
    AND public.unchained_manages_content()
  );

-- ─── 3. What an image column may hold ─────────────────────────────────────
-- Phase 9 constrained every image column to a site-relative path, and said
-- why: "An off-site image would make the site's rendering depend on a host
-- nobody here controls, and next.config.ts sets images.unoptimized precisely
-- because every asset is expected to be local."
--
-- That reasoning is still correct and is NOT being discarded. What changes is
-- that there is now a second host we do control: this project's own storage
-- endpoint. So the rule becomes "a path in the repository, or an object in our
-- own public bucket", and every other URL stays refused — an image on a
-- third-party CDN is as unacceptable today as it was then.
--
-- ─── Why the pattern, and not just 'starts with https' ────────────────────
-- A bare https allowance would accept any host on the internet, which is the
-- rule this is written to avoid. The pattern pins three things: the Supabase
-- storage host shape, the public-object path, and the bucket name. An image
-- URL that does not resolve to a file in THIS bucket cannot be stored.
--
-- The project ref is left as a wildcard rather than hard-coded. A migration
-- that embedded one ref could not be applied to a staging project without
-- being edited, and an edited migration is one that has stopped being the
-- thing that ran in production.

CREATE OR REPLACE FUNCTION public.unchained_media_reference_ok(p_value TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT
    p_value IS NULL
    OR (
      length(p_value) <= 500
      AND (
        -- A file committed to the website's public/ directory. Rejects '//x',
        -- which a browser reads as a protocol-relative URL to another host.
        (p_value ~ '^/[^[:space:]]*$' AND p_value !~ '^//')
        -- An object in this project's own public CMS bucket.
        OR p_value ~ '^https://[a-z0-9-]+\.supabase\.co/storage/v1/object/public/unchained-cms-media/[^[:space:]]+$'
      )
    );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_media_reference_ok(TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_media_reference_ok(TEXT) TO authenticated;

-- Repoint every image column at the shared rule. Each DROP names the
-- constraint Phase 9 (or 20260912000002) created, so applying this file twice
-- is a no-op rather than an error.
DO $blk$
BEGIN
  ALTER TABLE public.unchained_projects
    DROP CONSTRAINT IF EXISTS unchained_projects_thumbnail_path,
    DROP CONSTRAINT IF EXISTS unchained_projects_hero_image_path,
    DROP CONSTRAINT IF EXISTS unchained_projects_og_image_path;

  ALTER TABLE public.unchained_projects
    ADD CONSTRAINT unchained_projects_thumbnail_path
      CHECK (public.unchained_media_reference_ok(thumbnail)),
    ADD CONSTRAINT unchained_projects_hero_image_path
      CHECK (public.unchained_media_reference_ok(hero_image)),
    ADD CONSTRAINT unchained_projects_og_image_path
      CHECK (public.unchained_media_reference_ok(og_image));

  ALTER TABLE public.unchained_insights
    DROP CONSTRAINT IF EXISTS unchained_insights_cover_image_path,
    DROP CONSTRAINT IF EXISTS unchained_insights_og_image_path;

  ALTER TABLE public.unchained_insights
    ADD CONSTRAINT unchained_insights_cover_image_path
      CHECK (public.unchained_media_reference_ok(cover_image)),
    ADD CONSTRAINT unchained_insights_og_image_path
      CHECK (public.unchained_media_reference_ok(og_image));
END;
$blk$;

-- ─── 4. Alt text ──────────────────────────────────────────────────────────
-- ─── Why alt text is stored on the CONTENT and not only on the file ───────
-- A media library that holds one alt string per file is the common design and
-- it is subtly wrong: alt text describes an image IN CONTEXT. The same
-- screenshot is "the TanCerca merchant dashboard" on the project page and "an
-- example of the dashboards we build" in an article, and a library-wide string
-- can only be one of them.
--
-- So the library keeps a DEFAULT (§5), the panel copies it in when an editor
-- picks the image, and the content row owns the value from then on. The
-- library's field stops an image being uploaded with no description at all;
-- the content's field is what reaches the page.
--
-- ─── And why it is translated ─────────────────────────────────────────────
-- Alt text is prose read aloud by a screen reader. A Russian visitor with
-- Russian content and an English image description is being handed the one
-- sentence on the page that was not translated, in the one place where the
-- reader cannot see the image to compensate.

ALTER TABLE public.unchained_projects
  ADD COLUMN IF NOT EXISTS thumbnail_alt  TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_alt TEXT;

ALTER TABLE public.unchained_project_translations
  ADD COLUMN IF NOT EXISTS thumbnail_alt  TEXT,
  ADD COLUMN IF NOT EXISTS hero_image_alt TEXT;

ALTER TABLE public.unchained_insights
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;

ALTER TABLE public.unchained_insight_translations
  ADD COLUMN IF NOT EXISTS cover_image_alt TEXT;

DO $blk$
BEGIN
  ALTER TABLE public.unchained_projects
    DROP CONSTRAINT IF EXISTS unchained_projects_thumbnail_alt_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_hero_image_alt_length,
    DROP CONSTRAINT IF EXISTS unchained_projects_alt_needs_image;
  ALTER TABLE public.unchained_projects
    ADD CONSTRAINT unchained_projects_thumbnail_alt_length
      CHECK (thumbnail_alt IS NULL OR length(btrim(thumbnail_alt)) BETWEEN 1 AND 300),
    ADD CONSTRAINT unchained_projects_hero_image_alt_length
      CHECK (hero_image_alt IS NULL OR length(btrim(hero_image_alt)) BETWEEN 1 AND 300),
    -- A description with no image to describe is a string that will never be
    -- read out, and a reader of the row would take it as evidence the image is
    -- there. The same argument the thumbnail_size_needs_thumbnail constraint
    -- makes for dimensions.
    ADD CONSTRAINT unchained_projects_alt_needs_image
      CHECK (
        (thumbnail_alt  IS NULL OR thumbnail  IS NOT NULL)
        AND (hero_image_alt IS NULL OR hero_image IS NOT NULL)
      );

  ALTER TABLE public.unchained_project_translations
    DROP CONSTRAINT IF EXISTS unchained_project_translations_thumbnail_alt_length,
    DROP CONSTRAINT IF EXISTS unchained_project_translations_hero_image_alt_length;
  ALTER TABLE public.unchained_project_translations
    ADD CONSTRAINT unchained_project_translations_thumbnail_alt_length
      CHECK (thumbnail_alt IS NULL OR length(btrim(thumbnail_alt)) BETWEEN 1 AND 300),
    ADD CONSTRAINT unchained_project_translations_hero_image_alt_length
      CHECK (hero_image_alt IS NULL OR length(btrim(hero_image_alt)) BETWEEN 1 AND 300);

  ALTER TABLE public.unchained_insights
    DROP CONSTRAINT IF EXISTS unchained_insights_cover_image_alt_length,
    DROP CONSTRAINT IF EXISTS unchained_insights_alt_needs_image;
  ALTER TABLE public.unchained_insights
    ADD CONSTRAINT unchained_insights_cover_image_alt_length
      CHECK (cover_image_alt IS NULL OR length(btrim(cover_image_alt)) BETWEEN 1 AND 300),
    ADD CONSTRAINT unchained_insights_alt_needs_image
      CHECK (cover_image_alt IS NULL OR cover_image IS NOT NULL);

  ALTER TABLE public.unchained_insight_translations
    DROP CONSTRAINT IF EXISTS unchained_insight_translations_cover_image_alt_length;
  ALTER TABLE public.unchained_insight_translations
    ADD CONSTRAINT unchained_insight_translations_cover_image_alt_length
      CHECK (cover_image_alt IS NULL OR length(btrim(cover_image_alt)) BETWEEN 1 AND 300);
END;
$blk$;

-- ─── 5. The library ───────────────────────────────────────────────────────
-- What is in the bucket, described. storage.objects knows the path and the
-- byte count; it does not know what the picture is of, and that is the whole
-- reason this table exists.
--
-- Deliberately NOT a mirror of storage.objects. There is no trigger keeping
-- the two in step, because a file uploaded outside the panel is not a library
-- entry — it is a file — and reconciling them automatically would mean
-- inventing an alt text for it.

CREATE TABLE IF NOT EXISTS public.unchained_media (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The object's key within the bucket, e.g. 'projects/2026/dashboard.webp'.
  -- UNIQUE: two rows describing one file would give it two alt texts and two
  -- upload dates, and deleting one would leave the other pointing at a file
  -- somebody believes is gone.
  storage_path  TEXT NOT NULL UNIQUE,
  -- Recorded rather than assumed. It is always 'unchained-cms-media' today,
  -- and a column means a second bucket — a documents library, say — does not
  -- require rewriting every row's meaning.
  bucket        TEXT NOT NULL DEFAULT 'unchained-cms-media',
  -- The name the file had on the uploader's machine. Kept because it is how
  -- somebody searches for an image they uploaded last March; the object key is
  -- generated and unmemorable by design.
  filename      TEXT NOT NULL,
  mime_type     TEXT NOT NULL,
  size_bytes    BIGINT NOT NULL,

  -- Intrinsic pixel size, read from the file by the browser at upload time.
  -- Nullable as a pair: an SVG has no intrinsic size, and a file whose
  -- dimensions could not be read is still a usable image.
  width         INTEGER,
  height        INTEGER,

  -- The DEFAULT description, copied into content when the image is chosen.
  -- See §4 for why the content owns the value that reaches the page.
  alt_text      TEXT,
  -- A human label for the grid. Falls back to `filename` in the panel.
  title         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unchained_media_bucket_known
    CHECK (bucket = 'unchained-cms-media'),
  -- No leading slash, no '..', no whitespace. A key beginning with '/' creates
  -- an object whose public URL has a double slash and which the panel can
  -- never match against this row again.
  CONSTRAINT unchained_media_storage_path_format
    CHECK (
      storage_path ~ '^[A-Za-z0-9][A-Za-z0-9._/-]*$'
      AND storage_path !~ '\.\.'
      AND length(storage_path) BETWEEN 1 AND 400
    ),
  CONSTRAINT unchained_media_filename_present
    CHECK (length(btrim(filename)) BETWEEN 1 AND 300),
  -- The same list the bucket accepts, stated again where the row is written.
  -- The bucket enforces it on upload; this enforces it on the record, so a row
  -- cannot claim a file is a PDF.
  CONSTRAINT unchained_media_mime_known
    CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp',
                         'image/avif', 'image/gif', 'image/svg+xml')),
  CONSTRAINT unchained_media_size_plausible
    CHECK (size_bytes BETWEEN 1 AND 10485760),
  CONSTRAINT unchained_media_dimensions_paired
    CHECK (
      (width IS NULL) = (height IS NULL)
      AND (width  IS NULL OR width  BETWEEN 1 AND 20000)
      AND (height IS NULL OR height BETWEEN 1 AND 20000)
    ),
  CONSTRAINT unchained_media_alt_text_length
    CHECK (alt_text IS NULL OR length(btrim(alt_text)) BETWEEN 1 AND 300),
  CONSTRAINT unchained_media_title_length
    CHECK (title IS NULL OR length(btrim(title)) BETWEEN 1 AND 200)
);

-- The grid's default order: most recent first.
CREATE INDEX IF NOT EXISTS idx_unchained_media_created
  ON public.unchained_media (created_at DESC);

-- The search box. A trigram index would be better for substring matching but
-- needs pg_trgm; with a library of a few hundred images a prefix index on the
-- lower-cased filename is enough, and it needs no extension.
CREATE INDEX IF NOT EXISTS idx_unchained_media_filename
  ON public.unchained_media (lower(filename));

CREATE OR REPLACE FUNCTION public.unchained_media_touch()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := (SELECT auth.uid());
    NEW.updated_by := (SELECT auth.uid());
    RETURN NEW;
  END IF;

  NEW.updated_at   := now();
  NEW.updated_by   := (SELECT auth.uid());
  NEW.id           := OLD.id;
  NEW.created_at   := OLD.created_at;
  NEW.created_by   := OLD.created_by;
  -- The row describes ONE file. Repointing it at another object would silently
  -- reattribute an alt text, a size and an upload date to a different picture.
  -- Replacing an image means uploading a new one and updating what references
  -- it, which leaves both files and both records intact.
  NEW.storage_path := OLD.storage_path;
  NEW.bucket       := OLD.bucket;
  NEW.size_bytes   := OLD.size_bytes;
  NEW.mime_type    := OLD.mime_type;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_media_touch ON public.unchained_media;
CREATE TRIGGER trg_unchained_media_touch
  BEFORE INSERT OR UPDATE ON public.unchained_media
  FOR EACH ROW EXECUTE FUNCTION public.unchained_media_touch();

ALTER TABLE public.unchained_media ENABLE ROW LEVEL SECURITY;

-- Read for the module, write for content managers — the same shape as every
-- other CMS table. anon appears in no policy: the website reaches these images
-- through the public bucket by URL, and has no reason to be able to enumerate
-- the library or read who uploaded what.
DROP POLICY IF EXISTS unchained_media_read ON public.unchained_media;
CREATE POLICY unchained_media_read ON public.unchained_media
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_media_manage ON public.unchained_media;
CREATE POLICY unchained_media_manage ON public.unchained_media
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

REVOKE ALL ON TABLE public.unchained_media FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_media TO authenticated;

-- ─── 6. Alt text on the public surface ────────────────────────────────────
-- Both list functions gain the alt columns. DROP and CREATE for the reason
-- 20260912000001 gives: RETURNS TABLE cannot be changed by CREATE OR REPLACE.
--
-- Everything else about these two functions is unchanged; only the column list
-- and the two jsonb_build_object calls grow. The same both-directions
-- deployment argument applies — an older site build ignores the new keys, and
-- a newer one reads them as absent.

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
  thumbnail_alt    TEXT,
  hero_image       TEXT,
  hero_image_alt   TEXT,
  summary          TEXT,
  challenge        TEXT,
  solution         TEXT,
  outcome          TEXT,
  external_url     TEXT,
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
    p.id, p.slug, p.title, p.description, p.category, p.status,
    p.featured, p.detailed, p.year, p.industry,
    p.services, p.technologies, p.capabilities,
    p.thumbnail, p.thumbnail_width, p.thumbnail_height, p.thumbnail_alt,
    p.hero_image, p.hero_image_alt,
    p.summary, p.challenge, p.solution, p.outcome, p.external_url,
    p.seo_title, p.seo_description, p.og_title, p.og_description,
    p.og_image, p.canonical_url, p.published_at,
    COALESCE(
      (
        SELECT jsonb_object_agg(t.locale, t.fields)
          FROM (
            SELECT
              tr.locale,
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
                'thumbnail_alt',   tr.thumbnail_alt,
                'hero_image_alt',  tr.hero_image_alt,
                'seo_title',       tr.seo_title,
                'seo_description', tr.seo_description,
                'og_title',        tr.og_title,
                'og_description',  tr.og_description
              )) AS fields
            FROM public.unchained_project_translations tr
            WHERE tr.project_id = p.id
              AND tr.published
              AND EXISTS (
                    SELECT 1 FROM public.unchained_locales l
                     WHERE l.code = tr.locale AND l.active
                  )
          ) t
      ),
      '{}'::jsonb
    ) AS translations
  FROM public.unchained_projects p
  WHERE p.published
    AND p.archived_at IS NULL
  ORDER BY p.year DESC NULLS LAST, p.display_order ASC, p.slug ASC;
$fn$;

REVOKE ALL ON FUNCTION public.list_public_projects() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_public_projects() TO anon, authenticated;

DROP FUNCTION IF EXISTS public.list_public_insights();

CREATE FUNCTION public.list_public_insights()
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
  cover_image_alt TEXT,
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
    a.id, a.slug, a.title, a.description, a.lede, a.pillar, a.tags, a.author,
    a.sections,
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
                        AND o.slug <> a.slug
                   )
          ) r
      ),
      '{}'::text[]
    ) AS related_slugs,
    a.case_study_slug,
    a.cover_image, a.cover_image_alt, a.og_image,
    a.featured, a.published_on, a.revised_on,
    a.seo_title, a.seo_description, a.og_title, a.og_description,
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
                'cover_image_alt', tr.cover_image_alt,
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

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The bucket exists, is public, and accepts only images.
DO $blk$
DECLARE
  v_public BOOLEAN;
  v_limit  BIGINT;
  v_mimes  TEXT[];
BEGIN
  SELECT public, file_size_limit, allowed_mime_types
    INTO v_public, v_limit, v_mimes
    FROM storage.buckets WHERE id = 'unchained-cms-media';

  IF NOT FOUND THEN
    RAISE EXCEPTION '[fail] the unchained-cms-media bucket was not created';
  END IF;
  IF NOT v_public THEN
    RAISE EXCEPTION '[fail] the bucket is private — every share preview would 404';
  END IF;
  IF v_limit IS NULL OR v_limit > 10485760 THEN
    RAISE EXCEPTION '[fail] the bucket has no size cap, or a larger one than intended';
  END IF;
  IF v_mimes IS NULL OR 'application/pdf' = ANY(v_mimes) THEN
    RAISE EXCEPTION '[fail] the bucket accepts non-image uploads';
  END IF;

  RAISE NOTICE '[ok] bucket unchained-cms-media: public, % MB cap, % image types',
    v_limit / 1048576, array_length(v_mimes, 1);
END;
$blk$;

-- The image rule accepts what the site publishes today and refuses the rest.
-- Every string below is one somebody could paste into the panel.
DO $blk$
BEGIN
  IF NOT public.unchained_media_reference_ok('/work/tancerca.webp') THEN
    RAISE EXCEPTION '[fail] an existing site-relative image was rejected';
  END IF;
  IF NOT public.unchained_media_reference_ok(NULL) THEN
    RAISE EXCEPTION '[fail] null was rejected — every image column is optional';
  END IF;
  IF NOT public.unchained_media_reference_ok(
       'https://abcdefghijklm.supabase.co/storage/v1/object/public/unchained-cms-media/a/b.webp') THEN
    RAISE EXCEPTION '[fail] a library URL was rejected';
  END IF;
  IF public.unchained_media_reference_ok('https://example.com/x.png') THEN
    RAISE EXCEPTION '[fail] a third-party image host was accepted';
  END IF;
  IF public.unchained_media_reference_ok(
       'https://abcdefghijklm.supabase.co/storage/v1/object/public/product-images/x.png') THEN
    RAISE EXCEPTION '[fail] an image from another bucket was accepted';
  END IF;
  IF public.unchained_media_reference_ok('//evil.example/x.png') THEN
    RAISE EXCEPTION '[fail] a protocol-relative URL was accepted as a site path';
  END IF;
  IF public.unchained_media_reference_ok('/work/two words.png') THEN
    RAISE EXCEPTION '[fail] a path containing whitespace was accepted';
  END IF;
  RAISE NOTICE '[ok] image columns accept site paths and this bucket, and nothing else';
END;
$blk$;

-- The eight projects seeded in Phase 9 still satisfy the widened constraint.
-- If this fails, the rewrite in §3 was not a widening.
DO $blk$
DECLARE
  v_bad INTEGER;
BEGIN
  SELECT count(*) INTO v_bad
    FROM public.unchained_projects
   WHERE NOT public.unchained_media_reference_ok(thumbnail)
      OR NOT public.unchained_media_reference_ok(hero_image);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '[fail] % existing projects no longer satisfy the image rule', v_bad;
  END IF;
  RAISE NOTICE '[ok] every existing project image is still valid';
END;
$blk$;

-- The library refuses a row that misdescribes its file.
DO $blk$
DECLARE
  v_id UUID;
BEGIN
  BEGIN
    INSERT INTO public.unchained_media (storage_path, filename, mime_type, size_bytes)
    VALUES ('/leading-slash.png', 'x.png', 'image/png', 10);
    RAISE EXCEPTION '[fail] a storage path with a leading slash was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.unchained_media (storage_path, filename, mime_type, size_bytes)
    VALUES ('docs/report.pdf', 'report.pdf', 'application/pdf', 10);
    RAISE EXCEPTION '[fail] a non-image was accepted into the media library';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO public.unchained_media (storage_path, filename, mime_type, size_bytes, width)
    VALUES ('a/b.png', 'b.png', 'image/png', 10, 100);
    RAISE EXCEPTION '[fail] a width with no height was accepted';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  INSERT INTO public.unchained_media
    (storage_path, filename, mime_type, size_bytes, width, height, alt_text)
  VALUES ('zz-apply-probe/a.png', 'a.png', 'image/png', 1234, 800, 600, 'A probe.')
  RETURNING id INTO v_id;

  DELETE FROM public.unchained_media WHERE id = v_id;
  RAISE NOTICE '[ok] the media library validates what it records';
END;
$blk$;

-- anon can reach neither the library table nor the image predicate.
DO $blk$
BEGIN
  IF has_table_privilege('anon', 'public.unchained_media', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on unchained_media';
  END IF;
  IF has_function_privilege('anon', 'public.unchained_media_reference_ok(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can call unchained_media_reference_ok()';
  END IF;
  RAISE NOTICE '[ok] anon cannot enumerate the media library';
END;
$blk$;

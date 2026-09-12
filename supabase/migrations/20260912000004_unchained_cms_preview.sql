-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business CMS: preview
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260912000001_unchained_cms_core.sql     unchained_manages_content(), locales
--   20260912000002_unchained_cms_insights.sql unchained_insights
--   20260912000003_unchained_cms_media.sql    the alt-text columns
--
-- Creates:
--     unchained_preview_tokens         one row per link handed out
--     issue_preview_token()            mints one, returns it ONCE
--     revoke_preview_token()           ends one early
--     preview_project()                a draft project, by token
--     preview_insight()                a draft article, by token
--     purge_expired_preview_tokens()   housekeeping
--
-- ─── The problem ──────────────────────────────────────────────────────────
-- An editor needs to see a draft as the website will render it, before it is
-- published. The website's public functions filter on `published` — that is
-- their entire security model — so preview cannot go through them.
--
-- The brief sets four conditions: an administrator can preview unpublished
-- content; drafts never appear on the normal public route; drafts are never
-- indexable; and the URL is never publicly guessable.
--
-- ─── The design, and the three things it refuses to do ────────────────────
-- A manager mints a token for ONE content item. The token is a URL parameter
-- the website passes back to preview_project() / preview_insight(), which
-- return that item and nothing else.
--
-- What this deliberately is NOT:
--
--   · NOT a "preview mode" cookie that unlocks drafts site-wide. Next's draft
--     mode works that way, and one leaked cookie would then expose every
--     unpublished project and article at once. A token here names one row.
--   · NOT a guessable URL. /work/<slug>?preview=1 is the common shortcut and
--     it is exactly what the brief forbids: the slug is the one part of a
--     draft that is easy to guess.
--   · NOT a shared secret in the panel's bundle. The Vite SPA cannot hold a
--     secret — every VITE_ variable is inlined into a file the browser
--     downloads. The token is minted by the DATABASE, per item, on request.
--
-- ─── Why the token is stored as a hash ────────────────────────────────────
-- The table is readable by every content manager, and a database backup is a
-- file that gets copied around. Storing the token itself would make both of
-- those a set of working preview links for every draft in the system.
--
-- So the row holds sha256(token) and the token exists in plaintext exactly
-- once: in the value issue_preview_token() returns to the person who asked for
-- it. Losing it means minting another, which costs nothing. This is the same
-- reasoning applied to a password, for the same reason — the table should not
-- be a credential store.
--
-- ─── Where the entropy comes from ─────────────────────────────────────────
-- Two gen_random_uuid() values, hex-joined: 122 bits of cryptographic
-- randomness each, 244 together. pgcrypto's gen_random_bytes() would be the
-- more direct expression, but it lives in the `extensions` schema on Supabase
-- and every function here pins `search_path = ''` — so using it would mean
-- hard-coding a schema that is a deployment detail. gen_random_uuid() is in
-- core Postgres and needs no such assumption.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Paste into the Studio SQL editor. Safe to run twice.

-- ─── 1. The table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unchained_preview_tokens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- sha256 of the token, never the token. UNIQUE so a lookup is an index hit
  -- and two rows cannot claim one link.
  token_hash    BYTEA NOT NULL UNIQUE,

  -- Which content type the id refers to. Not a foreign key — it cannot be,
  -- pointing at two tables — so the two lookup functions each filter on this
  -- column before touching their own table. A project token handed to
  -- preview_insight() matches nothing.
  content_type  TEXT NOT NULL,
  content_id    UUID NOT NULL,

  -- Preview one translation rather than the default locale. NULL means "as the
  -- site renders it for a visitor with no preference", which is the default
  -- locale. A code that is not in the registry cannot be stored.
  locale        TEXT REFERENCES public.unchained_locales(code) ON UPDATE CASCADE,

  -- A note to the editor about what this link was for: "for Ana, Thursday
  -- review". Optional and never shown to a visitor.
  label         TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  -- Every token expires. There is no "never" option: a preview link is for a
  -- review that happens this week, and a permanent one is an unpublished page
  -- with a permanent public address.
  expires_at    TIMESTAMPTZ NOT NULL,
  revoked_at    TIMESTAMPTZ,

  -- Usage, for the panel to show. Not a security control — it is how an editor
  -- notices that a link they thought was private has been opened forty times.
  last_used_at  TIMESTAMPTZ,
  use_count     INTEGER NOT NULL DEFAULT 0,

  CONSTRAINT unchained_preview_tokens_content_type_known
    CHECK (content_type IN ('project', 'insight')),
  CONSTRAINT unchained_preview_tokens_label_length
    CHECK (label IS NULL OR length(btrim(label)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_preview_tokens_expires_after_created
    CHECK (expires_at > created_at),
  -- Thirty days. Long enough for a client review cycle, short enough that a
  -- forgotten link stops working inside a month.
  CONSTRAINT unchained_preview_tokens_ttl_bounded
    CHECK (expires_at <= created_at + INTERVAL '30 days'),
  CONSTRAINT unchained_preview_tokens_use_count_sane
    CHECK (use_count >= 0)
);

-- The lookup path: by hash, filtered to the live ones. Partial on `revoked_at`
-- so revoked rows — which are kept as a record — do not grow the index the
-- website hits on every preview render.
CREATE INDEX IF NOT EXISTS idx_unchained_preview_tokens_live
  ON public.unchained_preview_tokens (token_hash)
  WHERE revoked_at IS NULL;

-- The panel's question: "what links are out for this project?"
CREATE INDEX IF NOT EXISTS idx_unchained_preview_tokens_content
  ON public.unchained_preview_tokens (content_type, content_id, created_at DESC);

ALTER TABLE public.unchained_preview_tokens ENABLE ROW LEVEL SECURITY;

-- Read AND write are both restricted to content managers — narrower than every
-- other CMS table, whose SELECT is open to the whole module.
--
-- The reason is that this table is the closest thing in the schema to a list of
-- credentials. It holds no usable token, but it does say which drafts have live
-- links and who minted them, and a commercial who can see every lead has no
-- reason to see that.
DROP POLICY IF EXISTS unchained_preview_tokens_manage ON public.unchained_preview_tokens;
CREATE POLICY unchained_preview_tokens_manage ON public.unchained_preview_tokens
  FOR ALL
  USING (public.unchained_manages_content())
  WITH CHECK (public.unchained_manages_content());

REVOKE ALL ON TABLE public.unchained_preview_tokens FROM anon, authenticated;
-- No INSERT: a token is minted by issue_preview_token(), which is the only
-- thing that knows to hash it. A client-inserted row would either store a
-- plaintext token or store a hash whose input the client chose.
GRANT SELECT, UPDATE ON TABLE public.unchained_preview_tokens TO authenticated;

-- ─── 2. Minting ───────────────────────────────────────────────────────────
-- Returns the token in plaintext, once. The caller must be a content manager;
-- the check is inside the function because it is SECURITY DEFINER and RLS does
-- not apply to its own inserts.

CREATE OR REPLACE FUNCTION public.issue_preview_token(
  p_content_type TEXT,
  p_content_id   UUID,
  p_locale       TEXT DEFAULT NULL,
  p_hours        INTEGER DEFAULT 168,
  p_label        TEXT DEFAULT NULL
)
RETURNS TABLE (token TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
DECLARE
  v_token   TEXT;
  v_expires TIMESTAMPTZ;
  v_exists  BOOLEAN;
BEGIN
  IF NOT public.unchained_manages_content() THEN
    RAISE EXCEPTION 'not authorized to issue preview links'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_content_type NOT IN ('project', 'insight') THEN
    RAISE EXCEPTION 'unknown content type: %', p_content_type
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- The content has to exist. Without this an editor could mint a link for a
  -- mistyped id, hand it out, and discover it is dead only when somebody opens
  -- it — by which time the review slot is gone.
  IF p_content_type = 'project' THEN
    SELECT EXISTS (SELECT 1 FROM public.unchained_projects WHERE id = p_content_id)
      INTO v_exists;
  ELSE
    SELECT EXISTS (SELECT 1 FROM public.unchained_insights WHERE id = p_content_id)
      INTO v_exists;
  END IF;

  IF NOT v_exists THEN
    RAISE EXCEPTION 'no % with id %', p_content_type, p_content_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- One hour to thirty days. Clamped rather than rejected: the caller is the
  -- panel, and a slider that silently refuses is worse than one that stops at
  -- its own ends. The CHECK on the table is the wall behind this.
  v_expires := now() + make_interval(hours => GREATEST(1, LEAST(COALESCE(p_hours, 168), 720)));

  -- 64 hex characters. `replace(uuid::text, '-', '')` is 32 hex digits of
  -- which 122 bits are random; two of them is more entropy than the sha256
  -- below can distinguish, which is the intended margin.
  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  INSERT INTO public.unchained_preview_tokens
    (token_hash, content_type, content_id, locale, label, created_by, expires_at)
  VALUES
    (sha256(convert_to(v_token, 'UTF8')), p_content_type, p_content_id,
     p_locale, nullif(btrim(p_label), ''), (SELECT auth.uid()), v_expires);

  RETURN QUERY SELECT v_token, v_expires;
END;
$fn$;

REVOKE ALL ON FUNCTION public.issue_preview_token(TEXT, UUID, TEXT, INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.issue_preview_token(TEXT, UUID, TEXT, INTEGER, TEXT)
  TO authenticated;

-- ─── 3. Revoking ──────────────────────────────────────────────────────────
-- The row is kept. "This link was issued on Tuesday and killed on Wednesday"
-- is a record worth having, and deleting it would leave no trace that the link
-- ever existed.

CREATE OR REPLACE FUNCTION public.revoke_preview_token(p_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT public.unchained_manages_content() THEN
    RAISE EXCEPTION 'not authorized to revoke preview links'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.unchained_preview_tokens
     SET revoked_at = now()
   WHERE id = p_id
     AND revoked_at IS NULL;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$fn$;

REVOKE ALL ON FUNCTION public.revoke_preview_token(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.revoke_preview_token(UUID) TO authenticated;

-- ─── 4. Redeeming a token ─────────────────────────────────────────────────
-- Shared by both lookup functions: validate, stamp the usage, return the id.
--
-- ─── Why the comparison is on the HASH and not the token ──────────────────
-- The caller supplies a token; this hashes it and looks up by hash. There is
-- no path that compares plaintext, so there is no path that could leak one
-- through a timing difference on a string compare, and the index does the work.
--
-- Returns NULL for every failure — unknown, expired, revoked, wrong type. One
-- outcome, deliberately: distinguishing "expired" from "never existed" would
-- confirm to an anonymous caller that a token was once real.

CREATE OR REPLACE FUNCTION public.unchained_redeem_preview_token(
  p_token        TEXT,
  p_content_type TEXT
)
RETURNS TABLE (content_id UUID, locale TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
DECLARE
  v_id      UUID;
  v_content UUID;
  v_locale  TEXT;
BEGIN
  -- A token is 64 hex characters. Anything else cannot match a stored hash, so
  -- rejecting it here avoids hashing arbitrary caller-supplied input.
  IF p_token IS NULL OR p_token !~ '^[0-9a-f]{64}$' THEN
    RETURN;
  END IF;

  SELECT t.id, t.content_id, t.locale
    INTO v_id, v_content, v_locale
    FROM public.unchained_preview_tokens t
   WHERE t.token_hash   = sha256(convert_to(p_token, 'UTF8'))
     AND t.content_type = p_content_type
     AND t.revoked_at IS NULL
     AND t.expires_at > now()
   LIMIT 1;

  IF v_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.unchained_preview_tokens
     SET last_used_at = now(),
         use_count    = use_count + 1
   WHERE id = v_id;

  RETURN QUERY SELECT v_content, v_locale;
END;
$fn$;

-- Internal. The two public entry points below are SECURITY DEFINER and call it
-- as their owner, so no caller ever needs this grant.
REVOKE ALL ON FUNCTION public.unchained_redeem_preview_token(TEXT, TEXT)
  FROM PUBLIC, anon, authenticated;

-- ─── 5. The preview surfaces ──────────────────────────────────────────────
-- One row, or none. Granted to anon, because the website renders the preview
-- page server-side with the anon key exactly as it renders every other page —
-- the token is the credential, not the key.
--
-- ─── What these return that the public functions do not ───────────────────
-- Drafts, and the publication state so the preview banner can say what it is
-- looking at. What they still do NOT return is administrative metadata:
-- created_by, updated_by, display_order and the token's own row are all
-- absent. A preview link exposes the CONTENT of one draft and nothing about
-- who wrote it or what else exists.
--
-- ─── Translations are unfiltered here, on purpose ─────────────────────────
-- The public function returns only PUBLISHED translations. Preview returns all
-- of them: the point of previewing is to see the German copy before it is
-- published, and a preview that hid it would be useless for the one job it
-- exists to do. The token scopes that exposure to a single item.

CREATE OR REPLACE FUNCTION public.preview_project(p_token TEXT)
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
  published        BOOLEAN,
  archived         BOOLEAN,
  preview_locale   TEXT,
  translations     JSONB
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
  WITH redeemed AS (
    SELECT r.content_id, r.locale
      FROM public.unchained_redeem_preview_token(p_token, 'project') r
  )
  SELECT
    p.id, p.slug, p.title, p.description, p.category, p.status,
    p.featured, p.detailed, p.year, p.industry,
    p.services, p.technologies, p.capabilities,
    p.thumbnail, p.thumbnail_width, p.thumbnail_height, p.thumbnail_alt,
    p.hero_image, p.hero_image_alt,
    p.summary, p.challenge, p.solution, p.outcome, p.external_url,
    p.seo_title, p.seo_description, p.og_title, p.og_description,
    p.og_image, p.canonical_url,
    p.published,
    p.archived_at IS NOT NULL AS archived,
    redeemed.locale AS preview_locale,
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
          ) t
      ),
      '{}'::jsonb
    ) AS translations
  FROM redeemed
  JOIN public.unchained_projects p ON p.id = redeemed.content_id;
$fn$;

REVOKE ALL ON FUNCTION public.preview_project(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_project(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_insight(p_token TEXT)
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
  published       BOOLEAN,
  archived        BOOLEAN,
  preview_locale  TEXT,
  translations    JSONB
)
LANGUAGE sql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
  WITH redeemed AS (
    SELECT r.content_id, r.locale
      FROM public.unchained_redeem_preview_token(p_token, 'insight') r
  )
  SELECT
    a.id, a.slug, a.title, a.description, a.lede, a.pillar, a.tags, a.author,
    a.sections,
    -- Unlike the public function, related slugs are NOT filtered to published
    -- articles: an editor previewing a set of drafts that reference each other
    -- needs to see the links they wrote. The preview route renders them as
    -- preview-scoped links or as plain text, never as public URLs.
    a.related_slugs,
    a.case_study_slug,
    a.cover_image, a.cover_image_alt, a.og_image,
    a.featured, a.published_on, a.revised_on,
    a.seo_title, a.seo_description, a.og_title, a.og_description,
    a.canonical_url,
    a.published,
    a.archived_at IS NOT NULL AS archived,
    redeemed.locale AS preview_locale,
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
          ) t
      ),
      '{}'::jsonb
    ) AS translations
  FROM redeemed
  JOIN public.unchained_insights a ON a.id = redeemed.content_id;
$fn$;

REVOKE ALL ON FUNCTION public.preview_insight(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_insight(TEXT) TO anon, authenticated;

-- ─── 6. Housekeeping ──────────────────────────────────────────────────────
-- Expired tokens are already dead — every lookup filters on expires_at — so
-- this is hygiene rather than security. Kept for a grace period so the panel
-- can still show "this link expired on Friday" rather than forgetting it
-- existed the moment it lapsed.
--
-- Not scheduled. There is no cron in this project and a table that gains a few
-- rows a week does not need one; it is here so the cleanup is a call rather
-- than a hand-written DELETE against production.

CREATE OR REPLACE FUNCTION public.purge_expired_preview_tokens(p_grace_days INTEGER DEFAULT 90)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
VOLATILE
SET search_path = ''
AS $fn$
DECLARE
  v_rows INTEGER;
BEGIN
  IF NOT public.unchained_manages_content() THEN
    RAISE EXCEPTION 'not authorized'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  DELETE FROM public.unchained_preview_tokens
   WHERE expires_at < now() - make_interval(days => GREATEST(1, COALESCE(p_grace_days, 90)));

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows;
END;
$fn$;

REVOKE ALL ON FUNCTION public.purge_expired_preview_tokens(INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.purge_expired_preview_tokens(INTEGER) TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════

-- The whole lifecycle, on a real draft: mint, redeem, see the draft, revoke,
-- see nothing. This is the security property the module exists for, so it is
-- executed rather than asserted.
--
-- Note what this also proves: the draft is returned by preview_project() and
-- is NOT returned by list_public_projects(), at the same moment, for the same
-- row.
DO $blk$
DECLARE
  v_project UUID;
  v_token   TEXT;
  v_id      UUID;
  v_rows    INTEGER;
  v_hash    BYTEA;
BEGIN
  -- ─── Why this probe is conditional ──────────────────────────────────────
  -- Everything below calls issue_preview_token(), which refuses a caller who
  -- is not a content manager. That refusal is the module's whole point and is
  -- not being relaxed.
  --
  -- But this file is APPLIED by pasting it into the Studio SQL editor, and
  -- that session has no JWT: auth.uid() is NULL, so unchained_manages_content()
  -- is correctly false and the probe cannot run. Asserting anyway made the
  -- migration fail on its own security check, which is a false alarm of the
  -- worst kind — it looks exactly like a real authorization defect.
  --
  -- So the probe runs when there IS an authenticated manager and says plainly
  -- that it did not otherwise. 20260912000005 makes the same accommodation for
  -- the same reason.
  IF NOT public.unchained_manages_content() THEN
    RAISE NOTICE '[skip] preview lifecycle — this session has no authenticated content manager (auth.uid() is NULL in the SQL editor). The grant assertions below still run.';
  ELSE
    INSERT INTO public.unchained_projects (slug, title, description, category, published)
    VALUES ('zz-preview-probe', 'Preview probe',
            'Temporary draft created by a migration assertion.', 'Probe', FALSE)
    RETURNING id INTO v_project;

    SELECT token INTO v_token
      FROM public.issue_preview_token('project', v_project, NULL, 1, 'apply-time probe');

    IF v_token !~ '^[0-9a-f]{64}$' THEN
      RAISE EXCEPTION '[fail] the minted token is not 64 hex characters: %', v_token;
    END IF;

    -- The plaintext must not be in the table.
    SELECT token_hash INTO v_hash
      FROM public.unchained_preview_tokens
     WHERE content_id = v_project;
    IF v_hash IS DISTINCT FROM sha256(convert_to(v_token, 'UTF8')) THEN
      RAISE EXCEPTION '[fail] the stored hash is not sha256 of the issued token';
    END IF;
    IF EXISTS (
          SELECT 1 FROM public.unchained_preview_tokens
           WHERE content_id = v_project
             AND encode(token_hash, 'hex') = v_token
        ) THEN
      RAISE EXCEPTION '[fail] the token was stored in plaintext';
    END IF;

    -- The draft is invisible publicly and visible through the token.
    IF EXISTS (SELECT 1 FROM public.list_public_projects() WHERE slug = 'zz-preview-probe') THEN
      RAISE EXCEPTION '[fail] a draft reached the public function';
    END IF;

    SELECT p.id INTO v_id FROM public.preview_project(v_token) p;
    IF v_id IS DISTINCT FROM v_project THEN
      RAISE EXCEPTION '[fail] a valid token did not return its draft';
    END IF;

    -- Wrong content type, garbage, and a well-formed token that was never issued
    -- all return nothing rather than erroring.
    IF EXISTS (SELECT 1 FROM public.preview_insight(v_token)) THEN
      RAISE EXCEPTION '[fail] a project token opened an article';
    END IF;
    IF EXISTS (SELECT 1 FROM public.preview_project('not-a-token')) THEN
      RAISE EXCEPTION '[fail] a malformed token was accepted';
    END IF;
    IF EXISTS (SELECT 1 FROM public.preview_project(repeat('a', 64))) THEN
      RAISE EXCEPTION '[fail] a token that was never issued was accepted';
    END IF;

    -- Usage is recorded.
    SELECT use_count INTO v_rows
      FROM public.unchained_preview_tokens WHERE content_id = v_project;
    IF v_rows < 1 THEN
      RAISE EXCEPTION '[fail] redeeming a token did not record a use';
    END IF;

    -- Revoking kills it immediately.
    PERFORM public.revoke_preview_token(id)
       FROM public.unchained_preview_tokens WHERE content_id = v_project;

    IF EXISTS (SELECT 1 FROM public.preview_project(v_token)) THEN
      RAISE EXCEPTION '[fail] a revoked token still opened the draft';
    END IF;

    -- An expired token is equally dead. Written directly rather than waiting an
    -- hour; the CHECK allows any expiry inside thirty days of creation.
    UPDATE public.unchained_preview_tokens
       SET revoked_at = NULL, expires_at = created_at + INTERVAL '1 second'
     WHERE content_id = v_project;

    IF EXISTS (SELECT 1 FROM public.preview_project(v_token)) THEN
      RAISE EXCEPTION '[fail] an expired token still opened the draft';
    END IF;

    DELETE FROM public.unchained_preview_tokens WHERE content_id = v_project;
    DELETE FROM public.unchained_projects WHERE id = v_project;

    RAISE NOTICE '[ok] preview: minted, hashed, redeemed, revoked, expired';
  END IF;
END;
$blk$;

-- The grants are the shape the design requires: anon may redeem a token and
-- may do nothing else.
DO $blk$
BEGIN
  IF NOT has_function_privilege('anon', 'public.preview_project(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] the website cannot render a preview';
  END IF;
  IF NOT has_function_privilege('anon', 'public.preview_insight(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] the website cannot render an article preview';
  END IF;
  IF has_function_privilege('anon', 'public.issue_preview_token(text,uuid,text,integer,text)',
                            'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can mint preview tokens';
  END IF;
  IF has_function_privilege('anon', 'public.unchained_redeem_preview_token(text,text)',
                            'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon can call the internal redeem helper';
  END IF;
  IF has_table_privilege('anon', 'public.unchained_preview_tokens', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon holds SELECT on the token table';
  END IF;
  IF has_table_privilege('authenticated', 'public.unchained_preview_tokens', 'INSERT') THEN
    RAISE EXCEPTION '[fail] a token row can be inserted without being hashed';
  END IF;
  RAISE NOTICE '[ok] preview grants: redeem public, mint managed, table closed';
END;
$blk$;

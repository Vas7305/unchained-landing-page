-- ════════════════════════════════════════════════════════════
-- Phase 9 — Unchained Business settings: the business profile
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   is_super_admin(), has_product_access()
--   20260905000004_unchained_leads.sql        unchained_manages_leads()
--
-- Creates:
--     unchained_settings                 the module's own configuration, one row
--     unchained_settings_touch()         updated_at + updated_by, written by the server
--
-- ─── What this is for ─────────────────────────────────────────────────────
-- /unchained/settings has, until now, had nothing on it that could be
-- changed. That was correct while it was true — the screen's own rule is that
-- "a setting is added when the feature it configures exists", and adding
-- switches ahead of the features they configure produces controls that change
-- nothing. This adds the first one with an actual subject: the business's own
-- identity, which the modules already need a place to read and which is
-- currently spelled out in whichever component happens to display it.
--
-- Everything else that screen listed as still to come is either already
-- configurable somewhere else — contact routing on public.routing_rules,
-- regional settings on public.commercial_regions, commission rates through
-- unchained_set_commission_rate() — or has no feature behind it yet. This file
-- does not invent those. It adds the one thing that had no home.
--
-- ─── Why one row of typed columns, and not a key/value table ──────────────
-- TanCerca's system_settings stores one row per setting, and its reason is
-- sound for what it holds: two administrators editing unrelated toggles in
-- different sections must not clobber each other through read-modify-write.
--
-- That argument does not reach this table. A business profile is not a set of
-- unrelated toggles — it is ONE record, shown in one form, saved as a whole,
-- and two people editing the company's own name and address at the same
-- moment is a conflict whichever way it is stored. What typed columns buy in
-- exchange is the thing this schema relies on everywhere else: contact_email
-- is checked to look like an address BY THE DATABASE, website_url is checked
-- to carry a scheme, and every length limit is a constraint rather than a hope
-- expressed in a form component. A JSONB value column cannot express any of
-- that, and the alternative is re-validating in each place that writes.
--
-- ─── Why the row is seeded here ───────────────────────────────────────────
-- Exactly one row exists from the moment this file is applied, so no reader
-- ever has to tell "the business profile has not been filled in" apart from
-- "the read failed" — the first is a row of NULLs, the second is an error, and
-- collapsing them is how a screen ends up reporting an outage as an empty
-- form. The singleton is enforced by the primary key plus a CHECK, so a second
-- row is rejected by the database rather than prevented by convention.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`, which would replay history against
-- live production. Every object uses IF NOT EXISTS, CREATE OR REPLACE or
-- DROP-then-CREATE on its own name, so it is safe to run twice.

-- ─── 1. The table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.unchained_settings (
  -- One row, by construction. The PK makes a duplicate 'default' impossible
  -- and the CHECK makes any OTHER id impossible, so the two together admit
  -- exactly one row without a trigger to count them.
  id              TEXT PRIMARY KEY DEFAULT 'default',

  -- ── Who the business is ───────────────────────────────────────────────
  -- The trading name, and the only field that is NOT NULL: something has to
  -- be shown wherever the module names itself, and an empty heading is worse
  -- than a stale one.
  business_name   TEXT NOT NULL DEFAULT 'Unchained Business',
  -- The registered entity, when it differs from the trading name. Nullable
  -- because most of the module has no use for it, and a required field nobody
  -- can answer gets filled with a placeholder.
  legal_name      TEXT,
  tax_id          TEXT,

  -- ── How to reach it ───────────────────────────────────────────────────
  contact_email   TEXT,
  contact_phone   TEXT,
  website_url     TEXT,
  postal_address  TEXT,

  -- ── Provenance ────────────────────────────────────────────────────────
  -- Both written by the trigger below and by nothing else. updated_by is
  -- taken from auth.uid() server-side rather than accepted from the client,
  -- because a client-supplied "who changed this" is a claim, not a record.
  -- ON DELETE SET NULL: the change still happened after the account is gone.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  CONSTRAINT unchained_settings_singleton
    CHECK (id = 'default'),

  CONSTRAINT unchained_settings_business_name_present
    CHECK (length(btrim(business_name)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_settings_legal_name_length
    CHECK (legal_name IS NULL OR length(btrim(legal_name)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_settings_tax_id_length
    CHECK (tax_id IS NULL OR length(btrim(tax_id)) BETWEEN 1 AND 40),

  -- The same permissive rule as commercial_contacts_email_format and
  -- unchained_specialists_email_format: reject "not an address at all", not
  -- "not RFC 5322". A stricter pattern here would reject real addresses, and
  -- the authoritative test of an address is whether mail to it arrives.
  CONSTRAINT unchained_settings_contact_email_format
    CHECK (contact_email IS NULL OR (length(contact_email) <= 200
       AND contact_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),

  CONSTRAINT unchained_settings_contact_phone_length
    CHECK (contact_phone IS NULL OR length(btrim(contact_phone)) BETWEEN 1 AND 40),

  -- A scheme is required, and only the two a browser can follow. A bare
  -- "unchained.com" saved here becomes a relative link the moment anything
  -- renders it as an href, which lands the visitor on a page that does not
  -- exist rather than on the website.
  CONSTRAINT unchained_settings_website_url_format
    CHECK (website_url IS NULL OR (length(website_url) <= 300
       AND website_url ~ '^https?://[^[:space:]]+$')),

  CONSTRAINT unchained_settings_postal_address_length
    CHECK (postal_address IS NULL OR length(btrim(postal_address)) BETWEEN 1 AND 500)
);

-- ─── 2. updated_at and updated_by, written by the server ──────────────────
-- Its own function rather than the module's unchained_touch_updated_at(),
-- which sets the timestamp only. Both columns are provenance and both must be
-- unforgeable, so they are written in the same place: a caller that could set
-- updated_by could attribute its own edit to somebody else.
--
-- id and created_at are pinned to their previous values for the same reason.
-- The CHECK constraint would refuse any other id, but an UPDATE that rewrote
-- created_at would pass every constraint in §1 and quietly destroy the only
-- record of when the profile was established.
--
-- SECURITY INVOKER is right here — auth.uid() reads the request's JWT and does
-- not depend on who owns the function — but search_path is still pinned empty,
-- as every function in this schema is.

CREATE OR REPLACE FUNCTION public.unchained_settings_touch()
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

DROP TRIGGER IF EXISTS trg_unchained_settings_touch ON public.unchained_settings;
CREATE TRIGGER trg_unchained_settings_touch
  BEFORE UPDATE ON public.unchained_settings
  FOR EACH ROW EXECUTE FUNCTION public.unchained_settings_touch();

-- ─── 3. The row ───────────────────────────────────────────────────────────
-- ON CONFLICT DO NOTHING, not an UPSERT: applying this file twice must not
-- reset a profile somebody has already filled in. Every column but the name
-- starts NULL — "not answered yet", which the form shows as an empty field and
-- which is honest, rather than a placeholder that reads as an answer.

INSERT INTO public.unchained_settings (id)
VALUES ('default')
ON CONFLICT (id) DO NOTHING;

-- ─── 4. Row level security ────────────────────────────────────────────────
-- Read: anybody with access to the module. A commercial writing to a client
-- needs the company's own phone number and address as much as a manager does,
-- and there is nothing in this row that one member of the module should be
-- kept from seeing — no pay, no personal data, no lead.
--
-- Write: managers, via unchained_manages_leads(). NOT is_super_admin(), and
-- that is a deliberate difference from commission rates. The super-admin
-- carve-out on pay exists because pay is what people are owed and a manager
-- must not be able to change their own share. A postal address is
-- administration; holding it at the same level would mean the one person who
-- can also change payroll is the only one who can correct a phone number.
--
-- DELETE is granted to nobody at all — see §5. The row IS the configuration;
-- there is no state in which the module is better off without it.

ALTER TABLE public.unchained_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_settings_read ON public.unchained_settings;
CREATE POLICY unchained_settings_read ON public.unchained_settings
  FOR SELECT
  USING (public.has_product_access('unchained'));

DROP POLICY IF EXISTS unchained_settings_update ON public.unchained_settings;
CREATE POLICY unchained_settings_update ON public.unchained_settings
  FOR UPDATE
  USING (public.unchained_manages_leads())
  WITH CHECK (public.unchained_manages_leads());

-- ─── 5. Table privileges ──────────────────────────────────────────────────
-- Belt and braces over RLS, as every earlier phase did it.
--
-- Note what is NOT granted: INSERT and DELETE, to anybody. The singleton row
-- is created by this migration and is not the application's to add or remove.
-- The CHECK constraint already makes a second row impossible; withholding the
-- privilege means a client cannot even attempt it, and cannot delete the one
-- row and leave every screen reading an empty table.
--
-- ─── The REVOKE names authenticated, and it has to ────────────────────────
-- Earlier phases revoked from anon alone, because they went on to grant
-- authenticated the full set anyway. This one grants a SUBSET, and a subset
-- cannot be expressed by granting: Supabase ships
--   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO
--     anon, authenticated, service_role;
-- so `authenticated` already holds INSERT and DELETE on this table from the
-- moment CREATE TABLE runs. Granting SELECT and UPDATE would add nothing and
-- take nothing away. The REVOKE is what actually withholds them, and the
-- assertion at the bottom of this file is what proves it landed.
--
-- service_role is deliberately left alone: it bypasses RLS by design and is
-- how an edge function or a migration would ever need to reset this row.

REVOKE ALL ON TABLE public.unchained_settings FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.unchained_settings TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Apply-time assertions
-- ═══════════════════════════════════════════════════════════════════════════
-- These run when the file is applied and abort it if the schema does not
-- behave as the commentary above claims. A migration that says a thing and
-- does not do it is worse than one that says nothing.

-- The singleton is enforced by the database, not by the application.
DO $blk$
BEGIN
  BEGIN
    INSERT INTO public.unchained_settings (id) VALUES ('second');
    RAISE EXCEPTION '[fail] a second settings row was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] a row with any id but the singleton key is refused';
  END;

  BEGIN
    INSERT INTO public.unchained_settings (id) VALUES ('default');
    RAISE EXCEPTION '[fail] a duplicate singleton row was accepted';
  EXCEPTION
    WHEN unique_violation THEN
      RAISE NOTICE '[ok] a duplicate singleton row is refused';
  END;

  IF (SELECT count(*) FROM public.unchained_settings) <> 1 THEN
    RAISE EXCEPTION '[fail] there must be exactly one settings row, found %',
      (SELECT count(*) FROM public.unchained_settings);
  END IF;
  RAISE NOTICE '[ok] exactly one settings row exists';
END;
$blk$;

-- The format checks are real, and reject the three mistakes that actually get
-- typed into these fields: an address that is not one, a bare hostname, and a
-- name cleared to whitespace.
DO $blk$
BEGIN
  BEGIN
    UPDATE public.unchained_settings SET contact_email = 'not an address'
     WHERE id = 'default';
    RAISE EXCEPTION '[fail] a malformed contact_email was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] contact_email must look like an address';
  END;

  BEGIN
    UPDATE public.unchained_settings SET website_url = 'unchained.com'
     WHERE id = 'default';
    RAISE EXCEPTION '[fail] a website_url without a scheme was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] website_url must carry http:// or https://';
  END;

  BEGIN
    UPDATE public.unchained_settings SET business_name = '   ' WHERE id = 'default';
    RAISE EXCEPTION '[fail] a blank business_name was accepted';
  EXCEPTION
    WHEN check_violation THEN
      RAISE NOTICE '[ok] business_name cannot be blanked';
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
    FROM public.unchained_settings WHERE id = 'default';

  UPDATE public.unchained_settings
     SET legal_name = '[migration self-test]',
         updated_at = 'epoch'::TIMESTAMPTZ,
         updated_by = '00000000-0000-0000-0000-000000000001'::UUID,
         created_at = 'epoch'::TIMESTAMPTZ
   WHERE id = 'default';

  SELECT updated_at, updated_by INTO v_after, v_by
    FROM public.unchained_settings WHERE id = 'default';

  IF v_after = 'epoch'::TIMESTAMPTZ OR v_after < v_before THEN
    RAISE EXCEPTION '[fail] the trigger did not overwrite updated_at (got %)', v_after;
  END IF;
  IF v_by IS NOT DISTINCT FROM '00000000-0000-0000-0000-000000000001'::UUID THEN
    RAISE EXCEPTION '[fail] a client-supplied updated_by was kept';
  END IF;
  IF (SELECT created_at FROM public.unchained_settings WHERE id = 'default') <> v_created THEN
    RAISE EXCEPTION '[fail] created_at was rewritten by an UPDATE';
  END IF;

  -- Leave nothing behind. This is the file's own test row, not a profile.
  UPDATE public.unchained_settings SET legal_name = NULL WHERE id = 'default';

  RAISE NOTICE '[ok] updated_at and updated_by are written by the server, not the caller';
END;
$blk$;

-- Nothing here may be reachable by the website's anon key. Supabase's ALTER
-- DEFAULT PRIVILEGES grants to anon explicitly, so this checks that the REVOKE
-- above landed — not merely that nothing granted anon by accident.
DO $blk$
DECLARE
  v_priv TEXT;
BEGIN
  FOREACH v_priv IN ARRAY ARRAY['SELECT', 'INSERT', 'UPDATE', 'DELETE'] LOOP
    IF has_table_privilege('anon', 'public.unchained_settings', v_priv) THEN
      RAISE EXCEPTION '[fail] anon can still % public.unchained_settings', v_priv;
    END IF;
  END LOOP;
  RAISE NOTICE '[ok] public.unchained_settings — not reachable by anon';

  -- authenticated reads and updates. It must not be able to add or remove the
  -- singleton row; RLS would allow neither, but the privilege is the outer wall.
  IF NOT has_table_privilege('authenticated', 'public.unchained_settings', 'SELECT')
     OR NOT has_table_privilege('authenticated', 'public.unchained_settings', 'UPDATE') THEN
    RAISE EXCEPTION '[fail] authenticated must be able to read and update the settings row';
  END IF;
  IF has_table_privilege('authenticated', 'public.unchained_settings', 'INSERT')
     OR has_table_privilege('authenticated', 'public.unchained_settings', 'DELETE') THEN
    RAISE EXCEPTION '[fail] authenticated must not be able to insert or delete settings rows';
  END IF;
  RAISE NOTICE '[ok] authenticated may read and update, but not insert or delete';
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
   WHERE n.nspname = 'public' AND c.relname = 'unchained_settings';

  IF NOT COALESCE(v_enabled, FALSE) THEN
    RAISE EXCEPTION '[fail] row level security is not enabled on public.unchained_settings';
  END IF;

  SELECT count(*) INTO v_count FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'unchained_settings'
     AND policyname IN ('unchained_settings_read', 'unchained_settings_update');

  IF v_count <> 2 THEN
    RAISE EXCEPTION '[fail] expected both settings policies, found %', v_count;
  END IF;
  RAISE NOTICE '[ok] RLS enabled, read and update policies in place';
END;
$blk$;

-- The touch function is pinned to an empty search_path, like every other
-- function in this schema.
DO $blk$
DECLARE
  v_cfg   TEXT[];
  v_entry TEXT;
BEGIN
  SELECT p.proconfig INTO v_cfg
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'unchained_settings_touch';

  SELECT c INTO v_entry FROM unnest(COALESCE(v_cfg, ARRAY[]::TEXT[])) c
   WHERE c LIKE 'search_path=%';

  IF v_entry IS NULL THEN
    RAISE EXCEPTION '[fail] public.unchained_settings_touch() does not pin search_path';
  END IF;
  -- 'search_path=' is 12 characters, so the value starts at 13.
  IF btrim(substr(v_entry, 13), '"''') <> '' THEN
    RAISE EXCEPTION '[fail] public.unchained_settings_touch() must pin search_path empty (found: %)',
      v_entry;
  END IF;
  RAISE NOTICE '[ok] public.unchained_settings_touch() — search_path pinned empty';
END;
$blk$;

-- ════════════════════════════════════════════════════════════
-- Step 8 (LAST) — remove Unchained from TanCerca's database
-- ════════════════════════════════════════════════════════════
-- Runs against the OLD project. Destructive and not reversible from here: the
-- rows it deletes exist afterwards only in the new project and in the export
-- file. Do not run it on the day of the cutover.
--
-- ─── Do not run this until all of the following are true ──────────────────
--   · the new project has been serving the panel and the public site for long
--     enough to trust it — a week is a reasonable floor, and there is no cost
--     to waiting longer;
--   · every commercial and every specialist has signed in to the new panel at
--     least once, so you know their re-invite actually reached them;
--   · scripts/isolation/out/unchained-data.sql is archived somewhere that is
--     not this laptop;
--   · a fresh Supabase backup of the OLD project exists and its date is known.
--
-- Until then, leaving the tables in place costs nothing. They are unread: the
-- landing page and the panel both point at the new project from step 7, so
-- these rows stop changing the moment the cutover happens. That makes this
-- file a tidy-up, never a step the cutover is waiting on.
--
-- ─── Usage ────────────────────────────────────────────────────────────────
--   psql "$TANCERCA_DB_URL" -v decommission=yes -f scripts/isolation/decommission-in-tancerca.sql
--
-- Without -v decommission=yes it refuses and changes nothing, so pasting the
-- file into Studio out of curiosity does not drop a schema.

\set ON_ERROR_STOP on
\if :{?decommission}
\else
  \set decommission no
\endif

BEGIN;

-- The confirmation is carried through a GUC rather than read directly in the
-- guard below, because psql does NOT interpolate :variables inside a
-- dollar-quoted block — `IF :'decommission' <> 'yes'` would reach the server
-- as that literal text and fail to parse. set_config() is ordinary SQL, so the
-- substitution happens where psql can see it.
SELECT set_config('unchained.decommission', :'decommission', true);

DO $do$
BEGIN
  IF current_setting('unchained.decommission', true) IS DISTINCT FROM 'yes' THEN
    RAISE EXCEPTION 'refusing to run: re-invoke with  -v decommission=yes  once every condition in the header is true';
  END IF;
END;
$do$;

-- ─── 1. Revoke the product before dropping anything it points at ──────────
-- Order matters for a reason that is not foreign keys: while the tables are
-- half-dropped, an admin session that still has the old panel open would get
-- errors from a product that claims to be enabled. Disabling it first means
-- the panel refuses the route cleanly instead.
--
-- The memberships are deactivated rather than deleted: they are the record of
-- who had access to what and when, and TanCerca's admin_logs reference the
-- same people. Deleting them would leave the audit trail pointing at nothing.

UPDATE public.platform_products
   SET enabled = FALSE
 WHERE id = 'unchained';

UPDATE public.product_memberships
   SET active = FALSE
 WHERE product_id = 'unchained'
   AND active;

-- ─── 2. Functions ─────────────────────────────────────────────────────────
-- Dropped before the tables so a dependency error names the function rather
-- than surfacing as a cascade nobody reviewed. Every one of these was created
-- by an Unchained migration and is called by nothing TanCerca owns.
--
-- public.is_super_admin(), public.roles, public.platform_products,
-- public.product_memberships, public.has_product_access() and
-- public.get_my_authorized_products() are deliberately NOT here. They are
-- TanCerca's own, they predate Unchained, and TanCerca's panel and 57 of its
-- RLS policies still depend on them.

DROP FUNCTION IF EXISTS public.unchained_workforce_roster()               CASCADE;
DROP FUNCTION IF EXISTS public.unchained_set_commission_rate(TEXT, UUID, NUMERIC) CASCADE;
DROP FUNCTION IF EXISTS public.unchained_my_earnings()                    CASCADE;
DROP FUNCTION IF EXISTS public.unchained_my_engagements()                 CASCADE;
DROP FUNCTION IF EXISTS public.unchained_my_workforce_profile()           CASCADE;
DROP FUNCTION IF EXISTS public.my_specialist_id()                         CASCADE;
DROP FUNCTION IF EXISTS public.unchained_guard_commission_rate()          CASCADE;
DROP FUNCTION IF EXISTS public.unchained_engagements_before_update()      CASCADE;
DROP FUNCTION IF EXISTS public.unchained_engagement_transition_allowed(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.unchained_assignment_default_rate()        CASCADE;
DROP FUNCTION IF EXISTS public.unchained_engagement_default_rate()        CASCADE;
DROP FUNCTION IF EXISTS public.unchained_touch_updated_at()               CASCADE;

DROP FUNCTION IF EXISTS public.unchained_lead_metrics(DATE, DATE)         CASCADE;
DROP FUNCTION IF EXISTS public.unchained_add_lead_note(UUID, TEXT)        CASCADE;
DROP FUNCTION IF EXISTS public.unchained_reassign_lead(UUID, UUID, TEXT)  CASCADE;
DROP FUNCTION IF EXISTS public.unchained_set_lead_status(UUID, TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.unchained_can_work_lead(UUID)              CASCADE;
DROP FUNCTION IF EXISTS public.record_public_lead_channel_click(TEXT, TEXT) CASCADE;
DROP FUNCTION IF EXISTS public.unchained_lead_throttle_ok(TEXT, TEXT)     CASCADE;
DROP FUNCTION IF EXISTS public.my_commercial_contact_id()                 CASCADE;
DROP FUNCTION IF EXISTS public.unchained_manages_leads()                  CASCADE;
DROP FUNCTION IF EXISTS public.unchained_lead_events_append_only()        CASCADE;
DROP FUNCTION IF EXISTS public.unchained_leads_before_update()            CASCADE;
DROP FUNCTION IF EXISTS public.unchained_lead_transition_allowed(TEXT, TEXT) CASCADE;

DROP FUNCTION IF EXISTS public.resolve_commercial_contact(TEXT, TEXT)     CASCADE;
DROP FUNCTION IF EXISTS public.commercial_languages_valid(TEXT[])         CASCADE;
DROP FUNCTION IF EXISTS public.commercial_touch_updated_at()              CASCADE;

-- create_public_lead is dropped by signature-independent means: it was written
-- with a long parameter list that is easy to get wrong here, and getting it
-- wrong leaves an anon-executable writer behind — the one leftover that would
-- actually matter, because the anon key is public.
DO $do$
DECLARE
  v_sig TEXT;
BEGIN
  FOR v_sig IN
    SELECT format('public.%I(%s)', p.proname, pg_get_function_identity_arguments(p.oid))
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname = 'create_public_lead'
  LOOP
    EXECUTE 'DROP FUNCTION IF EXISTS ' || v_sig || ' CASCADE';
    RAISE NOTICE '[drop] %', v_sig;
  END LOOP;
END;
$do$;

-- ─── 3. Tables, in reverse dependency order ───────────────────────────────
-- No CASCADE. If something outside this list references one of these, the
-- statement fails and the whole transaction rolls back — which is the answer
-- you want, because it means TanCerca grew a dependency on Unchained's data
-- that nobody recorded, and that has to be read before anything is dropped.

DROP TABLE IF EXISTS public.unchained_engagement_specialists;
DROP TABLE IF EXISTS public.unchained_engagements;
DROP TABLE IF EXISTS public.unchained_specialists;
DROP TABLE IF EXISTS public.unchained_lead_events;
DROP TABLE IF EXISTS public.unchained_lead_throttle;
DROP TABLE IF EXISTS public.unchained_leads;
DROP TABLE IF EXISTS public.unchained_services;
DROP TABLE IF EXISTS public.routing_rules;
DROP TABLE IF EXISTS public.commercial_contact_regions;
DROP TABLE IF EXISTS public.commercial_contacts;
DROP TABLE IF EXISTS public.commercial_regions;

-- ─── 4. Verify, then decide ───────────────────────────────────────────────
-- Nothing Unchained-shaped is left, and the things TanCerca needs are all
-- still standing. If either half of that is untrue this raises, and the
-- ROLLBACK below is the outcome regardless of what you intended.

DO $do$
DECLARE
  v_left TEXT;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_left
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND (c.relname LIKE 'unchained%' OR c.relname LIKE 'commercial%' OR c.relname = 'routing_rules');
  IF v_left IS NOT NULL THEN
    RAISE EXCEPTION '[fail] Unchained tables remain: %', v_left;
  END IF;

  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_left
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'r'
     AND c.relname IN ('roles', 'admin_logs', 'platform_products', 'product_memberships');
  IF v_left IS DISTINCT FROM 'admin_logs, platform_products, product_memberships, roles' THEN
    RAISE EXCEPTION '[fail] a table TanCerca still needs was dropped. Present: %', COALESCE(v_left, '(none)');
  END IF;

  RAISE NOTICE '[ok] Unchained is gone from this database and TanCerca is intact';
END;
$do$;

NOTIFY pgrst, 'reload schema';

-- Change to COMMIT once the NOTICEs above read the way you expect. Left as
-- ROLLBACK so the first run is always a rehearsal that tells you exactly what
-- would happen, on the real data, without doing it.
ROLLBACK;
-- COMMIT;

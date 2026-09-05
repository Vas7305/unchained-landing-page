-- ════════════════════════════════════════════════════════════
-- Step 5 — the first operator of the new database
-- ════════════════════════════════════════════════════════════
-- Runs against the NEW project, once, from the SQL editor or from psql on the
-- `postgres` connection string. Both bypass RLS, which is the only way this
-- can work: the policy that governs public.roles requires you to already be a
-- super_admin, so the first row cannot be created through the panel or through
-- the anon key. That is deliberate and it is not a gap to be papered over —
-- a database where a signed-in stranger can insert their own super_admin row
-- has no administrator, it has a queue.
--
-- ─── Before running this ──────────────────────────────────────────────────
-- Create the account itself in the dashboard:
--
--     Authentication -> Users -> Add user -> Create new user
--
-- Use YOUR address. It is a fresh auth.users in a fresh project, so the
-- address existing in TanCerca is irrelevant here — that is the entire point
-- of the separation, and this is the first place you will see it hold.
--
-- ─── Usage ────────────────────────────────────────────────────────────────
--   psql "$UNCHAINED_DB_URL" -v owner_email="'you@unchainedbusiness.com'" \
--        -f scripts/isolation/bootstrap-super-admin.sql
--
-- Or paste it into the SQL editor after replacing :owner_email with the
-- quoted address.

\set ON_ERROR_STOP on
\if :{?owner_email}
\else
  \echo 'owner_email is not set. Re-run with:  -v owner_email="''you@example.com''"'
  \quit
\endif

BEGIN;

-- psql does NOT interpolate :variables inside a dollar-quoted block — the
-- literal text `:owner_email` would reach the server and fail to parse. Passing
-- the address through a GUC puts the substitution in ordinary SQL, where psql
-- can see it, and lets the block below read it back with current_setting().
SELECT set_config('unchained.owner_email', :owner_email, true);

DO $do$
DECLARE
  v_email TEXT := current_setting('unchained.owner_email', true);
  v_uid   UUID;
BEGIN
  IF v_email IS NULL OR btrim(v_email) = '' THEN
    RAISE EXCEPTION 'owner_email resolved to nothing';
  END IF;

  SELECT id
    INTO v_uid
    FROM auth.users
   WHERE lower(email) = lower(v_email);

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'no account for % in this project. Create it first: Authentication -> Users -> Add user.', v_email;
  END IF;

  -- ─── 1. The role row ────────────────────────────────────────────────────
  -- This is what public.is_super_admin() reads, and therefore what every
  -- administrative RLS policy in this database ultimately gates on.
  INSERT INTO public.roles (user_id, role)
  VALUES (v_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ─── 2. The JWT claim ───────────────────────────────────────────────────
  -- Needed as well, and for one specific thing: the policy that lets a
  -- super_admin MANAGE public.roles reads app_metadata from the JWT rather
  -- than querying public.roles, because a policy on roles that queried roles
  -- would recurse. app_metadata is server-controlled — the holder of the
  -- session cannot edit it — which is what makes it safe to trust here.
  --
  -- Without this the account still administers everything else correctly
  -- (is_super_admin() reads the table, not the token) but cannot appoint a
  -- second super_admin, which is the one thing a first operator most needs to
  -- be able to do.
  --
  -- The claim lands in the token at next sign-in, not immediately. If you are
  -- already signed in when you run this, sign out and back in.
  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'super_admin')
   WHERE id = v_uid;

  RAISE NOTICE '[ok] % is a super_admin of this database (user_id %)', v_email, v_uid;
  RAISE NOTICE '     Sign out and back in so the app_metadata claim reaches your token.';
END;
$do$;

-- ─── 3. Show the state, so the run has a record ───────────────────────────
SELECT u.email,
       r.role,
       u.raw_app_meta_data ->> 'role' AS jwt_claim,
       r.created_at
  FROM public.roles r
  JOIN auth.users u ON u.id = r.user_id
 ORDER BY r.created_at;

COMMIT;

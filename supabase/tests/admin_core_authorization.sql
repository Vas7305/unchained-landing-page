-- ════════════════════════════════════════════════════════════
-- Unchained Administration Core — authorization test suite
-- ════════════════════════════════════════════════════════════
-- Covers §32 of the Administrator Management specification: application scope,
-- every canonical role, permission resolution, the sensitive operations a
-- delegated administrator must never reach, the administrator lifecycle, the
-- invitation state machine, and the security events each of those emits.
--
-- ─── How to run it ────────────────────────────────────────────────────────
-- Paste the whole file into the Studio SQL editor of the UNCHAINED project
-- (sgyejgsaqknbmnzqfbul) and run it. It opens a transaction, builds its own
-- fixtures, asserts, and ROLLS BACK — nothing it creates survives, including
-- the auth.users rows.
--
--     · A pass ends with "[PASS] Administration Core: NN assertions".
--     · A failure raises at the assertion that failed, naming it, and the
--       transaction aborts — so a failed run leaves no debris either.
--
-- It has to be run by hand because this project has no CI database and its
-- migrations are applied by hand (see scripts/check-migrations.mjs). Run it
-- after applying 20260913000001, and after any change to the Core's functions,
-- its role mapping, or its RLS.
--
-- ─── What it does and does not cover ──────────────────────────────────────
-- Covered: everything the DATABASE decides. That is deliberate and it is where
-- the security boundary is — §24's chain, §21's reserved permissions, §20's
-- lifecycle and §15's one-time token all resolve in SQL, and all of them are
-- exercised below.
--
-- Not covered: the admin-core edge function's own Deno code — the HTTP
-- dispatch, the Super Admin gate on the Authorization header, the Resend call
-- and the GoTrue generateLink round trip. Those need a deployed function and a
-- live GoTrue, which this file has neither of. Note what that does NOT leave
-- untested: the invitation rules themselves were moved OUT of the edge
-- function and into admin_invitation_state() / admin_claim_invitation()
-- precisely so this suite could execute them.

BEGIN;

-- ─── Fixtures ─────────────────────────────────────────────────────────────
-- A helper for auth.users, because every test needs several accounts and the
-- column list is long. Created inside the transaction, so it disappears with
-- everything else.

CREATE OR REPLACE FUNCTION pg_temp.make_user(p_email TEXT)
RETURNS UUID
LANGUAGE plpgsql
AS $fn$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at
  ) VALUES (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, '', now(), '{}'::jsonb, '{}'::jsonb, now(), now()
  );
  RETURN v_id;
END;
$fn$;

/** Act as this user for the rest of the statement block. */
CREATE OR REPLACE FUNCTION pg_temp.act_as(p_user UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user::text, 'role', 'authenticated')::text,
    true
  );
END;
$fn$;

/** Act as nobody — the anonymous case. */
CREATE OR REPLACE FUNCTION pg_temp.act_as_nobody()
RETURNS VOID
LANGUAGE plpgsql
AS $fn$
BEGIN
  PERFORM set_config('request.jwt.claims', '', true);
END;
$fn$;

/** One assertion. Raises with its own name when it fails. */
CREATE OR REPLACE FUNCTION pg_temp.check(p_name TEXT, p_condition BOOLEAN)
RETURNS VOID
LANGUAGE plpgsql
AS $fn$
BEGIN
  IF p_condition IS NOT TRUE THEN
    RAISE EXCEPTION '[FAIL] %', p_name;
  END IF;
  PERFORM set_config('admin_core_test.count',
    (COALESCE(current_setting('admin_core_test.count', true), '0')::int + 1)::text, true);
END;
$fn$;

/**
 * The SHA-256 hex of a token, exactly as the edge function computes it.
 *
 * Core sha256(bytea) rather than pgcrypto's digest(): it needs no extension,
 * so this file runs against a database whose pgcrypto lives in the extensions
 * schema, or does not have it at all.
 */
CREATE OR REPLACE FUNCTION pg_temp.token_hash(p_token TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT encode(sha256(convert_to(p_token, 'UTF8')), 'hex');
$fn$;

-- ─── The cast ─────────────────────────────────────────────────────────────
-- Six administrators covering every state and every role that matters, plus
-- one account that is nobody at all.

DO $do$
DECLARE
  v_juan     UUID;  -- TanCerca APP_ADMIN, active
  v_ana      UUID;  -- Unchained Business CONTENT_ADMIN, active
  v_luis     UUID;  -- TanCerca TRANSPORT_OPERATIONS_ADMIN, active but latent role
  v_sofia    UUID;  -- TanCerca FINANCE_ADMIN, suspended
  v_marco    UUID;  -- TanCerca OPERATIONS_ADMIN, revoked
  v_stranger UUID;  -- authenticated and nothing else
BEGIN
  v_juan     := pg_temp.make_user('test.juan@admin-core.invalid');
  v_ana      := pg_temp.make_user('test.ana@admin-core.invalid');
  v_luis     := pg_temp.make_user('test.luis@admin-core.invalid');
  v_sofia    := pg_temp.make_user('test.sofia@admin-core.invalid');
  v_marco    := pg_temp.make_user('test.marco@admin-core.invalid');
  v_stranger := pg_temp.make_user('test.stranger@admin-core.invalid');

  INSERT INTO public.administrators
    (id, user_id, name, email, application_slug, role_code, status)
  VALUES
    ('11111111-1111-1111-1111-111111111111', v_juan,  'Juan Perez', 'test.juan@admin-core.invalid',
     'tancerca', 'APP_ADMIN', 'ACTIVE'),
    ('22222222-2222-2222-2222-222222222222', v_ana,   'Ana Diaz',   'test.ana@admin-core.invalid',
     'unchained-business', 'CONTENT_ADMIN', 'ACTIVE'),
    ('33333333-3333-3333-3333-333333333333', v_luis,  'Luis Mora',  'test.luis@admin-core.invalid',
     'tancerca', 'TRANSPORT_OPERATIONS_ADMIN', 'ACTIVE'),
    ('44444444-4444-4444-4444-444444444444', v_sofia, 'Sofia Reyes','test.sofia@admin-core.invalid',
     'tancerca', 'FINANCE_ADMIN', 'SUSPENDED'),
    ('55555555-5555-5555-5555-555555555555', v_marco, 'Marco Leon', 'test.marco@admin-core.invalid',
     'tancerca', 'OPERATIONS_ADMIN', 'REVOKED'),
    -- Pending: created, invited, never accepted. No account yet, which is why
    -- user_id is null and the CHECK permits it only in this state.
    ('66666666-6666-6666-6666-666666666666', NULL,    'Pilar Nunez','test.pilar@admin-core.invalid',
     'tancerca', 'APP_ADMIN', 'PENDING');

  -- Remembered for the blocks below, which cannot see this one's variables.
  PERFORM set_config('admin_core_test.juan',     v_juan::text,     true);
  PERFORM set_config('admin_core_test.ana',      v_ana::text,      true);
  PERFORM set_config('admin_core_test.luis',     v_luis::text,     true);
  PERFORM set_config('admin_core_test.sofia',    v_sofia::text,    true);
  PERFORM set_config('admin_core_test.marco',    v_marco::text,    true);
  PERFORM set_config('admin_core_test.stranger', v_stranger::text, true);

  RAISE NOTICE '[setup] six administrators created';
END;
$do$;

-- ─── 1. Application scope (§7, §8, §25) ───────────────────────────────────
-- The rule the whole command centre rests on: an administrator of one property
-- is not an administrator of another, and no URL, payload or parameter changes
-- that. Here it is asked of the function that actually decides.

DO $do$
DECLARE
  v_juan UUID := current_setting('admin_core_test.juan')::uuid;
  v_ana  UUID := current_setting('admin_core_test.ana')::uuid;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  PERFORM pg_temp.check(
    'TanCerca APP_ADMIN may open TanCerca',
    public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  PERFORM pg_temp.check(
    'TanCerca APP_ADMIN may NOT open Unchained Business',
    NOT public.admin_has_permission('unchained-business', 'APP_DASHBOARD_VIEW'));

  PERFORM pg_temp.check(
    'TanCerca APP_ADMIN may NOT open Frito',
    NOT public.admin_has_permission('frito', 'APP_DASHBOARD_VIEW'));

  -- The "manually changed application id in the payload" case from §25. The
  -- parameter is the only thing the caller controls, and changing it moves the
  -- question to a property they do not hold rather than granting anything.
  PERFORM pg_temp.check(
    'a made-up application slug grants nothing',
    NOT public.admin_has_permission('tancerca-admin', 'APP_DASHBOARD_VIEW'));

  PERFORM pg_temp.act_as(v_ana);

  PERFORM pg_temp.check(
    'Unchained CONTENT_ADMIN may open Unchained Business',
    public.admin_has_permission('unchained-business', 'CMS_PUBLISH'));

  PERFORM pg_temp.check(
    'Unchained CONTENT_ADMIN may NOT open TanCerca',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  -- Not even for the permission they legitimately hold elsewhere. Scope is
  -- checked before the permission, not instead of it.
  PERFORM pg_temp.check(
    'a permission held in one application does not travel to another',
    NOT public.admin_has_permission('tancerca', 'CMS_PUBLISH'));

  RAISE NOTICE '[ok] 1. application scope';
END;
$do$;

-- ─── 2. Deny by default, and the anonymous case (§6) ──────────────────────

DO $do$
DECLARE
  v_stranger UUID := current_setting('admin_core_test.stranger')::uuid;
  v_perm     RECORD;
BEGIN
  PERFORM pg_temp.act_as_nobody();
  PERFORM pg_temp.check(
    'nobody gets nothing',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  PERFORM pg_temp.act_as(v_stranger);
  PERFORM pg_temp.check(
    'an authenticated non-administrator gets nothing',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  -- Not one permission in the whole catalogue, for either of them. This is
  -- deny-by-default asked exhaustively rather than spot-checked.
  FOR v_perm IN SELECT code FROM public.admin_permissions LOOP
    PERFORM pg_temp.check(
      format('an authenticated non-administrator holds no %s', v_perm.code),
      NOT public.admin_has_permission('tancerca', v_perm.code));
  END LOOP;

  RAISE NOTICE '[ok] 2. deny by default';
END;
$do$;

-- ─── 3. Every canonical role resolves exactly its mapping (§32) ───────────
-- Asked of the resolver rather than of the mapping table: a test that read
-- admin_role_permissions would be asserting that a table equals itself.

DO $do$
DECLARE
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_role  RECORD;
  v_perm  RECORD;
  v_admin UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  FOR v_role IN
    SELECT code, status FROM public.admin_roles ORDER BY sort_order
  LOOP
    -- Re-role Juan and ask the resolver every question in the catalogue.
    UPDATE public.administrators SET role_code = v_role.code WHERE id = v_admin;
    PERFORM pg_temp.act_as(v_juan);

    FOR v_perm IN SELECT code FROM public.admin_permissions LOOP
      IF v_role.status = 'active'
         AND EXISTS (
           SELECT 1 FROM public.admin_role_permissions rp
            WHERE rp.role_code = v_role.code AND rp.permission_code = v_perm.code
         )
      THEN
        PERFORM pg_temp.check(
          format('%s resolves %s', v_role.code, v_perm.code),
          public.admin_has_permission('tancerca', v_perm.code));
      ELSE
        PERFORM pg_temp.check(
          format('%s does NOT resolve %s', v_role.code, v_perm.code),
          NOT public.admin_has_permission('tancerca', v_perm.code));
      END IF;
    END LOOP;
  END LOOP;

  UPDATE public.administrators SET role_code = 'APP_ADMIN' WHERE id = v_admin;
  RAISE NOTICE '[ok] 3. every canonical role resolves exactly its mapping';
END;
$do$;

-- ─── 4. The sensitive operations, asked of every role (§4, §21) ───────────
-- §3 fixes the five roles and §21 reserves these to the Super Admin. The loop
-- above already proves each role resolves only its mapping; this asks the
-- question the specification actually cares about, by name, so a future change
-- to the mapping fails HERE with a sentence somebody can read.

DO $do$
DECLARE
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_admin UUID := '11111111-1111-1111-1111-111111111111';
  v_role  RECORD;
  v_perm  TEXT;
  v_reserved TEXT[] := ARRAY[
    'ADMIN_VIEW', 'ADMIN_CREATE', 'ADMIN_UPDATE', 'ADMIN_SUSPEND', 'ADMIN_REVOKE',
    'SALARY_MANAGE', 'PRICING_MANAGE', 'MEMBERSHIP_PRICING_MANAGE',
    'TANCOINS_MANAGE', 'FRITOS_MANAGE', 'ECONOMY_MANAGE', 'ANTIFRAUD_MANAGE',
    'GLOBAL_SETTINGS_MANAGE', 'ROLE_MANAGE', 'PERMISSION_MANAGE',
    'APPLICATION_SCOPE_MANAGE'
  ];
BEGIN
  FOR v_role IN SELECT code FROM public.admin_roles LOOP
    UPDATE public.administrators SET role_code = v_role.code WHERE id = v_admin;
    PERFORM pg_temp.act_as(v_juan);

    FOREACH v_perm IN ARRAY v_reserved LOOP
      PERFORM pg_temp.check(
        format('%s cannot %s', v_role.code, v_perm),
        NOT public.admin_has_permission('tancerca', v_perm));
    END LOOP;
  END LOOP;

  UPDATE public.administrators SET role_code = 'APP_ADMIN' WHERE id = v_admin;

  -- FINANCE_ADMIN's §4.3 table, spelled out: it reads the numbers and never
  -- changes the rules.
  UPDATE public.administrators SET role_code = 'FINANCE_ADMIN' WHERE id = v_admin;
  PERFORM pg_temp.act_as(v_juan);
  PERFORM pg_temp.check('FINANCE_ADMIN may view finance',
    public.admin_has_permission('tancerca', 'FINANCE_VIEW'));
  PERFORM pg_temp.check('FINANCE_ADMIN may view financial reports',
    public.admin_has_permission('tancerca', 'FINANCE_REPORT_VIEW'));
  PERFORM pg_temp.check('FINANCE_ADMIN may register an expense',
    public.admin_has_permission('tancerca', 'EXPENSE_CREATE'));
  PERFORM pg_temp.check('FINANCE_ADMIN may reconcile',
    public.admin_has_permission('tancerca', 'RECONCILIATION_MANAGE'));
  -- And, per the deny-by-default reading of §14, does not see salaries either
  -- until somebody grants that explicitly.
  PERFORM pg_temp.check('FINANCE_ADMIN does not see salaries by default',
    NOT public.admin_has_permission('tancerca', 'SALARY_VIEW'));

  UPDATE public.administrators SET role_code = 'APP_ADMIN' WHERE id = v_admin;
  RAISE NOTICE '[ok] 4. reserved permissions are reserved, for every role';
END;
$do$;

-- ─── 5. The latent transport role (§17, §27) ──────────────────────────────

DO $do$
DECLARE
  v_luis UUID := current_setting('admin_core_test.luis')::uuid;
BEGIN
  PERFORM pg_temp.act_as(v_luis);

  PERFORM pg_temp.check(
    'a latent role grants none of its own permissions',
    NOT public.admin_has_permission('tancerca', 'TRANSPORT_OPERATIONS_VIEW'));
  PERFORM pg_temp.check(
    'a latent role grants no management either',
    NOT public.admin_has_permission('tancerca', 'TRANSPORT_OPERATIONS_MANAGE'));
  PERFORM pg_temp.check(
    'a latent role does not even open the application',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  -- ...and the mapping is nevertheless in place, so enabling the module is one
  -- UPDATE. This is the half that proves the latency is a status rather than a
  -- missing row, and it is what §27 asks for.
  UPDATE public.admin_roles SET status = 'active' WHERE code = 'TRANSPORT_OPERATIONS_ADMIN';
  PERFORM pg_temp.check(
    'activating the role turns its mapped permissions on, with no other change',
    public.admin_has_permission('tancerca', 'TRANSPORT_OPERATIONS_VIEW'));
  UPDATE public.admin_roles SET status = 'latent' WHERE code = 'TRANSPORT_OPERATIONS_ADMIN';

  PERFORM pg_temp.check(
    'and turning it back off closes it again',
    NOT public.admin_has_permission('tancerca', 'TRANSPORT_OPERATIONS_VIEW'));

  RAISE NOTICE '[ok] 5. the transport role is assignable and inert';
END;
$do$;

-- ─── 6. Lifecycle: PENDING, SUSPENDED, REVOKED (§20) ──────────────────────

DO $do$
DECLARE
  v_sofia UUID := current_setting('admin_core_test.sofia')::uuid;
  v_marco UUID := current_setting('admin_core_test.marco')::uuid;
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_admin UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  PERFORM pg_temp.act_as(v_sofia);
  PERFORM pg_temp.check('a SUSPENDED administrator holds nothing',
    NOT public.admin_has_permission('tancerca', 'FINANCE_VIEW'));
  PERFORM pg_temp.check('a SUSPENDED administrator cannot even open the app',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  PERFORM pg_temp.act_as(v_marco);
  PERFORM pg_temp.check('a REVOKED administrator holds nothing',
    NOT public.admin_has_permission('tancerca', 'OPERATIONS_VIEW'));

  -- Suspension takes effect on the next question, not on the next login: a
  -- person holding a live session stops being able to do anything at once.
  PERFORM pg_temp.act_as(v_juan);
  PERFORM pg_temp.check('active, before',
    public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));
  UPDATE public.administrators SET status = 'SUSPENDED' WHERE id = v_admin;
  PERFORM pg_temp.check('suspended, immediately after, in the same session',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));
  UPDATE public.administrators SET status = 'ACTIVE' WHERE id = v_admin;
  PERFORM pg_temp.check('and reinstating restores exactly what the role carries',
    public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  RAISE NOTICE '[ok] 6. lifecycle';
END;
$do$;

-- ─── 7. A disabled application closes for everyone (§10) ──────────────────

DO $do$
DECLARE
  v_juan UUID := current_setting('admin_core_test.juan')::uuid;
BEGIN
  PERFORM pg_temp.act_as(v_juan);
  UPDATE public.admin_applications SET status = 'disabled' WHERE slug = 'tancerca';

  PERFORM pg_temp.check(
    'disabling an application closes it for its own administrators',
    NOT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  UPDATE public.admin_applications SET status = 'active' WHERE slug = 'tancerca';
  PERFORM pg_temp.check('and re-enabling it reopens it',
    public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  RAISE NOTICE '[ok] 7. application status';
END;
$do$;

-- ─── 8. The per-administrator extension seam (§26) ────────────────────────
-- The table is empty in production and has no UI. These assertions are what
-- make "this can be introduced later without a redesign" a checked claim
-- rather than a promise.

DO $do$
DECLARE
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_admin UUID := '11111111-1111-1111-1111-111111111111';
BEGIN
  PERFORM pg_temp.act_as(v_juan);
  PERFORM pg_temp.check('APP_ADMIN does not publish content on its own',
    NOT public.admin_has_permission('tancerca', 'CMS_PUBLISH'));

  -- APP_ADMIN + CMS_PUBLISH, the example §26 gives.
  INSERT INTO public.administrator_permission_grants (administrator_id, permission_code, effect)
  VALUES (v_admin, 'CMS_PUBLISH', 'ALLOW');
  PERFORM pg_temp.check('an explicit ALLOW adds one permission to a role',
    public.admin_has_permission('tancerca', 'CMS_PUBLISH'));
  PERFORM pg_temp.check('and adds nothing else',
    NOT public.admin_has_permission('tancerca', 'CMS_DELETE'));

  -- An ALLOW is still scoped. A grant is not a way around §7.
  PERFORM pg_temp.check('an explicit ALLOW does not cross into another application',
    NOT public.admin_has_permission('unchained-business', 'CMS_PUBLISH'));

  -- DENY beats both the role and an ALLOW.
  INSERT INTO public.administrator_permission_grants (administrator_id, permission_code, effect)
  VALUES (v_admin, 'AFFILIATE_UPDATE', 'DENY');
  PERFORM pg_temp.check('an explicit DENY overrides the role',
    NOT public.admin_has_permission('tancerca', 'AFFILIATE_UPDATE'));

  UPDATE public.administrator_permission_grants
     SET effect = 'DENY' WHERE administrator_id = v_admin AND permission_code = 'CMS_PUBLISH';
  PERFORM pg_temp.check('DENY beats ALLOW',
    NOT public.admin_has_permission('tancerca', 'CMS_PUBLISH'));

  DELETE FROM public.administrator_permission_grants WHERE administrator_id = v_admin;
  PERFORM pg_temp.check('removing the grants restores the role exactly',
    public.admin_has_permission('tancerca', 'AFFILIATE_UPDATE'));

  RAISE NOTICE '[ok] 8. the extension seam';
END;
$do$;

-- ─── 9. The invitation state machine (§15) ────────────────────────────────
-- Every branch §32 names: valid, expired, used, revoked, and an invitation for
-- an administrator whose access has been closed.

DO $do$
DECLARE
  v_pending UUID := '66666666-6666-6666-6666-666666666666';
  v_sofia_a UUID := '44444444-4444-4444-4444-444444444444';
  v_juan    UUID := current_setting('admin_core_test.juan')::uuid;
  v_hash    TEXT := pg_temp.token_hash('a-valid-token-value-0001');
  v_old     TEXT := pg_temp.token_hash('an-expired-token-0002');
  v_gone    TEXT := pg_temp.token_hash('a-revoked-token-0003');
  v_blocked TEXT := pg_temp.token_hash('a-token-for-a-suspended-admin-0004');
  v_rows    INTEGER;
  v_claim   RECORD;
BEGIN
  INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
  VALUES (v_pending, v_hash, now() + interval '72 hours', v_juan);

  INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
  VALUES (v_sofia_a, v_blocked, now() + interval '72 hours', v_juan);

  PERFORM pg_temp.check('an unknown token is unknown',
    public.admin_invitation_state(pg_temp.token_hash('never-issued')) = 'unknown');
  PERFORM pg_temp.check('a live token is valid',
    public.admin_invitation_state(v_hash) = 'valid');
  PERFORM pg_temp.check('a token for a suspended administrator is blocked',
    public.admin_invitation_state(v_blocked) = 'blocked');

  -- Expiry. Written directly rather than waiting 72 hours.
  UPDATE public.admin_invitations SET expires_at = now() - interval '1 minute'
   WHERE token_hash = v_hash;
  PERFORM pg_temp.check('an expired token is expired',
    public.admin_invitation_state(v_hash) = 'expired');

  SELECT count(*) INTO v_rows FROM public.admin_claim_invitation(v_hash);
  PERFORM pg_temp.check('an expired token cannot be claimed', v_rows = 0);

  UPDATE public.admin_invitations SET expires_at = now() + interval '72 hours'
   WHERE token_hash = v_hash;

  -- A token for a suspended administrator cannot be claimed either, which is
  -- §20 applied to a link that was valid when it was sent.
  SELECT count(*) INTO v_rows FROM public.admin_claim_invitation(v_blocked);
  PERFORM pg_temp.check('a suspended administrator cannot accept an invitation', v_rows = 0);

  -- ─── The one-time guarantee ─────────────────────────────────────────────
  SELECT * INTO v_claim FROM public.admin_claim_invitation(v_hash);
  PERFORM pg_temp.check('a valid token is claimed once',
    v_claim.administrator_id = v_pending);
  PERFORM pg_temp.check('and the claim carries what the caller needs',
    v_claim.email = 'test.pilar@admin-core.invalid'
    AND v_claim.application_slug = 'tancerca'
    AND v_claim.role_code = 'APP_ADMIN');

  SELECT count(*) INTO v_rows FROM public.admin_claim_invitation(v_hash);
  PERFORM pg_temp.check('the same token cannot be claimed twice', v_rows = 0);
  PERFORM pg_temp.check('and it now reports as used',
    public.admin_invitation_state(v_hash) = 'used');

  -- Revocation, which is the property GoTrue's own token could not give us and
  -- the whole reason the Core mints its own.
  INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
  VALUES (v_pending, v_gone, now() + interval '72 hours', v_juan);
  UPDATE public.admin_invitations SET status = 'revoked', revoked_at = now()
   WHERE token_hash = v_gone;

  PERFORM pg_temp.check('a revoked token is revoked',
    public.admin_invitation_state(v_gone) = 'revoked');
  SELECT count(*) INTO v_rows FROM public.admin_claim_invitation(v_gone);
  PERFORM pg_temp.check('a revoked token cannot be claimed', v_rows = 0);

  RAISE NOTICE '[ok] 9. the invitation state machine';
END;
$do$;

-- ─── 10. Only one live invitation at a time (§15) ─────────────────────────
-- The partial unique index is what makes "resend" mean "the old link is dead":
-- a second pending invitation cannot exist, so the caller is forced to revoke
-- before it mints.

DO $do$
DECLARE
  v_pending UUID := '66666666-6666-6666-6666-666666666666';
  v_juan    UUID := current_setting('admin_core_test.juan')::uuid;
  v_raised  BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
  VALUES (v_pending, pg_temp.token_hash('first-live-token'), now() + interval '1 hour', v_juan);

  BEGIN
    INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
    VALUES (v_pending, pg_temp.token_hash('second-live-token'), now() + interval '1 hour', v_juan);
  EXCEPTION WHEN unique_violation THEN
    v_raised := TRUE;
  END;

  PERFORM pg_temp.check('two live invitations for one administrator are impossible', v_raised);

  RAISE NOTICE '[ok] 10. one live invitation';
END;
$do$;

-- ─── 11. Activation (§15, §20) ────────────────────────────────────────────

DO $do$
DECLARE
  v_pending UUID := '66666666-6666-6666-6666-666666666666';
  v_revoked UUID := '55555555-5555-5555-5555-555555555555';
  v_new     UUID;
  v_status  TEXT;
BEGIN
  v_new := pg_temp.make_user('test.pilar@admin-core.invalid');

  PERFORM pg_temp.check('activating a pending administrator succeeds',
    public.admin_activate_administrator(v_pending, v_new));

  SELECT status INTO v_status FROM public.administrators WHERE id = v_pending;
  PERFORM pg_temp.check('and leaves them ACTIVE', v_status = 'ACTIVE');

  PERFORM pg_temp.act_as(v_new);
  PERFORM pg_temp.check('the newly activated administrator holds their role at once',
    public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW'));

  -- A Super Admin revoking access mid-acceptance has to win that race.
  PERFORM pg_temp.check('a revoked administrator cannot be activated',
    NOT public.admin_activate_administrator(v_revoked, v_new));

  RAISE NOTICE '[ok] 11. activation';
END;
$do$;

-- ─── 12. Compensation (§14) ───────────────────────────────────────────────

DO $do$
DECLARE
  v_juan_a UUID := '11111111-1111-1111-1111-111111111111';
  v_juan   UUID := current_setting('admin_core_test.juan')::uuid;
  v_raised BOOLEAN := FALSE;
  v_count  INTEGER;
  v_amount NUMERIC;
BEGIN
  -- Set by the Super Admin (this session, which is not acting as Juan).
  PERFORM pg_temp.act_as_nobody();
  INSERT INTO public.administrator_compensation
    (administrator_id, salary_amount, currency, created_by)
  VALUES (v_juan_a, 35000, 'CUP', v_juan);

  -- Superseding keeps the history rather than overwriting it.
  UPDATE public.administrator_compensation
     SET status = 'superseded', effective_to = current_date
   WHERE administrator_id = v_juan_a AND status = 'active';
  INSERT INTO public.administrator_compensation
    (administrator_id, salary_amount, currency, created_by)
  VALUES (v_juan_a, 42000, 'CUP', v_juan);

  SELECT count(*) INTO v_count
    FROM public.administrator_compensation WHERE administrator_id = v_juan_a;
  PERFORM pg_temp.check('a salary change keeps the previous figure', v_count = 2);

  SELECT salary_amount INTO v_amount
    FROM public.administrator_compensation
   WHERE administrator_id = v_juan_a AND status = 'active';
  PERFORM pg_temp.check('and exactly one row is current', v_amount = 42000);

  -- Two active rows are impossible, so "the current salary" is never a
  -- question with two answers.
  BEGIN
    INSERT INTO public.administrator_compensation
      (administrator_id, salary_amount, currency, created_by)
    VALUES (v_juan_a, 99999, 'CUP', v_juan);
  EXCEPTION WHEN unique_violation THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('an administrator cannot have two current salaries', v_raised);

  -- §14: the administrator cannot set their own. The trigger is what holds
  -- this even where a future policy lets somebody near the table.
  v_raised := FALSE;
  PERFORM pg_temp.act_as(v_juan);
  BEGIN
    UPDATE public.administrator_compensation
       SET salary_amount = 999999
     WHERE administrator_id = v_juan_a AND status = 'active';
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('an administrator cannot raise their own salary', v_raised);

  SELECT salary_amount INTO v_amount
    FROM public.administrator_compensation
   WHERE administrator_id = v_juan_a AND status = 'active';
  PERFORM pg_temp.check('and the figure is untouched', v_amount = 42000);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 12. compensation';
END;
$do$;

-- ─── 13. Security events (§22) ────────────────────────────────────────────
-- Refusals are recorded by admin_check_access(), which returns FALSE, and NOT
-- by admin_authorize(), which raises.
--
-- That split is not stylistic. PostgreSQL has no autonomous transactions, so a
-- function that writes an audit row and then raises destroys its own audit
-- row. The first version of this Core did exactly that and recorded nothing;
-- this section is what found it. The assertions below pin BOTH halves — that
-- the recording variant records, and that the raising variant does not —
-- because the second is a limitation somebody will otherwise "fix" back into a
-- silent hole.

DO $do$
DECLARE
  v_juan    UUID := current_setting('admin_core_test.juan')::uuid;
  v_before  INTEGER;
  v_after   INTEGER;
  v_raised  BOOLEAN := FALSE;
  v_action  TEXT;
  v_meta    JSONB;
BEGIN
  SELECT count(*) INTO v_before FROM public.admin_logs;

  PERFORM pg_temp.act_as(v_juan);

  -- The allowed case returns true and records nothing: an audit trail of every
  -- successful permission check would bury the refusals.
  PERFORM pg_temp.check('admin_check_access allows what the role carries',
    public.admin_check_access('tancerca', 'APP_DASHBOARD_VIEW'));
  SELECT count(*) INTO v_after FROM public.admin_logs;
  PERFORM pg_temp.check('an allowed check writes no event', v_after = v_before);

  -- A permission the role does not carry, in the caller's OWN application.
  -- No exception block around it, deliberately: the call returns, so the event
  -- it wrote commits. Wrapping it would roll the event back, which is the
  -- whole defect this section exists to prevent.
  PERFORM pg_temp.check('admin_check_access refuses what the role does not carry',
    NOT public.admin_check_access('tancerca', 'SALARY_MANAGE'));

  -- Found by what it says rather than by being the newest row: every event
  -- written inside one transaction shares now(), so "the most recent" is not
  -- a question with one answer here.
  SELECT action, metadata INTO v_action, v_meta
    FROM public.admin_logs
   WHERE admin_id = v_juan
     AND action = 'ADMIN_ACCESS_DENIED'
     AND metadata->>'permission' = 'SALARY_MANAGE'
   LIMIT 1;
  PERFORM pg_temp.check('and records ADMIN_ACCESS_DENIED',
    v_action = 'ADMIN_ACCESS_DENIED');
  PERFORM pg_temp.check('with the caller as the actor, the result and the permission',
    v_meta->>'result' = 'DENIED'
    AND v_meta->>'application' = 'tancerca'
    AND v_meta->>'permission' = 'SALARY_MANAGE'
    AND v_meta->>'contract' = 'unchained.admin_core.v1');

  -- Reaching for another property is a different event, with a different
  -- severity. This is §8's GET /api/admin/frito/users, asked in SQL.
  PERFORM pg_temp.check('a cross-application request is refused',
    NOT public.admin_check_access('unchained-business', 'APP_DASHBOARD_VIEW'));

  SELECT action, metadata INTO v_action, v_meta
    FROM public.admin_logs
   WHERE admin_id = v_juan
     AND action = 'ADMIN_CROSS_APP_ACCESS_ATTEMPT'
     AND metadata->>'application' = 'unchained-business'
   LIMIT 1;
  PERFORM pg_temp.check('and recorded as ADMIN_CROSS_APP_ACCESS_ATTEMPT',
    v_action = 'ADMIN_CROSS_APP_ACCESS_ATTEMPT');
  PERFORM pg_temp.check('at critical severity',
    v_meta->>'severity' = 'critical');

  -- The two are not the same event, which is the point of distinguishing them.
  PERFORM pg_temp.check('a cross-application attempt is not filed as an ordinary denial',
    NOT EXISTS (
      SELECT 1 FROM public.admin_logs
       WHERE admin_id = v_juan
         AND action = 'ADMIN_ACCESS_DENIED'
         AND metadata->>'application' = 'unchained-business'));

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 13. security events';
END;
$do$;

-- ─── 13b. admin_authorize() refuses, and records nothing ──────────────────
-- The documented limitation, pinned so it stays documented. Anybody who adds
-- a PERFORM admin_core_log_event() back into admin_authorize() will fail here
-- rather than shipping a function that reads as though it records.

DO $do$
DECLARE
  v_juan   UUID := current_setting('admin_core_test.juan')::uuid;
  v_before INTEGER;
  v_after  INTEGER;
  v_raised BOOLEAN := FALSE;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  PERFORM pg_temp.check('admin_authorize allows what the role carries',
    public.admin_authorize('tancerca', 'APP_DASHBOARD_VIEW'));

  SELECT count(*) INTO v_before FROM public.admin_logs;

  BEGIN
    PERFORM public.admin_authorize('tancerca', 'PRICING_MANAGE');
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('admin_authorize raises 42501 on a refusal', v_raised);

  SELECT count(*) INTO v_after FROM public.admin_logs;
  PERFORM pg_temp.check(
    'and writes no event, because the raise would roll it back anyway',
    v_after = v_before);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 13b. admin_authorize refuses without recording';
END;
$do$;

-- ─── 14. The audit trail is append-only (§23) ─────────────────────────────

DO $do$
DECLARE
  v_juan   UUID := current_setting('admin_core_test.juan')::uuid;
  v_id     UUID;
  v_raised BOOLEAN := FALSE;
BEGIN
  INSERT INTO public.admin_logs (admin_id, action, metadata)
  VALUES (v_juan, 'TEST_EVENT', '{}'::jsonb)
  RETURNING id INTO v_id;

  BEGIN
    UPDATE public.admin_logs SET action = 'REWRITTEN' WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('an audit row cannot be rewritten', v_raised);

  v_raised := FALSE;
  BEGIN
    DELETE FROM public.admin_logs WHERE id = v_id;
  EXCEPTION WHEN OTHERS THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('an audit row cannot be deleted', v_raised);

  RAISE NOTICE '[ok] 14. audit immutability';
END;
$do$;

-- ─── 15. Row level security (§21) ─────────────────────────────────────────
-- Everything above runs as the table owner, which bypasses RLS — it tests the
-- FUNCTIONS. This block switches to the `authenticated` role so the policies
-- themselves are the thing under test.
--
-- Skipped with a NOTICE where that role does not exist, so the file still runs
-- against a plain Postgres.

DO $do$
DECLARE
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_count INTEGER;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    RAISE NOTICE '[skip] 15. RLS — no `authenticated` role in this database';
    RETURN;
  END IF;

  PERFORM pg_temp.act_as(v_juan);
  -- EXECUTE rather than a bare SET: role switching inside plpgsql is a
  -- utility command, and running it dynamically avoids any question about
  -- how the block is parsed.
  EXECUTE 'SET LOCAL ROLE authenticated';

  -- A delegated administrator sees their own record and nobody else's.
  SELECT count(*) INTO v_count FROM public.administrators;
  PERFORM pg_temp.check('an administrator sees exactly one administrator: themselves',
    v_count = 1);

  -- Not the roster of another application, obviously, but not their own
  -- colleagues either: §21 makes this module Super-Admin-only.
  SELECT count(*) INTO v_count
    FROM public.administrators WHERE application_slug = 'tancerca';
  PERFORM pg_temp.check('including within their own application', v_count = 1);

  -- The invitation table holds credentials. Nothing for a delegated
  -- administrator to see there at all, not even their own.
  SELECT count(*) INTO v_count FROM public.admin_invitations;
  PERFORM pg_temp.check('an administrator sees no invitations', v_count = 0);

  -- The catalogue is Super-Admin-only; everything an ordinary caller needs to
  -- know about it comes through the SECURITY DEFINER functions.
  SELECT count(*) INTO v_count FROM public.admin_roles;
  PERFORM pg_temp.check('an administrator cannot read the role catalogue directly',
    v_count = 0);

  SELECT count(*) INTO v_count FROM public.admin_role_permissions;
  PERFORM pg_temp.check('nor the role/permission mapping', v_count = 0);

  -- Their own salary is readable. Setting it is not — §12 already proved the
  -- trigger; this is the policy half.
  SELECT count(*) INTO v_count
    FROM public.administrator_compensation
   WHERE administrator_id = '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.check('an administrator may read their own compensation', v_count = 2);

  SELECT count(*) INTO v_count
    FROM public.administrator_compensation
   WHERE administrator_id <> '11111111-1111-1111-1111-111111111111';
  PERFORM pg_temp.check('and nobody else''s', v_count = 0);

  -- The application registry is readable, because a screen has to be able to
  -- render the name of the application somebody administers.
  SELECT count(*) INTO v_count FROM public.admin_applications;
  PERFORM pg_temp.check('the active application registry is readable', v_count >= 2);

  EXECUTE 'RESET ROLE';
  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 15. row level security';
END;
$do$;

-- ─── 16. The management read refuses rather than empties (§19) ────────────

DO $do$
DECLARE
  v_juan     UUID := current_setting('admin_core_test.juan')::uuid;
  v_stranger UUID := current_setting('admin_core_test.stranger')::uuid;
  v_raised   BOOLEAN := FALSE;
  v_count    INTEGER;
BEGIN
  PERFORM pg_temp.act_as(v_juan);
  BEGIN
    SELECT count(*) INTO v_count FROM public.admin_list_administrators('tancerca');
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('a delegated administrator is REFUSED the administrator list, not shown an empty one',
    v_raised);

  v_raised := FALSE;
  PERFORM pg_temp.act_as(v_stranger);
  BEGIN
    SELECT count(*) INTO v_count FROM public.admin_list_administrators(NULL);
  EXCEPTION WHEN insufficient_privilege THEN
    v_raised := TRUE;
  END;
  PERFORM pg_temp.check('and so is anybody else', v_raised);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 16. the management read';
END;
$do$;

-- ─── 17. The integration contract (§28) ───────────────────────────────────
-- The single call an application makes to learn who is in front of it. It has
-- to apply the same chain as admin_has_permission(), because an application
-- that trusted a looser answer would be the weakest link in the system.

DO $do$
DECLARE
  v_juan  UUID := current_setting('admin_core_test.juan')::uuid;
  v_sofia UUID := current_setting('admin_core_test.sofia')::uuid;
  v_ctx   RECORD;
  v_rows  INTEGER;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  SELECT * INTO v_ctx FROM public.admin_resolve_context('tancerca');
  PERFORM pg_temp.check('the contract names the administrator, the application and the role',
    v_ctx.application_slug = 'tancerca'
    AND v_ctx.role_code = 'APP_ADMIN'
    AND v_ctx.is_active);
  PERFORM pg_temp.check('and returns the permissions the role actually resolves',
    'APP_DASHBOARD_VIEW' = ANY(v_ctx.permissions)
    AND 'AFFILIATE_UPDATE' = ANY(v_ctx.permissions));
  PERFORM pg_temp.check('and nothing it does not',
    NOT ('SALARY_MANAGE' = ANY(v_ctx.permissions))
    AND NOT ('ADMIN_CREATE' = ANY(v_ctx.permissions))
    AND NOT ('CMS_PUBLISH' = ANY(v_ctx.permissions)));

  SELECT count(*) INTO v_rows FROM public.admin_resolve_context('unchained-business');
  PERFORM pg_temp.check('and says nothing at all about another application', v_rows = 0);

  -- A suspended administrator still resolves — the application needs to be
  -- able to tell "closed" from "never existed" — but resolves to nothing.
  PERFORM pg_temp.act_as(v_sofia);
  SELECT * INTO v_ctx FROM public.admin_resolve_context('tancerca');
  PERFORM pg_temp.check('a suspended administrator is reported as not active',
    v_ctx.status = 'SUSPENDED' AND NOT v_ctx.is_active);
  PERFORM pg_temp.check('and carries no permissions',
    coalesce(array_length(v_ctx.permissions, 1), 0) = 0);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 17. the integration contract';
END;
$do$;

-- ─── Result ───────────────────────────────────────────────────────────────

DO $do$
DECLARE
  v_count INTEGER := COALESCE(current_setting('admin_core_test.count', true), '0')::int;
BEGIN
  RAISE NOTICE '[PASS] Administration Core: % assertions', v_count;
END;
$do$;

-- Nothing above survives. The auth.users rows, the administrators, the
-- invitations, the compensation and the audit rows the tests generated all go
-- with the transaction.
ROLLBACK;

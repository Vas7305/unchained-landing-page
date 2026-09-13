-- ════════════════════════════════════════════════════════════
-- Unchained Security & Audit Core — contract and authorization suite
-- ════════════════════════════════════════════════════════════
-- Covers the testing requirements of the Security Core implementation brief
-- against docs/security/SECURITY_EVENT_CONTRACT_V1.md:
--
--   schema validation   valid event, invalid category, invalid severity,
--                       invalid status, malformed ids, oversized metadata
--   security            unauthorized application access, cross-application
--                       access, unauthorized creation, unauthorized
--                       modification, unauthorized deletion, sensitive-data
--                       rejection
--   correlation         multiple events sharing a correlation id, request id
--                       preservation
--   authorization       every administrative role, plus the three tiers of §29
--   persistence         events are stored and retrievable
--   immutability        persisted events cannot be modified or deleted
--                       through normal application paths
--
-- ─── How to run it ────────────────────────────────────────────────────────
-- Paste the whole file into the Studio SQL editor of the UNCHAINED project and
-- run it. It opens a transaction, builds its own fixtures, asserts, and ROLLS
-- BACK — nothing it creates survives, including the auth.users rows and every
-- event it writes.
--
--     · A pass ends with "[PASS] Security Core: NN assertions".
--     · A failure raises at the assertion that failed, naming it, and the
--       transaction aborts — so a failed run leaves no debris either.
--
-- It has to be run by hand because this project has no CI database and its
-- migrations are applied by hand. Run it after applying 20260914000001, and
-- after any change to the Core's functions, its permissions or its RLS.
--
-- ─── What it does and does not cover ──────────────────────────────────────
-- Covered: everything the DATABASE decides, which is where the security
-- boundary is. §28's isolation, §29's three tiers, §26's immutability, §41's
-- validation and §42.3's secret refusal all resolve in SQL and all are
-- exercised below.
--
-- Not covered: the security-core edge function's Deno code — HTTP dispatch,
-- the key hashing, the Super Admin gate on the Authorization header. Those
-- need a deployed function. Note what that does NOT leave untested: the key
-- AUTHORIZATION rules live in security_ingest_as_application(), not in Deno,
-- precisely so this file could execute them — and section 5 does.
--
-- The TypeScript half of validation and secret detection is covered by
-- lib/security/*.test.ts under Vitest, which runs in CI with `pnpm test`.

BEGIN;

-- ─── Fixtures ─────────────────────────────────────────────────────────────

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
  PERFORM set_config('security_test.count',
    (COALESCE(current_setting('security_test.count', true), '0')::int + 1)::text, true);
END;
$fn$;

/** A minimal valid event, as JSONB, with overrides merged over it. */
CREATE OR REPLACE FUNCTION pg_temp.event(p_overrides JSONB DEFAULT '{}'::jsonb)
RETURNS JSONB
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT jsonb_build_object(
    'event_category', 'AUTHENTICATION',
    'event_type',     'AUTH',
    'event_action',   'LOGIN_SUCCESS',
    'severity',       'INFO',
    'status',         'SUCCESS'
  ) || COALESCE(p_overrides, '{}'::jsonb);
$fn$;

/** The SHA-256 hex of an application key, as the edge function computes it. */
CREATE OR REPLACE FUNCTION pg_temp.key_hash(p_key TEXT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $fn$
  SELECT encode(sha256(convert_to(p_key, 'UTF8')), 'hex');
$fn$;

-- ─── The cast ─────────────────────────────────────────────────────────────
-- One administrator per tier of §29, plus the states that must NOT confer
-- access, plus a Super Admin and a stranger.

DO $do$
DECLARE
  v_juan      UUID;  -- TanCerca APP_ADMIN         -> APPLICATION_ADMIN tier
  v_ana       UUID;  -- Unchained CONTENT_ADMIN    -> no security permissions
  v_sara      UUID;  -- TanCerca APP_ADMIN + VIEW_ALL grant -> SECURITY_ADMIN tier
  v_sofia     UUID;  -- TanCerca APP_ADMIN, SUSPENDED
  v_owner     UUID;  -- the installation's Super Admin
  v_stranger  UUID;  -- authenticated and nothing else
BEGIN
  v_juan     := pg_temp.make_user('test.juan@security-core.invalid');
  v_ana      := pg_temp.make_user('test.ana@security-core.invalid');
  v_sara     := pg_temp.make_user('test.sara@security-core.invalid');
  v_sofia    := pg_temp.make_user('test.sofia@security-core.invalid');
  v_owner    := pg_temp.make_user('test.owner@security-core.invalid');
  v_stranger := pg_temp.make_user('test.stranger@security-core.invalid');

  INSERT INTO public.roles (user_id, role) VALUES (v_owner, 'super_admin');

  INSERT INTO public.administrators
    (id, user_id, name, email, application_slug, role_code, status)
  VALUES
    ('a1111111-1111-4111-8111-111111111111', v_juan,  'Juan Perez',  'test.juan@security-core.invalid',
     'tancerca', 'APP_ADMIN', 'ACTIVE'),
    ('a2222222-2222-4222-8222-222222222222', v_ana,   'Ana Diaz',    'test.ana@security-core.invalid',
     'unchained-business', 'CONTENT_ADMIN', 'ACTIVE'),
    ('a3333333-3333-4333-8333-333333333333', v_sara,  'Sara Molina', 'test.sara@security-core.invalid',
     'tancerca', 'APP_ADMIN', 'ACTIVE'),
    ('a4444444-4444-4444-8444-444444444444', v_sofia, 'Sofia Reyes', 'test.sofia@security-core.invalid',
     'tancerca', 'APP_ADMIN', 'SUSPENDED');

  -- Sara is the SECURITY_ADMIN of §29: an ordinary application administrator
  -- who has been granted cross-application visibility as a decision about HER,
  -- through the per-administrator seam. There is no role that confers this.
  INSERT INTO public.administrator_permission_grants (administrator_id, permission_code, effect)
  VALUES
    ('a3333333-3333-4333-8333-333333333333', 'SECURITY_EVENTS_VIEW_ALL', 'ALLOW'),
    ('a3333333-3333-4333-8333-333333333333', 'SECURITY_EVENTS_INGEST',   'ALLOW');

  -- Juan may write TanCerca events, so the ingestion tests have a non-super
  -- caller to use.
  INSERT INTO public.administrator_permission_grants (administrator_id, permission_code, effect)
  VALUES ('a1111111-1111-4111-8111-111111111111', 'SECURITY_EVENTS_INGEST', 'ALLOW');

  PERFORM set_config('security_test.juan',     v_juan::text,     true);
  PERFORM set_config('security_test.ana',      v_ana::text,      true);
  PERFORM set_config('security_test.sara',     v_sara::text,     true);
  PERFORM set_config('security_test.sofia',    v_sofia::text,    true);
  PERFORM set_config('security_test.owner',    v_owner::text,    true);
  PERFORM set_config('security_test.stranger', v_stranger::text, true);

  RAISE NOTICE '[ok] fixtures: 4 administrators, 1 super admin, 1 stranger';
END;
$do$;

-- ─── 1. Schema validation (§11, §14, §15, §18, §24) ───────────────────────

DO $do$
BEGIN
  PERFORM pg_temp.check('a valid event validates',
    public.security_validate_event(pg_temp.event()) IS NULL);

  PERFORM pg_temp.check('an unknown category is refused',
    public.security_validate_event(pg_temp.event('{"event_category":"MARKETING"}'))
      = 'invalid_event_category');

  PERFORM pg_temp.check('an invalid severity is refused',
    public.security_validate_event(pg_temp.event('{"severity":"URGENT"}'))
      = 'invalid_severity');

  PERFORM pg_temp.check('an invalid status is refused',
    public.security_validate_event(pg_temp.event('{"status":"MAYBE"}'))
      = 'invalid_status');

  PERFORM pg_temp.check('an invalid actor_type is refused',
    public.security_validate_event(pg_temp.event('{"actor_type":"ROBOT"}'))
      = 'invalid_actor_type');

  -- ─── Absence, which is not the same test as wrongness ────────────────────
  -- `NULL IN (...)` is NULL, `NOT NULL` is NULL, and a branch on a NULL
  -- condition does not fire — so a validator written the obvious way accepts an event whose
  -- severity key is simply missing. These four assertions exist because that
  -- is precisely what this one did, and the code read as though it did not.
  PERFORM pg_temp.check('an event with NO event_category is refused',
    public.security_validate_event(jsonb_build_object(
      'event_type', 'AUTH', 'event_action', 'LOGIN_SUCCESS',
      'severity', 'INFO', 'status', 'SUCCESS')) = 'invalid_event_category');

  PERFORM pg_temp.check('an event with NO severity is refused',
    public.security_validate_event(jsonb_build_object(
      'event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
      'event_action', 'LOGIN_SUCCESS', 'status', 'SUCCESS')) = 'invalid_severity');

  PERFORM pg_temp.check('an event with NO status is refused',
    public.security_validate_event(jsonb_build_object(
      'event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
      'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO')) = 'invalid_status');

  PERFORM pg_temp.check('a JSON-null severity is refused',
    public.security_validate_event(pg_temp.event('{"severity":null}'))
      = 'invalid_severity');

  PERFORM pg_temp.check('an event with no metadata key is valid',
    public.security_validate_event(pg_temp.event()) IS NULL);

  -- §18.1: a correlation id is a UUID. A malformed one is refused rather than
  -- dropped, because an event that silently lost its correlation is an
  -- investigation that silently loses a branch.
  PERFORM pg_temp.check('a malformed correlation_id is refused',
    public.security_validate_event(pg_temp.event('{"correlation_id":"order-1234"}'))
      = 'invalid_correlation_id');

  PERFORM pg_temp.check('a lowercase event_action is refused',
    public.security_validate_event(pg_temp.event('{"event_action":"login_success"}'))
      = 'invalid_event_action');

  -- §16.2 forbids an email address in actor_id outright.
  PERFORM pg_temp.check('an email address as actor_id is refused',
    public.security_validate_event(pg_temp.event('{"actor_id":"juan@example.com"}'))
      = 'invalid_actor_id');

  -- §13 permits an application-specific action where the catalogue cannot
  -- express the event. The constraint is on shape, not membership.
  PERFORM pg_temp.check('an application-specific action is accepted (§13)',
    public.security_validate_event(pg_temp.event('{"event_action":"TANCOINS_GRANTED"}')) IS NULL);

  -- §24: metadata is an object, never an array or a scalar.
  PERFORM pg_temp.check('a non-object metadata is refused',
    public.security_validate_event(pg_temp.event('{"metadata":["a","b"]}'))
      = 'invalid_metadata_object');

  PERFORM pg_temp.check('oversized metadata is refused',
    public.security_validate_event(
      pg_temp.event(jsonb_build_object('metadata',
        jsonb_build_object('dump', repeat('x', 20000))))) = 'metadata_too_large');

  RAISE NOTICE '[ok] 1. schema validation';
END;
$do$;

-- ─── 2. Sensitive-data rejection (§24, §42.3) ─────────────────────────────

DO $do$
DECLARE
  v_reason TEXT;
BEGIN
  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"password":"hunter2"}}'));
  PERFORM pg_temp.check('a password in metadata is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"user":{"access_token":"abc"}}}'));
  PERFORM pg_temp.check('a nested access token is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  -- The case a key denylist alone cannot see: a credential under an innocent
  -- key name.
  v_reason := public.security_validate_event(pg_temp.event(
    '{"metadata":{"note":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"}}'));
  PERFORM pg_temp.check('a JWT under an innocent key is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"reference":"sk_live_abcdefghij0123456789"}}'));
  PERFORM pg_temp.check('a vendor API key under an innocent key is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"note":"-----BEGIN RSA PRIVATE KEY-----"}}'));
  PERFORM pg_temp.check('a PEM private key is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"reference":"4242 4242 4242 4242"}}'));
  PERFORM pg_temp.check('a payment card number is refused, spaces and all',
    v_reason LIKE 'prohibited_data_in_metadata%');

  v_reason := public.security_validate_event(
    pg_temp.event('{"metadata":{"target":"postgres://admin:s3cret@db.internal:5432/app"}}'));
  PERFORM pg_temp.check('a connection string carrying credentials is refused',
    v_reason LIKE 'prohibited_data_in_metadata%');

  -- §20: a session identifier must never be the credential itself.
  v_reason := public.security_validate_event(pg_temp.event(
    '{"session_id":"eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U"}'));
  PERFORM pg_temp.check('a token in session_id is refused (§20)',
    v_reason = 'prohibited_data_in_session_id');

  -- ─── And the false positives that would make the rule unusable ───────────
  -- A detector that fires on ordinary fields gets switched off by the people
  -- it fires on, which protects nothing at all.
  PERFORM pg_temp.check('an ordinary 16-digit order number is accepted',
    public.security_validate_event(
      pg_temp.event('{"metadata":{"order_number":"1234567890123456"}}')) IS NULL);

  PERFORM pg_temp.check('fields that merely resemble a secret are accepted',
    public.security_validate_event(pg_temp.event(
      '{"metadata":{"authorized_at":"2026-09-12T10:00:00Z","author":"valter","idempotency_key":"abc","company":"Unchained"}}'))
      IS NULL);

  PERFORM pg_temp.check('the §24 worked example is accepted',
    public.security_validate_event(
      pg_temp.event('{"metadata":{"old_plan":"pro","new_plan":"premium"}}')) IS NULL);

  -- An already-redacted field is not a violation — otherwise a forwarding
  -- adapter could never build an acceptable event.
  PERFORM pg_temp.check('a redacted field is accepted',
    public.security_validate_event(
      pg_temp.event('{"metadata":{"password":"[REDACTED]"}}')) IS NULL);

  RAISE NOTICE '[ok] 2. sensitive-data rejection';
END;
$do$;

-- ─── 3. Persistence and server-controlled fields (§8.3, brief §12) ────────

DO $do$
DECLARE
  v_juan  UUID := current_setting('security_test.juan')::uuid;
  v_id    UUID;
  v_event public.security_events%ROWTYPE;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  SELECT id INTO v_id FROM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object(
      'actor_id',   'SHOULD_BE_IGNORED',
      'request_id', 'req_persist_1',
      'metadata',   jsonb_build_object('reason', 'ok'))));

  PERFORM pg_temp.check('an authorized ingestion returns an event id', v_id IS NOT NULL);

  SELECT * INTO v_event FROM public.security_events e WHERE e.id = v_id;

  PERFORM pg_temp.check('the event is stored and retrievable', v_event.id = v_id);
  PERFORM pg_temp.check('the application comes from the authorized scope',
    v_event.application_id = 'tancerca');
  PERFORM pg_temp.check('the environment is server-controlled (§10)',
    v_event.environment = public.security_core_environment());

  -- The brief's §12: actor_id is derived from the authenticated context and
  -- whatever the payload claimed is discarded.
  PERFORM pg_temp.check('actor_id is taken from the session, not the payload',
    v_event.actor_id = v_juan::text);
  PERFORM pg_temp.check('actor_type is forced to ADMIN for a session caller',
    v_event.actor_type = 'ADMIN');

  PERFORM pg_temp.check('created_at is server-generated (§8.3)',
    v_event.created_at IS NOT NULL AND v_event.created_at <= now());
  PERFORM pg_temp.check('the contract version is stamped (§44)',
    v_event.schema_version = '1.0');
  PERFORM pg_temp.check('the metadata is stored as given',
    v_event.metadata ->> 'reason' = 'ok');

  -- §19: the request id survives, which is what makes an event traceable back
  -- into the application's own logs.
  PERFORM pg_temp.check('the request_id is preserved (§19)',
    v_event.request_id = 'req_persist_1');

  -- An event carrying NO metadata key at all. The column is NOT NULL with a
  -- '{}' default, and a default does not save a column from an explicit NULL —
  -- so this is the assertion that the writer substitutes the empty object
  -- rather than passing the absent value straight through.
  SELECT id INTO v_id FROM public.security_ingest_event('tancerca', pg_temp.event());
  SELECT * INTO v_event FROM public.security_events e WHERE e.id = v_id;
  PERFORM pg_temp.check('an event with no metadata persists as an empty object',
    v_event.metadata = '{}'::jsonb);

  -- And a JSON-null metadata, which is the same absence spelled differently.
  SELECT id INTO v_id FROM public.security_ingest_event('tancerca',
    pg_temp.event('{"metadata":null}'));
  SELECT * INTO v_event FROM public.security_events e WHERE e.id = v_id;
  PERFORM pg_temp.check('a JSON-null metadata persists as an empty object',
    v_event.metadata = '{}'::jsonb);

  -- An invalid event is refused at the boundary, not stored and cleaned later.
  BEGIN
    PERFORM public.security_ingest_event('tancerca', pg_temp.event('{"severity":"URGENT"}'));
    PERFORM pg_temp.check('an invalid event must not be ingested', FALSE);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.check('an invalid event is refused at ingestion', TRUE);
  END;

  -- And a secret-bearing one likewise. This is the fail-safe behaviour the
  -- brief's §14 asks for: detected, refused, nothing stored.
  BEGIN
    PERFORM public.security_ingest_event('tancerca',
      pg_temp.event('{"metadata":{"password":"hunter2"}}'));
    PERFORM pg_temp.check('a secret-bearing event must not be ingested', FALSE);
  EXCEPTION WHEN check_violation THEN
    PERFORM pg_temp.check('a secret-bearing event is refused at ingestion', TRUE);
  END;

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 3. persistence and server-controlled fields';
END;
$do$;

-- ─── 4. Unauthorized creation (brief §25) ─────────────────────────────────

DO $do$
DECLARE
  v_ana      UUID := current_setting('security_test.ana')::uuid;
  v_juan     UUID := current_setting('security_test.juan')::uuid;
  v_sofia    UUID := current_setting('security_test.sofia')::uuid;
  v_stranger UUID := current_setting('security_test.stranger')::uuid;
BEGIN
  -- An administrator with no ingestion permission cannot write events.
  PERFORM pg_temp.act_as(v_ana);
  BEGIN
    PERFORM public.security_ingest_event('unchained-business', pg_temp.event());
    PERFORM pg_temp.check('an administrator without INGEST must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('an administrator without INGEST is refused', TRUE);
  END;

  -- §28: an administrator of one application cannot write into another's
  -- history, even holding ingestion for their own.
  PERFORM pg_temp.act_as(v_juan);
  BEGIN
    PERFORM public.security_ingest_event('unchained-business', pg_temp.event());
    PERFORM pg_temp.check('cross-application ingestion must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('cross-application ingestion is refused (§28)', TRUE);
  END;

  -- A suspended administrator keeps their row and loses their access.
  PERFORM pg_temp.act_as(v_sofia);
  BEGIN
    PERFORM public.security_ingest_event('tancerca', pg_temp.event());
    PERFORM pg_temp.check('a suspended administrator must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('a suspended administrator is refused', TRUE);
  END;

  PERFORM pg_temp.act_as(v_stranger);
  BEGIN
    PERFORM public.security_ingest_event('tancerca', pg_temp.event());
    PERFORM pg_temp.check('a stranger must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('a signed-in stranger is refused', TRUE);
  END;

  -- Deny by default, at the bottom of the chain.
  PERFORM pg_temp.act_as_nobody();
  BEGIN
    PERFORM public.security_ingest_event('tancerca', pg_temp.event());
    PERFORM pg_temp.check('an anonymous caller must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('an anonymous caller is refused', TRUE);
  END;

  RAISE NOTICE '[ok] 4. unauthorized creation';
END;
$do$;

-- ─── 5. Application keys and isolation (§28, §41) ─────────────────────────
-- The guarantee under test: an application key fixes the application and the
-- environment of every event written with it, so a payload claiming otherwise
-- changes nothing.

DO $do$
DECLARE
  v_owner UUID := current_setting('security_test.owner')::uuid;
  v_id    UUID;
  v_event public.security_events%ROWTYPE;
  v_key   TEXT := 'usk_test_tancerca_key_value';
BEGIN
  INSERT INTO public.security_application_keys
    (application_id, environment, label, key_hash, key_prefix, created_by)
  VALUES
    ('tancerca', 'production', 'test key', pg_temp.key_hash(v_key), 'testprefix', v_owner);

  -- The payload claims to be Frito, in development, performed by an ADMIN.
  -- Every one of those claims must lose to the key row.
  SELECT id INTO v_id FROM public.security_ingest_as_application(
    pg_temp.key_hash(v_key),
    pg_temp.event(jsonb_build_object(
      'application_id', 'frito',
      'environment',    'development',
      'actor_type',     'ADMIN',
      'actor_id',       'user-9',
      'ip_address',     '203.0.113.7',
      'user_agent',     'TanCerca/1.0',
      'device_id',      'device-abc',
      'correlation_id', 'bbbbbbbb-cccc-4ddd-8eee-ffffffffffff')));

  SELECT * INTO v_event FROM public.security_events e WHERE e.id = v_id;

  PERFORM pg_temp.check('the application comes from the key, not the payload (§28)',
    v_event.application_id = 'tancerca');
  PERFORM pg_temp.check('the environment comes from the key, not the payload (§10)',
    v_event.environment = 'production');
  PERFORM pg_temp.check('an application key cannot claim to be an ADMIN',
    v_event.actor_type = 'SERVICE');
  PERFORM pg_temp.check('the application may still name its own user (§16)',
    v_event.actor_id = 'user-9');
  PERFORM pg_temp.check('and the network data it observed is stored (§22)',
    host(v_event.ip_address) = '203.0.113.7' AND v_event.user_agent = 'TanCerca/1.0');
  PERFORM pg_temp.check('the key records that it was used',
    (SELECT k.last_used_at FROM public.security_application_keys k
      WHERE k.key_hash = pg_temp.key_hash(v_key)) IS NOT NULL);

  -- An unknown key is refused, and so is a revoked one — with the same error,
  -- so the endpoint is not an oracle for which keys exist.
  BEGIN
    PERFORM public.security_ingest_as_application(pg_temp.key_hash('usk_not_a_key'), pg_temp.event());
    PERFORM pg_temp.check('an unknown key must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('an unknown application key is refused', TRUE);
  END;

  UPDATE public.security_application_keys
     SET status = 'revoked', revoked_at = now()
   WHERE key_hash = pg_temp.key_hash(v_key);

  BEGIN
    PERFORM public.security_ingest_as_application(pg_temp.key_hash(v_key), pg_temp.event());
    PERFORM pg_temp.check('a revoked key must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('a revoked application key is refused', TRUE);
  END;

  RAISE NOTICE '[ok] 5. application keys and isolation';
END;
$do$;

-- ─── 6. Immutability (§26) ────────────────────────────────────────────────
-- The brief requires this be verified explicitly: a persisted event cannot be
-- modified or deleted through normal application paths. It is stronger than
-- that here — the trigger refuses every role, so not even this test's
-- superuser session can amend one.

DO $do$
DECLARE
  v_id UUID;
BEGIN
  SELECT e.id INTO v_id FROM public.security_events e
   WHERE e.application_id = 'tancerca' ORDER BY e.created_at DESC LIMIT 1;

  PERFORM pg_temp.check('there is a stored event to try to amend', v_id IS NOT NULL);

  BEGIN
    UPDATE public.security_events SET severity = 'INFO' WHERE id = v_id;
    PERFORM pg_temp.check('UPDATE on a security event must be refused', FALSE);
  EXCEPTION WHEN restrict_violation THEN
    PERFORM pg_temp.check('UPDATE on a security event is refused (§26)', TRUE);
  END;

  BEGIN
    DELETE FROM public.security_events WHERE id = v_id;
    PERFORM pg_temp.check('DELETE on a security event must be refused', FALSE);
  EXCEPTION WHEN restrict_violation THEN
    PERFORM pg_temp.check('DELETE on a security event is refused (§26)', TRUE);
  END;

  PERFORM pg_temp.check('the event is still there afterwards',
    EXISTS (SELECT 1 FROM public.security_events e WHERE e.id = v_id));

  -- §26's remedy: a correction is a NEW event, and EVENT_CORRECTION is in the
  -- canonical catalogue precisely so it has a name.
  PERFORM pg_temp.check('EVENT_CORRECTION is a valid action (§26)',
    public.security_validate_event(pg_temp.event(
      '{"event_category":"SYSTEM","event_type":"SYSTEM","event_action":"EVENT_CORRECTION"}'))
      IS NULL);

  RAISE NOTICE '[ok] 6. immutability';
END;
$do$;

-- ─── 7. Unauthorized modification and deletion through the panel ──────────
-- Section 6 proved the trigger. This proves the GRANTs: a delegated
-- administrator holds no privilege on the table at all, so the refusal happens
-- before the trigger is ever reached.

DO $do$
DECLARE
  v_juan UUID := current_setting('security_test.juan')::uuid;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  PERFORM pg_temp.check('an administrator cannot SELECT the raw event table (§22)',
    NOT has_table_privilege('authenticated', 'public.security_events', 'SELECT'));
  PERFORM pg_temp.check('nor the raw alert table, which carries a grouped IP (§22)',
    NOT has_table_privilege('authenticated', 'public.security_alerts', 'SELECT'));
  PERFORM pg_temp.check('an administrator cannot INSERT events directly',
    NOT has_table_privilege('authenticated', 'public.security_events', 'INSERT'));
  PERFORM pg_temp.check('an administrator cannot UPDATE events directly',
    NOT has_table_privilege('authenticated', 'public.security_events', 'UPDATE'));
  PERFORM pg_temp.check('an administrator cannot DELETE events directly',
    NOT has_table_privilege('authenticated', 'public.security_events', 'DELETE'));

  -- The website's key reaches none of it.
  PERFORM pg_temp.check('anon holds nothing on the event table',
    NOT has_table_privilege('anon', 'public.security_events', 'SELECT'));
  PERFORM pg_temp.check('anon cannot call the ingestion RPC',
    NOT has_function_privilege('anon', 'public.security_ingest_event(text,jsonb)', 'EXECUTE'));
  PERFORM pg_temp.check('a browser session cannot call the key-authenticated path',
    NOT has_function_privilege('authenticated',
      'public.security_ingest_as_application(text,jsonb)', 'EXECUTE'));

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 7. unauthorized modification and deletion';
END;
$do$;

-- ─── 8. Reading, isolation and the three tiers of §29 ─────────────────────

DO $do$
DECLARE
  v_juan     UUID := current_setting('security_test.juan')::uuid;
  v_ana      UUID := current_setting('security_test.ana')::uuid;
  v_sara     UUID := current_setting('security_test.sara')::uuid;
  v_sofia    UUID := current_setting('security_test.sofia')::uuid;
  v_owner    UUID := current_setting('security_test.owner')::uuid;
  v_stranger UUID := current_setting('security_test.stranger')::uuid;
  v_rows     INTEGER;
  v_apps     TEXT[];
BEGIN
  -- Give Unchained Business an event, so cross-application visibility has
  -- something to be visible ABOUT.
  PERFORM pg_temp.act_as(v_owner);
  PERFORM public.security_ingest_event('unchained-business',
    pg_temp.event('{"event_action":"ADMIN_LOGIN","event_category":"ADMINISTRATION","event_type":"ADMIN"}'));

  -- ── APPLICATION_ADMIN ────────────────────────────────────────────────────
  PERFORM pg_temp.act_as(v_juan);
  v_apps := public.security_readable_applications();
  PERFORM pg_temp.check('an application admin may read exactly their application',
    v_apps = ARRAY['tancerca']);

  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('and sees their own application''s events', v_rows > 0);

  SELECT count(*) INTO v_rows FROM public.security_query_events()
   WHERE application_id <> 'tancerca';
  PERFORM pg_temp.check('and no other application''s events, ever (§28)', v_rows = 0);

  -- Asking for another application by name returns nothing rather than
  -- everything. Filtering is not the security mechanism; the entitlement is.
  SELECT count(*) INTO v_rows
    FROM public.security_query_events(p_application => 'unchained-business');
  PERFORM pg_temp.check('naming another application returns nothing (brief §21)', v_rows = 0);

  -- §22: an application admin reads the event without the network data.
  SELECT count(*) INTO v_rows FROM public.security_query_events()
   WHERE ip_address IS NOT NULL OR user_agent IS NOT NULL OR device_id IS NOT NULL;
  PERFORM pg_temp.check('network and device data are withheld without PII_VIEW (§22)',
    v_rows = 0);
  PERFORM pg_temp.check('and the predicate says so', NOT public.security_can_read_pii());

  -- ── SECURITY_ADMIN ───────────────────────────────────────────────────────
  -- Sara holds the same ROLE as Juan. The only difference between them is a
  -- grant made about her as a person, which is exactly what §28 requires of
  -- cross-application access.
  PERFORM pg_temp.act_as(v_sara);
  PERFORM pg_temp.check('the cross-application grant resolves',
    public.security_has_global_permission('SECURITY_EVENTS_VIEW_ALL'));

  SELECT count(DISTINCT application_id) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('a security admin sees more than one application (§29)', v_rows > 1);

  -- ── SUPER_ADMIN ──────────────────────────────────────────────────────────
  PERFORM pg_temp.act_as(v_owner);
  PERFORM pg_temp.check('the super admin may read every registered application',
    array_length(public.security_readable_applications(), 1)
      = (SELECT count(*) FROM public.admin_applications)::int);
  PERFORM pg_temp.check('and may see network data (§22)', public.security_can_read_pii());

  -- ── The states that confer nothing ───────────────────────────────────────
  PERFORM pg_temp.act_as(v_ana);
  PERFORM pg_temp.check('a content admin has no security entitlement at all',
    COALESCE(array_length(public.security_readable_applications(), 1), 0) = 0);
  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('and sees no events', v_rows = 0);

  PERFORM pg_temp.act_as(v_sofia);
  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('a suspended administrator sees no events', v_rows = 0);

  PERFORM pg_temp.act_as(v_stranger);
  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('a signed-in stranger sees no events', v_rows = 0);

  PERFORM pg_temp.act_as_nobody();
  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('an anonymous caller sees no events', v_rows = 0);
  PERFORM pg_temp.check('and no readable applications',
    COALESCE(array_length(public.security_readable_applications(), 1), 0) = 0);

  RAISE NOTICE '[ok] 8. reading, isolation and the three tiers';
END;
$do$;

-- ─── 9. Correlation (§18, §19, §38) ───────────────────────────────────────

DO $do$
DECLARE
  v_juan        UUID := current_setting('security_test.juan')::uuid;
  v_correlation UUID := 'cccccccc-dddd-4eee-8fff-000000000001';
  v_first       UUID;
  v_rows        INTEGER;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  -- §18's worked example: one logical operation, five events, one correlation.
  SELECT id INTO v_first FROM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object('event_category', 'ORDER', 'event_type', 'ORDER',
                       'event_action', 'ORDER_CREATED',
                       'correlation_id', v_correlation, 'request_id', 'req_corr_1')));

  PERFORM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object('event_category', 'PAYMENT', 'event_type', 'PAYMENT',
                       'event_action', 'PAYMENT_CREATED',
                       'correlation_id', v_correlation, 'request_id', 'req_corr_1')));

  PERFORM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object('event_category', 'PAYMENT', 'event_type', 'PAYMENT',
                       'event_action', 'PAYMENT_COMPLETED',
                       'correlation_id', v_correlation, 'request_id', 'req_corr_2')));

  PERFORM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object('event_category', 'ORDER', 'event_type', 'DELIVERY',
                       'event_action', 'ORDER_UPDATED',
                       'correlation_id', v_correlation, 'request_id', 'req_corr_2')));

  SELECT count(*) INTO v_rows
    FROM public.security_query_events(p_correlation_id => v_correlation);
  PERFORM pg_temp.check('four events share one correlation id (§18)', v_rows = 4);

  SELECT count(*) INTO v_rows FROM public.security_related_events(v_first);
  PERFORM pg_temp.check('and the other three are reachable from the first (§38)', v_rows = 3);

  -- §19: the request id partitions the same operation into its two requests.
  SELECT count(*) INTO v_rows
    FROM public.security_query_events(p_request_id => 'req_corr_1');
  PERFORM pg_temp.check('the request id is preserved and queryable (§19)', v_rows = 2);

  SELECT count(*) INTO v_rows
    FROM public.security_query_events(p_request_id => 'req_corr_2');
  PERFORM pg_temp.check('and distinguishes the second request', v_rows = 2);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 9. correlation';
END;
$do$;

-- ─── 10. Filtering (§37) ──────────────────────────────────────────────────
-- Every filter the contract requires the interface to support.

DO $do$
DECLARE
  v_juan UUID := current_setting('security_test.juan')::uuid;
  v_rows INTEGER;
  v_id   UUID;
BEGIN
  PERFORM pg_temp.act_as(v_juan);

  SELECT id INTO v_id FROM public.security_ingest_event('tancerca', pg_temp.event(
    jsonb_build_object('event_category', 'SECURITY', 'event_type', 'SECURITY',
                       'event_action', 'SUSPICIOUS_ACTIVITY',
                       'severity', 'HIGH', 'status', 'DETECTED',
                       'resource_type', 'ACCOUNT', 'resource_id', 'acct-77',
                       'session_id', 'sess-filter-1')));

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_category => 'SECURITY');
  PERFORM pg_temp.check('filter by category', v_rows >= 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_action => 'SUSPICIOUS_ACTIVITY');
  PERFORM pg_temp.check('filter by action', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_event_type => 'SECURITY');
  PERFORM pg_temp.check('filter by event type', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_severity => 'HIGH');
  PERFORM pg_temp.check('filter by severity', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_status => 'DETECTED');
  PERFORM pg_temp.check('filter by status', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_actor_id => v_juan::text);
  PERFORM pg_temp.check('filter by actor', v_rows >= 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(
    p_resource_type => 'ACCOUNT', p_resource_id => 'acct-77');
  PERFORM pg_temp.check('filter by resource', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(p_session_id => 'sess-filter-1');
  PERFORM pg_temp.check('filter by session', v_rows = 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(
    p_environment => public.security_core_environment());
  PERFORM pg_temp.check('filter by environment', v_rows >= 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(
    p_from => now() - INTERVAL '1 hour', p_to => now() + INTERVAL '1 minute');
  PERFORM pg_temp.check('filter by date range', v_rows >= 1);

  SELECT count(*) INTO v_rows FROM public.security_query_events(
    p_from => now() - INTERVAL '10 years', p_to => now() - INTERVAL '9 years');
  PERFORM pg_temp.check('a range with nothing in it returns nothing', v_rows = 0);

  -- §38's detail view, and the bug it is easy to write: fetching a page and
  -- filtering it afterwards works until the event is not on the first page.
  SELECT count(*) INTO v_rows FROM public.security_get_event(v_id);
  PERFORM pg_temp.check('an event is retrievable by id (§38)', v_rows = 1);

  SELECT count(*) INTO v_rows
    FROM public.security_get_event('00000000-0000-4000-8000-000000000000');
  PERFORM pg_temp.check('an unknown id returns nothing rather than erroring', v_rows = 0);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 10. filtering';
END;
$do$;

-- ─── 11. Detection and alerts (§30, §31) ──────────────────────────────────

DO $do$
DECLARE
  v_owner  UUID := current_setting('security_test.owner')::uuid;
  v_alert  UUID;
  v_rows   INTEGER;
  v_count  INTEGER;
  v_i      INTEGER;
  v_key    TEXT := 'usk_test_detection_key';
BEGIN
  -- Ingested through an APPLICATION KEY rather than a session, because that is
  -- how a failed login actually arrives: TanCerca reports that one of ITS
  -- users failed to authenticate. Session ingestion derives the actor from
  -- the session and would record the administrator as the actor, which is
  -- right for an administrative action and wrong for this.
  INSERT INTO public.security_application_keys
    (application_id, environment, label, key_hash, key_prefix, created_by)
  VALUES
    ('tancerca', public.security_core_environment(), 'detection test key',
     pg_temp.key_hash(v_key), 'detectpfx', v_owner);

  -- Four failed logins for one actor. The seeded rule needs five.
  FOR v_i IN 1..4 LOOP
    PERFORM public.security_ingest_as_application(pg_temp.key_hash(v_key), pg_temp.event(
      jsonb_build_object('event_action', 'LOGIN_FAILED', 'severity', 'LOW',
                         'status', 'FAILURE', 'actor_type', 'USER',
                         'actor_id', 'brute-target')));
  END LOOP;

  SELECT count(*) INTO v_rows FROM public.security_alerts a
   WHERE a.alert_type = 'BRUTE_FORCE_DETECTED' AND a.actor_id = 'brute-target';
  PERFORM pg_temp.check('four failures raise no alert (§31: the threshold is five)',
    v_rows = 0);

  -- The fifth crosses it.
  PERFORM public.security_ingest_as_application(pg_temp.key_hash(v_key), pg_temp.event(
    jsonb_build_object('event_action', 'LOGIN_FAILED', 'severity', 'LOW',
                       'status', 'FAILURE', 'actor_type', 'USER',
                       'actor_id', 'brute-target')));

  SELECT a.id, a.event_count INTO v_alert, v_count
    FROM public.security_alerts a
   WHERE a.alert_type = 'BRUTE_FORCE_DETECTED' AND a.actor_id = 'brute-target';

  PERFORM pg_temp.check('the fifth failure raises an alert (§31)', v_alert IS NOT NULL);
  PERFORM pg_temp.check('the alert counts the events behind it', v_count = 5);

  -- §31: "Rules SHOULD reference event IDs that caused the alert."
  SELECT count(*) INTO v_rows FROM public.security_alert_events ae WHERE ae.alert_id = v_alert;
  PERFORM pg_temp.check('the alert references its causing event (§31)', v_rows >= 1);

  -- ─── Reading is a SESSION act; ingesting was not ─────────────────────────
  -- Everything above arrived through an application key, which carries no
  -- session by design. security_alert_evidence() resolves what the caller may
  -- see from auth.uid(), so with no session it correctly returns nothing —
  -- and an earlier cut of this file asserted the opposite, which is a defect
  -- in the test rather than in the function.
  PERFORM pg_temp.act_as(v_owner);

  SELECT count(*) INTO v_rows FROM public.security_alert_evidence(v_alert);
  PERFORM pg_temp.check('and the evidence is retrievable', v_rows >= 1);

  -- The same call with no session must see nothing at all.
  PERFORM pg_temp.act_as_nobody();
  SELECT count(*) INTO v_rows FROM public.security_alert_evidence(v_alert);
  PERFORM pg_temp.check('and is withheld from a caller with no session', v_rows = 0);
  PERFORM pg_temp.act_as(v_owner);

  -- A sixth must not raise a SECOND alert for the same condition.
  PERFORM public.security_ingest_as_application(pg_temp.key_hash(v_key), pg_temp.event(
    jsonb_build_object('event_action', 'LOGIN_FAILED', 'severity', 'LOW',
                       'status', 'FAILURE', 'actor_type', 'USER',
                       'actor_id', 'brute-target')));

  SELECT count(*) INTO v_rows FROM public.security_alerts a
   WHERE a.alert_type = 'BRUTE_FORCE_DETECTED' AND a.actor_id = 'brute-target';
  PERFORM pg_temp.check('a continuing condition updates the alert, never duplicates it',
    v_rows = 1);

  -- A different actor is a different condition, even inside the same window.
  FOR v_i IN 1..5 LOOP
    PERFORM public.security_ingest_as_application(pg_temp.key_hash(v_key), pg_temp.event(
      jsonb_build_object('event_action', 'LOGIN_FAILED', 'severity', 'LOW',
                         'status', 'FAILURE', 'actor_type', 'USER',
                         'actor_id', 'other-target')));
  END LOOP;

  SELECT count(*) INTO v_rows FROM public.security_alerts a
   WHERE a.alert_type = 'BRUTE_FORCE_DETECTED';
  PERFORM pg_temp.check('a different actor raises its own alert', v_rows = 2);

  -- §6 and §31: detection must not modify the events it read.
  SELECT count(*) INTO v_rows FROM public.security_events e
   WHERE e.actor_id = 'brute-target' AND e.event_action = 'LOGIN_FAILED';
  PERFORM pg_temp.check('the causing events are untouched and all still there', v_rows = 6);

  -- The alert lifecycle. §30: an alert is not an event, and this is the
  -- difference — it moves. Still acting as the Super Admin, established above.
  PERFORM pg_temp.check('the alert can be acknowledged',
    public.security_set_alert_status(v_alert, 'ACKNOWLEDGED'));
  PERFORM pg_temp.check('and records who and when',
    (SELECT a.acknowledged_by FROM public.security_alerts a WHERE a.id = v_alert) = v_owner);

  PERFORM pg_temp.check('and resolved with a note',
    public.security_set_alert_status(v_alert, 'RESOLVED', 'Password reset issued.'));
  PERFORM pg_temp.check('which is recorded',
    (SELECT a.resolution_note FROM public.security_alerts a WHERE a.id = v_alert)
      = 'Password reset issued.');

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 11. detection and alerts';
END;
$do$;

-- ─── 12. Alert authorization ──────────────────────────────────────────────

DO $do$
DECLARE
  v_juan  UUID := current_setting('security_test.juan')::uuid;
  v_ana   UUID := current_setting('security_test.ana')::uuid;
  v_alert UUID;
  v_rows  INTEGER;
BEGIN
  SELECT a.id INTO v_alert FROM public.security_alerts a
   WHERE a.application_id = 'tancerca' AND a.status = 'OPEN' LIMIT 1;
  PERFORM pg_temp.check('there is an open alert to authorize against', v_alert IS NOT NULL);

  -- APP_ADMIN holds SECURITY_ALERTS_VIEW by role, and not ALERTS_MANAGE.
  PERFORM pg_temp.act_as(v_juan);
  SELECT count(*) INTO v_rows FROM public.security_query_alerts();
  PERFORM pg_temp.check('an application admin sees their application''s alerts', v_rows >= 1);

  BEGIN
    PERFORM public.security_set_alert_status(v_alert, 'DISMISSED');
    PERFORM pg_temp.check('an administrator without ALERTS_MANAGE must be refused', FALSE);
  EXCEPTION WHEN insufficient_privilege THEN
    PERFORM pg_temp.check('an administrator without ALERTS_MANAGE is refused', TRUE);
  END;

  -- And an administrator of another application sees none of them.
  PERFORM pg_temp.act_as(v_ana);
  SELECT count(*) INTO v_rows FROM public.security_query_alerts();
  PERFORM pg_temp.check('another application''s admin sees no alerts (§28)', v_rows = 0);

  -- ─── SECURITY_ALERTS_VIEW is a real gate, not decoration ─────────────────
  -- Alerts and events are separate entitlements (§30). Denying Juan the alerts
  -- permission while leaving his events permission untouched must close the
  -- alert list and leave the event list open — if both go on reading, the
  -- alert list is really gated on the EVENTS permission and
  -- SECURITY_ALERTS_VIEW controls nothing. It did exactly that until this
  -- assertion was written.
  INSERT INTO public.administrator_permission_grants (administrator_id, permission_code, effect)
  VALUES ('a1111111-1111-4111-8111-111111111111', 'SECURITY_ALERTS_VIEW', 'DENY');

  PERFORM pg_temp.act_as(v_juan);
  SELECT count(*) INTO v_rows FROM public.security_query_alerts();
  PERFORM pg_temp.check('denying SECURITY_ALERTS_VIEW closes the alert list', v_rows = 0);

  SELECT count(*) INTO v_rows FROM public.security_query_events();
  PERFORM pg_temp.check('and leaves the event list open, which is a separate entitlement',
    v_rows > 0);

  DELETE FROM public.administrator_permission_grants
   WHERE administrator_id = 'a1111111-1111-4111-8111-111111111111'
     AND permission_code = 'SECURITY_ALERTS_VIEW';

  PERFORM pg_temp.act_as(v_juan);
  SELECT count(*) INTO v_rows FROM public.security_query_alerts();
  PERFORM pg_temp.check('and restoring it reopens the alert list', v_rows >= 1);

  PERFORM pg_temp.act_as_nobody();
  RAISE NOTICE '[ok] 12. alert authorization';
END;
$do$;

-- ─── 13. The admin_logs bridge (brief §32) ────────────────────────────────
-- The existing audit writer keeps working AND now produces a canonical event.

DO $do$
DECLARE
  v_owner  UUID := current_setting('security_test.owner')::uuid;
  v_before INTEGER;
  v_after  INTEGER;
  v_event  public.security_events%ROWTYPE;
BEGIN
  SELECT count(*) INTO v_before FROM public.admin_logs;

  PERFORM public.admin_core_log_event(
    'ADMIN_ROLE_CHANGED', 'SUCCESS', 'tancerca', NULL,
    jsonb_build_object('from', 'APP_ADMIN', 'to', 'OPERATIONS_ADMIN'),
    'info', v_owner);

  SELECT count(*) INTO v_after FROM public.admin_logs;
  PERFORM pg_temp.check('the existing audit trail still receives the event',
    v_after = v_before + 1);

  SELECT * INTO v_event FROM public.security_events e
   WHERE e.source = 'admin_core_bridge' AND e.event_action = 'ADMIN_ROLE_CHANGED'
   ORDER BY e.created_at DESC LIMIT 1;

  PERFORM pg_temp.check('and the canonical store receives it too', v_event.id IS NOT NULL);
  PERFORM pg_temp.check('classified as an administrative event (§11)',
    v_event.event_category = 'ADMINISTRATION');
  PERFORM pg_temp.check('with the actor carried across', v_event.actor_id = v_owner::text);
  PERFORM pg_temp.check('and the application preserved', v_event.application_id = 'tancerca');
  PERFORM pg_temp.check('and the metadata preserved',
    v_event.metadata ->> 'to' = 'OPERATIONS_ADMIN');

  -- A denial maps to the AUTHORIZATION category and the DENIED status.
  PERFORM public.admin_core_log_event(
    'ADMIN_CROSS_APP_ACCESS_ATTEMPT', 'DENIED', 'frito', NULL,
    jsonb_build_object('permission', 'ADMIN_VIEW'), 'critical', v_owner);

  SELECT * INTO v_event FROM public.security_events e
   WHERE e.source = 'admin_core_bridge' AND e.event_action = 'ADMIN_CROSS_APP_ACCESS_ATTEMPT'
   ORDER BY e.created_at DESC LIMIT 1;

  PERFORM pg_temp.check('a denial is an AUTHORIZATION event',
    v_event.event_category = 'AUTHORIZATION');
  PERFORM pg_temp.check('with the DENIED status (§15)', v_event.status = 'DENIED');
  PERFORM pg_temp.check('and CRITICAL severity (§14)', v_event.severity = 'CRITICAL');

  -- The bridge must never cost the caller their transaction. An unregistered
  -- application is skipped, and the admin_logs row still lands.
  SELECT count(*) INTO v_before FROM public.admin_logs;
  PERFORM public.admin_core_log_event(
    'ADMIN_ACTION', 'SUCCESS', 'no-such-application', NULL, '{}'::jsonb, 'info', v_owner);
  SELECT count(*) INTO v_after FROM public.admin_logs;
  PERFORM pg_temp.check('an unmirrorable event still reaches the existing trail',
    v_after = v_before + 1);

  -- And admin_logs remains immutable, as it was before this migration.
  BEGIN
    UPDATE public.admin_logs SET action = 'TAMPERED'
     WHERE id = (SELECT l.id FROM public.admin_logs l ORDER BY l.created_at DESC LIMIT 1);
    PERFORM pg_temp.check('admin_logs must still be append-only', FALSE);
  EXCEPTION WHEN restrict_violation THEN
    PERFORM pg_temp.check('admin_logs is still append-only', TRUE);
  END;

  RAISE NOTICE '[ok] 13. the admin_logs bridge';
END;
$do$;

-- ─── 14. The registry and the reserved permissions ────────────────────────

DO $do$
DECLARE
  v_rows INTEGER;
BEGIN
  -- §9.1: an event cannot name an application that does not exist.
  PERFORM pg_temp.check('the event store references the existing registry',
    EXISTS (SELECT 1 FROM pg_constraint
             WHERE conrelid = 'public.security_events'::regclass
               AND confrelid = 'public.admin_applications'::regclass
               AND contype = 'f'));

  PERFORM pg_temp.check('the three initial applications are registered (§9.1)',
    (SELECT count(*) FROM public.admin_applications
      WHERE slug IN ('tancerca', 'frito', 'unchained-business')) = 3);

  -- The Core adds permissions, never roles. §16.3 of the Admin Core migration
  -- would refuse a sixth role, and this is the check that says we did not try.
  PERFORM pg_temp.check('there are still exactly five canonical roles',
    (SELECT count(*) FROM public.admin_roles) = 5);

  -- §28: cross-application visibility is never conferred by a job title.
  SELECT count(*) INTO v_rows FROM public.admin_role_permissions rp
   WHERE rp.permission_code IN ('SECURITY_EVENTS_VIEW_ALL', 'SECURITY_EVENT_PII_VIEW',
                                'SECURITY_RULES_MANAGE', 'SECURITY_ALERTS_MANAGE',
                                'SECURITY_EVENTS_INGEST');
  PERFORM pg_temp.check('no delegated role holds a reserved security permission', v_rows = 0);

  -- And the one mapping that IS made.
  PERFORM pg_temp.check('APP_ADMIN may view its own application''s events',
    EXISTS (SELECT 1 FROM public.admin_role_permissions
             WHERE role_code = 'APP_ADMIN' AND permission_code = 'SECURITY_EVENTS_VIEW'));

  -- The retention foundation exists and nothing enacts it (§35, brief §23).
  PERFORM pg_temp.check('the retention policy table exists and is empty',
    (SELECT count(*) FROM public.security_retention_policies) = 0);

  RAISE NOTICE '[ok] 14. registry and reserved permissions';
END;
$do$;

-- ─── Result ───────────────────────────────────────────────────────────────

DO $do$
DECLARE
  v_count INTEGER := COALESCE(current_setting('security_test.count', true), '0')::int;
BEGIN
  RAISE NOTICE '[PASS] Security Core: % assertions', v_count;
END;
$do$;

-- Nothing above survives. The auth.users rows, the administrators, the grants,
-- the application key, every event ingested and every alert raised all go with
-- the transaction.
ROLLBACK;

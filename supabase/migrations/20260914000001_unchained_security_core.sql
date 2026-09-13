-- ════════════════════════════════════════════════════════════
-- Phase 12 — Unchained Security & Audit Core v1.0
-- ════════════════════════════════════════════════════════════
-- Implements: docs/security/SECURITY_EVENT_CONTRACT_V1.md
--             That document is the canonical contract. Where this file and it
--             disagree, the document is right and this file is the defect.
--             Section references below (§n) are to that contract unless they
--             say otherwise.
--
-- Depends on:
--   20260905000001_unchained_foundation.sql   roles, is_super_admin(), admin_logs
--   20260913000001_unchained_admin_core.sql   admin_applications, administrators,
--                                             admin_permissions, admin_has_permission(),
--                                             admin_core_log_event()
--
-- Creates:
--     security_core_settings        the installation's environment (§10)
--     security_events               the canonical event store (§7)
--     security_application_keys     hashed ingestion credentials (§41)
--     security_alerts               alerts, which are not events (§30)
--     security_alert_events         which events caused which alert (§31)
--     security_detection_rules      configurable detection (§31)
--     security_retention_policies   the retention foundation (§35)
--   + security_metadata_violations() the enforcing secret scan (§24, §42.3)
--   + security_validate_event()      the contract validator (§41)
--   + security_ingest_event()        session-authenticated ingestion
--   + security_ingest_as_application() key-authenticated ingestion
--   + security_query_events()        the authorized, redacted event explorer (§37)
--   + security_get_event()           event detail (§38)
--   + security_related_events()      correlation navigation (§18, §38)
--   + security_can_read_application() the read authorization predicate (§28)
--   ~ admin_core_log_event()         now ALSO mirrors into security_events
--
-- ─── What this phase is ───────────────────────────────────────────────────
-- The shared Security & Audit Core of §48: one event model, one store, one
-- set of enumerations, one authorization boundary, consumed by TanCerca, Frito
-- and Unchained Business alike. The Admin Platform is its administrative
-- interface and is NOT part of it — §2 is explicit that an application must
-- never depend on the panel frontend to record an event, and nothing here
-- does.
--
-- ─── Three places this file deviates from a literal reading, and why ──────
--
-- 1. THE APPLICATION REGISTRY ALREADY EXISTS.
--    §10 of the implementation brief says to create one "if one does not
--    already exist". It does: public.admin_applications, created by
--    20260913000001, holding unchained-business, tancerca and frito, already
--    referenced by every administrator row in production. security_events
--    therefore takes a FOREIGN KEY to it rather than carrying a second list
--    that would drift from the first.
--
--    The consequence is that §9.1's third canonical identifier, `unchained`,
--    is spelled `unchained-business` here. That is a deliberate, documented
--    deviation and it is the conservative one: §9.1 requires an identifier
--    that is unique, lowercase, stable and independent of the display name,
--    and `unchained-business` is all four AND is already in production use.
--    Minting a second identifier for the same property would create exactly
--    the instability §9.1 exists to prevent. See docs/security-core.md.
--
-- 2. THERE IS NO SECURITY_ADMIN ROLE, AND THERE CANNOT BE ONE.
--    §29 asks the Admin Platform to distinguish APPLICATION_ADMIN,
--    SECURITY_ADMIN and SUPER_ADMIN. 20260913000001 §16.3 asserts that
--    public.admin_roles holds EXACTLY the five canonical roles and RAISES on
--    any other — adding a sixth would make an already-applied migration
--    unappliable, which the brief forbids outright.
--
--    So the three tiers are expressed as PERMISSIONS on the model that is
--    already there, which is what that model was built for (its §26 seam):
--
--      APPLICATION_ADMIN  APP_ADMIN holds SECURITY_EVENTS_VIEW, scoped to its
--                         own application by admin_has_permission().
--      SECURITY_ADMIN     any administrator granted SECURITY_EVENTS_VIEW_ALL
--                         through administrator_permission_grants. No role
--                         maps it — §16.5-style assertions at the end of this
--                         file refuse a mapping — so it is always a decision
--                         made about a person.
--      SUPER_ADMIN        public.is_super_admin(), unchanged.
--
--    The semantics §29 asks for are delivered exactly. What is not delivered
--    is a new row in admin_roles, and that is the point.
--
-- 3. EVENTS ARE NOT SELECTABLE, EVEN BY PEOPLE WHO MAY READ THEM.
--    §22 requires that ip_address be withheld from administrators without the
--    authorization to see it. A plain SELECT grant cannot express "these rows,
--    minus three columns", so `authenticated` holds NO privilege on
--    security_events at all and every read goes through security_query_events()
--    or security_get_event(), which apply row authorization AND column
--    redaction in one place. RLS is still enabled on the table, as the second
--    lock on a door that currently has no handle.
--
-- ─── What this phase deliberately does NOT do ─────────────────────────────
-- No SIEM adapter (§39 — the model is exportable; nothing exports it yet).
-- No event_hash / previous_event_hash (§32 — "do not introduce cryptographic
-- complexity without a concrete threat model", and there is not one yet).
-- No queue, no batching, no background worker (§34 permits them, §50 forbids
-- building them before they are needed).
-- No destructive retention (§35 and the brief's §23: the schema supports
-- policies, and nothing deletes anything).
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration here: paste into the Studio SQL editor rather than
-- running `supabase db push`, which would replay history against live
-- production. Every object uses IF NOT EXISTS, CREATE OR REPLACE or
-- DROP-then-CREATE on its own name, so it is safe to run twice.

-- ─── 0. Shared touch trigger ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.security_core_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ─── 1. security_core_settings — which environment this installation IS ───
-- §10 requires that production events never be silently mixed with development
-- or test events, and the brief's §12 requires that `environment` be
-- server-controlled rather than accepted from a caller.
--
-- Both are satisfied by the same fact: an installation IS one environment, and
-- it is recorded here rather than asserted per event. An event arriving over a
-- session takes this value; an event arriving under an application key takes
-- the key's, because a key is issued for one application in one environment.
-- In neither case does the payload get a vote.
--
-- One row, by construction — the same singleton shape public.unchained_settings
-- already uses in this schema.

CREATE TABLE IF NOT EXISTS public.security_core_settings (
  id          TEXT PRIMARY KEY DEFAULT 'default',
  environment TEXT NOT NULL DEFAULT 'production',
  -- Whether ingestion is accepted at all. A kill switch that is a data change
  -- rather than a deploy: if the Core is ever the thing causing an incident,
  -- it can be silenced without touching an application.
  ingestion_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT security_core_settings_singleton CHECK (id = 'default'),
  CONSTRAINT security_core_settings_environment_valid
    CHECK (environment IN ('development', 'staging', 'production', 'test'))
);

INSERT INTO public.security_core_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;

DROP TRIGGER IF EXISTS trg_security_core_settings_updated_at ON public.security_core_settings;
CREATE TRIGGER trg_security_core_settings_updated_at
  BEFORE UPDATE ON public.security_core_settings
  FOR EACH ROW EXECUTE FUNCTION public.security_core_touch_updated_at();

CREATE OR REPLACE FUNCTION public.security_core_environment()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT COALESCE(
    (SELECT s.environment FROM public.security_core_settings s WHERE s.id = 'default'),
    'production'
  );
$fn$;

-- ─── 2. security_events — the canonical event store (§7) ──────────────────
-- Every field of §7, with the types §7 of the brief specifies: uuid,
-- timestamptz, jsonb, inet. Nullable exactly where the contract permits.
--
-- ─── Why the enumerations are CHECK constraints and not enum types ────────
-- §11.1 admits new categories by amending the contract, and §13 admits new
-- actions when the catalogue cannot express an event. A Postgres ENUM makes
-- the first of those an ALTER TYPE that cannot run inside a transaction with
-- other DDL, and makes the second impossible. A CHECK against a literal list
-- is amended by one CREATE OR REPLACE-style edit and is equally enforced.
--
-- `event_action` is deliberately NOT constrained to §13's catalogue: §13
-- permits an application-specific action where nothing in the catalogue fits,
-- so the constraint is on the SHAPE (SCREAMING_SNAKE) and the catalogue is
-- advisory, in lib/security/contract.ts. Categories and severities have no
-- such licence and are closed sets here.

CREATE TABLE IF NOT EXISTS public.security_events (
  -- §8.1. gen_random_uuid() is v4 from pgcrypto, which is what §8.1 asks for.
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- §8.2 — when it HAPPENED. Defaulted to now() for an application that does
  -- not say, which is the common case and is honest: the event happened as
  -- near to now as the Core can tell.
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- §8.3 — when the Core PERSISTED it. Server-generated, always. There is no
  -- code path in this file that lets a caller supply it, which is the whole
  -- requirement.
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- §9.1. The FK is the isolation boundary made structural: an event cannot
  -- name an application that does not exist, so a typo becomes a constraint
  -- error rather than a silently orphaned history nobody can see.
  application_id  TEXT NOT NULL REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  -- §10.
  environment     TEXT NOT NULL,

  -- §11, §12.
  event_category  TEXT NOT NULL,
  event_type      TEXT NOT NULL,
  event_action    TEXT NOT NULL,

  -- §14, §15.
  severity        TEXT NOT NULL,
  status          TEXT NOT NULL,

  -- §16.
  actor_type      TEXT NOT NULL DEFAULT 'SYSTEM',
  -- TEXT, not UUID, and not a FK. §16.2 says it SHOULD reference the stable
  -- internal user identifier — and the actor of a TanCerca event is a row in
  -- TanCerca's auth.users, in a different database this one cannot reference.
  -- A FK here would be enforceable only for Unchained's own events, which
  -- would make the column mean two different things depending on the
  -- application. It means one thing: an opaque, stable identifier.
  actor_id        TEXT,

  -- §17.
  resource_type   TEXT,
  resource_id     TEXT,

  -- §18, §19, §20.
  session_id      TEXT,
  request_id      TEXT,
  correlation_id  UUID,

  -- §21, §22, §23. inet rather than text: it is the right type, it validates
  -- on write, and it makes future subnet queries possible without a migration.
  ip_address      INET,
  user_agent      TEXT,
  device_id       TEXT,

  -- §24.
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- §44. Every event declares the contract it was written against, so a future
  -- v2 reader can tell what it is holding without guessing.
  schema_version  TEXT NOT NULL DEFAULT '1.0',

  -- How the event reached the Core. Not part of §7 and not exported to a SIEM;
  -- it exists because this installation runs a legacy bridge (§12 below) and
  -- "is this event native or mirrored from admin_logs" is the one question
  -- that decides when the bridge can be retired.
  source          TEXT NOT NULL DEFAULT 'api',

  CONSTRAINT security_events_environment_valid
    CHECK (environment IN ('development', 'staging', 'production', 'test')),

  CONSTRAINT security_events_category_valid
    CHECK (event_category IN (
      'AUTHENTICATION', 'AUTHORIZATION', 'ACCOUNT', 'SESSION', 'ADMINISTRATION',
      'DATA', 'PAYMENT', 'FINANCIAL', 'ORDER', 'SECURITY', 'API', 'SYSTEM',
      'CONTENT', 'COMMUNICATION', 'LOCATION', 'DEVICE')),

  CONSTRAINT security_events_severity_valid
    CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),

  CONSTRAINT security_events_status_valid
    CHECK (status IN ('SUCCESS', 'FAILURE', 'PENDING', 'BLOCKED', 'DENIED', 'DETECTED')),

  CONSTRAINT security_events_actor_type_valid
    CHECK (actor_type IN ('USER', 'ADMIN', 'SYSTEM', 'SERVICE', 'API', 'ANONYMOUS')),

  -- §16.2: an event with no identifiable actor carries no actor id. An
  -- ANONYMOUS event that names one is a contradiction, and in practice it is
  -- an email address or an IP in a field that must hold neither.
  CONSTRAINT security_events_anonymous_has_no_actor
    CHECK (actor_type <> 'ANONYMOUS' OR actor_id IS NULL),

  -- §16.2 again, stated where it cannot be forgotten.
  CONSTRAINT security_events_actor_id_not_email
    CHECK (actor_id IS NULL OR position('@' IN actor_id) = 0),

  CONSTRAINT security_events_type_format
    CHECK (event_type ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_events_action_format
    CHECK (event_action ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_events_resource_type_format
    CHECK (resource_type IS NULL OR resource_type ~ '^[A-Z][A-Z0-9_]{1,60}$'),

  CONSTRAINT security_events_actor_id_length
    CHECK (actor_id IS NULL OR length(actor_id) BETWEEN 1 AND 200),
  CONSTRAINT security_events_resource_id_length
    CHECK (resource_id IS NULL OR length(resource_id) BETWEEN 1 AND 200),
  CONSTRAINT security_events_session_id_length
    CHECK (session_id IS NULL OR length(session_id) BETWEEN 1 AND 200),
  CONSTRAINT security_events_request_id_length
    CHECK (request_id IS NULL OR length(request_id) BETWEEN 1 AND 200),
  CONSTRAINT security_events_device_id_length
    CHECK (device_id IS NULL OR length(device_id) BETWEEN 1 AND 200),
  -- §23: applications should avoid storing unnecessarily large user-agent data.
  CONSTRAINT security_events_user_agent_length
    CHECK (user_agent IS NULL OR length(user_agent) <= 1024),

  -- §24: metadata is a structured object, never a scalar or an array at the
  -- root, and never a dumped record. The size ceiling is the same 16 KiB
  -- lib/security/contract.ts enforces on the client.
  CONSTRAINT security_events_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  -- octet_length over the serialized form, NOT pg_column_size: the latter
  -- reports the COMPRESSED on-disk size once a value is TOASTed, so a limit
  -- written that way would be far more permissive than the 16 KiB
  -- lib/security/contract.ts enforces on the client, and the two would
  -- disagree exactly for the large payloads the limit exists to stop.
  CONSTRAINT security_events_metadata_size
    CHECK (octet_length(metadata::text) <= 16384),

  CONSTRAINT security_events_schema_version_format
    CHECK (schema_version ~ '^[0-9]+[.][0-9]+$'),
  CONSTRAINT security_events_source_valid
    CHECK (source IN ('api', 'rpc', 'admin_core_bridge', 'system'))
);

-- ─── 2.1 Indexes (§22 of the brief) ───────────────────────────────────────
-- Built from the queries the event explorer of §37 actually issues, not from
-- the column list. Every index below pays for itself on a real screen; the
-- columns NOT indexed (environment, status, event_type, user_agent, device_id)
-- are ones that only ever narrow a result already narrowed by one of these,
-- and indexing them would buy nothing and cost write throughput on the hottest
-- table in the schema.

-- The explorer's default view and its commonest filter: one application's
-- events, newest first. Also the index that serves "all events, newest first"
-- for a Super Admin, by scanning it backwards.
CREATE INDEX IF NOT EXISTS idx_security_events_application_occurred
  ON public.security_events (application_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_occurred
  ON public.security_events (occurred_at DESC);

-- Category and action are filtered together with the application far more
-- often than alone, so they are composite with it rather than standalone.
CREATE INDEX IF NOT EXISTS idx_security_events_category
  ON public.security_events (application_id, event_category, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_action
  ON public.security_events (application_id, event_action, occurred_at DESC);

-- §38's investigation paths. Partial, because most events carry none of these
-- and an index over mostly-NULL is mostly wasted pages.
CREATE INDEX IF NOT EXISTS idx_security_events_actor
  ON public.security_events (actor_id, occurred_at DESC) WHERE actor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_resource
  ON public.security_events (resource_type, resource_id, occurred_at DESC)
  WHERE resource_type IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_correlation
  ON public.security_events (correlation_id, occurred_at) WHERE correlation_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_request
  ON public.security_events (request_id, occurred_at) WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_security_events_session
  ON public.security_events (session_id, occurred_at) WHERE session_id IS NOT NULL;

-- The security overview asks one question above all others: what is wrong
-- right now. A partial index over the two severities that answer it is a few
-- pages, against a full severity index that would be as large as the table.
CREATE INDEX IF NOT EXISTS idx_security_events_elevated
  ON public.security_events (occurred_at DESC, application_id)
  WHERE severity IN ('HIGH', 'CRITICAL');

-- ─── 2.2 Immutability (§26) ───────────────────────────────────────────────
-- Append-only, enforced for EVERY role including service_role — the same
-- choice, and the same trigger shape, that 20260913000001 §11 made for
-- admin_logs. §26 is explicit that a correction is a NEW event
-- (EVENT_CORRECTION), never an edit, and this is what makes that the only
-- available option rather than the recommended one.
--
-- Nothing in this repository updates or deletes a security event. Retention,
-- if it is ever enacted, is a deliberate act that drops this trigger first and
-- puts it back afterwards — which is a visible, reviewable operation rather
-- than a DELETE that happened to be permitted.

CREATE OR REPLACE FUNCTION public.security_events_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'public.security_events is append-only: % is not permitted. Contract §26: corrections are new EVENT_CORRECTION events.', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_security_events_immutable ON public.security_events;
CREATE TRIGGER trg_security_events_immutable
  BEFORE UPDATE OR DELETE ON public.security_events
  FOR EACH ROW EXECUTE FUNCTION public.security_events_immutable();

-- ─── 3. security_application_keys — how an application authenticates ──────
-- §41.1: applications MUST authenticate with the Security Core. TanCerca and
-- Frito run on their own isolated Supabase projects and have no session in
-- this one, so what they present is an application key.
--
-- ─── The key is never stored ──────────────────────────────────────────────
-- Only its SHA-256 hash, exactly as admin_invitations stores invitation
-- tokens, and for the same reason: a dump of this table grants nobody
-- anything. The plaintext exists once, in the response that mints it, and
-- from then on only in the consuming application's secret management.
--
-- ─── A key IS the application_id and the environment ──────────────────────
-- This is the isolation mechanism of §28. An event's application and
-- environment are read off the key row, never off the payload, so TanCerca's
-- key cannot write a Frito event no matter what it sends. There is no code
-- path in this file that takes application_id from a request body.

CREATE TABLE IF NOT EXISTS public.security_application_keys (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  TEXT NOT NULL REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  environment     TEXT NOT NULL,
  -- A human label: "tancerca production ingestion, rotated 2026-09". Never a
  -- secret, and the only way to tell two live keys apart during a rotation.
  label           TEXT NOT NULL,
  key_hash        TEXT NOT NULL UNIQUE,
  -- A short, non-secret prefix of the key, so an operator can match a key in
  -- an application's config to a row here without revealing either.
  key_prefix      TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'active',
  last_used_at    TIMESTAMPTZ,
  expires_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),
  revoked_at      TIMESTAMPTZ,
  revoked_reason  TEXT,

  CONSTRAINT security_application_keys_environment_valid
    CHECK (environment IN ('development', 'staging', 'production', 'test')),
  CONSTRAINT security_application_keys_hash_format
    CHECK (key_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT security_application_keys_prefix_format
    CHECK (key_prefix ~ '^[A-Za-z0-9_-]{4,16}$'),
  CONSTRAINT security_application_keys_status_valid
    CHECK (status IN ('active', 'revoked')),
  CONSTRAINT security_application_keys_label_present
    CHECK (length(btrim(label)) > 0),
  CONSTRAINT security_application_keys_revocation_consistent
    CHECK (status = 'active' OR revoked_at IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_security_application_keys_application
  ON public.security_application_keys (application_id, status);

DROP TRIGGER IF EXISTS trg_security_application_keys_updated_at ON public.security_application_keys;
CREATE TRIGGER trg_security_application_keys_updated_at
  BEFORE UPDATE ON public.security_application_keys
  FOR EACH ROW EXECUTE FUNCTION public.security_core_touch_updated_at();

-- ─── 4. security_alerts — an alert is not an event (§30) ──────────────────
-- §30 is the distinction this table exists to preserve: an event is what
-- happened and is immutable; an alert is a condition requiring attention and
-- has a lifecycle a human moves it through. Storing them in one table would
-- have forced either a mutable event or an immutable alert, and both are wrong.
--
-- An alert references its causing events through security_alert_events rather
-- than carrying a single event_id, because §30's own example — five
-- LOGIN_FAILED events producing one BRUTE_FORCE_DETECTED — is many-to-one.

CREATE TABLE IF NOT EXISTS public.security_alerts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  TEXT NOT NULL REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  environment     TEXT NOT NULL,

  -- Which rule produced it. NULL for an alert raised by hand by an operator,
  -- which §30 does not forbid and which is how the first months of any
  -- detection system actually work.
  rule_id         UUID,
  -- What kind of condition this is: BRUTE_FORCE_DETECTED, and whatever a
  -- future rule names. Shape-constrained, not enumerated — §31 expects rules
  -- to be configurable, and an enum would make each new rule a migration.
  alert_type      TEXT NOT NULL,

  severity        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'OPEN',

  title           TEXT NOT NULL,
  summary         TEXT,

  -- What the alert is ABOUT, carried denormalized so the alert list does not
  -- have to join through the event table to render.
  actor_id        TEXT,
  resource_type   TEXT,
  resource_id     TEXT,
  correlation_id  UUID,

  first_event_at  TIMESTAMPTZ,
  last_event_at   TIMESTAMPTZ,
  event_count     INTEGER NOT NULL DEFAULT 0,

  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  acknowledged_by UUID REFERENCES auth.users(id),
  acknowledged_at TIMESTAMPTZ,
  resolved_by     UUID REFERENCES auth.users(id),
  resolved_at     TIMESTAMPTZ,
  resolution_note TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT security_alerts_environment_valid
    CHECK (environment IN ('development', 'staging', 'production', 'test')),
  CONSTRAINT security_alerts_type_format
    CHECK (alert_type ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_alerts_severity_valid
    CHECK (severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT security_alerts_status_valid
    CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED')),
  CONSTRAINT security_alerts_title_present
    CHECK (length(btrim(title)) > 0),
  CONSTRAINT security_alerts_metadata_is_object
    CHECK (jsonb_typeof(metadata) = 'object'),
  -- The lifecycle timestamps cannot disagree with the status they describe.
  CONSTRAINT security_alerts_lifecycle_consistent
    CHECK (
      (status IN ('OPEN') AND resolved_at IS NULL) OR
      (status = 'ACKNOWLEDGED' AND acknowledged_at IS NOT NULL AND resolved_at IS NULL) OR
      (status IN ('RESOLVED', 'DISMISSED') AND resolved_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_application_status
  ON public.security_alerts (application_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_alerts_open
  ON public.security_alerts (created_at DESC)
  WHERE status = 'OPEN';

DROP TRIGGER IF EXISTS trg_security_alerts_updated_at ON public.security_alerts;
CREATE TRIGGER trg_security_alerts_updated_at
  BEFORE UPDATE ON public.security_alerts
  FOR EACH ROW EXECUTE FUNCTION public.security_core_touch_updated_at();

-- ─── 4.1 security_alert_events — the evidence (§31) ───────────────────────
-- "Rules SHOULD reference event IDs that caused the alert." This is that
-- reference, and it is the reason an investigator can go from an alert to the
-- five failed logins behind it rather than to a summary of them.
--
-- ON DELETE CASCADE on the alert side only. There is no cascade from the event
-- side because there is no delete on the event side — security_events cannot
-- be deleted at all, which makes this link permanently resolvable.

CREATE TABLE IF NOT EXISTS public.security_alert_events (
  alert_id   UUID NOT NULL REFERENCES public.security_alerts(id) ON DELETE CASCADE,
  event_id   UUID NOT NULL REFERENCES public.security_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (alert_id, event_id)
);

CREATE INDEX IF NOT EXISTS idx_security_alert_events_event
  ON public.security_alert_events (event_id);

-- ─── 5. security_detection_rules — configurable detection (§31) ───────────
-- §31's example, as columns:
--
--     LOGIN_FAILED >= 5 within 5 minutes, same actor  ->  SECURITY ALERT
--
--     match_action = 'LOGIN_FAILED'
--     threshold_count = 5
--     window_seconds = 300
--     group_by = 'ACTOR'
--     alert_type = 'BRUTE_FORCE_DETECTED'
--
-- ─── Deliberately not a rule ENGINE ───────────────────────────────────────
-- The brief's §18 and the contract's §50 both say the same thing: build the
-- extensible foundation, not a SIEM. So a rule is a threshold over a window
-- grouped by one dimension, which is what every detection anybody has actually
-- asked for here, and it is evaluated by forty lines of SQL in §10 below.
--
-- It is NOT a DSL, not a scripting hook and not a boolean expression tree.
-- When a rule arrives that this shape cannot express, the honest move is to
-- add the column that expresses it — not to have pre-built a language for
-- rules nobody has written yet.

CREATE TABLE IF NOT EXISTS public.security_detection_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',

  -- NULL means "every application". A rule scoped to one application names it.
  application_id  TEXT REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  -- NULL means "every environment".
  environment     TEXT,

  enabled         BOOLEAN NOT NULL DEFAULT FALSE,

  -- What the rule matches. NULL in any of these means "any".
  match_category  TEXT,
  match_action    TEXT,
  match_status    TEXT,
  match_min_severity TEXT,

  -- The threshold, the window, and what makes two events "the same".
  threshold_count INTEGER NOT NULL DEFAULT 1,
  window_seconds  INTEGER NOT NULL DEFAULT 300,
  group_by        TEXT NOT NULL DEFAULT 'ACTOR',

  -- What it raises.
  alert_type      TEXT NOT NULL,
  alert_severity  TEXT NOT NULL DEFAULT 'HIGH',

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by      UUID REFERENCES auth.users(id),

  CONSTRAINT security_detection_rules_code_format
    CHECK (code ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_detection_rules_environment_valid
    CHECK (environment IS NULL OR environment IN ('development', 'staging', 'production', 'test')),
  CONSTRAINT security_detection_rules_category_valid
    CHECK (match_category IS NULL OR match_category IN (
      'AUTHENTICATION', 'AUTHORIZATION', 'ACCOUNT', 'SESSION', 'ADMINISTRATION',
      'DATA', 'PAYMENT', 'FINANCIAL', 'ORDER', 'SECURITY', 'API', 'SYSTEM',
      'CONTENT', 'COMMUNICATION', 'LOCATION', 'DEVICE')),
  CONSTRAINT security_detection_rules_action_format
    CHECK (match_action IS NULL OR match_action ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_detection_rules_status_valid
    CHECK (match_status IS NULL OR match_status IN
      ('SUCCESS', 'FAILURE', 'PENDING', 'BLOCKED', 'DENIED', 'DETECTED')),
  CONSTRAINT security_detection_rules_min_severity_valid
    CHECK (match_min_severity IS NULL OR match_min_severity IN
      ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT security_detection_rules_threshold_valid
    CHECK (threshold_count BETWEEN 1 AND 10000),
  -- Bounded above at a day. A window longer than that is a report, not a
  -- detection, and evaluating it on the ingestion path would be a scan.
  CONSTRAINT security_detection_rules_window_valid
    CHECK (window_seconds BETWEEN 1 AND 86400),
  CONSTRAINT security_detection_rules_group_by_valid
    CHECK (group_by IN ('ACTOR', 'IP', 'RESOURCE', 'SESSION', 'APPLICATION')),
  CONSTRAINT security_detection_rules_alert_type_format
    CHECK (alert_type ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT security_detection_rules_alert_severity_valid
    CHECK (alert_severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'))
);

CREATE INDEX IF NOT EXISTS idx_security_detection_rules_enabled
  ON public.security_detection_rules (enabled, match_action)
  WHERE enabled;

DROP TRIGGER IF EXISTS trg_security_detection_rules_updated_at ON public.security_detection_rules;
CREATE TRIGGER trg_security_detection_rules_updated_at
  BEFORE UPDATE ON public.security_detection_rules
  FOR EACH ROW EXECUTE FUNCTION public.security_core_touch_updated_at();

-- The alert's rule reference, added now that the rules table exists.
DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'security_alerts_rule_fk'
       AND conrelid = 'public.security_alerts'::regclass
  ) THEN
    ALTER TABLE public.security_alerts
      ADD CONSTRAINT security_alerts_rule_fk
      FOREIGN KEY (rule_id) REFERENCES public.security_detection_rules(id) ON DELETE SET NULL;
  END IF;
END;
$do$;

-- ─── 6. security_retention_policies — the foundation only (§35) ───────────
-- §35 requires retention to be CONFIGURABLE, by application, category,
-- severity and environment. The brief's §23 requires that nothing destructive
-- be implemented now.
--
-- Both are satisfied by a table that is read by nothing. It records the policy
-- so that the decision is expressible and reviewable today; enacting it is a
-- separate, deliberate piece of work that will have to drop the immutability
-- trigger to do its job — which is exactly the amount of friction deleting
-- audit history should have.
--
-- NULL in a scope column means "any", so the resolution order is most-specific
-- wins, and a single row with four NULLs is a valid installation-wide default.

CREATE TABLE IF NOT EXISTS public.security_retention_policies (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  TEXT REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  event_category  TEXT,
  severity        TEXT,
  environment     TEXT,
  retain_days     INTEGER NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT security_retention_policies_category_valid
    CHECK (event_category IS NULL OR event_category IN (
      'AUTHENTICATION', 'AUTHORIZATION', 'ACCOUNT', 'SESSION', 'ADMINISTRATION',
      'DATA', 'PAYMENT', 'FINANCIAL', 'ORDER', 'SECURITY', 'API', 'SYSTEM',
      'CONTENT', 'COMMUNICATION', 'LOCATION', 'DEVICE')),
  CONSTRAINT security_retention_policies_severity_valid
    CHECK (severity IS NULL OR severity IN ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL')),
  CONSTRAINT security_retention_policies_environment_valid
    CHECK (environment IS NULL OR environment IN
      ('development', 'staging', 'production', 'test')),
  -- At least a month, at most a century. The lower bound is the meaningful
  -- one: a retention policy shorter than an incident investigation is a way to
  -- lose the evidence while believing you have a policy.
  CONSTRAINT security_retention_policies_days_valid
    CHECK (retain_days BETWEEN 30 AND 36500)
);

CREATE UNIQUE INDEX IF NOT EXISTS security_retention_policies_scope_unique
  ON public.security_retention_policies (
    COALESCE(application_id, '*'),
    COALESCE(event_category, '*'),
    COALESCE(severity, '*'),
    COALESCE(environment, '*')
  );

DROP TRIGGER IF EXISTS trg_security_retention_policies_updated_at ON public.security_retention_policies;
CREATE TRIGGER trg_security_retention_policies_updated_at
  BEFORE UPDATE ON public.security_retention_policies
  FOR EACH ROW EXECUTE FUNCTION public.security_core_touch_updated_at();

-- ─── 7. The secret scan (§24, §25, §42.3) ─────────────────────────────────
-- The enforcing half of lib/security/secrets.ts. The TypeScript copy runs in
-- the application and catches mistakes early; THIS one runs at the boundary
-- and cannot be skipped, which is the only reason it is safe for the other to
-- exist.
--
-- ─── Why a key denylist alone is not enough ───────────────────────────────
-- It catches {"password": "..."} and misses every one of these:
--
--     {"value": "eyJhbGciOi..."}              a JWT under an innocent name
--     {"header": "Bearer sk_live_..."}        a credential inside a string
--     {"note": "-----BEGIN RSA PRIVATE KEY"}  a key pasted into a comment
--     {"reference": "4242 4242 4242 4242"}    a PAN with spaces in it
--
-- So keys are matched after normalization (access_token, accessToken,
-- ACCESS-TOKEN and "Access Token" are one name), and values are matched
-- against the shapes credentials actually have.

-- 7.1 Which key rule a normalized key trips.
--
-- `pan`, `otp`, `ssn`, `iban`, `cvv` and `cvc` are compared whole rather than
-- as substrings: `pan` inside `company`, `panel`, `japan` or `expansion` is
-- not a card number, and a rule that fires on innocent fields gets suppressed
-- by the people it fires on.
CREATE OR REPLACE FUNCTION public.security_prohibited_key(p_key TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_norm TEXT;
  v_frag TEXT;
BEGIN
  v_norm := regexp_replace(lower(COALESCE(p_key, '')), '[^a-z0-9]', '', 'g');
  IF v_norm = '' THEN
    RETURN NULL;
  END IF;

  FOREACH v_frag IN ARRAY ARRAY['pan', 'otp', 'ssn', 'iban', 'cvv', 'cvc'] LOOP
    IF v_norm = v_frag THEN
      RETURN 'prohibited-key:' || v_frag;
    END IF;
  END LOOP;

  FOREACH v_frag IN ARRAY ARRAY[
    'password', 'passwd', 'passphrase',
    'token', 'secret', 'apikey', 'privatekey', 'publickey',
    'credential', 'authorization', 'sessionkey', 'encryptionkey', 'signingkey',
    'cardnumber', 'cardnum', 'securitycode',
    'clientsecret', 'refreshtoken', 'accesstoken', 'bearer',
    'mfacode', 'totp', 'recoverycode', 'backupcode'
  ] LOOP
    IF position(v_frag IN v_norm) > 0 THEN
      RETURN 'prohibited-key:' || v_frag;
    END IF;
  END LOOP;

  RETURN NULL;
END;
$fn$;

-- 7.2 The Luhn checksum.
--
-- Every real payment card number satisfies it; an arbitrary 16-digit number
-- satisfies it about one time in ten. That is what turns "any long digit run"
-- — which would match order numbers, millisecond timestamps and phone numbers,
-- and would therefore be turned off within a week — into a rule that is
-- usually right.
CREATE OR REPLACE FUNCTION public.security_luhn_valid(p_digits TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_sum    INTEGER := 0;
  v_double BOOLEAN := FALSE;
  v_digit  INTEGER;
  v_i      INTEGER;
BEGIN
  IF p_digits IS NULL OR length(p_digits) < 13 OR length(p_digits) > 19 THEN
    RETURN FALSE;
  END IF;

  FOR v_i IN REVERSE length(p_digits)..1 LOOP
    v_digit := ascii(substr(p_digits, v_i, 1)) - 48;
    IF v_digit < 0 OR v_digit > 9 THEN
      RETURN FALSE;
    END IF;
    IF v_double THEN
      v_digit := v_digit * 2;
      IF v_digit > 9 THEN
        v_digit := v_digit - 9;
      END IF;
    END IF;
    v_sum := v_sum + v_digit;
    v_double := NOT v_double;
  END LOOP;

  RETURN v_sum % 10 = 0;
END;
$fn$;

-- 7.3 Which value rule a string trips.
--
-- Each pattern is anchored to something structural rather than to a keyword,
-- because a secret does not stop being one when the field is renamed. `eyJ` is
-- `{"` in base64url, which is what makes the JWT rule specific rather than
-- "any three dot-separated blobs".
CREATE OR REPLACE FUNCTION public.security_prohibited_value(p_text TEXT)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_candidate TEXT;
  v_digits    TEXT;
BEGIN
  IF p_text IS NULL OR length(p_text) < 8 THEN
    RETURN NULL;
  END IF;

  IF p_text ~ '-----BEGIN [A-Z ]*PRIVATE KEY-----' THEN
    RETURN 'pem-private-key';
  END IF;
  IF p_text ~ 'eyJ[A-Za-z0-9_-]{8,}[.][A-Za-z0-9_-]{8,}[.][A-Za-z0-9_-]{8,}' THEN
    RETURN 'jwt';
  END IF;
  IF p_text ~* '(^|[^A-Za-z])bearer[[:space:]]+[A-Za-z0-9._~+/-]{16,}' THEN
    RETURN 'bearer-token';
  END IF;
  IF p_text ~ '(^|[^A-Za-z])Basic[[:space:]]+[A-Za-z0-9+/]{16,}={0,2}' THEN
    RETURN 'basic-auth';
  END IF;
  IF p_text ~ '(^|[^A-Za-z0-9])[sr]k_(live|test)_[A-Za-z0-9]{16,}' THEN
    RETURN 'stripe-key';
  END IF;
  IF p_text ~ '(^|[^A-Z0-9])(AKIA|ASIA)[0-9A-Z]{16}' THEN
    RETURN 'aws-access-key-id';
  END IF;
  IF p_text ~ '(^|[^A-Za-z0-9])AIza[0-9A-Za-z_-]{35}' THEN
    RETURN 'google-api-key';
  END IF;
  IF p_text ~ '(^|[^A-Za-z0-9])gh[pousr]_[A-Za-z0-9]{36,}' THEN
    RETURN 'github-token';
  END IF;
  IF p_text ~ '(^|[^A-Za-z0-9])xox[abposr]-[A-Za-z0-9-]{10,}' THEN
    RETURN 'slack-token';
  END IF;
  -- A URL carrying credentials in its authority section, which is what a
  -- connection string is.
  IF p_text ~* '[a-z][a-z0-9+.-]*://[^/[:space:]:@]+:[^/[:space:]@]+@' THEN
    RETURN 'url-credentials';
  END IF;

  -- Payment card numbers: candidate digit runs, then Luhn.
  FOR v_candidate IN
    SELECT m[1] FROM regexp_matches(p_text, '([0-9][0-9 -]{11,21}[0-9])', 'g') AS m
  LOOP
    v_digits := regexp_replace(v_candidate, '[^0-9]', '', 'g');
    IF public.security_luhn_valid(v_digits) THEN
      RETURN 'payment-card-number';
    END IF;
  END LOOP;

  RETURN NULL;
END;
$fn$;

-- 7.4 Every prohibited thing in a metadata object.
--
-- Returns `path:rule` strings and NEVER the offending value — a violation is
-- reported, logged and sometimes stored, and a report that quoted the secret
-- it found would be the leak it was written to prevent.
--
-- The depth limit is the same rule as the size limit, approached from a
-- different direction: §42.4 forbids storing whole records, and six levels of
-- nesting inside an audit event is a record.
CREATE OR REPLACE FUNCTION public.security_metadata_violations(
  p_value JSONB,
  p_path  TEXT DEFAULT '',
  p_depth INTEGER DEFAULT 0
)
RETURNS TEXT[]
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_out       TEXT[] := ARRAY[]::TEXT[];
  v_key       TEXT;
  v_child     JSONB;
  v_childpath TEXT;
  v_rule      TEXT;
  v_index     INTEGER := 0;
  v_type      TEXT;
BEGIN
  IF p_value IS NULL THEN
    RETURN v_out;
  END IF;

  IF p_depth > 6 THEN
    RETURN ARRAY[COALESCE(NULLIF(p_path, ''), '<root>') || ':max-depth-exceeded'];
  END IF;

  v_type := jsonb_typeof(p_value);

  IF v_type = 'object' THEN
    FOR v_key, v_child IN SELECT e.key, e.value FROM jsonb_each(p_value) AS e LOOP
      v_childpath := CASE WHEN p_path = '' THEN v_key ELSE p_path || '.' || v_key END;
      v_rule := public.security_prohibited_key(v_key);
      IF v_rule IS NOT NULL AND v_child #>> '{}' IS NOT DISTINCT FROM '[REDACTED]' THEN
        -- An already-redacted field is not a violation. lib/security/secrets.ts
        -- `redactSecrets()` produces exactly this shape for an adapter
        -- forwarding events it did not author, and without this branch the
        -- boundary would refuse its own redaction — leaving such an adapter no
        -- way to construct an acceptable event at all.
        --
        -- The KEY is deliberately allowed to survive: {"password":"[REDACTED]"}
        -- tells an investigator a password field was present and withheld,
        -- which is worth more than the field silently vanishing, and it
        -- discloses nothing.
        NULL;
      ELSIF v_rule IS NOT NULL THEN
        -- Otherwise the key alone condemns the field. Descending would only
        -- produce more findings about the same secret.
        v_out := v_out || (v_childpath || ':' || v_rule);
      ELSE
        v_out := v_out || public.security_metadata_violations(v_child, v_childpath, p_depth + 1);
      END IF;
    END LOOP;

  ELSIF v_type = 'array' THEN
    FOR v_child IN SELECT e.value FROM jsonb_array_elements(p_value) AS e LOOP
      v_childpath := COALESCE(NULLIF(p_path, ''), '<root>') || '[' || v_index || ']';
      v_out := v_out || public.security_metadata_violations(v_child, v_childpath, p_depth + 1);
      v_index := v_index + 1;
    END LOOP;

  ELSIF v_type = 'string' THEN
    v_rule := public.security_prohibited_value(p_value #>> '{}');
    IF v_rule IS NOT NULL THEN
      v_out := v_out || (COALESCE(NULLIF(p_path, ''), '<root>') || ':' || v_rule);
    END IF;
  END IF;

  RETURN v_out;
END;
$fn$;

-- ─── 8. The validator (§41) ───────────────────────────────────────────────
-- Returns NULL for an acceptable event, or a short machine-readable reason.
--
-- ─── Why it returns a code and not a sentence ─────────────────────────────
-- The brief's §28: errors reaching a client must not expose database
-- internals. A code like `invalid_severity` tells an integrating developer
-- exactly what to fix and tells an attacker probing the endpoint nothing about
-- the schema, the SQL or the storage.
--
-- The CHECK constraints on security_events enforce most of these a second
-- time. That is not redundancy for its own sake: a constraint violation is a
-- 500-shaped failure with a Postgres error string, and this function is what
-- turns the same condition into a clean 400 before that happens.
CREATE OR REPLACE FUNCTION public.security_validate_event(p_event JSONB)
RETURNS TEXT
LANGUAGE plpgsql
IMMUTABLE
SET search_path = ''
AS $fn$
DECLARE
  v_violations TEXT[];
  v_metadata   JSONB;
  v_text       TEXT;
BEGIN
  IF p_event IS NULL OR jsonb_typeof(p_event) <> 'object' THEN
    RETURN 'invalid_event_object';
  END IF;

  -- ─── Why every enum test below is COALESCE'd ────────────────────────────
  -- `NULL IN (...)` is NULL, `NOT NULL` is NULL, and `IF NULL THEN` does not
  -- fire. Written the obvious way — `IF NOT (p_event ->> 'severity' IN (...))`
  -- — this function therefore ACCEPTS an event whose severity key is missing
  -- altogether, which is the one thing a validator must never do: fail open.
  -- The absent value reached the INSERT instead and died on a NOT NULL
  -- constraint, turning a clean 400 into a 500 and, had the column ever been
  -- nullable, into a stored event with no severity at all.
  --
  -- COALESCE to the empty string makes absence a value that fails the test
  -- like any other invalid one. The event_type and event_action checks below
  -- were always written this way; these three were not.

  -- §11.1 — the sixteen canonical categories, and no others.
  IF COALESCE(p_event ->> 'event_category', '') NOT IN (
      'AUTHENTICATION', 'AUTHORIZATION', 'ACCOUNT', 'SESSION', 'ADMINISTRATION',
      'DATA', 'PAYMENT', 'FINANCIAL', 'ORDER', 'SECURITY', 'API', 'SYSTEM',
      'CONTENT', 'COMMUNICATION', 'LOCATION', 'DEVICE') THEN
    RETURN 'invalid_event_category';
  END IF;

  -- §12 — shape, not catalogue. §13 permits an application-specific action.
  IF COALESCE(p_event ->> 'event_type', '') !~ '^[A-Z][A-Z0-9_]{1,60}$' THEN
    RETURN 'invalid_event_type';
  END IF;
  IF COALESCE(p_event ->> 'event_action', '') !~ '^[A-Z][A-Z0-9_]{1,60}$' THEN
    RETURN 'invalid_event_action';
  END IF;

  -- §14, §15.
  IF COALESCE(p_event ->> 'severity', '') NOT IN
      ('INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL') THEN
    RETURN 'invalid_severity';
  END IF;
  IF COALESCE(p_event ->> 'status', '') NOT IN
      ('SUCCESS', 'FAILURE', 'PENDING', 'BLOCKED', 'DENIED', 'DETECTED') THEN
    RETURN 'invalid_status';
  END IF;

  -- §16.1. actor_type is OPTIONAL — the entry points assign one when the
  -- caller omits it — so absence COALESCEs to a value that passes rather than
  -- to the empty string. Written in the same COALESCE-then-NOT-IN shape as
  -- every other enum test above, so that the fail-open `NOT (x IN (...))`
  -- pattern appears nowhere in this schema and a check can say so.
  IF COALESCE(p_event ->> 'actor_type', 'SYSTEM') NOT IN
      ('USER', 'ADMIN', 'SYSTEM', 'SERVICE', 'API', 'ANONYMOUS') THEN
    RETURN 'invalid_actor_type';
  END IF;

  -- §16.2 — no email address in actor_id, ever.
  v_text := p_event ->> 'actor_id';
  IF v_text IS NOT NULL AND position('@' IN v_text) > 0 THEN
    RETURN 'invalid_actor_id';
  END IF;
  IF v_text IS NOT NULL AND length(v_text) > 200 THEN
    RETURN 'invalid_actor_id';
  END IF;

  -- §17.1.
  v_text := p_event ->> 'resource_type';
  IF v_text IS NOT NULL AND v_text !~ '^[A-Z][A-Z0-9_]{1,60}$' THEN
    RETURN 'invalid_resource_type';
  END IF;

  -- §18.1 — a correlation id is a UUID. Malformed is rejected rather than
  -- dropped: an event that silently lost its correlation is an investigation
  -- that silently loses a branch.
  v_text := p_event ->> 'correlation_id';
  IF v_text IS NOT NULL
     AND v_text !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    RETURN 'invalid_correlation_id';
  END IF;

  -- §19, §20, §21 — opaque identifiers, bounded.
  IF length(COALESCE(p_event ->> 'request_id', '')) > 200 THEN
    RETURN 'invalid_request_id';
  END IF;
  IF length(COALESCE(p_event ->> 'session_id', '')) > 200 THEN
    RETURN 'invalid_session_id';
  END IF;
  IF length(COALESCE(p_event ->> 'device_id', '')) > 200 THEN
    RETURN 'invalid_device_id';
  END IF;
  -- §20 is explicit: a session identifier must never be the credential.
  IF public.security_prohibited_value(p_event ->> 'session_id') IS NOT NULL THEN
    RETURN 'prohibited_data_in_session_id';
  END IF;

  -- §23.
  IF length(COALESCE(p_event ->> 'user_agent', '')) > 1024 THEN
    RETURN 'invalid_user_agent';
  END IF;

  -- §24 — an object, within the size ceiling, free of credentials.
  IF p_event ? 'metadata' AND jsonb_typeof(p_event -> 'metadata') NOT IN ('object', 'null') THEN
    RETURN 'invalid_metadata_object';
  END IF;

  v_metadata := COALESCE(p_event -> 'metadata', '{}'::jsonb);
  IF jsonb_typeof(v_metadata) = 'null' THEN
    v_metadata := '{}'::jsonb;
  END IF;

  -- Bytes of the serialized form, which is what lib/security/secrets.ts
  -- measures and what the table's CHECK enforces. See that constraint for why
  -- pg_column_size() would be the wrong ruler.
  IF octet_length(v_metadata::text) > 16384 THEN
    RETURN 'metadata_too_large';
  END IF;

  v_violations := public.security_metadata_violations(v_metadata);
  IF array_length(v_violations, 1) > 0 THEN
    -- The paths are named; the values never are. An integrating developer sees
    -- which field is at fault, which is the whole point of failing loudly.
    RETURN 'prohibited_data_in_metadata:' || array_to_string(v_violations, ',');
  END IF;

  RETURN NULL;
END;
$fn$;

-- ─── 9. The writer ────────────────────────────────────────────────────────
-- The single INSERT into security_events in this entire schema. Both public
-- ingestion paths funnel through it, which is what makes "validated,
-- server-timestamped, application-scoped" a property of the table rather than
-- a habit of its callers.
--
-- ─── What it takes from the caller and what it does not ───────────────────
-- p_application and p_environment come from the CREDENTIAL — the key row, or
-- the caller's authorized administrator scope — and are passed in by the
-- entry point that resolved them. p_event is the untrusted payload. The
-- function never reads application_id or environment out of p_event, and
-- there is no parameter by which a caller could ask it to.
--
-- created_at is not a parameter at all: it is the column default, which is
-- now(), which is §8.3.
--
-- REVOKEd from everybody. It is reachable only from the two SECURITY DEFINER
-- entry points below, which run as the owner.
CREATE OR REPLACE FUNCTION public.security_write_event(
  p_application  TEXT,
  p_environment  TEXT,
  p_event        JSONB,
  p_actor_type   TEXT,
  p_actor_id     TEXT,
  p_session_id   TEXT,
  p_source       TEXT
)
RETURNS TABLE (id UUID, occurred_at TIMESTAMPTZ)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_reason      TEXT;
  v_id          UUID;
  v_occurred_at TIMESTAMPTZ;
  v_ip          INET;
BEGIN
  -- The application and the environment are the caller's ENTITLEMENT, resolved
  -- by the entry point above, never read from p_event. A NULL here is a defect
  -- in an entry point rather than a bad payload — and it would otherwise reach
  -- the INSERT and surface as a bare NOT NULL violation, which tells the
  -- caller nothing and leaks a column name. The one case that can reach it
  -- today is a Super Admin calling security_ingest_event(NULL, …): every
  -- permission check short-circuits for them, so no earlier check refuses it.
  IF p_application IS NULL OR p_environment IS NULL THEN
    RAISE EXCEPTION 'security_core_invalid_event:missing_application_scope'
      USING ERRCODE = 'check_violation';
  END IF;

  v_reason := public.security_validate_event(p_event);
  IF v_reason IS NOT NULL THEN
    RAISE EXCEPTION 'security_core_invalid_event:%', v_reason
      USING ERRCODE = 'check_violation';
  END IF;

  -- §22: the address is optional and must not fail an event. A caller that
  -- passes a hostname, an `x-forwarded-for` list or the string "unknown" gets
  -- the event recorded without an address rather than an error — the address
  -- is context, and losing the event to save it would be the wrong trade.
  BEGIN
    v_ip := NULLIF(p_event ->> 'ip_address', '')::INET;
  EXCEPTION WHEN OTHERS THEN
    v_ip := NULL;
  END;

  -- §8.2: occurred_at is the caller's to state, because only the caller knows
  -- when the thing happened. A missing or unparseable value becomes now(),
  -- which is the closest true statement the Core can make.
  BEGIN
    v_occurred_at := COALESCE(NULLIF(p_event ->> 'occurred_at', '')::TIMESTAMPTZ, now());
  EXCEPTION WHEN OTHERS THEN
    v_occurred_at := now();
  END;

  -- A future occurred_at is a clock problem, not a report about the future.
  -- Clamping rather than rejecting keeps the event and keeps the trail
  -- orderable, which is what an investigator needs from it.
  IF v_occurred_at > now() + INTERVAL '5 minutes' THEN
    v_occurred_at := now();
  END IF;

  INSERT INTO public.security_events (
    occurred_at, application_id, environment,
    event_category, event_type, event_action,
    severity, status,
    actor_type, actor_id,
    resource_type, resource_id,
    session_id, request_id, correlation_id,
    ip_address, user_agent, device_id,
    metadata, schema_version, source
  ) VALUES (
    v_occurred_at,
    p_application,
    p_environment,
    p_event ->> 'event_category',
    p_event ->> 'event_type',
    p_event ->> 'event_action',
    p_event ->> 'severity',
    p_event ->> 'status',
    p_actor_type,
    p_actor_id,
    NULLIF(p_event ->> 'resource_type', ''),
    NULLIF(p_event ->> 'resource_id', ''),
    p_session_id,
    NULLIF(p_event ->> 'request_id', ''),
    NULLIF(p_event ->> 'correlation_id', '')::UUID,
    v_ip,
    NULLIF(p_event ->> 'user_agent', ''),
    NULLIF(p_event ->> 'device_id', ''),
    -- jsonb_typeof() of an ABSENT key is NULL, not 'object', so an event with
    -- no metadata at all falls to the ELSE and lands as '{}'. An earlier cut
    -- wrapped the test in COALESCE(..., '{}') and then returned the raw
    -- `p_event -> 'metadata'`: the guard passed on the substitute while the
    -- branch handed back the NULL, which the column's NOT NULL then refused.
    -- Test and return the same expression.
    CASE
      WHEN jsonb_typeof(p_event -> 'metadata') = 'object'
      THEN p_event -> 'metadata'
      ELSE '{}'::jsonb
    END,
    COALESCE(NULLIF(p_event ->> 'schema_version', ''), '1.0'),
    p_source
  )
  RETURNING security_events.id, security_events.occurred_at
    INTO v_id, v_occurred_at;

  -- Detection runs after the event is safely stored, never before, and cannot
  -- prevent it being stored — see §10.
  PERFORM public.security_evaluate_rules(v_id);

  RETURN QUERY SELECT v_id, v_occurred_at;
END;
$fn$;

-- ─── 10. Detection (§31) ──────────────────────────────────────────────────
-- Evaluates every enabled rule that matches the event just written, and raises
-- an alert where the threshold is met inside the window.
--
-- ─── Three properties this function must have ─────────────────────────────
--
-- 1. IT MUST NOT MODIFY THE EVENT. §6 and §31 both require it. It only reads
--    security_events and writes security_alerts.
--
-- 2. IT MUST NOT PREVENT INGESTION. A rule that errors — a bad group_by, a
--    constraint on the alert — must not take the event with it. Hence the
--    EXCEPTION block: a detection failure is a WARNING and the event stands.
--    The alternative is a detection bug that silently stops all security
--    logging, which is strictly worse than a missed alert.
--
-- 3. IT MUST NOT EMIT A SECURITY EVENT. That is the recursion the brief's §27
--    names: ingestion triggers detection, detection emits an event, that event
--    triggers detection. Alerts are written to security_alerts and nowhere
--    else, and this function contains no call to any ingestion path.
--
-- ─── Alert de-duplication ─────────────────────────────────────────────────
-- A sixth failed login inside the window must not raise a second alert. An
-- OPEN alert of the same type, for the same group, is UPDATED with the wider
-- span and the new event instead — which is why security_alerts is mutable
-- and security_events is not.
CREATE OR REPLACE FUNCTION public.security_evaluate_rules(p_event_id UUID)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_event   public.security_events%ROWTYPE;
  v_rule    public.security_detection_rules%ROWTYPE;
  v_key     TEXT;
  v_count   INTEGER;
  v_since   TIMESTAMPTZ;
  v_alert   UUID;
  v_first   TIMESTAMPTZ;
  v_rank    INTEGER;
BEGIN
  SELECT * INTO v_event FROM public.security_events e WHERE e.id = p_event_id;
  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Severity as an ordinal, so `match_min_severity` can mean "at least".
  v_rank := CASE v_event.severity
    WHEN 'INFO' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MEDIUM' THEN 3
    WHEN 'HIGH' THEN 4 WHEN 'CRITICAL' THEN 5 ELSE 0 END;

  FOR v_rule IN
    SELECT * FROM public.security_detection_rules r
     WHERE r.enabled
       AND (r.application_id IS NULL OR r.application_id = v_event.application_id)
       AND (r.environment    IS NULL OR r.environment    = v_event.environment)
       AND (r.match_category IS NULL OR r.match_category = v_event.event_category)
       AND (r.match_action   IS NULL OR r.match_action   = v_event.event_action)
       AND (r.match_status   IS NULL OR r.match_status   = v_event.status)
       AND (r.match_min_severity IS NULL OR v_rank >= CASE r.match_min_severity
             WHEN 'INFO' THEN 1 WHEN 'LOW' THEN 2 WHEN 'MEDIUM' THEN 3
             WHEN 'HIGH' THEN 4 WHEN 'CRITICAL' THEN 5 ELSE 0 END)
  LOOP
    BEGIN
      -- What makes two events "the same" for this rule.
      v_key := CASE v_rule.group_by
        WHEN 'ACTOR'       THEN v_event.actor_id
        WHEN 'IP'          THEN host(v_event.ip_address)
        WHEN 'RESOURCE'    THEN v_event.resource_type || ':' || COALESCE(v_event.resource_id, '')
        WHEN 'SESSION'     THEN v_event.session_id
        WHEN 'APPLICATION' THEN v_event.application_id
        ELSE NULL END;

      -- A rule grouped by a dimension this event does not carry cannot fire
      -- on it. Treating NULL as a group would collapse every anonymous event
      -- into one bucket and alert on the first five unrelated failures.
      IF v_key IS NULL THEN
        CONTINUE;
      END IF;

      v_since := v_event.occurred_at - make_interval(secs => v_rule.window_seconds);

      -- The count and the span of the SAME set, in one pass. Computing
      -- first_event_at from a looser predicate would put a timestamp on the
      -- alert that belongs to an unrelated event, which is the kind of small
      -- inaccuracy an investigation is built on.
      SELECT count(*), min(e.occurred_at) INTO v_count, v_first
        FROM public.security_events e
       WHERE e.application_id = v_event.application_id
         AND e.environment    = v_event.environment
         AND e.occurred_at   >= v_since
         AND e.occurred_at   <= v_event.occurred_at
         AND (v_rule.match_category IS NULL OR e.event_category = v_rule.match_category)
         AND (v_rule.match_action   IS NULL OR e.event_action   = v_rule.match_action)
         AND (v_rule.match_status   IS NULL OR e.status         = v_rule.match_status)
         AND v_key = CASE v_rule.group_by
               WHEN 'ACTOR'       THEN e.actor_id
               WHEN 'IP'          THEN host(e.ip_address)
               WHEN 'RESOURCE'    THEN e.resource_type || ':' || COALESCE(e.resource_id, '')
               WHEN 'SESSION'     THEN e.session_id
               WHEN 'APPLICATION' THEN e.application_id
               ELSE NULL END;

      IF v_count < v_rule.threshold_count THEN
        CONTINUE;
      END IF;

      -- An OPEN alert of this type for this group, inside the window, is the
      -- same condition continuing rather than a new one.
      SELECT a.id INTO v_alert
        FROM public.security_alerts a
       WHERE a.rule_id = v_rule.id
         AND a.status = 'OPEN'
         AND a.application_id = v_event.application_id
         AND a.metadata ->> 'group_key' = v_key
         AND a.last_event_at >= v_since
       ORDER BY a.created_at DESC
       LIMIT 1;

      IF v_alert IS NULL THEN
        INSERT INTO public.security_alerts (
          application_id, environment, rule_id, alert_type,
          severity, status, title, summary,
          actor_id, resource_type, resource_id, correlation_id,
          first_event_at, last_event_at, event_count, metadata
        ) VALUES (
          v_event.application_id, v_event.environment, v_rule.id, v_rule.alert_type,
          v_rule.alert_severity, 'OPEN',
          v_rule.name,
          format('%s events matched %s within %s seconds.',
                 v_count, v_rule.code, v_rule.window_seconds),
          v_event.actor_id, v_event.resource_type, v_event.resource_id, v_event.correlation_id,
          COALESCE(v_first, v_event.occurred_at), v_event.occurred_at, v_count,
          jsonb_build_object(
            'group_by',  v_rule.group_by,
            'group_key', v_key,
            'rule_code', v_rule.code,
            'threshold', v_rule.threshold_count,
            'window_seconds', v_rule.window_seconds)
        )
        RETURNING id INTO v_alert;
      ELSE
        UPDATE public.security_alerts a
           SET last_event_at = v_event.occurred_at,
               event_count   = v_count
         WHERE a.id = v_alert;
      END IF;

      -- The evidence (§31). ON CONFLICT because the triggering event may
      -- already be attached if two rules fired on it.
      INSERT INTO public.security_alert_events (alert_id, event_id)
      VALUES (v_alert, v_event.id)
      ON CONFLICT DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
      -- Property 2, above. A broken rule must not stop security logging.
      RAISE WARNING '[security-core] detection rule % failed: %', v_rule.code, SQLERRM;
    END;
  END LOOP;
END;
$fn$;

-- ─── 11. The authorization predicates (§27, §28, §29) ─────────────────────

-- 11.1 Does the caller hold this permission ANYWHERE?
--
-- The SECURITY_ADMIN tier of §29. It resolves through admin_has_permission()
-- over each of the caller's own administrator records rather than re-querying
-- the mapping, so every rule that function applies — account status,
-- application status, role latency, per-administrator DENY — applies here too.
-- Re-implementing the chain is how two copies disagree and the more permissive
-- one wins silently.
CREATE OR REPLACE FUNCTION public.security_has_global_permission(p_permission TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND EXISTS (
       SELECT 1
         FROM public.administrators a
        WHERE a.user_id = (SELECT auth.uid())
          AND a.status = 'ACTIVE'
          AND public.admin_has_permission(a.application_slug, p_permission)
     );
$fn$;

-- 11.2 May the caller read this application's events? (§28)
--
-- The three tiers of §29, in the order they are cheapest to evaluate. Deny by
-- default: an unauthenticated caller, an unknown application and an
-- administrator of a different property all resolve to FALSE without an error,
-- because an error would tell a prober which applications exist.
CREATE OR REPLACE FUNCTION public.security_can_read_application(p_application TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       public.is_super_admin()
       OR public.security_has_global_permission('SECURITY_EVENTS_VIEW_ALL')
       OR public.admin_has_permission(p_application, 'SECURITY_EVENTS_VIEW')
     );
$fn$;

-- 11.3 May the caller see network and device data? (§22)
--
-- Separate from reading the event, because §22 makes it a separate decision:
-- an administrator may be entitled to know that a login failed without being
-- entitled to the address it failed from.
CREATE OR REPLACE FUNCTION public.security_can_read_pii()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       public.is_super_admin()
       OR public.security_has_global_permission('SECURITY_EVENT_PII_VIEW')
     );
$fn$;

-- 11.4 The applications the caller may read, for a given permission.
--
-- Resolved ONCE per query rather than per row. security_can_read_application()
-- is correct as a predicate and would be evaluated for every row of a
-- million-row scan; this returns the same answer as an array the planner can
-- use with the (application_id, occurred_at) index.
--
-- ─── Why the permission is a parameter ────────────────────────────────────
-- Events and alerts are separate entitlements — SECURITY_EVENTS_VIEW and
-- SECURITY_ALERTS_VIEW — and §30 is explicit that an event and an alert are
-- different things. An earlier cut hard-coded SECURITY_EVENTS_VIEW here and
-- used it for both, which made SECURITY_ALERTS_VIEW a permission that existed,
-- was granted, was documented, and controlled nothing: anybody who could read
-- events could read alerts whether or not they held it. A permission that is
-- never enforced is worse than one that does not exist, because the
-- authorization model then says something untrue.
--
-- The CROSS-application check stays on SECURITY_EVENTS_VIEW_ALL for both. That
-- is the SECURITY_ADMIN tier of §29 — one elevation, deliberately granted per
-- person — and splitting it per resource would multiply the thing §28 wants
-- kept rare and visible.
--
-- The default keeps every existing caller reading events, which is what they
-- all did before the parameter existed.
DROP FUNCTION IF EXISTS public.security_readable_applications();

CREATE OR REPLACE FUNCTION public.security_readable_applications(
  p_permission TEXT DEFAULT 'SECURITY_EVENTS_VIEW'
)
RETURNS TEXT[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT CASE
    WHEN (SELECT auth.uid()) IS NULL THEN ARRAY[]::TEXT[]
    WHEN public.is_super_admin()
      OR public.security_has_global_permission('SECURITY_EVENTS_VIEW_ALL')
    THEN ARRAY(SELECT app.slug FROM public.admin_applications app)
    ELSE COALESCE(
      ARRAY(
        SELECT DISTINCT a.application_slug
          FROM public.administrators a
         WHERE a.user_id = (SELECT auth.uid())
           AND a.status = 'ACTIVE'
           AND public.admin_has_permission(a.application_slug, p_permission)
      ),
      ARRAY[]::TEXT[])
  END;
$fn$;

-- ─── 12. Ingestion (§41) ──────────────────────────────────────────────────

-- 12.1 Session-authenticated ingestion.
--
-- For a caller who already holds a session in THIS project — the Admin Panel
-- recording an administrative action, or Unchained's own server code.
--
-- ─── Which fields the caller does not get to decide (brief §12) ───────────
--   application_id  a parameter, but AUTHORIZED: the caller must hold
--                   SECURITY_EVENTS_INGEST on it. Naming another application
--                   is refused, not silently rewritten.
--   environment     from security_core_environment(). Never from the payload.
--   actor_id        auth.uid(). Whatever the payload says is discarded.
--   actor_type      forced to ADMIN or USER by what the caller actually is.
--   created_at      the column default.
--
-- actor_type is allowed to be SYSTEM or SERVICE only when the caller is the
-- Super Admin, because those are the two values that mean "no human did this"
-- and a delegated administrator claiming them would be erasing themselves from
-- their own audit trail.
CREATE OR REPLACE FUNCTION public.security_ingest_event(
  p_application TEXT,
  p_event       JSONB
)
RETURNS TABLE (id UUID, occurred_at TIMESTAMPTZ)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor      UUID;
  v_actor_type TEXT;
  v_claimed    TEXT;
BEGIN
  v_actor := (SELECT auth.uid());
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'security_core_unauthorized'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.admin_has_permission(p_application, 'SECURITY_EVENTS_INGEST')
  ) THEN
    RAISE EXCEPTION 'security_core_forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT COALESCE((SELECT s.ingestion_enabled FROM public.security_core_settings s
                    WHERE s.id = 'default'), TRUE) THEN
    RAISE EXCEPTION 'security_core_ingestion_disabled'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- A delegated administrator is always recorded as the ADMIN they are. Only
  -- the Super Admin may say "this was not a person" — SYSTEM, SERVICE or API —
  -- because those are the values that erase the actor, and an administrator
  -- able to claim them could write themselves out of their own audit trail.
  v_claimed := p_event ->> 'actor_type';
  IF v_claimed IN ('SYSTEM', 'SERVICE', 'API') AND public.is_super_admin() THEN
    v_actor_type := v_claimed;
  ELSE
    v_actor_type := 'ADMIN';
  END IF;

  RETURN QUERY SELECT * FROM public.security_write_event(
    p_application,
    public.security_core_environment(),
    p_event,
    v_actor_type,
    -- SYSTEM and SERVICE events have no actor by §16.2, even when a person
    -- asked for them.
    CASE WHEN v_actor_type IN ('SYSTEM', 'SERVICE') THEN NULL ELSE v_actor::TEXT END,
    NULLIF(p_event ->> 'session_id', ''),
    'rpc'
  );
END;
$fn$;

-- 12.2 Key-authenticated ingestion.
--
-- For an application on its OWN Supabase project, which has no session here.
-- service_role only: it is called by the security-core edge function after
-- that function has hashed the presented key and looked it up.
--
-- ─── The isolation guarantee, in one line ─────────────────────────────────
-- The application and the environment come from the KEY ROW. There is no
-- parameter by which the caller can name either, so TanCerca's key writes
-- TanCerca events and can do nothing else, whatever its payload claims (§28).
CREATE OR REPLACE FUNCTION public.security_ingest_as_application(
  p_key_hash TEXT,
  p_event    JSONB
)
RETURNS TABLE (id UUID, occurred_at TIMESTAMPTZ)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_key         public.security_application_keys%ROWTYPE;
  v_actor_type  TEXT;
  v_actor_id    TEXT;
BEGIN
  SELECT k.* INTO v_key
    FROM public.security_application_keys k
    JOIN public.admin_applications app ON app.slug = k.application_id
   WHERE k.key_hash = p_key_hash
     AND k.status = 'active'
     AND (k.expires_at IS NULL OR k.expires_at > now())
     AND app.status = 'active';

  IF NOT FOUND THEN
    -- One message for "no such key", "revoked", "expired" and "the
    -- application is disabled". Distinguishing them would be an oracle for
    -- which keys exist, the same reasoning admin_invitation_state() applies.
    RAISE EXCEPTION 'security_core_unauthorized'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF NOT COALESCE((SELECT s.ingestion_enabled FROM public.security_core_settings s
                    WHERE s.id = 'default'), TRUE) THEN
    RAISE EXCEPTION 'security_core_ingestion_disabled'
      USING ERRCODE = 'restrict_violation';
  END IF;

  -- An application reporting on its own users knows who they are, and §16
  -- needs that. What it cannot do is claim ADMIN — an administrative action in
  -- this installation is performed through a session, and an application key
  -- asserting one would be forging the actor model.
  v_actor_type := COALESCE(NULLIF(p_event ->> 'actor_type', ''), 'SERVICE');
  IF v_actor_type = 'ADMIN' THEN
    v_actor_type := 'SERVICE';
  END IF;

  v_actor_id := CASE
    WHEN v_actor_type IN ('ANONYMOUS', 'SYSTEM') THEN NULL
    ELSE NULLIF(p_event ->> 'actor_id', '')
  END;

  -- ─── Why the table is aliased here ──────────────────────────────────────
  -- This function RETURNS TABLE (id, occurred_at), which makes `id` a plpgsql
  -- VARIABLE for the whole body. An unqualified `WHERE id = v_key.id` is then
  -- ambiguous between that variable and the column, and Postgres refuses it at
  -- run time with 42702 — not at CREATE time, so the function looks fine until
  -- the first call. Every column reference in a RETURNS TABLE function is
  -- qualified for this reason.
  UPDATE public.security_application_keys k
     SET last_used_at = now()
   WHERE k.id = v_key.id;

  RETURN QUERY SELECT * FROM public.security_write_event(
    v_key.application_id,
    v_key.environment,
    p_event,
    v_actor_type,
    v_actor_id,
    NULLIF(p_event ->> 'session_id', ''),
    'api'
  );
END;
$fn$;

-- ─── 13. Reading (§37, §38) ───────────────────────────────────────────────

-- 13.1 The event explorer.
--
-- Every filter §37 requires, and the authorization §21 of the brief requires:
-- the caller receives the events they are entitled to and no others. It is not
-- a filter over a full result — `security_readable_applications()` is applied
-- in the WHERE clause, so an unauthorized application's events are never read
-- from disk, let alone returned.
--
-- ─── The three redacted columns ───────────────────────────────────────────
-- ip_address, user_agent and device_id come back NULL unless the caller holds
-- SECURITY_EVENT_PII_VIEW (§22). A caller cannot tell "absent" from "withheld"
-- from this function alone, and that is acceptable: both mean "you do not have
-- it", and an explicit "withheld" flag would be a fourth thing to get wrong.
CREATE OR REPLACE FUNCTION public.security_query_events(
  p_application    TEXT DEFAULT NULL,
  p_environment    TEXT DEFAULT NULL,
  p_category       TEXT DEFAULT NULL,
  p_event_type     TEXT DEFAULT NULL,
  p_action         TEXT DEFAULT NULL,
  p_severity       TEXT DEFAULT NULL,
  p_status         TEXT DEFAULT NULL,
  p_actor_id       TEXT DEFAULT NULL,
  p_resource_type  TEXT DEFAULT NULL,
  p_resource_id    TEXT DEFAULT NULL,
  p_correlation_id UUID DEFAULT NULL,
  p_request_id     TEXT DEFAULT NULL,
  p_session_id     TEXT DEFAULT NULL,
  p_from           TIMESTAMPTZ DEFAULT NULL,
  p_to             TIMESTAMPTZ DEFAULT NULL,
  -- Specific events by identifier. This is what makes security_get_event()
  -- and security_alert_evidence() calls INTO this function rather than
  -- re-implementations of it: without an id filter here, both would have to
  -- fetch a page and filter it afterwards, which silently misses any event
  -- older than the page — a detail view that works until the table grows.
  p_event_ids      UUID[] DEFAULT NULL,
  p_limit          INTEGER DEFAULT 100,
  p_offset         INTEGER DEFAULT 0
)
RETURNS TABLE (
  id             UUID,
  occurred_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  application_id TEXT,
  environment    TEXT,
  event_category TEXT,
  event_type     TEXT,
  event_action   TEXT,
  severity       TEXT,
  status         TEXT,
  actor_type     TEXT,
  actor_id       TEXT,
  resource_type  TEXT,
  resource_id    TEXT,
  session_id     TEXT,
  request_id     TEXT,
  correlation_id UUID,
  ip_address     TEXT,
  user_agent     TEXT,
  device_id      TEXT,
  metadata       JSONB,
  schema_version TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_apps  TEXT[];
  v_pii   BOOLEAN;
  v_limit INTEGER;
BEGIN
  v_apps := public.security_readable_applications();
  -- An empty entitlement returns an empty result rather than raising. The
  -- panel asks this question on a page it may legitimately be allowed to open
  -- with no applications in scope, and a 403 there would be wrong.
  IF array_length(v_apps, 1) IS NULL THEN
    RETURN;
  END IF;

  v_pii := public.security_can_read_pii();
  -- Bounded regardless of what is asked for. An unbounded audit query is a
  -- way to turn a read permission into a denial of service.
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);

  RETURN QUERY
  SELECT
    e.id, e.occurred_at, e.created_at,
    e.application_id, e.environment,
    e.event_category, e.event_type, e.event_action,
    e.severity, e.status,
    e.actor_type, e.actor_id,
    e.resource_type, e.resource_id,
    e.session_id, e.request_id, e.correlation_id,
    CASE WHEN v_pii THEN host(e.ip_address) ELSE NULL END,
    CASE WHEN v_pii THEN e.user_agent ELSE NULL END,
    CASE WHEN v_pii THEN e.device_id  ELSE NULL END,
    e.metadata, e.schema_version
  FROM public.security_events e
  WHERE e.application_id = ANY(v_apps)
    AND (p_application    IS NULL OR e.application_id = p_application)
    AND (p_environment    IS NULL OR e.environment    = p_environment)
    AND (p_category       IS NULL OR e.event_category = p_category)
    AND (p_event_type     IS NULL OR e.event_type     = p_event_type)
    AND (p_action         IS NULL OR e.event_action   = p_action)
    AND (p_severity       IS NULL OR e.severity       = p_severity)
    AND (p_status         IS NULL OR e.status         = p_status)
    AND (p_actor_id       IS NULL OR e.actor_id       = p_actor_id)
    AND (p_resource_type  IS NULL OR e.resource_type  = p_resource_type)
    AND (p_resource_id    IS NULL OR e.resource_id    = p_resource_id)
    AND (p_correlation_id IS NULL OR e.correlation_id = p_correlation_id)
    AND (p_request_id     IS NULL OR e.request_id     = p_request_id)
    AND (p_session_id     IS NULL OR e.session_id     = p_session_id)
    AND (p_from           IS NULL OR e.occurred_at   >= p_from)
    AND (p_to             IS NULL OR e.occurred_at   <= p_to)
    AND (p_event_ids      IS NULL OR e.id            = ANY(p_event_ids))
  ORDER BY e.occurred_at DESC, e.id DESC
  LIMIT v_limit OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- 13.2 One event, by id (§38).
--
-- Deliberately implemented as a filtered call to the explorer rather than as
-- its own SELECT: one query means one authorization rule and one redaction
-- rule, and a detail view that showed a column the list view hid would be the
-- classic way an access control gets bypassed.
CREATE OR REPLACE FUNCTION public.security_get_event(p_id UUID)
RETURNS TABLE (
  id             UUID,
  occurred_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  application_id TEXT,
  environment    TEXT,
  event_category TEXT,
  event_type     TEXT,
  event_action   TEXT,
  severity       TEXT,
  status         TEXT,
  actor_type     TEXT,
  actor_id       TEXT,
  resource_type  TEXT,
  resource_id    TEXT,
  session_id     TEXT,
  request_id     TEXT,
  correlation_id UUID,
  ip_address     TEXT,
  user_agent     TEXT,
  device_id      TEXT,
  metadata       JSONB,
  schema_version TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_apps TEXT[];
  v_app  TEXT;
BEGIN
  v_apps := public.security_readable_applications();
  IF array_length(v_apps, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT e.application_id INTO v_app
    FROM public.security_events e WHERE e.id = p_id;

  -- An event the caller may not read is indistinguishable from one that does
  -- not exist. Both return nothing.
  IF v_app IS NULL OR NOT (v_app = ANY(v_apps)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.security_query_events(
    p_application => v_app,
    p_event_ids   => ARRAY[p_id],
    p_limit       => 1
  );
END;
$fn$;

-- 13.3 Related events (§18, §38).
--
-- The events sharing this one's correlation id — the ORDER_CREATED,
-- PAYMENT_CREATED, PAYMENT_COMPLETED chain of §18, reachable from any link in
-- it. Falls back to the request id for an event with no correlation, which is
-- the narrower relationship §19 describes and is often the only one present.
--
-- Authorization is not re-implemented: it delegates to the explorer, so a
-- correlation that spans two applications shows the caller only the half they
-- are entitled to. That is the correct answer under §28, and it is worth
-- stating because "related events" is exactly where a cross-application leak
-- would hide.
CREATE OR REPLACE FUNCTION public.security_related_events(p_id UUID)
RETURNS TABLE (
  id             UUID,
  occurred_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  application_id TEXT,
  environment    TEXT,
  event_category TEXT,
  event_type     TEXT,
  event_action   TEXT,
  severity       TEXT,
  status         TEXT,
  actor_type     TEXT,
  actor_id       TEXT,
  resource_type  TEXT,
  resource_id    TEXT,
  session_id     TEXT,
  request_id     TEXT,
  correlation_id UUID,
  ip_address     TEXT,
  user_agent     TEXT,
  device_id      TEXT,
  metadata       JSONB,
  schema_version TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_apps        TEXT[];
  v_correlation UUID;
  v_request     TEXT;
  v_app         TEXT;
BEGIN
  v_apps := public.security_readable_applications();
  IF array_length(v_apps, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT e.correlation_id, e.request_id, e.application_id
    INTO v_correlation, v_request, v_app
    FROM public.security_events e WHERE e.id = p_id;

  IF v_app IS NULL OR NOT (v_app = ANY(v_apps)) THEN
    RETURN;
  END IF;

  IF v_correlation IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.security_query_events(
      p_correlation_id => v_correlation,
      p_limit          => 1000
    ) q
    WHERE q.id <> p_id;
  ELSIF v_request IS NOT NULL THEN
    RETURN QUERY
    SELECT * FROM public.security_query_events(
      p_request_id => v_request,
      p_limit      => 1000
    ) q
    WHERE q.id <> p_id;
  END IF;
END;
$fn$;

-- 13.4 The alerts a caller may see, with the same isolation rule.
CREATE OR REPLACE FUNCTION public.security_query_alerts(
  p_application TEXT DEFAULT NULL,
  p_status      TEXT DEFAULT NULL,
  p_severity    TEXT DEFAULT NULL,
  p_limit       INTEGER DEFAULT 100,
  p_offset      INTEGER DEFAULT 0
)
RETURNS TABLE (
  id              UUID,
  application_id  TEXT,
  environment     TEXT,
  alert_type      TEXT,
  severity        TEXT,
  status          TEXT,
  title           TEXT,
  summary         TEXT,
  actor_id        TEXT,
  resource_type   TEXT,
  resource_id     TEXT,
  correlation_id  UUID,
  first_event_at  TIMESTAMPTZ,
  last_event_at   TIMESTAMPTZ,
  event_count     INTEGER,
  metadata        JSONB,
  created_at      TIMESTAMPTZ,
  acknowledged_at TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_apps  TEXT[];
  v_limit INTEGER;
  v_pii   BOOLEAN;
BEGIN
  -- Alerts, not events: §30 keeps them distinct and so does the entitlement.
  v_apps := public.security_readable_applications('SECURITY_ALERTS_VIEW');
  IF array_length(v_apps, 1) IS NULL THEN
    RETURN;
  END IF;

  v_pii   := public.security_can_read_pii();
  v_limit := LEAST(GREATEST(COALESCE(p_limit, 100), 1), 1000);

  RETURN QUERY
  SELECT
    a.id, a.application_id, a.environment, a.alert_type,
    a.severity, a.status, a.title, a.summary,
    a.actor_id, a.resource_type, a.resource_id, a.correlation_id,
    a.first_event_at, a.last_event_at, a.event_count,
    -- §22 reaches alerts too, and this is the one place it is easy to miss:
    -- a rule with group_by = 'IP' records the address it grouped on in
    -- `metadata.group_key`, which would hand a network address to an
    -- administrator who is not authorized to see one on the events themselves.
    -- No seeded rule groups by IP today; the schema permits it, so the hole is
    -- closed before somebody writes that rule rather than after.
    CASE
      WHEN v_pii OR a.metadata ->> 'group_by' IS DISTINCT FROM 'IP'
        THEN a.metadata
      ELSE a.metadata - 'group_key'
    END,
    a.created_at, a.acknowledged_at, a.resolved_at
  FROM public.security_alerts a
  WHERE a.application_id = ANY(v_apps)
    AND (p_application IS NULL OR a.application_id = p_application)
    AND (p_status      IS NULL OR a.status         = p_status)
    AND (p_severity    IS NULL OR a.severity       = p_severity)
  ORDER BY a.created_at DESC
  LIMIT v_limit OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;

-- 13.5 The events behind an alert (§30, §31).
CREATE OR REPLACE FUNCTION public.security_alert_evidence(p_alert_id UUID)
RETURNS TABLE (
  id             UUID,
  occurred_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ,
  application_id TEXT,
  environment    TEXT,
  event_category TEXT,
  event_type     TEXT,
  event_action   TEXT,
  severity       TEXT,
  status         TEXT,
  actor_type     TEXT,
  actor_id       TEXT,
  resource_type  TEXT,
  resource_id    TEXT,
  session_id     TEXT,
  request_id     TEXT,
  correlation_id UUID,
  ip_address     TEXT,
  user_agent     TEXT,
  device_id      TEXT,
  metadata       JSONB,
  schema_version TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_apps TEXT[];
  v_app  TEXT;
BEGIN
  v_apps := public.security_readable_applications();
  IF array_length(v_apps, 1) IS NULL THEN
    RETURN;
  END IF;

  SELECT a.application_id INTO v_app
    FROM public.security_alerts a WHERE a.id = p_alert_id;

  IF v_app IS NULL OR NOT (v_app = ANY(v_apps)) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT * FROM public.security_query_events(
    p_application => v_app,
    p_event_ids   => ARRAY(SELECT ae.event_id
                             FROM public.security_alert_events ae
                            WHERE ae.alert_id = p_alert_id),
    p_limit       => 1000
  );
END;
$fn$;

-- 13.6 Moving an alert through its lifecycle (§30).
--
-- The only mutation the Core exposes, and it is on an alert, never an event.
-- Requires SECURITY_ALERTS_MANAGE on the alert's own application, so
-- acknowledging a TanCerca alert is a TanCerca permission.
CREATE OR REPLACE FUNCTION public.security_set_alert_status(
  p_alert_id UUID,
  p_status   TEXT,
  p_note     TEXT DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_app   TEXT;
  v_actor UUID;
BEGIN
  v_actor := (SELECT auth.uid());
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'security_core_unauthorized'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_status NOT IN ('OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'DISMISSED') THEN
    RAISE EXCEPTION 'security_core_invalid_status'
      USING ERRCODE = 'check_violation';
  END IF;

  SELECT a.application_id INTO v_app FROM public.security_alerts a WHERE a.id = p_alert_id;
  IF v_app IS NULL THEN
    RETURN FALSE;
  END IF;

  IF NOT (
    public.is_super_admin()
    OR public.security_has_global_permission('SECURITY_ALERTS_MANAGE')
    OR public.admin_has_permission(v_app, 'SECURITY_ALERTS_MANAGE')
  ) THEN
    RAISE EXCEPTION 'security_core_forbidden'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  UPDATE public.security_alerts a
     SET status          = p_status,
         acknowledged_by = CASE WHEN p_status = 'ACKNOWLEDGED' THEN v_actor ELSE a.acknowledged_by END,
         acknowledged_at = CASE WHEN p_status = 'ACKNOWLEDGED' THEN now() ELSE a.acknowledged_at END,
         resolved_by     = CASE WHEN p_status IN ('RESOLVED', 'DISMISSED') THEN v_actor ELSE NULL END,
         resolved_at     = CASE WHEN p_status IN ('RESOLVED', 'DISMISSED') THEN now() ELSE NULL END,
         resolution_note = CASE WHEN p_status IN ('RESOLVED', 'DISMISSED') THEN p_note ELSE a.resolution_note END
   WHERE a.id = p_alert_id;

  RETURN TRUE;
END;
$fn$;

-- ─── 14. The legacy bridge (brief §32) ────────────────────────────────────
-- ─── The decision this section records ────────────────────────────────────
-- public.admin_logs is an existing audit mechanism with production data and a
-- live writer. The brief's §32 is explicit about what to do with one: do not
-- delete it, determine the overlap, reuse it if compatible, add an adapter if
-- necessary, avoid duplicate event generation, document the decision.
--
--   OVERLAP    Total in purpose, partial in shape. admin_logs records exactly
--              the administrative events the canonical model records, but as
--              (admin_id, action, metadata) with the envelope stuffed into
--              metadata. It has no occurred_at, no category, no severity
--              column, no status, no resource, and no correlation — so it
--              cannot answer §37's filters or §38's investigation.
--
--   DECISION   Keep it, and ADAPT it. admin_core_log_event() keeps its exact
--              existing behaviour — same signature, same insert, same never-
--              throws contract — and gains a mirror into security_events.
--              Nothing that calls it changes. Nothing that reads admin_logs
--              changes. Every administrative event that was already being
--              recorded starts appearing in the canonical store, correctly
--              classified, from the moment this migration applies.
--
--   NOT DUPLICATE GENERATION  One logical event is written once by one writer
--              into two stores during a transition, and the canonical row is
--              marked source='admin_core_bridge' so the two are always
--              distinguishable. The brief forbids two SYSTEMS generating the
--              same event independently, which is a different thing and is
--              exactly what an adapter avoids.
--
--   RETIREMENT Deleting nothing is the point. When the panel reads
--              security_events instead of admin_logs, the mirror becomes the
--              only writer that matters and the admin_logs insert can be
--              dropped in one edit — with the old rows still there, still
--              immutable, still readable.
--
-- ─── Why the mirror cannot throw ──────────────────────────────────────────
-- admin_core_log_event()'s existing contract is that a logging failure is a
-- WARNING and never rolls back the operation being logged. Adding a second
-- insert must not weaken that, so the mirror has its own EXCEPTION block
-- INSIDE the existing one. A malformed bridge event loses the canonical row
-- and keeps the admin_logs row; it never costs the caller its transaction.
--
-- ─── And why it cannot recurse (brief §27) ────────────────────────────────
-- The mirror inserts directly and does NOT call security_write_event(), so it
-- does not run detection, does not call the validator, and cannot re-enter
-- admin_core_log_event(). A failure here raises a WARNING to the Postgres log
-- — an ordinary operational channel — and emits no event about itself.

CREATE OR REPLACE FUNCTION public.admin_core_log_event(
  p_action      TEXT,
  p_result      TEXT DEFAULT 'SUCCESS',
  p_application TEXT DEFAULT NULL,
  p_target      UUID DEFAULT NULL,
  p_metadata    JSONB DEFAULT '{}'::jsonb,
  p_severity    TEXT DEFAULT 'info',
  p_actor       UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor       UUID;
  v_application TEXT;
  v_category    TEXT;
  v_severity    TEXT;
  v_status      TEXT;
BEGIN
  -- A session always logs as itself. Only a caller with no session at all —
  -- service_role in an edge function — may name the actor.
  v_actor := COALESCE((SELECT auth.uid()), p_actor);

  -- admin_logs.admin_id is NOT NULL and references auth.users. An event with
  -- no identifiable actor has nowhere to go, and inventing one would be worse
  -- than not recording it.
  IF v_actor IS NULL THEN
    RAISE WARNING '[admin-core] % not recorded: no actor', p_action;
    RETURN;
  END IF;

  INSERT INTO public.admin_logs (admin_id, action, metadata)
  VALUES (
    v_actor,
    p_action,
    jsonb_build_object(
      'contract',    'unchained.admin_core.v1',
      'result',      p_result,
      'severity',    p_severity,
      'application', p_application,
      'target',      p_target,
      'occurred_at', now()
    ) || COALESCE(p_metadata, '{}'::jsonb)
  );

  -- ── The canonical mirror ────────────────────────────────────────────────
  BEGIN
    -- An administrative event with no application is an event about the
    -- installation itself, which is Unchained Business.
    v_application := COALESCE(p_application, 'unchained-business');

    -- Only into a registered, existing application. An unregistered slug is
    -- skipped rather than forced: the FK would refuse it anyway, and losing
    -- the mirror is better than losing the admin_logs row behind it.
    IF EXISTS (SELECT 1 FROM public.admin_applications app WHERE app.slug = v_application) THEN

      -- §11: an access refusal is an AUTHORIZATION event; everything else this
      -- writer records is an administrative act.
      v_category := CASE
        WHEN p_action LIKE '%ACCESS_DENIED%'
          OR p_action LIKE '%CROSS_APP%'
          OR p_action LIKE '%PERMISSION%'  THEN 'AUTHORIZATION'
        WHEN p_action LIKE '%INVITATION%'
          OR p_action LIKE '%LOGIN%'       THEN 'AUTHENTICATION'
        ELSE 'ADMINISTRATION'
      END;

      -- The Core's three-level severity onto §14's five. 'warning' becomes
      -- MEDIUM rather than HIGH: a denied permission check is the routine
      -- outcome of deny-by-default, and mapping it to HIGH would fill the
      -- elevated-severity index with normal operation.
      v_severity := CASE lower(COALESCE(p_severity, 'info'))
        WHEN 'critical' THEN 'CRITICAL'
        WHEN 'warning'  THEN 'MEDIUM'
        WHEN 'error'    THEN 'HIGH'
        ELSE 'INFO'
      END;

      v_status := CASE upper(COALESCE(p_result, 'SUCCESS'))
        WHEN 'DENIED'  THEN 'DENIED'
        WHEN 'FAILURE' THEN 'FAILURE'
        WHEN 'PENDING' THEN 'PENDING'
        WHEN 'BLOCKED' THEN 'BLOCKED'
        ELSE 'SUCCESS'
      END;

      INSERT INTO public.security_events (
        occurred_at, application_id, environment,
        event_category, event_type, event_action,
        severity, status, actor_type, actor_id,
        resource_type, resource_id, metadata, source
      ) VALUES (
        now(),
        v_application,
        public.security_core_environment(),
        v_category,
        'ADMIN',
        -- Actions already arrive SCREAMING_SNAKE from this writer. One that
        -- does not would violate the CHECK, and the handler below keeps that
        -- from costing the caller anything.
        p_action,
        v_severity,
        v_status,
        'ADMIN',
        v_actor::TEXT,
        CASE WHEN p_target IS NOT NULL THEN 'ADMINISTRATOR' ELSE NULL END,
        p_target::TEXT,
        COALESCE(p_metadata, '{}'::jsonb),
        'admin_core_bridge'
      );
    END IF;
  EXCEPTION WHEN OTHERS THEN
    -- The mirror is best-effort by construction. The admin_logs row above has
    -- already been written and stands.
    RAISE WARNING '[security-core] admin_logs bridge did not mirror %: %', p_action, SQLERRM;
  END;

EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[admin-core] % not recorded: %', p_action, SQLERRM;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_core_log_event(TEXT, TEXT, TEXT, UUID, JSONB, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_core_log_event(TEXT, TEXT, TEXT, UUID, JSONB, TEXT, UUID)
  TO service_role;

-- ─── 15. Permissions (§29) ────────────────────────────────────────────────
-- Eight new rows in the existing catalogue. No new ROLE — see the header for
-- why there cannot be one — and no change to any existing permission or
-- mapping.

INSERT INTO public.admin_permissions (code, name, description, resource, action, risk_level) VALUES
  ('SECURITY_EVENTS_VIEW',     'View security events',
   'Read the security and audit events of this application.', 'SECURITY', 'VIEW', 'high'),
  ('SECURITY_EVENTS_VIEW_ALL', 'View security events across applications',
   'Read security and audit events for every Unchained application. The SECURITY_ADMIN tier of the event contract.',
   'SECURITY', 'VIEW_ALL', 'critical'),
  ('SECURITY_EVENT_PII_VIEW',  'View event network data',
   'See the IP address, user agent and device identifier recorded on an event.',
   'SECURITY', 'PII_VIEW', 'critical'),
  ('SECURITY_EVENTS_INGEST',   'Emit security events',
   'Record security and audit events for this application.', 'SECURITY', 'INGEST', 'medium'),
  ('SECURITY_ALERTS_VIEW',     'View security alerts',
   'Read the security alerts of this application.', 'SECURITY', 'ALERTS_VIEW', 'high'),
  ('SECURITY_ALERTS_MANAGE',   'Manage security alerts',
   'Acknowledge, resolve and dismiss security alerts.', 'SECURITY', 'ALERTS_MANAGE', 'high'),
  ('SECURITY_RULES_VIEW',      'View detection rules',
   'Read the configured detection rules.', 'SECURITY', 'RULES_VIEW', 'high'),
  ('SECURITY_RULES_MANAGE',    'Manage detection rules',
   'Create, enable, disable and edit detection rules.', 'SECURITY', 'RULES_MANAGE', 'critical')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      risk_level = EXCLUDED.risk_level;

-- ─── 15.1 What APP_ADMIN gets, and what nobody gets by role ───────────────
-- APP_ADMIN — the APPLICATION_ADMIN of §29 — may read its own application's
-- events and alerts. admin_has_permission() scopes that to its own
-- application, so this is the whole of "an application admin sees their
-- application's events".
--
-- No role is mapped to SECURITY_EVENTS_VIEW_ALL, SECURITY_EVENT_PII_VIEW,
-- SECURITY_ALERTS_MANAGE, SECURITY_RULES_MANAGE or SECURITY_EVENTS_INGEST.
-- Cross-application visibility, network data, and the ability to write or
-- silence security telemetry are decisions made about a PERSON, through
-- administrator_permission_grants, or they belong to the Super Admin. §28 is
-- explicit that cross-application access must require explicit elevated
-- authorization, and a job title is not that. §17 asserts this below, so a
-- future edit that maps one cannot be applied quietly.
--
-- CONTENT_ADMIN, FINANCE_ADMIN and OPERATIONS_ADMIN get nothing here. An
-- audit trail is not general-purpose administrative furniture.
INSERT INTO public.admin_role_permissions (role_code, permission_code) VALUES
  ('APP_ADMIN', 'SECURITY_EVENTS_VIEW'),
  ('APP_ADMIN', 'SECURITY_ALERTS_VIEW')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ─── 16. Detection rule seed (§31) ────────────────────────────────────────
-- Exactly one rule: §31's own example. The brief is explicit that dozens of
-- speculative rules are not wanted, and one real rule is what proves the
-- schema, the evaluator and the alert path are actually wired together rather
-- than merely present.
--
-- ON CONFLICT DO UPDATE on the wording and NOT on `enabled`: re-running this
-- file must not re-enable a rule an operator turned off.

INSERT INTO public.security_detection_rules (
  code, name, description,
  application_id, environment, enabled,
  match_category, match_action, match_status,
  threshold_count, window_seconds, group_by,
  alert_type, alert_severity
) VALUES (
  'BRUTE_FORCE_LOGIN',
  'Repeated failed logins for one account',
  'Five failed logins for the same actor inside five minutes. Contract §31''s worked example.',
  NULL, NULL, TRUE,
  'AUTHENTICATION', 'LOGIN_FAILED', 'FAILURE',
  5, 300, 'ACTOR',
  'BRUTE_FORCE_DETECTED', 'HIGH'
)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      alert_type = EXCLUDED.alert_type,
      alert_severity = EXCLUDED.alert_severity;

-- ─── 17. Row level security (§27) ─────────────────────────────────────────
-- ─── security_events has NO usable grant, on purpose ──────────────────────
-- §22 requires ip_address to be withheld from administrators without the
-- authorization to see it, and a SELECT grant cannot express "these rows minus
-- three columns". So `authenticated` holds nothing on this table and reads go
-- exclusively through security_query_events() / security_get_event(), which
-- apply row authorization and column redaction together.
--
-- RLS is still enabled, and the SELECT policy still states the rule. It is the
-- second lock on a door that currently has no handle: if a future migration
-- grants SELECT — to build a view, to debug something, by accident — the
-- policy is already there and application isolation survives the mistake.

ALTER TABLE public.security_core_settings       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_events              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_application_keys    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alerts              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_alert_events        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_detection_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.security_retention_policies  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS security_core_settings_super_admin_all ON public.security_core_settings;
CREATE POLICY security_core_settings_super_admin_all ON public.security_core_settings
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- §28, as a policy rather than as a filter. There is no INSERT, UPDATE or
-- DELETE policy on this table at all: writes happen through
-- security_write_event(), which runs as the owner, and the immutability
-- trigger refuses the other two for everybody including service_role.
DROP POLICY IF EXISTS security_events_authorized_read ON public.security_events;
CREATE POLICY security_events_authorized_read ON public.security_events
  FOR SELECT TO authenticated
  USING (public.security_can_read_application(application_id));

-- A key is a credential. Nobody but the Super Admin has any business reading
-- the row, even hashed.
DROP POLICY IF EXISTS security_application_keys_super_admin_all ON public.security_application_keys;
CREATE POLICY security_application_keys_super_admin_all ON public.security_application_keys
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS security_alerts_authorized_read ON public.security_alerts;
CREATE POLICY security_alerts_authorized_read ON public.security_alerts
  FOR SELECT TO authenticated
  USING (public.security_can_read_application(application_id));

DROP POLICY IF EXISTS security_alerts_super_admin_all ON public.security_alerts;
CREATE POLICY security_alerts_super_admin_all ON public.security_alerts
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS security_alert_events_super_admin_all ON public.security_alert_events;
CREATE POLICY security_alert_events_super_admin_all ON public.security_alert_events
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Rules describe what the installation watches for. Readable by an
-- administrator who holds the permission; writable only by the Super Admin,
-- because editing a rule is how somebody would stop being detected.
DROP POLICY IF EXISTS security_detection_rules_read ON public.security_detection_rules;
CREATE POLICY security_detection_rules_read ON public.security_detection_rules
  FOR SELECT TO authenticated
  USING (
    public.is_super_admin()
    OR public.security_has_global_permission('SECURITY_RULES_VIEW')
    OR (application_id IS NOT NULL
        AND public.admin_has_permission(application_id, 'SECURITY_RULES_VIEW'))
  );

DROP POLICY IF EXISTS security_detection_rules_super_admin_all ON public.security_detection_rules;
CREATE POLICY security_detection_rules_super_admin_all ON public.security_detection_rules
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS security_retention_policies_super_admin_all ON public.security_retention_policies;
CREATE POLICY security_retention_policies_super_admin_all ON public.security_retention_policies
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── 18. Grants ───────────────────────────────────────────────────────────
-- anon gets nothing, anywhere. The public website holds the anon key and has
-- no business knowing this schema exists.

REVOKE ALL ON TABLE public.security_core_settings      FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_events             FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_application_keys   FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_alerts             FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_alert_events       FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_detection_rules    FROM anon, authenticated;
REVOKE ALL ON TABLE public.security_retention_policies FROM anon, authenticated;

-- The Super Admin manages settings, keys, rules and retention through the
-- panel, so those four need a table grant for the policies above to matter.
-- security_events and security_alert_events deliberately get none: events are
-- read through functions and written by one, and nothing needs to touch the
-- join table directly.
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_core_settings      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_application_keys   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_detection_rules    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.security_retention_policies TO authenticated;
-- Alerts get NO table grant either, for the same reason events do not: an
-- alert raised by an IP-grouped rule carries a network address in its
-- metadata, and a plain SELECT cannot express "this row, minus that key".
-- security_query_alerts() applies the §22 redaction; nothing else may read
-- the table.

-- The internal writer and the detection evaluator are reachable from nothing
-- but the entry points above, which run as the owner.
REVOKE ALL ON FUNCTION public.security_write_event(TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT)
  FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.security_evaluate_rules(UUID)
  FROM PUBLIC, anon, authenticated;

-- Key-authenticated ingestion is service_role only: the edge function holds
-- the service key, and the presented application key never reaches Postgres
-- except as a hash.
REVOKE ALL ON FUNCTION public.security_ingest_as_application(TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_ingest_as_application(TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION public.security_ingest_event(TEXT, JSONB)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_query_events(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], INTEGER, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_get_event(UUID)                  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_related_events(UUID)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_query_alerts(TEXT, TEXT, TEXT, INTEGER, INTEGER)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_alert_evidence(UUID)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_set_alert_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_can_read_application(TEXT)       FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_can_read_pii()                   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_readable_applications(TEXT)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_has_global_permission(TEXT)      FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_core_environment()               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.security_ingest_event(TEXT, JSONB)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_query_events(TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, UUID[], INTEGER, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_get_event(UUID)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_related_events(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_query_alerts(TEXT, TEXT, TEXT, INTEGER, INTEGER)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_alert_evidence(UUID)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_set_alert_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_can_read_application(TEXT)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_can_read_pii()                TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_readable_applications(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_has_global_permission(TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.security_core_environment()            TO authenticated;

-- The validator and the scanners are pure and carry no data. Granting them to
-- `authenticated` lets an application pre-flight an event against the SAME
-- code the boundary will run, rather than against its own idea of the rules —
-- which is worth more than the nothing it reveals.
REVOKE ALL ON FUNCTION public.security_validate_event(JSONB)              FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.security_metadata_violations(JSONB, TEXT, INTEGER) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.security_validate_event(JSONB)           TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.security_metadata_violations(JSONB, TEXT, INTEGER)
  TO authenticated, service_role;

-- ─── 19. Apply-time assertions ────────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- Core behind.
--
-- None of these calls a function gated on insufficient_privilege. The Studio
-- SQL editor has no JWT, so auth.uid() is NULL and every "may this person…"
-- predicate is correctly FALSE; an assertion that called a raising function
-- would fail on apply for a reason that has nothing to do with the schema.

DO $do$
DECLARE
  v_bad     TEXT;
  v_count   INTEGER;
  v_allowed BOOLEAN;
  v_reason  TEXT;
BEGIN
  -- 19.1 RLS is on everywhere.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'security_events', 'security_alerts', 'security_alert_events',
       'security_detection_rules', 'security_application_keys',
       'security_retention_policies', 'security_core_settings')
     AND NOT c.relrowsecurity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] RLS is not enabled on: %', v_bad;
  END IF;

  -- 19.2 Nothing in the Core is reachable with the website's anonymous key.
  IF has_table_privilege('anon', 'public.security_events', 'SELECT')
     OR has_table_privilege('anon', 'public.security_alerts', 'SELECT')
     OR has_table_privilege('anon', 'public.security_application_keys', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon can read a Security Core table';
  END IF;

  IF has_function_privilege('anon', 'public.security_query_events(text,text,text,text,text,text,text,text,text,text,uuid,text,text,timestamptz,timestamptz,uuid[],integer,integer)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.security_ingest_event(text,jsonb)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.security_ingest_as_application(text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] a Security Core function is EXECUTE-able by anon';
  END IF;

  -- 19.3 §22 — the raw event table is not SELECTable by an ordinary session.
  -- This is what keeps ip_address behind security_query_events()'s redaction
  -- rather than one PostgREST call away from any administrator.
  IF has_table_privilege('authenticated', 'public.security_events', 'SELECT') THEN
    RAISE EXCEPTION '[fail] authenticated holds SELECT on security_events. Reads must go through security_query_events(), which redacts ip_address, user_agent and device_id per §22.';
  END IF;

  -- 19.4 Nobody can write or amend an event directly.
  IF has_table_privilege('authenticated', 'public.security_events', 'INSERT')
     OR has_table_privilege('authenticated', 'public.security_events', 'UPDATE')
     OR has_table_privilege('authenticated', 'public.security_events', 'DELETE') THEN
    RAISE EXCEPTION '[fail] authenticated can write security_events directly. Ingestion must go through security_ingest_event().';
  END IF;

  -- The key-authenticated path must never be one call away from a browser.
  IF has_function_privilege('authenticated', 'public.security_ingest_as_application(text,jsonb)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] security_ingest_as_application is callable by an ordinary session. It is the path that trusts a key row for application scope.';
  END IF;

  -- §22 reaches alerts as well: an IP-grouped rule records an address in
  -- metadata.group_key, so the alert table is read through its function too.
  IF has_table_privilege('authenticated', 'public.security_alerts', 'SELECT') THEN
    RAISE EXCEPTION '[fail] authenticated holds SELECT on security_alerts. Reads must go through security_query_alerts(), which redacts an IP-derived group key per §22.';
  END IF;

  -- 19.5 §26 — the event store is physically append-only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.security_events'::regclass
       AND tgname = 'trg_security_events_immutable'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '[fail] security_events has no immutability trigger';
  END IF;

  -- 19.6 The registry is the existing one, and the FK proves it.
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.security_events'::regclass
       AND confrelid = 'public.admin_applications'::regclass
       AND contype = 'f'
  ) THEN
    RAISE EXCEPTION '[fail] security_events.application_id does not reference admin_applications. The Core must not carry a second application registry.';
  END IF;

  RAISE NOTICE '[ok] storage: security_events append-only, isolated, and unreadable except through its functions';
END;
$do$;

DO $do$
DECLARE
  v_bad    TEXT;
  v_count  INTEGER;
  v_reason TEXT;
BEGIN
  -- 19.7 §28/§29 — no delegated ROLE may hold cross-application visibility,
  -- network data, rule management or the ability to write events. These are
  -- decisions about a person (administrator_permission_grants) or they belong
  -- to the Super Admin. An edit that maps one of them stops this migration
  -- applying, which is a conversation rather than a silent escalation.
  SELECT string_agg(rp.role_code || ' -> ' || rp.permission_code, ', ' ORDER BY rp.role_code)
    INTO v_bad
    FROM public.admin_role_permissions rp
   WHERE rp.permission_code IN (
     'SECURITY_EVENTS_VIEW_ALL', 'SECURITY_EVENT_PII_VIEW',
     'SECURITY_RULES_MANAGE', 'SECURITY_ALERTS_MANAGE', 'SECURITY_EVENTS_INGEST');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] a delegated role holds a reserved security permission: %. §28 requires cross-application access to be explicitly elevated, not conferred by a job title.', v_bad;
  END IF;

  -- 19.8 The five canonical roles are still five. This file adds permissions,
  -- never a role — see the header on why it cannot.
  SELECT count(*) INTO v_count FROM public.admin_roles;
  IF v_count <> 5 THEN
    RAISE EXCEPTION '[fail] admin_roles holds % roles. The Security Core adds permissions, never roles.', v_count;
  END IF;

  -- 19.9 The validator actually rejects what the contract forbids. Executed
  -- rather than asserted: a validator that failed open would pass every
  -- review and be caught here, on apply.
  IF public.security_validate_event(
       jsonb_build_object('event_category', 'NOT_A_CATEGORY', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO', 'status', 'SUCCESS')
     ) IS DISTINCT FROM 'invalid_event_category' THEN
    RAISE EXCEPTION '[fail] the validator accepted an unknown event_category';
  END IF;

  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'URGENT', 'status', 'SUCCESS')
     ) IS DISTINCT FROM 'invalid_severity' THEN
    RAISE EXCEPTION '[fail] the validator accepted an invalid severity';
  END IF;

  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO', 'status', 'MAYBE')
     ) IS DISTINCT FROM 'invalid_status' THEN
    RAISE EXCEPTION '[fail] the validator accepted an invalid status';
  END IF;

  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO', 'status', 'SUCCESS',
                          'correlation_id', 'not-a-uuid')
     ) IS DISTINCT FROM 'invalid_correlation_id' THEN
    RAISE EXCEPTION '[fail] the validator accepted a malformed correlation_id';
  END IF;

  -- ─── The fail-open cases ────────────────────────────────────────────────
  -- An ABSENT enum, not merely a wrong one. `NULL IN (...)` is NULL, and a
  -- branch on a NULL condition does not fire, so a validator written the
  -- obvious way accepts these — and an event with no severity is exactly what
  -- this function exists to stop. Asserted on apply because the defect is
  -- invisible in review: the code reads as though it rejects them.
  IF public.security_validate_event(
       jsonb_build_object('event_type', 'AUTH', 'event_action', 'LOGIN_SUCCESS',
                          'severity', 'INFO', 'status', 'SUCCESS')
     ) IS DISTINCT FROM 'invalid_event_category' THEN
    RAISE EXCEPTION '[fail] the validator accepted an event with NO event_category';
  END IF;

  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'status', 'SUCCESS')
     ) IS DISTINCT FROM 'invalid_severity' THEN
    RAISE EXCEPTION '[fail] the validator accepted an event with NO severity';
  END IF;

  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO')
     ) IS DISTINCT FROM 'invalid_status' THEN
    RAISE EXCEPTION '[fail] the validator accepted an event with NO status';
  END IF;

  -- A JSON null is the same absence wearing a different hat.
  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', NULL,
                          'status', 'SUCCESS')
     ) IS DISTINCT FROM 'invalid_severity' THEN
    RAISE EXCEPTION '[fail] the validator accepted a JSON-null severity';
  END IF;

  -- An event carrying NO metadata key at all is valid, and must persist as an
  -- empty object rather than as NULL — the column is NOT NULL, and a guard
  -- that tested COALESCE(...) while returning the raw value put a NULL in it.
  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO',
                          'status', 'SUCCESS')
     ) IS NOT NULL THEN
    RAISE EXCEPTION '[fail] the validator rejected an event with no metadata key';
  END IF;

  -- A valid event validates.
  IF public.security_validate_event(
       jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                          'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO', 'status', 'SUCCESS',
                          'metadata', jsonb_build_object('reason', 'ok'))
     ) IS NOT NULL THEN
    RAISE EXCEPTION '[fail] the validator rejected a valid event';
  END IF;

  -- 19.10 §42.3 — the secret scan finds a credential under an innocent key,
  -- which is the case a key denylist alone would miss.
  v_reason := public.security_validate_event(
    jsonb_build_object('event_category', 'AUTHENTICATION', 'event_type', 'AUTH',
                       'event_action', 'LOGIN_SUCCESS', 'severity', 'INFO', 'status', 'SUCCESS',
                       'metadata', jsonb_build_object('password', 'hunter2')));
  IF v_reason IS NULL OR v_reason NOT LIKE 'prohibited_data_in_metadata%' THEN
    RAISE EXCEPTION '[fail] the secret scan accepted metadata carrying a password (got %)', v_reason;
  END IF;

  v_reason := public.security_validate_event(
    jsonb_build_object('event_category', 'API', 'event_type', 'API',
                       'event_action', 'DATA_EXPORTED', 'severity', 'INFO', 'status', 'SUCCESS',
                       'metadata', jsonb_build_object('note',
                         'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U')));
  IF v_reason IS NULL OR v_reason NOT LIKE 'prohibited_data_in_metadata%' THEN
    RAISE EXCEPTION '[fail] the secret scan missed a JWT under an innocent key (got %)', v_reason;
  END IF;

  -- A Luhn-valid card number, spaced the way somebody would paste it.
  v_reason := public.security_validate_event(
    jsonb_build_object('event_category', 'PAYMENT', 'event_type', 'PAYMENT',
                       'event_action', 'PAYMENT_CREATED', 'severity', 'INFO', 'status', 'SUCCESS',
                       'metadata', jsonb_build_object('reference', '4242 4242 4242 4242')));
  IF v_reason IS NULL OR v_reason NOT LIKE 'prohibited_data_in_metadata%' THEN
    RAISE EXCEPTION '[fail] the secret scan missed a payment card number (got %)', v_reason;
  END IF;

  -- And does NOT fire on an ordinary long number, which is what would make the
  -- rule get switched off in practice.
  IF public.security_validate_event(
       jsonb_build_object('event_category', 'ORDER', 'event_type', 'ORDER',
                          'event_action', 'ORDER_CREATED', 'severity', 'INFO', 'status', 'SUCCESS',
                          'metadata', jsonb_build_object('order_number', '1234567890123456'))
     ) IS NOT NULL THEN
    RAISE EXCEPTION '[fail] the secret scan false-positived on an ordinary 16-digit order number';
  END IF;

  -- 19.11 The seeded rule exists and is the one §31 describes.
  IF NOT EXISTS (
    SELECT 1 FROM public.security_detection_rules
     WHERE code = 'BRUTE_FORCE_LOGIN'
       AND threshold_count = 5 AND window_seconds = 300 AND group_by = 'ACTOR'
  ) THEN
    RAISE EXCEPTION '[fail] the BRUTE_FORCE_LOGIN rule is missing or does not match §31';
  END IF;

  -- 19.12 The application registry is intact and is still the Admin Core's.
  IF EXISTS (SELECT 1 FROM public.platform_products WHERE id <> 'unchained') THEN
    RAISE EXCEPTION '[fail] platform_products holds a product other than unchained';
  END IF;

  RAISE NOTICE '[ok] Unchained Security & Audit Core v1.0 applied: % applications registered, % permissions, 1 detection rule, validator and secret scan verified',
    (SELECT count(*) FROM public.admin_applications),
    (SELECT count(*) FROM public.admin_permissions WHERE resource = 'SECURITY');
END;
$do$;

NOTIFY pgrst, 'reload schema';

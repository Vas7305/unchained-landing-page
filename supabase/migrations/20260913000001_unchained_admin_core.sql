-- ════════════════════════════════════════════════════════════
-- Phase 11 — Unchained Administration Core
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260905000001_unchained_foundation.sql   roles, is_super_admin(), admin_logs,
--                                             platform_products, product_memberships
--
-- Creates:
--     admin_applications               the web properties Unchained administers
--     admin_roles                      the five canonical administrator roles
--     admin_permissions                the permission catalogue
--     admin_role_permissions           role -> permission mapping
--     administrators                   delegated administrator identity + scope
--     administrator_permission_grants  per-administrator additive grants (§26)
--     administrator_compensation       fixed salary, versioned
--     admin_invitations                one-time, hashed, expiring invitations
--   + admin_core_log_event()           the security/audit writer
--   + admin_has_permission()           the authorization decision
--   + admin_authorize()                the enforcing wrapper that raises + logs
--   + admin_resolve_context()          the §28 integration contract
--   + admin_role_capabilities()        the capability preview, from real data
--   + admin_list_administrators()      the management read
--   ~ admin_logs                       made physically immutable (trigger)
--
-- ─── What this phase is, and what it deliberately is not ──────────────────
-- It is the identity, RBAC, application-scope, compensation, invitation and
-- audit foundation for every Unchained Business property. It is NOT an
-- administrator CRUD screen, and it is NOT a second authentication system:
-- people still authenticate through GoTrue exactly as they did, and
-- public.roles still says who the Super Admin is.
--
-- ─── Why the Core lives in THIS database ──────────────────────────────────
-- The standing rule of this system is one Supabase project per web property,
-- fully isolated, precisely because a shared auth.users mixed one property's
-- CUSTOMERS with another's staff (see 20260905000001's header). Putting the
-- administrator directory here does not undo that, and the distinction is the
-- whole argument:
--
--   · what was shared, and caused the incident, was a CUSTOMER pool;
--   · what is centralized here is a STAFF directory - delegated administrators
--     and nobody else. No customer of any property is ever a row in
--     public.administrators.
--
-- That is also the only shape in which "revoke this contractor everywhere" is
-- answerable at all, which the isolation memo named as the thing it could not
-- do. Each property keeps its own auth.users, its own keys and its own
-- business data; what it stops owning is a private, divergent idea of who its
-- administrators are.
--
-- A project of its own for the Core was considered and rejected: nothing here
-- needs one, the organisation's two free project slots are both in use, and a
-- third database would have to be kept in step with this one by hand.
--
-- ─── Why admin_applications is NOT platform_products ──────────────────────
-- They answer different questions and must not be merged.
--
--   platform_products  - "which products does THIS database grant memberships
--                        for". 20260905000001 §9.2 RAISES if it ever holds a
--                        row other than 'unchained', because a second row
--                        there is somebody re-creating the shared install the
--                        split undid. This file does not touch it, and §13
--                        below asserts it is still intact.
--
--   admin_applications - "which web properties does Unchained administer".
--                        tancerca and frito belong here and nowhere else.
--                        A row is a SCOPE, not a grant: it confers nothing on
--                        anybody and opens no table in any other database.
--
-- ─── Deny by default, stated as a constraint rather than an intention ─────
-- A role holds exactly the permissions mapped to it in admin_role_permissions.
-- There is no "super admin bypass" inside admin_has_permission() beyond
-- public.is_super_admin(), which is the install's owner and not a delegated
-- role. §13.4 asserts that no delegated role holds an administrator-management,
-- economic-configuration or global-settings permission - if a future edit maps
-- one, this migration stops being appliable, which is the point.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- As with every migration in this directory: paste into the Studio SQL editor
-- rather than running `supabase db push`, which would replay history against
-- live production. Every object uses IF NOT EXISTS, CREATE OR REPLACE or
-- DROP-then-CREATE on its own name, so it is safe to run twice.

-- ─── 0. Shared touch trigger ──────────────────────────────────────────────
-- The Core's own BEFORE UPDATE trigger. platform_touch_updated_at() would have
-- done, but a name that says "platform" on tables that are not the platform's
-- reads as a coupling that is not there.

CREATE OR REPLACE FUNCTION public.admin_core_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ─── 1. admin_applications - the application registry ─────────────────────
-- The canonical list of properties an administrator can be scoped to. It is
-- DATA: adding Frito's admin is an INSERT, not a migration and not a constant
-- in a React bundle. §10 asks that the creation form load its applications
-- from here, and it does.
--
-- A disabled application keeps its administrators - disabling is not a
-- deletion - but admin_has_permission() refuses every request against it, so
-- turning a property off closes it for everyone in one write.

CREATE TABLE IF NOT EXISTS public.admin_applications (
  slug        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  -- One line for the operator choosing a scope. Not shown to anybody else.
  description TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Hyphens allowed, unlike platform_products.id: these are web-property
  -- slugs ('unchained-business'), not SQL-adjacent product ids.
  CONSTRAINT admin_applications_slug_format
    CHECK (slug ~ '^[a-z][a-z0-9-]{1,40}$'),
  CONSTRAINT admin_applications_name_present
    CHECK (length(btrim(name)) > 0),
  CONSTRAINT admin_applications_status_valid
    CHECK (status IN ('active', 'disabled'))
);

DROP TRIGGER IF EXISTS trg_admin_applications_updated_at ON public.admin_applications;
CREATE TRIGGER trg_admin_applications_updated_at
  BEFORE UPDATE ON public.admin_applications
  FOR EACH ROW EXECUTE FUNCTION public.admin_core_touch_updated_at();

-- ─── 2. admin_roles - the five canonical roles ────────────────────────────
-- `status` carries the latency of TRANSPORT_OPERATIONS_ADMIN, and it is the
-- whole mechanism by which that role is real and inert at the same time:
--
--     'active'   - the role resolves to its mapped permissions.
--     'latent'   - the role may be ASSIGNED, and resolves to NO permissions at
--                  all. Its mapping already exists; enabling the module is
--                  UPDATE admin_roles SET status='active' WHERE code=..., and
--                  nothing about the schema, the mapping or the panel changes.
--     'disabled' - neither assignable nor resolving.
--
-- That is what §27 asks for: the authorization foundation exists now, the
-- Transport Supervisor does not, and the second can arrive without touching
-- the first.

CREATE TABLE IF NOT EXISTS public.admin_roles (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  -- The functional module this role belongs to, when it has one. Only the
  -- transport role does today; it is what a future Transport Supervisor build
  -- looks itself up by.
  module      TEXT,
  status      TEXT NOT NULL DEFAULT 'active',
  -- Ordering for the role selector, so the list does not reshuffle
  -- alphabetically when a role is renamed.
  sort_order  INTEGER NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT admin_roles_code_format
    CHECK (code ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT admin_roles_module_format
    CHECK (module IS NULL OR module ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT admin_roles_status_valid
    CHECK (status IN ('active', 'latent', 'disabled'))
);

DROP TRIGGER IF EXISTS trg_admin_roles_updated_at ON public.admin_roles;
CREATE TRIGGER trg_admin_roles_updated_at
  BEFORE UPDATE ON public.admin_roles
  FOR EACH ROW EXECUTE FUNCTION public.admin_core_touch_updated_at();

-- ─── 3. admin_permissions - the catalogue ─────────────────────────────────
-- One row per thing that can be permitted. `resource` and `action` are split
-- out rather than parsed from the code, so a screen can group by resource
-- without string-splitting, and `risk_level` is what lets the capability
-- preview tell "view a report" from "rewrite the economy".

CREATE TABLE IF NOT EXISTS public.admin_permissions (
  code        TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  resource    TEXT NOT NULL,
  action      TEXT NOT NULL,
  risk_level  TEXT NOT NULL DEFAULT 'low',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT admin_permissions_code_format
    CHECK (code ~ '^[A-Z][A-Z0-9_]{1,60}$'),
  CONSTRAINT admin_permissions_risk_valid
    CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT admin_permissions_status_valid
    CHECK (status IN ('active', 'disabled'))
);

CREATE INDEX IF NOT EXISTS idx_admin_permissions_resource
  ON public.admin_permissions (resource, action);

DROP TRIGGER IF EXISTS trg_admin_permissions_updated_at ON public.admin_permissions;
CREATE TRIGGER trg_admin_permissions_updated_at
  BEFORE UPDATE ON public.admin_permissions
  FOR EACH ROW EXECUTE FUNCTION public.admin_core_touch_updated_at();

-- ─── 4. admin_role_permissions - the mapping ──────────────────────────────
-- The ONLY place a role acquires a permission. No component, no route guard
-- and no edge function carries a second copy of this list; every one of them
-- asks admin_has_permission(), which reads this table.
--
-- ON DELETE CASCADE on both sides: removing a permission from the catalogue
-- must not leave a mapping pointing at nothing, and a role that is deleted
-- takes its grants with it.

CREATE TABLE IF NOT EXISTS public.admin_role_permissions (
  role_code       TEXT NOT NULL REFERENCES public.admin_roles(code)        ON UPDATE CASCADE ON DELETE CASCADE,
  permission_code TEXT NOT NULL REFERENCES public.admin_permissions(code)  ON UPDATE CASCADE ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (role_code, permission_code)
);

CREATE INDEX IF NOT EXISTS idx_admin_role_permissions_permission
  ON public.admin_role_permissions (permission_code);

-- ─── 5. administrators - identity and scope ───────────────────────────────
-- One row per (person, application). §7's model, stated as columns:
-- application_slug is NOT NULL, so an administrator without an application
-- cannot exist - the form cannot omit it because the schema will not take it.
--
-- ─── user_id is nullable, and that is the PENDING state ───────────────────
-- An administrator exists from the moment the Super Admin creates them, before
-- any auth.users row does. The GoTrue account is created when the invitation
-- is accepted, and that write is also what moves the row to ACTIVE. Until
-- then the administrator is a record with an address and no way in.
--
-- ─── Why the unique key is (email, application) and not (email) ───────────
-- §7 requires exactly one application per administrator. Somebody who ends up
-- administering two properties is therefore two administrator RECORDS, not one
-- record with two scopes - which keeps every authorization question answerable
-- from a single row, and keeps revoking one property from touching the other.
-- The unique key permits that while making a second role in the SAME
-- application impossible, which is the thing that would make "what may this
-- person do here" ambiguous.
--
-- A revoked administrator keeps their row: re-inviting them reactivates it,
-- so the history of what they held stays attached to the person. There is no
-- destructive delete path in this module (§9, §19).

CREATE TABLE IF NOT EXISTS public.administrators (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  -- ON DELETE RESTRICT (the default) rather than SET NULL: nulling the account
  -- of an ACTIVE administrator would violate administrators_active_has_user
  -- anyway, and failing the auth deletion outright is the more honest error.
  -- An account backing an administrator is released by revoking the
  -- administrator, which is a recorded act, not by deleting the login.
  user_id          UUID REFERENCES auth.users(id),
  name             TEXT NOT NULL,
  email            TEXT NOT NULL,
  phone            TEXT,
  application_slug TEXT NOT NULL REFERENCES public.admin_applications(slug) ON UPDATE CASCADE,
  role_code        TEXT NOT NULL REFERENCES public.admin_roles(code)        ON UPDATE CASCADE,
  status           TEXT NOT NULL DEFAULT 'PENDING',
  -- Stamped by admin_touch_last_access(), called by the panel once per
  -- session. Nullable for somebody who has never signed in.
  last_access_at   TIMESTAMPTZ,
  -- Why access was suspended or revoked, for the operator reading the list.
  -- The full record of the change is in admin_logs.
  status_reason    TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id),
  updated_by       UUID REFERENCES auth.users(id),

  CONSTRAINT administrators_name_present
    CHECK (length(btrim(name)) > 0),
  -- Deliberately loose. Address validation belongs to GoTrue, which is the
  -- thing that actually has to deliver mail; a stricter regex here would
  -- reject valid addresses and teach nobody anything.
  CONSTRAINT administrators_email_shape
    CHECK (email ~ '^[^@[:space:]]+@[^@[:space:]]+[.][^@[:space:]]+$'),
  CONSTRAINT administrators_status_valid
    CHECK (status IN ('PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED')),
  -- An ACTIVE administrator has an account. PENDING is the only state in
  -- which user_id may be absent, and this is what stops a row being flipped
  -- to ACTIVE without one.
  CONSTRAINT administrators_active_has_user
    CHECK (status = 'PENDING' OR user_id IS NOT NULL)
);

-- Case-insensitive: 'Juan@x.com' and 'juan@x.com' are one person, and GoTrue
-- treats them as one account.
CREATE UNIQUE INDEX IF NOT EXISTS administrators_email_application_unique
  ON public.administrators (lower(email), application_slug);

CREATE INDEX IF NOT EXISTS idx_administrators_user
  ON public.administrators (user_id) WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_administrators_application
  ON public.administrators (application_slug, status);

DROP TRIGGER IF EXISTS trg_administrators_updated_at ON public.administrators;
CREATE TRIGGER trg_administrators_updated_at
  BEFORE UPDATE ON public.administrators
  FOR EACH ROW EXECUTE FUNCTION public.admin_core_touch_updated_at();

-- ─── 6. administrator_permission_grants - the extension seam (§26) ────────
-- Additive, per-administrator permissions on top of the role: the shape that
-- makes "APP_ADMIN + CMS_PUBLISH" a row rather than a schema redesign.
--
-- Created now, deliberately EMPTY, and with no UI and no writer in this
-- module. It exists so the extension is a data change later; §26 asks that the
-- schema allow it without a redesign, and the cheapest honest way to promise
-- that is to have already built the join the resolver reads.
--
-- `effect` is ALLOW or DENY, and DENY wins - see admin_has_permission(). A
-- deny-only override is how a single administrator can be narrowed below their
-- role without inventing a bespoke role for them.

CREATE TABLE IF NOT EXISTS public.administrator_permission_grants (
  administrator_id UUID NOT NULL REFERENCES public.administrators(id)      ON DELETE CASCADE,
  permission_code  TEXT NOT NULL REFERENCES public.admin_permissions(code) ON UPDATE CASCADE ON DELETE CASCADE,
  effect           TEXT NOT NULL DEFAULT 'ALLOW',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id),

  PRIMARY KEY (administrator_id, permission_code),
  CONSTRAINT administrator_permission_grants_effect_valid
    CHECK (effect IN ('ALLOW', 'DENY'))
);

-- ─── 7. administrator_compensation - the fixed salary ─────────────────────
-- Versioned rather than a column on the administrator, because a salary has a
-- history and payroll questions are asked about the past. Superseding a row
-- closes it with effective_to and opens a new one; nothing is overwritten.
--
-- The partial unique index is what makes "the current salary" a single row
-- rather than a query with an ORDER BY and a hope.

CREATE TABLE IF NOT EXISTS public.administrator_compensation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id UUID NOT NULL REFERENCES public.administrators(id) ON DELETE CASCADE,
  salary_amount    NUMERIC(14, 2) NOT NULL,
  currency         TEXT NOT NULL DEFAULT 'CUP',
  effective_from   DATE NOT NULL DEFAULT current_date,
  effective_to     DATE,
  status           TEXT NOT NULL DEFAULT 'active',
  created_by       UUID REFERENCES auth.users(id),
  updated_by       UUID REFERENCES auth.users(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT administrator_compensation_amount_valid
    CHECK (salary_amount >= 0),
  CONSTRAINT administrator_compensation_currency_format
    CHECK (currency ~ '^[A-Z]{3}$'),
  CONSTRAINT administrator_compensation_status_valid
    CHECK (status IN ('active', 'superseded')),
  CONSTRAINT administrator_compensation_period_valid
    CHECK (effective_to IS NULL OR effective_to >= effective_from)
);

CREATE UNIQUE INDEX IF NOT EXISTS administrator_compensation_active_unique
  ON public.administrator_compensation (administrator_id)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS trg_administrator_compensation_updated_at ON public.administrator_compensation;
CREATE TRIGGER trg_administrator_compensation_updated_at
  BEFORE UPDATE ON public.administrator_compensation
  FOR EACH ROW EXECUTE FUNCTION public.admin_core_touch_updated_at();

-- ─── 8. admin_invitations - one-time, hashed, expiring ────────────────────
-- ─── Why the Core mints its own token instead of using GoTrue's ───────────
-- GoTrue's invite link is already single-use and already expires, and
-- create-unchained-member uses it directly. It is not enough here for one
-- reason: it cannot be REVOKED. §15 requires that a revoked invitation fail,
-- and that the invitation's status be auditable - neither is answerable about
-- a token GoTrue owns and does not report on.
--
-- So the Core issues its own: 32 random bytes, stored only as a SHA-256 hash,
-- carried in the link, and exchanged at /admin-invite. GoTrue's link is
-- generated only AFTER that token has been validated and atomically consumed,
-- so the two are in series rather than in competition.
--
-- The plaintext token is never stored, never logged, and never leaves the
-- edge function that mints it except in the email body. A dump of this table
-- grants nobody anything.

CREATE TABLE IF NOT EXISTS public.admin_invitations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  administrator_id UUID NOT NULL REFERENCES public.administrators(id) ON DELETE CASCADE,
  -- Lower-case hex of SHA-256 over the raw token. Unique so a replayed insert
  -- is a constraint error rather than an ambiguity.
  token_hash       TEXT NOT NULL UNIQUE,
  expires_at       TIMESTAMPTZ NOT NULL,
  used_at          TIMESTAMPTZ,
  revoked_at       TIMESTAMPTZ,
  status           TEXT NOT NULL DEFAULT 'pending',
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by       UUID REFERENCES auth.users(id),

  CONSTRAINT admin_invitations_token_hash_format
    CHECK (token_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT admin_invitations_status_valid
    CHECK (status IN ('pending', 'accepted', 'revoked')),
  -- The stored status and the timestamps cannot disagree. An 'accepted' row
  -- without used_at would make the audit trail lie.
  CONSTRAINT admin_invitations_status_consistent
    CHECK (
      (status = 'pending'  AND used_at IS NULL AND revoked_at IS NULL) OR
      (status = 'accepted' AND used_at IS NOT NULL) OR
      (status = 'revoked'  AND revoked_at IS NOT NULL)
    )
);

-- At most one live invitation per administrator. Resending revokes the
-- previous one first, so an old link in an old inbox stops working the moment
-- a new one is sent - which is what "one-time" has to mean in practice.
CREATE UNIQUE INDEX IF NOT EXISTS admin_invitations_pending_unique
  ON public.admin_invitations (administrator_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_admin_invitations_administrator
  ON public.admin_invitations (administrator_id, created_at DESC);

-- ─── 9. Seeds ─────────────────────────────────────────────────────────────
-- ON CONFLICT DO UPDATE on the descriptive columns and NOT on `status`: this
-- file is re-runnable, and re-running it must not reopen an application an
-- operator disabled or re-activate the latent transport role. Wording is
-- schema; state is data.

-- 9.1 The application registry.
--
-- 'frito' is registered and DISABLED. It is listed because the registry is the
-- place a property is named, and disabled because Frito has no admin yet:
-- registering it makes the scope visible without making it selectable, and
-- opening it later is one UPDATE.
INSERT INTO public.admin_applications (slug, name, description, status) VALUES
  ('unchained-business', 'Unchained Business',
   'Commercial, leads, projects, workforce and the public CMS.', 'active'),
  ('tancerca', 'TanCerca',
   'Marketplace, delivery, mobility and the platform economy.', 'active'),
  ('frito', 'Frito',
   'Registered for scope. No administrative application yet.', 'disabled')
ON CONFLICT (slug) DO UPDATE
  SET name = EXCLUDED.name, description = EXCLUDED.description;

-- 9.2 The five canonical roles. §3 says no others are to be added in this
-- implementation, and §11 says the UI uses these codes rather than labels.
INSERT INTO public.admin_roles (code, name, description, module, status, sort_order) VALUES
  ('APP_ADMIN', 'Application administrator',
   'General administrator of one application: its dashboard, its operational data and its commercial roster.',
   NULL, 'active', 10),
  ('CONTENT_ADMIN', 'Content administrator',
   'The CMS and nothing else: creating, editing, publishing and retiring content.',
   NULL, 'active', 20),
  ('FINANCE_ADMIN', 'Finance administrator',
   'Financial operations: reading the numbers, registering permitted expenses and reconciling. Never changing the rules.',
   NULL, 'active', 30),
  ('OPERATIONS_ADMIN', 'Operations administrator',
   'Day-to-day operations: operational entities, incidents, affiliates, commercials and specialists.',
   NULL, 'active', 40),
  ('TRANSPORT_OPERATIONS_ADMIN', 'Transport operations administrator',
   'Reserved for the future Transport Supervisor module. Assignable now; grants nothing until that module ships.',
   'TRANSPORT_OPERATIONS', 'latent', 50)
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      module = EXCLUDED.module,
      sort_order = EXCLUDED.sort_order;

-- 9.3 The permission catalogue.
--
-- §5's list, plus three the existing panel actually needs and that list did
-- not name: APP_DASHBOARD_VIEW (the minimum "may open this application's admin
-- shell"), and OPERATIONS_VIEW / OPERATIONS_MANAGE (the operational entities
-- and incidents §4.4 describes). §5 explicitly allows refining the catalogue
-- after inspecting the project; nothing from it has been dropped.
INSERT INTO public.admin_permissions (code, name, description, resource, action, risk_level) VALUES
  ('APP_DASHBOARD_VIEW', 'Open the application', 'Open this application''s admin shell and see its dashboard.', 'APP', 'VIEW', 'low'),

  ('ADMIN_VIEW',    'View administrators',    'List and read administrator records.',          'ADMIN', 'VIEW',    'high'),
  ('ADMIN_CREATE',  'Create administrators',  'Create an administrator and issue an invitation.', 'ADMIN', 'CREATE', 'critical'),
  ('ADMIN_UPDATE',  'Update administrators',  'Change an administrator''s role, scope or details.', 'ADMIN', 'UPDATE', 'critical'),
  ('ADMIN_SUSPEND', 'Suspend administrators', 'Suspend an administrator''s access.',           'ADMIN', 'SUSPEND', 'critical'),
  ('ADMIN_REVOKE',  'Revoke administrators',  'Revoke an administrator''s access permanently.', 'ADMIN', 'REVOKE',  'critical'),

  ('AFFILIATE_VIEW',   'View affiliates',   'Read the affiliate roster.',   'AFFILIATE', 'VIEW',   'low'),
  ('AFFILIATE_CREATE', 'Create affiliates', 'Add an affiliate.',            'AFFILIATE', 'CREATE', 'medium'),
  ('AFFILIATE_UPDATE', 'Update affiliates', 'Edit an affiliate.',           'AFFILIATE', 'UPDATE', 'medium'),

  ('COMMERCIAL_VIEW',   'View commercials',   'Read the commercial roster.', 'COMMERCIAL', 'VIEW',   'low'),
  ('COMMERCIAL_CREATE', 'Create commercials', 'Add a commercial.',           'COMMERCIAL', 'CREATE', 'medium'),
  ('COMMERCIAL_UPDATE', 'Update commercials', 'Edit a commercial.',          'COMMERCIAL', 'UPDATE', 'medium'),

  ('SPECIALIST_VIEW',   'View specialists',   'Read the specialist roster.', 'SPECIALIST', 'VIEW',   'low'),
  ('SPECIALIST_CREATE', 'Create specialists', 'Add a specialist.',           'SPECIALIST', 'CREATE', 'medium'),
  ('SPECIALIST_UPDATE', 'Update specialists', 'Edit a specialist.',          'SPECIALIST', 'UPDATE', 'medium'),

  ('OPERATIONS_VIEW',   'View operations',   'Operational dashboards, entities and incidents.', 'OPERATIONS', 'VIEW',   'low'),
  ('OPERATIONS_MANAGE', 'Manage operations', 'Act on operational entities and incidents.',      'OPERATIONS', 'MANAGE', 'medium'),

  ('CMS_VIEW',    'View content',    'Open the CMS and read content.',        'CMS', 'VIEW',    'low'),
  ('CMS_CREATE',  'Create content',  'Create content entities.',              'CMS', 'CREATE',  'medium'),
  ('CMS_EDIT',    'Edit content',    'Edit existing content.',                'CMS', 'EDIT',    'medium'),
  ('CMS_PUBLISH', 'Publish content', 'Publish content to the public site.',   'CMS', 'PUBLISH', 'medium'),
  ('CMS_DELETE',  'Delete content',  'Archive or delete content.',            'CMS', 'DELETE',  'high'),

  ('FINANCE_VIEW',          'View finance',          'Read financial information and transactions.', 'FINANCE', 'VIEW',   'medium'),
  ('FINANCE_REPORT_VIEW',   'View financial reports','Read financial reporting.',                    'FINANCE', 'REPORT', 'medium'),
  ('EXPENSE_CREATE',        'Register expenses',     'Register a permitted expense.',                'EXPENSE', 'CREATE', 'medium'),
  ('RECONCILIATION_MANAGE', 'Reconcile',             'Reconcile transactions.',                      'RECONCILIATION', 'MANAGE', 'medium'),

  ('TRANSPORT_OPERATIONS_VIEW',   'View transport operations',   'Supervise transport operations in real time.', 'TRANSPORT_OPERATIONS', 'VIEW',   'medium'),
  ('TRANSPORT_OPERATIONS_MANAGE', 'Manage transport operations', 'Intervene in transport operations.',           'TRANSPORT_OPERATIONS', 'MANAGE', 'high'),

  ('SALARY_VIEW',   'View salaries',   'See administrator compensation.', 'SALARY', 'VIEW',   'high'),
  ('SALARY_MANAGE', 'Change salaries', 'Set administrator compensation.', 'SALARY', 'MANAGE', 'critical'),

  ('PRICING_VIEW',   'View pricing',   'See service pricing.',    'PRICING', 'VIEW',   'medium'),
  ('PRICING_MANAGE', 'Change pricing', 'Change service pricing.', 'PRICING', 'MANAGE', 'critical'),

  ('MEMBERSHIP_PRICING_VIEW',   'View membership pricing',   'See membership plans and prices.',    'MEMBERSHIP_PRICING', 'VIEW',   'medium'),
  ('MEMBERSHIP_PRICING_MANAGE', 'Change membership pricing', 'Change membership plans and prices.', 'MEMBERSHIP_PRICING', 'MANAGE', 'critical'),

  ('TANCOINS_VIEW',   'View TanCoins',   'See the TanCoins economy.',    'TANCOINS', 'VIEW',   'medium'),
  ('TANCOINS_MANAGE', 'Change TanCoins', 'Change the TanCoins economy.', 'TANCOINS', 'MANAGE', 'critical'),

  ('FRITOS_VIEW',   'View Fritos',   'See the Fritos economy.',    'FRITOS', 'VIEW',   'medium'),
  ('FRITOS_MANAGE', 'Change Fritos', 'Change the Fritos economy.', 'FRITOS', 'MANAGE', 'critical'),

  ('ECONOMY_VIEW',   'View economy',   'See economic rules and commissions.',    'ECONOMY', 'VIEW',   'medium'),
  ('ECONOMY_MANAGE', 'Change economy', 'Change economic rules and commissions.', 'ECONOMY', 'MANAGE', 'critical'),

  ('ANTIFRAUD_VIEW',   'View anti-fraud',      'See anti-fraud configuration and signals.', 'ANTIFRAUD', 'VIEW',   'high'),
  ('ANTIFRAUD_MANAGE', 'Configure anti-fraud', 'Change anti-fraud configuration.',          'ANTIFRAUD', 'MANAGE', 'critical'),

  ('GLOBAL_SETTINGS_MANAGE',   'Manage global settings',   'Change installation-wide configuration.',        'GLOBAL_SETTINGS',   'MANAGE', 'critical'),
  ('ROLE_MANAGE',              'Manage roles',             'Create and edit administrator roles.',           'ROLE',              'MANAGE', 'critical'),
  ('PERMISSION_MANAGE',        'Manage permissions',       'Grant and revoke permissions.',                  'PERMISSION',        'MANAGE', 'critical'),
  ('APPLICATION_SCOPE_MANAGE', 'Manage application scope', 'Change which application somebody administers.', 'APPLICATION_SCOPE', 'MANAGE', 'critical')
ON CONFLICT (code) DO UPDATE
  SET name = EXCLUDED.name,
      description = EXCLUDED.description,
      resource = EXCLUDED.resource,
      action = EXCLUDED.action,
      risk_level = EXCLUDED.risk_level;

-- 9.4 The role -> permission mapping.
--
-- ─── What is NOT here is the security property ────────────────────────────
-- No delegated role is mapped to ADMIN_*, SALARY_MANAGE, PRICING_MANAGE,
-- MEMBERSHIP_PRICING_MANAGE, TANCOINS_MANAGE, FRITOS_MANAGE, ECONOMY_MANAGE,
-- ANTIFRAUD_MANAGE, GLOBAL_SETTINGS_MANAGE, ROLE_MANAGE, PERMISSION_MANAGE or
-- APPLICATION_SCOPE_MANAGE. §21 asks for that; §13.4 asserts it on apply, so
-- an edit that maps one of them cannot be applied without also deleting the
-- assertion, which is a visible act rather than an accident.
--
-- APP_DASHBOARD_VIEW is given to the four ACTIVE roles as the minimum "may
-- open this application's admin shell". It conveys no data of its own - every
-- screen behind it carries its own permission - and without it a delegated
-- administrator would authenticate successfully and then have nowhere to land.
--
-- FINANCE_ADMIN deliberately does NOT hold SALARY_VIEW. §14 allows salary to
-- be visible where the permission is explicitly granted; deny-by-default means
-- "explicitly granted" is a decision somebody makes about a person, not a
-- default that arrives with a job title.
--
-- TRANSPORT_OPERATIONS_ADMIN IS mapped, and resolves to nothing, because its
-- role row is 'latent'. That is the latency mechanism: the mapping is already
-- correct for the day the module ships, and until then the resolver returns an
-- empty set for it. See admin_has_permission() and §2.
INSERT INTO public.admin_role_permissions (role_code, permission_code) VALUES
  ('APP_ADMIN', 'APP_DASHBOARD_VIEW'),
  ('APP_ADMIN', 'OPERATIONS_VIEW'),
  ('APP_ADMIN', 'AFFILIATE_VIEW'),
  ('APP_ADMIN', 'AFFILIATE_CREATE'),
  ('APP_ADMIN', 'AFFILIATE_UPDATE'),
  ('APP_ADMIN', 'COMMERCIAL_VIEW'),
  ('APP_ADMIN', 'COMMERCIAL_CREATE'),
  ('APP_ADMIN', 'COMMERCIAL_UPDATE'),
  ('APP_ADMIN', 'SPECIALIST_VIEW'),
  ('APP_ADMIN', 'SPECIALIST_CREATE'),
  ('APP_ADMIN', 'SPECIALIST_UPDATE'),

  ('CONTENT_ADMIN', 'APP_DASHBOARD_VIEW'),
  ('CONTENT_ADMIN', 'CMS_VIEW'),
  ('CONTENT_ADMIN', 'CMS_CREATE'),
  ('CONTENT_ADMIN', 'CMS_EDIT'),
  ('CONTENT_ADMIN', 'CMS_PUBLISH'),
  ('CONTENT_ADMIN', 'CMS_DELETE'),

  ('FINANCE_ADMIN', 'APP_DASHBOARD_VIEW'),
  ('FINANCE_ADMIN', 'FINANCE_VIEW'),
  ('FINANCE_ADMIN', 'FINANCE_REPORT_VIEW'),
  ('FINANCE_ADMIN', 'EXPENSE_CREATE'),
  ('FINANCE_ADMIN', 'RECONCILIATION_MANAGE'),

  ('OPERATIONS_ADMIN', 'APP_DASHBOARD_VIEW'),
  ('OPERATIONS_ADMIN', 'OPERATIONS_VIEW'),
  ('OPERATIONS_ADMIN', 'OPERATIONS_MANAGE'),
  ('OPERATIONS_ADMIN', 'AFFILIATE_VIEW'),
  ('OPERATIONS_ADMIN', 'AFFILIATE_CREATE'),
  ('OPERATIONS_ADMIN', 'AFFILIATE_UPDATE'),
  ('OPERATIONS_ADMIN', 'COMMERCIAL_VIEW'),
  ('OPERATIONS_ADMIN', 'COMMERCIAL_CREATE'),
  ('OPERATIONS_ADMIN', 'COMMERCIAL_UPDATE'),
  ('OPERATIONS_ADMIN', 'SPECIALIST_VIEW'),
  ('OPERATIONS_ADMIN', 'SPECIALIST_CREATE'),
  ('OPERATIONS_ADMIN', 'SPECIALIST_UPDATE'),

  ('TRANSPORT_OPERATIONS_ADMIN', 'TRANSPORT_OPERATIONS_VIEW'),
  ('TRANSPORT_OPERATIONS_ADMIN', 'TRANSPORT_OPERATIONS_MANAGE')
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- ─── 10. The security event writer ────────────────────────────────────────
-- ─── There is no new event table, and that is deliberate ──────────────────
-- §22 says to integrate with the existing contract rather than invent a
-- parallel one. In THIS database the existing contract is public.admin_logs:
-- (admin_id, action, metadata, created_at), written by privileged code and
-- readable only by a super_admin. create-unchained-member already writes
-- 'unchained_member_created' into it.
--
-- TanCerca's project has a richer one - security_events, log_security_event(),
-- admin_audit_log - and it is NOT reachable from here. The databases are
-- isolated by design; calling across them would require a credential spanning
-- two properties, which is the thing the split removed. So this function keeps
-- the shape of the local contract and puts the richer envelope §22 asks for
-- (actor, target, application, action, result, metadata) inside `metadata`,
-- which is exactly where 20260905000001 §3 says a target belongs.
--
-- ─── Why the actor cannot be forged ───────────────────────────────────────
-- p_actor exists because the edge function runs as service_role, where
-- auth.uid() is NULL and the real actor is the super_admin who called it. It
-- is honoured ONLY when auth.uid() is NULL; a session-scoped caller always
-- logs as themselves whatever they pass. EXECUTE is additionally revoked from
-- `authenticated` altogether, so the panel cannot reach this at all - every
-- event it causes is written by one of the SECURITY DEFINER functions below.
--
-- ─── Never throws ─────────────────────────────────────────────────────────
-- A failure to record an event must not roll back the operation that caused
-- it, and must not become a way to break a write by making logging fail. An
-- unwritable log is reported as a WARNING and the caller continues, which is
-- the same choice TanCerca's log_security_event() made.

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
  v_actor UUID;
BEGIN
  -- A session always logs as itself. Only a caller with no session at all -
  -- service_role in an edge function - may name the actor.
  v_actor := COALESCE((SELECT auth.uid()), p_actor);

  -- admin_logs.admin_id is NOT NULL and references auth.users. An event with
  -- no identifiable actor has nowhere to go, and inventing one would be worse
  -- than not recording it. In practice this cannot happen: every caller below
  -- either has a session or is the edge function passing the super_admin who
  -- authorized it.
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
EXCEPTION WHEN OTHERS THEN
  RAISE WARNING '[admin-core] % not recorded: %', p_action, SQLERRM;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_core_log_event(TEXT, TEXT, TEXT, UUID, JSONB, TEXT, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_core_log_event(TEXT, TEXT, TEXT, UUID, JSONB, TEXT, UUID)
  TO service_role;

-- ─── 11. admin_logs becomes physically immutable ──────────────────────────
-- §23 requires the audit trail be immutable from the delegated administrator
-- interface. RLS already achieves that - authenticated holds SELECT and
-- nothing else. This goes further and blocks UPDATE and DELETE for EVERY
-- role, service_role included, which is what makes the trail evidence rather
-- than a table that happens not to be edited.
--
-- Nothing in this repository updates or deletes admin_logs;
-- create-unchained-member only inserts. Rotation, if it is ever wanted, is a
-- deliberate act that drops this trigger first.

CREATE OR REPLACE FUNCTION public.admin_logs_immutable()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'public.admin_logs is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_admin_logs_immutable ON public.admin_logs;
CREATE TRIGGER trg_admin_logs_immutable
  BEFORE UPDATE OR DELETE ON public.admin_logs
  FOR EACH ROW EXECUTE FUNCTION public.admin_logs_immutable();

-- ─── 12. The authorization chain ──────────────────────────────────────────
-- §5's chain, one function per link, with the decision made entirely from
-- auth.uid() and the Core's own tables. Nothing here reads a parameter that
-- says who the caller is, because §24 is right: application_id, role and
-- permissions arriving from a browser are claims, not facts.

-- 12.1 Which administrator records the caller holds.
--
-- Normally one. Two only if the same person was invited to administer two
-- properties, which §7 models as two records rather than one record with two
-- scopes. Returns nothing for a super_admin who is not also a delegated
-- administrator - being the owner of the install is not an administrator
-- record, and conflating the two is how a "super admin bypass" gets built by
-- accident.

CREATE OR REPLACE FUNCTION public.admin_current_contexts()
RETURNS TABLE (
  administrator_id UUID,
  application_slug TEXT,
  application_name TEXT,
  role_code        TEXT,
  role_status      TEXT,
  status           TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT a.id, a.application_slug, app.name, a.role_code, r.status, a.status
    FROM public.administrators a
    JOIN public.admin_applications app ON app.slug = a.application_slug
    JOIN public.admin_roles r          ON r.code   = a.role_code
   WHERE (SELECT auth.uid()) IS NOT NULL
     AND a.user_id = (SELECT auth.uid())
   ORDER BY a.application_slug;
$fn$;

-- 12.2 THE decision. Deny by default, expressed as a query that returns
-- nothing unless every link in the chain holds.
--
--     authenticated?      auth.uid() IS NOT NULL
--     administrator?      a row in public.administrators for that user
--     status?             that row is ACTIVE
--     application scope?  that row names THIS application, and it is active
--     role?               the role is 'active' - a latent role resolves to
--                         nothing at all, which is what makes
--                         TRANSPORT_OPERATIONS_ADMIN assignable and inert
--     permission?         the role maps it, or an explicit ALLOW grant does,
--                         and the permission itself is active
--     not explicitly denied?  no DENY grant for this administrator
--
-- STABLE and side-effect free, so it is safe inside an RLS policy and inside
-- another function's WHERE clause. The version that LOGS is admin_authorize(),
-- below - a predicate that wrote a row could not be used in a policy.
--
-- public.is_super_admin() short-circuits it. That is the install's owner, the
-- only global authority §6 allows, and it is a row in public.roles rather than
-- a delegated role anybody can be given: there is no SUPER_ADMIN in
-- admin_roles and the creation form cannot offer one.

CREATE OR REPLACE FUNCTION public.admin_has_permission(
  p_application TEXT,
  p_permission  TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND (
       public.is_super_admin()
       OR EXISTS (
            SELECT 1
              FROM public.administrators a
              JOIN public.admin_applications app ON app.slug = a.application_slug
              JOIN public.admin_roles r          ON r.code   = a.role_code
              JOIN public.admin_permissions p    ON p.code   = p_permission
             WHERE a.user_id = (SELECT auth.uid())
               AND a.status = 'ACTIVE'
               AND a.application_slug = p_application
               AND app.status = 'active'
               AND r.status = 'active'
               AND p.status = 'active'
               AND (
                     EXISTS (
                       SELECT 1 FROM public.admin_role_permissions rp
                        WHERE rp.role_code = a.role_code
                          AND rp.permission_code = p_permission
                     )
                     OR EXISTS (
                       SELECT 1 FROM public.administrator_permission_grants g
                        WHERE g.administrator_id = a.id
                          AND g.permission_code = p_permission
                          AND g.effect = 'ALLOW'
                     )
                   )
               AND NOT EXISTS (
                     SELECT 1 FROM public.administrator_permission_grants g
                      WHERE g.administrator_id = a.id
                        AND g.permission_code = p_permission
                        AND g.effect = 'DENY'
                   )
          )
     );
$fn$;

-- 12.3 Refusal, in the two shapes Postgres actually allows.
--
-- ─── The constraint that shapes this whole section ────────────────────────
-- PostgreSQL has no autonomous transactions. A function that INSERTs an audit
-- row and then RAISEs discards its own audit row: the raise aborts the
-- transaction (or, inside a plpgsql EXCEPTION block, the subtransaction), and
-- everything written within it goes with it.
--
-- The first cut of this file did exactly that - admin_authorize() logged the
-- denial and then raised - and it never recorded a single event. The
-- authorization suite caught it on its first real run against a database, at
-- section 13, which is what that suite is for. It is worth being explicit
-- about because the code READ as though it worked.
--
-- So a refusal can be recorded, or it can abort the request. Not both, in one
-- transaction. That is a property of the database, not a design choice, and
-- pretending otherwise is how an audit trail ends up with holes in it.
--
-- Hence two functions, and the caller picks by what it needs:
--
--   admin_check_access()  returns FALSE and RECORDS the denial. Use this
--                         wherever the event matters - which is most places.
--   admin_authorize()     RAISES 42501 -> HTTP 403, and records NOTHING.
--                         Use it where the request must die at the database
--                         and the caller will record the refusal itself.
--
-- (The third shape, admin_has_permission(), is STABLE, silent and safe inside
-- an RLS policy. A policy cannot write, so it was never a candidate here.)

-- ─── The recording one ────────────────────────────────────────────────────
-- Returns normally, so the event it writes commits with the caller's
-- transaction. The caller gets FALSE and decides what to do with it: return an
-- empty result, raise its own error, answer 403 from the application layer.
--
-- ─── The two refusals are not the same event ──────────────────────────────
-- ADMIN_CROSS_APP_ACCESS_ATTEMPT when the caller IS an active administrator -
-- of a DIFFERENT application. That is somebody with a valid session reaching
-- for a property they were not given, which is §25's case and is worth its own
-- name and its own severity. ADMIN_ACCESS_DENIED is everything else: a
-- permission the role does not carry, a suspended account, a disabled
-- application.
--
-- A GRANTED check records nothing. An audit trail of every successful
-- permission check would bury the refusals, which are the entries anybody
-- actually reads.

CREATE OR REPLACE FUNCTION public.admin_check_access(
  p_application TEXT,
  p_permission  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_cross_app BOOLEAN;
BEGIN
  IF public.admin_has_permission(p_application, p_permission) THEN
    RETURN TRUE;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.administrators a
     WHERE a.user_id = (SELECT auth.uid())
       AND a.status = 'ACTIVE'
       AND a.application_slug IS DISTINCT FROM p_application
  ) INTO v_cross_app;

  PERFORM public.admin_core_log_event(
    CASE WHEN v_cross_app
      THEN 'ADMIN_CROSS_APP_ACCESS_ATTEMPT'
      ELSE 'ADMIN_ACCESS_DENIED'
    END,
    'DENIED',
    p_application,
    NULL,
    jsonb_build_object('permission', p_permission),
    CASE WHEN v_cross_app THEN 'critical' ELSE 'warning' END
  );

  RETURN FALSE;
END;
$fn$;

-- ─── The refusing one ─────────────────────────────────────────────────────
-- Raises insufficient_privilege (42501), which PostgREST returns as HTTP 403 -
-- exactly what §8 specifies for GET /api/admin/frito/users by a TanCerca
-- administrator.
--
-- It deliberately does NOT call admin_check_access(), which would look tidy
-- and would be a lie: the raise below would roll that function's event back,
-- leaving code that reads as though it records and a trail that does not. If
-- the event matters at this call site, call admin_check_access() and raise
-- from the CALLER only after the transaction that wrote the event has
-- committed - which in this system means the admin-core edge function, where
-- each RPC is its own transaction and logEvent() is a separate call.

CREATE OR REPLACE FUNCTION public.admin_authorize(
  p_application TEXT,
  p_permission  TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF public.admin_has_permission(p_application, p_permission) THEN
    RETURN TRUE;
  END IF;

  RAISE EXCEPTION 'Not authorized: % on %', p_permission, p_application
    USING ERRCODE = 'insufficient_privilege';
END;
$fn$;

-- 12.4 The integration contract (§28).
--
-- The one call an application makes to learn who is in front of it: who is
-- this administrator, which application are they assigned to, what role do
-- they hold, what permissions does that resolve to, is the account active.
--
-- ─── Why an application should call this and not read the tables ──────────
-- Every rule in §12.2 - status, application scope, role latency, permission
-- status, per-administrator DENY - is applied here, once. An application that
-- joined the tables itself would be re-implementing that chain, and the first
-- time the two disagreed the more permissive one would win silently. §28 asks
-- for an explicit service boundary; this is it, and it is also the reason
-- nothing outside the Core needs SELECT on administrators at all.
--
-- Returns the caller's context for ONE application. A caller who administers
-- another property gets nothing here, whatever they administer elsewhere.

CREATE OR REPLACE FUNCTION public.admin_resolve_context(p_application TEXT)
RETURNS TABLE (
  administrator_id UUID,
  name             TEXT,
  email            TEXT,
  application_slug TEXT,
  application_name TEXT,
  role_code        TEXT,
  role_name        TEXT,
  role_status      TEXT,
  status           TEXT,
  is_active        BOOLEAN,
  permissions      TEXT[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT
    a.id,
    a.name,
    a.email,
    a.application_slug,
    app.name,
    a.role_code,
    r.name,
    r.status,
    a.status,
    (a.status = 'ACTIVE' AND app.status = 'active'),
    COALESCE(
      ARRAY(
        SELECT p.code
          FROM public.admin_permissions p
         WHERE p.status = 'active'
           AND public.admin_has_permission(a.application_slug, p.code)
         ORDER BY p.code
      ),
      ARRAY[]::TEXT[]
    )
  FROM public.administrators a
  JOIN public.admin_applications app ON app.slug = a.application_slug
  JOIN public.admin_roles r          ON r.code   = a.role_code
 WHERE (SELECT auth.uid()) IS NOT NULL
   AND a.user_id = (SELECT auth.uid())
   AND a.application_slug = p_application;
$fn$;

-- 12.5 The capability preview (§18), generated from the mapping.
--
-- Returns the WHOLE catalogue with a `granted` flag per permission, rather
-- than the granted subset, so the "Restricted" half of the preview is derived
-- from the same query as the "Allowed" half. §18 asks that the preview come
-- from the role's actual permissions instead of a list maintained in a React
-- component; returning both halves is what stops the component from computing
-- the complement itself and drifting.
--
-- A LATENT role reports `granted = false` for everything, including the
-- permissions it is mapped to, because that is what it resolves to today. The
-- mapping is still visible through `mapped`, so the preview can say "reserved
-- for a module that is not available yet" rather than "this role does
-- nothing" - two different sentences that a single boolean could not tell
-- apart.
--
-- Readable by any authenticated caller: it describes a role, not a person, and
-- the panel shows it while a Super Admin is still deciding which role to give.

CREATE OR REPLACE FUNCTION public.admin_role_capabilities(p_role_code TEXT)
RETURNS TABLE (
  permission_code TEXT,
  name            TEXT,
  description     TEXT,
  resource        TEXT,
  action          TEXT,
  risk_level      TEXT,
  mapped          BOOLEAN,
  granted         BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT
    p.code,
    p.name,
    p.description,
    p.resource,
    p.action,
    p.risk_level,
    EXISTS (
      SELECT 1 FROM public.admin_role_permissions rp
       WHERE rp.role_code = p_role_code AND rp.permission_code = p.code
    ),
    EXISTS (
      SELECT 1
        FROM public.admin_role_permissions rp
        JOIN public.admin_roles r ON r.code = rp.role_code
       WHERE rp.role_code = p_role_code
         AND rp.permission_code = p.code
         AND r.status = 'active'
    )
  FROM public.admin_permissions p
 WHERE p.status = 'active'
   AND (SELECT auth.uid()) IS NOT NULL
 ORDER BY p.resource, p.action;
$fn$;

-- 12.6 The management read (§19).
--
-- Gated on is_super_admin() rather than filtered by it: a delegated
-- administrator asking for the administrator list is refused, not handed an
-- empty table. §21 makes this module Super-Admin-only, and a refusal says so
-- while an empty list implies there is simply nobody there.
--
-- Salary comes back on the same row as the person because §19's table has a
-- Salary column. It is the ACTIVE compensation row; the history is in
-- administrator_compensation and is not summarised here.

CREATE OR REPLACE FUNCTION public.admin_list_administrators(p_application TEXT DEFAULT NULL)
RETURNS TABLE (
  id                UUID,
  user_id           UUID,
  name              TEXT,
  email             TEXT,
  phone             TEXT,
  application_slug  TEXT,
  application_name  TEXT,
  role_code         TEXT,
  role_name         TEXT,
  role_status       TEXT,
  status            TEXT,
  status_reason     TEXT,
  salary_amount     NUMERIC,
  salary_currency   TEXT,
  last_access_at    TIMESTAMPTZ,
  created_at        TIMESTAMPTZ,
  invitation_status TEXT,
  invitation_expires_at TIMESTAMPTZ
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Only the Super Admin may list administrators'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  SELECT
    a.id, a.user_id, a.name, a.email, a.phone,
    a.application_slug, app.name,
    a.role_code, r.name, r.status,
    a.status, a.status_reason,
    c.salary_amount, c.currency,
    a.last_access_at, a.created_at,
    i.status, i.expires_at
  FROM public.administrators a
  JOIN public.admin_applications app ON app.slug = a.application_slug
  JOIN public.admin_roles r          ON r.code   = a.role_code
  LEFT JOIN public.administrator_compensation c
         ON c.administrator_id = a.id AND c.status = 'active'
  LEFT JOIN LATERAL (
    SELECT inv.status, inv.expires_at
      FROM public.admin_invitations inv
     WHERE inv.administrator_id = a.id
     ORDER BY inv.created_at DESC
     LIMIT 1
  ) i ON TRUE
 WHERE p_application IS NULL OR a.application_slug = p_application
 ORDER BY app.name, a.name;
END;
$fn$;

-- 12.7 Last access, stamped by the panel once per session.
--
-- Writes only the caller's OWN rows - the WHERE clause is auth.uid(), not a
-- parameter - so it cannot be used to backdate somebody else's activity, and
-- there is nothing to authorize beyond being signed in.

CREATE OR REPLACE FUNCTION public.admin_touch_last_access()
RETURNS VOID
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  UPDATE public.administrators
     SET last_access_at = now()
   WHERE user_id = (SELECT auth.uid())
     AND (SELECT auth.uid()) IS NOT NULL
     AND status = 'ACTIVE';
$fn$;

-- 12.8 The invitation state machine, in the database rather than in Deno.
--
-- ─── Why this is not in the edge function ─────────────────────────────────
-- It was, in the first cut. Moving it here buys two things worth the extra
-- surface: the one-time guarantee becomes a single atomic statement that
-- Postgres enforces rather than an application-level read-then-write, and the
-- whole state machine becomes executable by a test — supabase/tests/
-- admin_core_authorization.sql runs every branch of it. Logic that lives only
-- in an edge function can be reasoned about but not exercised, and "the
-- invitation is single-use" is not a claim to leave unexercised.
--
-- Both functions are service_role only. They are reachable from the admin-core
-- edge function and from nowhere else: there is no session for an invitee to
-- hold, so there is nobody for a policy to serve and no reason for PostgREST
-- to expose them.

-- Why an invitation cannot be used. One word, so the caller can record the
-- real reason in a security event while telling the visitor the same generic
-- sentence for all of them (§15 — an acceptance endpoint that distinguished
-- "expired" from "never existed" would be an oracle for which tokens exist).
CREATE OR REPLACE FUNCTION public.admin_invitation_state(p_token_hash TEXT)
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT CASE
    WHEN i.id IS NULL                            THEN 'unknown'
    WHEN i.status = 'revoked'                    THEN 'revoked'
    WHEN i.status = 'accepted'                   THEN 'used'
    WHEN i.expires_at <= now()                   THEN 'expired'
    WHEN a.status IN ('SUSPENDED', 'REVOKED')    THEN 'blocked'
    WHEN app.status <> 'active'                  THEN 'blocked'
    ELSE 'valid'
  END
  FROM (SELECT 1) probe
  LEFT JOIN public.admin_invitations i     ON i.token_hash = p_token_hash
  LEFT JOIN public.administrators a        ON a.id = i.administrator_id
  LEFT JOIN public.admin_applications app  ON app.slug = a.application_slug;
$fn$;

-- 12.9 Spend the invitation, once.
--
-- ─── The whole one-time guarantee is the WHERE clause ─────────────────────
-- A single UPDATE ... WHERE status = 'pending' AND expires_at > now()
-- RETURNING. Two concurrent acceptances of the same link both reach this
-- statement; Postgres serialises them on the row, the first flips it to
-- 'accepted', and the second matches nothing and returns no rows. There is no
-- window between a check and a write for the second one to slip through,
-- because there is no check — the condition IS the write.
--
-- The administrator's own status is in the same WHERE clause, so a link that
-- was valid when it was sent stops working the moment that person is
-- suspended or revoked (§20).
--
-- Returns the details the caller needs to create the account, so the edge
-- function does not have to read the row again after spending it.
CREATE OR REPLACE FUNCTION public.admin_claim_invitation(p_token_hash TEXT)
RETURNS TABLE (
  invitation_id    UUID,
  administrator_id UUID,
  email            TEXT,
  name             TEXT,
  application_slug TEXT,
  role_code        TEXT
)
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH claimed AS (
    UPDATE public.admin_invitations i
       SET status = 'accepted', used_at = now()
     WHERE i.token_hash = p_token_hash
       AND i.status = 'pending'
       AND i.expires_at > now()
       AND EXISTS (
             SELECT 1
               FROM public.administrators a
               JOIN public.admin_applications app ON app.slug = a.application_slug
              WHERE a.id = i.administrator_id
                AND a.status IN ('PENDING', 'ACTIVE')
                AND app.status = 'active'
           )
    RETURNING i.id, i.administrator_id
  )
  SELECT c.id, a.id, a.email, a.name, a.application_slug, a.role_code
    FROM claimed c
    JOIN public.administrators a ON a.id = c.administrator_id;
$fn$;

-- 12.10 Turn a claimed invitation into a working administrator.
--
-- Separate from the claim because the account does not exist yet at claim
-- time: the edge function spends the token, asks GoTrue for an account, and
-- comes back here with its id. Keeping the two apart is also what lets the
-- claim be a single statement.
--
-- Refuses to activate somebody who has been suspended or revoked in the
-- meantime, which is a real race: a Super Admin revoking access while the
-- invitee is mid-acceptance must win.
CREATE OR REPLACE FUNCTION public.admin_activate_administrator(
  p_administrator_id UUID,
  p_user_id          UUID
)
RETURNS BOOLEAN
LANGUAGE sql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH activated AS (
    UPDATE public.administrators
       SET user_id = p_user_id, status = 'ACTIVE', status_reason = NULL
     WHERE id = p_administrator_id
       AND status IN ('PENDING', 'ACTIVE')
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM activated);
$fn$;

-- 12.11 Issue an invitation: revoke the live one and mint the new one, atomically.
--
-- ─── Why this is one statement block and not two round trips ──────────────
-- The edge function used to do these as two calls. That was correct in its
-- ordering and wrong in its atomicity: between the revoke and the insert there
-- is a window in which the administrator has NO live invitation at all, and a
-- crash or a timeout inside it leaves them stranded — the old link dead, the
-- new one never minted, and nothing in the trail saying so.
--
-- Here the two are one transaction. Either the resend happened or it did not.
--
-- The ORDER within it is still load-bearing and is the reason the two cannot
-- simply be run concurrently: admin_invitations_pending_unique is a partial
-- unique index over pending rows, so inserting before revoking raises a unique
-- violation against the row being replaced. Revoking first is also what makes
-- "resend" mean "the old link is dead" rather than "here is a second working
-- link".
--
-- Returns how many invitations were superseded, so the security event can say
-- whether this was a first issue or a replacement without a second read.

CREATE OR REPLACE FUNCTION public.admin_issue_invitation(
  p_administrator_id UUID,
  p_token_hash       TEXT,
  p_expires_at       TIMESTAMPTZ,
  p_actor            UUID
)
RETURNS TABLE (invitation_id UUID, superseded INTEGER)
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_superseded INTEGER;
  v_id         UUID;
BEGIN
  UPDATE public.admin_invitations
     SET status = 'revoked', revoked_at = now()
   WHERE administrator_id = p_administrator_id
     AND status = 'pending';
  GET DIAGNOSTICS v_superseded = ROW_COUNT;

  INSERT INTO public.admin_invitations (administrator_id, token_hash, expires_at, created_by)
  VALUES (p_administrator_id, p_token_hash, p_expires_at, p_actor)
  RETURNING id INTO v_id;

  RETURN QUERY SELECT v_id, v_superseded;
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_invitation_state(TEXT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_claim_invitation(TEXT)             FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_activate_administrator(UUID, UUID) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.admin_issue_invitation(UUID, TEXT, TIMESTAMPTZ, UUID)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_invitation_state(TEXT)             TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_claim_invitation(TEXT)             TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_activate_administrator(UUID, UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_issue_invitation(UUID, TEXT, TIMESTAMPTZ, UUID)
  TO service_role;

-- ─── 13. Compensation cannot be self-served ───────────────────────────────
-- §14: an administrator must not be able to modify their own compensation.
-- RLS below already makes the whole table Super-Admin-only, so this trigger is
-- defence in depth against a future policy that widens it - the kind of change
-- that looks harmless in isolation and turns salary into a self-service field.
--
-- It refuses a write whose subject is the writer, unless the writer is the
-- install's super_admin. Reads are untouched: seeing your own salary is not
-- the same act as setting it.

CREATE OR REPLACE FUNCTION public.administrator_compensation_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_subject UUID;
BEGIN
  SELECT a.user_id INTO v_subject
    FROM public.administrators a
   WHERE a.id = NEW.administrator_id;

  IF v_subject IS NOT NULL
     AND v_subject = (SELECT auth.uid())
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'An administrator cannot set their own compensation'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_administrator_compensation_guard ON public.administrator_compensation;
CREATE TRIGGER trg_administrator_compensation_guard
  BEFORE INSERT OR UPDATE ON public.administrator_compensation
  FOR EACH ROW EXECUTE FUNCTION public.administrator_compensation_guard();

-- ─── 14. Row level security ───────────────────────────────────────────────
-- The shape throughout: the Super Admin holds the table, an administrator
-- holds their OWN row and nothing else, anon holds nothing anywhere.
--
-- ─── Why the catalogue is not public ──────────────────────────────────────
-- admin_roles / admin_permissions / admin_role_permissions are Super-Admin
-- only. They are not secret exactly, but they are the map of what this system
-- can do, and nothing outside the Core needs to read them directly:
-- admin_role_capabilities() and admin_has_permission() are SECURITY DEFINER
-- and answer every legitimate question about them.

ALTER TABLE public.admin_applications              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_roles                     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_permissions               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_role_permissions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrators                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrator_permission_grants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.administrator_compensation      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invitations               ENABLE ROW LEVEL SECURITY;

-- The registry is readable by any signed-in caller: an administrator's own
-- context names their application, and a screen has to be able to render its
-- name. It carries nothing sensitive.
DROP POLICY IF EXISTS admin_applications_read ON public.admin_applications;
CREATE POLICY admin_applications_read ON public.admin_applications
  FOR SELECT TO authenticated
  USING (status = 'active' OR public.is_super_admin());

DROP POLICY IF EXISTS admin_applications_super_admin_all ON public.admin_applications;
CREATE POLICY admin_applications_super_admin_all ON public.admin_applications
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS admin_roles_super_admin_all ON public.admin_roles;
CREATE POLICY admin_roles_super_admin_all ON public.admin_roles
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS admin_permissions_super_admin_all ON public.admin_permissions;
CREATE POLICY admin_permissions_super_admin_all ON public.admin_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS admin_role_permissions_super_admin_all ON public.admin_role_permissions;
CREATE POLICY admin_role_permissions_super_admin_all ON public.admin_role_permissions
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- FOR SELECT, and only one's own row. An administrator may read the record
-- that describes them; they may not list their colleagues, and they may not
-- write. §21 lists every one of the writes this refuses.
DROP POLICY IF EXISTS administrators_self_read ON public.administrators;
CREATE POLICY administrators_self_read ON public.administrators
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS administrators_super_admin_all ON public.administrators;
CREATE POLICY administrators_super_admin_all ON public.administrators
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS administrator_permission_grants_super_admin_all ON public.administrator_permission_grants;
CREATE POLICY administrator_permission_grants_super_admin_all ON public.administrator_permission_grants
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Reading one's own salary is allowed; writing it is not, at any level. See
-- the guard trigger above for the second lock on the same door.
DROP POLICY IF EXISTS administrator_compensation_self_read ON public.administrator_compensation;
CREATE POLICY administrator_compensation_self_read ON public.administrator_compensation
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.administrators a
       WHERE a.id = administrator_compensation.administrator_id
         AND a.user_id = (SELECT auth.uid())
    )
  );

DROP POLICY IF EXISTS administrator_compensation_super_admin_all ON public.administrator_compensation;
CREATE POLICY administrator_compensation_super_admin_all ON public.administrator_compensation
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- No self-read at all. A pending administrator has no session yet, so there is
-- nobody for a self policy to serve, and the row holds a credential hash.
DROP POLICY IF EXISTS admin_invitations_super_admin_all ON public.admin_invitations;
CREATE POLICY admin_invitations_super_admin_all ON public.admin_invitations
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- ─── 15. Grants ───────────────────────────────────────────────────────────
-- anon gets nothing. The public website holds the anon key and has no business
-- knowing this schema exists.
--
-- The invitation ACCEPTANCE path is unauthenticated by nature - the recipient
-- has no account yet - and it is deliberately NOT reachable through PostgREST
-- for that reason. It runs in the admin-core edge function under service_role,
-- which bypasses RLS and is never shipped to a browser.

REVOKE ALL ON TABLE public.admin_applications              FROM anon;
REVOKE ALL ON TABLE public.admin_roles                     FROM anon;
REVOKE ALL ON TABLE public.admin_permissions               FROM anon;
REVOKE ALL ON TABLE public.admin_role_permissions          FROM anon;
REVOKE ALL ON TABLE public.administrators                  FROM anon;
REVOKE ALL ON TABLE public.administrator_permission_grants FROM anon;
REVOKE ALL ON TABLE public.administrator_compensation      FROM anon;
REVOKE ALL ON TABLE public.admin_invitations               FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_applications              TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_roles                     TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_permissions               TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_role_permissions          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.administrators                  TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.administrator_permission_grants TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.administrator_compensation      TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.admin_invitations               TO authenticated;

REVOKE ALL ON FUNCTION public.admin_current_contexts()                FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_has_permission(TEXT, TEXT)        FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_authorize(TEXT, TEXT)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_check_access(TEXT, TEXT)          FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_resolve_context(TEXT)             FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_role_capabilities(TEXT)           FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_list_administrators(TEXT)         FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.admin_touch_last_access()               FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.admin_current_contexts()             TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_has_permission(TEXT, TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_authorize(TEXT, TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_check_access(TEXT, TEXT)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_resolve_context(TEXT)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_role_capabilities(TEXT)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_administrators(TEXT)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_touch_last_access()            TO authenticated;

-- ─── 16. Apply-time assertions ────────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- Core behind. The fourth one is the important one: it is §21 stated as
-- something the database refuses to be without.
--
-- None of these calls a function gated on insufficient_privilege. The Studio
-- SQL editor has no JWT, so auth.uid() is NULL and every "may this person..."
-- predicate is correctly FALSE; an assertion that called one would fail on
-- apply for a reason that has nothing to do with the schema. Where a gated
-- rule needs proving, the assertion queries the tables the rule reads instead.

DO $do$
DECLARE
  v_bad     TEXT;
  v_count   INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- 16.1 RLS is on everywhere.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN (
       'admin_applications', 'admin_roles', 'admin_permissions',
       'admin_role_permissions', 'administrators',
       'administrator_permission_grants', 'administrator_compensation',
       'admin_invitations')
     AND NOT c.relrowsecurity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] RLS is not enabled on: %', v_bad;
  END IF;

  -- 16.2 Nothing in the Core is reachable with the website's anonymous key.
  IF has_table_privilege('anon', 'public.administrators', 'SELECT')
     OR has_table_privilege('anon', 'public.admin_invitations', 'SELECT')
     OR has_table_privilege('anon', 'public.administrator_compensation', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon can read a Core table';
  END IF;

  IF has_function_privilege('anon', 'public.admin_has_permission(text,text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_resolve_context(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_core_log_event(text,text,text,uuid,jsonb,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] a Core function is EXECUTE-able by anon';
  END IF;

  -- The event writer is not reachable from a browser session either: every
  -- event is written by a SECURITY DEFINER function or by the edge function.
  IF has_function_privilege('authenticated',
       'public.admin_core_log_event(text,text,text,uuid,jsonb,text,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] admin_core_log_event is callable by an ordinary session';
  END IF;

  -- Nor is the invitation machinery. Spending somebody else's invitation, or
  -- activating an administrator, must not be one PostgREST call away from any
  -- signed-in account.
  IF has_function_privilege('authenticated', 'public.admin_claim_invitation(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_invitation_state(text)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_activate_administrator(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.admin_issue_invitation(uuid,text,timestamptz,uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.admin_claim_invitation(text)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] the invitation machinery is reachable outside service_role';
  END IF;

  -- 16.3 The five canonical roles, and only those (§3).
  SELECT string_agg(code, ', ' ORDER BY code) INTO v_bad
    FROM public.admin_roles
   WHERE code NOT IN ('APP_ADMIN', 'CONTENT_ADMIN', 'FINANCE_ADMIN',
                      'OPERATIONS_ADMIN', 'TRANSPORT_OPERATIONS_ADMIN');
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] admin_roles holds a non-canonical role: %. §3 fixes the set for this implementation.', v_bad;
  END IF;

  SELECT count(*) INTO v_count FROM public.admin_roles;
  IF v_count <> 5 THEN
    RAISE EXCEPTION '[fail] expected 5 canonical roles, found %', v_count;
  END IF;

  -- There is no delegated SUPER_ADMIN, and there must never be one (§6).
  IF EXISTS (SELECT 1 FROM public.admin_roles WHERE code LIKE '%SUPER%') THEN
    RAISE EXCEPTION '[fail] a SUPER_ADMIN-like delegated role exists. The Super Admin is a public.roles row, not something the creation form can hand out.';
  END IF;

  -- 16.4 The transport role exists, is latent, and its mapping is ready (§27).
  IF NOT EXISTS (
    SELECT 1 FROM public.admin_roles
     WHERE code = 'TRANSPORT_OPERATIONS_ADMIN'
       AND status = 'latent'
       AND module = 'TRANSPORT_OPERATIONS'
  ) THEN
    RAISE EXCEPTION '[fail] TRANSPORT_OPERATIONS_ADMIN must exist as a LATENT role in module TRANSPORT_OPERATIONS';
  END IF;

  SELECT count(*) INTO v_count
    FROM public.admin_role_permissions
   WHERE role_code = 'TRANSPORT_OPERATIONS_ADMIN';
  IF v_count = 0 THEN
    RAISE EXCEPTION '[fail] the transport role has no permission mapping. Latency is a role STATUS, not a missing mapping - the mapping is what makes enabling the module a one-row update.';
  END IF;

  RAISE NOTICE '[ok] roles: 5 canonical, TRANSPORT_OPERATIONS_ADMIN latent with % mapped permissions', v_count;
END;
$do$;

DO $do$
DECLARE
  v_bad     TEXT;
  v_count   INTEGER;
  v_allowed BOOLEAN;
BEGIN
  -- 16.5 §21, as a thing the database refuses to be without.
  --
  -- No delegated role may hold administrator management, economic
  -- configuration, pricing, salary, anti-fraud, global settings, role or
  -- permission management, or application scope. If somebody maps one of
  -- these, this migration stops applying - which is a conversation rather
  -- than a silent privilege escalation.
  SELECT string_agg(rp.role_code || ' -> ' || rp.permission_code, ', ' ORDER BY rp.role_code)
    INTO v_bad
    FROM public.admin_role_permissions rp
   WHERE rp.permission_code IN (
     'ADMIN_VIEW', 'ADMIN_CREATE', 'ADMIN_UPDATE', 'ADMIN_SUSPEND', 'ADMIN_REVOKE',
     'SALARY_MANAGE', 'PRICING_MANAGE', 'MEMBERSHIP_PRICING_MANAGE',
     'TANCOINS_MANAGE', 'FRITOS_MANAGE', 'ECONOMY_MANAGE', 'ANTIFRAUD_MANAGE',
     'GLOBAL_SETTINGS_MANAGE', 'ROLE_MANAGE', 'PERMISSION_MANAGE',
     'APPLICATION_SCOPE_MANAGE'
   );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] a delegated role holds a reserved permission: %. §21 reserves administrator management and global economic configuration to the Super Admin.', v_bad;
  END IF;

  -- 16.6 Every ACTIVE role can at least open its application. A role with no
  -- permissions at all is not deny-by-default, it is a person who accepted an
  -- invitation and landed nowhere.
  SELECT string_agg(r.code, ', ' ORDER BY r.code) INTO v_bad
    FROM public.admin_roles r
   WHERE r.status = 'active'
     AND NOT EXISTS (
       SELECT 1 FROM public.admin_role_permissions rp
        WHERE rp.role_code = r.code AND rp.permission_code = 'APP_DASHBOARD_VIEW'
     );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] active role(s) without APP_DASHBOARD_VIEW: %', v_bad;
  END IF;

  -- 16.7 Deny by default, executed rather than asserted.
  --
  -- The Studio session has no JWT, so auth.uid() is NULL: this is the
  -- anonymous case, and the correct answer to every question is FALSE. A
  -- version of admin_has_permission() that failed open - a missing auth.uid()
  -- check, a COALESCE in the wrong place - is caught here, on apply.
  SELECT public.admin_has_permission('tancerca', 'APP_DASHBOARD_VIEW') INTO v_allowed;
  IF v_allowed IS NOT FALSE THEN
    RAISE EXCEPTION '[fail] admin_has_permission() answered % for a caller with no identity. It must be FALSE.', v_allowed;
  END IF;

  SELECT public.admin_has_permission('unchained-business', 'ADMIN_CREATE') INTO v_allowed;
  IF v_allowed IS NOT FALSE THEN
    RAISE EXCEPTION '[fail] admin_has_permission() granted ADMIN_CREATE to a caller with no identity';
  END IF;

  -- An unknown permission code and an unknown application are both simply
  -- FALSE - never an error, which would let a caller probe for what exists.
  SELECT public.admin_has_permission('no-such-app', 'NO_SUCH_PERMISSION') INTO v_allowed;
  IF v_allowed IS NOT FALSE THEN
    RAISE EXCEPTION '[fail] an unknown application/permission pair did not resolve to FALSE';
  END IF;

  -- 16.8 The isolation invariant of 20260905000001 §9.2 is still intact.
  -- admin_applications is the Core's registry; platform_products is this
  -- database's membership seam and must still name exactly one product.
  IF EXISTS (SELECT 1 FROM public.platform_products WHERE id <> 'unchained') THEN
    RAISE EXCEPTION '[fail] platform_products holds a product other than unchained. The Core registers applications in admin_applications; it must never add a row here.';
  END IF;

  SELECT count(*) INTO v_count FROM public.admin_applications;
  IF v_count < 2 THEN
    RAISE EXCEPTION '[fail] the application registry is empty or incomplete (% rows)', v_count;
  END IF;

  -- 16.9 The audit trail is physically append-only.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.admin_logs'::regclass
       AND tgname = 'trg_admin_logs_immutable'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '[fail] admin_logs has no immutability trigger';
  END IF;

  -- 16.10 Compensation cannot be written by its own subject.
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgrelid = 'public.administrator_compensation'::regclass
       AND tgname = 'trg_administrator_compensation_guard'
       AND NOT tgisinternal
  ) THEN
    RAISE EXCEPTION '[fail] administrator_compensation has no self-service guard';
  END IF;

  RAISE NOTICE '[ok] Unchained Administration Core applied: % applications, 5 roles, % permissions, deny-by-default verified',
    (SELECT count(*) FROM public.admin_applications),
    (SELECT count(*) FROM public.admin_permissions);
END;
$do$;

NOTIFY pgrst, 'reload schema';

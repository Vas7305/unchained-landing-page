-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PORTED FILE — the reasoning below predates this database                │
-- └────────────────────────────────────────────────────────────────────────┘
-- Copied unchanged (this banner aside) from TanCerca's
--   supabase/migrations/20260901000001_unchained_commercial.sql
-- on 2026-09-05, when Unchained Business moved into its own Supabase project.
-- Only the filename changed, so that this directory applies in dependency order
-- behind 20260905000001_unchained_foundation.sql.
--
-- Nothing in the body was rewritten, on purpose. These migrations carry their
-- own apply-time assertions — including, in the leads file, a probe that
-- creates a lead, walks it through the funnel and rolls back — and those
-- assertions are the acceptance test for the port. Editing the file would mean
-- the thing being verified is no longer the thing that was running in
-- production.
--
-- The commentary therefore still describes the shared install it was written
-- for, and names TanCerca in several places. Read those passages as history:
-- they are the argument that produced each policy, and three of the
-- constraints they cite ("the roles CHECK cannot be widened", "one person
-- holds exactly one role") no longer hold here. See the Deviations table in
-- 20260905000001_unchained_foundation.sql.
--
-- Everything this file borrows is supplied by that foundation migration:
--   public.is_super_admin()    public.roles
--   public.platform_products   public.product_memberships
--
-- docs/database-isolation.md has the cutover runbook.

-- ════════════════════════════════════════════════════════════
-- Phase 4 — Unchained Business commercial infrastructure
-- ════════════════════════════════════════════════════════════
-- Creates the four tables behind Unchained Business > Commercial:
--
--     commercial_regions            one row per country the business serves
--     commercial_contacts           the representatives themselves
--     commercial_contact_regions    which representative covers which country
--     routing_rules                 priority overrides, optionally per language
--
-- The resolver that reads them ships separately, in
-- 20260901000002_resolve_commercial_contact.sql, so the security-relevant
-- function can be reviewed on its own.
--
-- ─── Scope: purely additive ───────────────────────────────────────────────
-- Every statement is a CREATE. There is no DROP, ALTER, UPDATE, DELETE or
-- TRUNCATE, no change to any existing table, function, policy or role, and no
-- seed data of any kind. Nothing TanCerca owns is referenced except
-- public.is_super_admin(), which is only CALLED, never redefined.
--
-- ─── Authorization: is_super_admin(), deliberately ────────────────────────
-- These tables gate on public.is_super_admin() rather than on a new
-- Unchained-specific predicate. That is not laziness, it is the only correct
-- answer available today, and Phase 3A established why:
--
--   roles_role_check  CHECK (role IN ('user','super_admin'))
--   roles_user_unique UNIQUE (user_id)
--
-- 'unchained_admin' cannot be inserted, and one person holds exactly one role,
-- so granting a second product role would REPLACE someone's super_admin. The
-- admin panel's product registry (admin-panel/src/platform/products.ts) already
-- reflects this: super_admin is the only role that reaches /unchained today.
--
-- Introducing a separate DB-level admin predicate here would create a THIRD
-- authorization system in a database that already has two that disagree
-- (public.is_super_admin() vs public.is_admin() — see
-- supabase/PRODUCTION_VERIFICATION_2026-08-31.md §4). Phase 4 does not widen
-- the roles CHECK, because that ALTER would change who can do what in TanCerca
-- and re-open the .maybeSingle() hazard in four call sites. When
-- 'unchained_admin' becomes real, these five policies are the only place that
-- needs to learn about it.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- supabase_migrations.schema_migrations does not exist in this project (see
-- supabase/BASELINE_MIGRATION_HISTORY.md). `supabase db push` would replay all
-- 143 historical migrations against live production. Until baselining is done,
-- apply this file by pasting it into the Studio SQL editor, which is how the
-- rest of this database was built. It is written to be re-runnable: every
-- object uses IF NOT EXISTS or CREATE OR REPLACE.

-- ─── 1. updated_at trigger ────────────────────────────────────────────────
-- Own function rather than the repo's unqualified set_updated_at(): that one
-- is SECURITY INVOKER with no pinned search_path, and this phase does not add
-- to the 106-function backlog recorded in the Phase 3A verification. Scoped
-- name so it cannot collide with, or be collided with by, anything TanCerca
-- owns. Mirrors the mobility_touch_updated_at() precedent.

CREATE OR REPLACE FUNCTION public.commercial_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

-- ─── 2. Language-array validation helper ──────────────────────────────────
-- A CHECK constraint may not contain a subquery, so the per-element test lives
-- in an IMMUTABLE function the CHECK can call. Empty array passes (a contact
-- who speaks nothing in particular is eligible for every non-language-matched
-- route); NULL fails, so the column is genuinely never null.

CREATE OR REPLACE FUNCTION public.commercial_languages_valid(p_langs TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $$
  SELECT p_langs IS NOT NULL
     AND (SELECT COALESCE(bool_and(l ~ '^[a-z]{2,3}$'), TRUE) FROM unnest(p_langs) AS l);
$$;

-- ─── 3. commercial_regions ────────────────────────────────────────────────
-- One row per country. Countries are added deliberately by an administrator;
-- this migration inserts none. `region_name` is an optional grouping label
-- ("CIS", "Southern Europe") and carries no routing meaning — routing matches
-- on country_code alone, so a region can be renamed without moving a lead.

CREATE TABLE IF NOT EXISTS public.commercial_regions (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country_code  TEXT NOT NULL,
  country_name  TEXT NOT NULL,
  region_name   TEXT,
  active        BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ISO 3166-1 alpha-2, upper case. Stored canonically so the resolver can
  -- match on an exact upper(...) comparison instead of a case-insensitive one.
  CONSTRAINT commercial_regions_country_code_format
    CHECK (country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT commercial_regions_country_name_present
    CHECK (length(btrim(country_name)) > 0),
  -- §35: one row per country. Two rows for RU would make "which commercial
  -- serves Russia" ambiguous before routing ever ran.
  CONSTRAINT commercial_regions_country_code_unique
    UNIQUE (country_code)
);

-- ─── 4. commercial_contacts ───────────────────────────────────────────────
-- The representatives. Deactivated, never deleted: routing_rules and
-- commercial_contact_regions cascade on delete, and a future leads table will
-- want to say which commercial owned an inquiry two years ago. `active = false`
-- removes someone from routing immediately and keeps that history intact.
--
-- Channel columns are all nullable and all constrained. A channel is either
-- absent or valid — there is no third state where a malformed number sits in
-- the column waiting to produce a dead link on the public site.

CREATE TABLE IF NOT EXISTS public.commercial_contacts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name               TEXT NOT NULL,
  role               TEXT,
  email              TEXT,
  whatsapp_number    TEXT,
  telegram_username  TEXT,
  calcom_url         TEXT,
  avatar_url         TEXT,
  languages          TEXT[] NOT NULL DEFAULT '{}',
  timezone           TEXT,
  notes              TEXT,
  active             BOOLEAN NOT NULL DEFAULT TRUE,
  priority           INTEGER NOT NULL DEFAULT 100,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT commercial_contacts_name_present
    CHECK (length(btrim(name)) > 0),

  -- Deliberately permissive on the local part and domain: the goal is to
  -- reject "not an address at all", not to relitigate RFC 5322.
  CONSTRAINT commercial_contacts_email_format
    CHECK (email IS NULL OR email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'),

  -- E.164 and nothing else: leading '+', a non-zero country digit, 7 to 15
  -- digits total. This is the constraint that makes §9 true at the database
  -- level — an invalid number cannot be silently saved even by a caller that
  -- skips the form.
  CONSTRAINT commercial_contacts_whatsapp_e164
    CHECK (whatsapp_number IS NULL OR whatsapp_number ~ '^\+[1-9][0-9]{6,14}$'),

  -- Telegram's own rule: 5-32 chars, letters/digits/underscore. Stored bare,
  -- with no '@' and no URL prefix, so link generation stays a display concern.
  CONSTRAINT commercial_contacts_telegram_format
    CHECK (telegram_username IS NULL OR telegram_username ~ '^[A-Za-z0-9_]{5,32}$'),

  -- A booking URL is stored whole and must at least be an absolute https URL.
  -- The host is not constrained to cal.com: a self-hosted Cal instance is a
  -- real deployment and rejecting it would be inventing a rule.
  CONSTRAINT commercial_contacts_calcom_url_format
    CHECK (calcom_url IS NULL OR calcom_url ~ '^https://[^[:space:]]+$'),
  CONSTRAINT commercial_contacts_avatar_url_format
    CHECK (avatar_url IS NULL OR avatar_url ~ '^https?://[^[:space:]]+$'),

  CONSTRAINT commercial_contacts_languages_valid
    CHECK (public.commercial_languages_valid(languages)),

  -- Lower wins. Bounded so a typo cannot produce a priority no other row can
  -- ever outrank, and so the admin UI can present a finite range.
  CONSTRAINT commercial_contacts_priority_range
    CHECK (priority BETWEEN 1 AND 1000)
);

-- ─── 5. commercial_contact_regions ────────────────────────────────────────
-- The assignment, and the ONLY source of routing eligibility.
--
-- Modelled as a table rather than a `country` column on commercial_contacts
-- because both directions are many: one commercial covers Russia, Belarus and
-- Kazakhstan, and Russia is covered by both Alexander and Maria. Neither is an
-- edge case — §13 requires the second one to work.
--
-- `priority` lives HERE, not on the contact, because rank is a property of the
-- pairing: the same person can be first choice for Belarus and second choice
-- for Russia. commercial_contacts.priority is the default a new assignment
-- starts from, not the value routing reads.

CREATE TABLE IF NOT EXISTS public.commercial_contact_regions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id  UUID NOT NULL REFERENCES public.commercial_contacts(id) ON DELETE CASCADE,
  region_id   UUID NOT NULL REFERENCES public.commercial_regions(id)  ON DELETE CASCADE,
  priority    INTEGER NOT NULL DEFAULT 100,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT commercial_contact_regions_priority_range
    CHECK (priority BETWEEN 1 AND 1000),
  -- §22: the same person cannot be assigned to the same country twice. Without
  -- this the resolver would rank one candidate against a duplicate of itself.
  CONSTRAINT commercial_contact_regions_unique
    UNIQUE (contact_id, region_id)
);

-- ─── 6. routing_rules ─────────────────────────────────────────────────────
-- Priority overrides. A rule NEVER grants eligibility and NEVER removes it —
-- eligibility comes only from an active contact holding an active assignment
-- to an active region. A rule only changes RANK, and only for the pairing it
-- names.
--
-- That containment is the whole point. If rules could also grant or revoke
-- eligibility, "who serves Russia" would have two answers that could disagree,
-- and deactivating a contact would no longer be sufficient to remove them from
-- routing — which §10 requires to be sufficient.
--
--   language IS NULL     the override applies whatever language is requested
--   language = 'ru'      the override applies only to a Russian-language request
--
-- Example: Maria is assigned to RU at priority 2 and outranked by Alexander.
-- A rule (RU, 'it', Maria, priority 1) makes her first choice for Italian
-- speakers in Russia without disturbing any other request.

CREATE TABLE IF NOT EXISTS public.routing_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id   UUID NOT NULL REFERENCES public.commercial_regions(id)  ON DELETE CASCADE,
  contact_id  UUID NOT NULL REFERENCES public.commercial_contacts(id) ON DELETE CASCADE,
  language    TEXT,
  priority    INTEGER NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT routing_rules_language_format
    CHECK (language IS NULL OR language ~ '^[a-z]{2,3}$'),
  CONSTRAINT routing_rules_priority_range
    CHECK (priority BETWEEN 1 AND 1000)
);

-- Uniqueness across a nullable column, spelled as two partial indexes rather
-- than UNIQUE NULLS NOT DISTINCT: the latter is PG15+, and this database's
-- version was not established from the development environment. These two are
-- correct on every version and say exactly the same thing.
CREATE UNIQUE INDEX IF NOT EXISTS routing_rules_unique_lang
  ON public.routing_rules (region_id, contact_id, language)
  WHERE language IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS routing_rules_unique_any_lang
  ON public.routing_rules (region_id, contact_id)
  WHERE language IS NULL;

-- ─── 7. Indexes ───────────────────────────────────────────────────────────
-- Chosen against the resolver's actual query plan (see migration 000002), not
-- against the column list.
--
-- The resolver's shape is: look up ONE region by country_code, fan out to its
-- assignments, join each to its contact by primary key, and consult
-- routing_rules for that (region, contact) pair.
--
--   · country_code       already covered by commercial_regions_country_code_unique.
--   · contact_id → PK    already covered by the primary key.
--   · region_id          the fan-out step, and the only unindexed access path
--                        in the hot query. Indexed with priority so the
--                        candidate set comes back pre-ordered.
--   · routing_rules      looked up by (region_id, contact_id); `active` is in
--                        the index so an inactive rule is skipped in the index
--                        rather than in a heap fetch.
--
-- Deliberately NOT added:
--   · GIN on commercial_contacts.languages. The language test runs against the
--     handful of rows already joined for one country, never as a search across
--     the table. A GIN index would be maintained on every write and read by
--     nothing.
--   · A standalone index on `active`. Two distinct values over a table that
--     will hold tens of rows; the planner would ignore it.
--
-- commercial_contacts (active, priority) is for the ADMIN list ordering, which
-- is the only query that scans the contact table, and is labelled as such so
-- nobody later reads it as part of the routing path.

CREATE INDEX IF NOT EXISTS idx_commercial_contact_regions_region
  ON public.commercial_contact_regions (region_id, priority);

CREATE INDEX IF NOT EXISTS idx_commercial_contact_regions_contact
  ON public.commercial_contact_regions (contact_id);

CREATE INDEX IF NOT EXISTS idx_routing_rules_lookup
  ON public.routing_rules (region_id, contact_id, active);

CREATE INDEX IF NOT EXISTS idx_commercial_contacts_admin_list
  ON public.commercial_contacts (active, priority, name);

-- ─── 8. updated_at triggers ───────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_commercial_regions_updated_at ON public.commercial_regions;
CREATE TRIGGER trg_commercial_regions_updated_at
  BEFORE UPDATE ON public.commercial_regions
  FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

DROP TRIGGER IF EXISTS trg_commercial_contacts_updated_at ON public.commercial_contacts;
CREATE TRIGGER trg_commercial_contacts_updated_at
  BEFORE UPDATE ON public.commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

DROP TRIGGER IF EXISTS trg_commercial_contact_regions_updated_at ON public.commercial_contact_regions;
CREATE TRIGGER trg_commercial_contact_regions_updated_at
  BEFORE UPDATE ON public.commercial_contact_regions
  FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

DROP TRIGGER IF EXISTS trg_routing_rules_updated_at ON public.routing_rules;
CREATE TRIGGER trg_routing_rules_updated_at
  BEFORE UPDATE ON public.routing_rules
  FOR EACH ROW EXECUTE FUNCTION public.commercial_touch_updated_at();

-- ─── 9. Row Level Security ────────────────────────────────────────────────
-- Enabled on all four tables. One FOR ALL policy each, gated on
-- is_super_admin(), with an explicit WITH CHECK so the predicate governs
-- writes as well as reads — a USING-only policy would let an admin INSERT a
-- row and not that same row's UPDATE target.
--
-- There is deliberately NO anon policy on any of these tables. The public
-- website never reads them; it calls resolve_commercial_contact(), which is
-- SECURITY DEFINER and therefore bypasses RLS to return exactly one row. That
-- is the entire public surface. See migration 000002.

ALTER TABLE public.commercial_regions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_contacts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_contact_regions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.routing_rules               ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS commercial_regions_admin_all ON public.commercial_regions;
CREATE POLICY commercial_regions_admin_all ON public.commercial_regions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS commercial_contacts_admin_all ON public.commercial_contacts;
CREATE POLICY commercial_contacts_admin_all ON public.commercial_contacts
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS commercial_contact_regions_admin_all ON public.commercial_contact_regions;
CREATE POLICY commercial_contact_regions_admin_all ON public.commercial_contact_regions
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

DROP POLICY IF EXISTS routing_rules_admin_all ON public.routing_rules;
CREATE POLICY routing_rules_admin_all ON public.routing_rules
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- ─── 10. Table privileges ─────────────────────────────────────────────────
-- Belt and braces on top of RLS. RLS with no matching policy already denies
-- anon, but that is one `CREATE POLICY ... TO public` away from being untrue,
-- and these tables hold the contact details of real people. Revoking the grant
-- means an accidental permissive policy still cannot be reached by an
-- anonymous caller — two independent things would have to go wrong.
--
-- authenticated keeps its grants because RLS is what gates it, and the admin
-- panel signs in as a normal authenticated user.

REVOKE ALL ON TABLE public.commercial_regions          FROM anon;
REVOKE ALL ON TABLE public.commercial_contacts         FROM anon;
REVOKE ALL ON TABLE public.commercial_contact_regions  FROM anon;
REVOKE ALL ON TABLE public.routing_rules               FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_regions         TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_contacts        TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.commercial_contact_regions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.routing_rules              TO authenticated;

-- ─── 11. Apply-time assertions ────────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- table behind. RLS being ENABLED is the one property that, if silently
-- missing, would expose every row to every signed-in TanCerca user.

DO $$
DECLARE
  v_table TEXT;
  v_rls   BOOLEAN;
  v_pol   INTEGER;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'commercial_regions',
    'commercial_contacts',
    'commercial_contact_regions',
    'routing_rules'
  ] LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class WHERE oid = ('public.' || v_table)::regclass;

    IF NOT v_rls THEN
      RAISE EXCEPTION '[fail] RLS is not enabled on public.%', v_table;
    END IF;

    SELECT count(*) INTO v_pol
      FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table;

    IF v_pol = 0 THEN
      RAISE EXCEPTION '[fail] public.% has RLS enabled but no policy — admins would be locked out', v_table;
    END IF;

    RAISE NOTICE '[ok] public.% — RLS enabled, % policy(ies)', v_table, v_pol;
  END LOOP;
END;
$$;

-- The language helper is called from a CHECK constraint, so a wrong answer
-- would be baked into every future write. Verified here rather than assumed.
DO $$
BEGIN
  IF NOT public.commercial_languages_valid(ARRAY[]::TEXT[]) THEN
    RAISE EXCEPTION '[fail] empty language array must be valid';
  END IF;
  IF NOT public.commercial_languages_valid(ARRAY['ru','en']) THEN
    RAISE EXCEPTION '[fail] lower-case ISO 639-1 codes must be valid';
  END IF;
  IF public.commercial_languages_valid(ARRAY['RU']) THEN
    RAISE EXCEPTION '[fail] upper-case language codes must be rejected';
  END IF;
  IF public.commercial_languages_valid(ARRAY['russian']) THEN
    RAISE EXCEPTION '[fail] language names must be rejected, only codes';
  END IF;
  IF public.commercial_languages_valid(NULL) THEN
    RAISE EXCEPTION '[fail] NULL language array must be rejected';
  END IF;
  RAISE NOTICE '[ok] commercial_languages_valid() behaves as the CHECK expects';
END;
$$;

-- §25/§26: this migration inserts no contact, no region and no assignment.
-- The tables are empty on purpose and the admin UI renders "No commercial
-- contacts configured." until a real person is added through it.

NOTIFY pgrst, 'reload schema';

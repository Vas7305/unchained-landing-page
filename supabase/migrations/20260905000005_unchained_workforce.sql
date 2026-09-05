-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PORTED FILE — the reasoning below predates this database                │
-- └────────────────────────────────────────────────────────────────────────┘
-- Copied unchanged (this banner aside) from TanCerca's
--   supabase/migrations/20260904000003_unchained_workforce.sql
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
-- Phase 8 — Unchained Business workforce: specialists, engagements, pay
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260901000001_unchained_commercial.sql   commercial_contacts + routing
--   20260902000001_product_memberships.sql    product-scoped authorization
--   20260903000001_unchained_leads.sql        leads, my_commercial_contact_id()
--
-- Answers the four questions Phase 7 left open once a lead is WON:
--
--   · who did the work                unchained_specialists
--   · what the client is paying       unchained_engagements.amount_cents
--   · who gets what share of it       commission_rate, snapshotted per engagement
--   · what does each person see       three RLS rules and one shaped RPC
--
-- Creates:
--     unchained_specialists              the delivery roster (NOT the routing one)
--     unchained_engagements              one paid piece of work for one client
--     unchained_engagement_specialists   who is working it, and at what rate
--     my_specialist_id()                 "which specialist am I", or NULL
--     unchained_my_workforce_profile()   what panel to render for the caller
--     unchained_my_engagements()         the caller's own work, role-shaped
--     unchained_my_earnings()            the caller's own money, aggregated
--     unchained_set_commission_rate()    the super-admin's one write on pay
--
-- ─── Scope ────────────────────────────────────────────────────────────────
-- Forward-only and additive (§65). The only statement touching anything an
-- earlier phase built is a single `ADD COLUMN IF NOT EXISTS commission_rate`
-- on public.commercial_contacts — NOT NULL DEFAULT 0, read by nothing that
-- existed before, and invisible to the public resolver, which selects eight
-- fixed columns and does not include it — plus one BEFORE INSERT OR UPDATE
-- trigger on that table, which fires only on that column and passes every
-- other write straight through (§8). No table is dropped, no policy is
-- replaced, no historical migration is edited.
--
-- ─── Why specialists are their OWN table (§40) ────────────────────────────
-- public.commercial_contacts is the ROUTING roster: every active row in it is
-- a candidate the public website can be shown by
-- resolve_commercial_contact(). A specialist is not a person a stranger should
-- be routed to — they deliver work that has already been sold — so putting
-- them in that table would mean the routing pool and the delivery roster share
-- a membership list, and the only thing standing between a backend engineer
-- and a cold inquiry from Havana would be a `member_type` filter remembered in
-- four places (the resolver, the two assignment tables, and three deployed RLS
-- policies). A separate table cannot be routed to by construction.
--
-- ─── Why the rate is snapshotted (§15, and Phase 7's precedent) ───────────
-- commercial_contacts.commission_rate and unchained_specialists.commission_rate
-- are DEFAULTS — what this person is normally paid. The number that decides
-- what is owed for one piece of work is copied onto the engagement at the
-- moment the work is recorded, exactly as assigned_commercial_id is copied
-- onto a lead at the moment it is created. Raising somebody's percentage next
-- quarter must not silently rewrite what they were owed last quarter; a
-- payroll figure that changes retroactively is not a record, it is an opinion.
--
-- ─── Money is stored in minor units ───────────────────────────────────────
-- amount_cents is a BIGINT of cents. Never a float: 0.1 + 0.2 is not 0.3 in
-- binary floating point, and this column is the input to somebody's pay. The
-- rate is NUMERIC(5,4) — four decimals, so 12.5% is expressible — and every
-- payout is round(amount_cents * rate), computed in NUMERIC and returned as a
-- whole number of cents.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- supabase_migrations.schema_migrations does not exist in this project (see
-- supabase/BASELINE_MIGRATION_HISTORY.md), so `supabase db push` would replay
-- every historical migration against live production. Apply by pasting into
-- the Studio SQL editor, as the rest of this database was built. Every object
-- uses IF NOT EXISTS, CREATE OR REPLACE or DROP-then-CREATE on its own name,
-- so it is safe to run twice.

-- ─── 1. updated_at trigger function ───────────────────────────────────────
-- Own function rather than the repo's unqualified set_updated_at(), which is
-- SECURITY INVOKER with no pinned search_path. Mirrors the
-- commercial_touch_updated_at() and platform_touch_updated_at() precedents.

CREATE OR REPLACE FUNCTION public.unchained_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ─── 2. A commission rate on the commercial roster ────────────────────────
-- The percentage a representative earns on the work they bring in, as a
-- fraction: 0.10 is ten percent. DEFAULT 0 and not nullable, because "we have
-- not decided what this person earns" and "this person earns nothing" must not
-- be the same value on a payslip — 0 is the honest starting state, and a NULL
-- would propagate into every payout calculation as a silent NULL.
--
-- Existing rows all take the default. The public resolver is unaffected: it
-- selects eight named columns (see 20260901000002) and this is not one of
-- them, so no commission figure can reach the website.

ALTER TABLE public.commercial_contacts
  ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(5,4) NOT NULL DEFAULT 0;

-- ADD CONSTRAINT has no IF NOT EXISTS before PG16, so it is guarded by hand to
-- keep this file re-runnable on whatever version production is on.
DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.commercial_contacts'::regclass
       AND conname  = 'commercial_contacts_commission_rate_range'
  ) THEN
    ALTER TABLE public.commercial_contacts
      ADD CONSTRAINT commercial_contacts_commission_rate_range
      CHECK (commission_rate >= 0 AND commission_rate <= 1);
  END IF;
END;
$blk$;

-- ─── 3. unchained_specialists ─────────────────────────────────────────────
-- The delivery roster. Same shape as a commercial in the ways that matter —
-- a name, a login link, an active flag, a default rate — and deliberately
-- WITHOUT the two things that make commercial_contacts routable: no channel
-- columns and no region assignment. There is no table in this database that
-- can point the public website at one of these rows.
--
-- Deactivated, never deleted, for the same reason Phase 4 gave: a specialist
-- who worked an engagement two years ago still has to be nameable on it.

CREATE TABLE IF NOT EXISTS public.unchained_specialists (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  name             TEXT NOT NULL,
  email            TEXT,
  -- Free text: "Backend", "Motion design", "SEO técnico". A closed enum here
  -- would need a migration every time the company learns to do something new.
  specialty        TEXT,
  commission_rate  NUMERIC(5,4) NOT NULL DEFAULT 0,
  active           BOOLEAN NOT NULL DEFAULT TRUE,
  notes            TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_specialists_name_present
    CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  -- Same permissive rule as commercial_contacts_email_format: reject "not an
  -- address at all", not "not RFC 5322".
  CONSTRAINT unchained_specialists_email_format
    CHECK (email IS NULL OR (length(email) <= 200
       AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  CONSTRAINT unchained_specialists_specialty_length
    CHECK (specialty IS NULL OR length(btrim(specialty)) BETWEEN 1 AND 80),
  CONSTRAINT unchained_specialists_commission_rate_range
    CHECK (commission_rate >= 0 AND commission_rate <= 1)
);

-- One login maps to at most one specialist, for the same reason Phase 7 made
-- commercial_contacts.user_id unique: "which work is mine" is an authorization
-- question, and two rows claiming the same person would make it ambiguous.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_specialists_user_unique
  ON public.unchained_specialists (user_id)
  WHERE user_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unchained_specialists_admin_list
  ON public.unchained_specialists (active, name);

DROP TRIGGER IF EXISTS trg_unchained_specialists_updated_at ON public.unchained_specialists;
CREATE TRIGGER trg_unchained_specialists_updated_at
  BEFORE UPDATE ON public.unchained_specialists
  FOR EACH ROW EXECUTE FUNCTION public.unchained_touch_updated_at();

-- ─── 4. unchained_engagements ─────────────────────────────────────────────
-- One paid piece of work for one client.
--
-- ─── Why this is not a column on unchained_leads ──────────────────────────
-- A lead is an inquiry; an engagement is a contract. One won lead can become
-- two engagements (a build, then a retainer), an engagement can arrive with no
-- lead behind it at all (a referral, a repeat client), and only an engagement
-- has people assigned to deliver it. Hanging an `amount` column off the lead
-- would make the first two impossible and the third meaningless.
--
-- `lead_id` is therefore nullable and carries NO ON DELETE clause: leads are
-- never deleted (Phase 7 §50 grants DELETE to nobody), and NO ACTION is the
-- right answer if that ever changes.
--
-- ─── Why the client's name is repeated here ───────────────────────────────
-- Not denormalisation for speed. An engagement with no lead has no other place
-- to carry a client name, and an engagement WITH a lead must keep the name the
-- contract was signed under even if somebody later corrects a typo on the
-- lead. The two are different facts that usually agree.

CREATE TABLE IF NOT EXISTS public.unchained_engagements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Where it came from ────────────────────────────────────────────────
  lead_id         UUID REFERENCES public.unchained_leads(id),

  -- ── Who it is for ─────────────────────────────────────────────────────
  client_name     TEXT NOT NULL,
  client_company  TEXT,

  -- ── What the work is ──────────────────────────────────────────────────
  title           TEXT NOT NULL,
  description     TEXT,
  service_id      TEXT REFERENCES public.unchained_services(id) ON UPDATE CASCADE,

  -- ── What the client pays ──────────────────────────────────────────────
  -- Minor units. See the file header on why this is not a float.
  amount_cents    BIGINT NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'EUR',

  -- ── Who sold it, and on what terms (§15) ──────────────────────────────
  -- Both snapshotted. commercial_id has no ON DELETE clause for the same
  -- reason unchained_leads.assigned_commercial_id has none: a representative
  -- who owns engagements is deactivated, not deleted.
  commercial_id     UUID REFERENCES public.commercial_contacts(id),
  -- NOT NULL with NO DEFAULT, deliberately. Omitting the column yields NULL,
  -- which the BEFORE INSERT trigger in §6 replaces with the representative's
  -- current rate; passing 0 explicitly means zero and is left alone. A DEFAULT
  -- of 0 would make those two indistinguishable, and the second one is a real
  -- arrangement. NOT NULL still holds: row constraints are checked AFTER
  -- BEFORE-ROW triggers run.
  commercial_rate   NUMERIC(5,4) NOT NULL,

  -- ── Lifecycle ─────────────────────────────────────────────────────────
  status          TEXT NOT NULL DEFAULT 'proposal',
  started_at      TIMESTAMPTZ,
  delivered_at    TIMESTAMPTZ,
  paid_at         TIMESTAMPTZ,
  cancelled_at    TIMESTAMPTZ,

  notes           TEXT,

  CONSTRAINT unchained_engagements_client_name_present
    CHECK (length(btrim(client_name)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_engagements_client_company_length
    CHECK (client_company IS NULL OR length(btrim(client_company)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_engagements_title_present
    CHECK (length(btrim(title)) BETWEEN 1 AND 200),
  CONSTRAINT unchained_engagements_description_length
    CHECK (description IS NULL OR length(description) <= 4000),
  CONSTRAINT unchained_engagements_notes_length
    CHECK (notes IS NULL OR length(notes) <= 4000),

  -- Non-negative, and bounded well above any realistic contract so a slipped
  -- decimal point or a pasted account number cannot be saved as a fee. Ten
  -- billion minor units is 100,000,000.00 in either currency.
  CONSTRAINT unchained_engagements_amount_range
    CHECK (amount_cents >= 0 AND amount_cents <= 10000000000),

  -- Two currencies, because Unchained Business quotes in two. A third is a
  -- one-line change here plus a rate source, and inventing the second half of
  -- that now would be building a conversion engine nobody asked for.
  CONSTRAINT unchained_engagements_currency_valid
    CHECK (currency IN ('EUR', 'USD')),

  CONSTRAINT unchained_engagements_commercial_rate_range
    CHECK (commercial_rate >= 0 AND commercial_rate <= 1),

  CONSTRAINT unchained_engagements_status_valid
    CHECK (status IN ('proposal', 'active', 'delivered', 'paid', 'cancelled')),

  -- The timestamps must agree with the status, exactly as Phase 7 requires of
  -- a lead. The trigger below writes them; these assert that it did.
  CONSTRAINT unchained_engagements_paid_has_timestamp
    CHECK ((status = 'paid') = (paid_at IS NOT NULL)),
  CONSTRAINT unchained_engagements_cancelled_has_timestamp
    CHECK ((status = 'cancelled') = (cancelled_at IS NOT NULL)),
  -- delivered_at and started_at persist through later statuses — work that was
  -- delivered and then paid was still delivered — so these are one-way
  -- implications rather than equalities.
  CONSTRAINT unchained_engagements_delivered_implies_timestamp
    CHECK (status <> 'delivered' OR delivered_at IS NOT NULL),
  CONSTRAINT unchained_engagements_date_order
    CHECK (
      (started_at   IS NULL OR started_at   >= created_at)
      AND (delivered_at IS NULL OR started_at IS NOT NULL)
      AND (delivered_at IS NULL OR delivered_at >= started_at)
      AND (paid_at      IS NULL OR delivered_at IS NULL OR paid_at >= delivered_at)
    )
);

-- The three access paths that actually run. `commercial_id` is the one a
-- representative's own panel filters on, `lead_id` answers "did this lead
-- become work", and `status` orders every management list.
CREATE INDEX IF NOT EXISTS idx_unchained_engagements_commercial
  ON public.unchained_engagements (commercial_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_engagements_lead
  ON public.unchained_engagements (lead_id)
  WHERE lead_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_unchained_engagements_status
  ON public.unchained_engagements (status, created_at DESC);

-- ─── 5. unchained_engagement_specialists ──────────────────────────────────
-- Who is delivering the work, and what share of the client's fee they are
-- paid for it.
--
-- A table rather than a column, because both directions are many: one
-- engagement needs a backend engineer and a designer, and one specialist works
-- three engagements at once. `rate` lives HERE and not on the specialist for
-- the same reason routing priority lives on the assignment: the share is a
-- property of the PAIRING. The same person can be on 20% of a build and 10% of
-- a retainer, and the number that decides what they are owed for one of them
-- must not move when the other is negotiated.

CREATE TABLE IF NOT EXISTS public.unchained_engagement_specialists (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id  UUID NOT NULL REFERENCES public.unchained_engagements(id) ON DELETE CASCADE,
  -- No ON DELETE clause, deliberately: a specialist who has been assigned to
  -- paid work cannot be deleted out from under it. Deactivate instead.
  specialist_id  UUID NOT NULL REFERENCES public.unchained_specialists(id),
  -- NOT NULL with no DEFAULT, for the reason unchained_engagements.commercial_rate
  -- carries: omitted (NULL) takes the specialist's current rate, explicit 0 means 0.
  rate           NUMERIC(5,4) NOT NULL,
  active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_engagement_specialists_rate_range
    CHECK (rate >= 0 AND rate <= 1)
);

-- Partial rather than a plain UNIQUE, for the reason Phase 5 gave about
-- memberships: unassigning sets active = false so the history survives, and a
-- total constraint would then make re-assigning the same person impossible.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_engagement_specialists_active_unique
  ON public.unchained_engagement_specialists (engagement_id, specialist_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS idx_unchained_engagement_specialists_specialist
  ON public.unchained_engagement_specialists (specialist_id, active);

CREATE INDEX IF NOT EXISTS idx_unchained_engagement_specialists_engagement
  ON public.unchained_engagement_specialists (engagement_id, active);

DROP TRIGGER IF EXISTS trg_unchained_engagement_specialists_updated_at
  ON public.unchained_engagement_specialists;
CREATE TRIGGER trg_unchained_engagement_specialists_updated_at
  BEFORE UPDATE ON public.unchained_engagement_specialists
  FOR EACH ROW EXECUTE FUNCTION public.unchained_touch_updated_at();

-- ─── 6. The rate snapshot, taken by the database ──────────────────────────
-- The whole point of §15 is that the rate on a piece of work is fixed when the
-- work is recorded. If the CLIENT of this database had to remember to copy it,
-- §15 would hold exactly as long as every caller remembered — and the one that
-- forgot would produce an engagement paying 0%.
--
-- So the copy is made here. An INSERT that does not name a rate gets the
-- person's current default; an INSERT that DOES name one is honoured, which is
-- the per-engagement override.
--
-- Zero is a real rate — an internal project, a favour, a rebuild at cost — so
-- "not named" must be distinguishable from "named as zero". That is why both
-- rate columns are NOT NULL with NO DEFAULT: an omitted column arrives as
-- NULL, this trigger fills it, and the NOT NULL is checked afterwards. Had
-- they carried DEFAULT 0, the two cases would be the same value and every
-- deliberate 0% would be silently overwritten with the roster rate.
--
-- Written as BEFORE INSERT only. An UPDATE that changes the rate is a
-- deliberate renegotiation and is left alone.

CREATE OR REPLACE FUNCTION public.unchained_engagement_default_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.commercial_rate IS NULL THEN
    IF NEW.commercial_id IS NOT NULL THEN
      SELECT c.commission_rate INTO NEW.commercial_rate
        FROM public.commercial_contacts c
       WHERE c.id = NEW.commercial_id;
    END IF;
    -- Unsold work, or a representative deleted between the two statements:
    -- nobody is owed a commission on it, and 0 is the truthful answer.
    NEW.commercial_rate := COALESCE(NEW.commercial_rate, 0);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_default_rate ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_default_rate
  BEFORE INSERT ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagement_default_rate();

CREATE OR REPLACE FUNCTION public.unchained_assignment_default_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.rate IS NULL THEN
    SELECT s.commission_rate INTO NEW.rate
      FROM public.unchained_specialists s
     WHERE s.id = NEW.specialist_id;
    NEW.rate := COALESCE(NEW.rate, 0);
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagement_specialists_default_rate
  ON public.unchained_engagement_specialists;
CREATE TRIGGER trg_unchained_engagement_specialists_default_rate
  BEFORE INSERT ON public.unchained_engagement_specialists
  FOR EACH ROW EXECUTE FUNCTION public.unchained_assignment_default_rate();

-- ─── 7. The engagement status machine ─────────────────────────────────────
--
--     proposal ──► active ──► delivered ──► paid
--         │           │            │
--         └───────────┴────────────┴──────► cancelled
--
-- `paid` is terminal: money that has changed hands is a fact, and an
-- engagement that needs more work afterwards is another engagement. `cancelled`
-- is terminal for the same reason — reopening it would make "how much did we
-- cancel last quarter" unanswerable.
--
-- Skipping forward is not permitted. proposal → paid would produce revenue
-- from work that was never started or delivered, and every operational figure
-- on the panel is a count of rows in one of these states.

CREATE OR REPLACE FUNCTION public.unchained_engagement_transition_allowed(
  p_from TEXT,
  p_to   TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE p_from
    WHEN 'proposal'  THEN p_to IN ('active', 'cancelled')
    WHEN 'active'    THEN p_to IN ('delivered', 'cancelled')
    WHEN 'delivered' THEN p_to IN ('paid', 'cancelled')
    ELSE FALSE  -- 'paid' and 'cancelled' are terminal; an unknown status goes nowhere
  END;
$fn$;

CREATE OR REPLACE FUNCTION public.unchained_engagements_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.unchained_engagement_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION
        'unchained_engagements: % is not a permitted transition from %', NEW.status, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;

    -- Written once and never moved, like Phase 7's first_contact_at: these are
    -- the dates an invoice is argued over.
    IF NEW.status = 'active'    THEN NEW.started_at   := COALESCE(OLD.started_at,   now()); END IF;
    IF NEW.status = 'delivered' THEN NEW.delivered_at := COALESCE(OLD.delivered_at, now()); END IF;
    IF NEW.status = 'paid'      THEN NEW.paid_at      := COALESCE(OLD.paid_at,      now()); END IF;
    IF NEW.status = 'cancelled' THEN NEW.cancelled_at := COALESCE(OLD.cancelled_at, now()); END IF;
  END IF;

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_before_update ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_before_update
  BEFORE UPDATE ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagements_before_update();

-- ─── 8. Pay is configured by the super-admin, and by nobody else ──────────
-- "En el panel de super admin se debe poder configurar el porciento que cobra
-- cada comercial y especialista."
--
-- An unchained_admin manages the pipeline: they add specialists, record
-- engagements, assign people. They do NOT set what anyone is paid. That is one
-- privilege, held by one role, and it is enforced where it cannot be forgotten
-- — a BEFORE UPDATE trigger on each roster table — rather than by hoping every
-- future write path remembers to check.
--
-- The trigger fires on the COLUMN, not on the table: an unchained_admin
-- editing a specialist's name or deactivating them passes straight through,
-- and only a changed commission_rate is refused.
--
-- ─── INSERT is guarded too, and differently ───────────────────────────────
-- Guarding UPDATE alone would leave the rule trivially bypassable: an
-- unchained_admin holds INSERT on unchained_specialists (they add specialists,
-- which is their job), so they could simply CREATE a person at 90% instead of
-- editing one to it. The management screen never sends the column — see
-- createSpecialist() in features/workforce/queries.ts — but a policy that
-- depends on the client not asking is not a policy.
--
-- On INSERT the test is "a non-zero rate from an authenticated non-super-admin",
-- not "any non-zero rate". A caller with NO auth.uid() is service_role, which
-- in this system means the create-unchained-member edge function — already
-- gated on super_admin before it reaches the database, and the one path that
-- legitimately creates a member with an agreed rate. Refusing it here would
-- break invitations to make an unreachable case safer.
--
-- ─── One dependency worth naming ──────────────────────────────────────────
-- SECURITY INVOKER, so this calls public.is_super_admin() as the writer.
-- That function is GRANTed to authenticated by 20260816000003 and again by
-- 20260831000001. If a future migration revokes it, a super_admin's own rate
-- change starts failing with "permission denied for function" — refusing the
-- write, but for the wrong reason. Re-grant it rather than making this
-- SECURITY DEFINER: a definer-rights trigger on a table anyone may write is a
-- larger surface than the problem.

CREATE OR REPLACE FUNCTION public.unchained_guard_commission_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF COALESCE(NEW.commission_rate, 0) <> 0
       AND (SELECT auth.uid()) IS NOT NULL
       AND NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'only a super_admin may set a commission rate'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.commission_rate IS DISTINCT FROM OLD.commission_rate
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only a super_admin may change a commission rate'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_commercial_contacts_guard_commission
  ON public.commercial_contacts;
CREATE TRIGGER trg_commercial_contacts_guard_commission
  BEFORE INSERT OR UPDATE ON public.commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION public.unchained_guard_commission_rate();

DROP TRIGGER IF EXISTS trg_unchained_specialists_guard_commission
  ON public.unchained_specialists;
CREATE TRIGGER trg_unchained_specialists_guard_commission
  BEFORE INSERT OR UPDATE ON public.unchained_specialists
  FOR EACH ROW EXECUTE FUNCTION public.unchained_guard_commission_rate();

-- ─── 9. Which specialist am I? ────────────────────────────────────────────
-- The mirror of Phase 7's my_commercial_contact_id(), and it makes the same
-- two choices for the same two reasons.
--
-- It does NOT filter on `active`: a specialist removed from new assignments
-- still delivered the work they were assigned, and locking them out of their
-- own record the moment they stop taking new work would be a data-retention
-- accident. Access is removed by revoking the product membership — which this
-- function DOES require, because the user_id link is a statement about
-- identity, not a grant.

CREATE OR REPLACE FUNCTION public.my_specialist_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT s.id
    FROM public.unchained_specialists s
   WHERE s.user_id = (SELECT auth.uid())
     AND (SELECT auth.uid()) IS NOT NULL
     AND EXISTS (
           SELECT 1
             FROM public.product_memberships m
             JOIN public.platform_products p ON p.id = m.product_id
            WHERE m.user_id    = (SELECT auth.uid())
              AND m.product_id = 'unchained'
              AND m.active
              AND p.enabled
         )
   LIMIT 1;
$fn$;

-- Supabase's default privileges grant EXECUTE on new functions to anon
-- explicitly, so `REVOKE ... FROM PUBLIC` alone would leave this callable by
-- the website's key. Every REVOKE in this file names anon, per the pattern
-- Phase 7 established.
REVOKE ALL ON FUNCTION public.my_specialist_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_specialist_id() TO authenticated;

-- ─── 10. Row Level Security ───────────────────────────────────────────────
-- Three different people open the same screen and must see three different
-- things. That rule lives here, not in the router.

ALTER TABLE public.unchained_specialists              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_engagements              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_engagement_specialists   ENABLE ROW LEVEL SECURITY;

-- ── unchained_specialists ────────────────────────────────────────────────
-- Read: a manager sees the roster; a specialist sees their own row and nobody
-- else's. The self arm compares user_id to auth.uid() DIRECTLY rather than
-- calling my_specialist_id(), for the reason Phase 7 documented on
-- commercial_contacts_unchained_read: a policy on a table that calls a
-- function which queries that same table is a recursion hazard the moment the
-- function's owner stops bypassing RLS. Written this way it cannot recurse
-- under any ownership, and it says the same thing.
--
-- Write: managers. The commission_rate column is carved out of that by the
-- trigger in §8 and reserved to super_admin.
DROP POLICY IF EXISTS unchained_specialists_read ON public.unchained_specialists;
CREATE POLICY unchained_specialists_read ON public.unchained_specialists
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         user_id = (SELECT auth.uid())
         AND public.has_product_access('unchained')
       )
  );

DROP POLICY IF EXISTS unchained_specialists_manage ON public.unchained_specialists;
CREATE POLICY unchained_specialists_manage ON public.unchained_specialists
  FOR ALL
  USING (public.unchained_manages_leads())
  WITH CHECK (public.unchained_manages_leads());

-- ── unchained_engagements ────────────────────────────────────────────────
-- Read: a manager sees every engagement; a commercial sees the ones they sold.
--
-- A SPECIALIST IS DELIBERATELY NOT ON THIS POLICY, and that is not an
-- oversight — it is the only way to answer the requirement precisely. A
-- specialist must see the client amount and their OWN share, and must not see
-- what the commercial earns on the same contract. RLS filters rows, not
-- columns, so a SELECT policy that let a specialist read this row would hand
-- them commercial_rate along with it. They reach their work through
-- unchained_my_engagements() instead, which is SECURITY DEFINER and returns a
-- column list shaped for who is asking.
--
-- Write: managers only. A commercial cannot edit the fee on their own deal,
-- which is the entire reason the fee is worth recording.
DROP POLICY IF EXISTS unchained_engagements_read ON public.unchained_engagements;
CREATE POLICY unchained_engagements_read ON public.unchained_engagements
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         public.my_commercial_contact_id() IS NOT NULL
         AND commercial_id = public.my_commercial_contact_id()
       )
  );

DROP POLICY IF EXISTS unchained_engagements_manage ON public.unchained_engagements;
CREATE POLICY unchained_engagements_manage ON public.unchained_engagements
  FOR ALL
  USING (public.unchained_manages_leads())
  WITH CHECK (public.unchained_manages_leads());

-- ── unchained_engagement_specialists ─────────────────────────────────────
-- Read: a manager sees every assignment; a specialist sees their own rows.
--
-- A commercial is NOT on this policy either. What one specialist is paid is
-- not information the person who sold the contract needs, and the requirement
-- asks for the opposite direction only — the commercial sees the client's
-- amount, not the delivery team's pay.
DROP POLICY IF EXISTS unchained_engagement_specialists_read
  ON public.unchained_engagement_specialists;
CREATE POLICY unchained_engagement_specialists_read
  ON public.unchained_engagement_specialists
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         public.my_specialist_id() IS NOT NULL
         AND specialist_id = public.my_specialist_id()
       )
  );

DROP POLICY IF EXISTS unchained_engagement_specialists_manage
  ON public.unchained_engagement_specialists;
CREATE POLICY unchained_engagement_specialists_manage
  ON public.unchained_engagement_specialists
  FOR ALL
  USING (public.unchained_manages_leads())
  WITH CHECK (public.unchained_manages_leads());

-- ─── 11. Table privileges ─────────────────────────────────────────────────
-- Belt and braces over RLS, exactly as Phases 4, 5 and 7 did it. RLS with no
-- matching anon policy already denies anon, but that is one accidental
-- `CREATE POLICY ... TO public` away from being untrue, and these tables hold
-- what real people are paid.

REVOKE ALL ON TABLE public.unchained_specialists            FROM anon;
REVOKE ALL ON TABLE public.unchained_engagements            FROM anon;
REVOKE ALL ON TABLE public.unchained_engagement_specialists FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_specialists            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_engagements            TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.unchained_engagement_specialists TO authenticated;

-- ─── 12. Who am I, as far as this module is concerned? ────────────────────
-- The panel has to know which of three screens to draw before it reads any
-- data, and the answer must not be derived in the browser from a role string
-- the browser was handed. One RPC, one answer, taken from auth.uid().
--
-- `kind` is the most privileged thing the caller is, because a person can be
-- more than one: a commercial_manager who is also linked to a contact row is a
-- manager, and gets the management screens. `commercial_id` and
-- `specialist_id` are returned alongside regardless, so a manager who is also
-- a commercial can still open their own panel.
--
-- Returns kind = 'none' rather than raising for a signed-in user with no
-- Unchained standing. The route guard already refused them; this is what the
-- screen renders if one ever gets past it, and "you have no panel here" is a
-- better outcome than a 500.

CREATE OR REPLACE FUNCTION public.unchained_my_workforce_profile()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT jsonb_build_object(
    'kind',
      CASE
        WHEN (SELECT auth.uid()) IS NULL           THEN 'none'
        WHEN public.unchained_manages_leads()      THEN 'manager'
        WHEN public.my_commercial_contact_id() IS NOT NULL THEN 'commercial'
        WHEN public.my_specialist_id() IS NOT NULL THEN 'specialist'
        ELSE 'none'
      END,
    'is_super_admin', public.is_super_admin(),
    'commercial', (
      SELECT jsonb_build_object(
               'id', c.id, 'name', c.name, 'role', c.role,
               'active', c.active, 'commission_rate', c.commission_rate)
        FROM public.commercial_contacts c
       WHERE c.id = public.my_commercial_contact_id()
    ),
    'specialist', (
      SELECT jsonb_build_object(
               'id', s.id, 'name', s.name, 'specialty', s.specialty,
               'active', s.active, 'commission_rate', s.commission_rate)
        FROM public.unchained_specialists s
       WHERE s.id = public.my_specialist_id()
    )
  );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_my_workforce_profile() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_my_workforce_profile() TO authenticated;

-- ─── 13. The caller's own work ────────────────────────────────────────────
-- One function, three answers, and the difference between them is the column
-- list — which is precisely what RLS could not express (see §10).
--
--   commercial   the clients they converted, what each is paying, their own
--                rate and what that earns them
--   specialist   the work they are delivering, what the CLIENT pays for it,
--                their own rate and what that earns them
--   manager      everything, with the commercial's share visible
--
-- `my_rate` and `my_payout_cents` mean "yours" in every row, so the same
-- component renders all three without knowing whose panel it is on. A manager
-- has no personal share of an engagement they did not sell, so their `my_rate`
-- is the commercial's — they are looking at the business, not at a payslip,
-- and `commercial_rate` is returned to them separately and truthfully.
--
-- What a specialist's rows do NOT carry is the commercial's share: the
-- `commercial_rate` column is not selected on that arm and `commercial_name` is
-- NULL. That omission is the reason this function exists at all — RLS filters
-- rows, and the thing being withheld here is a column.
--
-- The payout is round(amount * rate) in NUMERIC, returned as whole cents.
-- Rounding once, here, means the panel never adds up rounded halves and
-- disagrees with itself.

CREATE OR REPLACE FUNCTION public.unchained_my_engagements()
RETURNS TABLE (
  id                UUID,
  created_at        TIMESTAMPTZ,
  client_name       TEXT,
  client_company    TEXT,
  title             TEXT,
  service_id        TEXT,
  status            TEXT,
  amount_cents      BIGINT,
  currency          TEXT,
  my_role           TEXT,
  my_rate           NUMERIC,
  my_payout_cents   BIGINT,
  commercial_name   TEXT,
  started_at        TIMESTAMPTZ,
  delivered_at      TIMESTAMPTZ,
  paid_at           TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  -- The commercial's own deals. Also the manager's view of every deal: the
  -- WHERE arm widens to TRUE when the caller manages, and the rate shown is
  -- the commercial's, which is what a manager is looking at.
  SELECT
    e.id, e.created_at, e.client_name, e.client_company, e.title, e.service_id,
    e.status, e.amount_cents, e.currency,
    'commercial'::TEXT,
    e.commercial_rate,
    round(e.amount_cents * e.commercial_rate)::BIGINT,
    c.name,
    e.started_at, e.delivered_at, e.paid_at
  FROM public.unchained_engagements e
  LEFT JOIN public.commercial_contacts c ON c.id = e.commercial_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND (
          public.unchained_manages_leads()
          OR (
               public.my_commercial_contact_id() IS NOT NULL
               AND e.commercial_id = public.my_commercial_contact_id()
             )
        )

  UNION ALL

  -- The specialist's own assignments. Neither the commercial's rate nor their
  -- name is selected here: who sold the contract, and for what share, is not
  -- part of "what am I building and what am I paid for it". A manager already
  -- has that from the arm above.
  --
  -- Inactive assignments are excluded. An unassigned specialist is not owed
  -- for work they are no longer doing, and showing it would put a figure on
  -- their panel that nobody intends to pay.
  SELECT
    e.id, e.created_at, e.client_name, e.client_company, e.title, e.service_id,
    e.status, e.amount_cents, e.currency,
    'specialist'::TEXT,
    a.rate,
    round(e.amount_cents * a.rate)::BIGINT,
    NULL::TEXT,
    e.started_at, e.delivered_at, e.paid_at
  FROM public.unchained_engagement_specialists a
  JOIN public.unchained_engagements e ON e.id = a.engagement_id
  WHERE (SELECT auth.uid()) IS NOT NULL
    AND a.active
    AND public.my_specialist_id() IS NOT NULL
    AND a.specialist_id = public.my_specialist_id()

  ORDER BY 2 DESC;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_my_engagements() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_my_engagements() TO authenticated;

-- ─── 14. The caller's own money ───────────────────────────────────────────
-- Aggregated over exactly the rows unchained_my_engagements() returns, by
-- selecting FROM it rather than by re-deriving the rule. The headline figure
-- and the table under it cannot disagree, because there is one query.
--
-- ─── Honesty rules, inherited from Phase 7 (§30, §33, §55) ────────────────
-- Every number is a sum over rows that exist. No projection, no annualisation,
-- no "expected" revenue from a proposal nobody has signed. The three buckets
-- are what the money is actually doing:
--
--   pipeline   proposal + active   — quoted, not yet delivered
--   earned     delivered           — owed to the person, not yet collected
--   paid       paid                — the client has paid
--
-- Cancelled work is counted in `cancelled_count` and in NO money total.
-- Rolling it into "pipeline" is how a dashboard ends up reporting revenue that
-- was explicitly called off.
--
-- Amounts are per-currency, as a JSONB object keyed by currency code. There is
-- no conversion and no grand total: adding EUR to USD requires a rate this
-- database does not have, and a fabricated one would be the single most
-- expensive number on the screen.

CREATE OR REPLACE FUNCTION public.unchained_my_earnings()
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH mine AS (
    SELECT * FROM public.unchained_my_engagements()
  ),
  per_currency AS (
    SELECT
      currency,
      count(*)                                                        AS engagements,
      sum(amount_cents)    FILTER (WHERE status <> 'cancelled')       AS client_total,
      sum(my_payout_cents) FILTER (WHERE status IN ('proposal','active'))  AS my_pipeline,
      sum(my_payout_cents) FILTER (WHERE status = 'delivered')        AS my_earned,
      sum(my_payout_cents) FILTER (WHERE status = 'paid')             AS my_paid
    FROM mine
    GROUP BY currency
  )
  SELECT jsonb_build_object(
    'engagements',      (SELECT count(*)                                        FROM mine),
    'active_count',     (SELECT count(*) FILTER (WHERE status = 'active')       FROM mine),
    'delivered_count',  (SELECT count(*) FILTER (WHERE status = 'delivered')    FROM mine),
    'paid_count',       (SELECT count(*) FILTER (WHERE status = 'paid')         FROM mine),
    'cancelled_count',  (SELECT count(*) FILTER (WHERE status = 'cancelled')    FROM mine),
    'clients',          (SELECT count(DISTINCT lower(btrim(client_name)))       FROM mine),
    'by_currency', COALESCE(
      (SELECT jsonb_object_agg(
                currency,
                jsonb_build_object(
                  'engagements',       engagements,
                  'client_total_cents', COALESCE(client_total, 0),
                  'my_pipeline_cents',  COALESCE(my_pipeline,  0),
                  'my_earned_cents',    COALESCE(my_earned,    0),
                  'my_paid_cents',      COALESCE(my_paid,      0)
                ))
         FROM per_currency),
      '{}'::JSONB)
  );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_my_earnings() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_my_earnings() TO authenticated;

-- ─── 15. Setting a rate ───────────────────────────────────────────────────
-- The super-admin's one write on pay, and the screen behind
-- "configurar el porciento que cobra cada comercial y especialista".
--
-- A function rather than two direct UPDATEs, for one reason: the two roster
-- tables are different tables with the same rule, and a caller that had to
-- pick the right one could pick wrong. `p_kind` names which roster, the
-- function names the table, and the authorization check is written once.
--
-- The trigger in §8 would refuse a non-super-admin anyway. This checks FIRST so
-- the caller gets 'insufficient_privilege' with a sentence rather than a
-- trigger exception, and so the rule is legible at the entry point as well as
-- at the boundary. Both are load-bearing: the trigger is what holds if a
-- future write path forgets this function exists.

CREATE OR REPLACE FUNCTION public.unchained_set_commission_rate(
  p_kind TEXT,
  p_id   UUID,
  p_rate NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_kind TEXT := lower(btrim(COALESCE(p_kind, '')));
  v_name TEXT;
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only a super_admin may set a commission rate'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_rate IS NULL OR p_rate < 0 OR p_rate > 1 THEN
    RAISE EXCEPTION 'a commission rate must be a fraction between 0 and 1'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_kind = 'commercial' THEN
    UPDATE public.commercial_contacts
       SET commission_rate = p_rate
     WHERE id = p_id
     RETURNING name INTO v_name;
  ELSIF v_kind = 'specialist' THEN
    UPDATE public.unchained_specialists
       SET commission_rate = p_rate
     WHERE id = p_id
     RETURNING name INTO v_name;
  ELSE
    RAISE EXCEPTION 'unknown roster: % (expected commercial or specialist)', p_kind
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF v_name IS NULL THEN
    RAISE EXCEPTION 'no such % ', v_kind USING ERRCODE = 'no_data_found';
  END IF;

  -- Existing engagements are deliberately NOT touched. See the file header:
  -- the rate on recorded work is a snapshot, and this changes what the person
  -- earns on work recorded from now on.
  RETURN jsonb_build_object('success', TRUE, 'kind', v_kind, 'name', v_name, 'rate', p_rate);
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_set_commission_rate(TEXT, UUID, NUMERIC) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_set_commission_rate(TEXT, UUID, NUMERIC) TO authenticated;

-- ─── 16. The roster, as a manager needs to see it ─────────────────────────
-- Every commercial and every specialist in one shape, with their rate and what
-- they have actually earned, for the super-admin's configuration screen.
--
-- SECURITY INVOKER, deliberately, and for the reason Phase 7 gave about
-- unchained_lead_metrics(): it runs as the CALLER, so the RLS policies above
-- decide what it can see. A specialist calling it gets their own row and
-- nothing else, with no second copy of the scoping rule to drift out of sync.

CREATE OR REPLACE FUNCTION public.unchained_workforce_roster()
RETURNS TABLE (
  kind             TEXT,
  id               UUID,
  user_id          UUID,
  name             TEXT,
  detail           TEXT,
  email            TEXT,
  active           BOOLEAN,
  commission_rate  NUMERIC,
  has_login        BOOLEAN,
  engagements      BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  SELECT
    'commercial'::TEXT, c.id, c.user_id, c.name, c.role, c.email, c.active,
    c.commission_rate, c.user_id IS NOT NULL,
    (SELECT count(*) FROM public.unchained_engagements e WHERE e.commercial_id = c.id)
  FROM public.commercial_contacts c

  UNION ALL

  SELECT
    'specialist'::TEXT, s.id, s.user_id, s.name, s.specialty, s.email, s.active,
    s.commission_rate, s.user_id IS NOT NULL,
    (SELECT count(*) FROM public.unchained_engagement_specialists a
      WHERE a.specialist_id = s.id AND a.active)
  FROM public.unchained_specialists s

  ORDER BY 1, 7 DESC, 4;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_workforce_roster() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_workforce_roster() TO authenticated;

-- ─── 17. Apply-time verification ──────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving half a
-- permission model behind.

DO $blk$
DECLARE
  v_table TEXT;
  v_rls   BOOLEAN;
  v_pol   INTEGER;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'unchained_specialists',
    'unchained_engagements',
    'unchained_engagement_specialists'
  ] LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class WHERE oid = ('public.' || v_table)::regclass;
    IF NOT v_rls THEN
      RAISE EXCEPTION '[fail] RLS is not enabled on public.%', v_table;
    END IF;

    SELECT count(*) INTO v_pol
      FROM pg_policies WHERE schemaname = 'public' AND tablename = v_table;
    IF v_pol = 0 THEN
      RAISE EXCEPTION '[fail] public.% has RLS enabled but no policy — managers would be locked out', v_table;
    END IF;

    RAISE NOTICE '[ok] public.% — RLS enabled, % policy(ies)', v_table, v_pol;
  END LOOP;
END;
$blk$;

-- Every SECURITY DEFINER function added here sits on the authorization
-- boundary. A future CREATE OR REPLACE that drops SECURITY DEFINER or unpins
-- search_path would reintroduce the 2026-08 defect class, so it is asserted
-- rather than assumed. Mirrors the check in 20260902000001.
DO $blk$
DECLARE
  v_fn    TEXT;
  v_sd    BOOLEAN;
  v_cfg   TEXT[];
  v_entry TEXT;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'my_specialist_id',
    'unchained_my_workforce_profile',
    'unchained_my_engagements',
    'unchained_my_earnings',
    'unchained_set_commission_rate'
  ] LOOP
    SELECT p.prosecdef, p.proconfig INTO v_sd, v_cfg
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn;

    IF v_sd IS NULL THEN
      RAISE EXCEPTION '[fail] public.%() was not created', v_fn;
    END IF;
    IF NOT v_sd THEN
      RAISE EXCEPTION '[fail] public.%() must be SECURITY DEFINER', v_fn;
    END IF;

    SELECT c INTO v_entry FROM unnest(COALESCE(v_cfg, ARRAY[]::TEXT[])) c
     WHERE c LIKE 'search_path=%';
    IF v_entry IS NULL THEN
      RAISE EXCEPTION '[fail] public.%() does not pin search_path', v_fn;
    END IF;
    -- 'search_path=' is 12 characters, so the value starts at 13.
    IF btrim(substr(v_entry, 13), '"''') <> '' THEN
      RAISE EXCEPTION '[fail] public.%() must pin search_path to the empty string (found: %)',
        v_fn, v_entry;
    END IF;

    RAISE NOTICE '[ok] public.%() — SECURITY DEFINER, search_path pinned empty', v_fn;
  END LOOP;
END;
$blk$;

-- Not one of these functions may be reachable by the website's anon key.
-- Supabase's ALTER DEFAULT PRIVILEGES grants EXECUTE to anon EXPLICITLY on
-- every new function, so this is checking that the REVOKEs above actually
-- landed — not merely that nothing granted anon by accident.
DO $blk$
DECLARE
  v_fn  TEXT;
  v_bad INTEGER;
BEGIN
  FOREACH v_fn IN ARRAY ARRAY[
    'my_specialist_id',
    'unchained_my_workforce_profile',
    'unchained_my_engagements',
    'unchained_my_earnings',
    'unchained_set_commission_rate',
    'unchained_workforce_roster'
  ] LOOP
    SELECT count(*) INTO v_bad
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = v_fn
       AND has_function_privilege('anon', p.oid, 'EXECUTE');

    IF v_bad > 0 THEN
      RAISE EXCEPTION '[fail] anon can still EXECUTE public.%()', v_fn;
    END IF;
    RAISE NOTICE '[ok] public.%() — not reachable by anon', v_fn;
  END LOOP;
END;
$blk$;

-- The status machine is a pure function and is the thing standing between the
-- money columns and a proposal that reports itself as paid. Verified, not
-- assumed.
DO $blk$
BEGIN
  IF NOT public.unchained_engagement_transition_allowed('proposal', 'active') THEN
    RAISE EXCEPTION '[fail] proposal -> active must be permitted';
  END IF;
  IF NOT public.unchained_engagement_transition_allowed('delivered', 'paid') THEN
    RAISE EXCEPTION '[fail] delivered -> paid must be permitted';
  END IF;
  IF public.unchained_engagement_transition_allowed('proposal', 'paid') THEN
    RAISE EXCEPTION '[fail] proposal -> paid must be refused: revenue with no delivery';
  END IF;
  IF public.unchained_engagement_transition_allowed('paid', 'active') THEN
    RAISE EXCEPTION '[fail] paid is terminal';
  END IF;
  IF public.unchained_engagement_transition_allowed('cancelled', 'active') THEN
    RAISE EXCEPTION '[fail] cancelled is terminal';
  END IF;
  RAISE NOTICE '[ok] unchained_engagement_transition_allowed() behaves as the trigger expects';
END;
$blk$;

-- Applied from Studio there is no auth.uid(), so every caller-scoped read must
-- return the safe answer for an unauthenticated caller rather than raising.
DO $blk$
DECLARE
  v_json  JSONB;
  v_count INTEGER;
BEGIN
  SET LOCAL search_path = '';

  IF public.my_specialist_id() IS NOT NULL THEN
    RAISE EXCEPTION '[fail] my_specialist_id() must be NULL with no session';
  END IF;

  SELECT public.unchained_my_workforce_profile() INTO v_json;
  IF v_json ->> 'kind' <> 'none' THEN
    RAISE EXCEPTION '[fail] unchained_my_workforce_profile() must answer kind=none with no session, got %', v_json ->> 'kind';
  END IF;

  SELECT count(*) INTO v_count FROM public.unchained_my_engagements();
  IF v_count <> 0 THEN
    RAISE EXCEPTION '[fail] unchained_my_engagements() must return nothing with no session, got % row(s)', v_count;
  END IF;

  SELECT public.unchained_my_earnings() INTO v_json;
  IF (v_json ->> 'engagements')::INTEGER <> 0 THEN
    RAISE EXCEPTION '[fail] unchained_my_earnings() must be empty with no session';
  END IF;

  RAISE NOTICE '[ok] every caller-scoped read fails closed with no session';
END;
$blk$;

-- The commission guard is the only thing reserving pay to the super-admin.
-- Both triggers must exist, on both rosters.
DO $blk$
DECLARE
  v_pair TEXT[];
  v_n    INTEGER;
BEGIN
  FOREACH v_pair SLICE 1 IN ARRAY ARRAY[
    ARRAY['commercial_contacts',    'trg_commercial_contacts_guard_commission'],
    ARRAY['unchained_specialists',  'trg_unchained_specialists_guard_commission']
  ] LOOP
    SELECT count(*) INTO v_n
      FROM pg_trigger t
     WHERE t.tgrelid = ('public.' || v_pair[1])::regclass
       AND t.tgname  = v_pair[2]
       AND NOT t.tgisinternal;

    IF v_n <> 1 THEN
      RAISE EXCEPTION '[fail] % is missing on public.%', v_pair[2], v_pair[1];
    END IF;
    RAISE NOTICE '[ok] % guards public.%', v_pair[2], v_pair[1];
  END LOOP;
END;
$blk$;

-- §38, as every phase before this one: this migration grants nobody anything
-- and seeds no person. It creates the mechanism. Every specialist, every
-- engagement and every rate is a deliberate act performed afterwards through
-- the panel.

NOTIFY pgrst, 'reload schema';

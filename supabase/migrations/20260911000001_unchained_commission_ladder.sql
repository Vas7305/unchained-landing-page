-- ════════════════════════════════════════════════════════════
-- Phase 11 — Unchained Business: the commission ladder
-- ════════════════════════════════════════════════════════════
-- The company rule, stated once: a client's first deal pays the
-- representative's full rate, and every deal after it pays half the one before,
-- down to a floor of one percent.
--
--     Trato 1   diseño + backend + SEO     20 %  ·  20 %  ·  20 %
--     Trato 2   iguala                     10 %
--     Trato 3   rediseño + hosting          5 %  ·   5 %
--     Trato 4                               2,5 %
--     Trato 5                               1,25 %
--     Trato 6+                              1 %   (piso)
--
-- ─── Why the ladder counts DEALS and not contracts ────────────────────────
-- A client who arrives asking for three services is one negotiation, and one
-- piece of work by the representative who produced it. Counting the three
-- engagement rows would hand them 20 %, 10 % and 5 % for one conversation,
-- decided by the order somebody typed the rows in — indefensible to explain,
-- and different every time the data-entry order changed.
--
-- Counting deals also closes the rule in both directions, which counting rows
-- could not. Splitting one job across several engagements inside a deal does
-- not move the rung, so there is nothing to gain by it; splitting it across
-- separate deals ADVANCES the rung, so there is something to lose. A rule that
-- cannot be played either way needs no policing.
--
-- ─── What makes two engagements one deal ──────────────────────────────────
-- Twenty-four hours from the first engagement of the current deal. The client
-- who comes back the next day with another service has come back — that is a
-- new deal and the next rung.
--
-- The window measures when the ROW WAS CREATED, which is not the same as when
-- the client asked, and the difference is somebody's money: a representative
-- whose client phoned on Friday evening and who loads the second service on
-- Monday would lose half a commission to data entry. So §7 lets a super
-- administrator attach an engagement to the previous deal with a recorded
-- reason, and the panel shows which rung is about to apply BEFORE saving. The
-- automatic rule covers the ordinary case; the override covers the true one.
--
-- ─── What this file does NOT do ───────────────────────────────────────────
-- It does not touch what anybody is paid today beyond one backfill, §4, which
-- moves every representative still sitting at the 0 % that Phase 8 used to mean
-- "not yet decided" onto the 20 % floor. Rates above the floor are left alone
-- and are set from the panel, not from here: writing a named person's pay into
-- a migration is not this file's business.
--
-- Requires 20260910000001 (the pipeline spine). Paste into the Studio SQL
-- editor of the UNCHAINED project. Re-runnable; the verification block at the
-- end fails the whole migration rather than leaving half a rule in place.


-- ─── §2. The rule, as data ────────────────────────────────────────────────
-- One row, so the numbers the CEO set can be changed without a migration, and
-- so that changing them is a write somebody can be asked about rather than a
-- deploy. The rule itself — that there IS a ladder — is not configurable; only
-- its constants are.
--
-- Read by every manager because the panel prints "trato 3 · 5 %" and has to get
-- the arithmetic from the same place the database will. Written by super_admin
-- alone, for the reason Phase 8 gave: this is pay.

CREATE TABLE IF NOT EXISTS public.unchained_commission_rules (
  id           BOOLEAN PRIMARY KEY DEFAULT TRUE,

  -- What each successive deal multiplies the previous rate by.
  step_factor  NUMERIC(5,4) NOT NULL DEFAULT 0.5,
  -- Where the ladder stops descending.
  floor_rate   NUMERIC(5,4) NOT NULL DEFAULT 0.01,
  -- The lowest rate a representative may be configured at, and therefore the
  -- rate a new client's first deal pays at minimum.
  base_floor   NUMERIC(5,4) NOT NULL DEFAULT 0.20,
  -- How long a deal stays open to further engagements.
  deal_window  INTERVAL NOT NULL DEFAULT INTERVAL '24 hours',

  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Exactly one row. Without this the table would quietly grow a second rule
  -- and every rate would depend on which one a query happened to read.
  CONSTRAINT unchained_commission_rules_singleton CHECK (id),

  CONSTRAINT unchained_commission_rules_step_range
    CHECK (step_factor > 0 AND step_factor <= 1),
  CONSTRAINT unchained_commission_rules_floor_range
    CHECK (floor_rate >= 0 AND floor_rate <= 1),
  CONSTRAINT unchained_commission_rules_base_range
    CHECK (base_floor >= 0 AND base_floor <= 1),
  -- A floor above the base floor would mean the ladder raises rates rather than
  -- lowering them, which is not a ladder.
  CONSTRAINT unchained_commission_rules_floor_below_base
    CHECK (floor_rate <= base_floor),
  CONSTRAINT unchained_commission_rules_window_positive
    CHECK (deal_window > INTERVAL '0')
);

INSERT INTO public.unchained_commission_rules (id) VALUES (TRUE)
  ON CONFLICT (id) DO NOTHING;

CREATE OR REPLACE FUNCTION public.unchained_commission_rules_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'only a super_admin may change the commission rules'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  NEW.updated_at := now();
  NEW.updated_by := (SELECT auth.uid());
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_commission_rules_guard
  ON public.unchained_commission_rules;
CREATE TRIGGER trg_unchained_commission_rules_guard
  BEFORE UPDATE ON public.unchained_commission_rules
  FOR EACH ROW EXECUTE FUNCTION public.unchained_commission_rules_guard();


-- ─── §3. Human-readable codes ─────────────────────────────────────────────
-- A representative and a client each get a short code that a person can say out
-- loud and type without ambiguity. UUIDs are correct and unsayable; these exist
-- for the phone call and the invoice, not for the join.
--
-- Immutable once issued, by trigger: a code that changed would be worse than no
-- code, because it would have been written down somewhere by then.

CREATE SEQUENCE IF NOT EXISTS public.unchained_commercial_code_seq AS BIGINT START 1;
CREATE SEQUENCE IF NOT EXISTS public.unchained_client_code_seq     AS BIGINT START 1;

ALTER TABLE public.commercial_contacts
  ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.unchained_clients
  ADD COLUMN IF NOT EXISTS code TEXT;

CREATE OR REPLACE FUNCTION public.unchained_assign_commercial_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'UB-C-' || lpad(nextval('public.unchained_commercial_code_seq')::TEXT, 4, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.unchained_assign_client_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.code IS NULL THEN
    NEW.code := 'UB-K-' || lpad(nextval('public.unchained_client_code_seq')::TEXT, 5, '0');
  END IF;
  RETURN NEW;
END;
$fn$;

CREATE OR REPLACE FUNCTION public.unchained_freeze_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF OLD.code IS NOT NULL AND NEW.code IS DISTINCT FROM OLD.code THEN
    RAISE EXCEPTION 'a code is issued once and cannot be changed'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

-- Backfill before the unique index, so existing rows get codes rather than
-- colliding on NULL — the index is partial, but a row with no code is a row
-- nobody can quote on the telephone.
UPDATE public.commercial_contacts
   SET code = 'UB-C-' || lpad(nextval('public.unchained_commercial_code_seq')::TEXT, 4, '0')
 WHERE code IS NULL;

UPDATE public.unchained_clients
   SET code = 'UB-K-' || lpad(nextval('public.unchained_client_code_seq')::TEXT, 5, '0')
 WHERE code IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_contacts_code_unique
  ON public.commercial_contacts (code) WHERE code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS unchained_clients_code_unique
  ON public.unchained_clients (code) WHERE code IS NOT NULL;

DROP TRIGGER IF EXISTS trg_commercial_contacts_code ON public.commercial_contacts;
CREATE TRIGGER trg_commercial_contacts_code
  BEFORE INSERT ON public.commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION public.unchained_assign_commercial_code();

DROP TRIGGER IF EXISTS trg_commercial_contacts_freeze_code ON public.commercial_contacts;
CREATE TRIGGER trg_commercial_contacts_freeze_code
  BEFORE UPDATE ON public.commercial_contacts
  FOR EACH ROW EXECUTE FUNCTION public.unchained_freeze_code();

DROP TRIGGER IF EXISTS trg_unchained_clients_code ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_code
  BEFORE INSERT ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_assign_client_code();

DROP TRIGGER IF EXISTS trg_unchained_clients_freeze_code ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_freeze_code
  BEFORE UPDATE ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_freeze_code();


-- ─── §4. The base-rate floor ──────────────────────────────────────────────
-- Phase 8 gave commission_rate DEFAULT 0 and said so explicitly: 0 meant "we
-- have not decided what this person earns", deliberately distinct from a NULL.
-- Every representative in this database is still sitting on that default, so
-- the floor could not be added as a constraint alone — it would have failed
-- against every existing row.
--
-- So the undecided rows are decided here, at the floor. Anybody who earns more
-- than the floor is configured from the panel afterwards; this file does not
-- write a named person's rate.
--
-- ─── The trigger has to be stood down for the backfill ────────────────────
-- Phase 8's unchained_guard_commission_rate() refuses any UPDATE that changes
-- commission_rate unless is_super_admin(). A migration runs with no auth.uid(),
-- so that check fails and the backfill would be REFUSED — the guard doing
-- exactly its job, against the one writer that should be allowed through. The
-- INSERT branch already tolerates a null caller for the same reason (the
-- invitation edge function); the UPDATE branch has no such arm, and widening it
-- would weaken the guard permanently for the sake of one statement.
--
-- Disabling the trigger around the backfill is the surgical alternative: it is
-- scoped to these two statements, it is visible, and the guard is back in force
-- three lines later.

DO $blk$
DECLARE
  v_floor   NUMERIC;
  v_changed INTEGER;
BEGIN
  SELECT base_floor INTO v_floor FROM public.unchained_commission_rules WHERE id;

  ALTER TABLE public.commercial_contacts DISABLE TRIGGER trg_commercial_contacts_guard_commission;

  UPDATE public.commercial_contacts
     SET commission_rate = v_floor
   WHERE commission_rate < v_floor;
  GET DIAGNOSTICS v_changed = ROW_COUNT;

  ALTER TABLE public.commercial_contacts ENABLE TRIGGER trg_commercial_contacts_guard_commission;

  RAISE NOTICE 'commission floor: % representative(s) moved to %', v_changed, v_floor;
END;
$blk$;

-- ─── The default has to move with the floor ───────────────────────────────
-- Phase 8 left commission_rate DEFAULT 0. With a floor of 0.20 in force, every
-- INSERT that does not name a rate would now fail the constraint — including
-- the create-unchained-member edge function, which is how representatives are
-- invited. The floor would have made it impossible to add a representative at
-- all, and the failure would have arrived as a check violation on a screen that
-- never mentions commission.
ALTER TABLE public.commercial_contacts
  ALTER COLUMN commission_rate SET DEFAULT 0.20;

-- ─── And the guard has to move with the default ───────────────────────────
-- Phase 8's guard reads "a non-super-admin may not INSERT a non-zero rate",
-- with zero standing in for "did not choose". Now that the default IS 0.20,
-- that test would refuse every ordinary manager adding a representative — the
-- default itself being read as a choice.
--
-- The intent is unchanged and is what gets restated: a non-super-admin may not
-- CHOOSE a rate. What "not choosing" evaluates to is now per-table, because
-- this one function guards two rosters and only one of them has a floor —
-- specialists still start at 0, and forcing them onto the commercial floor
-- would be a raise nobody granted.
CREATE OR REPLACE FUNCTION public.unchained_guard_commission_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
DECLARE
  v_default NUMERIC;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF TG_TABLE_NAME = 'commercial_contacts' THEN
      SELECT base_floor INTO v_default FROM public.unchained_commission_rules WHERE id;
    END IF;
    v_default := COALESCE(v_default, 0);

    IF COALESCE(NEW.commission_rate, v_default) <> v_default
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

DO $blk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.commercial_contacts'::regclass
       AND conname  = 'commercial_contacts_commission_floor'
  ) THEN
    -- Expressed against the rules table's default rather than a literal so the
    -- constraint and §2 cannot disagree. A CHECK cannot read another table, so
    -- the number is inlined at apply time; changing base_floor later does not
    -- move this constraint, and is not meant to — the floor on what may be
    -- CONFIGURED is a hiring rule, while base_floor is what the ladder starts
    -- from. They begin equal and are allowed to diverge.
    ALTER TABLE public.commercial_contacts
      ADD CONSTRAINT commercial_contacts_commission_floor
      CHECK (commission_rate >= 0.20);
  END IF;
END;
$blk$;


-- ─── §5. What a contract records about its own rate ───────────────────────
-- Phase 8 snapshots the rate and never explains it. With a ladder in play that
-- is no longer enough: six months from now somebody will ask why this contract
-- pays 2.5 % and the answer has to be on the row, not reconstructed by counting
-- what the client happened to have signed by then.

ALTER TABLE public.unchained_engagements
  ADD COLUMN IF NOT EXISTS deal_seq INTEGER;

ALTER TABLE public.unchained_engagements
  ADD COLUMN IF NOT EXISTS rate_ladder_step INTEGER;

ALTER TABLE public.unchained_engagements
  ADD COLUMN IF NOT EXISTS rate_basis TEXT;

ALTER TABLE public.unchained_engagements
  DROP CONSTRAINT IF EXISTS unchained_engagements_rate_basis_valid;
ALTER TABLE public.unchained_engagements
  ADD CONSTRAINT unchained_engagements_rate_basis_valid
  CHECK (rate_basis IS NULL OR rate_basis IN (
    -- The rate was typed for this contract. The ladder did not touch it.
    'negotiated',
    -- The representative's configured rate, with no ladder — the client's first
    -- deal, or a contract with no client to count deals for.
    'base',
    -- The representative's rate, halved once per previous deal.
    'ladder'
  ));

CREATE INDEX IF NOT EXISTS idx_unchained_engagements_deal
  ON public.unchained_engagements (client_id, deal_seq)
  WHERE client_id IS NOT NULL;


-- ─── §6. The ladder ───────────────────────────────────────────────────────
-- One BEFORE INSERT trigger doing two things that must not be split, because
-- the second depends on the first: which deal this engagement belongs to, and
-- therefore what it pays.
--
-- ─── Why one function and not two ─────────────────────────────────────────
-- PostgreSQL fires BEFORE triggers in alphabetical order by trigger name, which
-- is a fragile thing to hang money on — a later migration adding
-- `trg_unchained_engagements_b_something` would silently reorder them. Doing
-- both in one function removes the ordering question entirely.
--
-- ─── Why it must run BEFORE Phase 8's default-rate trigger ────────────────
-- That trigger fills commercial_rate from the representative's configured rate
-- when the caller left it NULL. Once it has run, "the caller named a rate" and
-- "the caller left it blank" look identical — and telling those apart is the
-- whole of Phase 8's §6 and the only way to honour a negotiated rate. So this
-- one runs first and reads the NULL while it still means something. Its name
-- begins `trg_unchained_engagements_commission`, and `com` sorts before the
-- `def` of `default_rate`; the verification block at the end asserts that the
-- ordering still holds rather than trusting the comment.

CREATE OR REPLACE FUNCTION public.unchained_engagement_deal_and_rate()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_rules   RECORD;
  v_last_at TIMESTAMPTZ;
  v_last_seq INTEGER;
  v_step    INTEGER;
  v_base    NUMERIC;
  v_rate    NUMERIC;
BEGIN
  -- A rate typed for this contract is a negotiation and is left alone. This is
  -- the same test Phase 8 makes, made here first — see the header.
  IF NEW.commercial_rate IS NOT NULL THEN
    NEW.rate_basis := 'negotiated';
  END IF;

  -- No client, no deals to count. Legacy rows and the "not in the register"
  -- escape hatch land here and behave exactly as they did before this file.
  IF NEW.client_id IS NULL THEN
    NEW.rate_basis := COALESCE(NEW.rate_basis, 'base');
    RETURN NEW;
  END IF;

  SELECT * INTO v_rules FROM public.unchained_commission_rules WHERE id;

  -- ── Which deal is this? ─────────────────────────────────────────────
  -- The most recent non-cancelled engagement of this client decides. Inside the
  -- window, this joins its deal; outside it, or with nothing before it, this
  -- starts a new one. Cancelled rows are skipped entirely: a deal that fell
  -- through neither holds the window open nor occupies a rung.
  SELECT e.created_at, e.deal_seq INTO v_last_at, v_last_seq
    FROM public.unchained_engagements e
   WHERE e.client_id = NEW.client_id
     AND e.status <> 'cancelled'
     AND e.deal_seq IS NOT NULL
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF NEW.deal_seq IS NOT NULL THEN
    -- The override: attaching this engagement to a deal the caller names,
    -- because the client asked on Friday and the row was typed on Monday.
    --
    -- Guarded, and not merely by who may insert. Every manager may record an
    -- engagement, so without this check any of them could pin deal_seq to 1 and
    -- collect the opening rate on a client's tenth contract. Setting the rung
    -- by hand is setting pay, and Phase 8 reserved that to one role.
    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'only a super administrator may place an engagement in a chosen deal'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  ELSIF v_last_seq IS NULL THEN
    NEW.deal_seq := 1;
  ELSIF now() - v_last_at <= v_rules.deal_window THEN
    NEW.deal_seq := v_last_seq;
  ELSE
    NEW.deal_seq := v_last_seq + 1;
  END IF;

  -- ── Which rung? ─────────────────────────────────────────────────────
  -- The number of EARLIER deals this client has that still have a
  -- non-cancelled engagement in them. Counting distinct deal numbers rather
  -- than rows is what makes three services in one negotiation one step.
  SELECT count(DISTINCT e.deal_seq) INTO v_step
    FROM public.unchained_engagements e
   WHERE e.client_id = NEW.client_id
     AND e.status <> 'cancelled'
     AND e.deal_seq IS NOT NULL
     AND e.deal_seq < NEW.deal_seq;

  NEW.rate_ladder_step := v_step;

  IF NEW.commercial_rate IS NOT NULL THEN
    -- Negotiated. The rung is still recorded, because "this was deal 4 and
    -- somebody agreed 8 % anyway" is exactly what an audit needs to see.
    RETURN NEW;
  END IF;

  SELECT c.commission_rate INTO v_base
    FROM public.commercial_contacts c WHERE c.id = NEW.commercial_id;
  v_base := COALESCE(v_base, 0);

  IF v_step = 0 THEN
    NEW.commercial_rate := v_base;
    NEW.rate_basis := 'base';
    RETURN NEW;
  END IF;

  v_rate := v_base * power(v_rules.step_factor, v_step);

  -- The floor never raises a rate. A representative configured below the floor
  -- — which §4 makes impossible going forward, but which a future edit to the
  -- rules table could reintroduce — keeps their own rate rather than being
  -- promoted onto the floor by a rule meant to reduce.
  NEW.commercial_rate := GREATEST(LEAST(v_rules.floor_rate, v_base), v_rate);
  -- NUMERIC(5,4) is what the column holds; rounding here rather than letting
  -- the cast do it keeps the stored number and the number the panel predicted
  -- from disagreeing on the fourth decimal.
  NEW.commercial_rate := round(NEW.commercial_rate, 4);
  NEW.rate_basis := 'ladder';

  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_commission ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_commission
  BEFORE INSERT ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagement_deal_and_rate();

-- The audit line, written AFTER the row exists so it can reference it. A BEFORE
-- trigger could not: unchained_client_events.engagement_id is a foreign key and
-- the engagement is not yet inserted when a BEFORE trigger runs.
--
-- Only when the ladder actually reduced something. A first deal at the full
-- rate is not an event; it is the absence of one.
CREATE OR REPLACE FUNCTION public.unchained_engagement_log_ladder()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND NEW.rate_basis = 'ladder'
     AND COALESCE(NEW.rate_ladder_step, 0) > 0 THEN
    PERFORM public.unchained_log_client_event(
      NEW.client_id, 'commission_reduced', NULL, NULL, NULL, NEW.title,
      jsonb_build_object(
        'deal_seq',   NEW.deal_seq,
        'step',       NEW.rate_ladder_step,
        'rate',       NEW.commercial_rate,
        'rate_basis', NEW.rate_basis
      ),
      NULL, NEW.id
    );
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_log_ladder ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_log_ladder
  AFTER INSERT ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagement_log_ladder();

-- The log learns the word.
ALTER TABLE public.unchained_client_events
  DROP CONSTRAINT IF EXISTS unchained_client_events_type_valid;
ALTER TABLE public.unchained_client_events
  ADD CONSTRAINT unchained_client_events_type_valid
  CHECK (event_type IN (
    'client_registered', 'registration_blocked', 'client_updated',
    'transfer_requested', 'transfer_approved', 'transfer_declined',
    'transfer_activated', 'transfer_rejected', 'transfer_cancelled',
    'note_added',
    'promoted_from_lead', 'status_changed', 'specialist_assigned',
    'specialist_unassigned', 'engagement_created',
    -- Phase 11
    'commission_reduced', 'transfer_override'
  ));


-- ─── §7. What the panel needs to know before it saves ─────────────────────
-- The rung this client's next engagement would land on, so the dialog can print
-- "trato 3 · 5 %" before anybody commits to it rather than after.
--
-- It re-derives the answer with the same rules the trigger uses. Two copies of
-- one calculation is a real risk and the reason this is a function rather than
-- arithmetic in the browser: there is one copy in SQL, and the browser asks.

CREATE OR REPLACE FUNCTION public.unchained_next_deal_rate(p_client_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_rules    RECORD;
  v_owner    UUID;
  v_base     NUMERIC;
  v_last_at  TIMESTAMPTZ;
  v_last_seq INTEGER;
  v_seq      INTEGER;
  v_step     INTEGER;
  v_rate     NUMERIC;
  v_joins    BOOLEAN := FALSE;
BEGIN
  IF (SELECT auth.uid()) IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT c.owner_commercial_id INTO v_owner
    FROM public.unchained_clients c WHERE c.id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF NOT public.unchained_client_visible(p_client_id, v_owner) THEN
    RAISE EXCEPTION 'not authorized to read this client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_rules FROM public.unchained_commission_rules WHERE id;

  SELECT c.commission_rate INTO v_base
    FROM public.commercial_contacts c WHERE c.id = v_owner;
  v_base := COALESCE(v_base, 0);

  SELECT e.created_at, e.deal_seq INTO v_last_at, v_last_seq
    FROM public.unchained_engagements e
   WHERE e.client_id = p_client_id
     AND e.status <> 'cancelled'
     AND e.deal_seq IS NOT NULL
   ORDER BY e.created_at DESC
   LIMIT 1;

  IF v_last_seq IS NULL THEN
    v_seq := 1;
  ELSIF now() - v_last_at <= v_rules.deal_window THEN
    v_seq  := v_last_seq;
    v_joins := TRUE;
  ELSE
    v_seq := v_last_seq + 1;
  END IF;

  SELECT count(DISTINCT e.deal_seq) INTO v_step
    FROM public.unchained_engagements e
   WHERE e.client_id = p_client_id
     AND e.status <> 'cancelled'
     AND e.deal_seq IS NOT NULL
     AND e.deal_seq < v_seq;

  IF v_step = 0 THEN
    v_rate := v_base;
  ELSE
    v_rate := round(
      GREATEST(LEAST(v_rules.floor_rate, v_base), v_base * power(v_rules.step_factor, v_step)),
      4);
  END IF;

  RETURN jsonb_build_object(
    'deal_seq',   v_seq,
    'step',       v_step,
    'base_rate',  v_base,
    'rate',       v_rate,
    -- TRUE when this would join the deal already open, which is the sentence
    -- the dialog needs: "se suma al trato de hoy" rather than "empieza el
    -- trato 3".
    'joins_open_deal', v_joins,
    'window_closes_at',
      CASE WHEN v_joins THEN v_last_at + v_rules.deal_window ELSE NULL END,
    'at_floor',   v_step > 0 AND v_rate <= LEAST(v_rules.floor_rate, v_base)
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_next_deal_rate(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_next_deal_rate(UUID) TO authenticated;


-- ─── §8. Transfers close when the work starts ─────────────────────────────
-- A client moves representative because the CLIENT asked, and that happens
-- before there is any work. Once a contract exists, the relationship has been
-- paid for and moving it moves somebody's earned commission.
--
-- Until now that was a convention. This module's standing position is that a
-- rule nobody enforces is a rule that holds exactly as long as everybody
-- remembers it, so it is enforced — with a door for the real exception, held
-- open by a super administrator who has to say why. The reason is not optional
-- and is not free text nobody reads: it lands in the client's timeline as a
-- transfer_override event, next to the transfer it explains.

CREATE OR REPLACE FUNCTION public.unchained_request_client_transfer(
  p_client_id        UUID,
  p_to_commercial_id UUID,
  p_reason           TEXT DEFAULT NULL,
  -- Super administrators only. Supplying it is what unlocks a transfer for a
  -- client who already has work; supplying it without the privilege is refused
  -- rather than ignored.
  p_override_reason  TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor      UUID := (SELECT auth.uid());
  v_mine       UUID := public.my_commercial_contact_id();
  v_is_manager BOOLEAN := public.unchained_manages_leads();
  v_owner      UUID;
  v_client     TEXT;
  v_to_name    TEXT;
  v_from_name  TEXT;
  v_to_user    UUID;
  v_reason     TEXT := NULLIF(btrim(COALESCE(p_reason, '')), '');
  v_override   TEXT := NULLIF(btrim(COALESCE(p_override_reason, '')), '');
  v_contracts  INTEGER;
  v_self       BOOLEAN;
  v_status     TEXT;
  v_transfer   UUID;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT c.owner_commercial_id, c.name INTO v_owner, v_client
    FROM public.unchained_clients c WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  v_self := v_mine IS NOT NULL AND v_mine = p_to_commercial_id;

  IF NOT (v_self OR v_is_manager) THEN
    RAISE EXCEPTION 'only the chosen commercial or an administrator can record this choice'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF p_to_commercial_id IS NULL THEN
    RAISE EXCEPTION 'a transfer needs a commercial to move the client to'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF p_to_commercial_id = v_owner THEN
    RAISE EXCEPTION 'that commercial already owns this client'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- ── The new gate ────────────────────────────────────────────────────
  SELECT count(*) INTO v_contracts
    FROM public.unchained_engagements e
   WHERE e.client_id = p_client_id
     AND e.status <> 'cancelled';

  IF v_contracts > 0 THEN
    IF v_override IS NULL THEN
      RAISE EXCEPTION
        'this client already has work; only a super administrator can move them, with a reason'
        USING ERRCODE = 'invalid_parameter_value';
    END IF;

    IF NOT public.is_super_admin() THEN
      RAISE EXCEPTION 'only a super administrator can move a client who already has work'
        USING ERRCODE = 'insufficient_privilege';
    END IF;

    IF length(v_override) < 10 THEN
      RAISE EXCEPTION 'the reason for moving a client with work must say something (10 characters or more)'
        USING ERRCODE = 'check_violation';
    END IF;
  ELSIF v_override IS NOT NULL AND NOT public.is_super_admin() THEN
    -- Nothing to override, and not entitled to. Refused rather than dropped:
    -- silently ignoring a privileged parameter teaches the caller it worked.
    RAISE EXCEPTION 'only a super administrator may pass an override reason'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT c.name, c.user_id INTO v_to_name, v_to_user
    FROM public.commercial_contacts c WHERE c.id = p_to_commercial_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown commercial' USING ERRCODE = 'foreign_key_violation';
  END IF;

  SELECT c.name INTO v_from_name FROM public.commercial_contacts c WHERE c.id = v_owner;

  IF v_reason IS NOT NULL AND length(v_reason) > 1000 THEN
    RAISE EXCEPTION 'a reason may be at most 1000 characters' USING ERRCODE = 'check_violation';
  END IF;

  IF EXISTS (
       SELECT 1 FROM public.unchained_client_transfers t
        WHERE t.client_id = p_client_id
          AND t.status IN ('pending_commercial', 'pending_admin')
     ) THEN
    RAISE EXCEPTION 'this client already has a transfer waiting'
      USING ERRCODE = 'unique_violation';
  END IF;

  v_status := CASE WHEN v_self THEN 'pending_admin' ELSE 'pending_commercial' END;

  INSERT INTO public.unchained_client_transfers (
    client_id, from_commercial_id, to_commercial_id, status, reason,
    requested_by, approved_at, approved_by
  ) VALUES (
    p_client_id, v_owner, p_to_commercial_id, v_status, v_reason,
    v_actor,
    CASE WHEN v_self THEN now() ELSE NULL END,
    CASE WHEN v_self THEN v_actor ELSE NULL END
  )
  RETURNING id INTO v_transfer;

  PERFORM public.unchained_log_client_event(
    p_client_id, 'transfer_requested', v_transfer, v_owner, p_to_commercial_id, v_reason,
    jsonb_build_object('self_requested', v_self)
  );

  -- The override is its own line in the log, not a field on the transfer: the
  -- question it answers — who allowed this and on what grounds — is asked of
  -- the timeline, and a reader scrolling the client's history has to meet it
  -- without knowing to look for a column.
  IF v_override IS NOT NULL THEN
    PERFORM public.unchained_log_client_event(
      p_client_id, 'transfer_override', v_transfer, v_owner, p_to_commercial_id, v_override,
      jsonb_build_object('contracts', v_contracts)
    );
  END IF;

  IF v_self THEN
    PERFORM public.unchained_log_client_event(
      p_client_id, 'transfer_approved', v_transfer, v_owner, p_to_commercial_id, NULL,
      jsonb_build_object('implied_by_request', TRUE)
    );
  ELSE
    PERFORM public.unchained_notify(
      v_to_user, 'transfer_awaiting_your_approval', p_client_id, v_transfer,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    );
  END IF;

  IF v_status = 'pending_admin' THEN
    PERFORM public.unchained_notify(
      a.user_id, 'transfer_awaiting_activation', p_client_id, v_transfer,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    )
    FROM public.unchained_admin_user_ids() a;
  END IF;

  RETURN jsonb_build_object(
    'success', TRUE, 'transfer_id', v_transfer, 'status', v_status,
    'overridden', v_override IS NOT NULL
  );
END;
$fn$;

-- Phase 9's three-argument version would otherwise remain as an overload, and
-- every existing three-argument call would then match both candidates and fail
-- "function is not unique". Same hazard, same remedy, as Phase 10's log writer.
DROP FUNCTION IF EXISTS public.unchained_request_client_transfer(UUID, UUID, TEXT);

REVOKE ALL ON FUNCTION public.unchained_request_client_transfer(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_request_client_transfer(UUID, UUID, TEXT, TEXT)
  TO authenticated;


-- ─── §8b. The register carries the codes ──────────────────────────────────
-- Restated in full, and DROPped first, because RETURNS TABLE grows by two
-- columns and CREATE OR REPLACE cannot change a return type. Everything below
-- is Phase 10's function with `code` and `owner_code` appended; the body is
-- otherwise untouched, and the two new columns sit at the end so a caller
-- selecting by name is unaffected.

DROP FUNCTION IF EXISTS public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER, TEXT);

CREATE FUNCTION public.unchained_client_list(
  p_scope  TEXT    DEFAULT 'mine',
  p_search TEXT    DEFAULT NULL,
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0,
  p_status TEXT    DEFAULT NULL
)
RETURNS TABLE (
  id                    UUID,
  name                  TEXT,
  company_name          TEXT,
  email                 TEXT,
  phone                 TEXT,
  country_code          TEXT,
  language              TEXT,
  service_interest      TEXT,
  notes                 TEXT,
  lead_id               UUID,
  owner_commercial_id   UUID,
  owner_name            TEXT,
  claimed_at            TIMESTAMPTZ,
  registered_at         TIMESTAMPTZ,
  registered_by_commercial_id UUID,
  registered_by_name    TEXT,
  is_mine               BOOLEAN,
  open_transfer_id      UUID,
  open_transfer_status  TEXT,
  open_transfer_to_id   UUID,
  open_transfer_to_name TEXT,
  status                TEXT,
  status_changed_at     TIMESTAMPTZ,
  specialists           JSONB,
  engagement_count      BIGINT,
  open_engagement_count BIGINT,
  total_count           BIGINT,
  -- ── Phase 11 ──────────────────────────────────────────────────────────
  code                  TEXT,
  owner_code            TEXT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  WITH visible AS (
    SELECT c.*
      FROM public.unchained_clients c
     WHERE public.unchained_client_visible(c.id, c.owner_commercial_id)
       AND (
             p_scope = 'all'
             OR (p_scope = 'mine' AND c.owner_commercial_id = public.my_commercial_contact_id())
             OR (
                  p_scope = 'incoming'
                  AND EXISTS (
                        SELECT 1 FROM public.unchained_client_transfers x
                         WHERE x.client_id        = c.id
                           AND x.to_commercial_id = public.my_commercial_contact_id()
                           AND x.status IN ('pending_commercial', 'pending_admin')
                      )
                )
             OR (
                  p_scope = 'assigned'
                  AND EXISTS (
                        SELECT 1 FROM public.unchained_client_specialists a
                         WHERE a.client_id     = c.id
                           AND a.specialist_id = public.my_specialist_id()
                           AND a.active
                      )
                )
           )
       AND (p_status IS NULL OR c.status = p_status)
       AND (
             p_search IS NULL OR btrim(p_search) = ''
             OR c.name         ILIKE '%' || btrim(p_search) || '%'
             OR c.company_name ILIKE '%' || btrim(p_search) || '%'
             OR c.email        ILIKE '%' || btrim(p_search) || '%'
             OR c.phone        ILIKE '%' || btrim(p_search) || '%'
             -- The code is searchable, which is most of the point of having one:
             -- somebody reads it off an invoice and types it in.
             OR c.code         ILIKE '%' || btrim(p_search) || '%'
           )
  ),
  counted AS (SELECT count(*) AS total FROM visible)
  SELECT v.id, v.name, v.company_name, v.email, v.phone,
         v.country_code, v.language, v.service_interest, v.notes, v.lead_id,
         v.owner_commercial_id,
         (SELECT o.name FROM public.commercial_contacts o WHERE o.id = v.owner_commercial_id),
         v.claimed_at, v.registered_at, v.registered_by_commercial_id,
         (SELECT r.name FROM public.commercial_contacts r WHERE r.id = v.registered_by_commercial_id),
         COALESCE(v.owner_commercial_id = public.my_commercial_contact_id(), FALSE),
         t.id, t.status, t.to_commercial_id,
         (SELECT w.name FROM public.commercial_contacts w WHERE w.id = t.to_commercial_id),
         v.status, v.status_changed_at,
         COALESCE(
           (SELECT jsonb_agg(jsonb_build_object(
                      'specialist_id', a.specialist_id,
                      'name',          s.name,
                      'specialty',     s.specialty,
                      'role',          a.role,
                      'assigned_at',   a.assigned_at)
                   ORDER BY s.name)
              FROM public.unchained_client_specialists a
              JOIN public.unchained_specialists s ON s.id = a.specialist_id
             WHERE a.client_id = v.id AND a.active),
           '[]'::JSONB),
         -- Cancelled contracts are excluded, which is a CHANGE from Phase 10.
         -- This number now means what every rule in the module means by "does
         -- this client have work": the ladder counts non-cancelled deals, and
         -- §8's transfer gate counts non-cancelled contracts. A count that
         -- included cancellations would have the panel warn "this client has a
         -- contract" about a deal that fell through, and block a transfer the
         -- database would have allowed.
         (SELECT count(*) FROM public.unchained_engagements e
           WHERE e.client_id = v.id AND e.status <> 'cancelled'),
         (SELECT count(*) FROM public.unchained_engagements e
           WHERE e.client_id = v.id AND e.status IN ('proposal', 'active', 'delivered')),
         counted.total,
         v.code,
         (SELECT o.code FROM public.commercial_contacts o WHERE o.id = v.owner_commercial_id)
    FROM visible v
    CROSS JOIN counted
    LEFT JOIN LATERAL (
      SELECT x.id, x.status, x.to_commercial_id
        FROM public.unchained_client_transfers x
       WHERE x.client_id = v.id
         AND x.status IN ('pending_commercial', 'pending_admin')
       LIMIT 1
    ) t ON TRUE
   ORDER BY v.registered_at DESC, v.id DESC
   LIMIT  GREATEST(LEAST(COALESCE(p_limit, 50), 200), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$fn$;

REVOKE ALL ON FUNCTION public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER, TEXT)
  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER, TEXT)
  TO authenticated;


-- ─── §9. Privileges ───────────────────────────────────────────────────────

ALTER TABLE public.unchained_commission_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_commission_rules_read ON public.unchained_commission_rules;
CREATE POLICY unchained_commission_rules_read ON public.unchained_commission_rules
  FOR SELECT USING (public.unchained_manages_leads());

DROP POLICY IF EXISTS unchained_commission_rules_write ON public.unchained_commission_rules;
CREATE POLICY unchained_commission_rules_write ON public.unchained_commission_rules
  FOR UPDATE USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

REVOKE ALL ON TABLE public.unchained_commission_rules FROM anon, authenticated;
GRANT SELECT, UPDATE ON TABLE public.unchained_commission_rules TO authenticated;

REVOKE ALL ON FUNCTION public.unchained_engagement_deal_and_rate() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_engagement_log_ladder() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_assign_commercial_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_assign_client_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_commission_rules_guard() FROM PUBLIC, anon, authenticated;


-- ─── §10. Apply-time verification ─────────────────────────────────────────

-- The trigger ordering the ladder depends on. Asserted rather than commented:
-- a later migration adding a BEFORE INSERT trigger whose name sorts between
-- these two would silently break the negotiated-rate rule.
DO $$
DECLARE
  v_commission TEXT;
  v_default    TEXT;
BEGIN
  SELECT tgname INTO v_commission FROM pg_trigger
   WHERE tgrelid = 'public.unchained_engagements'::regclass
     AND tgname = 'trg_unchained_engagements_commission';
  SELECT tgname INTO v_default FROM pg_trigger
   WHERE tgrelid = 'public.unchained_engagements'::regclass
     AND tgname = 'trg_unchained_engagements_default_rate';

  IF v_commission IS NULL THEN
    RAISE EXCEPTION 'the commission trigger is missing';
  END IF;
  IF v_default IS NOT NULL AND v_commission >= v_default THEN
    RAISE EXCEPTION
      'trigger order broken: % must sort before % or a negotiated rate cannot be told from a default',
      v_commission, v_default;
  END IF;
END;
$$;

-- The three new trigger functions write tables their caller cannot, or call
-- functions revoked from every client role. Without SECURITY DEFINER they do
-- not error — RLS filters rows rather than refusing — they silently do nothing.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT p.proname FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('unchained_engagement_deal_and_rate',
                         'unchained_engagement_log_ladder',
                         'unchained_assign_commercial_code',
                         'unchained_assign_client_code')
       AND NOT p.prosecdef
  LOOP
    RAISE EXCEPTION '%() must be SECURITY DEFINER or it will silently do nothing', v_name;
  END LOOP;
END;
$$;

-- The floor, the default and the guard have to agree, or adding a
-- representative breaks in a way whose error message never mentions commission.
DO $$
DECLARE
  v_default TEXT;
  v_floor   NUMERIC;
BEGIN
  SELECT column_default INTO v_default
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'commercial_contacts'
     AND column_name = 'commission_rate';

  SELECT base_floor INTO v_floor FROM public.unchained_commission_rules WHERE id;

  IF v_default IS NULL OR (v_default::NUMERIC) < v_floor THEN
    RAISE EXCEPTION
      'commission_rate defaults to % but the floor is % — every insert that omits a rate would fail',
      COALESCE(v_default, 'NULL'), v_floor;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.commercial_contacts'::regclass
       AND conname  = 'commercial_contacts_commission_floor'
  ) THEN
    RAISE EXCEPTION 'the commission floor constraint is missing';
  END IF;

  IF EXISTS (SELECT 1 FROM public.commercial_contacts WHERE commission_rate < v_floor) THEN
    RAISE EXCEPTION 'a representative is still below the floor — the backfill did not take';
  END IF;
END;
$$;

-- anon reaches nothing new.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  IF has_table_privilege('anon', 'public.unchained_commission_rules', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still select the commission rules';
  END IF;

  FOR v_name IN
    SELECT p.oid::regprocedure::TEXT FROM pg_proc p
     WHERE p.pronamespace = 'public'::regnamespace
       AND p.proname IN ('unchained_next_deal_rate', 'unchained_request_client_transfer',
                         'unchained_engagement_deal_and_rate', 'unchained_engagement_log_ladder')
  LOOP
    IF has_function_privilege('anon', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute %', v_name;
    END IF;
  END LOOP;
END;
$$;

-- The ladder itself, on data this block creates and removes. Asserting the
-- trigger exists would not catch arithmetic that is wrong, and the arithmetic
-- is the entire file.
DO $$
DECLARE
  v_commercial UUID;
  v_client     UUID;
  v_e1 UUID; v_e2 UUID; v_e3 UUID; v_e4 UUID;
  v_r1 NUMERIC; v_r2 NUMERIC; v_r3 NUMERIC; v_r4 NUMERIC;
  v_s1 INTEGER; v_s3 INTEGER;
BEGIN
  SELECT id INTO v_commercial FROM public.commercial_contacts LIMIT 1;
  IF v_commercial IS NULL THEN
    RAISE NOTICE 'no commercial_contacts row; skipping the ladder probe';
    RETURN;
  END IF;

  -- A previous failed run would have left these holding the email identity key.
  DELETE FROM public.unchained_engagements
   WHERE client_id IN (SELECT id FROM public.unchained_clients
                        WHERE email = '__ladder__@example.invalid');
  DELETE FROM public.unchained_clients WHERE email = '__ladder__@example.invalid';

  INSERT INTO public.unchained_clients
    (name, email, owner_commercial_id, registered_by_commercial_id)
  VALUES ('__ladder__', '__ladder__@example.invalid', v_commercial, v_commercial)
  RETURNING id INTO v_client;

  -- Two engagements moments apart: one deal, both at the base rate. This is the
  -- "client asked for three services at once" rule.
  INSERT INTO public.unchained_engagements (client_id, client_name, title, commercial_id)
       VALUES (v_client, '', '__probe_a__', v_commercial) RETURNING id INTO v_e1;
  INSERT INTO public.unchained_engagements (client_id, client_name, title, commercial_id)
       VALUES (v_client, '', '__probe_b__', v_commercial) RETURNING id INTO v_e2;

  SELECT commercial_rate, deal_seq INTO v_r1, v_s1
    FROM public.unchained_engagements WHERE id = v_e1;
  SELECT commercial_rate INTO v_r2 FROM public.unchained_engagements WHERE id = v_e2;

  IF v_r1 <> v_r2 THEN
    RAISE EXCEPTION 'two engagements in one deal took different rates (% vs %)', v_r1, v_r2;
  END IF;

  -- Push the first deal out of the window, so the next one is a new deal.
  UPDATE public.unchained_engagements
     SET created_at = now() - INTERVAL '10 days' WHERE id IN (v_e1, v_e2);

  INSERT INTO public.unchained_engagements (client_id, client_name, title, commercial_id)
       VALUES (v_client, '', '__probe_c__', v_commercial) RETURNING id INTO v_e3;

  SELECT commercial_rate, deal_seq INTO v_r3, v_s3
    FROM public.unchained_engagements WHERE id = v_e3;

  IF v_s3 <= v_s1 THEN
    RAISE EXCEPTION 'a deal outside the window did not advance (% then %)', v_s1, v_s3;
  END IF;

  IF v_r1 > 0 AND v_r3 >= v_r1 THEN
    RAISE EXCEPTION 'the second deal was not reduced (% then %)', v_r1, v_r3;
  END IF;

  -- A named rate must survive the ladder untouched.
  INSERT INTO public.unchained_engagements
    (client_id, client_name, title, commercial_id, commercial_rate)
  VALUES (v_client, '', '__probe_d__', v_commercial, 0.3333) RETURNING id INTO v_e4;

  SELECT commercial_rate INTO v_r4 FROM public.unchained_engagements WHERE id = v_e4;
  IF v_r4 <> 0.3333 THEN
    RAISE EXCEPTION 'the ladder overwrote a negotiated rate (got %)', v_r4;
  END IF;

  IF (SELECT rate_basis FROM public.unchained_engagements WHERE id = v_e4) <> 'negotiated' THEN
    RAISE EXCEPTION 'a negotiated rate was not recorded as such';
  END IF;

  -- unchained_client_events is append-only by trigger, and the probe wrote a
  -- commission_reduced row into it. Deleting the client would CASCADE into that
  -- table and be refused, so the guard is stood down for the cleanup exactly as
  -- §4 stands down the commission guard for its backfill — narrowly, visibly,
  -- and back in force two statements later.
  ALTER TABLE public.unchained_client_events DISABLE TRIGGER trg_unchained_client_events_append_only;
  DELETE FROM public.unchained_client_events WHERE client_id = v_client;
  ALTER TABLE public.unchained_client_events ENABLE TRIGGER trg_unchained_client_events_append_only;

  DELETE FROM public.unchained_engagements WHERE client_id = v_client;
  DELETE FROM public.unchained_clients WHERE id = v_client;
END;
$$;

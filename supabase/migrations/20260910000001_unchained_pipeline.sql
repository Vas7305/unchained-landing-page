-- ════════════════════════════════════════════════════════════
-- Phase 10 — Unchained Business: the pipeline spine
-- ════════════════════════════════════════════════════════════
-- Phases 7, 8 and 9 each built a working tram. This file makes them one line.
--
-- ─── What was actually wrong ──────────────────────────────────────────────
-- Nothing in Phases 7-9 was broken on its own terms. What was missing was every
-- join between them, so a single client walking end to end left FOUR unrelated
-- rows behind, related only by somebody having typed the same name four times:
--
--     unchained_leads          (the website inquiry)
--     unchained_clients        (the commercial's register)
--     unchained_engagements    (the contract — client_name TEXT, no client_id)
--     unchained_engagement_specialists  (who delivers it)
--
-- Three consequences, and this file removes all three:
--
--   1. Winning a lead produced no client. The register and the pipeline were
--      two chronologies of one relationship. §10 gives the promotion.
--   2. A contract could not name the client it was for. §4 gives it client_id,
--      and §6 stops the two from ever disagreeing about the name.
--   3. A specialist could only be attached to a CONTRACT, so "assign this
--      client to María" required inventing a fee, a title and a currency
--      first. §3 and §8 make the assignment a fact about the client.
--
-- ─── The pipeline this file produces ──────────────────────────────────────
--
--   ENTRADA A                 ENTRADA B
--   website                   comercial
--      │                          │
--      ▼                          │
--   create_public_lead            │
--      │                          │
--   unchained_leads               │
--      │ status = won            │
--      ▼                          ▼
--   unchained_promote_lead_to_client ──►  unchained_clients  ◄── unchained_register_client
--                                              │  status: prospect
--                                              │
--                          unchained_assign_client_specialist
--                                              │
--                                    unchained_client_specialists
--                                              │
--                                  unchained_create_engagement
--                                              │  (siembra los especialistas)
--                                              ▼
--                                   unchained_engagements
--                                     proposal ─► active ─► delivered ─► paid
--                                         └──────────┴──────────┴──► cancelled
--
--   SALIDAS ASEGURADAS
--     lead      won (terminal) · lost (reabrible a contacted) · nurture
--     cliente   archived (reabrible a prospect) · dormant
--     contrato  paid (terminal) · cancelled (terminal)
--
-- ─── Scope, and what is NOT touched ───────────────────────────────────────
-- Additive except for four deliberate, named replacements:
--
--   · unchained_clients gains `status` (§2) — a column, not a rewrite.
--   · unchained_client_events gains `specialist_id` and five event types (§5).
--     The type CHECK is dropped and re-added because a CHECK cannot be widened
--     in place; every pre-existing type is carried over unchanged.
--   · unchained_client_visible() gains a fourth arm (§12) — an assigned
--     specialist can see the client they were assigned to. It could not
--     otherwise, and an assignment to a record you cannot open is not one.
--   · unchained_client_list() is DROPped and recreated (§13) because its
--     RETURNS TABLE grows. CREATE OR REPLACE cannot change a return type. The
--     added columns are appended, so an existing caller reading by name is
--     unaffected.
--
-- Table privileges on unchained_engagements are LEFT ALONE on purpose. The
-- admin panel inserts and updates that table directly through PostgREST, under
-- the unchained_engagements_manage policy, and revoking those grants in favour
-- of §11's RPC would break a working screen to enforce a tidiness nobody asked
-- for. §6's trigger is what makes the direct path safe: it holds regardless of
-- which door the write came through, which is the property an RPC alone could
-- never have given.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- Requires 20260909000001 (the client register). Paste into the Studio SQL
-- editor of the UNCHAINED project. Re-runnable; the verification block at the
-- end fails the whole migration rather than leaving a half-wired pipeline.


-- ─── §2. The client's own lifecycle ───────────────────────────────────────
-- Phase 9 gave a client an entrance and no exit. A row appeared when a
-- commercial registered it and then stayed, indistinguishable forever from one
-- signed last week — so "how many clients do we have" had no answerable form,
-- and a relationship that ended had nowhere to say so.
--
--   prospect ──► active ──► dormant ──► active
--       │           │           │
--       └───────────┴───────────┴──► archived ──► prospect   (reabierto)
--
--   prospect   registered, no contract has been signed yet
--   active     there is work: an engagement of theirs reached 'active'
--   dormant    they were a client, nothing is open right now
--   archived   the relationship is over
--
-- ─── Why `active` is written by the database and `dormant` is not ─────────
-- The move INTO active is a fact — an engagement started, and §7's trigger
-- writes it. The move OUT is a judgement: a client with no open contract this
-- month is not necessarily dormant, and a database that decided that on its own
-- would be marking healthy accounts cold on a technicality. So the exits are
-- deliberate, taken by a person through §9, and §13's overview surfaces the
-- candidates rather than acting on them.
--
-- `archived` is reopenable to `prospect` and to nothing else. A relationship
-- that restarts starts at the beginning; jumping straight back to `active`
-- would claim work that has not been signed.

ALTER TABLE public.unchained_clients
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'prospect';

ALTER TABLE public.unchained_clients
  ADD COLUMN IF NOT EXISTS status_changed_at TIMESTAMPTZ NOT NULL DEFAULT now();

ALTER TABLE public.unchained_clients
  DROP CONSTRAINT IF EXISTS unchained_clients_status_valid;
ALTER TABLE public.unchained_clients
  ADD CONSTRAINT unchained_clients_status_valid
  CHECK (status IN ('prospect', 'active', 'dormant', 'archived'));

CREATE INDEX IF NOT EXISTS idx_unchained_clients_status
  ON public.unchained_clients (status, registered_at DESC);

CREATE OR REPLACE FUNCTION public.unchained_client_transition_allowed(
  p_from TEXT,
  p_to   TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE p_from
    WHEN 'prospect' THEN p_to IN ('active', 'archived')
    WHEN 'active'   THEN p_to IN ('dormant', 'archived')
    WHEN 'dormant'  THEN p_to IN ('active', 'archived')
    WHEN 'archived' THEN p_to = 'prospect'
    ELSE FALSE
  END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_client_transition_allowed(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_client_transition_allowed(TEXT, TEXT) TO authenticated;

-- The machine, enforced on every UPDATE regardless of which code path issued
-- it — the same reason Phase 7 put the lead machine in a trigger rather than in
-- its RPC. §9 is the door; this is the wall.
CREATE OR REPLACE FUNCTION public.unchained_clients_status_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.unchained_client_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION 'unchained_clients: % is not a permitted transition from %',
        NEW.status, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;
    NEW.status_changed_at := now();
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_clients_status_guard ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_status_guard
  BEFORE UPDATE ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_clients_status_guard();


-- ─── §3. unchained_client_specialists ─────────────────────────────────────
-- Who attends this client.
--
-- ─── Why this is not the same table as engagement_specialists ─────────────
-- They answer two different questions and only one of them involves money:
--
--   unchained_client_specialists       who is RESPONSIBLE for this client.
--                                      A relationship. No rate, because nobody
--                                      is paid for being assigned — they are
--                                      paid for delivering an engagement.
--
--   unchained_engagement_specialists   who DELIVERS this contract, and at what
--                                      share of its fee. Unchanged by this
--                                      file, and still what unchained_my_earnings
--                                      sums.
--
-- The two cannot drift into two answers because §11 SEEDS the second from the
-- first: creating an engagement for a client assigns that client's active
-- specialists to it automatically, each at their own default rate. The roster
-- is the intent; the engagement rows are that intent priced.
--
-- ─── Why a table and not a column ─────────────────────────────────────────
-- One client can need a designer and a backend engineer at once, and a client
-- who changes specialist must leave the previous assignment legible. A column
-- would make the first impossible and overwrite the second.
--
-- No ON DELETE on specialist_id, for the reason Phase 8 gave: a specialist who
-- has attended a client is deactivated, never deleted.

CREATE TABLE IF NOT EXISTS public.unchained_client_specialists (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id     UUID NOT NULL REFERENCES public.unchained_clients(id) ON DELETE CASCADE,
  specialist_id UUID NOT NULL REFERENCES public.unchained_specialists(id),

  -- Free text, like unchained_specialists.specialty: "Cuenta principal",
  -- "Soporte", "Diseño". A closed enum would need a migration every time the
  -- company invents a way of dividing responsibility.
  role          TEXT,

  active        BOOLEAN NOT NULL DEFAULT TRUE,

  assigned_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  unassigned_at TIMESTAMPTZ,
  note          TEXT,

  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_client_specialists_role_length
    CHECK (role IS NULL OR length(btrim(role)) BETWEEN 1 AND 80),
  CONSTRAINT unchained_client_specialists_note_length
    CHECK (note IS NULL OR length(btrim(note)) BETWEEN 1 AND 1000),

  -- The flag and the timestamp must agree, for the same reason every status in
  -- this module carries that constraint: a row claiming to be unassigned at no
  -- particular moment is a row nobody can put on a timeline.
  CONSTRAINT unchained_client_specialists_active_agrees
    CHECK (active = (unassigned_at IS NULL)),
  CONSTRAINT unchained_client_specialists_order
    CHECK (unassigned_at IS NULL OR unassigned_at >= assigned_at)
);

-- One ACTIVE assignment per pair. Re-assigning somebody who is already on the
-- client is not a second assignment, and two rows would make "is María on this
-- account" a question with two answers. Historical rows are unconstrained, so
-- assign → unassign → assign again is a legible three-row history.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_client_specialists_active_unique
  ON public.unchained_client_specialists (client_id, specialist_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS idx_unchained_client_specialists_client
  ON public.unchained_client_specialists (client_id, active);

-- The specialist's own screen: "which clients am I attending".
CREATE INDEX IF NOT EXISTS idx_unchained_client_specialists_specialist
  ON public.unchained_client_specialists (specialist_id, active);

DROP TRIGGER IF EXISTS trg_unchained_client_specialists_updated_at
  ON public.unchained_client_specialists;
CREATE TRIGGER trg_unchained_client_specialists_updated_at
  BEFORE UPDATE ON public.unchained_client_specialists
  FOR EACH ROW EXECUTE FUNCTION public.unchained_touch_updated_at();


-- ─── §4. The missing spine link ───────────────────────────────────────────
-- unchained_engagements.client_id.
--
-- Nullable, and it has to be: every engagement already in the table was created
-- before unchained_clients existed and has no client to point at. A NOT NULL
-- here would fail the migration on any live database. What §11 guarantees is
-- that every engagement created FROM NOW ON through the guided path has one,
-- and §13's overview counts the ones that do not so the backlog is visible
-- rather than silent.
--
-- No ON DELETE clause, the module's standing answer: clients are archived, not
-- deleted, and NO ACTION is correct if that ever changes.

ALTER TABLE public.unchained_engagements
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES public.unchained_clients(id);

CREATE INDEX IF NOT EXISTS idx_unchained_engagements_client
  ON public.unchained_engagements (client_id, status, created_at DESC)
  WHERE client_id IS NOT NULL;


-- ─── §5. The log learns five new words ────────────────────────────────────
-- unchained_client_events is still the one chronology of everything that
-- happens to a client, so the operations this file adds have to be sayable in
-- it. A CHECK constraint cannot be widened in place, so it is dropped and
-- re-added with every pre-existing type carried over verbatim.
--
-- `specialist_id` is a real column rather than a key in `detail` because Phase
-- 9 was explicit that nothing may branch on `detail` — the moment a policy or a
-- screen reads a value out of it, it stops being a log and becomes schema with
-- no constraints. A specialist on an event is something the timeline renders
-- and the overview counts, so it gets a column and a foreign key.

ALTER TABLE public.unchained_client_events
  ADD COLUMN IF NOT EXISTS specialist_id UUID REFERENCES public.unchained_specialists(id);

ALTER TABLE public.unchained_client_events
  ADD COLUMN IF NOT EXISTS engagement_id UUID REFERENCES public.unchained_engagements(id) ON DELETE SET NULL;

ALTER TABLE public.unchained_client_events
  DROP CONSTRAINT IF EXISTS unchained_client_events_type_valid;
ALTER TABLE public.unchained_client_events
  ADD CONSTRAINT unchained_client_events_type_valid
  CHECK (event_type IN (
    -- Phase 9, unchanged
    'client_registered',
    'registration_blocked',
    'client_updated',
    'transfer_requested',
    'transfer_approved',
    'transfer_declined',
    'transfer_activated',
    'transfer_rejected',
    'transfer_cancelled',
    'note_added',
    -- Phase 10
    'promoted_from_lead',
    'status_changed',
    'specialist_assigned',
    'specialist_unassigned',
    'engagement_created'
  ));

-- The payload rule gains the same three arms. Everything Phase 9 asserted is
-- carried over unchanged; the new types state what each of them must carry.
ALTER TABLE public.unchained_client_events
  DROP CONSTRAINT IF EXISTS unchained_client_events_payload_matches_type;
ALTER TABLE public.unchained_client_events
  ADD CONSTRAINT unchained_client_events_payload_matches_type
  CHECK (
    CASE event_type
      WHEN 'client_registered'     THEN to_commercial_id IS NOT NULL AND actor_id IS NOT NULL
      WHEN 'registration_blocked'  THEN from_commercial_id IS NOT NULL AND actor_commercial_id IS NOT NULL
      WHEN 'transfer_requested'    THEN transfer_id IS NOT NULL AND to_commercial_id IS NOT NULL
      WHEN 'transfer_approved'     THEN transfer_id IS NOT NULL
      WHEN 'transfer_declined'     THEN transfer_id IS NOT NULL
      WHEN 'transfer_activated'    THEN transfer_id IS NOT NULL
                                     AND from_commercial_id IS NOT NULL
                                     AND to_commercial_id   IS NOT NULL
      WHEN 'transfer_rejected'     THEN transfer_id IS NOT NULL
      WHEN 'transfer_cancelled'    THEN transfer_id IS NOT NULL
      WHEN 'note_added'            THEN body IS NOT NULL AND actor_id IS NOT NULL
      WHEN 'specialist_assigned'   THEN specialist_id IS NOT NULL
      WHEN 'specialist_unassigned' THEN specialist_id IS NOT NULL
      WHEN 'engagement_created'    THEN engagement_id IS NOT NULL
      ELSE TRUE
    END
  );

-- The internal writer gains the two columns. Same revocations as Phase 9: this
-- is the primitive that writes the log, and a caller who could invoke it
-- directly could record something that did not happen.
--
-- ─── Why Phase 9's version is DROPPED and not replaced ────────────────────
-- CREATE OR REPLACE matches on the argument list, so adding two parameters
-- would create an OVERLOAD rather than a replacement — and then every existing
-- seven-argument call in Phase 9 would match both candidates equally and fail
-- with "function is not unique". Dropping the old one first leaves a single
-- function whose two new parameters default to NULL, so Phase 9's calls resolve
-- to it unchanged. PL/pgSQL resolves callees at run time, so the functions that
-- call it need no edit.
DROP FUNCTION IF EXISTS public.unchained_log_client_event(
  UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB);

CREATE OR REPLACE FUNCTION public.unchained_log_client_event(
  p_client_id     UUID,
  p_event_type    TEXT,
  p_transfer_id   UUID  DEFAULT NULL,
  p_from          UUID  DEFAULT NULL,
  p_to            UUID  DEFAULT NULL,
  p_body          TEXT  DEFAULT NULL,
  p_detail        JSONB DEFAULT NULL,
  p_specialist_id UUID  DEFAULT NULL,
  p_engagement_id UUID  DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  INSERT INTO public.unchained_client_events (
    client_id, transfer_id, event_type, actor_id, actor_commercial_id,
    from_commercial_id, to_commercial_id, body, detail,
    specialist_id, engagement_id
  ) VALUES (
    p_client_id, p_transfer_id, p_event_type,
    (SELECT auth.uid()), public.my_commercial_contact_id(),
    p_from, p_to, NULLIF(btrim(COALESCE(p_body, '')), ''), p_detail,
    p_specialist_id, p_engagement_id
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_log_client_event(
  UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB, UUID, UUID)
  FROM PUBLIC, anon, authenticated;


-- ─── §6. A contract cannot lie about whose it is ──────────────────────────
-- unchained_engagements carries client_name TEXT, and Phase 8 was right to give
-- it one: an engagement with no client_id has no other place to name its
-- client. Now that some engagements DO have a client_id, the two can disagree,
-- and a contract whose name says one thing and whose foreign key says another
-- is worse than either alone.
--
-- So when client_id is present the name is not accepted from the caller at all
-- — it is copied from the client record. This runs on INSERT and on UPDATE, and
-- being a trigger it holds for the panel's direct PostgREST writes exactly as
-- it does for §11's RPC. That is why the table grants could be left alone.
--
-- An engagement with NO client_id behaves precisely as it did before this file.

-- SECURITY DEFINER because it READS unchained_clients, which is under RLS. An
-- invoker-rights trigger would see only the rows the writer may see, and a
-- client hidden by a policy would arrive here as NOT FOUND — reported as "this
-- client does not exist", which is both false and unactionable.
CREATE OR REPLACE FUNCTION public.unchained_engagement_sync_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_name    TEXT;
  v_company TEXT;
BEGIN
  IF NEW.client_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT c.name, c.company_name INTO v_name, v_company
    FROM public.unchained_clients c WHERE c.id = NEW.client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'unchained_engagements: client % does not exist', NEW.client_id
      USING ERRCODE = 'foreign_key_violation';
  END IF;

  NEW.client_name    := v_name;
  NEW.client_company := v_company;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_sync_client ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_sync_client
  BEFORE INSERT OR UPDATE ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagement_sync_client();

-- Renaming a client renames their contracts. Without this the copy above would
-- be right at write time and wrong forever after, which is the failure mode
-- that made client_name untrustworthy in the first place.
--
-- Deliberately NOT applied to engagements in a terminal state: a paid or
-- cancelled contract is a historical document, and the name it was settled
-- under is part of what it records.
-- SECURITY DEFINER, and it has to be. The person renaming a client is usually
-- the COMMERCIAL who owns it, and the policy on unchained_engagements grants
-- UPDATE to managers only. An invoker-rights trigger would not error — RLS
-- filters rows rather than refusing — it would silently update nothing, and the
-- contract would keep the old name forever. That is precisely the drift this
-- cascade exists to prevent, arrived at through the cure instead of the disease.
CREATE OR REPLACE FUNCTION public.unchained_client_rename_cascade()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name
     OR NEW.company_name IS DISTINCT FROM OLD.company_name THEN
    UPDATE public.unchained_engagements
       SET client_name    = NEW.name,
           client_company = NEW.company_name
     WHERE client_id = NEW.id
       AND status NOT IN ('paid', 'cancelled');
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_clients_rename_cascade ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_rename_cascade
  AFTER UPDATE ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_client_rename_cascade();


-- ─── §7. Work starting promotes the client ────────────────────────────────
-- The one status move this file automates, because it is the one that is a fact
-- rather than a judgement: an engagement of theirs reached 'active', so they
-- are an active client. Written as a trigger so it holds for the panel's direct
-- UPDATE as well as for any RPC.
--
-- Only from prospect or dormant. An archived client whose old contract is
-- somehow activated is a situation for a person, not for a trigger, and the
-- status machine in §2 would refuse the move anyway.

-- SECURITY DEFINER, for two independent reasons either of which alone would
-- require it: it calls unchained_log_client_event(), whose EXECUTE is revoked
-- from `authenticated` precisely so that nothing but a trusted writer can put a
-- line in the log — an invoker-rights trigger would be refused outright — and
-- it UPDATEs unchained_clients, which the manager moving an engagement may not
-- own.
CREATE OR REPLACE FUNCTION public.unchained_engagement_activates_client()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.client_id IS NOT NULL
     AND NEW.status = 'active'
     AND OLD.status IS DISTINCT FROM 'active' THEN

    UPDATE public.unchained_clients
       SET status = 'active'
     WHERE id = NEW.client_id
       AND status IN ('prospect', 'dormant');

    IF FOUND THEN
      PERFORM public.unchained_log_client_event(
        NEW.client_id, 'status_changed', NULL, NULL, NULL,
        NULL, jsonb_build_object('to', 'active', 'reason', 'engagement_activated'),
        NULL, NEW.id
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_engagements_activate_client ON public.unchained_engagements;
CREATE TRIGGER trg_unchained_engagements_activate_client
  AFTER UPDATE ON public.unchained_engagements
  FOR EACH ROW EXECUTE FUNCTION public.unchained_engagement_activates_client();


-- ─── §8. Assigning a specialist ───────────────────────────────────────────
-- The operation the requirement names: the super administrator decides who
-- attends the client a commercial registered.
--
-- ─── Who may do it, and why not the owner ─────────────────────────────────
-- Managers only — unchained_manages_leads(), which today means super_admin.
-- The owning commercial cannot assign, and that is the point: delivery capacity
-- is a company-wide resource, and a representative who could staff their own
-- accounts would be allocating other people's time.

CREATE OR REPLACE FUNCTION public.unchained_assign_client_specialist(
  p_client_id     UUID,
  p_specialist_id UUID,
  p_role          TEXT DEFAULT NULL,
  p_note          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor      UUID := (SELECT auth.uid());
  v_role       TEXT := NULLIF(btrim(COALESCE(p_role, '')), '');
  v_note       TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_spec_name  TEXT;
  v_spec_user  UUID;
  v_active     BOOLEAN;
  v_client     TEXT;
  v_owner      UUID;
  v_owner_user UUID;
  v_id         UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'only an administrator can assign a specialist to a client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT c.name, c.owner_commercial_id INTO v_client, v_owner
    FROM public.unchained_clients c WHERE c.id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  SELECT s.name, s.user_id, s.active INTO v_spec_name, v_spec_user, v_active
    FROM public.unchained_specialists s WHERE s.id = p_specialist_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'unknown specialist' USING ERRCODE = 'foreign_key_violation';
  END IF;

  -- A deactivated specialist is somebody who no longer delivers. Assigning them
  -- would put a client on a panel nobody reads.
  IF NOT v_active THEN
    RAISE EXCEPTION 'that specialist is not active' USING ERRCODE = 'check_violation';
  END IF;

  IF v_role IS NOT NULL AND length(v_role) > 80 THEN
    RAISE EXCEPTION 'a role may be at most 80 characters' USING ERRCODE = 'check_violation';
  END IF;

  -- Idempotent. Assigning somebody already on the account is not an error and
  -- not a second row — it is a click that carries no information, and telling
  -- the caller so is more useful than a unique-violation they have to decode.
  SELECT a.id INTO v_id
    FROM public.unchained_client_specialists a
   WHERE a.client_id = p_client_id
     AND a.specialist_id = p_specialist_id
     AND a.active;

  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_assigned',
      'assignment_id', v_id,
      'specialist_name', v_spec_name
    );
  END IF;

  INSERT INTO public.unchained_client_specialists
    (client_id, specialist_id, role, assigned_by, note)
  VALUES
    (p_client_id, p_specialist_id, v_role, v_actor, v_note)
  RETURNING id INTO v_id;

  PERFORM public.unchained_log_client_event(
    p_client_id, 'specialist_assigned', NULL, NULL, NULL, v_note,
    jsonb_build_object('specialist_name', v_spec_name, 'role', v_role),
    p_specialist_id, NULL
  );

  -- Both sides are told, because both have something to do about it: the
  -- specialist has a new account, and the commercial who owns the client now
  -- knows who is delivering for them.
  --
  -- A kind of its own rather than Phase 9's 'client_assigned_to_you'. That one
  -- already means "a transfer was activated and this client is now YOURS to
  -- sell to", and its sentence names the commercial it came from. A specialist
  -- being staffed onto an account is a different event with a different
  -- payload — there is no `from_name` — and reusing the kind would render a
  -- sentence about a transfer that never happened.
  PERFORM public.unchained_notify(
    v_spec_user, 'client_assigned_to_you_as_specialist', p_client_id, NULL,
    jsonb_build_object('client_name', v_client, 'to_name', v_spec_name, 'role', v_role)
  );

  SELECT cc.user_id INTO v_owner_user
    FROM public.commercial_contacts cc WHERE cc.id = v_owner;

  PERFORM public.unchained_notify(
    v_owner_user, 'specialist_assigned_to_client', p_client_id, NULL,
    jsonb_build_object('client_name', v_client, 'to_name', v_spec_name, 'role', v_role)
  );

  RETURN jsonb_build_object(
    'status', 'assigned',
    'assignment_id', v_id,
    'specialist_name', v_spec_name
  );
END;
$fn$;

-- Unassigning closes the row rather than deleting it. Who attended an account
-- last quarter is not disposable, for the same reason a transfer is not.
CREATE OR REPLACE FUNCTION public.unchained_unassign_client_specialist(
  p_client_id     UUID,
  p_specialist_id UUID,
  p_note          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor     UUID := (SELECT auth.uid());
  v_note      TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_spec_name TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'only an administrator can unassign a specialist'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT s.name INTO v_spec_name
    FROM public.unchained_specialists s WHERE s.id = p_specialist_id;

  UPDATE public.unchained_client_specialists
     SET active = FALSE, unassigned_at = now(),
         note = COALESCE(v_note, note)
   WHERE client_id = p_client_id
     AND specialist_id = p_specialist_id
     AND active;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'that specialist is not assigned to this client'
      USING ERRCODE = 'no_data_found';
  END IF;

  PERFORM public.unchained_log_client_event(
    p_client_id, 'specialist_unassigned', NULL, NULL, NULL, v_note,
    jsonb_build_object('specialist_name', v_spec_name),
    p_specialist_id, NULL
  );

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;


-- ─── §9. Steering the client's status ─────────────────────────────────────
-- The deliberate exits from §2. The owning commercial may move their own
-- client; a manager may move anybody's. Both are legitimate: the person who
-- knows the account has gone quiet is usually the one working it.
--
-- The transition itself is not checked here — §2's trigger owns that, and
-- duplicating the machine in the RPC would create a second copy to keep in
-- step. This function decides WHO may ask; the trigger decides WHAT is legal.

CREATE OR REPLACE FUNCTION public.unchained_set_client_status(
  p_client_id UUID,
  p_status    TEXT,
  p_note      TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_mine  UUID := public.my_commercial_contact_id();
  v_owner UUID;
  v_from  TEXT;
  v_note  TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
BEGIN
  SELECT c.owner_commercial_id, c.status INTO v_owner, v_from
    FROM public.unchained_clients c WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_actor IS NULL
     OR NOT (public.unchained_manages_leads() OR (v_mine IS NOT NULL AND v_owner = v_mine)) THEN
    RAISE EXCEPTION 'not authorized to change this client''s status'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_from = p_status THEN
    RETURN jsonb_build_object('success', TRUE, 'status', p_status, 'changed', FALSE);
  END IF;

  UPDATE public.unchained_clients SET status = p_status WHERE id = p_client_id;

  PERFORM public.unchained_log_client_event(
    p_client_id, 'status_changed', NULL, NULL, NULL, v_note,
    jsonb_build_object('from', v_from, 'to', p_status, 'reason', 'manual')
  );

  RETURN jsonb_build_object('success', TRUE, 'status', p_status, 'changed', TRUE);
END;
$fn$;


-- ─── §10. ENTRADA A, connected at last ────────────────────────────────────
-- A won lead becomes a client.
--
-- ─── Why this is an explicit call and not a trigger on `won` ──────────────
-- The obvious implementation is a trigger: the lead reaches 'won', a client
-- appears. It is the wrong one, and the reason is §2 of Phase 9 — the client
-- register enforces first-registration-wins with a UNIQUE INDEX. If the lead's
-- email already belongs to a client another commercial registered last month,
-- that INSERT raises unique_violation, and inside a trigger that exception
-- would roll back the status change itself. Marking a lead won would fail with
-- a message about an index, and the only way out would be for the trigger to
-- swallow the error — which is how a pipeline starts losing rows quietly.
--
-- So the promotion is a call the panel makes, it returns the same three-outcome
-- shape unchained_register_client does, and §13's overview counts won leads
-- with no client so that a collision is a visible queue rather than a silent
-- loss.
--
-- Idempotent: promoting a lead that already produced a client returns that
-- client instead of a second one.

CREATE OR REPLACE FUNCTION public.unchained_promote_lead_to_client(
  p_lead_id       UUID,
  p_commercial_id UUID    DEFAULT NULL,
  p_notes         TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor  UUID := (SELECT auth.uid());
  v_lead   public.unchained_leads%ROWTYPE;
  v_owner  UUID;
  v_exists UUID;
  v_result JSONB;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_can_work_lead(p_lead_id) THEN
    RAISE EXCEPTION 'not authorized to promote that lead' USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_lead FROM public.unchained_leads l WHERE l.id = p_lead_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Only a won lead. A lead still in the funnel is a possibility, and turning
  -- possibilities into clients is how a register stops meaning anything.
  IF v_lead.status <> 'won' THEN
    RAISE EXCEPTION 'only a won lead can become a client (this one is %)', v_lead.status
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Already promoted. Not an error: two people clicking the same button on the
  -- same lead should reach the same client.
  SELECT c.id INTO v_exists
    FROM public.unchained_clients c WHERE c.lead_id = p_lead_id LIMIT 1;
  IF FOUND THEN
    RETURN jsonb_build_object(
      'status', 'already_promoted',
      'client_id', v_exists,
      'lead_id', p_lead_id
    );
  END IF;

  -- The lead's own representative owns the client, unless a manager names
  -- somebody else. A lead with no assignment — routing produced nobody — needs
  -- one supplied, because a client with no owner is not a thing this register
  -- can hold.
  v_owner := COALESCE(p_commercial_id, v_lead.assigned_commercial_id);
  IF v_owner IS NULL THEN
    RAISE EXCEPTION 'that lead has no commercial; name one to promote it'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Delegated rather than reimplemented. Everything Phase 9 guarantees — the
  -- normalisation, the identity keys, first-wins, the registration_blocked
  -- event when somebody got there first — applies to a promoted lead exactly as
  -- it does to a hand-registered client, because it IS the same function.
  v_result := public.unchained_register_client(
    p_name             => v_lead.name,
    p_email            => v_lead.email,
    p_phone            => v_lead.phone,
    p_company_name     => v_lead.company_name,
    p_country_code     => v_lead.country_code,
    p_language         => v_lead.language,
    p_service_interest => v_lead.service_interest,
    p_notes            => COALESCE(NULLIF(btrim(COALESCE(p_notes, '')), ''), v_lead.message),
    p_lead_id          => p_lead_id,
    p_commercial_id    => v_owner
  );

  IF v_result ->> 'status' = 'registered' THEN
    PERFORM public.unchained_log_client_event(
      (v_result ->> 'client_id')::UUID, 'promoted_from_lead', NULL, NULL, v_owner, NULL,
      jsonb_build_object('lead_id', p_lead_id, 'source', v_lead.source)
    );
  END IF;

  RETURN v_result || jsonb_build_object('lead_id', p_lead_id);
END;
$fn$;


-- ─── §11. Contratación, from the client ───────────────────────────────────
-- The guided path from a registered client to a contract.
--
-- What it adds over the direct INSERT the panel already does:
--
--   · client_id is set, so the contract and the register are one record.
--   · the client's active specialists are SEEDED onto the engagement, each at
--     their own default rate — this is what keeps §3's roster and Phase 8's
--     paid assignments from becoming two answers to one question.
--   · an engagement_created event lands on the client's timeline.
--
-- The fee, the currency and the commercial's rate behave exactly as Phase 8
-- defined them: omitting p_commercial_rate takes the representative's current
-- rate through the §6 trigger of that file, and passing 0 means zero.

CREATE OR REPLACE FUNCTION public.unchained_create_engagement(
  p_client_id       UUID,
  p_title           TEXT,
  p_description     TEXT    DEFAULT NULL,
  p_service_id      TEXT    DEFAULT NULL,
  p_amount_cents    BIGINT  DEFAULT 0,
  p_currency        TEXT    DEFAULT 'EUR',
  p_commercial_rate NUMERIC DEFAULT NULL,
  p_seed_specialists BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor   UUID := (SELECT auth.uid());
  v_title   TEXT := NULLIF(btrim(COALESCE(p_title, '')), '');
  v_owner   UUID;
  v_lead    UUID;
  v_id      UUID;
  v_seeded  INTEGER := 0;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'only an administrator can record an engagement'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT c.owner_commercial_id, c.lead_id INTO v_owner, v_lead
    FROM public.unchained_clients c WHERE c.id = p_client_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_title IS NULL OR length(v_title) > 200 THEN
    RAISE EXCEPTION 'an engagement needs a title of 1 to 200 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  -- client_name and client_company are omitted deliberately: §6's trigger
  -- fills them from the client record, and naming them here would create the
  -- second source of truth this file exists to remove. NOT NULL on client_name
  -- still holds — row constraints are checked after BEFORE-ROW triggers run,
  -- the same mechanism Phase 8 relies on for commercial_rate.
  INSERT INTO public.unchained_engagements (
    client_id, client_name, lead_id, title, description, service_id,
    amount_cents, currency, commercial_id, commercial_rate
  ) VALUES (
    p_client_id, '', v_lead, v_title,
    NULLIF(btrim(COALESCE(p_description, '')), ''),
    NULLIF(btrim(COALESCE(p_service_id, '')), ''),
    COALESCE(p_amount_cents, 0), COALESCE(p_currency, 'EUR'),
    v_owner, p_commercial_rate
  )
  RETURNING id INTO v_id;

  -- The roster becomes the delivery team. Rates are left NULL so Phase 8's
  -- unchained_assignment_default_rate() fills each one from the specialist's
  -- own default — the rate belongs to the engagement, and copying it from
  -- anywhere else here would bypass the snapshot that file exists to take.
  IF COALESCE(p_seed_specialists, TRUE) THEN
    INSERT INTO public.unchained_engagement_specialists (engagement_id, specialist_id)
    SELECT v_id, a.specialist_id
      FROM public.unchained_client_specialists a
      JOIN public.unchained_specialists s ON s.id = a.specialist_id
     WHERE a.client_id = p_client_id
       AND a.active
       AND s.active;
    GET DIAGNOSTICS v_seeded = ROW_COUNT;
  END IF;

  PERFORM public.unchained_log_client_event(
    p_client_id, 'engagement_created', NULL, NULL, NULL, v_title,
    jsonb_build_object('amount_cents', COALESCE(p_amount_cents, 0),
                       'currency', COALESCE(p_currency, 'EUR'),
                       'seeded_specialists', v_seeded),
    NULL, v_id
  );

  RETURN jsonb_build_object(
    'success', TRUE,
    'engagement_id', v_id,
    'seeded_specialists', v_seeded
  );
END;
$fn$;


-- ─── §12. Visibility gains its fourth arm ─────────────────────────────────
-- An assigned specialist can see the client they were assigned to.
--
-- Without this the assignment would be an entry on a screen the specialist
-- cannot open. They get the full record — name, company, email, phone, service,
-- notes — because a specialist who is expected to attend a client and cannot
-- contact them has not been assigned anything.
--
-- What they do NOT get is the timeline: §13 leaves unchained_client_timeline on
-- the stricter rule, because that log carries the internal conversation between
-- commercials — who tried to register this client, who asked for a transfer and
-- why — and none of that is delivery information.
--
-- The recursion rule from Phase 9 §6 still holds and is why this still takes
-- the row's fields as arguments rather than querying unchained_clients. The new
-- arm reads unchained_client_specialists, whose own policy (§14) states its
-- rule directly and never reads unchained_clients — so no cycle is closed.

CREATE OR REPLACE FUNCTION public.unchained_client_visible(
  p_client_id           UUID,
  p_owner_commercial_id UUID
)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT public.unchained_manages_leads()
      OR (
           public.my_commercial_contact_id() IS NOT NULL
           AND (
                 p_owner_commercial_id = public.my_commercial_contact_id()
                 OR EXISTS (
                      SELECT 1
                        FROM public.unchained_client_transfers t
                       WHERE t.client_id        = p_client_id
                         AND t.to_commercial_id = public.my_commercial_contact_id()
                         AND t.status IN ('pending_commercial', 'pending_admin')
                    )
               )
         )
      OR (
           public.my_specialist_id() IS NOT NULL
           AND EXISTS (
                 SELECT 1
                   FROM public.unchained_client_specialists a
                  WHERE a.client_id     = p_client_id
                    AND a.specialist_id = public.my_specialist_id()
                    AND a.active
               )
         );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_client_visible(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_client_visible(UUID, UUID) TO authenticated;

-- The timeline keeps the narrower rule: managers, the owner, and a commercial
-- with an open transfer. A specialist sees the client, not the negotiation.
--
-- DROPped rather than replaced: its RETURNS TABLE grows by three columns, and
-- CREATE OR REPLACE cannot change a return type — it fails outright rather than
-- silently doing the wrong thing, which is the one mercy of that restriction.
DROP FUNCTION IF EXISTS public.unchained_client_timeline(UUID);

CREATE FUNCTION public.unchained_client_timeline(p_client_id UUID)
RETURNS TABLE (
  id                  UUID,
  event_type          TEXT,
  transfer_id         UUID,
  actor_commercial_id UUID,
  actor_name          TEXT,
  from_commercial_id  UUID,
  from_name           TEXT,
  to_commercial_id    UUID,
  to_name             TEXT,
  specialist_id       UUID,
  specialist_name     TEXT,
  engagement_id       UUID,
  body                TEXT,
  detail              JSONB,
  created_at          TIMESTAMPTZ
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT e.id, e.event_type, e.transfer_id,
         e.actor_commercial_id,
         (SELECT a.name FROM public.commercial_contacts a WHERE a.id = e.actor_commercial_id),
         e.from_commercial_id,
         (SELECT f.name FROM public.commercial_contacts f WHERE f.id = e.from_commercial_id),
         e.to_commercial_id,
         (SELECT n.name FROM public.commercial_contacts n WHERE n.id = e.to_commercial_id),
         e.specialist_id,
         (SELECT s.name FROM public.unchained_specialists s WHERE s.id = e.specialist_id),
         e.engagement_id,
         e.body, e.detail, e.created_at
    FROM public.unchained_client_events e
    JOIN public.unchained_clients c ON c.id = e.client_id
   WHERE e.client_id = p_client_id
     AND (
           public.unchained_manages_leads()
           OR (
                public.my_commercial_contact_id() IS NOT NULL
                AND (
                      c.owner_commercial_id = public.my_commercial_contact_id()
                      OR EXISTS (
                           SELECT 1 FROM public.unchained_client_transfers t
                            WHERE t.client_id        = c.id
                              AND t.to_commercial_id = public.my_commercial_contact_id()
                              AND t.status IN ('pending_commercial', 'pending_admin')
                         )
                    )
              )
         )
   ORDER BY e.created_at ASC, e.id ASC;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_client_timeline(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_client_timeline(UUID) TO authenticated;


-- ─── §13. Reads ───────────────────────────────────────────────────────────
-- ─── The client list, now carrying the pipeline ───────────────────────────
-- DROPped rather than replaced because RETURNS TABLE grows. The new columns are
-- appended after the Phase 9 ones, so a caller selecting by name is unaffected.
--
-- `p_scope` gains a fourth value, 'assigned' — the specialist's own clients.
-- It is stated as the assignment that exists rather than as "not mine", for the
-- same reason 'incoming' was: to a manager, who sees the whole register, "not
-- mine" would be almost all of it.

DROP FUNCTION IF EXISTS public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER);

CREATE FUNCTION public.unchained_client_list(
  p_scope  TEXT    DEFAULT 'mine',   -- 'mine' | 'all' | 'incoming' | 'assigned'
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
  -- ── Phase 10 ────────────────────────────────────────────────────────────
  status                TEXT,
  status_changed_at     TIMESTAMPTZ,
  -- The delivery team, as a JSONB array so one row carries the whole answer
  -- and the screen needs no second round trip per client.
  specialists           JSONB,
  engagement_count      BIGINT,
  open_engagement_count BIGINT,
  total_count           BIGINT
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
         (SELECT count(*) FROM public.unchained_engagements e WHERE e.client_id = v.id),
         (SELECT count(*) FROM public.unchained_engagements e
           WHERE e.client_id = v.id AND e.status IN ('proposal', 'active', 'delivered')),
         counted.total
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

-- ─── The specialist's own clients ─────────────────────────────────────────
-- The counterpart of unchained_my_engagements() for the relationship rather
-- than the contract. SECURITY DEFINER for the same reason every read in Phase 9
-- is: it resolves the OWNING COMMERCIAL's name, and commercial_contacts is not
-- readable by a specialist. Knowing who to ask about an account is the point of
-- being assigned to it.
CREATE OR REPLACE FUNCTION public.unchained_my_clients()
RETURNS TABLE (
  client_id        UUID,
  name             TEXT,
  company_name     TEXT,
  email            TEXT,
  phone            TEXT,
  service_interest TEXT,
  status           TEXT,
  my_role          TEXT,
  assigned_at      TIMESTAMPTZ,
  owner_name       TEXT,
  open_engagements BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT c.id, c.name, c.company_name, c.email, c.phone, c.service_interest,
         c.status, a.role, a.assigned_at,
         (SELECT o.name FROM public.commercial_contacts o WHERE o.id = c.owner_commercial_id),
         (SELECT count(*) FROM public.unchained_engagements e
           WHERE e.client_id = c.id AND e.status IN ('proposal', 'active', 'delivered'))
    FROM public.unchained_client_specialists a
    JOIN public.unchained_clients c ON c.id = a.client_id
   WHERE (SELECT auth.uid()) IS NOT NULL
     AND a.active
     AND public.my_specialist_id() IS NOT NULL
     AND a.specialist_id = public.my_specialist_id()
   ORDER BY c.name;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_my_clients() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_my_clients() TO authenticated;

-- ─── The pipeline, and its blockages ──────────────────────────────────────
-- One call that answers "where is everything, and what is stuck".
--
-- ─── The honesty rules, inherited from Phases 7 and 8 ─────────────────────
-- Every number is a count of rows that exist. No projection, no expected
-- revenue, no conversion rate over a denominator of zero. The `blocked` object
-- is the part that earns this function its place: a pipeline whose gaps are
-- invisible is how the four disconnected tables happened in the first place.
--
--   won_leads_unpromoted   won, and no client points at them. §10 was refused,
--                          or nobody has clicked yet.
--   clients_unassigned     registered, nobody is attending them.
--   clients_unworked       a client with no engagement at all.
--   engagements_orphaned   a contract with no client_id — the Phase 8 backlog.
--   active_no_open_work    'active' clients with nothing open: §2's dormant
--                          candidates, surfaced rather than acted on.
--
-- Managers only, refused rather than filtered: a partial pipeline count is a
-- number that looks like the business and is not.
CREATE OR REPLACE FUNCTION public.unchained_pipeline_overview()
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'not authorized to read the pipeline overview'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN jsonb_build_object(
    'leads', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::JSONB)
        FROM (SELECT status, count(*) AS n FROM public.unchained_leads GROUP BY status) q
    ),
    'clients', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::JSONB)
        FROM (SELECT status, count(*) AS n FROM public.unchained_clients GROUP BY status) q
    ),
    'engagements', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::JSONB)
        FROM (SELECT status, count(*) AS n FROM public.unchained_engagements GROUP BY status) q
    ),
    'specialists', jsonb_build_object(
      'active',   (SELECT count(*) FROM public.unchained_specialists WHERE active),
      'assigned', (SELECT count(DISTINCT specialist_id)
                     FROM public.unchained_client_specialists WHERE active)
    ),
    'blocked', jsonb_build_object(
      'won_leads_unpromoted', (
        SELECT count(*) FROM public.unchained_leads l
         WHERE l.status = 'won'
           AND NOT EXISTS (SELECT 1 FROM public.unchained_clients c WHERE c.lead_id = l.id)
      ),
      'clients_unassigned', (
        SELECT count(*) FROM public.unchained_clients c
         WHERE c.status <> 'archived'
           AND NOT EXISTS (SELECT 1 FROM public.unchained_client_specialists a
                            WHERE a.client_id = c.id AND a.active)
      ),
      'clients_unworked', (
        SELECT count(*) FROM public.unchained_clients c
         WHERE c.status <> 'archived'
           AND NOT EXISTS (SELECT 1 FROM public.unchained_engagements e WHERE e.client_id = c.id)
      ),
      'engagements_orphaned', (
        SELECT count(*) FROM public.unchained_engagements WHERE client_id IS NULL
      ),
      'active_no_open_work', (
        SELECT count(*) FROM public.unchained_clients c
         WHERE c.status = 'active'
           AND NOT EXISTS (SELECT 1 FROM public.unchained_engagements e
                            WHERE e.client_id = c.id
                              AND e.status IN ('proposal', 'active', 'delivered'))
      )
    )
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_pipeline_overview() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_pipeline_overview() TO authenticated;


-- ─── §14. Row Level Security and privileges ───────────────────────────────
-- unchained_client_specialists follows Phase 9's model exactly: SELECT for the
-- people who have business with the row, INSERT/UPDATE/DELETE for nobody. Every
-- writer is a SECURITY DEFINER function above, so a grant that allowed the
-- change without the log row would make the audit trail a convention.
--
-- The policy states its rule DIRECTLY instead of calling
-- unchained_client_visible(), and that is deliberate for the reason Phase 9
-- documented on the transfers table: unchained_client_visible() now READS this
-- table (§12), so a policy here that called it would close a cycle which only
-- terminates because the function's owner bypasses RLS. Stated directly it
-- cannot recurse under any ownership.

ALTER TABLE public.unchained_client_specialists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_client_specialists_read ON public.unchained_client_specialists;
CREATE POLICY unchained_client_specialists_read ON public.unchained_client_specialists
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         public.my_specialist_id() IS NOT NULL
         AND specialist_id = public.my_specialist_id()
       )
    OR (
         public.my_commercial_contact_id() IS NOT NULL
         AND EXISTS (
               SELECT 1 FROM public.unchained_clients c
                WHERE c.id = unchained_client_specialists.client_id
                  AND c.owner_commercial_id = public.my_commercial_contact_id()
             )
       )
  );

REVOKE ALL ON TABLE public.unchained_client_specialists FROM anon, authenticated;
GRANT SELECT ON TABLE public.unchained_client_specialists TO authenticated;

-- Revoked from anon EXPLICITLY, not just from PUBLIC: Supabase's default
-- privileges grant anon EXECUTE on every function created in this schema, and
-- REVOKE ... FROM PUBLIC does not touch that grant. Phase 7 documented it,
-- Phase 9 asserted it, and §15 asserts it again for everything added here.
REVOKE ALL ON FUNCTION public.unchained_assign_client_specialist(UUID, UUID, TEXT, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_unassign_client_specialist(UUID, UUID, TEXT)
  FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_set_client_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_promote_lead_to_client(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_create_engagement(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, NUMERIC, BOOLEAN) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.unchained_assign_client_specialist(UUID, UUID, TEXT, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_unassign_client_specialist(UUID, UUID, TEXT)
  TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_set_client_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_promote_lead_to_client(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_create_engagement(
  UUID, TEXT, TEXT, TEXT, BIGINT, TEXT, NUMERIC, BOOLEAN) TO authenticated;

-- The two notification kinds this file introduces. Same drop-and-re-add as the
-- event types, and for the same reason.
ALTER TABLE public.unchained_notifications
  DROP CONSTRAINT IF EXISTS unchained_notifications_kind_valid;
ALTER TABLE public.unchained_notifications
  ADD CONSTRAINT unchained_notifications_kind_valid
  CHECK (kind IN (
    'transfer_awaiting_your_approval',
    'transfer_awaiting_activation',
    'client_chose_another_commercial',
    'client_assigned_to_you',
    'transfer_declined',
    'transfer_rejected',
    'transfer_cancelled',
    -- Phase 10: the two sides of a delivery assignment
    'client_assigned_to_you_as_specialist',
    'specialist_assigned_to_client'
  ));


-- ─── §15. Apply-time verification ─────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-wired
-- pipeline behind. Everything asserted holds on an EMPTY database.

-- The spine link, and the two status machines.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'unchained_engagements'
       AND column_name = 'client_id'
  ) THEN
    RAISE EXCEPTION 'unchained_engagements.client_id is missing — the pipeline has no spine';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'unchained_clients'
       AND column_name = 'status'
  ) THEN
    RAISE EXCEPTION 'unchained_clients.status is missing — clients have no exit';
  END IF;

  -- The machine must refuse what it is there to refuse. A status column with a
  -- permissive machine is decoration.
  IF public.unchained_client_transition_allowed('prospect', 'dormant')
     OR public.unchained_client_transition_allowed('archived', 'active')
     OR public.unchained_client_transition_allowed('prospect', 'nonsense') THEN
    RAISE EXCEPTION 'the client status machine permits a transition it must not';
  END IF;

  IF NOT public.unchained_client_transition_allowed('prospect', 'active')
     OR NOT public.unchained_client_transition_allowed('archived', 'prospect') THEN
    RAISE EXCEPTION 'the client status machine refuses a transition it must permit';
  END IF;
END;
$$;

-- RLS on the new table, and no policy that permits a write.
DO $$
DECLARE
  v_rls  BOOLEAN;
  v_cmds TEXT;
BEGIN
  SELECT c.relrowsecurity INTO v_rls
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'unchained_client_specialists';

  IF v_rls IS NOT TRUE THEN
    RAISE EXCEPTION 'RLS is not enabled on public.unchained_client_specialists';
  END IF;

  SELECT string_agg(p.polcmd::TEXT, ',') INTO v_cmds
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relname = 'unchained_client_specialists'
     AND p.polcmd <> 'r';

  IF v_cmds IS NOT NULL THEN
    RAISE EXCEPTION 'unchained_client_specialists carries a non-SELECT policy (%)', v_cmds;
  END IF;

  IF has_table_privilege('anon', 'public.unchained_client_specialists', 'SELECT') THEN
    RAISE EXCEPTION 'anon can still select public.unchained_client_specialists';
  END IF;
END;
$$;

-- anon reaches none of the new functions, and the log writer reaches no client
-- role at all.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOR v_name IN
    SELECT p.oid::regprocedure::TEXT
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
             'unchained_assign_client_specialist', 'unchained_unassign_client_specialist',
             'unchained_set_client_status', 'unchained_promote_lead_to_client',
             'unchained_create_engagement', 'unchained_client_list',
             'unchained_client_timeline', 'unchained_my_clients',
             'unchained_pipeline_overview', 'unchained_client_visible',
             'unchained_client_transition_allowed', 'unchained_log_client_event'
           )
  LOOP
    IF has_function_privilege('anon', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute %', v_name;
    END IF;
  END LOOP;

  FOR v_name IN
    SELECT p.oid::regprocedure::TEXT
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public' AND p.proname = 'unchained_log_client_event'
  LOOP
    IF has_function_privilege('authenticated', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can still execute %', v_name;
    END IF;
  END LOOP;
END;
$$;

-- The three triggers that reach across a privilege boundary must be
-- SECURITY DEFINER.
--
-- This is asserted rather than assumed because the failure is invisible from
-- here: the probe below runs as the migration's owner, who can do everything,
-- so an invoker-rights trigger passes every test in this file and then refuses
-- the first commercial who renames a client in production. Two of these call
-- unchained_log_client_event(), whose EXECUTE is revoked from `authenticated`
-- on purpose; the third writes a table the caller may not own.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'unchained_engagement_sync_client',
    'unchained_client_rename_cascade',
    'unchained_engagement_activates_client'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
       WHERE n.nspname = 'public' AND p.proname = v_name AND p.prosecdef
    ) THEN
      RAISE EXCEPTION
        '%() is not SECURITY DEFINER — it will be refused for a non-manager', v_name;
    END IF;
  END LOOP;
END;
$$;

-- The uniqueness that makes "is this specialist on this account" a question
-- with one answer.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND indexname = 'unchained_client_specialists_active_unique'
  ) THEN
    RAISE EXCEPTION 'the active-assignment index is missing — a specialist could be assigned twice';
  END IF;
END;
$$;

-- The coherence trigger, end to end, on data this block creates and removes.
-- Asserting that the trigger EXISTS would not catch a trigger that returns the
-- wrong row, and this is the guarantee that let the table grants stay open.
DO $$
DECLARE
  v_commercial UUID;
  v_client     UUID;
  v_engagement UUID;
  v_name       TEXT;
BEGIN
  SELECT id INTO v_commercial FROM public.commercial_contacts LIMIT 1;
  IF v_commercial IS NULL THEN
    RAISE NOTICE 'no commercial_contacts row; skipping the coherence probe';
    RETURN;
  END IF;

  -- A previous run that failed between the INSERT and the DELETE would have
  -- left a probe row holding the email identity key, and the INSERT below would
  -- then fail on the unique index for a reason that has nothing to do with what
  -- is being tested. Engagements first: client_id carries no ON DELETE.
  DELETE FROM public.unchained_engagements
   WHERE client_id IN (SELECT id FROM public.unchained_clients
                        WHERE email = '__probe__@example.invalid');
  DELETE FROM public.unchained_clients WHERE email = '__probe__@example.invalid';

  INSERT INTO public.unchained_clients
    (name, email, owner_commercial_id, registered_by_commercial_id)
  VALUES
    ('__probe__', '__probe__@example.invalid', v_commercial, v_commercial)
  RETURNING id INTO v_client;

  -- client_name is passed deliberately WRONG. The §6 trigger must overwrite it.
  INSERT INTO public.unchained_engagements
    (client_id, client_name, title, commercial_id, commercial_rate)
  VALUES
    (v_client, 'this name is a lie', '__probe__', v_commercial, 0)
  RETURNING id INTO v_engagement;

  SELECT client_name INTO v_name FROM public.unchained_engagements WHERE id = v_engagement;
  IF v_name <> '__probe__' THEN
    RAISE EXCEPTION 'the engagement/client coherence trigger did not fire (client_name = %)', v_name;
  END IF;

  -- And a rename must reach the open contract.
  UPDATE public.unchained_clients SET name = '__probe2__' WHERE id = v_client;
  SELECT client_name INTO v_name FROM public.unchained_engagements WHERE id = v_engagement;
  IF v_name <> '__probe2__' THEN
    RAISE EXCEPTION 'the rename cascade did not reach the engagement (client_name = %)', v_name;
  END IF;

  DELETE FROM public.unchained_engagements WHERE id = v_engagement;
  DELETE FROM public.unchained_clients     WHERE id = v_client;
END;
$$;

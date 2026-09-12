-- ════════════════════════════════════════════════════════════
-- Phase 9 — Unchained Business: the commercial client register
-- ════════════════════════════════════════════════════════════
-- Four tables and the functions that write them:
--
--     unchained_clients            one row per client a commercial registered
--     unchained_client_transfers   a client's move from one commercial to another
--     unchained_client_events      the append-only log of both
--     unchained_notifications      the messages a person is shown in the panel
--
-- ─── What this file is for ────────────────────────────────────────────────
-- Phase 7 gave the module INBOUND leads: the website produces them and
-- resolve_commercial_contact() decides whose they are. This file gives it the
-- other half — a client a commercial found themselves and registers by hand —
-- and answers the three questions that only arise once people, rather than
-- routing, are the source:
--
--   1. Two commercials talk to the same client. Whose is it?
--      The FIRST one to register it. Not the first to claim they spoke to it,
--      not the loudest: the one whose row exists earliest, by the clock in this
--      database. See §2.
--
--   2. The client says they would rather work with somebody else.
--      Ownership moves — but not on one person's say-so. The chosen commercial
--      accepts, and then a super administrator activates. See §3.
--
--   3. Who did what, and when?
--      Every registration, every refused registration, every request, every
--      approval, decline, activation and rejection writes a row in
--      unchained_client_events, in the same transaction as the change it
--      describes. See §4.
--
-- ─── §1. Scope, and what is NOT touched ───────────────────────────────────
-- Purely additive. No existing table, column, policy, function or grant is
-- altered or dropped. unchained_leads is REFERENCED (a client may be linked to
-- the lead it came from) and never written by anything here: the lead pipeline
-- and the client register are two records of two different things, and the one
-- that would be corrupted by merging them is the one Phase 7's metrics read.
--
-- The predicates are Phase 7's, unchanged and reused rather than restated:
--   public.my_commercial_contact_id()  which representative the caller IS
--   public.unchained_manages_leads()   whether they administer the product
--
-- The second resolves to super_admin plus any active 'unchained' membership
-- holding 'unchained_admin' or 'commercial_manager'. In production today only
-- super_admin satisfies it — public.roles is still the two-value table Phase 4
-- documented — so "activated by a super administrator" is what §3 literally
-- means right now, and it stays correct without an edit when the membership
-- roles are eventually issued.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- supabase_migrations.schema_migrations does not exist in this project (see
-- supabase/BASELINE_MIGRATION_HISTORY.md). Apply by pasting into the Studio SQL
-- editor of the UNCHAINED project. Re-runnable: every object uses IF NOT EXISTS
-- or CREATE OR REPLACE, and the verification block at the end fails the whole
-- migration rather than leaving a half-secured table behind.


-- ─── §2. unchained_clients ────────────────────────────────────────────────
-- The register itself.
--
-- ─── First registration wins, and the database is what decides ────────────
-- The rule is not implemented as a check in a function that a second code path
-- could forget. It is a UNIQUE INDEX on the client's identity, so the second
-- commercial's INSERT cannot succeed no matter which code path issues it, and
-- two simultaneous registrations resolve the same way a race for any unique key
-- resolves: one commits, the other is told who got there first and when.
--
-- `registered_at` is the timestamp that settles the question. It is written
-- once, defaults to now(), and is never updated — not by a transfer, not by an
-- edit, not by anything in this file. `claimed_at` is the separate, movable
-- fact: when the CURRENT owner acquired the client. On a freshly registered
-- client the two are equal; after a transfer they differ, and the difference is
-- exactly the history the log explains.
--
-- ─── What counts as "the same client" ─────────────────────────────────────
-- Two identity keys, both derived by the database from what was typed, so two
-- people entering the same client in two different styles collide:
--
--   email_key   lower(btrim(email))            — exact, and there is no
--                                                plausible false positive
--   phone_key   the LAST NINE DIGITS of the    — deliberately loose
--               phone, punctuation removed
--
-- Nine digits rather than the whole number because the dominant real-world
-- difference between two entries of one client's phone is the country prefix:
-- "+7 999 123 45 67" and "8 (999) 123-45-67" are the same person and must not
-- become two owners. The cost is a false positive if two clients in different
-- countries share nine trailing digits, which is why `identity_override`
-- exists — an administrator, and only an administrator, can register a client
-- past a collision, and that row then participates in no uniqueness at all.
--
-- ─── The foreign keys carry no ON DELETE ──────────────────────────────────
-- NO ACTION is the default and is what history requires, exactly as
-- unchained_leads.assigned_commercial_id does it: a representative who owns
-- clients cannot be deleted out from under them, they are deactivated.

CREATE TABLE IF NOT EXISTS public.unchained_clients (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Who they are ──────────────────────────────────────────────────────
  name          TEXT NOT NULL,
  company_name  TEXT,
  email         TEXT,
  phone         TEXT,

  -- ── Where, and in what language ───────────────────────────────────────
  -- Both nullable, unlike unchained_leads.language: a commercial registering a
  -- client they met at a conference genuinely may not know yet, and a guess is
  -- worse than a blank.
  country_code  TEXT,
  language      TEXT,

  -- ── What they want ────────────────────────────────────────────────────
  service_interest  TEXT REFERENCES public.unchained_services(id) ON UPDATE CASCADE,
  notes             TEXT,

  -- ── Where it came from ────────────────────────────────────────────────
  -- Optionally the inbound lead this client started as. Nullable and expected
  -- to be null most of the time: the whole point of this table is the clients
  -- that never came through the website.
  lead_id  UUID REFERENCES public.unchained_leads(id),

  -- ── Ownership ─────────────────────────────────────────────────────────
  -- NOT NULL, unlike a lead's assignment. A lead can arrive unassigned because
  -- routing produced nobody; a registered client always has an owner, because
  -- somebody had to register it.
  owner_commercial_id  UUID NOT NULL REFERENCES public.commercial_contacts(id),
  claimed_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── The first registration, frozen ────────────────────────────────────
  registered_by_commercial_id  UUID NOT NULL REFERENCES public.commercial_contacts(id),
  registered_by_user_id        UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  registered_at                TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── The collision escape hatch ────────────────────────────────────────
  -- Set only by an administrator, only deliberately, and it takes the row out
  -- of both unique indexes. A commercial cannot set it; there is no parameter
  -- through which they could.
  identity_override  BOOLEAN NOT NULL DEFAULT FALSE,

  -- ── Derived identity ──────────────────────────────────────────────────
  -- Generated by the database, not by the caller, so no code path can insert a
  -- row whose key disagrees with its own contact details.
  email_key TEXT GENERATED ALWAYS AS (NULLIF(lower(btrim(COALESCE(email, ''))), '')) STORED,
  phone_key TEXT GENERATED ALWAYS AS (
    NULLIF(right(regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g'), 9), '')
  ) STORED,

  CONSTRAINT unchained_clients_name_present
    CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_clients_company_length
    CHECK (company_name IS NULL OR length(btrim(company_name)) BETWEEN 1 AND 200),

  -- The same two rules unchained_leads carries, for the same reasons: reject
  -- "not an address at all" rather than "not RFC 5322", and accept a phone
  -- number a human typed for a human to dial.
  CONSTRAINT unchained_clients_email_format
    CHECK (email IS NULL OR (length(email) <= 200
       AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),
  CONSTRAINT unchained_clients_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9][0-9 ()./-]{5,31}$'),

  -- A client with neither an address nor a number cannot be contacted, and —
  -- more to the point here — cannot be identified, so the first-wins rule would
  -- have nothing to compare. Both halves matter, so both are required as one.
  CONSTRAINT unchained_clients_reachable
    CHECK (email IS NOT NULL OR phone IS NOT NULL),

  CONSTRAINT unchained_clients_country_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT unchained_clients_language_format
    CHECK (language IS NULL OR language ~ '^[a-z]{2,3}$'),
  CONSTRAINT unchained_clients_notes_length
    CHECK (notes IS NULL OR length(notes) <= 2000),

  -- The frozen registration cannot postdate the row, and the current claim
  -- cannot predate the first one. Both are assertions that the functions below
  -- did what they say; neither is something a caller supplies.
  CONSTRAINT unchained_clients_claim_order
    CHECK (claimed_at >= registered_at)
);

-- The rule from §2, as an index. Partial on two counts: a NULL key must not
-- collide with another NULL, and an overridden row participates in nothing.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_clients_email_key_unique
  ON public.unchained_clients (email_key)
  WHERE email_key IS NOT NULL AND NOT identity_override;

CREATE UNIQUE INDEX IF NOT EXISTS unchained_clients_phone_key_unique
  ON public.unchained_clients (phone_key)
  WHERE phone_key IS NOT NULL AND NOT identity_override;

-- The three questions the screens ask: my clients newest first, the whole
-- register newest first, and "who registered this originally" for the report
-- that compares a representative's own sourcing against what routing gave them.
CREATE INDEX IF NOT EXISTS idx_unchained_clients_owner
  ON public.unchained_clients (owner_commercial_id, registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_clients_registered
  ON public.unchained_clients (registered_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_clients_registrar
  ON public.unchained_clients (registered_by_commercial_id, registered_at DESC);

DROP TRIGGER IF EXISTS trg_unchained_clients_updated_at ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_updated_at
  BEFORE UPDATE ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_touch_updated_at();

-- `registered_at`, `registered_by_*` and the identity of the row are history,
-- and history is not editable. The trigger is the guarantee, not the convention:
-- every UPDATE in this file goes through it, and so would any UPDATE that some
-- future file forgets to think about.
CREATE OR REPLACE FUNCTION public.unchained_clients_freeze_registration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  IF NEW.id                          IS DISTINCT FROM OLD.id
     OR NEW.registered_at            IS DISTINCT FROM OLD.registered_at
     OR NEW.registered_by_commercial_id IS DISTINCT FROM OLD.registered_by_commercial_id
     OR NEW.created_at               IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'the registration of a client is immutable'
      USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_clients_freeze ON public.unchained_clients;
CREATE TRIGGER trg_unchained_clients_freeze
  BEFORE UPDATE ON public.unchained_clients
  FOR EACH ROW EXECUTE FUNCTION public.unchained_clients_freeze_registration();


-- ─── §3. unchained_client_transfers ───────────────────────────────────────
-- "The client chose another commercial", as a record with two gates.
--
-- ─── Why ownership does not move when the request is made ─────────────────
-- A client changing representative is a commission-bearing event: it moves
-- whoever earns on the work that follows. If a request moved it immediately,
-- any commercial could take any colleague's client and the only remedy would be
-- an argument after the fact. So the move is a REQUEST, and it takes effect
-- when two independent people have said so:
--
--   pending_commercial   the chosen commercial has been told and has not yet
--                        answered. They can see the client's details from here
--                        — they cannot accept a client they cannot look at —
--                        and nothing about the ownership has changed.
--   pending_admin        the chosen commercial accepted. Still nothing has
--                        changed. A super administrator now sees it in their
--                        queue.
--   active               the administrator activated it. THIS is the moment
--                        owner_commercial_id moves, and the moment the previous
--                        owner is told that the client chose somebody else.
--
--   declined             the chosen commercial did not want it.
--   rejected             the administrator refused it.
--   cancelled            the requester withdrew it, or an administrator did.
--
-- The three terminal-by-refusal states are kept distinct rather than collapsed
-- into one "closed", because "the colleague did not want this client" and "the
-- administrator would not allow it" are different answers to the person who
-- asked, and a log that could not tell them apart would be describing a
-- different business.
--
-- ─── When the chosen commercial is also the requester ─────────────────────
-- The common case: a client tells commercial B they would rather work with B,
-- and B is the one holding the information. B raises the request and it starts
-- at 'pending_admin' with approved_at already set — asking B to approve their
-- own request would be a click that carries no information. The log records
-- this honestly: the transfer_approved event says the approval was implied by
-- the request, and the administrator's gate is untouched, which is the gate
-- that was doing the work.

CREATE TABLE IF NOT EXISTS public.unchained_client_transfers (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id  UUID NOT NULL REFERENCES public.unchained_clients(id) ON DELETE CASCADE,

  -- Snapshotted at request time from the client's owner. Not a live lookup: if
  -- the owner changes while a request is open the request is about a move that
  -- no longer makes sense, and the RPC refuses it rather than silently
  -- retargeting.
  from_commercial_id  UUID NOT NULL REFERENCES public.commercial_contacts(id),
  to_commercial_id    UUID NOT NULL REFERENCES public.commercial_contacts(id),

  status  TEXT NOT NULL DEFAULT 'pending_commercial',
  reason  TEXT,

  requested_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  requested_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  approved_at   TIMESTAMPTZ,
  approved_by   UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  activated_at  TIMESTAMPTZ,
  activated_by  UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  closed_at     TIMESTAMPTZ,
  closed_by     UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  decision_note TEXT,

  CONSTRAINT unchained_client_transfers_status_valid
    CHECK (status IN ('pending_commercial','pending_admin','active','declined','rejected','cancelled')),

  -- Moving a client to the person who already owns them is not a transfer, and
  -- allowing the row would put a meaningless line in the log.
  CONSTRAINT unchained_client_transfers_parties_differ
    CHECK (from_commercial_id <> to_commercial_id),

  CONSTRAINT unchained_client_transfers_reason_length
    CHECK (reason IS NULL OR length(btrim(reason)) BETWEEN 1 AND 1000),
  CONSTRAINT unchained_client_transfers_note_length
    CHECK (decision_note IS NULL OR length(btrim(decision_note)) BETWEEN 1 AND 1000),

  -- The timestamps must agree with the status they describe. Without this a row
  -- could claim 'active' with no activated_at, and the log would show a
  -- transfer that took effect at no particular moment.
  CONSTRAINT unchained_client_transfers_timestamps_agree
    CHECK (
      CASE status
        WHEN 'pending_commercial' THEN approved_at IS NULL     AND activated_at IS NULL     AND closed_at IS NULL
        WHEN 'pending_admin'      THEN approved_at IS NOT NULL AND activated_at IS NULL     AND closed_at IS NULL
        WHEN 'active'             THEN approved_at IS NOT NULL AND activated_at IS NOT NULL AND closed_at IS NULL
        WHEN 'declined'           THEN approved_at IS NULL     AND activated_at IS NULL     AND closed_at IS NOT NULL
        WHEN 'rejected'           THEN approved_at IS NOT NULL AND activated_at IS NULL     AND closed_at IS NOT NULL
        WHEN 'cancelled'          THEN                              activated_at IS NULL    AND closed_at IS NOT NULL
        ELSE FALSE
      END
    ),

  CONSTRAINT unchained_client_transfers_order
    CHECK (
      (approved_at  IS NULL OR approved_at  >= requested_at)
      AND (activated_at IS NULL OR activated_at >= approved_at)
      AND (closed_at    IS NULL OR closed_at    >= requested_at)
    )
);

-- One open request per client, enforced rather than checked. Two open requests
-- would mean two different answers to "who is this client moving to", and the
-- second activation would silently overwrite the first.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_client_transfers_open_unique
  ON public.unchained_client_transfers (client_id)
  WHERE status IN ('pending_commercial','pending_admin');

CREATE INDEX IF NOT EXISTS idx_unchained_client_transfers_to
  ON public.unchained_client_transfers (to_commercial_id, status, requested_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_client_transfers_from
  ON public.unchained_client_transfers (from_commercial_id, status, requested_at DESC);

-- The administrator's queue, and the log's default order.
CREATE INDEX IF NOT EXISTS idx_unchained_client_transfers_status
  ON public.unchained_client_transfers (status, requested_at DESC);


-- ─── §4. unchained_client_events ──────────────────────────────────────────
-- Append-only. The same shape, and the same reasoning, as
-- unchained_lead_events: one table for the timeline, the notes and the audit
-- trail, because those three are the same fact with different payloads, and
-- three tables would be three chronologies that can disagree.
--
-- Nothing here is derived state. unchained_clients.owner_commercial_id remains
-- the authoritative current owner; these rows say how it got there. Replaying
-- the table is never required to answer a question.
--
-- ─── The events, and why exactly these ────────────────────────────────────
--   client_registered      a commercial registered a client. The first row.
--   registration_blocked   a SECOND commercial tried to register a client that
--                          was already in the register. The refusal is the
--                          interesting event, not a silent no-op: it is the
--                          record that two people were talking to one client
--                          and it is what makes the first-wins rule auditable
--                          rather than merely true.
--   client_updated         somebody edited the details.
--   transfer_requested     the client's choice was recorded.
--   transfer_approved      the chosen commercial accepted.
--   transfer_declined      the chosen commercial refused.
--   transfer_activated     a super administrator activated it. Ownership moved
--                          in the same transaction as this row.
--   transfer_rejected      a super administrator refused it.
--   transfer_cancelled     it was withdrawn.
--   note_added             an internal note.

CREATE TABLE IF NOT EXISTS public.unchained_client_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id   UUID NOT NULL REFERENCES public.unchained_clients(id) ON DELETE CASCADE,
  transfer_id UUID REFERENCES public.unchained_client_transfers(id) ON DELETE SET NULL,
  event_type  TEXT NOT NULL,

  -- Who did it, twice over: the login, and the representative they were acting
  -- as. Both, because they answer different questions — the login is the audit
  -- fact, the representative is what the screens print, and an administrator
  -- who holds no commercial record has the second one null.
  actor_id             UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_commercial_id  UUID REFERENCES public.commercial_contacts(id),

  from_commercial_id   UUID REFERENCES public.commercial_contacts(id),
  to_commercial_id     UUID REFERENCES public.commercial_contacts(id),

  body    TEXT,

  -- Rendering detail only — which identifier collided, what the previous value
  -- of an edited field was. NOTHING reads this to make a decision, and nothing
  -- ever should: the moment a policy or a function branches on it, it stops
  -- being a log and becomes schema without constraints.
  detail  JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_client_events_type_valid
    CHECK (event_type IN (
      'client_registered',
      'registration_blocked',
      'client_updated',
      'transfer_requested',
      'transfer_approved',
      'transfer_declined',
      'transfer_activated',
      'transfer_rejected',
      'transfer_cancelled',
      'note_added'
    )),

  CONSTRAINT unchained_client_events_body_length
    CHECK (body IS NULL OR length(btrim(body)) BETWEEN 1 AND 4000),

  -- Each event type carries the payload it is about. Without this a
  -- transfer_activated could exist with no parties on it, and the log would
  -- render a line nobody could explain.
  CONSTRAINT unchained_client_events_payload_matches_type
    CHECK (
      CASE event_type
        WHEN 'client_registered'    THEN to_commercial_id IS NOT NULL AND actor_id IS NOT NULL
        WHEN 'registration_blocked' THEN from_commercial_id IS NOT NULL AND actor_commercial_id IS NOT NULL
        WHEN 'transfer_requested'   THEN transfer_id IS NOT NULL AND to_commercial_id IS NOT NULL
        WHEN 'transfer_approved'    THEN transfer_id IS NOT NULL
        WHEN 'transfer_declined'    THEN transfer_id IS NOT NULL
        WHEN 'transfer_activated'   THEN transfer_id IS NOT NULL
                                      AND from_commercial_id IS NOT NULL
                                      AND to_commercial_id   IS NOT NULL
        WHEN 'transfer_rejected'    THEN transfer_id IS NOT NULL
        WHEN 'transfer_cancelled'   THEN transfer_id IS NOT NULL
        WHEN 'note_added'           THEN body IS NOT NULL AND actor_id IS NOT NULL
        ELSE TRUE
      END
    )
);

-- One client's timeline, oldest first, and the super administrator's log,
-- newest first. Two orders over the same rows, so two indexes.
CREATE INDEX IF NOT EXISTS idx_unchained_client_events_client
  ON public.unchained_client_events (client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_unchained_client_events_recent
  ON public.unchained_client_events (created_at DESC);

-- The log's two filters: "show me only the transfers" and "show me everything
-- this representative did".
CREATE INDEX IF NOT EXISTS idx_unchained_client_events_type
  ON public.unchained_client_events (event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_client_events_actor
  ON public.unchained_client_events (actor_commercial_id, created_at DESC);

-- Append-only, enforced. Copied deliberately from Phase 7's
-- unchained_lead_events_append_only(): a log that can be edited is not a log,
-- and the property has to hold against every future writer, not just the ones
-- in this file.
CREATE OR REPLACE FUNCTION public.unchained_client_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'unchained_client_events is append-only'
    USING ERRCODE = 'restrict_violation';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_client_events_append_only ON public.unchained_client_events;
CREATE TRIGGER trg_unchained_client_events_append_only
  BEFORE UPDATE OR DELETE ON public.unchained_client_events
  FOR EACH ROW EXECUTE FUNCTION public.unchained_client_events_append_only();


-- ─── §5. unchained_notifications ──────────────────────────────────────────
-- "The commercial assigned before receives a message."
--
-- ─── Why the message text is not stored ───────────────────────────────────
-- The row carries a `kind` and a `payload`, and the panel composes the sentence
-- from them in the reader's own language. Storing "El cliente eligió a otro
-- comercial" would freeze the wording of every historical message in whatever
-- language the writer happened to be using, and this panel is read in two.
--
-- ─── Why this is not the log ──────────────────────────────────────────────
-- A notification is addressed to somebody and can be dismissed. An event is a
-- fact and cannot. They are written in the same transaction and they are not
-- the same table, because "mark as read" must never be able to touch the audit
-- trail — and because the super administrator's log must show a transfer that
-- every recipient has already dismissed.

CREATE TABLE IF NOT EXISTS public.unchained_notifications (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recipient_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  kind        TEXT NOT NULL,
  client_id   UUID REFERENCES public.unchained_clients(id) ON DELETE CASCADE,
  transfer_id UUID REFERENCES public.unchained_client_transfers(id) ON DELETE CASCADE,

  -- The names the sentence needs, snapshotted. Read from here rather than
  -- joined at render time so that a message stays readable after the client is
  -- renamed or the representative is deactivated — a message is a record of
  -- what somebody was told, not a live view.
  payload  JSONB NOT NULL DEFAULT '{}'::JSONB,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at     TIMESTAMPTZ,

  CONSTRAINT unchained_notifications_kind_valid
    CHECK (kind IN (
      'transfer_awaiting_your_approval',
      'transfer_awaiting_activation',
      'client_chose_another_commercial',
      'client_assigned_to_you',
      'transfer_declined',
      'transfer_rejected',
      'transfer_cancelled'
    )),
  CONSTRAINT unchained_notifications_read_order
    CHECK (read_at IS NULL OR read_at >= created_at)
);

-- The bell: this person's messages, unread first is done in the query, so the
-- index only has to serve "mine, newest first".
CREATE INDEX IF NOT EXISTS idx_unchained_notifications_recipient
  ON public.unchained_notifications (recipient_user_id, created_at DESC);

-- The unread count, which the bell asks for on every screen.
CREATE INDEX IF NOT EXISTS idx_unchained_notifications_unread
  ON public.unchained_notifications (recipient_user_id)
  WHERE read_at IS NULL;


-- ─── §6. Visibility ───────────────────────────────────────────────────────
-- The one rule about who may see a client, defined once and used by both the
-- RLS policy and the functions that have to answer the same question while
-- SECURITY DEFINER has RLS switched off.
--
--   a manager                sees the whole register
--   the owner                sees their own clients
--   the chosen commercial    sees a client with an OPEN transfer naming them,
--                            and only while it is open
--
-- That third arm is the requirement stated as a permission: a commercial who is
-- asked to accept a client has to be able to look at the client. It closes the
-- moment the transfer does — a declined or rejected request leaves the person
-- with the memory of a name and no further access.
--
-- ─── Why it takes the row's fields as arguments ───────────────────────────
-- It never queries unchained_clients. A policy on a table that calls a function
-- which queries that table recurses the moment the function's owner does not
-- bypass RLS, and Phase 7 already had to write around that hazard once. Passing
-- the two fields in makes recursion impossible under any ownership.

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
         );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_client_visible(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_client_visible(UUID, UUID) TO authenticated;


-- ─── §7. Internal writers ─────────────────────────────────────────────────
-- Two helpers the RPCs below share. Both are revoked from every client role:
-- they are the primitives that write the log and the messages, and a caller who
-- could invoke them directly could write a log entry describing something that
-- did not happen.

CREATE OR REPLACE FUNCTION public.unchained_log_client_event(
  p_client_id  UUID,
  p_event_type TEXT,
  p_transfer_id UUID DEFAULT NULL,
  p_from       UUID DEFAULT NULL,
  p_to         UUID DEFAULT NULL,
  p_body       TEXT DEFAULT NULL,
  p_detail     JSONB DEFAULT NULL
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
    from_commercial_id, to_commercial_id, body, detail
  ) VALUES (
    p_client_id, p_transfer_id, p_event_type,
    (SELECT auth.uid()), public.my_commercial_contact_id(),
    p_from, p_to, NULLIF(btrim(COALESCE(p_body, '')), ''), p_detail
  );
END;
$fn$;

CREATE OR REPLACE FUNCTION public.unchained_notify(
  p_user        UUID,
  p_kind        TEXT,
  p_client_id   UUID,
  p_transfer_id UUID,
  p_payload     JSONB DEFAULT '{}'::JSONB
)
RETURNS VOID
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  -- A representative with no login yet is a real and ordinary state — Phase 7's
  -- commercial_contacts.user_id is nullable on purpose. There is nobody to tell,
  -- and that is not an error: the event is still in the log, and the message
  -- appears for whoever the row is eventually linked to only from that point on.
  IF p_user IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.unchained_notifications
    (recipient_user_id, kind, client_id, transfer_id, payload)
  VALUES
    (p_user, p_kind, p_client_id, p_transfer_id, COALESCE(p_payload, '{}'::JSONB));
END;
$fn$;

-- Everyone who administers the product, as logins. Used to fan a
-- 'transfer_awaiting_activation' message out to the people who can act on it.
-- Both sources are read because both are real: public.roles carries today's
-- super administrators, and product_memberships carries the product roles Phase
-- 5 introduced.
CREATE OR REPLACE FUNCTION public.unchained_admin_user_ids()
RETURNS TABLE (user_id UUID)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT r.user_id FROM public.roles r WHERE r.role = 'super_admin'
  UNION
  SELECT m.user_id
    FROM public.product_memberships m
    JOIN public.platform_products p ON p.id = m.product_id
   WHERE m.product_id = 'unchained'
     AND m.active
     AND p.enabled
     AND m.role IN ('unchained_admin', 'commercial_manager');
$fn$;

REVOKE ALL ON FUNCTION public.unchained_log_client_event(UUID, TEXT, UUID, UUID, UUID, TEXT, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_notify(UUID, TEXT, UUID, UUID, JSONB)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.unchained_admin_user_ids()
  FROM PUBLIC, anon, authenticated;


-- ─── §8. unchained_register_client ────────────────────────────────────────
-- A commercial registers a client they found themselves.
--
-- ─── The three answers, and why none of them is an error ──────────────────
--   { status: 'registered',     client_id, registered_at }
--   { status: 'already_yours',  client_id, registered_at }
--   { status: 'already_claimed', client_id, registered_at, claimed_at,
--     owner_commercial_id, owner_name, matched_on, can_request_transfer }
--
-- The third is the whole point of the feature and it is a RESULT, not a
-- failure: the caller did nothing wrong, they were simply second. It carries
-- the owner's name and the exact moment the first registration landed, because
-- "Alexander registered this client on 9 September at 14:03" is the sentence
-- that settles the conversation between two commercials, and a bare refusal
-- would start one.
--
-- `can_request_transfer` is TRUE when the caller is a commercial and there is no
-- open request already — the screen uses it to decide whether to offer "the
-- client chose me", and the RPC that follows checks the same things again.
--
-- ─── The race is decided by the index, not by the SELECT ──────────────────
-- The lookup below is an optimisation for the common case. Two commercials
-- registering the same client in the same instant both pass it, both attempt
-- the INSERT, and the unique index picks one. The loser lands in the exception
-- handler and re-reads, so they receive exactly the answer they would have
-- received a second later. There is no window in which both succeed.

CREATE OR REPLACE FUNCTION public.unchained_register_client(
  p_name             TEXT,
  p_email            TEXT    DEFAULT NULL,
  p_phone            TEXT    DEFAULT NULL,
  p_company_name     TEXT    DEFAULT NULL,
  p_country_code     TEXT    DEFAULT NULL,
  p_language         TEXT    DEFAULT NULL,
  p_service_interest TEXT    DEFAULT NULL,
  p_notes            TEXT    DEFAULT NULL,
  p_lead_id          UUID    DEFAULT NULL,
  -- Managers only. Registering on behalf of a representative who telephoned the
  -- office is a real workflow; a commercial passing somebody else's id is not,
  -- and is refused below.
  p_commercial_id    UUID    DEFAULT NULL,
  -- Managers only. The escape hatch from §2's deliberately loose phone key.
  p_allow_duplicate  BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor      UUID := (SELECT auth.uid());
  v_is_manager BOOLEAN := public.unchained_manages_leads();
  v_mine       UUID := public.my_commercial_contact_id();
  v_owner      UUID;
  v_name       TEXT;
  v_company    TEXT;
  v_email      TEXT;
  v_phone      TEXT;
  v_country    TEXT;
  v_language   TEXT;
  v_service    TEXT;
  v_notes      TEXT;
  v_email_key  TEXT;
  v_phone_key  TEXT;
  v_override   BOOLEAN := FALSE;
  v_existing   public.unchained_clients%ROWTYPE;
  v_matched    TEXT;
  v_client_id  UUID;
  v_registered TIMESTAMPTZ;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authorized to register a client' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Who the client is being registered TO ─────────────────────────────
  IF p_commercial_id IS NOT NULL AND p_commercial_id IS DISTINCT FROM v_mine THEN
    IF NOT v_is_manager THEN
      RAISE EXCEPTION 'only an administrator can register a client for somebody else'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    v_owner := p_commercial_id;
  ELSE
    v_owner := COALESCE(p_commercial_id, v_mine);
  END IF;

  IF v_owner IS NULL THEN
    -- An administrator who holds no representative record has nobody to
    -- register the client to. Saying so is more useful than inventing an owner.
    RAISE EXCEPTION 'a client must be registered to a commercial representative'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM public.commercial_contacts c WHERE c.id = v_owner) THEN
    RAISE EXCEPTION 'unknown commercial' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF p_allow_duplicate AND NOT v_is_manager THEN
    RAISE EXCEPTION 'only an administrator can register a duplicate client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;
  v_override := COALESCE(p_allow_duplicate, FALSE) AND v_is_manager;

  -- ── Normalise, then validate ──────────────────────────────────────────
  -- The same order, and the same rules, as create_public_lead(). The client is
  -- stored the way it will be compared, so "  Foo@Bar.COM " and "foo@bar.com"
  -- are one client rather than two owners.
  v_name     := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_company  := NULLIF(btrim(COALESCE(p_company_name, '')), '');
  v_email    := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone    := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_country  := NULLIF(upper(btrim(COALESCE(p_country_code, ''))), '');
  v_language := NULLIF(lower(btrim(COALESCE(p_language, ''))), '');
  v_service  := NULLIF(btrim(COALESCE(p_service_interest, '')), '');
  v_notes    := NULLIF(btrim(COALESCE(p_notes, '')), '');

  IF v_name IS NULL OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'a client needs a name of 1 to 120 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'a client needs an email address or a phone number'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_email IS NOT NULL
     AND (length(v_email) > 200
          OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RAISE EXCEPTION 'that email address is not valid' USING ERRCODE = 'check_violation';
  END IF;

  IF v_phone IS NOT NULL AND v_phone !~ '^\+?[0-9][0-9 ()./-]{5,31}$' THEN
    RAISE EXCEPTION 'that phone number is not valid' USING ERRCODE = 'check_violation';
  END IF;

  IF v_company IS NOT NULL AND length(v_company) > 200 THEN
    RAISE EXCEPTION 'a company name may be at most 200 characters'
      USING ERRCODE = 'check_violation';
  END IF;

  IF v_notes IS NOT NULL AND length(v_notes) > 2000 THEN
    RAISE EXCEPTION 'notes may be at most 2000 characters' USING ERRCODE = 'check_violation';
  END IF;

  -- Attribution that does not parse is dropped rather than refused, exactly as
  -- create_public_lead() does it: losing a client over a malformed country code
  -- would trade the record for a data-quality nicety.
  IF v_country IS NOT NULL AND v_country !~ '^[A-Z]{2}$' THEN v_country := NULL; END IF;
  IF v_language IS NOT NULL AND v_language !~ '^[a-z]{2,3}$' THEN v_language := NULL; END IF;

  IF v_service IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.unchained_services s WHERE s.id = v_service AND s.active
     ) THEN
    RAISE EXCEPTION 'that service is not one this business offers'
      USING ERRCODE = 'check_violation';
  END IF;

  -- A lead may only be attached by somebody who can already work it. Without
  -- this, a lead id would be a way to discover whether a lead exists.
  IF p_lead_id IS NOT NULL AND NOT public.unchained_can_work_lead(p_lead_id) THEN
    RAISE EXCEPTION 'not authorized to link that lead' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- ── Is this client already in the register? ───────────────────────────
  v_email_key := v_email;
  v_phone_key := NULLIF(right(regexp_replace(COALESCE(v_phone, ''), '[^0-9]', '', 'g'), 9), '');

  IF NOT v_override THEN
    SELECT * INTO v_existing
      FROM public.unchained_clients c
     WHERE NOT c.identity_override
       AND (
             (v_email_key IS NOT NULL AND c.email_key = v_email_key)
             OR (v_phone_key IS NOT NULL AND c.phone_key = v_phone_key)
           )
     -- The EARLIEST registration is the answer, which is the rule itself: if
     -- two rows somehow match (one by address, one by number), the one that
     -- got here first is the one that owns the client.
     ORDER BY c.registered_at ASC
     LIMIT 1;

    IF FOUND THEN
      v_matched := CASE
                     WHEN v_email_key IS NOT NULL AND v_existing.email_key = v_email_key THEN 'email'
                     ELSE 'phone'
                   END;

      IF v_existing.owner_commercial_id = v_owner THEN
        -- Their own client, entered twice. Not an event: nothing happened that
        -- anybody needs to read about later.
        RETURN jsonb_build_object(
          'status', 'already_yours',
          'client_id', v_existing.id,
          'registered_at', v_existing.registered_at,
          'matched_on', v_matched
        );
      END IF;

      -- Somebody else got there first. THIS is the event the requirement asks
      -- for: it is the record that two commercials were talking to one client,
      -- and it is written whether or not anybody goes on to request a transfer.
      PERFORM public.unchained_log_client_event(
        v_existing.id, 'registration_blocked', NULL,
        v_existing.owner_commercial_id, v_owner, NULL,
        jsonb_build_object('matched_on', v_matched, 'attempted_name', v_name)
      );

      RETURN jsonb_build_object(
        'status', 'already_claimed',
        'client_id', v_existing.id,
        'client_name', v_existing.name,
        'registered_at', v_existing.registered_at,
        'claimed_at', v_existing.claimed_at,
        'owner_commercial_id', v_existing.owner_commercial_id,
        'owner_name', (SELECT c.name FROM public.commercial_contacts c
                        WHERE c.id = v_existing.owner_commercial_id),
        'matched_on', v_matched,
        'can_request_transfer',
          v_mine IS NOT NULL
          AND v_mine <> v_existing.owner_commercial_id
          AND NOT EXISTS (
                SELECT 1 FROM public.unchained_client_transfers t
                 WHERE t.client_id = v_existing.id
                   AND t.status IN ('pending_commercial', 'pending_admin')
              )
      );
    END IF;
  END IF;

  -- ── Write ─────────────────────────────────────────────────────────────
  BEGIN
    INSERT INTO public.unchained_clients (
      name, company_name, email, phone,
      country_code, language, service_interest, notes, lead_id,
      owner_commercial_id, claimed_at,
      registered_by_commercial_id, registered_by_user_id,
      identity_override
    ) VALUES (
      v_name, v_company, v_email, v_phone,
      v_country, v_language, v_service, v_notes, p_lead_id,
      v_owner, now(),
      v_owner, v_actor,
      v_override
    )
    RETURNING id, registered_at INTO v_client_id, v_registered;
  EXCEPTION WHEN unique_violation THEN
    -- Lost the race described above. Re-read and answer exactly as the
    -- non-racing path would have.
    SELECT * INTO v_existing
      FROM public.unchained_clients c
     WHERE NOT c.identity_override
       AND (
             (v_email_key IS NOT NULL AND c.email_key = v_email_key)
             OR (v_phone_key IS NOT NULL AND c.phone_key = v_phone_key)
           )
     ORDER BY c.registered_at ASC
     LIMIT 1;

    IF NOT FOUND THEN
      RAISE;
    END IF;

    RETURN jsonb_build_object(
      'status', CASE WHEN v_existing.owner_commercial_id = v_owner
                     THEN 'already_yours' ELSE 'already_claimed' END,
      'client_id', v_existing.id,
      'client_name', v_existing.name,
      'registered_at', v_existing.registered_at,
      'claimed_at', v_existing.claimed_at,
      'owner_commercial_id', v_existing.owner_commercial_id,
      'owner_name', (SELECT c.name FROM public.commercial_contacts c
                      WHERE c.id = v_existing.owner_commercial_id),
      'can_request_transfer',
        v_mine IS NOT NULL AND v_mine <> v_existing.owner_commercial_id
    );
  END;

  PERFORM public.unchained_log_client_event(
    v_client_id, 'client_registered', NULL, NULL, v_owner, NULL,
    CASE WHEN v_override THEN jsonb_build_object('identity_override', TRUE) ELSE NULL END
  );

  RETURN jsonb_build_object(
    'status', 'registered',
    'client_id', v_client_id,
    'registered_at', v_registered
  );
END;
$fn$;


-- ─── §9. unchained_update_client ──────────────────────────────────────────
-- The owner, or a manager, corrects the details.
--
-- The identity columns are editable — a client who gave a wrong digit has to be
-- fixable — and editing them re-enters the uniqueness contest: if the corrected
-- address belongs to somebody else's client, the unique index refuses and the
-- edit is rejected. That is the same rule as registration, arrived at from the
-- other direction, and it is why this function exists rather than an UPDATE
-- grant.

CREATE OR REPLACE FUNCTION public.unchained_update_client(
  p_client_id        UUID,
  p_name             TEXT,
  p_email            TEXT DEFAULT NULL,
  p_phone            TEXT DEFAULT NULL,
  p_company_name     TEXT DEFAULT NULL,
  p_country_code     TEXT DEFAULT NULL,
  p_language         TEXT DEFAULT NULL,
  p_service_interest TEXT DEFAULT NULL,
  p_notes            TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor  UUID := (SELECT auth.uid());
  v_mine   UUID := public.my_commercial_contact_id();
  v_owner  UUID;
  v_name   TEXT := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_email  TEXT := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone  TEXT := NULLIF(btrim(COALESCE(p_phone, '')), '');
BEGIN
  SELECT c.owner_commercial_id INTO v_owner
    FROM public.unchained_clients c WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Editing is narrower than seeing: the commercial a client is being
  -- transferred TO may look at the record while they decide, and may not
  -- rewrite it before it is theirs.
  IF v_actor IS NULL
     OR NOT (public.unchained_manages_leads() OR (v_mine IS NOT NULL AND v_owner = v_mine)) THEN
    RAISE EXCEPTION 'not authorized to edit this client' USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_name IS NULL OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'a client needs a name of 1 to 120 characters' USING ERRCODE = 'check_violation';
  END IF;
  IF v_email IS NULL AND v_phone IS NULL THEN
    RAISE EXCEPTION 'a client needs an email address or a phone number' USING ERRCODE = 'check_violation';
  END IF;

  BEGIN
    UPDATE public.unchained_clients
       SET name             = v_name,
           company_name     = NULLIF(btrim(COALESCE(p_company_name, '')), ''),
           email            = v_email,
           phone            = v_phone,
           country_code     = NULLIF(upper(btrim(COALESCE(p_country_code, ''))), ''),
           language         = NULLIF(lower(btrim(COALESCE(p_language, ''))), ''),
           service_interest = NULLIF(btrim(COALESCE(p_service_interest, '')), ''),
           notes            = NULLIF(btrim(COALESCE(p_notes, '')), '')
     WHERE id = p_client_id;
  EXCEPTION WHEN unique_violation THEN
    RAISE EXCEPTION 'another commercial has already registered a client with those details'
      USING ERRCODE = 'unique_violation';
  END;

  PERFORM public.unchained_log_client_event(p_client_id, 'client_updated');

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;


-- ─── §10. unchained_add_client_note ───────────────────────────────────────
-- Internal, and visible to exactly the people §6 lets see the client.

CREATE OR REPLACE FUNCTION public.unchained_add_client_note(
  p_client_id UUID,
  p_body      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_owner UUID;
  v_body  TEXT := NULLIF(btrim(COALESCE(p_body, '')), '');
BEGIN
  SELECT c.owner_commercial_id INTO v_owner
    FROM public.unchained_clients c WHERE c.id = p_client_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'client not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_actor IS NULL OR NOT public.unchained_client_visible(p_client_id, v_owner) THEN
    RAISE EXCEPTION 'not authorized to add a note to this client'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_body IS NULL OR length(v_body) > 4000 THEN
    RAISE EXCEPTION 'a note must be between 1 and 4000 characters' USING ERRCODE = 'check_violation';
  END IF;

  PERFORM public.unchained_log_client_event(p_client_id, 'note_added', NULL, NULL, NULL, v_body);
  UPDATE public.unchained_clients SET updated_at = now() WHERE id = p_client_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;


-- ─── §11. unchained_request_client_transfer ───────────────────────────────
-- "The client chose another commercial." Recorded, and NOT yet applied.
--
-- ─── Who may raise one ────────────────────────────────────────────────────
--   the chosen commercial   the ordinary case — the client told them, and they
--                           are the one holding the information. The request
--                           starts at 'pending_admin' with the approval already
--                           recorded, because asking somebody to approve their
--                           own request is a click that carries no information.
--   a manager               recording a choice the client made to the office.
--                           The request starts at 'pending_commercial' and the
--                           chosen commercial is told, because in this case they
--                           have not yet said whether they will take the client.
--
-- The CURRENT owner may not raise one. Handing a client to a colleague is not
-- the client's choice, and this table records the client's choice; a manager
-- moving a client for internal reasons is a different operation, and the one
-- that exists for it is the same manager approving the request the colleague
-- raises. Nothing here changes ownership, so nothing here can be used to take a
-- client.

CREATE OR REPLACE FUNCTION public.unchained_request_client_transfer(
  p_client_id       UUID,
  p_to_commercial_id UUID,
  p_reason          TEXT DEFAULT NULL
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
    RAISE EXCEPTION 'that commercial already owns this client' USING ERRCODE = 'invalid_parameter_value';
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

  -- One open request per client. The unique index would refuse it anyway; this
  -- turns a constraint name into a sentence.
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

  IF v_self THEN
    -- Recorded, not clicked. The log says which it was so that "approved by the
    -- person who asked" is never mistaken for a second opinion.
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

  -- The administrators are told as soon as there is something for them to
  -- activate, and not before: a request still waiting on the chosen commercial
  -- is not yet in anybody's queue.
  IF v_status = 'pending_admin' THEN
    PERFORM public.unchained_notify(
      a.user_id, 'transfer_awaiting_activation', p_client_id, v_transfer,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    )
    FROM public.unchained_admin_user_ids() a;
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'transfer_id', v_transfer, 'status', v_status);
END;
$fn$;


-- ─── §12. unchained_respond_client_transfer ───────────────────────────────
-- The chosen commercial accepts the client, or does not.
--
-- Accepting still moves nothing. It moves the request into the administrator's
-- queue, which is the second gate, and the log records the acceptance as its own
-- event so that "the colleague agreed, the administrator has not looked yet" is
-- a state anybody can read off the timeline.

CREATE OR REPLACE FUNCTION public.unchained_respond_client_transfer(
  p_transfer_id UUID,
  p_accept      BOOLEAN,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor  UUID := (SELECT auth.uid());
  v_mine   UUID := public.my_commercial_contact_id();
  v_row    public.unchained_client_transfers%ROWTYPE;
  v_note   TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_client TEXT;
  v_from_name TEXT;
  v_to_name   TEXT;
  v_requester UUID;
BEGIN
  SELECT * INTO v_row FROM public.unchained_client_transfers t WHERE t.id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- Only the person being asked. A manager who wants to push a request forward
  -- has the activation gate; taking the answer out of the chosen commercial's
  -- hands would make the acceptance meaningless.
  IF v_actor IS NULL OR v_mine IS NULL OR v_mine <> v_row.to_commercial_id THEN
    RAISE EXCEPTION 'only the chosen commercial can answer this'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_row.status <> 'pending_commercial' THEN
    RAISE EXCEPTION 'this transfer is no longer waiting for your answer'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT c.name INTO v_client FROM public.unchained_clients c WHERE c.id = v_row.client_id;
  SELECT c.name INTO v_from_name FROM public.commercial_contacts c WHERE c.id = v_row.from_commercial_id;
  SELECT c.name INTO v_to_name   FROM public.commercial_contacts c WHERE c.id = v_row.to_commercial_id;
  v_requester := v_row.requested_by;

  IF COALESCE(p_accept, FALSE) THEN
    UPDATE public.unchained_client_transfers
       SET status = 'pending_admin', approved_at = now(), approved_by = v_actor,
           decision_note = v_note
     WHERE id = p_transfer_id;

    PERFORM public.unchained_log_client_event(
      v_row.client_id, 'transfer_approved', p_transfer_id,
      v_row.from_commercial_id, v_row.to_commercial_id, v_note
    );

    PERFORM public.unchained_notify(
      a.user_id, 'transfer_awaiting_activation', v_row.client_id, p_transfer_id,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    )
    FROM public.unchained_admin_user_ids() a;

    RETURN jsonb_build_object('success', TRUE, 'status', 'pending_admin');
  END IF;

  UPDATE public.unchained_client_transfers
     SET status = 'declined', closed_at = now(), closed_by = v_actor, decision_note = v_note
   WHERE id = p_transfer_id;

  PERFORM public.unchained_log_client_event(
    v_row.client_id, 'transfer_declined', p_transfer_id,
    v_row.from_commercial_id, v_row.to_commercial_id, v_note
  );

  -- Told to whoever asked, unless they are the one declining.
  IF v_requester IS DISTINCT FROM v_actor THEN
    PERFORM public.unchained_notify(
      v_requester, 'transfer_declined', v_row.client_id, p_transfer_id,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', 'declined');
END;
$fn$;


-- ─── §13. unchained_activate_client_transfer ──────────────────────────────
-- The super administrator's gate, and the only place in this file where
-- ownership moves.
--
-- Three things happen in ONE transaction, and the reason they are one
-- transaction is that any two of them without the third is a lie the panel
-- would go on telling: the client's owner changes, the log records the move
-- with both parties named, and the previous owner is sent the message that the
-- client chose somebody else.

CREATE OR REPLACE FUNCTION public.unchained_activate_client_transfer(
  p_transfer_id UUID,
  p_approve     BOOLEAN DEFAULT TRUE,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor     UUID := (SELECT auth.uid());
  v_row       public.unchained_client_transfers%ROWTYPE;
  v_note      TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_owner_now UUID;
  v_client    TEXT;
  v_from_name TEXT;
  v_to_name   TEXT;
  v_from_user UUID;
  v_to_user   UUID;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'only an administrator can activate a transfer'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  SELECT * INTO v_row FROM public.unchained_client_transfers t WHERE t.id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_row.status <> 'pending_admin' THEN
    RAISE EXCEPTION 'this transfer is not waiting for activation'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  -- Row lock before the read, because the decision depends on the owner and the
  -- owner is what is about to change. Without it, two administrators activating
  -- two requests for one client could both pass the check below.
  SELECT c.owner_commercial_id, c.name INTO v_owner_now, v_client
    FROM public.unchained_clients c WHERE c.id = v_row.client_id FOR UPDATE;

  SELECT c.name, c.user_id INTO v_from_name, v_from_user
    FROM public.commercial_contacts c WHERE c.id = v_row.from_commercial_id;
  SELECT c.name, c.user_id INTO v_to_name, v_to_user
    FROM public.commercial_contacts c WHERE c.id = v_row.to_commercial_id;

  IF NOT COALESCE(p_approve, TRUE) THEN
    UPDATE public.unchained_client_transfers
       SET status = 'rejected', closed_at = now(), closed_by = v_actor, decision_note = v_note
     WHERE id = p_transfer_id;

    PERFORM public.unchained_log_client_event(
      v_row.client_id, 'transfer_rejected', p_transfer_id,
      v_row.from_commercial_id, v_row.to_commercial_id, v_note
    );

    PERFORM public.unchained_notify(
      v_to_user, 'transfer_rejected', v_row.client_id, p_transfer_id,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    );

    RETURN jsonb_build_object('success', TRUE, 'status', 'rejected');
  END IF;

  -- The owner moved while the request was open — the client was transferred to
  -- somebody else, or an earlier request was activated first. Activating now
  -- would move a client from a person who no longer has them, so it is refused
  -- rather than silently retargeted, and the administrator is told why.
  IF v_owner_now IS DISTINCT FROM v_row.from_commercial_id THEN
    RAISE EXCEPTION 'this client has changed hands since the request was made'
      USING ERRCODE = 'invalid_parameter_value';
  END IF;

  UPDATE public.unchained_clients
     SET owner_commercial_id = v_row.to_commercial_id,
         claimed_at          = now()
   WHERE id = v_row.client_id;

  UPDATE public.unchained_client_transfers
     SET status = 'active', activated_at = now(), activated_by = v_actor, decision_note = v_note
   WHERE id = p_transfer_id;

  PERFORM public.unchained_log_client_event(
    v_row.client_id, 'transfer_activated', p_transfer_id,
    v_row.from_commercial_id, v_row.to_commercial_id, v_note
  );

  -- The message the requirement names, in the same transaction as the move it
  -- describes. The previous owner learns of it here and nowhere else.
  PERFORM public.unchained_notify(
    v_from_user, 'client_chose_another_commercial', v_row.client_id, p_transfer_id,
    jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
  );

  PERFORM public.unchained_notify(
    v_to_user, 'client_assigned_to_you', v_row.client_id, p_transfer_id,
    jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
  );

  RETURN jsonb_build_object('success', TRUE, 'status', 'active');
END;
$fn$;


-- ─── §14. unchained_cancel_client_transfer ────────────────────────────────
-- Withdrawn by whoever asked for it, or by an administrator. Available at both
-- pending states, because a client who changes their mind while the request
-- sits in a queue should not have to be refused to be undone.

CREATE OR REPLACE FUNCTION public.unchained_cancel_client_transfer(
  p_transfer_id UUID,
  p_note        TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_row   public.unchained_client_transfers%ROWTYPE;
  v_note  TEXT := NULLIF(btrim(COALESCE(p_note, '')), '');
  v_client TEXT;
  v_to_user UUID;
  v_from_name TEXT;
  v_to_name TEXT;
BEGIN
  SELECT * INTO v_row FROM public.unchained_client_transfers t WHERE t.id = p_transfer_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'transfer not found' USING ERRCODE = 'no_data_found';
  END IF;

  IF v_actor IS NULL
     OR NOT (public.unchained_manages_leads() OR v_row.requested_by = v_actor) THEN
    RAISE EXCEPTION 'only the person who asked, or an administrator, can withdraw this'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  IF v_row.status NOT IN ('pending_commercial', 'pending_admin') THEN
    RAISE EXCEPTION 'this transfer is already closed' USING ERRCODE = 'invalid_parameter_value';
  END IF;

  SELECT c.name INTO v_client FROM public.unchained_clients c WHERE c.id = v_row.client_id;
  SELECT c.name INTO v_from_name FROM public.commercial_contacts c WHERE c.id = v_row.from_commercial_id;
  SELECT c.name, c.user_id INTO v_to_name, v_to_user
    FROM public.commercial_contacts c WHERE c.id = v_row.to_commercial_id;

  UPDATE public.unchained_client_transfers
     SET status = 'cancelled', closed_at = now(), closed_by = v_actor, decision_note = v_note
   WHERE id = p_transfer_id;

  PERFORM public.unchained_log_client_event(
    v_row.client_id, 'transfer_cancelled', p_transfer_id,
    v_row.from_commercial_id, v_row.to_commercial_id, v_note
  );

  IF v_to_user IS DISTINCT FROM v_actor THEN
    PERFORM public.unchained_notify(
      v_to_user, 'transfer_cancelled', v_row.client_id, p_transfer_id,
      jsonb_build_object('client_name', v_client, 'from_name', v_from_name, 'to_name', v_to_name)
    );
  END IF;

  RETURN jsonb_build_object('success', TRUE, 'status', 'cancelled');
END;
$fn$;


-- ─── §15. Reads ───────────────────────────────────────────────────────────
-- SECURITY DEFINER, because every one of them has to resolve a representative's
-- NAME, and commercial_contacts is readable only by a manager and by the person
-- themselves. A commercial who is told "already registered by Alexander on 9
-- September" cannot read that name from the table, and a refusal that would not
-- say who to talk to would not settle anything.
--
-- Each one re-states the visibility rule by calling
-- public.unchained_client_visible() rather than by rewriting it, so what these
-- return can never widen past what the RLS policy admits.

CREATE OR REPLACE FUNCTION public.unchained_client_list(
  p_scope  TEXT    DEFAULT 'mine',   -- 'mine' | 'all' | 'incoming'
  p_search TEXT    DEFAULT NULL,
  p_limit  INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
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
             -- 'incoming' is the chosen commercial's own queue: clients somebody
             -- is asking them to take. Stated as the transfer that exists rather
             -- than as "not mine", because for a manager — who can see the whole
             -- register — "not mine" would be almost all of it.
             OR (
                  p_scope = 'incoming'
                  AND EXISTS (
                        SELECT 1 FROM public.unchained_client_transfers x
                         WHERE x.client_id        = c.id
                           AND x.to_commercial_id = public.my_commercial_contact_id()
                           AND x.status IN ('pending_commercial', 'pending_admin')
                      )
                )
           )
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
         -- COALESCE, because a manager who holds no representative record makes
         -- this comparison NULL rather than false, and a NULL would render as
         -- "unknown whether it is yours" on a screen that has no such state.
         COALESCE(v.owner_commercial_id = public.my_commercial_contact_id(), FALSE),
         t.id, t.status, t.to_commercial_id,
         (SELECT w.name FROM public.commercial_contacts w WHERE w.id = t.to_commercial_id),
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

-- One client's timeline. Same visibility, names resolved, oldest first.
CREATE OR REPLACE FUNCTION public.unchained_client_timeline(p_client_id UUID)
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
         e.body, e.detail, e.created_at
    FROM public.unchained_client_events e
    JOIN public.unchained_clients c ON c.id = e.client_id
   WHERE e.client_id = p_client_id
     AND public.unchained_client_visible(c.id, c.owner_commercial_id)
   ORDER BY e.created_at ASC, e.id ASC;
$fn$;

-- The transfers this person has something to do with: what they are being asked
-- to accept, what they asked for, what is leaving them, and — for an
-- administrator — everything waiting on activation.
CREATE OR REPLACE FUNCTION public.unchained_client_transfer_queue(
  p_only_open BOOLEAN DEFAULT TRUE,
  p_limit     INTEGER DEFAULT 100
)
RETURNS TABLE (
  id                 UUID,
  client_id          UUID,
  client_name        TEXT,
  client_company     TEXT,
  client_email       TEXT,
  client_phone       TEXT,
  from_commercial_id UUID,
  from_name          TEXT,
  to_commercial_id   UUID,
  to_name            TEXT,
  status             TEXT,
  reason             TEXT,
  decision_note      TEXT,
  requested_at       TIMESTAMPTZ,
  approved_at        TIMESTAMPTZ,
  activated_at       TIMESTAMPTZ,
  closed_at          TIMESTAMPTZ,
  registered_at      TIMESTAMPTZ,
  -- What the caller can do with this row, decided once here rather than
  -- reconstructed in the browser from a role and a status.
  can_respond        BOOLEAN,
  can_activate       BOOLEAN,
  can_cancel         BOOLEAN
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT t.id, t.client_id, c.name, c.company_name, c.email, c.phone,
         t.from_commercial_id,
         (SELECT f.name FROM public.commercial_contacts f WHERE f.id = t.from_commercial_id),
         t.to_commercial_id,
         (SELECT n.name FROM public.commercial_contacts n WHERE n.id = t.to_commercial_id),
         t.status, t.reason, t.decision_note,
         t.requested_at, t.approved_at, t.activated_at, t.closed_at,
         c.registered_at,
         t.status = 'pending_commercial'
           AND public.my_commercial_contact_id() IS NOT NULL
           AND t.to_commercial_id = public.my_commercial_contact_id(),
         t.status = 'pending_admin' AND public.unchained_manages_leads(),
         t.status IN ('pending_commercial', 'pending_admin')
           AND (public.unchained_manages_leads() OR t.requested_by = (SELECT auth.uid()))
    FROM public.unchained_client_transfers t
    JOIN public.unchained_clients c ON c.id = t.client_id
   WHERE (SELECT auth.uid()) IS NOT NULL
     AND (
           public.unchained_manages_leads()
           OR (
                public.my_commercial_contact_id() IS NOT NULL
                AND (t.to_commercial_id   = public.my_commercial_contact_id()
                  OR t.from_commercial_id = public.my_commercial_contact_id())
              )
           OR t.requested_by = (SELECT auth.uid())
         )
     AND (NOT COALESCE(p_only_open, TRUE) OR t.status IN ('pending_commercial', 'pending_admin'))
   ORDER BY t.requested_at DESC
   LIMIT GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1);
$fn$;

-- ─── The super administrator's log ────────────────────────────────────────
-- Every registration, every refusal, every step of every transfer, across every
-- representative, with the names resolved and in one chronological order.
--
-- Administrators only, refused rather than filtered: a commercial has their own
-- clients' timelines, and a log they could open and see two rows of would only
-- suggest there was a third they were not being shown.
CREATE OR REPLACE FUNCTION public.unchained_client_activity(
  p_event_type    TEXT    DEFAULT NULL,
  p_commercial_id UUID    DEFAULT NULL,
  p_since         TIMESTAMPTZ DEFAULT NULL,
  p_limit         INTEGER DEFAULT 100,
  p_offset        INTEGER DEFAULT 0
)
RETURNS TABLE (
  id                  UUID,
  created_at          TIMESTAMPTZ,
  event_type          TEXT,
  client_id           UUID,
  client_name         TEXT,
  transfer_id         UUID,
  transfer_status     TEXT,
  actor_id            UUID,
  actor_commercial_id UUID,
  actor_name          TEXT,
  from_commercial_id  UUID,
  from_name           TEXT,
  to_commercial_id    UUID,
  to_name             TEXT,
  body                TEXT,
  detail              JSONB,
  total_count         BIGINT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
BEGIN
  IF (SELECT auth.uid()) IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'not authorized to read the client activity log'
      USING ERRCODE = 'insufficient_privilege';
  END IF;

  RETURN QUERY
  WITH matched AS (
    SELECT e.*
      FROM public.unchained_client_events e
     WHERE (p_event_type IS NULL OR e.event_type = p_event_type)
       AND (p_since IS NULL OR e.created_at >= p_since)
       AND (
             p_commercial_id IS NULL
             OR e.actor_commercial_id = p_commercial_id
             OR e.from_commercial_id  = p_commercial_id
             OR e.to_commercial_id    = p_commercial_id
           )
  ),
  counted AS (SELECT count(*) AS n FROM matched)
  SELECT m.id, m.created_at, m.event_type,
         m.client_id,
         (SELECT c.name FROM public.unchained_clients c WHERE c.id = m.client_id),
         m.transfer_id,
         (SELECT x.status FROM public.unchained_client_transfers x WHERE x.id = m.transfer_id),
         m.actor_id, m.actor_commercial_id,
         (SELECT a.name FROM public.commercial_contacts a WHERE a.id = m.actor_commercial_id),
         m.from_commercial_id,
         (SELECT f.name FROM public.commercial_contacts f WHERE f.id = m.from_commercial_id),
         m.to_commercial_id,
         (SELECT n.name FROM public.commercial_contacts n WHERE n.id = m.to_commercial_id),
         m.body, m.detail, counted.n
    FROM matched m
    CROSS JOIN counted
   ORDER BY m.created_at DESC, m.id DESC
   LIMIT  GREATEST(LEAST(COALESCE(p_limit, 100), 500), 1)
  OFFSET GREATEST(COALESCE(p_offset, 0), 0);
END;
$fn$;


-- ─── §16. The messages ────────────────────────────────────────────────────
-- Read and dismissed by their recipient and by nobody else. There is no
-- function here that reads somebody else's messages, and no parameter through
-- which a caller could name a different recipient.

CREATE OR REPLACE FUNCTION public.unchained_my_notifications(
  p_only_unread BOOLEAN DEFAULT FALSE,
  p_limit       INTEGER DEFAULT 30
)
RETURNS TABLE (
  id          UUID,
  kind        TEXT,
  client_id   UUID,
  transfer_id UUID,
  payload     JSONB,
  created_at  TIMESTAMPTZ,
  read_at     TIMESTAMPTZ,
  unread_total BIGINT
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT n.id, n.kind, n.client_id, n.transfer_id, n.payload, n.created_at, n.read_at,
         (SELECT count(*) FROM public.unchained_notifications u
           WHERE u.recipient_user_id = (SELECT auth.uid()) AND u.read_at IS NULL)
    FROM public.unchained_notifications n
   WHERE n.recipient_user_id = (SELECT auth.uid())
     AND (SELECT auth.uid()) IS NOT NULL
     AND (NOT COALESCE(p_only_unread, FALSE) OR n.read_at IS NULL)
   ORDER BY n.created_at DESC
   LIMIT GREATEST(LEAST(COALESCE(p_limit, 30), 100), 1);
$fn$;

CREATE OR REPLACE FUNCTION public.unchained_mark_notification_read(p_id UUID DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_count INTEGER;
BEGIN
  IF v_actor IS NULL THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = 'insufficient_privilege';
  END IF;

  -- A NULL id marks everything, which is the "mark all read" the bell offers.
  -- One function rather than two, because the WHERE clause is the only
  -- difference and two would be two places to get the recipient check right.
  UPDATE public.unchained_notifications
     SET read_at = now()
   WHERE recipient_user_id = v_actor
     AND read_at IS NULL
     AND (p_id IS NULL OR id = p_id);

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN jsonb_build_object('success', TRUE, 'marked', v_count);
END;
$fn$;


-- ─── §17. Row Level Security ──────────────────────────────────────────────
-- The functions above are SECURITY DEFINER and therefore not governed by these
-- policies. What the policies do is decide what a PostgREST query against the
-- tables can return, which is the boundary the route guard in the admin panel
-- is not.
--
--   SELECT  per §6 for clients, and the events table asks the clients table
--           rather than restating the rule, so the two can never disagree.
--   INSERT  nobody. Every writer is a SECURITY DEFINER function above.
--   UPDATE  nobody, except a recipient dismissing their own message.
--   DELETE  nobody, ever. Commercial history is not disposable.

ALTER TABLE public.unchained_clients           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_client_transfers  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_client_events     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_notifications     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_clients_read ON public.unchained_clients;
CREATE POLICY unchained_clients_read ON public.unchained_clients
  FOR SELECT
  USING (public.unchained_client_visible(id, owner_commercial_id));

-- This one states its own rule instead of asking the clients table, and that is
-- deliberate rather than a missed opportunity to share one predicate.
-- unchained_client_visible() READS this table, so a policy here that read
-- unchained_clients would close a cycle — transfers asks clients, clients asks
-- the predicate, the predicate asks transfers — that terminates today only
-- because the function's owner happens to bypass RLS. Phase 7 hit the same
-- hazard from the other side and wrote around it for the same reason. Stated
-- directly, the rule cannot recurse under any ownership: you see a transfer if
-- you administer the product, if you are one of its two parties, or if you are
-- the person who asked for it.
DROP POLICY IF EXISTS unchained_client_transfers_read ON public.unchained_client_transfers;
CREATE POLICY unchained_client_transfers_read ON public.unchained_client_transfers
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         public.my_commercial_contact_id() IS NOT NULL
         AND (to_commercial_id   = public.my_commercial_contact_id()
           OR from_commercial_id = public.my_commercial_contact_id())
       )
    OR (requested_by = (SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL)
  );

DROP POLICY IF EXISTS unchained_client_events_read ON public.unchained_client_events;
CREATE POLICY unchained_client_events_read ON public.unchained_client_events
  FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM public.unchained_clients c WHERE c.id = unchained_client_events.client_id)
  );

DROP POLICY IF EXISTS unchained_notifications_own ON public.unchained_notifications;
CREATE POLICY unchained_notifications_own ON public.unchained_notifications
  FOR SELECT
  USING (recipient_user_id = (SELECT auth.uid()) AND (SELECT auth.uid()) IS NOT NULL);


-- ─── §18. Privileges ──────────────────────────────────────────────────────
-- Belt and braces over RLS, as every phase of this module has done it. These
-- tables hold the names, addresses and phone numbers of real clients, so two
-- independent things have to go wrong before anon reaches one.
--
-- authenticated gets SELECT and nothing else. Not INSERT, not UPDATE, not
-- DELETE: every write goes through a function that writes the log row in the
-- same transaction, and a grant that allowed the change without the log row
-- would make the audit trail a convention instead of a property.

REVOKE ALL ON TABLE public.unchained_clients          FROM anon, authenticated;
REVOKE ALL ON TABLE public.unchained_client_transfers FROM anon, authenticated;
REVOKE ALL ON TABLE public.unchained_client_events    FROM anon, authenticated;
REVOKE ALL ON TABLE public.unchained_notifications    FROM anon, authenticated;

GRANT SELECT ON TABLE public.unchained_clients          TO authenticated;
GRANT SELECT ON TABLE public.unchained_client_transfers TO authenticated;
GRANT SELECT ON TABLE public.unchained_client_events    TO authenticated;
GRANT SELECT ON TABLE public.unchained_notifications    TO authenticated;

-- Revoked from anon EXPLICITLY, not just from PUBLIC. Supabase ships
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon, ...
-- so every function created here arrives with an explicit anon grant that
-- `REVOKE ... FROM PUBLIC` does not touch. Phase 7 documented this; the
-- verification block below fails the migration if any of it is ever undone.
REVOKE ALL ON FUNCTION public.unchained_register_client(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_update_client(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_add_client_note(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_request_client_transfer(UUID, UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_respond_client_transfer(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_activate_client_transfer(UUID, BOOLEAN, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_cancel_client_transfer(UUID, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_client_timeline(UUID) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_client_transfer_queue(BOOLEAN, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_client_activity(TEXT, UUID, TIMESTAMPTZ, INTEGER, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_my_notifications(BOOLEAN, INTEGER) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_mark_notification_read(UUID) FROM PUBLIC, anon;

GRANT EXECUTE ON FUNCTION public.unchained_register_client(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, UUID, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_update_client(
  UUID, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_add_client_note(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_request_client_transfer(UUID, UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_respond_client_transfer(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_activate_client_transfer(UUID, BOOLEAN, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_cancel_client_transfer(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_client_list(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_client_timeline(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_client_transfer_queue(BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_client_activity(TEXT, UUID, TIMESTAMPTZ, INTEGER, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_my_notifications(BOOLEAN, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_mark_notification_read(UUID) TO authenticated;


-- ─── §19. Apply-time verification ─────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- table behind. Everything asserted holds on an EMPTY database.

DO $$
DECLARE
  v_table TEXT;
  v_rls   BOOLEAN;
  v_cmds  TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'unchained_clients',
    'unchained_client_transfers',
    'unchained_client_events',
    'unchained_notifications'
  ] LOOP
    SELECT c.relrowsecurity INTO v_rls
      FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_table;

    IF v_rls IS NOT TRUE THEN
      RAISE EXCEPTION 'RLS is not enabled on public.%', v_table;
    END IF;

    -- No policy on any of these tables may permit a write. Every writer is a
    -- SECURITY DEFINER function, and a write policy would be a path around the
    -- log row.
    SELECT string_agg(p.polcmd::TEXT, ',') INTO v_cmds
      FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
     WHERE n.nspname = 'public' AND c.relname = v_table AND p.polcmd <> 'r';

    IF v_cmds IS NOT NULL THEN
      RAISE EXCEPTION 'public.% carries a non-SELECT policy (%)', v_table, v_cmds;
    END IF;
  END LOOP;
END;
$$;

-- anon reaches none of it: not the tables, not the functions.
DO $$
DECLARE
  v_name TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'unchained_clients',
    'unchained_client_transfers',
    'unchained_client_events',
    'unchained_notifications'
  ] LOOP
    IF has_table_privilege('anon', 'public.' || v_name, 'SELECT') THEN
      RAISE EXCEPTION 'anon can still select public.%', v_name;
    END IF;
  END LOOP;

  FOR v_name IN
    SELECT p.oid::regprocedure::TEXT
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN (
             'unchained_register_client', 'unchained_update_client',
             'unchained_add_client_note', 'unchained_request_client_transfer',
             'unchained_respond_client_transfer', 'unchained_activate_client_transfer',
             'unchained_cancel_client_transfer', 'unchained_client_list',
             'unchained_client_timeline', 'unchained_client_transfer_queue',
             'unchained_client_activity', 'unchained_my_notifications',
             'unchained_mark_notification_read', 'unchained_client_visible',
             'unchained_log_client_event', 'unchained_notify',
             'unchained_admin_user_ids'
           )
  LOOP
    IF has_function_privilege('anon', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can still execute %', v_name;
    END IF;
  END LOOP;

  -- The three internal writers must be unreachable by any client role, not just
  -- by anon: they write the log and the messages, and a caller who could invoke
  -- them directly could record something that did not happen.
  FOR v_name IN
    SELECT p.oid::regprocedure::TEXT
      FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
     WHERE n.nspname = 'public'
       AND p.proname IN ('unchained_log_client_event', 'unchained_notify', 'unchained_admin_user_ids')
  LOOP
    IF has_function_privilege('authenticated', v_name, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated can still execute %', v_name;
    END IF;
  END LOOP;
END;
$$;

-- The first-wins rule, as an assertion about the schema rather than about data:
-- if either unique index is ever dropped, two commercials can own one client
-- and nothing else in this file would notice.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'unchained_clients_email_key_unique'
  ) OR NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'unchained_clients_phone_key_unique'
  ) THEN
    RAISE EXCEPTION 'the client identity indexes are missing — first-registration-wins is not enforced';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public' AND indexname = 'unchained_client_transfers_open_unique'
  ) THEN
    RAISE EXCEPTION 'the open-transfer index is missing — a client could have two pending transfers';
  END IF;
END;
$$;

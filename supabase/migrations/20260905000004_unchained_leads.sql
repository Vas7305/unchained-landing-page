-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PORTED FILE — the reasoning below predates this database                │
-- └────────────────────────────────────────────────────────────────────────┘
-- Copied unchanged (this banner aside) from TanCerca's
--   supabase/migrations/20260903000001_unchained_leads.sql
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
-- Phase 7 — Unchained Business lead capture, attribution & follow-up
-- ════════════════════════════════════════════════════════════
-- Depends on:
--   20260901000001_unchained_commercial.sql          the four commercial tables
--   20260901000002_resolve_commercial_contact.sql    the routing resolver
--   20260902000001_product_memberships.sql           product-scoped authorization
--
-- Creates the commercial-intelligence layer that turns a contact button into a
-- measurable acquisition loop:
--
--     unchained_services        the site's own service taxonomy, normalised
--     unchained_leads           the opportunity itself
--     unchained_lead_events     timeline, internal notes and the audit trail
--     unchained_lead_throttle   rate-limit buckets for the public endpoint
--
-- plus the ONE public write operation the website is allowed to perform,
-- public.create_public_lead(...), and the operations that move a lead through
-- its lifecycle.
--
-- ─── Scope ────────────────────────────────────────────────────────────────
-- Forward-only and additive (§65). The only statements that touch anything an
-- earlier phase built are a single `ADD COLUMN IF NOT EXISTS user_id` on
-- public.commercial_contacts — nullable, defaulted to NULL, read by nothing
-- that existed before — and two ADDITIONAL read policies placed beside (never
-- replacing) the is_super_admin() policies Phase 4 wrote. No table is dropped,
-- no data is deleted, no historical migration is edited.
--
-- ─── Lead vs Contact vs Project (§3) ──────────────────────────────────────
-- Three concepts, and this migration builds exactly one of them:
--
--   Contact   a person who can be reached. Already exists, twice over:
--             public.commercial_contacts is OUR side of the conversation, and
--             the identity columns on a lead are THEIR side. A prospect is
--             never promoted into commercial_contacts — that table is the
--             roster of representatives, and mixing the two would put a
--             stranger into the routing pool.
--
--   Lead      a commercial opportunity created by an inquiry. This file.
--
--   Project   a qualified opportunity that became real work. §49: Phase 4's
--             `Projects` module is the public portfolio, not a delivery
--             record, so there is no lead → project relationship to honour yet
--             and none is invented. `converted_at` is the hook a future phase
--             attaches one to.
--
-- ─── Applying this file ───────────────────────────────────────────────────
-- supabase_migrations.schema_migrations does not exist in this project (see
-- supabase/BASELINE_MIGRATION_HISTORY.md), so `supabase db push` would replay
-- every historical migration against live production. Apply by pasting into
-- the Studio SQL editor, as the rest of this database was built. Every object
-- uses IF NOT EXISTS or CREATE OR REPLACE, so it is safe to run twice.

-- ─── 1. The service taxonomy (§13) ────────────────────────────────────────
-- A small normalised configuration, not a parallel taxonomy.
--
-- The three ids are the three capability pillars the public website already
-- publishes and routes to — lib/pillar-content.ts and the `/software-
-- development`, `/business-automation` and `/growth-systems` pages. They are
-- seeded with the SAME slugs the site uses in its URLs and its analytics
-- labels, so "which service is this lead interested in" and "which page did
-- they read" are answerable in one vocabulary.
--
-- What is deliberately NOT here: an "Other" or "Not sure" row. That would be a
-- taxonomy entry invented by this migration rather than one the business
-- offers. A visitor who does not pick a service produces
-- `service_interest IS NULL`, which is the truthful record of "they did not
-- say" and is reported as exactly that.
--
-- `label_en` is a human label for the admin UI, in the admin platform's own
-- language. The PUBLIC site never reads this table — it renders the pillar
-- names from its own six dictionaries — so no translation belongs here.

CREATE TABLE IF NOT EXISTS public.unchained_services (
  id          TEXT PRIMARY KEY,
  label_en    TEXT NOT NULL,
  sort_order  INTEGER NOT NULL DEFAULT 100,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_services_id_format
    CHECK (id ~ '^[a-z][a-z0-9-]{1,40}$'),
  CONSTRAINT unchained_services_label_present
    CHECK (length(btrim(label_en)) > 0)
);

INSERT INTO public.unchained_services (id, label_en, sort_order) VALUES
  ('software-development', 'Software Development', 10),
  ('business-automation',  'Business Automation',  20),
  ('growth-systems',       'Growth Systems',       30)
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Linking a representative to a login (§40) ─────────────────────────
-- Phase 4 modelled the representative; Phase 5 modelled the login. Nothing
-- connected them, so "show a commercial only their own leads" had no way to
-- ask which representative the signed-in person IS.
--
-- One nullable column answers it. NULL means "this representative has no admin
-- login", which is the state every existing row is in and stays in until an
-- administrator links one. Nothing that existed before reads it, so adding it
-- cannot change any behaviour that exists today.
--
-- UNIQUE and partial: one login maps to at most one representative. Two rows
-- claiming the same user would make "which leads are mine" ambiguous, and that
-- is an authorization question, not a reporting one.

ALTER TABLE public.commercial_contacts
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commercial_contacts_user_unique
  ON public.commercial_contacts (user_id)
  WHERE user_id IS NOT NULL;

-- ─── 3. unchained_leads ───────────────────────────────────────────────────
-- One row per commercial opportunity (§4).
--
-- ─── The assignment is a SNAPSHOT (§15) ───────────────────────────────────
-- `assigned_commercial_id` is written ONCE, at creation, from the answer
-- public.resolve_commercial_contact() gave for this visitor's country and
-- language — the same call, the same answer, the same person the contact panel
-- showed them (§14). It is never recomputed. Deactivating a representative
-- removes them from FUTURE routing and leaves every historical lead exactly
-- where it is, which is what makes "how many leads did Alexander own in 2026"
-- a question with a stable answer. The only thing that moves a lead is an
-- administrator, through unchained_reassign_lead(), which records the move.
--
-- The foreign key deliberately has NO ON DELETE clause: NO ACTION is the
-- default and is what history requires. A representative who owns leads cannot
-- be deleted out from under them; they are deactivated, as Phase 4 established.
--
-- ─── What is NOT collected (§20) ──────────────────────────────────────────
-- No IP address, no user agent, no fingerprint, no coordinates, no city, no
-- referrer chain, no third-party identifier. `country_code` is the coarsest
-- location that can answer "which markets respond", and it is the only one
-- stored.

CREATE TABLE IF NOT EXISTS public.unchained_leads (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- ── Who they are ──────────────────────────────────────────────────────
  name          TEXT NOT NULL,
  company_name  TEXT,
  email         TEXT,
  phone         TEXT,

  -- ── Where, and in what language (§12) ─────────────────────────────────
  -- country_code is nullable because "we could not determine it" is a real and
  -- frequent outcome for a statically hosted site (see the landing repo's
  -- lib/commercial/countryDetection.ts), and a guessed country is worse than an
  -- absent one. `language` is not nullable: the visitor was reading the site in
  -- some language, and that is the language the panel spoke to them in.
  country_code  TEXT,
  language      TEXT NOT NULL,

  -- ── What they want ────────────────────────────────────────────────────
  service_interest  TEXT REFERENCES public.unchained_services(id) ON UPDATE CASCADE,
  message           TEXT,

  -- ── Attribution (§12) ─────────────────────────────────────────────────
  -- Captured at creation, never inferred later. `source` is set by the function
  -- that created the row and is NOT accepted from the caller: the public
  -- endpoint IS the website, so it writes 'website', and a future inbound
  -- channel writes its own value through its own entry point.
  source        TEXT NOT NULL DEFAULT 'website',
  source_page   TEXT,
  source_cta    TEXT,

  -- ── Ownership ─────────────────────────────────────────────────────────
  assigned_commercial_id  UUID REFERENCES public.commercial_contacts(id),

  -- ── Lifecycle (§5, §6) ────────────────────────────────────────────────
  status  TEXT NOT NULL DEFAULT 'new',

  first_contact_at  TIMESTAMPTZ,
  last_contact_at   TIMESTAMPTZ,
  converted_at      TIMESTAMPTZ,
  lost_at           TIMESTAMPTZ,

  -- ── Duplicate suppression (§43) ───────────────────────────────────────
  -- An opaque token the browser generates once per inquiry attempt. A
  -- double-click, a retried POST and a resubmitted form all carry the same one,
  -- so the second arrival finds the row instead of creating another. It is also
  -- what lets a later channel click be attached to the lead the same visitor
  -- just created, with no session and no account (§21, §44) — which is why it
  -- is a v4 UUID and not a guessable counter.
  client_token  UUID,

  CONSTRAINT unchained_leads_name_present
    CHECK (length(btrim(name)) BETWEEN 1 AND 120),
  CONSTRAINT unchained_leads_company_length
    CHECK (company_name IS NULL OR length(btrim(company_name)) BETWEEN 1 AND 200),

  -- Deliberately permissive, exactly as commercial_contacts_email_format is:
  -- reject "not an address at all", not "not RFC 5322".
  CONSTRAINT unchained_leads_email_format
    CHECK (email IS NULL OR (length(email) <= 200
       AND email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$')),

  -- Looser than the E.164 rule on commercial_contacts, and for a reason: that
  -- column holds a number WE dial from a generated link, so a malformed value
  -- produces a dead button. This one holds a number a prospect typed for a
  -- human to read and call back, and rejecting "+7 (999) 123-45-67" would lose
  -- a real lead over punctuation.
  CONSTRAINT unchained_leads_phone_format
    CHECK (phone IS NULL OR phone ~ '^\+?[0-9][0-9 ()./-]{5,31}$'),

  -- §23: a lead nobody can reply to is not a lead. The form asks for one of the
  -- two, and the database requires it independently.
  CONSTRAINT unchained_leads_reachable
    CHECK (email IS NOT NULL OR phone IS NOT NULL),

  CONSTRAINT unchained_leads_country_format
    CHECK (country_code IS NULL OR country_code ~ '^[A-Z]{2}$'),
  CONSTRAINT unchained_leads_language_format
    CHECK (language ~ '^[a-z]{2,3}$'),

  CONSTRAINT unchained_leads_message_length
    CHECK (message IS NULL OR length(message) <= 2000),

  CONSTRAINT unchained_leads_source_format
    CHECK (source ~ '^[a-z][a-z0-9_]{1,30}$'),
  -- A path, not a URL: no host, no scheme, no query string. Query strings are
  -- where campaign identifiers and personal data ride along, and none of that
  -- is needed to answer "which page produced this inquiry".
  CONSTRAINT unchained_leads_source_page_format
    CHECK (source_page IS NULL OR source_page ~ '^/[A-Za-z0-9/_-]{0,199}$'),
  CONSTRAINT unchained_leads_source_cta_format
    CHECK (source_cta IS NULL OR source_cta ~ '^[a-z][a-z0-9_]{0,63}$'),

  CONSTRAINT unchained_leads_status_valid
    CHECK (status IN ('new','contacted','qualified','proposal','won','lost','nurture')),

  -- The timestamps must agree with the status they describe. A row claiming
  -- `status = 'won'` with no `converted_at` would silently break every
  -- conversion metric. The trigger below sets them; these are the assertions
  -- that it did.
  CONSTRAINT unchained_leads_won_has_timestamp
    CHECK ((status = 'won') = (converted_at IS NOT NULL)),
  CONSTRAINT unchained_leads_lost_has_timestamp
    CHECK ((status = 'lost') = (lost_at IS NOT NULL)),
  -- A lead cannot have been contacted before it existed, and cannot have a last
  -- contact without a first one.
  CONSTRAINT unchained_leads_contact_order
    CHECK (
      (first_contact_at IS NULL OR first_contact_at >= created_at)
      AND (last_contact_at IS NULL OR first_contact_at IS NOT NULL)
      AND (last_contact_at IS NULL OR last_contact_at >= first_contact_at)
    )
);

-- §43: one token can only ever produce one lead. Partial, because client_token
-- is nullable — a lead created by a future non-web channel has no browser
-- token, and NULLs must not collide with one another.
CREATE UNIQUE INDEX IF NOT EXISTS unchained_leads_client_token_unique
  ON public.unchained_leads (client_token)
  WHERE client_token IS NOT NULL;

-- ─── 4. unchained_lead_events ─────────────────────────────────────────────
-- The timeline (§36), the internal notes (§17) and the audit trail (§37), in
-- ONE table.
--
-- That is a deliberate decision and not a shortcut. Those three are the same
-- fact — "something happened to this lead, here is who did it and when" — and
-- splitting them would produce a notes table, an events table and an audit
-- table that all have to be read together to draw one chronological list, and
-- that can disagree about the order of their own rows. §37 asks explicitly not
-- to build a second audit framework, and §36 asks explicitly not to build event
-- sourcing: this is neither. It is an append-only log with typed columns for
-- the four things the module actually records.
--
-- Nothing in here is derived state. `unchained_leads.status` remains the
-- authoritative current status; the events say how it got there. Replaying this
-- table is never required to answer a question, which is what keeps it out of
-- event-sourcing territory.
--
-- ─── Which events, and why not more (§18) ─────────────────────────────────
--   lead_created            the inquiry arrived
--   contact_channel_clicked the visitor pressed WhatsApp / Telegram / email /
--                           Cal.com. §19 and §47: a click, and NOT a
--                           conversation. The name says exactly what happened.
--   status_changed          carries from_status and to_status, so
--                           'commercial_contacted', 'proposal', 'lead_won' and
--                           'lead_lost' from §18's list are all this event with
--                           a different to_status. Four names for one fact
--                           would be four things to keep in agreement.
--   commercial_reassigned   carries from_commercial_id and to_commercial_id
--   note_added              carries body
--
-- Page views, hovers, language switches and scroll depth are deliberately
-- absent (§7, §18). They live in the website's analytics provider, where the
-- company can count them without attaching them to a named person.

CREATE TABLE IF NOT EXISTS public.unchained_lead_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id     UUID NOT NULL REFERENCES public.unchained_leads(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,

  -- Who did it. NULL means the visitor or the system did — a lead_created or a
  -- contact_channel_clicked has no signed-in actor by definition, and inventing
  -- one would put a name against an anonymous action. §37's "who changed it" is
  -- required for the two administrative events, and asserted below.
  actor_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  from_status          TEXT,
  to_status            TEXT,
  from_commercial_id   UUID REFERENCES public.commercial_contacts(id),
  to_commercial_id     UUID REFERENCES public.commercial_contacts(id),
  channel              TEXT,
  body                 TEXT,

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT unchained_lead_events_type_valid
    CHECK (event_type IN (
      'lead_created',
      'contact_channel_clicked',
      'status_changed',
      'commercial_reassigned',
      'note_added'
    )),

  CONSTRAINT unchained_lead_events_status_valid
    CHECK (
      (from_status IS NULL OR from_status IN ('new','contacted','qualified','proposal','won','lost','nurture'))
      AND (to_status IS NULL OR to_status IN ('new','contacted','qualified','proposal','won','lost','nurture'))
    ),

  -- §19: the four channels the panel actually offers, and no fifth.
  CONSTRAINT unchained_lead_events_channel_valid
    CHECK (channel IS NULL OR channel IN ('whatsapp','telegram','email','calcom')),

  CONSTRAINT unchained_lead_events_body_length
    CHECK (body IS NULL OR length(btrim(body)) BETWEEN 1 AND 4000),

  -- Each event type carries the payload it is about and no other. Without this
  -- a status_changed row could be written with a note body and no statuses, and
  -- the timeline would render a blank line nobody could explain.
  CONSTRAINT unchained_lead_events_payload_matches_type
    CHECK (
      CASE event_type
        WHEN 'status_changed'          THEN to_status IS NOT NULL
        WHEN 'commercial_reassigned'   THEN to_commercial_id IS NOT NULL
                                         OR from_commercial_id IS NOT NULL
        WHEN 'note_added'              THEN body IS NOT NULL AND actor_id IS NOT NULL
        WHEN 'contact_channel_clicked' THEN channel IS NOT NULL
        ELSE TRUE
      END
    )
);

-- The timeline query, and the only access path this table has: one lead's
-- events, oldest first. DESC on created_at is not indexed separately — the row
-- count per lead is small enough that the planner reverses this one for free.
CREATE INDEX IF NOT EXISTS idx_unchained_lead_events_lead
  ON public.unchained_lead_events (lead_id, created_at);

-- Channel attribution across all leads (§19): "which channels actually generate
-- conversations". Partial, because it is the only cross-lead question asked of
-- this table and the other four event types would only dilute the index.
CREATE INDEX IF NOT EXISTS idx_unchained_lead_events_channel
  ON public.unchained_lead_events (channel, created_at)
  WHERE event_type = 'contact_channel_clicked';

-- ─── 5. unchained_lead_throttle (§22) ─────────────────────────────────────
-- Rate-limit buckets for the anonymous endpoint. Reasonable protection using
-- what this architecture already has — not an anti-spam system.
--
-- ─── The privacy shape of this table (§20) ────────────────────────────────
-- A bucket key is `md5(<salt>:<subject>)` where subject is either the caller's
-- forwarded IP or the lower-cased email being submitted. That md5 is a
-- PSEUDONYM and this file does not claim it is anonymisation: an md5 of an IPv4
-- address is brute-forceable in seconds. It is treated accordingly — the row
-- holds no lead reference, no name and no message, it is pruned an hour after
-- its window opens, and nothing joins it to unchained_leads. It exists to
-- answer "has this bucket submitted five times in fifteen minutes" and is
-- incapable of answering anything else.
--
-- md5() rather than a stronger digest because pgcrypto's presence in this
-- database was not established, md5() is built in, and no security property
-- here depends on collision resistance.

CREATE TABLE IF NOT EXISTS public.unchained_lead_throttle (
  bucket             TEXT PRIMARY KEY,
  window_started_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  hits               INTEGER NOT NULL DEFAULT 1,

  CONSTRAINT unchained_lead_throttle_hits_positive CHECK (hits > 0)
);

CREATE INDEX IF NOT EXISTS idx_unchained_lead_throttle_window
  ON public.unchained_lead_throttle (window_started_at);

-- ─── 6. Indexes on unchained_leads (§64) ──────────────────────────────────
-- Chosen against the queries the admin screens actually issue, not against the
-- column list.
--
--   · the list, default order            (created_at DESC)
--   · "leads needing attention"          (status, created_at DESC)
--   · a commercial's own leads, and the  (assigned_commercial_id, created_at DESC)
--     per-commercial performance report
--   · "leads by country" and its filter  (country_code)
--   · "leads by language" and its filter (language)
--   · search by address, case-insensitive, which is how a commercial finds a
--     prospect who wrote in again                          (lower(email))
--   · the "recently updated" sort                          (updated_at DESC)
--
-- Deliberately NOT indexed: `service_interest` (three values over the whole
-- table — the planner will scan), `source` (one value today), `name` and
-- `company_name` (searched with ILIKE '%…%', which no btree can serve; if the
-- dataset ever makes that slow the answer is pg_trgm, not a btree that would
-- never be read).

CREATE INDEX IF NOT EXISTS idx_unchained_leads_created
  ON public.unchained_leads (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_leads_status_created
  ON public.unchained_leads (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_leads_commercial_created
  ON public.unchained_leads (assigned_commercial_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_unchained_leads_country
  ON public.unchained_leads (country_code);

CREATE INDEX IF NOT EXISTS idx_unchained_leads_language
  ON public.unchained_leads (language);

CREATE INDEX IF NOT EXISTS idx_unchained_leads_email
  ON public.unchained_leads (lower(email));

CREATE INDEX IF NOT EXISTS idx_unchained_leads_updated
  ON public.unchained_leads (updated_at DESC);

-- ─── 7. The status machine (§6) ───────────────────────────────────────────
-- "Do not allow arbitrary status transitions that make analytics meaningless."
--
-- The permitted moves, and nothing else:
--
--     new ──► contacted ──► qualified ──► proposal ──► won
--      │         │             │             │
--      └─────────┴─────────────┴─────────────┴──────► lost
--      │         │             │
--      └─────────┴─────────────┴──► nurture ──► contacted / qualified / lost
--
--                       lost ──► contacted   (a lost lead that came back)
--
-- `won` is terminal. A won lead that later churns is a customer-lifecycle fact
-- and belongs to a phase that has customers; recording it as a lead status
-- would corrupt the conversion count that §48 exists to start.
--
-- `lost` is reopenable to `contacted` only. Losing a lead by mistake happens,
-- and the alternative to reopening it is a duplicate row, which is worse for
-- every metric on the overview. The move is recorded as a status_changed event
-- like any other, so the history shows the reopen rather than hiding it.
--
-- Skipping stages forward is NOT permitted: new → won would produce a
-- conversion with no contact and no qualification, and §33's funnel would then
-- report percentages over stages that never happened.

CREATE OR REPLACE FUNCTION public.unchained_lead_transition_allowed(
  p_from TEXT,
  p_to   TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = ''
AS $fn$
  SELECT CASE p_from
    WHEN 'new'       THEN p_to IN ('contacted', 'nurture', 'lost')
    WHEN 'contacted' THEN p_to IN ('qualified', 'nurture', 'lost')
    WHEN 'qualified' THEN p_to IN ('proposal',  'nurture', 'lost')
    WHEN 'proposal'  THEN p_to IN ('won', 'lost')
    WHEN 'nurture'   THEN p_to IN ('contacted', 'qualified', 'lost')
    WHEN 'lost'      THEN p_to = 'contacted'
    ELSE FALSE  -- 'won' is terminal, and an unknown status goes nowhere
  END;
$fn$;

-- The trigger that enforces it, and that owns every lifecycle timestamp.
--
-- Timestamps are set HERE rather than by the callers so that they cannot
-- disagree with the status: §34 asks that time-to-first-contact not be
-- calculated until a real `contacted` event exists, and the only way to make
-- that true by construction is for the transition into 'contacted' to be the
-- thing that writes first_contact_at.

CREATE OR REPLACE FUNCTION public.unchained_leads_before_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NOT public.unchained_lead_transition_allowed(OLD.status, NEW.status) THEN
      RAISE EXCEPTION
        'unchained_leads: % is not a permitted transition from %', NEW.status, OLD.status
        USING ERRCODE = 'check_violation';
    END IF;

    -- First contact is written once and never moved: it is the denominator of
    -- an operational KPI, and a KPI that can be reset is not one.
    IF NEW.status = 'contacted' THEN
      NEW.first_contact_at := COALESCE(OLD.first_contact_at, now());
      NEW.last_contact_at  := now();
    END IF;

    NEW.converted_at := CASE WHEN NEW.status = 'won'  THEN COALESCE(OLD.converted_at, now()) END;
    NEW.lost_at      := CASE WHEN NEW.status = 'lost' THEN COALESCE(OLD.lost_at, now())      END;
  END IF;

  RETURN NEW;
END;
$fn$;

-- Same default-privilege trap as everything else in this file: revoked from
-- anon explicitly, not merely from PUBLIC. It leaks nothing — it is a pure
-- function over two strings — but the public surface of this module is a list
-- of exactly two functions, and it is kept that way deliberately.
REVOKE ALL ON FUNCTION public.unchained_lead_transition_allowed(TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_lead_transition_allowed(TEXT, TEXT) TO authenticated;

DROP TRIGGER IF EXISTS trg_unchained_leads_before_update ON public.unchained_leads;
CREATE TRIGGER trg_unchained_leads_before_update
  BEFORE UPDATE ON public.unchained_leads
  FOR EACH ROW EXECUTE FUNCTION public.unchained_leads_before_update();

-- ─── 8. The events table is append-only ───────────────────────────────────
-- §37: an audit trail that can be rewritten is not one. Rows are inserted by
-- the SECURITY DEFINER functions below and by nothing else; UPDATE and DELETE
-- are refused for every caller, including a super_admin holding a psql prompt
-- through PostgREST. Deleting the LEAD still cascades, which is the one erasure
-- path a future retention or GDPR request needs (§50).

CREATE OR REPLACE FUNCTION public.unchained_lead_events_append_only()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  RAISE EXCEPTION 'unchained_lead_events is append-only: % is not permitted', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$fn$;

DROP TRIGGER IF EXISTS trg_unchained_lead_events_append_only ON public.unchained_lead_events;
CREATE TRIGGER trg_unchained_lead_events_append_only
  BEFORE UPDATE OR DELETE ON public.unchained_lead_events
  FOR EACH ROW EXECUTE FUNCTION public.unchained_lead_events_append_only();

-- ─── 9. Authorization predicates (§38, §39, §40) ──────────────────────────
-- Phase 5 answered "may this person open the Unchained product". These answer
-- the two questions that follow: "may they see EVERY lead" and "which
-- representative are they".
--
-- Both are SECURITY DEFINER because they read tables the caller cannot select
-- — product_memberships is self-read only, commercial_contacts is super-admin
-- only — and both are contained by shape: no parameters, one scalar out,
-- STABLE, identity taken from auth.uid() and from nowhere else. There is
-- deliberately no user_id argument, for the same reason has_product_access()
-- has none: a client must not be able to ask a question about somebody else.
--
-- ─── Which roles manage, and why these ────────────────────────────────────
-- 'unchained_admin' and 'commercial_manager' are the two membership roles that
-- see the whole pipeline. They are read as data from public.product_memberships
-- exactly as Phase 5 intended — no CHECK constraint to widen, no migration
-- needed to appoint someone, and no new global role in public.roles that would
-- reopen the .maybeSingle() hazard TanCerca still carries.
--
-- Any OTHER unchained membership role — 'commercial' being the one that exists
-- in practice — manages nothing and sees only what is assigned to them. That is
-- §40's requirement stated as a default rather than as an exception: broader
-- visibility has to be granted deliberately by naming one of the two roles
-- above.

CREATE OR REPLACE FUNCTION public.unchained_manages_leads()
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
                  FROM public.product_memberships m
                  JOIN public.platform_products p ON p.id = m.product_id
                 WHERE m.user_id    = (SELECT auth.uid())
                   AND m.product_id = 'unchained'
                   AND m.active
                   AND p.enabled
                   AND m.role IN ('unchained_admin', 'commercial_manager')
              )
         );
$fn$;

-- Which representative the signed-in person IS, or NULL.
--
-- Deliberately does NOT filter on commercial_contacts.active: a representative
-- who has been removed from routing still owns the leads they were assigned,
-- and locking them out of their own history the moment they stop receiving new
-- inquiries would be a data-retention accident rather than a policy. Removing
-- their ACCESS is done by revoking the product membership, which is the control
-- that exists for it.
--
-- Requires an active 'unchained' membership: the link column alone is a
-- statement about identity, not a grant. Somebody whose membership has been
-- revoked resolves to NULL here and sees nothing, even though the row still
-- names them.

CREATE OR REPLACE FUNCTION public.my_commercial_contact_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT c.id
    FROM public.commercial_contacts c
   WHERE c.user_id = (SELECT auth.uid())
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

-- ─── Revoking from PUBLIC is NOT enough in this database ──────────────────
-- Supabase ships
--
--     ALTER DEFAULT PRIVILEGES IN SCHEMA public
--       GRANT ALL ON FUNCTIONS TO anon, authenticated, service_role;
--
-- so every function created here arrives with an EXPLICIT anon grant, not an
-- inherited PUBLIC one. `REVOKE ... FROM PUBLIC` does not touch an explicit
-- grant, and an administrative predicate would have been left callable by an
-- anonymous holder of the website's key.
--
-- Every REVOKE in this file therefore names `anon` (and `authenticated` where
-- the function is internal) explicitly, and the apply-time assertion below
-- fails the migration if any of them is ever reachable by anon again. Phase 4's
-- resolver was unaffected — it GRANTs to anon deliberately — but this is the
-- pattern to copy, not the PUBLIC-only revoke.
REVOKE ALL ON FUNCTION public.unchained_manages_leads()   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_commercial_contact_id()  FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_manages_leads()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_commercial_contact_id() TO authenticated;

-- ─── 10. Rate limiting for the public endpoint (§22) ──────────────────────
-- One bucket, one window, one answer. Called only from create_public_lead().
--
-- Returns TRUE when the request is within the limit and FALSE when it is not,
-- and counts the hit either way — a caller who keeps hammering keeps their
-- window open rather than resetting it by trying again.

CREATE OR REPLACE FUNCTION public.unchained_lead_throttle_ok(
  p_subject  TEXT,
  p_limit    INTEGER DEFAULT 5,
  p_window   INTERVAL DEFAULT INTERVAL '15 minutes'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_bucket TEXT;
  v_hits   INTEGER;
BEGIN
  IF p_subject IS NULL OR btrim(p_subject) = '' THEN
    -- Nothing to key on. Not a reason to refuse a legitimate inquiry: the
    -- honeypot, the validation and the duplicate check all still apply.
    RETURN TRUE;
  END IF;

  v_bucket := md5('unchained-lead-throttle:' || btrim(p_subject));

  -- Opportunistic pruning, one hour after a window opened. No scheduled job
  -- exists in this project, and this table must not grow without bound.
  DELETE FROM public.unchained_lead_throttle
   WHERE window_started_at < now() - INTERVAL '1 hour';

  -- Aliased as `t` so the conflict clause names the EXISTING row without
  -- depending on a schema-qualified column reference resolving under an empty
  -- search_path. A window that has expired restarts at one instead of being
  -- carried forward, which is what makes this a sliding limit rather than a
  -- permanent ban.
  INSERT INTO public.unchained_lead_throttle AS t (bucket, window_started_at, hits)
       VALUES (v_bucket, now(), 1)
  ON CONFLICT (bucket) DO UPDATE
     SET hits = CASE
                  WHEN t.window_started_at < now() - p_window THEN 1
                  ELSE t.hits + 1
                END,
         window_started_at = CASE
                  WHEN t.window_started_at < now() - p_window THEN now()
                  ELSE t.window_started_at
                END
  RETURNING t.hits INTO v_hits;

  RETURN v_hits <= p_limit;
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_lead_throttle_ok(TEXT, INTEGER, INTERVAL)
  FROM PUBLIC, anon, authenticated;
-- Not granted to anon or authenticated. It is an internal helper of
-- create_public_lead(), which is SECURITY DEFINER and therefore calls it as the
-- owner. Exposing it would hand an anonymous caller a way to fill somebody
-- else's bucket.

-- ─── 11. create_public_lead — the ONLY public write (§9, §21) ─────────────
-- The public website must never insert into unchained_leads. It calls this,
-- which is the same shape as Phase 6's resolver: SECURITY DEFINER, a fixed set
-- of scalar parameters, no predicate to inject, and a return value that says
-- nothing the visitor does not need (§42).
--
-- ─── The single assignment decision (§14) ─────────────────────────────────
-- The commercial is resolved HERE, by calling
-- public.resolve_commercial_contact(country, language) — the SAME function the
-- contact panel called moments earlier to decide whose name to display. There
-- is no second algorithm and no client-supplied `assigned_commercial_id`
-- parameter to override it, which is what makes Test 6 of §56 pass by
-- construction: a caller cannot choose their representative because there is
-- no argument through which to name one.
--
-- Calling it again rather than trusting an id from the browser is deliberate.
-- The browser holds the ANSWER, not the authority: accepting an id from it
-- would let anyone assign every lead in the system to one person. Re-asking
-- costs one indexed lookup and cannot be forged. In the ordinary case — the
-- visitor submits the form from the panel that just resolved — the two calls
-- are milliseconds apart against the same data and cannot disagree. In the rare
-- case where an administrator changed routing in between, the SECOND answer is
-- the correct one to record: it is the routing configuration in force when the
-- lead was actually created.
--
-- ─── What the visitor gets back (§42) ─────────────────────────────────────
--   { "success": true }                        the inquiry was recorded
--   { "success": false, "reason": "invalid" }  the form has a problem to fix
--   { "success": false, "reason": "rate_limited" }
--
-- No lead id, no commercial id, no commercial name, no routing metadata, no
-- status, no internal error text. The two failure reasons exist because the
-- form has a concrete requirement for them: it must be able to tell the visitor
-- to correct a field, or to wait a moment. A honeypot hit and a duplicate both
-- return success — silently, because saying "you are being filtered" is a hint
-- for the next attempt, and because a duplicate submission genuinely DID
-- succeed the first time.

CREATE OR REPLACE FUNCTION public.create_public_lead(
  p_name             TEXT,
  p_email            TEXT    DEFAULT NULL,
  p_phone            TEXT    DEFAULT NULL,
  p_company_name     TEXT    DEFAULT NULL,
  p_country_code     TEXT    DEFAULT NULL,
  p_language         TEXT    DEFAULT NULL,
  p_service_interest TEXT    DEFAULT NULL,
  p_message          TEXT    DEFAULT NULL,
  p_source_page      TEXT    DEFAULT NULL,
  p_source_cta       TEXT    DEFAULT NULL,
  p_client_token     UUID    DEFAULT NULL,
  -- §22: a field no human ever fills in, because no human can see it. Named
  -- for what it is rather than disguised as something plausible — the
  -- disguise belongs in the markup, where a bot reads it, not in the API,
  -- where only reviewers do.
  p_honeypot         TEXT    DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_name      TEXT;
  v_company   TEXT;
  v_email     TEXT;
  v_phone     TEXT;
  v_country   TEXT;
  v_language  TEXT;
  v_service   TEXT;
  v_message   TEXT;
  v_page      TEXT;
  v_cta       TEXT;
  v_headers   JSONB;
  v_ip        TEXT;
  v_commercial UUID;
  v_lead_id   UUID;
BEGIN
  -- ── Honeypot, first and silently ──────────────────────────────────────
  IF p_honeypot IS NOT NULL AND btrim(p_honeypot) <> '' THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- ── Normalise ─────────────────────────────────────────────────────────
  -- Trim everything, empty becomes NULL, case is canonicalised where the
  -- column is stored canonically. This runs BEFORE validation so that
  -- "  RU  " and "ru" are the same country, exactly as the resolver treats
  -- them.
  v_name     := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_company  := NULLIF(btrim(COALESCE(p_company_name, '')), '');
  v_email     := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone     := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_country   := NULLIF(upper(btrim(COALESCE(p_country_code, ''))), '');
  v_language  := NULLIF(lower(btrim(COALESCE(p_language, ''))), '');
  v_service   := NULLIF(btrim(COALESCE(p_service_interest, '')), '');
  v_message   := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_page      := NULLIF(btrim(COALESCE(p_source_page, '')), '');
  v_cta       := NULLIF(lower(btrim(COALESCE(p_source_cta, ''))), '');

  -- ── Validate (§23) ────────────────────────────────────────────────────
  -- The backend is the boundary. Everything the form checks is checked again
  -- here, against the same rules the table's CHECK constraints enforce, so
  -- that a caller who never loaded the form gets the same answer.
  --
  -- The identity and reachability rules produce 'invalid', because the visitor
  -- can fix them. Attribution that does not parse is DROPPED to NULL instead:
  -- refusing a real inquiry because the page path looked odd would trade a
  -- lead for a data-quality nicety, and §12 wants attribution captured, not
  -- enforced.
  IF v_name IS NULL OR length(v_name) > 120 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_email IS NULL AND v_phone IS NULL THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_email IS NOT NULL
     AND (length(v_email) > 200
          OR v_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_phone IS NOT NULL AND v_phone !~ '^\+?[0-9][0-9 ()./-]{5,31}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_company IS NOT NULL AND length(v_company) > 200 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_message IS NOT NULL AND length(v_message) > 2000 THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  -- A language is required and is never guessed: the website always sends the
  -- locale the visitor is reading in, so an absent or malformed one means the
  -- caller is not the website.
  IF v_language IS NULL OR v_language !~ '^[a-z]{2,3}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  -- A country that is not a country is dropped rather than refused: country
  -- detection legitimately fails, and NULL is the honest record of that (§12).
  IF v_country IS NOT NULL AND v_country !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
  END IF;

  -- §13: the service must be one this business actually offers. An unknown
  -- slug is refused rather than dropped, because it can only come from a
  -- caller inventing a taxonomy, and silently storing NULL would hide that.
  IF v_service IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.unchained_services s WHERE s.id = v_service AND s.active
     ) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_page IS NOT NULL AND v_page !~ '^/[A-Za-z0-9/_-]{0,199}$' THEN
    v_page := NULL;
  END IF;

  IF v_cta IS NOT NULL AND v_cta !~ '^[a-z][a-z0-9_]{0,63}$' THEN
    v_cta := NULL;
  END IF;

  -- ── Idempotency (§43) ─────────────────────────────────────────────────
  -- The token the browser holds for this inquiry. A double-click, a retried
  -- POST and a resubmitted form all carry it, and all find the row that
  -- already exists.
  IF p_client_token IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.unchained_leads l WHERE l.client_token = p_client_token
     ) THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- The second net, for a client that lost its token between attempts: the
  -- same address, from the same page, inside ten minutes is the same inquiry.
  -- Narrow on purpose — a prospect who writes again the next day about a
  -- different service is a new opportunity and must not be swallowed.
  IF v_email IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.unchained_leads l
        WHERE lower(l.email) = v_email
          AND l.created_at > now() - INTERVAL '10 minutes'
          AND l.source_page IS NOT DISTINCT FROM v_page
     ) THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- ── Throttle (§22) ────────────────────────────────────────────────────
  -- Two buckets: the network the request came from, and the address being
  -- submitted. Both are counted; either being over the limit refuses.
  --
  -- request.headers is set by PostgREST. `true` on current_setting means "NULL
  -- if unset" rather than an exception — the function must also work when it
  -- is called from psql, where there is no request.
  v_headers := NULLIF(current_setting('request.headers', true), '')::JSONB;
  v_ip := NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');

  IF v_ip IS NOT NULL AND NOT public.unchained_lead_throttle_ok('ip:' || v_ip) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'rate_limited');
  END IF;

  IF v_email IS NOT NULL AND NOT public.unchained_lead_throttle_ok('email:' || v_email) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'rate_limited');
  END IF;

  -- ── The one assignment decision (§14) ─────────────────────────────────
  SELECT r.commercial_id
    INTO v_commercial
    FROM public.resolve_commercial_contact(v_country, v_language) r;

  -- v_commercial may be NULL, and that is a real outcome, not a failure: the
  -- visitor was shown the global fallback and their inquiry is unassigned until
  -- an administrator routes it. Recording it unassigned is the honest version
  -- of §58 — inventing an owner would put a lead in someone's queue that
  -- routing never gave them.

  -- ── Write ─────────────────────────────────────────────────────────────
  INSERT INTO public.unchained_leads (
    name, company_name, email, phone,
    country_code, language, service_interest, message,
    source, source_page, source_cta,
    assigned_commercial_id, status, client_token
  ) VALUES (
    v_name, v_company, v_email, v_phone,
    v_country, v_language, v_service, v_message,
    'website', v_page, v_cta,
    v_commercial, 'new', p_client_token
  )
  -- Belt and braces against two identical requests racing past the SELECT
  -- above: the unique index decides, and the loser is not an error.
  ON CONFLICT (client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_lead_id;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- ── The first entry on the timeline (§36) ─────────────────────────────
  -- actor_id is NULL: an anonymous visitor created this, and there is no
  -- administrator to name. to_commercial_id carries the routing decision, so
  -- the timeline's first line reads "created, assigned to X" even after a
  -- later reassignment moved it.
  INSERT INTO public.unchained_lead_events (lead_id, event_type, to_commercial_id, to_status)
  VALUES (v_lead_id, 'lead_created', v_commercial, 'new');

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;

-- Revoked from everybody first, then granted back to exactly two roles. The
-- default-privilege grant described above would otherwise mean this function's
-- reachability was decided by a database-wide setting rather than by this file.
REVOKE ALL ON FUNCTION public.create_public_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT
) TO anon, authenticated;

-- ─── 12. record_public_lead_channel_click (§19, §44, §47) ─────────────────
-- A visitor pressed WhatsApp. That is a CLICK, and this records a click.
--
-- §47 is the whole design of this function: "a button click means contact
-- channel clicked, not lead contacted". The event type says so, the column it
-- writes says so, and nothing in this file ever promotes a click into a
-- conversation, a reply, a meeting or a status change. `first_contact_at` is
-- untouched: that timestamp belongs to the commercial saying they made contact,
-- which is a claim a human makes and a click cannot.
--
-- ─── Why it needs no session and no account (§21) ─────────────────────────
-- The visitor is identified by the client token their own browser generated
-- when they submitted the inquiry. No lead id is accepted — an attacker with a
-- lead id could otherwise write events onto somebody else's opportunity — and
-- an unknown token is a silent no-op that returns exactly what a known one
-- returns, so the function cannot be used to test whether a token exists.
--
-- §44: a visitor who clicks WhatsApp WITHOUT submitting the form holds no
-- token, and nothing is written here. That click is counted by the website's
-- analytics provider as an anonymous event, which is the correct place for it:
-- there is no person to attach it to, and this function will not invent one.

CREATE OR REPLACE FUNCTION public.record_public_lead_channel_click(
  p_client_token UUID,
  p_channel      TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_channel TEXT;
  v_lead_id UUID;
BEGIN
  v_channel := lower(btrim(COALESCE(p_channel, '')));

  IF p_client_token IS NULL
     OR v_channel NOT IN ('whatsapp', 'telegram', 'email', 'calcom') THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  SELECT l.id INTO v_lead_id
    FROM public.unchained_leads l
   WHERE l.client_token = p_client_token;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- One click per channel per five minutes. A visitor who taps WhatsApp three
  -- times because the app was slow to open did not make three attempts, and a
  -- timeline that says they did is a timeline nobody trusts.
  IF EXISTS (
       SELECT 1 FROM public.unchained_lead_events e
        WHERE e.lead_id = v_lead_id
          AND e.event_type = 'contact_channel_clicked'
          AND e.channel = v_channel
          AND e.created_at > now() - INTERVAL '5 minutes'
     ) THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  INSERT INTO public.unchained_lead_events (lead_id, event_type, channel)
  VALUES (v_lead_id, 'contact_channel_clicked', v_channel);

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;

REVOKE ALL ON FUNCTION public.record_public_lead_channel_click(UUID, TEXT)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_public_lead_channel_click(UUID, TEXT) TO anon, authenticated;

-- ─── 13. Working a lead: the three administrative operations ──────────────
-- Status, assignment and notes are changed through functions rather than
-- through direct UPDATEs, for one reason: each of them must write its event in
-- the same transaction as its change. A client that could UPDATE the row
-- directly could change a status without leaving a trace, and §37's audit
-- requirement would hold only as long as every caller remembered to be honest.
--
-- The permission decision is made inside each function, because SECURITY
-- DEFINER means RLS is not there to make it. Each asks the same question the
-- SELECT policy asks, so what a person can change is exactly what they can see.

-- May the caller work this lead at all?
--
-- A manager may work every lead. A commercial may work the leads assigned to
-- them — following up their own pipeline is their job, and a queue they can
-- read but not update would be a list, not a workflow. Nobody else, including a
-- signed-in TanCerca administrator, may touch any of it (§38).
CREATE OR REPLACE FUNCTION public.unchained_can_work_lead(p_lead_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
      FROM public.unchained_leads l
     WHERE l.id = p_lead_id
       AND (
             public.unchained_manages_leads()
             OR (
                  public.my_commercial_contact_id() IS NOT NULL
                  AND l.assigned_commercial_id = public.my_commercial_contact_id()
                )
           )
  );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_can_work_lead(UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_can_work_lead(UUID) TO authenticated;

-- ─── Status (§6, §48, §60) ────────────────────────────────────────────────
-- The transition itself is validated by the trigger, so an invalid move raises
-- whether it arrives through this function or any other path. What this adds is
-- the audit row and the optional note that explains the move — "why was this
-- lost" being the single most useful thing a pipeline can record.

CREATE OR REPLACE FUNCTION public.unchained_set_lead_status(
  p_lead_id UUID,
  p_status  TEXT,
  p_note    TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor  UUID := (SELECT auth.uid());
  v_from   TEXT;
  v_status TEXT;
  v_note   TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_can_work_lead(p_lead_id) THEN
    RAISE EXCEPTION 'not authorized to change this lead' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_status := lower(btrim(COALESCE(p_status, '')));
  v_note   := NULLIF(btrim(COALESCE(p_note, '')), '');

  SELECT l.status INTO v_from FROM public.unchained_leads l WHERE l.id = p_lead_id;

  IF v_from = v_status THEN
    -- Not an error and not an event. Re-selecting the current status is
    -- something a UI does; recording it would put a line on the timeline
    -- saying nothing happened.
    RETURN jsonb_build_object('success', TRUE, 'status', v_from);
  END IF;

  UPDATE public.unchained_leads SET status = v_status WHERE id = p_lead_id;

  INSERT INTO public.unchained_lead_events
    (lead_id, event_type, actor_id, from_status, to_status, body)
  VALUES
    (p_lead_id, 'status_changed', v_actor, v_from, v_status, v_note);

  RETURN jsonb_build_object('success', TRUE, 'status', v_status);
END;
$fn$;

-- ─── Reassignment (§16, §59) ──────────────────────────────────────────────
-- Managers only. A commercial may not hand their own lead to somebody else,
-- and — more to the point — may not take somebody else's.
--
-- The history is the event row: previous commercial, new commercial, who moved
-- it and when, which is exactly the "lightweight assignment history" §16 asks
-- for and needs no second table to hold. Nothing is overwritten silently: the
-- lead row carries the CURRENT owner, and the event log carries every owner it
-- has ever had, in order.

CREATE OR REPLACE FUNCTION public.unchained_reassign_lead(
  p_lead_id       UUID,
  p_commercial_id UUID,
  p_note          TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_from  UUID;
  v_note  TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_manages_leads() THEN
    RAISE EXCEPTION 'not authorized to reassign leads' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_note := NULLIF(btrim(COALESCE(p_note, '')), '');

  SELECT l.assigned_commercial_id INTO v_from
    FROM public.unchained_leads l WHERE l.id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'lead not found' USING ERRCODE = 'no_data_found';
  END IF;

  -- An unassignment (NULL) is permitted and is a real operation: a lead whose
  -- routing produced nobody sits unassigned until someone takes it, and taking
  -- it back off a person is how that is undone.
  IF p_commercial_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.commercial_contacts c WHERE c.id = p_commercial_id
     ) THEN
    RAISE EXCEPTION 'unknown commercial' USING ERRCODE = 'foreign_key_violation';
  END IF;

  IF v_from IS NOT DISTINCT FROM p_commercial_id THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  UPDATE public.unchained_leads
     SET assigned_commercial_id = p_commercial_id
   WHERE id = p_lead_id;

  INSERT INTO public.unchained_lead_events
    (lead_id, event_type, actor_id, from_commercial_id, to_commercial_id, body)
  VALUES
    (p_lead_id, 'commercial_reassigned', v_actor, v_from, p_commercial_id, v_note);

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;

-- ─── Internal notes (§17) ─────────────────────────────────────────────────
-- Private. There is no public function that reads them, no public function that
-- returns them, and the only SELECT path is the RLS policy on the events table,
-- which anon cannot reach at all.

CREATE OR REPLACE FUNCTION public.unchained_add_lead_note(
  p_lead_id UUID,
  p_body    TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  v_actor UUID := (SELECT auth.uid());
  v_body  TEXT;
BEGIN
  IF v_actor IS NULL OR NOT public.unchained_can_work_lead(p_lead_id) THEN
    RAISE EXCEPTION 'not authorized to add a note to this lead' USING ERRCODE = 'insufficient_privilege';
  END IF;

  v_body := NULLIF(btrim(COALESCE(p_body, '')), '');
  IF v_body IS NULL OR length(v_body) > 4000 THEN
    RAISE EXCEPTION 'a note must be between 1 and 4000 characters' USING ERRCODE = 'check_violation';
  END IF;

  INSERT INTO public.unchained_lead_events (lead_id, event_type, actor_id, body)
  VALUES (p_lead_id, 'note_added', v_actor, v_body);

  -- The lead's own updated_at is what the "Recently updated" sort reads, and a
  -- note is activity on the lead. Touching it here rather than from a trigger
  -- on the events table keeps the rule visible: notes count as work, clicks
  -- (which the visitor makes, not the team) do not.
  UPDATE public.unchained_leads SET updated_at = now() WHERE id = p_lead_id;

  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;

REVOKE ALL ON FUNCTION public.unchained_set_lead_status(UUID, TEXT, TEXT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_reassign_lead(UUID, UUID, TEXT)   FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.unchained_add_lead_note(UUID, TEXT)         FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_set_lead_status(UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_reassign_lead(UUID, UUID, TEXT)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.unchained_add_lead_note(UUID, TEXT)         TO authenticated;

-- ─── 14. Metrics (§29-§34) ────────────────────────────────────────────────
-- One read, aggregated in the database, returning counts and nothing else.
--
-- ─── Why SECURITY INVOKER, unlike everything else in this file ────────────
-- Deliberate, and the most important line in this function. It runs as the
-- CALLER, so the RLS policy on unchained_leads applies to the aggregate exactly
-- as it applies to the list: a commercial's overview counts a commercial's
-- leads. A SECURITY DEFINER version would have to re-implement the scoping
-- rule, and the day the two drifted apart, the dashboard would quietly report
-- numbers the person is not allowed to see.
--
-- ─── Honesty rules (§30, §33, §55) ────────────────────────────────────────
-- Every number here is a count of rows that exist. There are no rates, no
-- projections and no percentages: `qualified` and `total` are returned, and the
-- CALLER decides whether a conversion rate over four leads is worth printing.
-- That decision belongs in the UI, which knows how much space it has to say
-- "not enough data" — but the data layer must never hand it a fabricated
-- denominator to divide by.
--
-- `first_contact` reports how many leads have actually been contacted alongside
-- the average, so a "4 hours" that came from one lead cannot be read as a
-- track record (§34).

CREATE OR REPLACE FUNCTION public.unchained_lead_metrics(
  p_since TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $fn$
  WITH scoped AS (
    SELECT l.*
      FROM public.unchained_leads l
     WHERE p_since IS NULL OR l.created_at >= p_since
  )
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM scoped),

    'by_status', (
      SELECT COALESCE(jsonb_object_agg(status, n), '{}'::JSONB)
        FROM (SELECT status, count(*) AS n FROM scoped GROUP BY status) s
    ),

    -- §30: "Do not show empty geographic data as if it were meaningful."
    -- Leads with no determined country are counted under the 'unknown' key
    -- rather than dropped, so a chart cannot silently understate the total.
    'by_country', (
      SELECT COALESCE(jsonb_object_agg(k, n), '{}'::JSONB)
        FROM (
          SELECT COALESCE(country_code, 'unknown') AS k, count(*) AS n
            FROM scoped GROUP BY 1
        ) s
    ),

    'by_language', (
      SELECT COALESCE(jsonb_object_agg(language, n), '{}'::JSONB)
        FROM (SELECT language, count(*) AS n FROM scoped GROUP BY language) s
    ),

    'by_service', (
      SELECT COALESCE(jsonb_object_agg(k, n), '{}'::JSONB)
        FROM (
          SELECT COALESCE(service_interest, 'unspecified') AS k, count(*) AS n
            FROM scoped GROUP BY 1
        ) s
    ),

    -- §32: never a raw lead count on its own. Each commercial's row carries
    -- the whole funnel, so "20 leads and 0 qualified" is visible as such.
    'by_commercial', (
      SELECT COALESCE(jsonb_agg(entry), '[]'::JSONB)
        FROM (
          SELECT jsonb_build_object(
                   'commercial_id', s.assigned_commercial_id,
                   'name',          c.name,
                   'total',     count(*),
                   'contacted', count(*) FILTER (WHERE s.first_contact_at IS NOT NULL),
                   'qualified', count(*) FILTER (WHERE s.status IN ('qualified','proposal','won')),
                   'proposal',  count(*) FILTER (WHERE s.status IN ('proposal','won')),
                   'won',       count(*) FILTER (WHERE s.status = 'won'),
                   'lost',      count(*) FILTER (WHERE s.status = 'lost'),
                   'open',      count(*) FILTER (WHERE s.status IN ('new','contacted','qualified','proposal','nurture'))
                 ) AS entry
            FROM scoped s
            -- LEFT JOIN, and the name may come back NULL: commercial_contacts
            -- is readable by managers and by oneself, so a caller who can see a
            -- lead but not its owner's row gets the id without the name rather
            -- than losing the row from the report.
            LEFT JOIN public.commercial_contacts c ON c.id = s.assigned_commercial_id
           GROUP BY s.assigned_commercial_id, c.name
           ORDER BY count(*) DESC
        ) t
    ),

    -- §33: the funnel as COUNTS. Each stage counts every lead that reached it
    -- or went past it, which is what makes stage-to-stage division meaningful.
    'funnel', jsonb_build_object(
      'leads',     (SELECT count(*) FROM scoped),
      'contacted', (SELECT count(*) FROM scoped WHERE first_contact_at IS NOT NULL),
      'qualified', (SELECT count(*) FROM scoped WHERE status IN ('qualified','proposal','won')),
      'proposal',  (SELECT count(*) FROM scoped WHERE status IN ('proposal','won')),
      'won',       (SELECT count(*) FROM scoped WHERE status = 'won'),
      'lost',      (SELECT count(*) FROM scoped WHERE status = 'lost')
    ),

    -- §34/§35: the raw material for a future SLA rule, computed only over
    -- leads that were genuinely contacted. `measured` is returned beside it so
    -- the UI can refuse to draw a KPI from a sample of one.
    'first_contact', (
      SELECT jsonb_build_object(
        'measured',   count(*),
        'avg_hours',  round(avg(EXTRACT(EPOCH FROM (first_contact_at - created_at)) / 3600.0)::NUMERIC, 1),
        'p50_hours',  round((percentile_cont(0.5) WITHIN GROUP (
                         ORDER BY EXTRACT(EPOCH FROM (first_contact_at - created_at)) / 3600.0
                      ))::NUMERIC, 1)
      )
      FROM scoped WHERE first_contact_at IS NOT NULL
    ),

    -- §35: "new lead older than X hours" without a schema redesign. The count
    -- is exposed, the threshold is not enforced, and no alert is sent.
    'awaiting_first_contact', (
      SELECT jsonb_build_object(
        'total',       count(*),
        'over_24h',    count(*) FILTER (WHERE created_at < now() - INTERVAL '24 hours'),
        'oldest_at',   min(created_at)
      )
      FROM scoped WHERE status = 'new'
    ),

    -- §19: which channels actually produced a click, over the leads in scope.
    -- Named for what it counts. It is NOT a conversation count and the key says
    -- so.
    'channel_clicks', (
      SELECT COALESCE(jsonb_object_agg(channel, n), '{}'::JSONB)
        FROM (
          SELECT e.channel, count(*) AS n
            FROM public.unchained_lead_events e
            JOIN scoped s ON s.id = e.lead_id
           WHERE e.event_type = 'contact_channel_clicked'
           GROUP BY e.channel
        ) s
    )
  );
$fn$;

REVOKE ALL ON FUNCTION public.unchained_lead_metrics(TIMESTAMPTZ) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.unchained_lead_metrics(TIMESTAMPTZ) TO authenticated;

-- ─── 15. Row Level Security (§41) ─────────────────────────────────────────
-- "A user who cannot see the Leads menu must also be unable to query the leads
-- directly." The route guard in the admin panel is convenience; this is the
-- boundary.
--
-- ─── unchained_leads ──────────────────────────────────────────────────────
--   SELECT   a manager sees everything; a commercial sees what is assigned to
--            them; everyone else — including an authenticated TanCerca
--            super-user who is not a super_admin, and every anon caller — sees
--            nothing at all.
--   INSERT   nobody. The only writer is create_public_lead(), which is
--            SECURITY DEFINER and therefore not governed by this policy. That
--            is what makes §9 true: there is no path from a browser to an
--            INSERT on this table.
--   UPDATE   the three functions above, likewise SECURITY DEFINER. No direct
--            UPDATE policy exists, so a status cannot be changed without the
--            event row that explains it.
--   DELETE   nobody, ever (§50). Commercial history is not disposable, and no
--            retention policy has been agreed to implement.

ALTER TABLE public.unchained_leads          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_lead_events    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_lead_throttle  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.unchained_services       ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS unchained_leads_read ON public.unchained_leads;
CREATE POLICY unchained_leads_read ON public.unchained_leads
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         public.my_commercial_contact_id() IS NOT NULL
         AND assigned_commercial_id = public.my_commercial_contact_id()
       )
  );

-- The events table repeats the lead's own rule through an EXISTS rather than
-- restating it: the two can never disagree about who may read what, because
-- there is only one rule and the second table asks the first.
DROP POLICY IF EXISTS unchained_lead_events_read ON public.unchained_lead_events;
CREATE POLICY unchained_lead_events_read ON public.unchained_lead_events
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.unchained_leads l
       WHERE l.id = public.unchained_lead_events.lead_id
    )
  );

-- The service taxonomy is not secret — the same three names are printed on the
-- public website — but it is not anonymous-readable either, because the public
-- site renders them from its own dictionaries and has no reason to query this.
-- Any signed-in user may read it; only a super_admin may change it.
DROP POLICY IF EXISTS unchained_services_read ON public.unchained_services;
CREATE POLICY unchained_services_read ON public.unchained_services
  FOR SELECT USING ((SELECT auth.uid()) IS NOT NULL);

DROP POLICY IF EXISTS unchained_services_admin_all ON public.unchained_services;
CREATE POLICY unchained_services_admin_all ON public.unchained_services
  FOR ALL USING (public.is_super_admin()) WITH CHECK (public.is_super_admin());

-- The throttle table gets RLS enabled and NO policy at all. Nothing may read
-- it, nothing may write it, and the only access is through
-- unchained_lead_throttle_ok(), which is SECURITY DEFINER. An anonymous caller
-- must not be able to see whether an address has been submitted before, and a
-- signed-in one has no reason to.

-- ─── 16. Reading the roster (§24, §32) ────────────────────────────────────
-- Phase 4 gave commercial_contacts and commercial_regions a single
-- is_super_admin() policy each, because at the time super_admin was the only
-- role that could reach the product at all. Phase 5 changed that and Phase 7
-- depends on it: a lead list that cannot resolve "Alexander" from an id, and a
-- per-commercial report with no names in it, are not usable screens.
--
-- These are ADDITIONAL policies. The Phase 4 policies are untouched and still
-- govern every write — an unchained_admin can read the roster and cannot edit
-- it, which is Phase 4's scope and stays there. Policies are OR-ed, so adding a
-- SELECT policy widens reads and nothing else.

-- The self-read arm compares the column to auth.uid() DIRECTLY rather than
-- calling my_commercial_contact_id(). That function reads this same table, and
-- a policy on a table that calls a function which queries that table is a
-- recursion hazard the moment the function's owner does not bypass RLS. Written
-- this way it cannot recurse under any ownership, and it says the same thing.
DROP POLICY IF EXISTS commercial_contacts_unchained_read ON public.commercial_contacts;
CREATE POLICY commercial_contacts_unchained_read ON public.commercial_contacts
  FOR SELECT
  USING (
    public.unchained_manages_leads()
    OR (
         user_id = (SELECT auth.uid())
         AND public.has_product_access('unchained')
       )
  );

DROP POLICY IF EXISTS commercial_regions_unchained_read ON public.commercial_regions;
CREATE POLICY commercial_regions_unchained_read ON public.commercial_regions
  FOR SELECT
  USING (public.unchained_manages_leads());

-- ─── 17. Table privileges ─────────────────────────────────────────────────
-- Belt and braces over RLS, exactly as Phase 4 and Phase 5 did it. RLS with no
-- matching policy already denies anon, but that is one accidental
-- `CREATE POLICY ... TO public` away from being untrue, and these tables hold
-- the names, addresses and phone numbers of real prospects. Revoking the grant
-- means two independent things would have to go wrong.
--
-- authenticated is granted SELECT only. Not INSERT, not UPDATE, not DELETE:
-- every write in this module goes through a SECURITY DEFINER function that
-- writes the audit row alongside the change, and a grant that allowed the
-- change without the audit row would make §37 a convention instead of a
-- property.

REVOKE ALL ON TABLE public.unchained_leads         FROM anon;
REVOKE ALL ON TABLE public.unchained_lead_events   FROM anon;
REVOKE ALL ON TABLE public.unchained_lead_throttle FROM anon;
REVOKE ALL ON TABLE public.unchained_services      FROM anon;

REVOKE ALL ON TABLE public.unchained_leads         FROM authenticated;
REVOKE ALL ON TABLE public.unchained_lead_events   FROM authenticated;
REVOKE ALL ON TABLE public.unchained_lead_throttle FROM authenticated;
REVOKE ALL ON TABLE public.unchained_services      FROM authenticated;

GRANT SELECT ON TABLE public.unchained_leads       TO authenticated;
GRANT SELECT ON TABLE public.unchained_lead_events TO authenticated;
GRANT SELECT ON TABLE public.unchained_services    TO authenticated;
-- A super_admin manages the taxonomy through Studio; no UI writes it, so no
-- write grant is issued here. The unchained_services_admin_all policy exists so
-- that a future settings screen needs a GRANT and not a policy rewrite.

-- ─── 18. Apply-time verification ──────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- table behind. Everything asserted here is a property that must hold on an
-- EMPTY database, so none of it depends on data that does not exist yet.

-- RLS, and the absence of the policies that must not exist.
DO $$
DECLARE
  v_table TEXT;
  v_rls   BOOLEAN;
  v_cmds  TEXT;
BEGIN
  FOREACH v_table IN ARRAY ARRAY[
    'unchained_leads',
    'unchained_lead_events',
    'unchained_lead_throttle',
    'unchained_services'
  ] LOOP
    SELECT relrowsecurity INTO v_rls
      FROM pg_class WHERE oid = ('public.' || v_table)::regclass;

    IF NOT v_rls THEN
      RAISE EXCEPTION '[fail] RLS is not enabled on public.%', v_table;
    END IF;
  END LOOP;

  -- §9: no path from a browser to an INSERT on the lead table. If a policy
  -- ever grants one, this migration's central security claim is false.
  SELECT string_agg(DISTINCT cmd, ',') INTO v_cmds
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'unchained_leads';

  IF v_cmds IS DISTINCT FROM 'SELECT' THEN
    RAISE EXCEPTION
      '[fail] unchained_leads must carry SELECT policies only (found: %)', COALESCE(v_cmds, 'none');
  END IF;

  SELECT string_agg(DISTINCT cmd, ',') INTO v_cmds
    FROM pg_policies
   WHERE schemaname = 'public' AND tablename = 'unchained_lead_events';

  IF v_cmds IS DISTINCT FROM 'SELECT' THEN
    RAISE EXCEPTION
      '[fail] unchained_lead_events must carry SELECT policies only (found: %)', COALESCE(v_cmds, 'none');
  END IF;

  -- The throttle table is reachable only through its SECURITY DEFINER helper.
  IF EXISTS (SELECT 1 FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'unchained_lead_throttle') THEN
    RAISE EXCEPTION '[fail] unchained_lead_throttle must have no policy at all';
  END IF;

  RAISE NOTICE '[ok] RLS enabled on all four tables; leads and events are read-only to every client';
END;
$$;

-- anon must hold EXECUTE on exactly the two public entry points and on nothing
-- else this migration created. A grant added by hand, or a future
-- CREATE OR REPLACE that re-granted PUBLIC by default, is caught here.
DO $$
DECLARE
  v_leaked TEXT;
BEGIN
  SELECT string_agg(p.proname, ', ' ORDER BY p.proname) INTO v_leaked
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname IN (
       'unchained_manages_leads', 'my_commercial_contact_id',
       'unchained_can_work_lead', 'unchained_set_lead_status',
       'unchained_reassign_lead', 'unchained_add_lead_note',
       'unchained_lead_metrics', 'unchained_lead_throttle_ok',
       'unchained_lead_transition_allowed'
     )
     AND (has_function_privilege('anon', p.oid, 'EXECUTE')
          OR has_function_privilege('public', p.oid, 'EXECUTE'));

  IF v_leaked IS NOT NULL THEN
    RAISE EXCEPTION '[fail] anon can execute administrative function(s): %', v_leaked;
  END IF;

  IF NOT has_function_privilege('anon',
        'public.create_public_lead(TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,TEXT,UUID,TEXT)',
        'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon cannot execute create_public_lead — the public form would never work';
  END IF;

  IF NOT has_function_privilege('anon',
        'public.record_public_lead_channel_click(UUID,TEXT)', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] anon cannot execute record_public_lead_channel_click';
  END IF;

  IF has_table_privilege('anon', 'public.unchained_leads', 'SELECT')
     OR has_table_privilege('anon', 'public.unchained_leads', 'INSERT') THEN
    RAISE EXCEPTION '[fail] anon holds a table grant on unchained_leads';
  END IF;

  RAISE NOTICE '[ok] anon reaches create_public_lead and the channel-click recorder, and nothing else';
END;
$$;

-- The security shape of every SECURITY DEFINER function this file added. A
-- future CREATE OR REPLACE that drops the pinned search_path would reintroduce
-- the defect class behind the 2026-08-02 and 2026-08-16 incidents.
DO $$
DECLARE
  v_name  TEXT;
  v_entry TEXT;
BEGIN
  FOREACH v_name IN ARRAY ARRAY[
    'unchained_manages_leads', 'my_commercial_contact_id', 'unchained_can_work_lead',
    'create_public_lead', 'record_public_lead_channel_click',
    'unchained_set_lead_status', 'unchained_reassign_lead', 'unchained_add_lead_note',
    'unchained_lead_throttle_ok'
  ] LOOP
    SELECT cfg INTO v_entry
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      LEFT JOIN LATERAL unnest(COALESCE(p.proconfig, ARRAY[]::TEXT[])) AS cfg ON cfg LIKE 'search_path=%'
     WHERE n.nspname = 'public' AND p.proname = v_name
       AND p.prosecdef
     LIMIT 1;

    IF v_entry IS NULL THEN
      RAISE EXCEPTION '[fail] public.%() is not SECURITY DEFINER with a pinned search_path', v_name;
    END IF;

    IF btrim(substring(v_entry FROM 13), '"') <> '' THEN
      RAISE EXCEPTION '[fail] public.%() must pin search_path to the empty string (found: %)', v_name, v_entry;
    END IF;
  END LOOP;

  -- The one function that must NOT be SECURITY DEFINER, and the reason is in
  -- its own header: the metrics have to be scoped by the caller's RLS.
  IF EXISTS (
       SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public' AND p.proname = 'unchained_lead_metrics' AND p.prosecdef
     ) THEN
    RAISE EXCEPTION '[fail] unchained_lead_metrics must be SECURITY INVOKER so RLS scopes the aggregate';
  END IF;

  RAISE NOTICE '[ok] every SECURITY DEFINER function pins search_path; metrics runs as the caller';
END;
$$;

-- The status machine. This is a CHECK on analytics correctness as much as on
-- data: every transition §6 names must be permitted, and the two shapes that
-- would make a funnel meaningless must not be.
DO $$
BEGIN
  -- The happy path, one stage at a time.
  IF NOT (public.unchained_lead_transition_allowed('new', 'contacted')
      AND public.unchained_lead_transition_allowed('contacted', 'qualified')
      AND public.unchained_lead_transition_allowed('qualified', 'proposal')
      AND public.unchained_lead_transition_allowed('proposal', 'won')) THEN
    RAISE EXCEPTION '[fail] the new → contacted → qualified → proposal → won path must be permitted';
  END IF;

  -- Lost from anywhere it can genuinely be lost.
  IF NOT (public.unchained_lead_transition_allowed('new', 'lost')
      AND public.unchained_lead_transition_allowed('contacted', 'lost')
      AND public.unchained_lead_transition_allowed('qualified', 'lost')
      AND public.unchained_lead_transition_allowed('proposal', 'lost')
      AND public.unchained_lead_transition_allowed('nurture', 'lost')) THEN
    RAISE EXCEPTION '[fail] a lead must be losable from every open stage';
  END IF;

  -- Skipping stages would produce conversions with no contact behind them.
  IF public.unchained_lead_transition_allowed('new', 'won')
     OR public.unchained_lead_transition_allowed('new', 'qualified')
     OR public.unchained_lead_transition_allowed('contacted', 'won')
     OR public.unchained_lead_transition_allowed('qualified', 'won') THEN
    RAISE EXCEPTION '[fail] stage skipping must be refused — it fabricates funnel steps';
  END IF;

  -- Won is terminal; a reopened loss goes back to contacted and nowhere else.
  IF public.unchained_lead_transition_allowed('won', 'lost')
     OR public.unchained_lead_transition_allowed('won', 'contacted')
     OR public.unchained_lead_transition_allowed('lost', 'won')
     OR public.unchained_lead_transition_allowed('lost', 'qualified') THEN
    RAISE EXCEPTION '[fail] won must be terminal and lost must reopen only to contacted';
  END IF;

  IF NOT public.unchained_lead_transition_allowed('lost', 'contacted') THEN
    RAISE EXCEPTION '[fail] a lost lead that comes back must be reopenable';
  END IF;

  RAISE NOTICE '[ok] the status machine permits the documented lifecycle and refuses the rest';
END;
$$;

-- The public endpoint, end to end, WITHOUT leaving a row behind (§55).
--
-- The insert runs inside a subtransaction that is deliberately rolled back by
-- raising a sentinel exception: nothing this block writes survives, so a
-- production database gets the verification and none of the test data. There is
-- no other honest way to assert that the write path works — asserting the
-- function's signature would prove only that it parses.
DO $$
DECLARE
  v_result JSONB;
  v_before BIGINT;
  v_after  BIGINT;
  v_token  UUID := gen_random_uuid();
  v_status TEXT;
  v_events BIGINT;
BEGIN
  SELECT count(*) INTO v_before FROM public.unchained_leads;

  BEGIN
    -- A honeypot hit must look identical to success and write nothing.
    v_result := public.create_public_lead(
      p_name => 'Probe', p_email => 'probe@example.invalid',
      p_language => 'en', p_honeypot => 'i am a bot'
    );
    IF v_result ->> 'success' <> 'true' THEN
      RAISE EXCEPTION '[fail] a honeypot hit must be indistinguishable from success';
    END IF;
    SELECT count(*) INTO v_after FROM public.unchained_leads;
    IF v_after <> v_before THEN
      RAISE EXCEPTION '[fail] a honeypot hit wrote a lead';
    END IF;

    -- No way to be reached is not a lead.
    v_result := public.create_public_lead(p_name => 'Probe', p_language => 'en');
    IF v_result ->> 'reason' <> 'invalid' THEN
      RAISE EXCEPTION '[fail] a lead with neither email nor phone must be refused';
    END IF;

    -- A language is required, and an invented service is refused.
    v_result := public.create_public_lead(
      p_name => 'Probe', p_email => 'probe@example.invalid', p_language => NULL);
    IF v_result ->> 'reason' <> 'invalid' THEN
      RAISE EXCEPTION '[fail] a missing language must be refused';
    END IF;

    v_result := public.create_public_lead(
      p_name => 'Probe', p_email => 'probe@example.invalid', p_language => 'en',
      p_service_interest => 'blockchain-consulting');
    IF v_result ->> 'reason' <> 'invalid' THEN
      RAISE EXCEPTION '[fail] a service outside the taxonomy must be refused';
    END IF;

    -- The real thing.
    v_result := public.create_public_lead(
      p_name             => 'Probe Prospect',
      p_email            => 'probe@example.invalid',
      p_company_name     => 'Probe Ltd',
      p_country_code     => '  ru  ',
      p_language         => 'RU',
      p_service_interest => 'software-development',
      p_message          => 'Verification probe. Rolled back.',
      p_source_page      => '/',
      p_source_cta       => 'hero_start_project',
      p_client_token     => v_token
    );
    IF v_result ->> 'success' <> 'true' THEN
      RAISE EXCEPTION '[fail] a valid inquiry was refused: %', v_result;
    END IF;

    -- §42: the visitor is told nothing else.
    IF jsonb_exists_any(v_result, ARRAY['id', 'lead_id', 'assigned_commercial_id', 'commercial']) THEN
      RAISE EXCEPTION '[fail] the public response leaked internal state: %', v_result;
    END IF;

    SELECT count(*) INTO v_after FROM public.unchained_leads;
    IF v_after <> v_before + 1 THEN
      RAISE EXCEPTION '[fail] a valid inquiry did not create exactly one lead';
    END IF;

    -- Normalisation: 'ru' upper-cased, 'RU' lower-cased, exactly as the
    -- resolver normalises the same two values.
    IF NOT EXISTS (
      SELECT 1 FROM public.unchained_leads
       WHERE client_token = v_token AND country_code = 'RU' AND language = 'ru'
         AND status = 'new' AND source = 'website'
    ) THEN
      RAISE EXCEPTION '[fail] the lead was not normalised or not created as new/website';
    END IF;

    -- §43: the same token twice is one lead.
    PERFORM public.create_public_lead(
      p_name => 'Probe Prospect', p_email => 'probe@example.invalid',
      p_language => 'ru', p_client_token => v_token);
    SELECT count(*) INTO v_after FROM public.unchained_leads;
    IF v_after <> v_before + 1 THEN
      RAISE EXCEPTION '[fail] a repeated client token created a duplicate lead';
    END IF;

    -- §36: the timeline starts at creation.
    SELECT count(*) INTO v_events
      FROM public.unchained_lead_events e
      JOIN public.unchained_leads l ON l.id = e.lead_id
     WHERE l.client_token = v_token AND e.event_type = 'lead_created';
    IF v_events <> 1 THEN
      RAISE EXCEPTION '[fail] lead_created was not recorded exactly once';
    END IF;

    -- §19/§47: a click is recorded as a click, and repeated taps are one.
    PERFORM public.record_public_lead_channel_click(v_token, 'whatsapp');
    PERFORM public.record_public_lead_channel_click(v_token, 'whatsapp');
    SELECT count(*) INTO v_events
      FROM public.unchained_lead_events e
      JOIN public.unchained_leads l ON l.id = e.lead_id
     WHERE l.client_token = v_token AND e.event_type = 'contact_channel_clicked';
    IF v_events <> 1 THEN
      RAISE EXCEPTION '[fail] channel clicks are not deduplicated (got %)', v_events;
    END IF;

    -- §34: a click must NOT count as contact.
    SELECT status INTO v_status FROM public.unchained_leads WHERE client_token = v_token;
    IF v_status <> 'new'
       OR EXISTS (SELECT 1 FROM public.unchained_leads
                   WHERE client_token = v_token AND first_contact_at IS NOT NULL) THEN
      RAISE EXCEPTION '[fail] a channel click advanced the lead — a click is not contact';
    END IF;

    -- An unknown token is a silent no-op, not an error and not a probe oracle.
    IF (public.record_public_lead_channel_click(gen_random_uuid(), 'telegram') ->> 'success') <> 'true' THEN
      RAISE EXCEPTION '[fail] an unknown token must return the same answer as a known one';
    END IF;

    -- The status machine, enforced by the trigger rather than by a caller.
    BEGIN
      UPDATE public.unchained_leads SET status = 'won' WHERE client_token = v_token;
      RAISE EXCEPTION '[fail] new → won was permitted by the trigger';
    EXCEPTION WHEN check_violation THEN
      NULL;  -- expected
    END;

    -- And the timestamps the trigger owns.
    UPDATE public.unchained_leads SET status = 'contacted' WHERE client_token = v_token;
    IF NOT EXISTS (SELECT 1 FROM public.unchained_leads
                    WHERE client_token = v_token
                      AND first_contact_at IS NOT NULL AND last_contact_at IS NOT NULL) THEN
      RAISE EXCEPTION '[fail] the contacted transition did not stamp first_contact_at';
    END IF;

    UPDATE public.unchained_leads SET status = 'qualified' WHERE client_token = v_token;
    UPDATE public.unchained_leads SET status = 'proposal'  WHERE client_token = v_token;
    UPDATE public.unchained_leads SET status = 'won'       WHERE client_token = v_token;
    IF NOT EXISTS (SELECT 1 FROM public.unchained_leads
                    WHERE client_token = v_token AND converted_at IS NOT NULL) THEN
      RAISE EXCEPTION '[fail] won did not stamp converted_at (§48)';
    END IF;

    -- §37: the audit trail cannot be rewritten.
    BEGIN
      DELETE FROM public.unchained_lead_events
       WHERE lead_id = (SELECT id FROM public.unchained_leads WHERE client_token = v_token);
      RAISE EXCEPTION '[fail] lead events were deletable';
    EXCEPTION WHEN restrict_violation THEN
      NULL;  -- expected
    END;

    RAISE EXCEPTION 'unchained-probe-rollback';
  EXCEPTION
    WHEN OTHERS THEN
      IF SQLERRM <> 'unchained-probe-rollback' THEN
        RAISE;
      END IF;
  END;

  SELECT count(*) INTO v_after FROM public.unchained_leads;
  IF v_after <> v_before THEN
    RAISE EXCEPTION '[fail] the verification probe left % row(s) behind', v_after - v_before;
  END IF;

  RAISE NOTICE '[ok] public lead creation, idempotency, channel clicks, the status machine and the append-only log all verified, and no data was left behind';
END;
$$;

-- §55: this migration creates no lead, no note and no event. The tables are
-- empty on purpose and the admin UI shows "No project inquiries yet" until a
-- real prospect writes in.

NOTIFY pgrst, 'reload schema';

-- ════════════════════════════════════════════════════════════
-- Phase 11b — Unchained Business: the self-service inbound lead
-- ════════════════════════════════════════════════════════════
-- A visitor who presses "¿Prefieres escribir? Cuéntanos tu proyecto" has told
-- us something: they have not spoken to a representative and do not want to.
-- They know what they need and are not asking to be guided.
--
-- Until now every website lead was routed to somebody by
-- resolve_commercial_contact(). That is right for the visitor who was shown a
-- representative's name and wrote to them, and wrong for this one — it puts a
-- lead in a queue as though a representative had earned it, and pays a
-- commission for a conversation that never happened.
--
-- ─── What changes ─────────────────────────────────────────────────────────
-- A self-service lead is NOT routed. It arrives unassigned, into the queue a
-- manager already has — `assigned_commercial_id IS NULL` is a filter the panel
-- has offered since Phase 7, and unchained_reassign_lead() already accepts an
-- unassigned lead as its starting point. Nothing new is needed to distribute
-- them.
--
-- With ONE exception: a visitor who is already somebody's paying client goes to
-- that representative. They built the relationship and the client came back;
-- the commission ladder of 20260911000001 then reduces what they earn on it,
-- which is the whole reason the ladder exists.
--
-- ─── Why the match is email-only ──────────────────────────────────────────
-- Phase 9 gives the register two identity keys: an exact email, and the LAST
-- NINE DIGITS of the phone. The phone key is deliberately loose so that
-- "+7 999…" and "8 (999)…" collapse to one client, and it therefore has real
-- false positives — two clients in different countries sharing nine trailing
-- digits.
--
-- Where that key already lives, a false positive costs somebody a duplicate
-- warning. Here it would cost money: the lead would be handed to a
-- representative who has never met this person, and the ladder would pay them
-- for it. So this decision reads the email and nothing else. Phase 9's own file
-- says an exact email has no plausible false positive; that is the property
-- being relied on, and it is the only one strong enough to carry a payment.
--
-- Clients carrying `identity_override` are skipped for the same reason: that
-- flag exists to let an administrator register a deliberate duplicate, so a
-- match against one is a match against a row somebody already declared
-- ambiguous.
--
-- ─── What the visitor learns ──────────────────────────────────────────────
-- Nothing. The return value is unchanged — { success: true } or a refusal with
-- one of two reasons — and no arm below adds to it. A caller must not be able
-- to discover, by submitting addresses, which of them belong to clients of this
-- business.
--
-- ─── The landing site has to send the signal ──────────────────────────────
-- This file cannot tell the two kinds of visitor apart on its own. The website
-- passes `p_self_service: true` from the "prefiero escribir" flow and omits it
-- everywhere else. Until that ships, every lead behaves exactly as it does
-- today, because the parameter defaults to FALSE.
--
-- A caller could send it dishonestly and force their own lead unassigned. That
-- is a weaker version of the hole Phase 7 closed by refusing to accept a
-- commercial id at all, and it is bounded: the worst outcome is a lead landing
-- in the manager's queue instead of a representative's, the throttle limits the
-- volume, and no rate or ownership follows from it.
--
-- Requires 20260911000001. Paste into the Studio SQL editor of the UNCHAINED
-- project. Re-runnable.


-- ─── §1. create_public_lead, with the self-service arm ────────────────────
-- Restated in full rather than patched, because it is one function and a
-- migration that replaced half of it would leave the other half in a file
-- nobody would think to read. Everything before the assignment decision is
-- Phase 7's, unchanged and deliberately so: the honeypot, the normalisation,
-- the validation, both idempotency nets and both throttle buckets.

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
  p_honeypot         TEXT    DEFAULT NULL,
  -- Phase 11b. Defaulted to FALSE so that a website which has not been updated
  -- keeps behaving exactly as it did.
  p_self_service     BOOLEAN DEFAULT FALSE
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
  v_source    TEXT;
  v_self      BOOLEAN := COALESCE(p_self_service, FALSE);
  v_lead_id   UUID;
BEGIN
  -- ── Honeypot, first and silently ──────────────────────────────────────
  IF p_honeypot IS NOT NULL AND btrim(p_honeypot) <> '' THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- ── Normalise ─────────────────────────────────────────────────────────
  v_name     := NULLIF(btrim(COALESCE(p_name, '')), '');
  v_company  := NULLIF(btrim(COALESCE(p_company_name, '')), '');
  v_email    := NULLIF(lower(btrim(COALESCE(p_email, ''))), '');
  v_phone    := NULLIF(btrim(COALESCE(p_phone, '')), '');
  v_country  := NULLIF(upper(btrim(COALESCE(p_country_code, ''))), '');
  v_language := NULLIF(lower(btrim(COALESCE(p_language, ''))), '');
  v_service  := NULLIF(btrim(COALESCE(p_service_interest, '')), '');
  v_message  := NULLIF(btrim(COALESCE(p_message, '')), '');
  v_page     := NULLIF(btrim(COALESCE(p_source_page, '')), '');
  v_cta      := NULLIF(lower(btrim(COALESCE(p_source_cta, ''))), '');

  -- ── Validate (§23) ────────────────────────────────────────────────────
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

  IF v_language IS NULL OR v_language !~ '^[a-z]{2,3}$' THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'invalid');
  END IF;

  IF v_country IS NOT NULL AND v_country !~ '^[A-Z]{2}$' THEN
    v_country := NULL;
  END IF;

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
  IF p_client_token IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.unchained_leads l WHERE l.client_token = p_client_token
     ) THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  IF v_email IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.unchained_leads l
        WHERE lower(l.email) = v_email
          AND l.created_at > now() - INTERVAL '10 minutes'
          AND l.source_page IS NOT DISTINCT FROM v_page
     ) THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  -- ── Throttle (§22) ────────────────────────────────────────────────────
  v_headers := NULLIF(current_setting('request.headers', true), '')::JSONB;
  v_ip := NULLIF(btrim(split_part(COALESCE(v_headers ->> 'x-forwarded-for', ''), ',', 1)), '');

  IF v_ip IS NOT NULL AND NOT public.unchained_lead_throttle_ok('ip:' || v_ip) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'rate_limited');
  END IF;

  IF v_email IS NOT NULL AND NOT public.unchained_lead_throttle_ok('email:' || v_email) THEN
    RETURN jsonb_build_object('success', FALSE, 'reason', 'rate_limited');
  END IF;

  -- ── The assignment decision ───────────────────────────────────────────
  IF NOT v_self THEN
    -- Phase 7's path, untouched. The commercial is resolved HERE, by the same
    -- function the contact panel called moments earlier, and there is no
    -- parameter through which a caller could name one.
    v_source := 'website';

    SELECT r.commercial_id
      INTO v_commercial
      FROM public.resolve_commercial_contact(v_country, v_language) r;

  ELSE
    -- The visitor said they do not want to be routed, so they are not.
    --
    -- A separate `source` rather than a flag column: this is a different
    -- channel, the metrics that group by source should be able to tell them
    -- apart, and it costs no schema. The regex on unchained_leads.source
    -- already admits it.
    v_source := 'website_self';

    -- The one exception. Exact email, against a client who has actually PAID
    -- this business for something — a registration alone is not a relationship,
    -- and treating it as one would reward registering everybody you ever met.
    IF v_email IS NOT NULL THEN
      SELECT c.owner_commercial_id
        INTO v_commercial
        FROM public.unchained_clients c
       WHERE c.email_key = v_email
         AND NOT c.identity_override
         AND EXISTS (
               SELECT 1 FROM public.unchained_engagements e
                WHERE e.client_id = c.id
                  AND e.status = 'paid'
             )
       -- The earliest registration wins, which is the register's own rule
       -- applied to the same question from the other direction.
       ORDER BY c.registered_at ASC
       LIMIT 1;
    END IF;
  END IF;

  -- ── Write ─────────────────────────────────────────────────────────────
  INSERT INTO public.unchained_leads (
    name, company_name, email, phone,
    country_code, language, service_interest, message,
    source, source_page, source_cta,
    assigned_commercial_id, status, client_token
  ) VALUES (
    v_name, v_company, v_email, v_phone,
    v_country, v_language, v_service, v_message,
    v_source, v_page, v_cta,
    v_commercial, 'new', p_client_token
  )
  ON CONFLICT (client_token) WHERE client_token IS NOT NULL DO NOTHING
  RETURNING id INTO v_lead_id;

  IF v_lead_id IS NULL THEN
    RETURN jsonb_build_object('success', TRUE);
  END IF;

  INSERT INTO public.unchained_lead_events (lead_id, event_type, to_commercial_id, to_status)
  VALUES (v_lead_id, 'lead_created', v_commercial, 'new');

  -- Unchanged, and checked against the header: the visitor learns whether their
  -- message was recorded and nothing else. In particular they cannot learn,
  -- by submitting addresses, which of them belong to clients of this business.
  RETURN jsonb_build_object('success', TRUE);
END;
$fn$;

-- ─── The twelve-argument version has to go ────────────────────────────────
-- Adding a defaulted parameter creates an OVERLOAD, not a replacement. Every
-- existing twelve-argument call — which is every call the live website makes —
-- would then match both candidates equally and fail with "function is not
-- unique". Dropping the old one leaves a single function whose thirteenth
-- parameter defaults, so today's website keeps working untouched.
--
-- Third time this hazard has appeared in this module. It is not going to stop.
DROP FUNCTION IF EXISTS public.create_public_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT);

REVOKE ALL ON FUNCTION public.create_public_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN
) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_lead(
  TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, UUID, TEXT, BOOLEAN
) TO anon, authenticated;


-- ─── §2. Apply-time verification ──────────────────────────────────────────

-- Exactly one create_public_lead, and anon may call it. Two would mean every
-- call from the website fails; none would mean the website's form is dead.
DO $$
DECLARE
  v_count INTEGER;
  v_sig   TEXT;
BEGIN
  SELECT count(*) INTO v_count
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'create_public_lead';

  IF v_count <> 1 THEN
    RAISE EXCEPTION
      'there are % versions of create_public_lead; every call from the website would be ambiguous',
      v_count;
  END IF;

  SELECT p.oid::regprocedure::TEXT INTO v_sig
    FROM pg_proc p
   WHERE p.pronamespace = 'public'::regnamespace
     AND p.proname = 'create_public_lead';

  IF NOT has_function_privilege('anon', v_sig, 'EXECUTE') THEN
    RAISE EXCEPTION 'anon cannot execute % — the website form is dead', v_sig;
  END IF;
END;
$$;

-- The new source value has to satisfy the column's own rule, or every
-- self-service lead would be refused at INSERT time with a check violation the
-- visitor would see as a generic failure.
DO $$
BEGIN
  IF 'website_self' !~ '^[a-z][a-z0-9_]{1,30}$' THEN
    RAISE EXCEPTION 'website_self does not satisfy unchained_leads_source_format';
  END IF;
END;
$$;

-- The self-service arm, end to end, on data this block creates and removes.
-- Asserting the function exists would not catch an arm that assigns the wrong
-- person, and that arm is the entire file.
--
-- The ROUTED path is deliberately not probed here: it depends on
-- resolve_commercial_contact(), whose answer is whatever routing this database
-- happens to be configured with, so an assertion about it would be an assertion
-- about production data rather than about this change. What is asserted instead
-- is that the routed path is untouched — the `IF NOT v_self` arm above is
-- Phase 7's code, moved but not edited.
DO $$
DECLARE
  v_commercial UUID;
  v_client     UUID;
  v_engagement UUID;
  v_lead       UUID;
  v_assigned   UUID;
  v_source     TEXT;
  v_result     JSONB;
BEGIN
  SELECT id INTO v_commercial FROM public.commercial_contacts LIMIT 1;
  IF v_commercial IS NULL THEN
    RAISE NOTICE 'no commercial_contacts row; skipping the self-service probe';
    RETURN;
  END IF;

  -- ── Both logs stood down for the duration ───────────────────────────
  -- unchained_leads CASCADEs into unchained_lead_events, and unchained_clients
  -- into unchained_client_events; both of those tables refuse DELETE from a
  -- BEFORE trigger, so every cleanup below would be rejected by the very
  -- property that makes them audit trails. Disabled once here rather than
  -- around each statement, and restored at the end — a RAISE anywhere in
  -- between aborts the transaction, and DDL in PostgreSQL is transactional, so
  -- a failed probe rolls the triggers back on with everything else.
  ALTER TABLE public.unchained_lead_events   DISABLE TRIGGER trg_unchained_lead_events_append_only;
  ALTER TABLE public.unchained_client_events DISABLE TRIGGER trg_unchained_client_events_append_only;

  -- The throttle counts hits whether or not the row it produced still exists,
  -- so a second run of this migration inside fifteen minutes would exhaust the
  -- five-per-window limit and the probe would fail for a reason that has
  -- nothing to do with what it tests. Its bucket is cleared with everything
  -- else. The key is md5-hashed exactly as unchained_lead_throttle_ok makes it.
  DELETE FROM public.unchained_lead_throttle
   WHERE bucket = md5('unchained-lead-throttle:email:__selfserve__@example.invalid');

  -- Anything a previous failed run left behind.
  DELETE FROM public.unchained_leads WHERE email = '__selfserve__@example.invalid';
  DELETE FROM public.unchained_engagements
   WHERE client_id IN (SELECT id FROM public.unchained_clients
                        WHERE email = '__selfserve__@example.invalid');
  DELETE FROM public.unchained_client_events
   WHERE client_id IN (SELECT id FROM public.unchained_clients
                        WHERE email = '__selfserve__@example.invalid');
  DELETE FROM public.unchained_clients WHERE email = '__selfserve__@example.invalid';

  -- ── A self-service lead from a stranger must land unassigned ────────
  v_result := public.create_public_lead(
    p_name         => '__selfserve__',
    p_email        => '__selfserve__@example.invalid',
    p_language     => 'es',
    p_self_service => TRUE
  );

  IF NOT (v_result ->> 'success')::BOOLEAN THEN
    RAISE EXCEPTION 'the self-service probe was refused: %', v_result;
  END IF;

  SELECT id, assigned_commercial_id, source INTO v_lead, v_assigned, v_source
    FROM public.unchained_leads WHERE email = '__selfserve__@example.invalid';

  IF v_assigned IS NOT NULL THEN
    RAISE EXCEPTION 'a self-service lead from a stranger was routed to somebody';
  END IF;
  IF v_source <> 'website_self' THEN
    RAISE EXCEPTION 'a self-service lead was recorded as source % ', v_source;
  END IF;

  DELETE FROM public.unchained_leads WHERE id = v_lead;

  -- ── The same visitor, once they are a PAYING client ─────────────────
  INSERT INTO public.unchained_clients
    (name, email, owner_commercial_id, registered_by_commercial_id)
  VALUES ('__selfserve__', '__selfserve__@example.invalid', v_commercial, v_commercial)
  RETURNING id INTO v_client;

  INSERT INTO public.unchained_engagements
    (client_id, client_name, title, commercial_id, commercial_rate, status)
  VALUES (v_client, '', '__probe__', v_commercial, 0, 'proposal')
  RETURNING id INTO v_engagement;

  -- Not paid yet: a registration is not a relationship, so this must still be
  -- unassigned. This is the arm that stops registering everybody you ever met
  -- from becoming an income.
  v_result := public.create_public_lead(
    p_name         => '__selfserve__',
    p_email        => '__selfserve__@example.invalid',
    p_language     => 'es',
    p_self_service => TRUE
  );

  SELECT id, assigned_commercial_id INTO v_lead, v_assigned
    FROM public.unchained_leads WHERE email = '__selfserve__@example.invalid';

  IF v_assigned IS NOT NULL THEN
    RAISE EXCEPTION 'a lead was assigned on the strength of an UNPAID engagement';
  END IF;
  DELETE FROM public.unchained_leads WHERE id = v_lead;

  -- Walk it to paid, the only way the status machine allows.
  UPDATE public.unchained_engagements SET status = 'active'    WHERE id = v_engagement;
  UPDATE public.unchained_engagements SET status = 'delivered' WHERE id = v_engagement;
  UPDATE public.unchained_engagements SET status = 'paid'      WHERE id = v_engagement;

  v_result := public.create_public_lead(
    p_name         => '__selfserve__',
    p_email        => '__selfserve__@example.invalid',
    p_language     => 'es',
    p_self_service => TRUE
  );

  SELECT id, assigned_commercial_id INTO v_lead, v_assigned
    FROM public.unchained_leads WHERE email = '__selfserve__@example.invalid';

  IF v_assigned IS DISTINCT FROM v_commercial THEN
    RAISE EXCEPTION 'a returning paying client was not routed to their own representative';
  END IF;

  -- ── Clean up ────────────────────────────────────────────────────────
  DELETE FROM public.unchained_leads WHERE id = v_lead;
  DELETE FROM public.unchained_engagements WHERE client_id = v_client;
  DELETE FROM public.unchained_client_events WHERE client_id = v_client;
  DELETE FROM public.unchained_clients WHERE id = v_client;

  -- The probe's own throttle hits, so a re-run fifteen minutes from now starts
  -- from an empty bucket rather than from three.
  DELETE FROM public.unchained_lead_throttle
   WHERE bucket = md5('unchained-lead-throttle:email:__selfserve__@example.invalid');

  ALTER TABLE public.unchained_client_events ENABLE TRIGGER trg_unchained_client_events_append_only;
  ALTER TABLE public.unchained_lead_events   ENABLE TRIGGER trg_unchained_lead_events_append_only;
END;
$$;

-- ════════════════════════════════════════════════════════════
-- Step 2b — sever every identity the old project issued
-- ════════════════════════════════════════════════════════════
-- Runs inside import-into-unchained.sh's transaction, immediately after the
-- data is replayed and while the user triggers are still DISABLED. Never run
-- it on its own against a database that is already live: it NULLs columns, and
-- on a live database one of those NULLs would be refused anyway.
--
-- The trigger state is not incidental. unchained_lead_events carries
-- trg_unchained_lead_events_append_only, a BEFORE UPDATE OR DELETE trigger that
-- raises unconditionally, so the actor_id clear below is only possible as part
-- of the load. That is the honest description of what this file is: the last
-- step of importing the rows, not an edit to rows that have been imported.
--
-- Three columns in the exported data hold a UUID that means "a row in
-- auth.users". Those UUIDs belong to the OLD project. Over here they name
-- nothing, and the foreign keys would have refused them on the way in if the
-- triggers had not been off — which is the honest reason this file exists
-- rather than a nicety:
--
--   commercial_contacts.user_id     which login this representative uses
--   unchained_specialists.user_id   which login this specialist uses
--   unchained_lead_events.actor_id  who performed a historical action
--
-- The first two are re-established by re-inviting each person from the panel
-- (runbook step 6). create-unchained-member finds the roster row by email and
-- writes the NEW user_id into it, so the link is rebuilt by the same code path
-- that creates it in the first place.
--
-- actor_id is NOT rebuilt, and should not be. It records who did something in
-- a database that no longer exists. A NULL actor on a historical event is the
-- truth: the event happened, and the account that performed it is not an
-- account of this system. Inventing a mapping to the new users would be
-- fabricating audit history. The events keep their kind, their payload and
-- their timestamp, which is what the lead timeline actually renders.

-- ─── 1. Sever the identities ──────────────────────────────────────────────

UPDATE public.commercial_contacts    SET user_id  = NULL WHERE user_id  IS NOT NULL;
UPDATE public.unchained_specialists  SET user_id  = NULL WHERE user_id  IS NOT NULL;
UPDATE public.unchained_lead_events  SET actor_id = NULL WHERE actor_id IS NOT NULL;

-- ─── 2. Assert that nothing survived that should not have ─────────────────
-- These run before COMMIT. A failure rolls the whole import back rather than
-- leaving a database that half-remembers the old project.

DO $do$
DECLARE
  v_n      BIGINT;
  v_extra  TEXT;
BEGIN
  SELECT count(*) INTO v_n FROM public.commercial_contacts   WHERE user_id  IS NOT NULL;
  IF v_n > 0 THEN RAISE EXCEPTION '[fail] % commercial_contacts row(s) still carry a user_id from the old project', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.unchained_specialists WHERE user_id  IS NOT NULL;
  IF v_n > 0 THEN RAISE EXCEPTION '[fail] % unchained_specialists row(s) still carry a user_id from the old project', v_n; END IF;

  SELECT count(*) INTO v_n FROM public.unchained_lead_events WHERE actor_id IS NOT NULL;
  IF v_n > 0 THEN RAISE EXCEPTION '[fail] % unchained_lead_events row(s) still carry an actor_id from the old project', v_n; END IF;

  -- No membership can exist yet: nobody has been invited into this project.
  -- A row here would mean the export carried something it was told not to.
  SELECT count(*) INTO v_n FROM public.product_memberships;
  IF v_n > 0 THEN RAISE EXCEPTION '[fail] product_memberships is not empty (% row(s)) — memberships are rebuilt by re-inviting, never imported', v_n; END IF;

  -- The isolation invariant, checked once more against real data rather than
  -- against an empty table as the foundation migration did.
  SELECT string_agg(id, ', ' ORDER BY id) INTO v_extra
    FROM public.platform_products WHERE id <> 'unchained';
  IF v_extra IS NOT NULL THEN
    RAISE EXCEPTION '[fail] platform_products holds: %. This database is Unchained''s alone.', v_extra;
  END IF;
END;
$do$;

-- ─── 3. What came across ──────────────────────────────────────────────────
-- Printed so the cutover has a record of the counts to compare against the
-- source. Compare these against the numbers export-from-tancerca.sh reported.

DO $do$
DECLARE
  r RECORD;
BEGIN
  RAISE NOTICE '─── imported row counts ───';
  FOR r IN
    SELECT 'unchained_services'               AS t, count(*) AS n FROM public.unchained_services
    UNION ALL SELECT 'commercial_regions',               count(*) FROM public.commercial_regions
    UNION ALL SELECT 'commercial_contacts',              count(*) FROM public.commercial_contacts
    UNION ALL SELECT 'commercial_contact_regions',       count(*) FROM public.commercial_contact_regions
    UNION ALL SELECT 'routing_rules',                    count(*) FROM public.routing_rules
    UNION ALL SELECT 'unchained_leads',                  count(*) FROM public.unchained_leads
    UNION ALL SELECT 'unchained_lead_events',            count(*) FROM public.unchained_lead_events
    UNION ALL SELECT 'unchained_specialists',            count(*) FROM public.unchained_specialists
    UNION ALL SELECT 'unchained_engagements',            count(*) FROM public.unchained_engagements
    UNION ALL SELECT 'unchained_engagement_specialists', count(*) FROM public.unchained_engagement_specialists
    ORDER BY 1
  LOOP
    RAISE NOTICE '  % : %', rpad(r.t, 34), r.n;
  END LOOP;

  RAISE NOTICE '─── still to do ───';
  RAISE NOTICE '  every commercial and specialist has user_id = NULL and cannot sign in';
  RAISE NOTICE '  until they are re-invited from the panel. See docs/database-isolation.md step 6.';
END;
$do$;

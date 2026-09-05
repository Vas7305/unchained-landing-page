-- ┌────────────────────────────────────────────────────────────────────────┐
-- │ PORTED FILE — the reasoning below predates this database                │
-- └────────────────────────────────────────────────────────────────────────┘
-- Copied unchanged (this banner aside) from TanCerca's
--   supabase/migrations/20260901000002_resolve_commercial_contact.sql
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
-- Phase 4 — the commercial routing resolver
-- ════════════════════════════════════════════════════════════
-- Depends on 20260901000001_unchained_commercial.sql.
--
-- public.resolve_commercial_contact(country_code, language)
--   → at most one row: the representative who should receive this inquiry.
--
-- This function is the ENTIRE public surface of the commercial module. It is
-- the reason the four tables underneath it need no anonymous SELECT policy:
-- the public website asks a question and receives an answer, instead of
-- receiving the contact table and deciding for itself.
--
-- ─── Why SECURITY DEFINER ─────────────────────────────────────────────────
-- RLS on the four tables denies anon outright. A SECURITY INVOKER function
-- would inherit that denial and return nothing for exactly the caller it
-- exists to serve. SECURITY DEFINER lets the function read the tables while
-- the caller still cannot, which is the property that makes §19 achievable.
--
-- The privilege is contained by the function's shape, not by trust in the
-- caller:
--   · it takes two scalars and no predicate, so there is no filter to inject;
--   · it returns eight fixed columns, never the row's internal state —
--     no priority, no active flag, no notes, no timezone, no rule, no id of
--     anything but the contact itself;
--   · it returns at most one row (LIMIT 1), so it cannot be used to page
--     through the table;
--   · it is STABLE and performs no write, so it cannot be used to change
--     anything.
--
-- An anonymous caller can therefore learn "who serves country X in language
-- Y", which is precisely what the public site is going to display anyway, and
-- nothing else. It cannot enumerate the roster, cannot see who is inactive,
-- and cannot discover the priorities that produced the answer.
--
-- `SET search_path = ''` with every object schema-qualified, per the hardening
-- standard established in 20260816000003. For a SECURITY DEFINER function this
-- is not optional: without it the body resolves unqualified names using the
-- CALLER's search_path, which is the exact defect behind the 2026-08-02 and
-- 2026-08-16 incidents.

-- ─── The algorithm ────────────────────────────────────────────────────────
-- Deterministic. Same inputs, same database state, same answer, always — there
-- is no randomness, no round-robin, and no dependence on physical row order.
--
--   1. Normalise the request.
--        country_code → upper case, trimmed. NULL becomes ''.
--        language     → lower case, trimmed. NULL becomes '', meaning
--                       "no language preference", which is not the same as
--                       an unmatched language.
--
--   2. Resolve the country to exactly one ACTIVE region.
--        No region, or an inactive one, ends the query here with zero rows.
--        An unknown country and a deactivated country are indistinguishable
--        to the caller, deliberately.
--
--   3. Build the eligible set: every ACTIVE contact holding an assignment to
--      that region. This is the only source of eligibility. A routing rule
--      cannot add a contact here and cannot remove one — which is what makes
--      "deactivate the contact" a complete answer to "stop routing to them".
--
--   4. Give each candidate an effective priority:
--        the lowest priority among that pair's ACTIVE routing rules whose
--        language is NULL or equals the requested language,
--        falling back to the assignment's own priority when no rule applies.
--      min() is what makes overlapping rules deterministic: when both an
--      any-language rule and a language-specific rule match, the stronger
--      (lower) number wins rather than whichever the planner reached first.
--
--   5. Mark each candidate as a language match: the request named a language
--      AND the contact's `languages` array contains it. An empty request
--      language matches nobody, so a caller who omits the language gets the
--      pure priority order rather than an arbitrary tie-break.
--
--   6. Order by, in strict sequence:
--        a. language match first          (true before false)
--        b. then effective priority       (lower first)
--        c. then name                     (A→Z)
--        d. then id                       (final tie-break)
--      (c) and (d) exist so that two contacts with identical rank still
--      produce a stable answer. Without them the result would depend on the
--      plan, and §8's "multiple eligible contacts → deterministic result"
--      would be false in exactly the case it is asking about.
--
--   7. Return the first row, or no row at all.
--
-- Language preference outranks priority: a lower-priority representative who
-- speaks the customer's language beats a higher-priority one who does not.
-- That is §16's requirement, and step 6(a) is where it is enforced. If no
-- candidate speaks the language, every candidate is an equal non-match at
-- step 6(a) and the ordering falls through to priority, which is §17 step 6.
--
-- ─── Global fallback (§34) ────────────────────────────────────────────────
-- Not implemented, and no column has been added for it, because §6 forbids
-- speculative fields and §25 forbids inventing a contact to fill it. The
-- extension point is the SELECT below: a fallback becomes a second CTE
-- UNION-ed under `eligible` with a sentinel priority above every real one, so
-- it can only ever win when the regional set is empty. Until such a contact
-- exists, zero rows is the honest answer and the caller renders "No regional
-- commercial available".

CREATE OR REPLACE FUNCTION public.resolve_commercial_contact(
  p_country_code TEXT,
  p_language     TEXT DEFAULT NULL
)
RETURNS TABLE (
  commercial_id      UUID,
  name               TEXT,
  role               TEXT,
  email              TEXT,
  whatsapp_number    TEXT,
  telegram_username  TEXT,
  calcom_url         TEXT,
  avatar_url         TEXT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $$
  WITH req AS (
    SELECT
      upper(btrim(COALESCE(p_country_code, ''))) AS country_code,
      lower(btrim(COALESCE(p_language, '')))     AS language
  ),
  eligible AS (
    SELECT
      c.id,
      c.name,
      c.role,
      c.email,
      c.whatsapp_number,
      c.telegram_username,
      c.calcom_url,
      c.avatar_url,
      COALESCE(
        (
          SELECT min(rr.priority)
            FROM public.routing_rules rr
           WHERE rr.region_id  = r.id
             AND rr.contact_id = c.id
             AND rr.active
             AND (
                   rr.language IS NULL
                   OR (req.language <> '' AND rr.language = req.language)
                 )
        ),
        ccr.priority
      ) AS effective_priority,
      (
        req.language <> ''
        AND c.languages @> ARRAY[req.language]::TEXT[]
      ) AS language_match
    FROM req
    JOIN public.commercial_regions r
      ON r.country_code = req.country_code
     AND r.active
    JOIN public.commercial_contact_regions ccr
      ON ccr.region_id = r.id
    JOIN public.commercial_contacts c
      ON c.id = ccr.contact_id
     AND c.active
  )
  SELECT
    e.id,
    e.name,
    e.role,
    e.email,
    e.whatsapp_number,
    e.telegram_username,
    e.calcom_url,
    e.avatar_url
  FROM eligible e
  ORDER BY
    e.language_match     DESC,   -- true sorts before false
    e.effective_priority ASC,    -- lower number wins
    e.name               ASC,
    e.id                 ASC
  LIMIT 1;
$$;

-- ─── Grants ───────────────────────────────────────────────────────────────
-- Revoke first, then grant explicitly: a CREATE OR REPLACE keeps the existing
-- ACL, so re-running this file must not silently accumulate a grant somebody
-- added by hand.
--
-- anon is granted on purpose. It is the whole design: the public website will
-- call this with the anon key and must never hold table access. Granting it
-- here rather than in a later migration keeps the function's contract and its
-- reachability in the same reviewable change.
--
-- Note that anon EXECUTE is not a widening of what anon can reach — without
-- it, anon can reach nothing here at all, and the alternative the public site
-- would need is a SELECT policy on commercial_contacts, which §20 forbids and
-- which would expose every column of every row including the inactive ones.

REVOKE ALL ON FUNCTION public.resolve_commercial_contact(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resolve_commercial_contact(TEXT, TEXT) TO anon, authenticated;

-- ─── Apply-time verification ──────────────────────────────────────────────
-- The tables are empty when this first runs, so these assert the properties
-- that hold regardless of data: the function resolves under a hostile
-- search_path, tolerates every degenerate input §33 lists, and never raises.
-- Behavioural coverage over populated data is the vitest suite in
-- admin-panel/src/features/commercial/routing.test.ts, which pins the same
-- ordering rules against the TypeScript transcription of this algorithm.

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SET LOCAL search_path = '';

  SELECT count(*) INTO v_count FROM public.resolve_commercial_contact('RU', 'ru');
  RAISE NOTICE '[ok] resolver ran under an empty search_path (RU/ru returned % row(s))', v_count;

  -- §33: none of these may raise. Each must simply resolve to no contact.
  --
  -- `PERFORM 1 FROM f(...)` rather than `PERFORM f(...)`: the function returns
  -- a set, so it belongs in the FROM clause. Calling a set-returning function
  -- in the target list would evaluate it as a composite and would not exercise
  -- the same execution path the RPC takes.
  PERFORM 1 FROM public.resolve_commercial_contact(NULL, NULL);
  PERFORM 1 FROM public.resolve_commercial_contact('', '');
  PERFORM 1 FROM public.resolve_commercial_contact('ZZ', 'zz');
  PERFORM 1 FROM public.resolve_commercial_contact('ru', 'RU');       -- case is normalised
  PERFORM 1 FROM public.resolve_commercial_contact('  ru  ', ' RU '); -- whitespace is trimmed
  PERFORM 1 FROM public.resolve_commercial_contact('NOT A COUNTRY', 'not a language');
  PERFORM 1 FROM public.resolve_commercial_contact('RU');             -- language omitted entirely
  RAISE NOTICE '[ok] degenerate inputs resolve to no contact without raising';
END;
$$;

-- Guard the security properties themselves. A future CREATE OR REPLACE that
-- drops SECURITY DEFINER would make the public path silently return nothing;
-- one that drops the pinned search_path would reintroduce the 2026-08 defect
-- class. Both are caught here rather than in production.
DO $$
DECLARE
  v_secdef   BOOLEAN;
  v_config   TEXT[];
  v_provolat CHAR;
  v_entry    TEXT;
  v_value    TEXT;
BEGIN
  SELECT p.prosecdef, p.proconfig, p.provolatile
    INTO v_secdef, v_config, v_provolat
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public'
     AND p.proname = 'resolve_commercial_contact';

  IF NOT v_secdef THEN
    RAISE EXCEPTION '[fail] resolve_commercial_contact must be SECURITY DEFINER or the public path returns nothing';
  END IF;

  -- proconfig holds one 'name=value' string per SET clause. An empty
  -- search_path is stored with the VALUE quoted — `search_path=""` — because
  -- an unquoted empty value would be indistinguishable from an absent one.
  -- Some versions/paths write the bare `search_path=` instead, so the value is
  -- extracted and unquoted rather than matched against a fixed literal.
  SELECT cfg INTO v_entry
    FROM unnest(COALESCE(v_config, ARRAY[]::TEXT[])) AS cfg
   WHERE cfg LIKE 'search_path=%';

  IF v_entry IS NULL THEN
    RAISE EXCEPTION '[fail] resolve_commercial_contact does not pin search_path at all (proconfig: %)',
      COALESCE(array_to_string(v_config, ','), 'nothing');
  END IF;

  -- 'search_path=' is 12 characters, so the value starts at 13.
  v_value := btrim(substring(v_entry FROM 13), '"');

  IF v_value <> '' THEN
    RAISE EXCEPTION '[fail] resolve_commercial_contact must pin search_path to the empty string (found: %)', v_entry;
  END IF;

  IF v_provolat <> 's' THEN
    RAISE EXCEPTION '[fail] resolve_commercial_contact must be STABLE, so it cannot be used to write';
  END IF;

  RAISE NOTICE '[ok] resolver is SECURITY DEFINER, STABLE, search_path pinned empty (%)', v_entry;
END;
$$;

NOTIFY pgrst, 'reload schema';

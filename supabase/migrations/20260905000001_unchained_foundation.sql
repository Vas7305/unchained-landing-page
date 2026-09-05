-- ════════════════════════════════════════════════════════════
-- Phase 9 — Unchained Business: the foundation of its OWN database
-- ════════════════════════════════════════════════════════════
-- This is the first migration of a Supabase project that belongs to Unchained
-- Business and to nothing else. It has no dependencies. Everything after it in
-- this directory is the Unchained schema as it was written for Phases 4, 7 and
-- 8, carried over unchanged.
--
-- ─── Why this file exists ─────────────────────────────────────────────────
-- Until now the Unchained schema lived inside TanCerca's Supabase project and
-- CALLED four things it did not own: public.is_super_admin(), public.roles,
-- public.platform_products and public.product_memberships. That was a sound
-- design for one product sharing another's install. It stops being sound the
-- moment the two are supposed to be separate businesses, because the thing
-- they shared hardest was never a table — it was auth.users.
--
-- One auth.users means ONE identity namespace. An address that signs up as a
-- TanCerca customer is, from GoTrue's point of view, the same account that an
-- Unchained super_admin later tries to invite as a specialist. The invite path
-- has to detect that and fall back to a magic link; when that detection failed
-- (auth.admin.listUsers() pages at 50, so account 51+ read as "new"), the
-- operator was told an address was "already registered" for somebody who had
-- never touched Unchained. That bug was real and is fixed, but it was only
-- ever able to say that sentence because the two products shared a user table.
--
-- Separate projects remove the class, not just the instance. In this database
-- the address genuinely does not exist until Unchained invites it.
--
-- ─── What isolation means here, concretely ────────────────────────────────
--   · auth.users        — Unchained's people only. No TanCerca customer.
--   · roles             — Unchained's super_admins only.
--   · email             — this project's own sender, templates and API key.
--   · storage, logs     — this project's.
--   · service_role key  — grants nothing in any other product's database.
--
-- The same recipe is what a future site (Frito, and whatever follows) gets:
-- its own project, its own auth, its own keys. Not a schema in here, and not a
-- product_id in here. See docs/database-isolation.md.
--
-- ─── Why the product seam is KEPT ─────────────────────────────────────────
-- platform_products / product_memberships are ported rather than dropped, even
-- though this project now holds exactly one product. Two reasons, in order:
--
--   1. Every RLS policy, SECURITY DEFINER helper and panel query written in
--      Phases 7 and 8 reads them. Removing the seam would mean rewriting the
--      3,869 lines that follow, and rewriting working authorization to save a
--      two-column table is a bad trade.
--   2. The seam is what distinguishes an unchained_admin from a commercial
--      from a specialist. That distinction is internal to Unchained and does
--      not go away when TanCerca does.
--
-- What IS dropped is the second row: 'tancerca' is not seeded here and must
-- never be. product_memberships has a foreign key to platform_products, so a
-- membership naming another product cannot be inserted at all — the isolation
-- is enforced by the schema rather than by discipline. See the assertion in §9.
--
-- ─── Deviations from TanCerca's originals, and why ────────────────────────
-- Three, all of them repairs that were impossible to make over there because
-- they would have changed who can do what in a live product:
--
--   · public.roles carries UNIQUE (user_id, role), not UNIQUE (user_id).
--     TanCerca's table was created three times with three different constraint
--     sets (see its 20260831000001_security_foundation.sql §3); whichever ran
--     first won, and the winner allows one role per person. That is the reason
--     Phase 4 could not introduce 'unchained_admin' as a global role and had
--     to gate five policies on is_super_admin() instead. A fresh database has
--     no such history: here a person may hold more than one role.
--
--   · public.roles carries a slug CHECK instead of
--     CHECK (role IN ('user','super_admin')). Same reason.
--
--   · public.admin_logs has no target_tenant_id. That column referenced
--     public.tenants, which is a TanCerca table and is not coming.
--
-- Nothing else is changed. is_super_admin(), has_product_access() and
-- get_my_authorized_products() keep the bodies this schema has been running
-- against, so the ported files behave here exactly as they behaved there.

-- ─── 1. roles ─────────────────────────────────────────────────────────────
-- Who is an operator of this database. Deliberately small: one row per grant,
-- and the only value that means anything today is 'super_admin'.
--
-- Product-level roles do NOT live here — they are product_memberships rows.
-- This table answers exactly one question: "may this person administer the
-- whole install".

CREATE TABLE IF NOT EXISTS public.roles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Multi-role by construction. See the header: the single-role constraint in
  -- TanCerca is a historical accident that cost Phase 4 a design compromise,
  -- and it is not being reproduced.
  CONSTRAINT roles_user_role_unique UNIQUE (user_id, role),

  -- A slug, not an enum. Adding a role becomes a data change rather than a
  -- migration against a CHECK — the same reasoning product_memberships.role
  -- already applies to product roles.
  CONSTRAINT roles_role_format CHECK (role ~ '^[a-z][a-z0-9_]{1,40}$')
);

CREATE INDEX IF NOT EXISTS idx_roles_user_id ON public.roles(user_id);

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- The first super_admin row must be inserted with the service_role key, which
-- bypasses RLS. There is no bootstrap path through the anon key and there must
-- not be one. See docs/database-isolation.md.
--
-- The management policy reads the JWT rather than this table: a policy on
-- public.roles that queried public.roles is a recursion. app_metadata is set
-- by the server and cannot be edited by the holder of the session.
DROP POLICY IF EXISTS roles_super_admin_all ON public.roles;
CREATE POLICY roles_super_admin_all ON public.roles
  FOR ALL TO authenticated
  USING      ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin')
  WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'super_admin');

DROP POLICY IF EXISTS roles_self_read ON public.roles;
CREATE POLICY roles_self_read ON public.roles
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

REVOKE ALL ON TABLE public.roles FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.roles TO authenticated;

-- ─── 2. is_super_admin() ──────────────────────────────────────────────────
-- The predicate every administrative policy in this database gates on.
--
-- Carried over from the hardened definition TanCerca arrived at after two
-- production incidents (2026-08-02, 2026-08-16), both caused by a SECURITY
-- DEFINER function without a pinned search_path. `SET search_path = ''` makes
-- name resolution independent of the caller and every object below is schema-
-- qualified, so nothing can be shadowed by a temp table or by a schema earlier
-- in somebody else's path.
--
-- Granted to anon as well as authenticated on purpose: RLS expressions are
-- evaluated as the QUERYING role, so a policy that calls this function raises
-- 42501 for anon without the grant, instead of simply returning false.

CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = ''
AS $fn$
  SELECT EXISTS (
    SELECT 1
    FROM public.roles
    WHERE user_id = (SELECT auth.uid()) AND role = 'super_admin'
  );
$fn$;

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated, anon;

-- Apply-time regression test: call it from a context with NO search_path at
-- all. An unhardened definition raises `relation "roles" does not exist` here.
-- If this raises, the whole migration rolls back.
DO $do$
DECLARE
  v_result BOOLEAN;
BEGIN
  SET LOCAL search_path = '';
  SELECT public.is_super_admin() INTO v_result;
  RAISE NOTICE '[ok] is_super_admin() resolved under an empty search_path (returned %)', v_result;
END;
$do$;

-- ─── 3. admin_logs ────────────────────────────────────────────────────────
-- Audit trail for privileged actions. Written by the edge functions with the
-- service_role key, which bypasses RLS; readable by a super_admin.
--
-- TanCerca's version carried target_tenant_id REFERENCES public.tenants. There
-- are no tenants in this database, so the column is gone rather than left as a
-- nullable orphan. Anything an Unchained action needs to record about its
-- target goes in `metadata`, which is where create-unchained-member already
-- puts it.

CREATE TABLE IF NOT EXISTS public.admin_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id   UUID NOT NULL REFERENCES auth.users(id),
  action     TEXT NOT NULL,
  metadata   JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_logs_admin_id   ON public.admin_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_logs_created_at ON public.admin_logs(created_at DESC);

ALTER TABLE public.admin_logs ENABLE ROW LEVEL SECURITY;

-- Read-only to a super_admin, and nothing else to anyone. An audit trail an
-- operator can UPDATE is not an audit trail; the service_role writer does not
-- go through RLS and does not need a policy.
DROP POLICY IF EXISTS admin_logs_super_admin_read ON public.admin_logs;
CREATE POLICY admin_logs_super_admin_read ON public.admin_logs
  FOR SELECT TO authenticated
  USING (public.is_super_admin());

REVOKE ALL ON TABLE public.admin_logs FROM anon, authenticated;
GRANT SELECT ON TABLE public.admin_logs TO authenticated;

-- ─── 4. platform_touch_updated_at() ───────────────────────────────────────
-- Shared BEFORE UPDATE trigger for the two platform tables. SECURITY INVOKER
-- with a pinned search_path.

CREATE OR REPLACE FUNCTION public.platform_touch_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $fn$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$fn$;

-- ─── 5. platform_products ─────────────────────────────────────────────────
-- The list of products this database knows about, and which are enabled.
-- Presentation (display name, base path, chrome) stays in the front-end
-- registry; what lives here is only what an authorization decision needs.

CREATE TABLE IF NOT EXISTS public.platform_products (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT platform_products_id_format
    CHECK (id ~ '^[a-z][a-z0-9_]{1,30}$'),
  CONSTRAINT platform_products_name_present
    CHECK (length(btrim(name)) > 0)
);

DROP TRIGGER IF EXISTS trg_platform_products_updated_at ON public.platform_products;
CREATE TRIGGER trg_platform_products_updated_at
  BEFORE UPDATE ON public.platform_products
  FOR EACH ROW EXECUTE FUNCTION public.platform_touch_updated_at();

-- ─── 6. product_memberships ───────────────────────────────────────────────
-- One row per (person, product, role) grant. Unchanged from the original,
-- including the partial unique index that makes revocation a flag rather than
-- a delete: a total UNIQUE would make it impossible to ever re-grant a role
-- somebody once held.

CREATE TABLE IF NOT EXISTS public.product_memberships (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id)               ON DELETE CASCADE,
  -- No ON DELETE clause: RESTRICT is the default and is what we want. A
  -- product with live memberships must be disabled, not deleted out from
  -- under them.
  product_id  TEXT NOT NULL REFERENCES public.platform_products(id) ON UPDATE CASCADE,
  role        TEXT NOT NULL,
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT product_memberships_role_format
    CHECK (role ~ '^[a-z][a-z0-9_]{1,40}$')
);

CREATE UNIQUE INDEX IF NOT EXISTS product_memberships_active_unique
  ON public.product_memberships (user_id, product_id, role)
  WHERE active;

CREATE INDEX IF NOT EXISTS idx_product_memberships_user_product
  ON public.product_memberships (user_id, product_id)
  WHERE active;

CREATE INDEX IF NOT EXISTS idx_product_memberships_product
  ON public.product_memberships (product_id, active, user_id);

DROP TRIGGER IF EXISTS trg_product_memberships_updated_at ON public.product_memberships;
CREATE TRIGGER trg_product_memberships_updated_at
  BEFORE UPDATE ON public.product_memberships
  FOR EACH ROW EXECUTE FUNCTION public.platform_touch_updated_at();

-- ─── 7. Seed: one product, and only one ───────────────────────────────────
-- 'tancerca' is deliberately absent, and so is every future site. Another web
-- property gets its own Supabase project — not a row here.

INSERT INTO public.platform_products (id, name, enabled) VALUES
  ('unchained', 'Unchained Business', TRUE)
ON CONFLICT (id) DO NOTHING;

-- ─── 8. has_product_access() / get_my_authorized_products() ───────────────
-- Both take identity from auth.uid() and from nowhere else, so a client cannot
-- ask a question about somebody else. SECURITY DEFINER because both read
-- product_memberships rows the caller cannot select.

CREATE OR REPLACE FUNCTION public.has_product_access(p_product_id TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT (SELECT auth.uid()) IS NOT NULL
     AND EXISTS (
           SELECT 1 FROM public.platform_products p
           WHERE p.id = p_product_id AND p.enabled
         )
     AND (
           public.is_super_admin()
           OR EXISTS (
                SELECT 1 FROM public.product_memberships m
                WHERE m.user_id = (SELECT auth.uid())
                  AND m.product_id = p_product_id
                  AND m.active
              )
         );
$fn$;

CREATE OR REPLACE FUNCTION public.get_my_authorized_products()
RETURNS TABLE (product_id TEXT, role TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $fn$
  SELECT p.id, 'super_admin'::TEXT
    FROM public.platform_products p
   WHERE p.enabled
     AND (SELECT auth.uid()) IS NOT NULL
     AND public.is_super_admin()
  UNION
  SELECT m.product_id, m.role
    FROM public.product_memberships m
    JOIN public.platform_products p ON p.id = m.product_id
   WHERE m.active
     AND p.enabled
     AND m.user_id = (SELECT auth.uid())
   ORDER BY 1, 2;
$fn$;

REVOKE ALL ON FUNCTION public.has_product_access(TEXT)     FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_my_authorized_products() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_product_access(TEXT)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_authorized_products() TO authenticated;

ALTER TABLE public.platform_products   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_memberships ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS platform_products_read_enabled ON public.platform_products;
CREATE POLICY platform_products_read_enabled ON public.platform_products
  FOR SELECT TO authenticated
  USING (enabled);

DROP POLICY IF EXISTS platform_products_super_admin_all ON public.platform_products;
CREATE POLICY platform_products_super_admin_all ON public.platform_products
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

-- Self-read is FOR SELECT and can never authorize a write. A widened self
-- policy would let any signed-in user INSERT their own membership and grant
-- themselves the product.
DROP POLICY IF EXISTS product_memberships_self_read ON public.product_memberships;
CREATE POLICY product_memberships_self_read ON public.product_memberships
  FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS product_memberships_super_admin_all ON public.product_memberships;
CREATE POLICY product_memberships_super_admin_all ON public.product_memberships
  FOR ALL TO authenticated
  USING (public.is_super_admin())
  WITH CHECK (public.is_super_admin());

REVOKE ALL ON TABLE public.platform_products   FROM anon;
REVOKE ALL ON TABLE public.product_memberships FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.platform_products   TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.product_memberships TO authenticated;

-- ─── 9. Apply-time assertions ─────────────────────────────────────────────
-- Cheap, and they fail the whole migration rather than leaving a half-secured
-- database behind.

DO $do$
DECLARE
  v_bad TEXT;
BEGIN
  -- 9.1 RLS is on everywhere it must be.
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO v_bad
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public'
     AND c.relname IN ('roles', 'admin_logs', 'platform_products', 'product_memberships')
     AND NOT c.relrowsecurity;
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION '[fail] RLS is not enabled on: %', v_bad;
  END IF;

  -- 9.2 The isolation itself: this database knows about exactly one product.
  -- If a later migration ever seeds a second one, that is the moment somebody
  -- is re-creating the thing this phase undid.
  IF EXISTS (SELECT 1 FROM public.platform_products WHERE id <> 'unchained') THEN
    RAISE EXCEPTION '[fail] platform_products holds a product other than unchained. This database is Unchained''s alone — another site gets its own Supabase project, not a row here.';
  END IF;

  -- 9.3 Nothing administrative is reachable by the website's anonymous key.
  IF has_function_privilege('anon', 'public.has_product_access(text)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.get_my_authorized_products()', 'EXECUTE') THEN
    RAISE EXCEPTION '[fail] an authorization helper is EXECUTE-able by anon';
  END IF;

  IF has_table_privilege('anon', 'public.roles', 'SELECT')
     OR has_table_privilege('anon', 'public.product_memberships', 'SELECT') THEN
    RAISE EXCEPTION '[fail] anon can read roles or product_memberships';
  END IF;

  RAISE NOTICE '[ok] Unchained foundation applied: roles, admin_logs, platform_products, product_memberships';
END;
$do$;

NOTIFY pgrst, 'reload schema';

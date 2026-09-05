-- ════════════════════════════════════════════════════════════
-- Step 5 (Studio) — the first operator of the new database
-- ════════════════════════════════════════════════════════════
-- Paste this whole file into the SQL editor and run it. In the normal case
-- there is NOTHING to edit.
--
-- ─── Do this first ────────────────────────────────────────────────────────
--     Authentication -> Users -> Add user -> Create new user
--
-- Use YOUR address, and let it set a password. It is a fresh auth.users in a
-- fresh project, so the same address existing in TanCerca is irrelevant here.
-- That is the entire point of the separation, and this is the first place you
-- will watch it hold.
--
-- ─── Then run this ────────────────────────────────────────────────────────
-- With exactly one account in the project — which is what you have right after
-- the step above — this finds it on its own and makes it the super_admin. No
-- address to type, so no address to mistype.
--
-- An earlier version of this file made you replace a placeholder and refused to
-- run until you did. That is a guard rail that fires on everybody's first
-- attempt, which makes it a bug rather than a safety feature.
--
-- If the project has SEVERAL accounts, "the operator" is genuinely ambiguous
-- and this stops and says so. Put your address between the quotes on the next
-- line and run it again.

BEGIN;

DO $do$
DECLARE
  -- Optional. Leave empty to use the project's only account.
  v_email TEXT := NULLIF('', '');
  v_uid   UUID;
  v_count INTEGER;
BEGIN
  IF v_email IS NULL THEN
    SELECT count(*) INTO v_count FROM auth.users;

    IF v_count = 0 THEN
      RAISE EXCEPTION
        'This project has no accounts yet. Create yours first: Authentication -> Users -> Add user.';
    ELSIF v_count > 1 THEN
      RAISE EXCEPTION
        'This project has % accounts, so "the first operator" is ambiguous. Put your address between the quotes near the top of this file and run it again.',
        v_count;
    END IF;

    SELECT id, email INTO v_uid, v_email FROM auth.users;
  ELSE
    SELECT id INTO v_uid FROM auth.users WHERE lower(email) = lower(v_email);
    IF v_uid IS NULL THEN
      RAISE EXCEPTION
        'No account for % in this project. Create it first: Authentication -> Users -> Add user.',
        v_email;
    END IF;
  END IF;

  -- ─── 1. The role row ────────────────────────────────────────────────────
  -- What public.is_super_admin() reads, and therefore what every
  -- administrative RLS policy in this database ultimately gates on.
  INSERT INTO public.roles (user_id, role)
  VALUES (v_uid, 'super_admin')
  ON CONFLICT (user_id, role) DO NOTHING;

  -- ─── 2. The JWT claim ───────────────────────────────────────────────────
  -- Needed as well, for one specific thing: the policy that lets a super_admin
  -- MANAGE public.roles reads app_metadata from the JWT rather than querying
  -- public.roles, because a policy on roles that queried roles would recurse.
  -- app_metadata is server-controlled — the holder of the session cannot edit
  -- it — which is what makes it safe to trust here.
  --
  -- Without this the account still administers everything else correctly
  -- (is_super_admin() reads the table, not the token) but cannot appoint a
  -- second super_admin, which is the one thing a first operator most needs to
  -- be able to do.
  UPDATE auth.users
     SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb)
                             || jsonb_build_object('role', 'super_admin')
   WHERE id = v_uid;

  RAISE NOTICE '[ok] % is a super_admin of this database (user_id %)', v_email, v_uid;
END;
$do$;

COMMIT;

-- One row: your address, super_admin, and the claim set.
--
-- The claim only reaches your token at the NEXT sign-in. If you are already
-- signed in to the panel, sign out and back in, or you will be a super_admin
-- who cannot appoint the second one.
SELECT u.email,
       r.role,
       u.raw_app_meta_data ->> 'role' AS jwt_claim,
       r.created_at
  FROM public.roles r
  JOIN auth.users u ON u.id = r.user_id
 ORDER BY r.created_at;

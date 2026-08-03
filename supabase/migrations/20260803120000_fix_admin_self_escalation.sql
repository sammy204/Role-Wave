/*
# Fix: self-admin escalation via profiles.is_admin

Issue: "profiles_self_update" (added in 20260622123000_admin_auth_and_review.sql)
lets any authenticated user UPDATE their own profiles row with no column
restriction. RLS in Postgres governs which ROWS a role can touch, not which
COLUMNS — so any authenticated user can currently run:

    supabase.from('profiles').update({ is_admin: true }).eq('id', user.id)

directly from the browser (no app code required) and become an admin with
full control over jobs, companies, applicants, and moderation data.

This migration closes it three ways:
1. Column-level privilege lockdown — authenticated can no longer UPDATE the
   is_admin column at all, regardless of what any future RLS policy allows.
   This is the primary fix and holds even if a policy regresses later.
2. A BEFORE UPDATE trigger as defense-in-depth — belt-and-suspenders in case
   a future migration re-grants broad UPDATE privileges on profiles without
   remembering this constraint. Silently reverts any attempted is_admin
   change from a non-admin, non-service-role caller instead of erroring, so
   it can't be used as an oracle to enumerate admin status.
3. bootstrap_first_admin() locked down — EXECUTE revoked from PUBLIC and
   authenticated. It's already unused by the client (verified: no callers
   in src/). Restricted to service_role only, so it can still be run
   manually from the Supabase SQL editor / dashboard if a fresh environment
   ever needs its first admin seeded, but can no longer be invoked over the
   public API by any logged-in user.

No application code changes required — confirmed no client code updates
`profiles` directly (only `candidate_profiles`), and admin job actions
already run through `admin_update_job_status` / `admin_delete_job`, which
gate on `is_admin_user()` server-side.
*/

-- 1. Column-level privilege lockdown ----------------------------------------

-- Supabase's default grants give `authenticated` blanket UPDATE on tables in
-- the public schema. Revoke it and re-grant only the columns that are
-- legitimately self-editable, explicitly excluding is_admin (and id,
-- created_at, account_type, which also have no business being user-editable
-- via this path).
REVOKE UPDATE ON public.profiles FROM authenticated;
GRANT UPDATE (full_name) ON public.profiles TO authenticated;

-- 2. Defense-in-depth trigger -------------------------------------------------

CREATE OR REPLACE FUNCTION public.prevent_self_admin_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Service role (migrations, admin tooling, RPCs run as service_role) is
  -- exempt so legitimate admin-management workflows keep working.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.is_admin IS DISTINCT FROM OLD.is_admin THEN
    -- An existing admin managing another profile's admin flag is fine;
    -- anyone else attempting to change is_admin (including on their own
    -- row) has the change silently reverted rather than erroring, so this
    -- can't be probed as an oracle.
    IF NOT public.is_admin_user() THEN
      NEW.is_admin := OLD.is_admin;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_admin_escalation ON public.profiles;
CREATE TRIGGER trg_prevent_self_admin_escalation
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_self_admin_escalation();

-- 3. Restrict bootstrap_first_admin() ----------------------------------------

REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM authenticated;
REVOKE ALL ON FUNCTION public.bootstrap_first_admin() FROM anon;
-- Left callable by service_role only (default for SECURITY DEFINER owner /
-- postgres role via the SQL editor), for one-off manual seeding of a fresh
-- environment's first admin. Not reachable from the client API.
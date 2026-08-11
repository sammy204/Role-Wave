
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
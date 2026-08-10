/* Return the complete Auth user directory to admins, including users whose
   profile trigger did not create a public.profiles row. */

CREATE OR REPLACE FUNCTION public.admin_list_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  is_admin boolean,
  account_type text,
  onboarding_completed boolean,
  account_status text,
  created_at timestamptz,
  company_name text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
  SELECT
    u.id,
    u.email::text,
    p.full_name,
    COALESCE(p.is_admin, false),
    p.account_type,
    COALESCE(p.onboarding_completed, false),
    p.account_status,
    u.created_at,
    c.name
  FROM auth.users AS u
  LEFT JOIN public.profiles AS p ON p.id = u.id
  LEFT JOIN public.companies AS c ON c.owner_profile_id = u.id
  WHERE public.is_admin_user()
  ORDER BY u.created_at DESC;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users() TO authenticated;

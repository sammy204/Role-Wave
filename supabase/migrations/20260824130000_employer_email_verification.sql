/* Automatically flag employer companies created with common free email domains.
   Admins retain full control over the existing companies.verified field. */

create or replace function public.enforce_company_verification_from_email()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  owner_email text;
  email_domain text;
begin
  if exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_admin = true
  ) then
    return new;
  end if;

  /* An employer can edit company details, but cannot change its review status. */
  if tg_op = 'UPDATE' then
    new.verified := old.verified;
    return new;
  end if;

  select u.email into owner_email
  from auth.users u
  where u.id = new.owner_profile_id;

  email_domain := lower(split_part(coalesce(owner_email, ''), '@', 2));
  new.verified := email_domain <> '' and email_domain not in (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
    'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com',
    'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com',
    'zoho.com', 'yandex.com'
  );

  return new;
end;
$$;

drop trigger if exists companies_enforce_email_verification on public.companies;
create trigger companies_enforce_email_verification
before insert or update on public.companies
for each row execute function public.enforce_company_verification_from_email();

/* Bring existing employer-owned companies into the same initial state. */
update public.companies c
set verified = (
  lower(split_part(coalesce(u.email, ''), '@', 2)) <> ''
  and lower(split_part(coalesce(u.email, ''), '@', 2)) not in (
    'gmail.com', 'googlemail.com', 'yahoo.com', 'yahoo.co.uk',
    'outlook.com', 'hotmail.com', 'live.com', 'icloud.com', 'me.com',
    'aol.com', 'protonmail.com', 'proton.me', 'mail.com', 'gmx.com',
    'zoho.com', 'yandex.com'
  )
)
from auth.users u
where u.id = c.owner_profile_id;

notify pgrst, 'reload schema';

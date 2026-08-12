alter table public.profiles
  add column if not exists email_marketing_communications boolean not null default false,
  add column if not exists email_pause_optional boolean not null default false;

grant update (email_marketing_communications, email_pause_optional) on public.profiles to authenticated;

notify pgrst, 'reload schema';

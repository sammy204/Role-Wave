-- Let founders clear revoked admin invites from the dashboard without
-- allowing deletion of live pending invites.

create or replace function public.delete_revoked_admin_invite(p_invite_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  if not public.is_founder_user() then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  delete from public.admin_invites
  where id = p_invite_id
    and accepted_at is null
    and revoked_at is not null;
end;
$$;

grant execute on function public.delete_revoked_admin_invite(bigint) to authenticated;

-- Candidate offer updates are guarded by a response trigger. Remove
-- resolved offers with a guarded delete instead of updating their row.
create or replace function public.candidate_remove_offer(p_offer_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $function$
begin
  delete from public.offers
    where id = p_offer_id
      and candidate_profile_id = auth.uid()
      and status <> 'sent'
      and candidate_deleted_at is null;

  if not found then
    raise exception 'Offer cannot be removed while it is awaiting a response.' using errcode = '42501';
  end if;
end;
$function$;

revoke all on function public.candidate_remove_offer(uuid) from public;
grant execute on function public.candidate_remove_offer(uuid) to authenticated;

-- Allow each signed-in user to clear only their own notification history.
create or replace function public.clear_all_notifications()
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  delete from public.notifications
  where user_id = auth.uid();
end;
$function$;

revoke all on function public.clear_all_notifications() from public;
grant execute on function public.clear_all_notifications() to authenticated;

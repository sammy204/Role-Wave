-- Extends sync_application_status_from_offer() to cover all offer status
-- transitions, not just draft/... -> 'sent'.
--
-- Previously only offers.status -> 'sent' synced job_applications.status
-- to 'offer'. accepted / declined / withdrawn left job_applications stuck
-- at 'offer' indefinitely, since enforce_offer_update() forbids setting
-- offers.status back to anything but sent/withdrawn/accepted/declined and
-- nothing wrote the corresponding job_applications row.
--
-- New mapping (per product decision):
--   offers.status -> 'sent'                => job_applications.status = 'offer'
--   offers.status -> 'accepted'             => job_applications.status = 'hired'
--   offers.status -> 'declined'/'withdrawn' => job_applications.status = 'rejected'
--
-- rolewave.offer_sync continues to be the escape hatch that lets this
-- trigger (and only this trigger) move job_applications.status through
-- block_direct_offer_status(), which otherwise forbids setting status
-- to 'offer' directly. 'hired' and 'rejected' aren't guarded by that
-- trigger, but we still route through the same flag for consistency and
-- so any future guards on those columns don't need special-casing this
-- trigger's writes.

create or replace function public.sync_application_status_from_offer()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_next_status text;
begin
  if NEW.status is distinct from OLD.status then
    v_next_status := case NEW.status
      when 'sent' then 'offer'
      when 'accepted' then 'hired'
      when 'declined' then 'rejected'
      when 'withdrawn' then 'rejected'
      else null
    end;

    if v_next_status is not null then
      perform set_config('rolewave.offer_sync', '1', true);
      update public.job_applications
        set status = v_next_status, updated_at = now()
        where id = NEW.application_id;
      perform set_config('rolewave.offer_sync', '0', true);
    end if;
  end if;

  return NEW;
end;
$function$;
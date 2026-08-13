-- Let candidates remove resolved offers from their own workspace without
-- deleting the employer's offer history or changing the offer state.
alter table public.offers
  add column if not exists candidate_deleted_at timestamptz;

create index if not exists offers_candidate_visible_idx
  on public.offers (candidate_profile_id, created_at desc)
  where candidate_deleted_at is null;

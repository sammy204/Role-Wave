-- Separate document offers from quick structured offers.

alter table public.offers
  add column if not exists employer_message text;

create table if not exists public.offer_documents (
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.offers(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  file_size integer not null check (file_size > 0),
  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists offer_documents_offer_idx
  on public.offer_documents (offer_id, sort_order, created_at);

alter table public.offer_documents enable row level security;

drop policy if exists offer_documents_select on public.offer_documents;
create policy offer_documents_select on public.offer_documents
for select to authenticated
using (
  exists (
    select 1
    from public.offers o
    where o.id = offer_documents.offer_id
      and (
        o.employer_profile_id = auth.uid()
        or (
          o.candidate_profile_id = auth.uid()
          and o.candidate_deleted_at is null
          and o.status <> 'draft'
          and o.status <> 'expired'
        )
      )
  )
);

drop policy if exists offer_documents_employer_insert on public.offer_documents;
create policy offer_documents_employer_insert on public.offer_documents
for insert to authenticated
with check (
  exists (
    select 1
    from public.offers o
    where o.id = offer_documents.offer_id
      and o.employer_profile_id = auth.uid()
      and o.status = 'draft'
  )
);

drop policy if exists offer_documents_employer_delete on public.offer_documents;
create policy offer_documents_employer_delete on public.offer_documents
for delete to authenticated
using (
  exists (
    select 1
    from public.offers o
    where o.id = offer_documents.offer_id
      and o.employer_profile_id = auth.uid()
      and o.status = 'draft'
  )
);

update storage.buckets
set file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array[
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ]::text[]
where id = 'offer-documents';

drop policy if exists offer_documents_authorized_read on storage.objects;
create policy offer_documents_authorized_read on storage.objects
for select to authenticated
using (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offer_documents d
    join public.offers o on o.id = d.offer_id
    where d.storage_path = storage.objects.name
      and (
        o.employer_profile_id = auth.uid()
        or (
          o.candidate_profile_id = auth.uid()
          and o.candidate_deleted_at is null
          and o.status <> 'draft'
          and o.status <> 'expired'
        )
      )
  )
);

drop policy if exists offer_documents_employer_insert on storage.objects;
create policy offer_documents_employer_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offers o
    where o.id::text = (storage.foldername(name))[1]
      and o.employer_profile_id = auth.uid()
      and o.status = 'draft'
  )
);

drop policy if exists offer_documents_employer_delete on storage.objects;
create policy offer_documents_employer_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offers o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and o.employer_profile_id = auth.uid()
      and o.status = 'draft'
  )
);

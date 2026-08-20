-- Offer documents: private employer-uploaded offer letters.
--
-- Quick offers remain supported. These fields are optional so existing offers
-- do not need a document attached.

alter table public.offers
  add column if not exists letter_pdf_path text,
  add column if not exists letter_file_name text,
  add column if not exists letter_file_size integer,
  add column if not exists letter_mime_type text,
  add column if not exists letter_uploaded_at timestamptz,
  add column if not exists expires_at timestamptz;

create index if not exists offers_expiry_idx
  on public.offers (status, expires_at)
  where status = 'sent' and expires_at is not null;

-- Offer letters are private. The application creates signed URLs only for
-- authorized participants; service_role can read them for email delivery.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'offer-documents',
  'offer-documents',
  false,
  10 * 1024 * 1024,
  array['application/pdf']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = 10 * 1024 * 1024,
    allowed_mime_types = array['application/pdf']::text[];

drop policy if exists offer_documents_authorized_read on storage.objects;
create policy offer_documents_authorized_read on storage.objects
for select to authenticated
using (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offers o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
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

drop policy if exists offer_documents_employer_update on storage.objects;
create policy offer_documents_employer_update on storage.objects
for update to authenticated
using (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offers o
    where o.id::text = (storage.foldername(storage.objects.name))[1]
      and o.employer_profile_id = auth.uid()
      and o.status = 'draft'
  )
)
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

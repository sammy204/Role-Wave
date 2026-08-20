-- Allow candidates to return signed offer documents without replacing the
-- employer's original documents.

alter table public.offer_documents
  add column if not exists document_type text not null default 'employer_offer',
  add column if not exists uploaded_by uuid references public.profiles(id) on delete set null,
  add column if not exists document_message text;

alter table public.offers
  add column if not exists candidate_signed_at timestamptz;

update public.offer_documents d
set uploaded_by = o.employer_profile_id
from public.offers o
where o.id = d.offer_id
  and d.uploaded_by is null;

create index if not exists offer_documents_type_idx
  on public.offer_documents (offer_id, document_type, created_at);

alter table public.offer_documents
  drop constraint if exists offer_documents_document_type_check;

alter table public.offer_documents
  add constraint offer_documents_document_type_check
  check (document_type in ('employer_offer', 'candidate_signed'));

drop policy if exists offer_documents_employer_insert on public.offer_documents;
create policy offer_documents_participant_insert on public.offer_documents
for insert to authenticated
with check (
  exists (
    select 1
    from public.offers o
    where o.id = offer_documents.offer_id
      and (
        (o.employer_profile_id = auth.uid() and o.status = 'draft' and offer_documents.document_type = 'employer_offer')
        or (o.candidate_profile_id = auth.uid() and o.status = 'sent' and offer_documents.document_type = 'candidate_signed')
      )
  )
  and uploaded_by = auth.uid()
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

drop policy if exists offer_documents_employer_insert on storage.objects;
create policy offer_documents_participant_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'offer-documents'
  and exists (
    select 1
    from public.offers o
    where o.id::text = (storage.foldername(name))[1]
      and (
        (o.employer_profile_id = auth.uid() and o.status = 'draft')
        or (o.candidate_profile_id = auth.uid() and o.status = 'sent')
      )
  )
);

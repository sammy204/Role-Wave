-- Private attachments for candidate/employer conversations.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'message-attachments',
  'message-attachments',
  false,
  10485760,
  array[
    'image/jpeg', 'image/png', 'image/gif', 'image/webp',
    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/webm', 'audio/mp4', 'audio/x-m4a',
    'video/mp4', 'video/webm',
    'application/pdf', 'text/plain',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip'
  ]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check
  check (char_length(body) <= 5000);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  storage_path text not null unique,
  file_name text not null,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  created_at timestamptz not null default now()
);

alter table public.message_attachments enable row level security;

drop policy if exists message_attachments_participant_select on public.message_attachments;
create policy message_attachments_participant_select on public.message_attachments
for select using (
  exists (
    select 1 from public.conversations conv
    where conv.id = message_attachments.conversation_id
      and (
        conv.candidate_profile_id = auth.uid()
        or exists (
          select 1 from public.companies c
          where c.id = conv.company_id and c.owner_profile_id = auth.uid()
        )
      )
  )
);

drop policy if exists message_attachments_participant_insert on public.message_attachments;
create policy message_attachments_participant_insert on public.message_attachments
for insert with check (
  exists (
    select 1
    from public.messages m
    join public.conversations conv on conv.id = m.conversation_id
    where m.id = message_attachments.message_id
      and m.conversation_id = message_attachments.conversation_id
      and m.sender_profile_id = auth.uid()
      and (
        conv.candidate_profile_id = auth.uid()
        or exists (
          select 1 from public.companies c
          where c.id = conv.company_id and c.owner_profile_id = auth.uid()
        )
      )
  )
);

drop policy if exists message_attachments_admin_select on public.message_attachments;
create policy message_attachments_admin_select on public.message_attachments
for select using (is_admin_user());

drop policy if exists message_attachments_authorized_read on storage.objects;
create policy message_attachments_authorized_read on storage.objects
for select to authenticated using (
  bucket_id = 'message-attachments'
  and exists (
    select 1 from public.conversations conv
    where conv.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and (
        conv.candidate_profile_id = auth.uid()
        or exists (
          select 1 from public.companies c
          where c.id = conv.company_id and c.owner_profile_id = auth.uid()
        )
      )
  )
);

drop policy if exists message_attachments_participant_insert on storage.objects;
create policy message_attachments_participant_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'message-attachments'
  and (storage.foldername(storage.objects.name))[2] = auth.uid()::text
  and exists (
    select 1 from public.conversations conv
    where conv.id = ((storage.foldername(storage.objects.name))[1])::uuid
      and (
        conv.candidate_profile_id = auth.uid()
        or exists (
          select 1 from public.companies c
          where c.id = conv.company_id and c.owner_profile_id = auth.uid()
        )
      )
  )
);

notify pgrst, 'reload schema';

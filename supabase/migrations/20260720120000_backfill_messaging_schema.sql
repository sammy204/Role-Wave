
create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  candidate_profile_id uuid not null references public.candidate_profiles(id) on delete cascade,
  source_job_id uuid references public.jobs(id) on delete set null,
  employer_last_read_at timestamptz,
  candidate_last_read_at timestamptz,
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint conversations_company_id_candidate_profile_id_key unique (company_id, candidate_profile_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_profile_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_check check (char_length(trim(body)) > 0 and char_length(body) <= 5000)
);

alter table public.conversations enable row level security;
alter table public.messages enable row level security;

-- ============================================================
-- RLS policies
-- ============================================================

drop policy if exists conversations_employer_insert on public.conversations;
create policy conversations_employer_insert on public.conversations
  for insert
  with check (
    exists (
      select 1 from public.companies c
      where c.id = conversations.company_id and c.owner_profile_id = auth.uid()
    )
  );

drop policy if exists conversations_participant_select on public.conversations;
create policy conversations_participant_select on public.conversations
  for select
  using (
    candidate_profile_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = conversations.company_id and c.owner_profile_id = auth.uid()
    )
  );

drop policy if exists conversations_participant_update on public.conversations;
create policy conversations_participant_update on public.conversations
  for update
  using (
    candidate_profile_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = conversations.company_id and c.owner_profile_id = auth.uid()
    )
  )
  with check (
    candidate_profile_id = auth.uid()
    or exists (
      select 1 from public.companies c
      where c.id = conversations.company_id and c.owner_profile_id = auth.uid()
    )
  );

drop policy if exists conversations_admin_select on public.conversations;
create policy conversations_admin_select on public.conversations
  for select
  using (is_admin_user());

drop policy if exists messages_participant_insert on public.messages;
create policy messages_participant_insert on public.messages
  for insert
  with check (
    sender_profile_id = auth.uid()
    and exists (
      select 1 from public.conversations conv
      where conv.id = messages.conversation_id
        and (
          conv.candidate_profile_id = auth.uid()
          or exists (
            select 1 from public.companies c
            where c.id = conv.company_id and c.owner_profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists messages_participant_select on public.messages;
create policy messages_participant_select on public.messages
  for select
  using (
    exists (
      select 1 from public.conversations conv
      where conv.id = messages.conversation_id
        and (
          conv.candidate_profile_id = auth.uid()
          or exists (
            select 1 from public.companies c
            where c.id = conv.company_id and c.owner_profile_id = auth.uid()
          )
        )
    )
  );

drop policy if exists messages_admin_select on public.messages;
create policy messages_admin_select on public.messages
  for select
  using (is_admin_user());

-- ============================================================
-- RPCs
-- ============================================================

create or replace function public.start_conversation(p_candidate_profile_id uuid, p_job_id uuid default null)
returns public.conversations
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_company_id uuid;
  v_conversation public.conversations;
begin
  select c.id into v_company_id
  from public.companies c
  where c.owner_profile_id = auth.uid()
  limit 1;

  if v_company_id is null then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  if p_job_id is not null then
    if not exists (
      select 1 from public.jobs j
      where j.id = p_job_id and j.company_id = v_company_id
    ) then
      raise exception 'Job does not belong to your company' using errcode = '42501';
    end if;
  end if;

  insert into public.conversations (company_id, candidate_profile_id, source_job_id)
  values (v_company_id, p_candidate_profile_id, p_job_id)
  on conflict (company_id, candidate_profile_id) do update
    set source_job_id = coalesce(public.conversations.source_job_id, excluded.source_job_id)
  returning * into v_conversation;

  return v_conversation;
end;
$function$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_conversation public.conversations;
begin
  select * into v_conversation
  from public.conversations
  where id = p_conversation_id;

  if not found then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  if v_conversation.candidate_profile_id = auth.uid() then
    update public.conversations set candidate_last_read_at = now() where id = p_conversation_id;
  elsif exists (
    select 1 from public.companies c
    where c.id = v_conversation.company_id and c.owner_profile_id = auth.uid()
  ) then
    update public.conversations set employer_last_read_at = now() where id = p_conversation_id;
  else
    raise exception 'Not authorized' using errcode = '42501';
  end if;
end;
$function$;

create or replace function public.touch_conversation_on_message()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  update public.conversations
  set last_message_at = new.created_at
  where id = new.conversation_id;
  return new;
end;
$function$;

drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.touch_conversation_on_message();

-- ============================================================
-- Realtime publication enrollment (idempotent)
-- ============================================================

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations'
  ) then
    alter publication supabase_realtime add table public.conversations;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;

notify pgrst, 'reload schema';
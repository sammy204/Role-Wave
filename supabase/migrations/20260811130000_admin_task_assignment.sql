-- Lightweight task assignment for the admin team.

create table if not exists public.admin_tasks (
  id bigint generated always as identity primary key,
  title text not null,
  description text,
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  priority text not null default 'medium' check (priority in ('low', 'medium', 'high')),
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  due_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists admin_tasks_assigned_to_idx
  on public.admin_tasks (assigned_to, status, due_at);
create index if not exists admin_tasks_created_at_idx
  on public.admin_tasks (created_at desc);

alter table public.admin_tasks enable row level security;
revoke all on public.admin_tasks from public, authenticated;

create or replace function public.admin_list_tasks()
returns table (
  id bigint,
  title text,
  description text,
  assigned_to uuid,
  assignee_first_name text,
  assignee_email text,
  created_by uuid,
  priority text,
  status text,
  due_at date,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
security definer
set search_path to 'public', 'auth'
as $$
  select
    t.id,
    t.title,
    t.description,
    t.assigned_to,
    ap.first_name,
    u.email::text,
    t.created_by,
    t.priority,
    t.status,
    t.due_at,
    t.created_at,
    t.updated_at
  from public.admin_tasks t
  left join public.admin_profiles ap on ap.id = t.assigned_to
  left join auth.users u on u.id = t.assigned_to
  where public.is_admin_user()
    and (public.is_founder_user() or t.assigned_to = auth.uid())
  order by
    case t.status when 'todo' then 1 when 'in_progress' then 2 else 3 end,
    t.due_at nulls last,
    t.created_at desc;
$$;

create or replace function public.admin_create_task(
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_priority text default 'medium',
  p_due_at date default null
)
returns public.admin_tasks
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_task public.admin_tasks;
  v_title text := trim(p_title);
  v_priority text := lower(trim(coalesce(p_priority, 'medium')));
begin
  if not public.is_founder_user() then
    raise exception 'Only founders can create admin tasks' using errcode = '42501';
  end if;

  if v_title = '' then
    raise exception 'Task title is required' using errcode = '22023';
  end if;

  if v_priority not in ('low', 'medium', 'high') then
    raise exception 'Invalid task priority' using errcode = '22023';
  end if;

  if p_assigned_to is not null and not exists (
    select 1 from public.profiles where id = p_assigned_to and is_admin = true
  ) then
    raise exception 'Tasks can only be assigned to current admins' using errcode = '22023';
  end if;

  insert into public.admin_tasks (title, description, assigned_to, created_by, priority, due_at)
  values (v_title, nullif(trim(coalesce(p_description, '')), ''), p_assigned_to, auth.uid(), v_priority, p_due_at)
  returning * into v_task;

  perform public.record_admin_activity(
    'task.created', 'admin_task', v_task.id::text,
    format('Created task "%s".', v_task.title),
    jsonb_build_object('assigned_to', v_task.assigned_to, 'priority', v_task.priority, 'due_at', v_task.due_at)
  );

  return v_task;
end;
$$;

create or replace function public.admin_update_task(
  p_task_id bigint,
  p_title text,
  p_description text default null,
  p_assigned_to uuid default null,
  p_priority text default 'medium',
  p_due_at date default null,
  p_status text default 'todo'
)
returns public.admin_tasks
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_task public.admin_tasks;
  v_title text := trim(p_title);
  v_priority text := lower(trim(coalesce(p_priority, 'medium')));
  v_status text := lower(trim(coalesce(p_status, 'todo')));
begin
  if not public.is_founder_user() then
    raise exception 'Only founders can manage admin tasks' using errcode = '42501';
  end if;
  if v_title = '' then raise exception 'Task title is required' using errcode = '22023'; end if;
  if v_priority not in ('low', 'medium', 'high') then raise exception 'Invalid task priority' using errcode = '22023'; end if;
  if v_status not in ('todo', 'in_progress', 'done') then raise exception 'Invalid task status' using errcode = '22023'; end if;
  if p_assigned_to is not null and not exists (
    select 1 from public.profiles where id = p_assigned_to and is_admin = true
  ) then
    raise exception 'Tasks can only be assigned to current admins' using errcode = '22023';
  end if;

  update public.admin_tasks
  set title = v_title,
      description = nullif(trim(coalesce(p_description, '')), ''),
      assigned_to = p_assigned_to,
      priority = v_priority,
      due_at = p_due_at,
      status = v_status,
      updated_at = now()
  where id = p_task_id
  returning * into v_task;

  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;

  perform public.record_admin_activity(
    'task.updated', 'admin_task', v_task.id::text,
    format('Updated task "%s".', v_task.title),
    jsonb_build_object('assigned_to', v_task.assigned_to, 'priority', v_task.priority, 'status', v_task.status, 'due_at', v_task.due_at)
  );
  return v_task;
end;
$$;

create or replace function public.admin_update_task_status(p_task_id bigint, p_status text)
returns public.admin_tasks
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_task public.admin_tasks;
  v_status text := lower(trim(p_status));
begin
  if not public.is_admin_user() then raise exception 'Not authorized' using errcode = '42501'; end if;
  if v_status not in ('todo', 'in_progress', 'done') then raise exception 'Invalid task status' using errcode = '22023'; end if;

  update public.admin_tasks
  set status = v_status, updated_at = now()
  where id = p_task_id
    and (public.is_founder_user() or assigned_to = auth.uid())
  returning * into v_task;

  if not found then raise exception 'Task not found or not assigned to you' using errcode = '42501'; end if;

  perform public.record_admin_activity(
    'task.status_changed', 'admin_task', v_task.id::text,
    format('Changed task "%s" to %s.', v_task.title, v_task.status),
    jsonb_build_object('status', v_task.status)
  );
  return v_task;
end;
$$;

create or replace function public.admin_delete_task(p_task_id bigint)
returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_task public.admin_tasks;
begin
  if not public.is_founder_user() then raise exception 'Only founders can delete admin tasks' using errcode = '42501'; end if;
  select * into v_task from public.admin_tasks where id = p_task_id;
  if not found then raise exception 'Task not found' using errcode = 'P0002'; end if;

  delete from public.admin_tasks where id = p_task_id;

  perform public.record_admin_activity(
    'task.deleted', 'admin_task', p_task_id::text,
    format('Deleted task "%s".', v_task.title), '{}'::jsonb
  );
end;
$$;

revoke all on function public.admin_list_tasks() from public;
revoke all on function public.admin_create_task(text, text, uuid, text, date) from public;
revoke all on function public.admin_update_task(bigint, text, text, uuid, text, date, text) from public;
revoke all on function public.admin_update_task_status(bigint, text) from public;
revoke all on function public.admin_delete_task(bigint) from public;
grant execute on function public.admin_list_tasks() to authenticated;
grant execute on function public.admin_create_task(text, text, uuid, text, date) to authenticated;
grant execute on function public.admin_update_task(bigint, text, text, uuid, text, date, text) to authenticated;
grant execute on function public.admin_update_task_status(bigint, text) to authenticated;
grant execute on function public.admin_delete_task(bigint) to authenticated;

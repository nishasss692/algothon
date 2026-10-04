create extension if not exists pgcrypto;

-- TABLES
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null,
  color text not null default '#6366f1'
);

create table projects (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  join_code text not null default substr(md5(random()::text), 1, 6),
  created_by uuid default auth.uid() references profiles(id),
  created_at timestamptz not null default now()
);

create table project_members (
  project_id uuid references projects on delete cascade,
  user_id uuid references profiles on delete cascade,
  primary key (project_id, user_id)
);

create type task_status as enum ('todo', 'in_progress', 'review', 'done');

create table tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects on delete cascade,
  title text not null,
  description text not null default '',
  status task_status not null default 'todo',
  assignee_id uuid references profiles(id),
  due_date date,
  position double precision not null default 0,
  version int not null default 1,
  archived boolean not null default false,
  created_by uuid default auth.uid() references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on tasks (project_id, status, position);

create table comments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  project_id uuid not null references projects on delete cascade,
  author_id uuid not null default auth.uid() references profiles(id),
  body text not null,
  created_at timestamptz not null default now()
);

create table attachments (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references tasks on delete cascade,
  project_id uuid not null references projects on delete cascade,
  uploader_id uuid not null default auth.uid() references profiles(id),
  path text not null,
  file_name text not null,
  size bigint not null,
  created_at timestamptz not null default now()
);

create table activity (
  id bigint generated always as identity primary key,
  project_id uuid not null references projects on delete cascade,
  task_id uuid references tasks on delete cascade,
  actor_id uuid references profiles(id),
  type text not null,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);
create index on activity (project_id, id);

-- TRIGGERS
create function handle_new_user() returns trigger
language plpgsql security definer as $$
begin
  insert into profiles (id, name)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
for each row execute function handle_new_user();

create function add_creator_as_member() returns trigger
language plpgsql security definer as $$
begin
  insert into project_members (project_id, user_id) values (new.id, new.created_by);
  return new;
end $$;
create trigger on_project_created after insert on projects
for each row execute function add_creator_as_member();

-- version only bumps when meaningful fields change, not on drag reorder
create function tasks_before_update() returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  if (new.title, new.description, new.assignee_id, new.due_date, new.status)
     is distinct from
     (old.title, old.description, old.assignee_id, old.due_date, old.status) then
    new.version := old.version + 1;
  else
    new.version := old.version;
  end if;
  return new;
end $$;
create trigger trg_tasks_before_update before update on tasks
for each row execute function tasks_before_update();

create function tasks_log() returns trigger
language plpgsql security definer as $$
begin
  if tg_op = 'INSERT' then
    insert into activity (project_id, task_id, actor_id, type, payload)
    values (new.project_id, new.id, auth.uid(), 'task_created', jsonb_build_object('title', new.title));
  else
    if new.status is distinct from old.status then
      insert into activity (project_id, task_id, actor_id, type, payload)
      values (new.project_id, new.id, auth.uid(), 'status_changed',
              jsonb_build_object('from', old.status, 'to', new.status));
    end if;
    if new.assignee_id is distinct from old.assignee_id then
      insert into activity (project_id, task_id, actor_id, type, payload)
      values (new.project_id, new.id, auth.uid(), 'assignee_changed',
              jsonb_build_object('to', new.assignee_id));
    end if;
    if new.due_date is distinct from old.due_date then
      insert into activity (project_id, task_id, actor_id, type, payload)
      values (new.project_id, new.id, auth.uid(), 'due_changed',
              jsonb_build_object('from', old.due_date, 'to', new.due_date));
    end if;
  end if;
  return new;
end $$;
create trigger trg_tasks_log after insert or update on tasks
for each row execute function tasks_log();

create function comments_log() returns trigger
language plpgsql security definer as $$
begin
  insert into activity (project_id, task_id, actor_id, type, payload)
  values (new.project_id, new.task_id, new.author_id, 'comment_added',
          jsonb_build_object('body', new.body));
  return new;
end $$;
create trigger trg_comments_log after insert on comments
for each row execute function comments_log();

create function attachments_log() returns trigger
language plpgsql security definer as $$
begin
  insert into activity (project_id, task_id, actor_id, type, payload)
  values (new.project_id, new.task_id, new.uploader_id, 'file_added',
          jsonb_build_object('file_name', new.file_name, 'path', new.path, 'size', new.size));
  return new;
end $$;
create trigger trg_attachments_log after insert on attachments
for each row execute function attachments_log();

-- RLS
create function is_member(pid uuid) returns boolean
language sql security definer stable as $$
  select exists (select 1 from project_members where project_id = pid and user_id = auth.uid())
$$;

alter table profiles enable row level security;
alter table projects enable row level security;
alter table project_members enable row level security;
alter table tasks enable row level security;
alter table comments enable row level security;
alter table attachments enable row level security;
alter table activity enable row level security;

create policy "profiles read" on profiles for select to authenticated using (true);
create policy "profiles self update" on profiles for update to authenticated using (id = auth.uid());

-- the created_by clause is needed because insert...returning runs before the member trigger is visible
create policy "projects read" on projects for select to authenticated
  using (is_member(id) or created_by = auth.uid());
create policy "projects insert" on projects for insert to authenticated
  with check (created_by = auth.uid());

create policy "members read" on project_members for select to authenticated using (is_member(project_id));

create policy "tasks all" on tasks for all to authenticated
  using (is_member(project_id)) with check (is_member(project_id));
create policy "comments all" on comments for all to authenticated
  using (is_member(project_id)) with check (is_member(project_id));
create policy "attachments all" on attachments for all to authenticated
  using (is_member(project_id)) with check (is_member(project_id));
create policy "activity read" on activity for select to authenticated using (is_member(project_id));

create function join_project(code text) returns uuid
language plpgsql security definer as $$
declare pid uuid;
begin
  select id into pid from projects where join_code = code;
  if pid is null then raise exception 'Invalid code'; end if;
  insert into project_members (project_id, user_id) values (pid, auth.uid())
  on conflict do nothing;
  return pid;
end $$;

-- REALTIME + STORAGE
alter publication supabase_realtime add table tasks, comments, activity, attachments;

create policy "attachments bucket" on storage.objects for all to authenticated
  using (bucket_id = 'attachments') with check (bucket_id = 'attachments');

# Antigravity Build Prompt: Collaborative Project Workspace

You are my senior engineer pair for a 12 hour, two person hackathon. We are building a **Collaborative Project Workspace**. Read this whole document before writing any code, then work through the phases in order.

## 1. The problem and what wins

Problem statement: Remote teams use disconnected tools for tasks, comments, files and progress. Build one collaborative workspace.

Required features: projects and tasks, task assignment and status, comments and files, deadlines and progress, a dashboard, real-time updates.

Judges score: **real-time reliability, collaboration UX, data consistency, completeness.**

So the strategy is a small scope built very solidly. Do not add features that are not in this document. A working, reliable core beats a long feature list.

## 2. Stack (do not add anything else without asking me)

- Next.js (App Router, TypeScript, Tailwind) using whatever the current scaffold gives
- Supabase: Postgres, Auth, Realtime, Storage
- `@supabase/supabase-js` used from client components only (no SSR auth, no middleware)
- `zustand` for client state
- `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` for drag and drop
- `date-fns` for dates
- `sonner` for toasts
- Deploy on Vercel

## 3. Code rules (follow these strictly)

1. **Simple and basic.** Write the most boring, readable version that works. No clever abstractions, no generic utilities "for later", no premature optimization.
2. **No clutter.** Keep files small (aim under 150 lines). One component per file. No dead code, no commented out code, no unused imports, no placeholder TODOs.
3. **Comments only where the reason is not obvious** (for example why a version check exists). Never comment what the code plainly says.
4. **TypeScript strict.** Avoid `any`. Define shared types once in `lib/types.ts`.
5. **Handle errors visibly.** Every Supabase call checks `error` and shows a toast on failure. No silent failures.
6. **Every screen has loading, empty and error states.** Judges notice these.
7. **No extra libraries, no UI kits, no chart libraries.** Plain Tailwind and divs.
8. **Secrets:** only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are exposed to the browser. The service role key lives only in a local `.env` used by the seed script and must never be imported by app code. Make sure `.env*` is gitignored.
9. **Logic lives in the database where possible** (triggers, RLS). The client stays thin.
10. Use clear names. Prefer `getProjectTasks` over `fetchData`.

## 4. How you must work

- Work **one phase at a time** in the order of section 8.
- Before each phase, write a short plan (a few bullets) of the files you will create or change.
- After each phase, **stop** and give me: (a) what you built, (b) the exact manual steps to test it, (c) anything I must do by hand (for example run SQL in the Supabase dashboard, set an env var). Then wait for me to say `continue`.
- If something needs my input (credentials, a dashboard setting, a decision), ask clearly instead of guessing.
- Run the app and fix type errors and lint errors before declaring a phase done. Do not hand me broken code.
- If a requirement is ambiguous, pick the simplest interpretation, state your assumption in one line, and move on.
- Keep a short `PROGRESS.md` checklist at the repo root, ticking off phases as they finish.
- Never refactor completed phases unless a bug forces it. Tell me if you do.

## 5. Whole app flow (what the user experiences)

### Screen 1: Login / Signup (`/login`)
- Email and password. A toggle switches between sign in and sign up. Sign up also asks for a display name (saved as `name` in user metadata).
- On success, redirect to `/projects`. If already signed in, `/login` redirects to `/projects`.
- Any page other than `/login` redirects to `/login` if there is no session (client side check in a small `useSession` hook or layout guard).

### Screen 2: Projects (`/projects`)
- Lists projects the user belongs to, as cards (name, member count).
- "New project" (name input) creates a project and the creator becomes a member automatically.
- "Join project" (code input) joins an existing project using its 6 character join code.
- Clicking a card opens `/projects/[id]`.
- Empty state: friendly message with the two actions.

### Screen 3: Project board (`/projects/[id]`)
- Header: project name, **join code with copy button**, **presence avatars** (who is online in this project), **connection badge** (Live / Reconnecting), link to Dashboard.
- Four columns: To do, In progress, Review, Done. Each shows a task count and a quick-add input at the bottom.
- Task cards show title, assignee avatar, due date (red if overdue and not done), and a small dot if another user currently has that task open.
- Drag a card to reorder or move between columns. Changes appear instantly for everyone else.
- Clicking a card opens the task drawer (URL becomes `?task=<id>`, so the link is shareable).
- Realtime: any change by any user appears without refresh. If the connection drops, show "Reconnecting", disable all inputs, and on reconnect refetch so nothing is missed.

### Screen 4: Task drawer (right side panel on the board)
- Editable: title, description, status, assignee (project members), due date.
- Edits save on blur or change. Edits are **version checked**: if someone else changed the task first, show a conflict dialog with "Keep mine" and "Take theirs".
- **Timeline** (the "one place" idea): one chronological feed showing comments, file uploads, status changes, assignee changes and due date changes, each with actor name and relative time.
- Comment box at the bottom. "X is typing..." appears when another user types in the same task.
- File upload (button and drag and drop onto the drawer, max 10 MB). Files appear in the timeline as chips, clicking one downloads it through a signed URL.
- Shows who else is currently viewing this task.

### Screen 5: Dashboard (`/dashboard`)
- Covers all projects the user belongs to.
- Stat cards: Overdue, At risk (due within 2 days and still To do), Open tasks, Overall completion %.
- Workload per member: simple horizontal bars of open task counts.
- Progress per project: percentage bar (done / total).
- Overdue list: clickable rows that open the task on its board.
- Computed in JavaScript from the same task data, so it always matches the board and updates live.

## 6. Database (create `schema.sql` in the repo; I will run it in the Supabase SQL editor)

Write exactly this file.

```sql
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
```

Manual steps I will do in the Supabase dashboard (remind me in Phase 1): create a private Storage bucket named `attachments`, and turn off "Confirm email" under Authentication, Providers, Email.

## 7. Key design rules (these protect reliability and consistency, do not deviate)

**Single source of truth for the timeline.** The `activity` table is filled only by database triggers. The client never inserts activity rows. Comments and files are inserted into `comments` and `attachments`, and the triggers copy them into `activity`. The timeline reads and subscribes to `activity` only.

**One store, idempotent updates.** A single zustand store holds `tasks` (keyed by id), `activity` (sorted by id, deduplicated by id), `profiles`, `online` (presence), `typing`, and `conn` (`connecting | live | reconnecting`). Every way a task can arrive (optimistic update, mutation response, realtime event, refetch) goes through one `upsertTask` that **ignores a row whose `updated_at` is older than the one already stored**. This prevents duplicates and stale echoes.

**Realtime channel per project.** One channel named `project:<id>` handles: `postgres_changes` on `tasks` and `activity` (filtered by `project_id`), presence, and a broadcast event `typing`. In the subscribe callback, when status is `SUBSCRIBED` (first connect and every reconnect): track presence, **refetch tasks, activity and profiles**, then set `conn` to `live`. On `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` or the browser `offline` event, set `conn` to `reconnecting`. Do not build delta sync. A full refetch is simple and correct.

**Soft delete only.** Tasks are archived (`archived = true`), never deleted. A realtime update with `archived = true` removes the task from the store.

**Two kinds of writes:**
- Moves (drag: status and position): last write wins, optimistic, rolled back on error.
- Edits (title, description, assignee, due date, status from the drawer): optimistic and **version checked**:

```ts
const { data, error } = await supabase
  .from('tasks').update(patch)
  .eq('id', task.id).eq('version', task.version)
  .select().maybeSingle();
// error      -> roll back the optimistic change and toast
// data null  -> someone else edited first: fetch the latest row, put it in the store,
//               and open the conflict dialog (Keep mine = retry with latest version, Take theirs = do nothing)
```

**Offline behavior.** When `conn` is not `live`, show a banner, disable inputs and drag, and refuse writes with a toast. Do not queue offline writes.

**Ordering.** Tasks use a float `position`. New position when dropping between neighbors:

```ts
export function between(prev?: number, next?: number) {
  if (prev === undefined && next === undefined) return 1000;
  if (prev === undefined) return next! - 1000;
  if (next === undefined) return prev + 1000;
  return (prev + next) / 2;
}
```
New tasks get `max position in that column + 1000`.

**Dates.** `due_date` is a plain `yyyy-MM-dd` string. Compare strings, never `new Date('yyyy-MM-dd')`, to avoid timezone off by one bugs.

**Presence.** Each user tracks `{ user_id, name, color, task_id }`. When the drawer opens or closes, call `track` again with the new `task_id`. Board cards show a dot when someone else has that task open.

**Typing.** Broadcast `{ task_id, user_id }` at most once every 1.5 seconds while typing in the comment box. Receivers show "X is typing..." and clear it after 3 seconds of silence.

**Files.** Upload path: `<projectId>/<taskId>/<uuid>-<filename>` in the private `attachments` bucket. After upload, insert an `attachments` row. Download through `createSignedUrl(path, 3600)`. Reject files over 10 MB on the client.

**Comments.** Insert into `comments` and do not add anything to the store manually. The trigger creates the activity row and realtime delivers it to everyone including the sender.

## 8. Phases (do them in order, stop after each)

**Phase 0: Scaffold and environment**
- Create the Next.js app, install the dependencies from section 2, set up `.env.local` with the two public keys, gitignore env files, create `lib/supabase.ts`, init git, create `PROGRESS.md`.
- Folder layout:
  - `app/login`, `app/projects`, `app/projects/[id]`, `app/dashboard`
  - `components/board`, `components/task`, `components/dashboard`, `components/ui`
  - `lib` (supabase, store, types, hooks, mutations)
  - `scripts/seed.ts`
- Done when: the app runs locally and I can deploy it to Vercel with an empty home page.

**Phase 1: Database**
- Create `schema.sql` exactly as in section 6. Remind me of the manual dashboard steps and ask me to confirm the schema ran without errors.
- Done when: I confirm the schema ran and tables exist.

**Phase 2: Auth**
- `/login` with sign in and sign up, session hook, route guard, sign out button in a shared header.
- Done when: I can sign up, land on `/projects`, refresh and stay signed in, sign out, and get redirected to `/login`.

**Phase 3: Projects**
- List, create, and join by code. Handle invalid code errors with a toast.
- Done when: two accounts can share one project via the join code.

**Phase 4: Store, realtime hook, connection badge**
- `lib/types.ts`, `lib/store.ts`, `lib/useProjectRealtime.ts` per section 7. Connection badge and offline banner components.
- Add a temporary dev only check (remove it afterwards) proving a task inserted from the SQL editor appears live.
- Done when: realtime works and toggling the browser to offline shows the badge change, and going back online refetches.

**Phase 5: Board and task CRUD**
- Four columns, task cards, quick add per column, empty and loading states, archive action on a card.
- Done when: creating a task in one browser shows up in another without refresh.

**Phase 6: Drag and drop**
- dnd-kit with `PointerSensor` (activation distance 6px so clicks still work), `DragOverlay`, the `between` function, `moveTask` with optimistic update and rollback. Each column must work as a droppable even when empty.
- Done when: reorder and cross column moves sync live across two browsers.

**Phase 7: Task drawer and conflict handling**
- Drawer opened by `?task=<id>`. Editable fields with `editTask` per section 7. Conflict dialog.
- Done when: two browsers editing the same title triggers the dialog on the second save, and both choices behave correctly.

**Phase 8: Comments, files, timeline**
- Timeline component rendering each activity type with human readable lines. Comment box. File upload and download with drag and drop.
- Done when: comments and files from one browser appear in the other's timeline, and status changes appear as timeline rows.

**Phase 9: Presence and typing**
- Header avatars, board card dots, drawer "also viewing", typing indicator.
- Done when: all four behave correctly with two browser profiles.

**Phase 10: Dashboard**
- Compute stats from store data per section 5. Fetch tasks for all the user's projects (RLS handles filtering), subscribe to `tasks` for live updates.
- Done when: numbers change live when a task is completed or reassigned elsewhere.

**Phase 11: Seed script**
- `scripts/seed.ts` using the service role key from a local `.env`. Create 3 demo users (`aarav@demo.com`, `priya@demo.com`, `rohan@demo.com`, password `demo1234`), one project with all three as members, about 15 tasks across all statuses with 3 overdue, 2 due tomorrow and mixed assignees, plus a few comments.
- Done when: running the script gives a demo project that looks alive in both the board and the dashboard.

**Phase 12: Polish and ship**
- Loading skeletons, empty states, error states, responsive layout check, keyboard `Escape` to close the drawer, favicon and page titles.
- Write `README.md`: what it is, the stack, an architecture summary (store, realtime channel, triggers, version checks), setup steps, demo logins.
- Deploy to Vercel with the env vars and verify the production URL.
- Final test pass using this checklist and report results:
  1. Two browsers: drag in one, the other updates.
  2. Both edit the same title: conflict dialog appears.
  3. DevTools offline in one window: banner shows and inputs disable. Back online: data matches.
  4. Refresh mid edit: no duplicate timeline rows.
  5. Upload a file in one window: it shows in the other's timeline.
  6. Same task open in both: presence and typing work.
  7. Completing or reassigning a task changes the dashboard numbers live.

## 9. Common pitfalls (check these before asking me for help)

- Realtime events not arriving: the table is missing from the `supabase_realtime` publication, or RLS blocks that user's select.
- Insert returns nothing or a 403 on projects: check the `projects read` policy includes the `created_by` clause.
- Duplicate cards: always upsert by id, never append blindly.
- Drag fights with click: use the 6px activation distance.
- Date off by one day: compare `yyyy-MM-dd` strings.

## 10. Begin

Confirm you understand by replying with a 5 line summary of the app and the phase order. Then start **Phase 0** and stop when it is done.

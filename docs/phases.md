# Phase Notes

Detailed notes for each phase: what was built, decisions, and test steps.

---

## Phase 0 — Scaffold and Environment ✅

**Files created:**
- `lib/supabase.ts` — Supabase client singleton (client-side only)
- `lib/types.ts` — All shared TypeScript types
- `lib/store.ts` — Zustand store with `upsertTask`, `appendActivity`, `setProfiles`, `setOnline`, `setTyping`, `setConn`, `reset`
- `lib/utils.ts` — `between()` for drag position math
- `lib/hooks/useSession.ts` — Auth state hook
- `lib/mutations.ts` — Stub (Phase 5+)
- `lib/hooks/useProjectRealtime.ts` — Stub (Phase 4)
- `app/page.tsx` — Redirects to `/projects`
- `app/login/page.tsx`, `app/projects/page.tsx`, `app/projects/[id]/page.tsx`, `app/dashboard/page.tsx` — Stubs
- `components/board/`, `components/task/`, `components/dashboard/`, `components/ui/` — Folder structure
- `scripts/seed.ts` — Stub (Phase 11)
- `schema.sql` — Full Supabase schema (run in Phase 1)
- `.env.local` — Placeholder with public Supabase keys
- `PROGRESS.md` — Phase checklist
- `docs/architecture.md`, `docs/design.md`, `docs/agents.md`, `docs/phases.md`

**Decisions:**
- Used `npx -y create-next-app@latest` with `--typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --no-turbopack`
- All additional deps installed: `@supabase/supabase-js zustand @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities date-fns sonner`
- `.env*` already gitignored by Next.js scaffold
- TypeScript: zero errors (`npx tsc --noEmit` passes)

**Manual steps required before Phase 1:**
1. Create Supabase project at supabase.com
2. Fill in `.env.local` with `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. In Supabase dashboard → Authentication → Providers → Email → disable "Confirm email"
4. In Storage → create a **private** bucket named `attachments`
5. Run `schema.sql` in the SQL editor
6. Confirm tables exist and schema ran without errors

---

## Phase 1 — Database Schema

> Status: Pending user confirmation that schema ran

**Files:**
- `schema.sql` (created in Phase 0, run by user in Supabase SQL editor)

**What the schema includes:**
- Tables: `profiles`, `projects`, `project_members`, `tasks`, `comments`, `attachments`, `activity`
- Custom type: `task_status` enum (`todo`, `in_progress`, `review`, `done`)
- Triggers:
  - `on_auth_user_created` → auto-creates profile from auth metadata
  - `on_project_created` → auto-adds creator as project member
  - `trg_tasks_before_update` → bumps `version` and sets `updated_at` on meaningful field changes only
  - `trg_tasks_log` → writes `task_created`, `status_changed`, `assignee_changed`, `due_changed` to `activity`
  - `trg_comments_log` → writes `comment_added` to `activity`
  - `trg_attachments_log` → writes `file_added` to `activity`
- RLS: enabled on all tables, `is_member()` helper function used as guard
- `join_project(code)` RPC for joining via 6-char code
- Realtime: `tasks`, `comments`, `activity`, `attachments` added to publication
- Storage policy for `attachments` bucket

---

## Phase 2 — Auth ✅ (Member B)

> Status: Complete

**Files built:**
- `app/login/page.tsx` — full email/password login + signup form, toggle between modes, display name on signup, client-side validation, random color assigned on signup
- `components/AuthGuard.tsx` — wraps protected pages, redirects to `/login` if no session
- `components/Header.tsx` — nav (Projects, Dashboard), Avatar + name, sign-out button
- `components/LayoutShell.tsx` — conditionally shows Header based on session + pathname
- `components/ui/Avatar.tsx` — colored circle with initial, tooltip
- `components/ui/Skeleton.tsx` — pulsing grey placeholder block
- `components/ui/EmptyState.tsx` — centered empty message + optional action
- `lib/useSession.ts` — `{ session, loading }` hook (replaces old stub)
- `lib/useMe.ts` — fetches current user profile, retries once if trigger hasn't run yet

**Key decisions:**
- `useSession` returns `{ session, loading }` — not just the session. All code must use this shape.
- Color is randomly assigned from 8 presets on signup
- `useMe` retries after 500ms to handle the case where `handle_new_user` trigger hasn't fired yet

**To test:** Sign up with a display name → land on `/projects` → refresh → stay signed in → sign out → redirected to `/login`.

---

## Phase 3 — Projects

> Status: Not started

**Plan:**
- Fetch projects where user is a member (`is_member()` RLS handles filtering)
- Project cards: name + member count
- "New project" form (name input) → `supabase.from('projects').insert(...)`; creator auto-added via trigger
- "Join project" form (6-char code input) → `supabase.rpc('join_project', { code })`; toast on invalid code
- On card click → `router.push('/projects/' + id)`
- Empty state: friendly message with both actions visible

---

## Phase 4 — Store, Realtime Hook, Connection Badge

> Status: Not started

**Plan:**
- Implement `lib/hooks/useProjectRealtime.ts`
- One channel `project:<id>` per board
- On SUBSCRIBED: track presence, refetch all, set conn=live
- On error/timeout/close/offline: set conn=reconnecting
- `components/ui/ConnectionBadge.tsx` — pill in board header
- `components/ui/OfflineBanner.tsx` — full-width banner, disables UI when reconnecting
- Dev-only check: insert a task from SQL editor and confirm it appears live

---

## Phase 5 — Board and Task CRUD

> Status: Not started (Member A)

**Note:** Member B built `components/task/` stubs for the drawer, timeline, comment box, file upload, presence, and typing. These will integrate once Member A wires up the board and store. The stubs use the same store shape so they should drop in cleanly.

---

## Phase 6 — Drag and Drop

> Status: Not started

---

## Phase 7 — Task Drawer and Conflict Handling ✅ (Member B)

> Status: Component built, pending integration with Member A's board

**Files built:**
- `components/task/TaskDrawer.tsx` — right-side drawer, URL sync (`?task=<id>`), Escape to close
- `components/task/TaskFields.tsx` — editable title, description, status select, assignee select, due date input
- `components/task/ConflictDialog.tsx` — modal with "Keep mine" / "Take theirs" actions
- `lib/mutations.ts` — `ConflictError` class + `editTask` stub (Member A replaces with version-checked impl)

---

## Phase 8 — Comments, Files, Timeline ✅ (Member B)

> Status: Components built, pending integration with live data

**Files built:**
- `components/task/Timeline.tsx` — scrollable feed reading `activity` from store filtered by `task_id`
- `components/task/TimelineItem.tsx` — renders each activity type: system events, comments, file chips
- `components/task/CommentBox.tsx` — textarea + submit, broadcasts typing events
- `components/task/AttachButton.tsx` — file picker + drag-drop, calls `lib/files.ts`
- `lib/activityText.ts` — `describeActivity()` for human-readable activity strings
- `lib/files.ts` — `uploadTaskFile()`, `downloadTaskFile()` helpers
- `lib/time.ts` — `timeAgo()`, `formatDue()`, `formatBytes()`
- `lib/labels.ts` — `STATUS_ORDER`, `STATUS_LABELS`

---

## Phase 9 — Presence and Typing ✅ (Member B)

> Status: Components built, pending integration with realtime channel

**Files built:**
- `components/task/ViewersBar.tsx` — "Also viewing" presence display using `online` from store
- `components/task/TypingIndicator.tsx` — "X is typing..." with 3s auto-clear
- `lib/hooks/useProjectRealtime.ts` — stub, re-exported from `lib/useProjectRealtime.ts` (Member A implements)

---

## Phase 10 — Dashboard ✅ (Member B)

> Status: Complete

**Files built:**
- `app/dashboard/page.tsx` — full dashboard with loading/empty/error states, live connection badge
- `components/dashboard/StatCard.tsx` — single metric card (label + big number)
- `components/dashboard/WorkloadBars.tsx` — horizontal bars of open task count per member
- `components/dashboard/ProjectProgress.tsx` — progress bars per project, click to open board
- `components/dashboard/OverdueList.tsx` — tabbed list (Overdue / At Risk), click row to open task
- `lib/dashboardStats.ts` — pure functions: `openTasks`, `overdueTasks`, `atRiskTasks`, `completionPercent`, `workloadByMember`, `progressByProject`
- `lib/useDashboardData.ts` — fetches all projects + tasks + profiles; subscribes to tasks realtime for live updates

**Key decisions:**
- Dashboard has its own simpler realtime channel (`dashboard:<userId>`) watching all tasks — no presence needed
- Stats computed in JavaScript from the same task data, always consistent with board
- Overdue row click navigates to `/projects/<id>?task=<id>` to open the drawer directly

---

## Phase 11 — Seed Script ✅ (Member B)

> Status: Complete

**File:** `scripts/seed.ts`

**What it does:**
1. Creates 3 demo users (`aarav@demo.com`, `priya@demo.com`, `rohan@demo.com`, password `demo1234`) or finds existing ones
2. Signs in each user and sets their profile colors (indigo, rose, emerald)
3. Deletes any existing "Demo: Product Launch" project
4. Creates the project as Aarav; Priya and Rohan join via the join code
5. Inserts 15 tasks across all 4 statuses (3 overdue, 2 due tomorrow)
6. Adds 5 comments across 2 tasks
7. Creates timeline events via real status/assignee/due-date updates
8. Uploads a file (`launch-checklist.txt`) to the attachments bucket

**To run:** Requires `SUPABASE_SERVICE_ROLE_KEY` in `.env` + public keys in `.env.local`. Add script to `package.json`: `"seed": "tsx scripts/seed.ts"`

**To add to package.json:** `npm pkg set scripts.seed="dotenv -e .env -- tsx scripts/seed.ts"` (requires `dotenv-cli` and `tsx`).

---

## Phase 12 — Polish and Ship

> Status: Not started

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

## Phase 2 — Auth

> Status: Not started

**Plan:**
- `/app/login/page.tsx` — full login/signup form (email, password, display name on signup), toggle between modes
- `components/ui/Header.tsx` — shared header with sign-out button
- `components/ui/Avatar.tsx` — colored circle with initials
- Route guard: `useSession` in layouts or page components, redirect to `/login` if null
- On signup: save `name` in `options.data` → triggers `handle_new_user` which writes it to `profiles`
- On success: `router.push('/projects')`

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

> Status: Not started

---

## Phase 6 — Drag and Drop

> Status: Not started

---

## Phase 7 — Task Drawer and Conflict Handling

> Status: Not started

---

## Phase 8 — Comments, Files, Timeline

> Status: Not started

---

## Phase 9 — Presence and Typing

> Status: Not started

---

## Phase 10 — Dashboard

> Status: Not started

---

## Phase 11 — Seed Script

> Status: Not started

---

## Phase 12 — Polish and Ship

> Status: Not started

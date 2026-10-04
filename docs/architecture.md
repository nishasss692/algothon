# Architecture

> Last updated: Phase 2 / Phase 10 (Member B additions)

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | No SSR auth, no middleware |
| Styling | Tailwind CSS + inline styles | Plain utilities, no UI kits |
| Backend | Supabase | Postgres + Auth + Realtime + Storage |
| Client state | Zustand | One store per project session |
| Drag & drop | @dnd-kit/core + sortable + utilities | PointerSensor, 6px activation |
| Dates | date-fns | String comparisons for due_date |
| Toasts | sonner | Error visibility on every Supabase call |

## Folder Layout

```
app/
  login/                  # ✅ Phase 2 — Login/signup form (Member B)
  projects/               # Phase 3 — stub
  projects/[id]/          # Phase 5 — board stub
  dashboard/              # ✅ Phase 10 — full dashboard (Member B)
  dev/                    # Dev-only harness (delete before deploy)
components/
  AuthGuard.tsx           # ✅ Client-side route guard
  Header.tsx              # ✅ Nav + sign out button
  LayoutShell.tsx         # ✅ Wraps all pages, conditionally shows Header
  board/                  # Phase 5-6 (columns, task cards, DnD overlay)
  task/
    AttachButton.tsx      # ✅ File upload trigger
    CommentBox.tsx        # ✅ Comment input with typing broadcast
    ConflictDialog.tsx    # ✅ Conflict resolution modal
    TaskDrawer.tsx        # ✅ Right-side drawer panel
    TaskFields.tsx        # ✅ Editable task fields (title, desc, etc.)
    Timeline.tsx          # ✅ Scrollable activity feed
    TimelineItem.tsx      # ✅ Single activity row
    TypingIndicator.tsx   # ✅ "X is typing..." display
    ViewersBar.tsx        # ✅ "Also viewing" presence bar
  dashboard/
    OverdueList.tsx       # ✅ Tabbed overdue/at-risk task list
    ProjectProgress.tsx   # ✅ Per-project progress bars
    StatCard.tsx          # ✅ Single stat number card
    WorkloadBars.tsx      # ✅ Per-member open task bars
  ui/
    Avatar.tsx            # ✅ Colored circle with initial
    EmptyState.tsx        # ✅ Centered empty message + action
    Skeleton.tsx          # ✅ Pulsing placeholder block
lib/
  supabase.ts             # ✅ Singleton createClient — client components only
  types.ts                # ✅ All shared TypeScript types
  store.ts                # ✅ Zustand store
  utils.ts                # ✅ between() for drag position math
  labels.ts               # ✅ STATUS_ORDER, STATUS_LABELS
  time.ts                 # ✅ timeAgo(), formatDue(), formatBytes()
  activityText.ts         # ✅ describeActivity() — human-readable activity strings
  files.ts                # ✅ uploadTaskFile(), downloadTaskFile()
  fieldValue.ts           # ✅ (check contents)
  mutations.ts            # Stub — real version from Member A (Phase 5+)
  dashboardStats.ts       # ✅ openTasks, overdueTasks, atRiskTasks, completionPercent, workloadByMember, progressByProject
  useDashboardData.ts     # ✅ Data hook for dashboard (fetches + realtime)
  useMe.ts                # ✅ Fetches current user's profile
  useSession.ts           # ✅ { session, loading } — auth state hook
  useProjectMembers.ts    # ✅ Fetches members of a project
  useNow.ts               # ✅ (check contents)
  useDropZone.ts          # ✅ (check contents)
  hooks/
    useSession.ts         # Old stub (unused — all imports use lib/useSession.ts)
    useProjectRealtime.ts # Stub re-exported from lib/useProjectRealtime.ts
scripts/
  seed.ts                 # ✅ Full seed: 3 demo users, 15 tasks, comments, file upload
schema.sql                # Run once in Supabase SQL editor
```

## Data Flow

```
User action
  → optimistic store update (upsertTask)
  → Supabase write
  → Realtime event arrives for all clients
  → upsertTask (idempotent — ignores rows older than what's stored)
```

## Single Store, Idempotent Updates

`useProjectStore` in `lib/store.ts` holds:
- `tasks` — keyed by `id`
- `activity` — sorted by `id`, deduplicated
- `profiles` — keyed by `id`
- `online` — presence array `{ user_id, name, color, task_id }`
- `typing` — `task_id → user name`
- `conn` — `'connecting' | 'live' | 'reconnecting'`

**`upsertTask` rule:** If the incoming row's `updated_at` ≤ the stored row's `updated_at`, the update is ignored. This prevents stale realtime echoes from overwriting fresher optimistic updates.

## Realtime Channel

One channel named `project:<id>` per project board:
- `postgres_changes` on `tasks` filtered by `project_id`
- `postgres_changes` on `activity` filtered by `project_id`
- Presence tracking `{ user_id, name, color, task_id }`
- Broadcast `typing` event (debounced 1.5s, cleared after 3s silence)

On `SUBSCRIBED` (initial connect **and** every reconnect): track presence, refetch tasks + activity + profiles, set `conn = 'live'`.
On `CHANNEL_ERROR | TIMED_OUT | CLOSED` or browser `offline` event: set `conn = 'reconnecting'`.

Dashboard uses a **separate** simpler channel (`dashboard:<userId>`) watching `tasks` only — no presence.

**No delta sync.** A full refetch on reconnect is simpler and correct.

## Database Design Decisions

- **Activity is trigger-only.** The client never inserts into `activity`. Triggers on `tasks`, `comments`, and `attachments` write all activity rows. This is the single source of truth for the timeline.
- **Soft delete only.** Tasks are archived (`archived = true`), never deleted. Realtime updates with `archived = true` are removed from the store.
- **Version-checked edits.** Drawer edits include `.eq('version', task.version)`. If `data` is null (someone else edited first), a conflict dialog appears.
- **Drag = last-write-wins.** Position updates do not check version. The version trigger does not bump on position-only changes.
- **`due_date` is a plain `yyyy-MM-dd` string.** Never use `new Date('yyyy-MM-dd')` — compare strings to avoid timezone off-by-one bugs.

## Offline Behavior

When `conn !== 'live'`:
- Show `OfflineBanner` across the top
- Disable all inputs and drag handles
- Refuse writes with a toast ("You're offline")
- Do not queue writes — refetch on reconnect instead

## File Uploads

- Path: `<projectId>/<taskId>/<uuid>-<filename>` in the private `attachments` bucket
- Reject files > 10 MB on the client before uploading
- After upload, insert into `attachments` table; the trigger writes the `activity` row
- Downloads via `createSignedUrl(path, 3600)`
- Client helper: `lib/files.ts` — `uploadTaskFile()` / `downloadTaskFile()`

## Auth

- Email + password only (no OAuth in scope)
- No SSR auth, no middleware — client-side session check via `useSession` hook
- Route guard: `AuthGuard` component wraps any protected page; redirects to `/login` if session is null
- `LayoutShell` conditionally shows `Header` based on session + pathname
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only keys in browser code
- Service role key lives only in local `.env` used by `scripts/seed.ts`

## useSession API (important — Member B changed the shape)

`lib/useSession.ts` returns `{ session: Session | null, loading: boolean }` (NOT just the session).
All code should use this shape. The old `lib/hooks/useSession.ts` is unused.

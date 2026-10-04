# Architecture

> Last updated: Phase 0

## Stack

| Layer | Choice | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router, TypeScript) | No SSR auth, no middleware |
| Styling | Tailwind CSS | Plain utilities, no UI kits |
| Backend | Supabase | Postgres + Auth + Realtime + Storage |
| Client state | Zustand | One store per project session |
| Drag & drop | @dnd-kit/core + sortable + utilities | PointerSensor, 6px activation |
| Dates | date-fns | String comparisons for due_date |
| Toasts | sonner | Error visibility on every Supabase call |

## Folder Layout

```
app/
  login/              # Phase 2
  projects/           # Phase 3
  projects/[id]/      # Phase 5 (board)
  dashboard/          # Phase 10
components/
  board/              # Phase 5-6 (columns, task cards, DnD overlay)
  task/               # Phase 7-8 (drawer, timeline, comment box, file upload)
  dashboard/          # Phase 10 (stat cards, workload bars)
  ui/                 # Shared: ConnectionBadge, OfflineBanner, Avatar, Spinner
lib/
  supabase.ts         # Singleton createClient — client components only
  types.ts            # All shared TypeScript types (single source of truth)
  store.ts            # Zustand store
  utils.ts            # between() for drag position math
  mutations.ts        # Supabase write helpers (Phase 5+)
  hooks/
    useSession.ts     # Auth state: undefined=loading, null=none, Session=signed-in
    useProjectRealtime.ts  # Phase 4: one channel per project
scripts/
  seed.ts             # Phase 11: uses service role key, never imported by app
schema.sql            # Run once in Supabase SQL editor (Phase 1)
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

## Auth

- Email + password only (no OAuth in scope)
- No SSR auth, no middleware — client-side session check via `useSession` hook
- Route guard: any page other than `/login` redirects to `/login` if session is null
- `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are the only keys in browser code
- Service role key lives only in local `.env` used by `scripts/seed.ts`

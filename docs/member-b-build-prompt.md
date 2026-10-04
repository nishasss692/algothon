# Member B Build Prompt: Task Drawer, Timeline, Files, Dashboard, Seed

**How to use**

1. create a separate branch known as member-b-tasks
2. Work on your own git branch (`member-b-tasks`). Pull `main` before every phase and merge back after every phase.

---

## 1. Judging and strategy (reminder)

Judges score **real-time reliability, collaboration UX, data consistency, completeness.** My half carries most of the collaboration UX and the "one place" story: a single task timeline with comments, files and every change. Build it small and solid, with every loading, empty, error and offline state handled.

## 2. Ownership

### I own (create and edit freely)

```
schema.sql                          canonical database file
scripts/seed.ts                     demo data
app/login/page.tsx                  auth screen
app/dashboard/page.tsx              dashboard screen
components/Header.tsx               top bar with nav and sign out
components/AuthGuard.tsx            redirects to /login when signed out
components/ui/Avatar.tsx            shared by both of us
components/ui/Skeleton.tsx          shared
components/ui/EmptyState.tsx        shared
components/task/*                   everything inside the task drawer
components/dashboard/*              everything on the dashboard
lib/useMe.ts                        current user hook
lib/useSession.ts                   auth session hook
lib/labels.ts                       status labels and order
lib/time.ts                         date and size formatting helpers
lib/useNow.ts                       ticking clock hook
lib/activityText.ts                 turns activity rows into sentences
lib/fieldValue.ts                   formats a field value for display
lib/files.ts                        upload and download helpers
lib/useDropZone.ts                  drag and drop files hook
lib/useProjectMembers.ts            members of a project
lib/dashboardStats.ts               pure stat functions
lib/useDashboardData.ts             dashboard data and realtime
docs/DEMO.md                        demo script and architecture notes
```

### Member A owns (read and import only, never edit)

```
app/projects/**                     project list and board
components/board/**                 board, columns, cards, project header, connection badge
lib/types.ts                        shared types
lib/store.ts                        zustand store
lib/useProjectRealtime.ts           realtime channel hook
lib/mutations.ts                    editTask, moveTask, ConflictError
```

### Shared-file rules

- Before creating any file, check whether it already exists on `main`. If it does, import it, do not recreate it.
- If you need a change in a file I do not own, do **not** edit it. Tell me exactly what change is needed and why, and I will relay it to Member A.
- If Member A's files do not exist yet on my branch, create **temporary stubs at the same paths**, exactly matching the contract in section 3, and tell me you did. When I merge, Member A's real files replace the stubs. Stub files start with the comment `// TEMP STUB: Member A's version replaces this on merge`.

## 3. Contract (the handshake with Member A)

### Types (`lib/types.ts`, owned by A)

```ts
export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export type Task = {
  id: string; project_id: string; title: string; description: string;
  status: TaskStatus; assignee_id: string | null; due_date: string | null; // 'yyyy-MM-dd'
  position: number; version: number; archived: boolean; updated_at: string;
};

export type Profile = { id: string; name: string; color: string };

export type ActivityType =
  | 'task_created' | 'status_changed' | 'assignee_changed'
  | 'due_changed' | 'comment_added' | 'file_added';

export type Activity = {
  id: number; project_id: string; task_id: string | null; actor_id: string | null;
  type: ActivityType; payload: Record<string, any>; created_at: string;
};

export type PresenceUser = { user_id: string; name: string; color: string; task_id: string | null };
```

Activity payload shapes (written by the database triggers, see spec section 6):

| type | payload |
|---|---|
| task_created | `{ title }` |
| status_changed | `{ from, to }` (task_status values) |
| assignee_changed | `{ to }` (profile id or null) |
| due_changed | `{ from, to }` ('yyyy-MM-dd' or null) |
| comment_added | `{ body }` |
| file_added | `{ file_name, path, size }` |

### Store (`lib/store.ts`, owned by A). I only read it.

```ts
useStore(s => s.tasks)      // Record<taskId, Task>
useStore(s => s.activity)   // Activity[] sorted by id ascending, deduplicated
useStore(s => s.profiles)   // Record<profileId, Profile>
useStore(s => s.conn)       // 'connecting' | 'live' | 'reconnecting'
useStore(s => s.online)     // Record<userId, PresenceUser>
useStore(s => s.typing)     // Record<`${taskId}:${userId}`, expiryEpochMs>
```

### Mutations (`lib/mutations.ts`, owned by A)

```ts
export class ConflictError extends Error { latest: Task; mine: Partial<Task> }
export function editTask(
  task: Task,
  patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'assignee_id' | 'due_date'>>
): Promise<void>
```

`editTask` is optimistic and version checked. On a version mismatch it already puts the latest row in the store and throws `ConflictError`. On any other failure it already rolls back and throws the original error. I never touch the store directly.

### Realtime hook (`lib/useProjectRealtime.ts`, owned by A)

```ts
const channelRef = useProjectRealtime(projectId, me)
// channelRef: React.MutableRefObject<RealtimeChannel | undefined>
```

A calls it on the board page. I receive `channelRef` as a prop in the drawer and use it for presence `track` and typing `send`.

### What I provide to A

```tsx
// components/task/TaskDrawer.tsx
type TaskDrawerProps = {
  projectId: string;
  taskId: string;
  me: Profile;                                           // from useMe()
  channelRef: React.MutableRefObject<RealtimeChannel | undefined>;
  onClose: () => void;                                   // A removes ?task= from the URL
};
export default function TaskDrawer(props: TaskDrawerProps): JSX.Element

// lib/useMe.ts
export function useMe(): { me: Profile | null; loading: boolean }

// components/ui/Avatar.tsx
export default function Avatar(props: { name: string; color: string; size?: number }): JSX.Element

// lib/labels.ts
export const STATUS_ORDER: TaskStatus[]
export const STATUS_LABELS: Record<TaskStatus, string>   // 'To do', 'In progress', 'Review', 'Done'

// components/AuthGuard.tsx  (wraps protected pages)
// components/Header.tsx     (rendered once in the root layout when signed in)
// components/ui/Skeleton.tsx, components/ui/EmptyState.tsx
```

## 4. Extra code rules for my half

Everything in spec section 3 applies. Additionally:

- Components are presentational where possible. Data logic goes in `lib/` hooks and helpers.
- Never write to the zustand store from components. Only `editTask` changes tasks. Comments and files go to the database and come back through realtime.
- Never insert into `activity` from the client.
- Every button or input that writes data is disabled when `conn !== 'live'`, with a clear reason in a `title` or placeholder.
- Every async handler has a "busy" guard so double clicks cannot submit twice.
- Use `date-fns` for all date work. `due_date` is a `yyyy-MM-dd` string. Never use `new Date('yyyy-MM-dd')`; use `parse(value, 'yyyy-MM-dd', new Date())`.
- Basic accessibility: real `<button>` elements, `aria-label` on icon-only buttons, labels on inputs, `role="dialog"` and `aria-modal` on modals.
- No new runtime dependencies. One dev dependency is allowed: `tsx` (to run the seed script).

## 5. How you must work

- One phase at a time, in order. Before each phase, list the files you will create or change.
- After each phase, **stop** and give me: (a) what you built, (b) exact manual test steps, (c) anything I must do by hand, (d) any change you need from Member A. Then wait for me to say `continue`.
- Run the app, fix type and lint errors before declaring a phase done.
- Commit after each phase with the message `B: phase N <short name>`.
- Keep a `PROGRESS-B.md` checklist at the repo root.
- If a requirement is ambiguous, choose the simplest interpretation, state it in one line, move on.
- Never refactor finished phases unless a bug forces it. Tell me if you do.

## 6. Phases

---

### Phase 0: Orientation

- Read `docs/shared-spec.md` fully. Pull `main`. Check what already exists (scaffold, `lib/supabase.ts`, A's files).
- Create `PROGRESS-B.md`.
- Reply with a 6 line summary of my half and the phase order.

**Done when:** I confirm your summary is correct.

---

### Phase 1: Database file and auth

**1a. `schema.sql`**
- If `schema.sql` already exists on `main`, do not rewrite it. Otherwise create it exactly from `docs/shared-spec.md` section 6.
- Remind me of the manual dashboard steps: create the private `attachments` bucket, turn off "Confirm email". Ask me to confirm the SQL ran cleanly.

**1b. Auth**
- `lib/useSession.ts`: returns `{ session, loading }`. Reads the initial session with `supabase.auth.getSession()` and subscribes with `supabase.auth.onAuthStateChange`, cleaning up the subscription on unmount.
- `lib/useMe.ts`: uses `useSession`, fetches the user's row from `profiles` (`id, name, color`), returns `{ me, loading }`. `loading` stays true until both session and profile resolve. If there is a session but no profile row yet, retry once after 500 ms (the signup trigger may still be running).
- `components/AuthGuard.tsx`: client component. While loading, show a full screen `Skeleton`. If no session, `router.replace('/login')`. Otherwise render children.
- `app/login/page.tsx`:
  - Two modes (Sign in, Sign up) with a text toggle link.
  - Fields: email, password, and display name (sign up only). Validation: valid email, password at least 6 characters, name required on sign up. Show inline errors under fields.
  - Sign up: `supabase.auth.signUp({ email, password, options: { data: { name } } })`. Afterwards set a profile color: pick one at random from a palette of 8 distinct hex colors defined in the file, then `supabase.from('profiles').update({ color }).eq('id', user.id)`. If the update fails, ignore it, the default color is fine.
  - Sign in: `signInWithPassword`.
  - Button shows a loading state and is disabled while the request runs. Errors show as a toast (use the error message from Supabase).
  - If a session already exists, redirect to `/projects`.
  - On success, `router.replace('/projects')`.
- `components/Header.tsx`: app name on the left linking to `/projects`, links to Projects and Dashboard, current user's `Avatar` plus name, and a Sign out button (`supabase.auth.signOut()` then `router.replace('/login')`). Rendered in the root layout only when a session exists (so not on `/login`).
- Wrap protected pages with `AuthGuard` via the root layout, excluding `/login`. Tell me if A's pages need to be wrapped differently.
- Add a `Toaster` from `sonner` to the root layout if it is not there yet.

**Done when:** I can sign up, land on `/projects`, refresh and stay signed in, sign out and be redirected, and visiting any page signed out redirects to `/login`.

---

### Phase 2: Seed script (do this early so Member A can test with real data)

Create `scripts/seed.ts`. Add dev dependency `tsx` and an npm script:
`"seed": "tsx --env-file=.env --env-file=.env.local scripts/seed.ts"`

Required env: `SUPABASE_SERVICE_ROLE_KEY` in a gitignored `.env`, plus the two public vars from `.env.local`. Stop with a clear message if any is missing.

**Critical design point:** database triggers record `auth.uid()` as the actor in the timeline. If everything is inserted with the service role key, every actor is `null` and the timeline shows "Someone". So:

- Use the **service role client only** to create users and to delete the old demo project.
- Do all other writes through **per-user anon clients that sign in with password** (`createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } })` then `signInWithPassword`). Write a tiny helper `clientFor(user)` returning a signed in client.

**Steps:**

1. Users: `aarav@demo.com` (Aarav), `priya@demo.com` (Priya), `rohan@demo.com` (Rohan), all with password `demo1234`. Create with `admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { name } })`. If the user already exists, reuse it (look it up with `admin.auth.admin.listUsers()`).
2. Set distinct profile colors for the three (as themselves): indigo `#6366f1`, rose `#f43f5e`, emerald `#10b981`.
3. Reset: `admin.from('projects').delete().eq('name', 'Demo: Product Launch')` (cascades to everything). This makes the script safe to re-run.
4. As Aarav: create the project `Demo: Product Launch`. Read back its `join_code`. As Priya and Rohan: `rpc('join_project', { code })`.
5. Tasks (insert as the listed creator, positions in steps of 1000 within each column in the order below, due dates are today plus the offset in days, formatted `yyyy-MM-dd`):

| Title | Status | Assignee | Due offset | Creator |
|---|---|---|---|---|
| Write launch announcement | todo | Priya | +3 | Aarav |
| Set up analytics dashboard | todo | Rohan | +1 | Rohan |
| Draft pricing page copy | todo | Priya | -2 | Priya |
| Prepare support FAQ | todo | none | +2 | Aarav |
| Build onboarding flow | in_progress | Aarav | +2 | Aarav |
| Design email templates | in_progress | Priya | +5 | Priya |
| Fix signup validation bug | in_progress | Rohan | -1 | Rohan |
| Integrate payment webhooks | in_progress | Aarav | -3 | Aarav |
| Landing page QA | review | Rohan | +1 | Rohan |
| Legal review of terms | review | Aarav | +4 | Aarav |
| Accessibility audit | review | Priya | +6 | Priya |
| Set up CI pipeline | done | Aarav | -5 | Aarav |
| Choose brand colors | done | Priya | -6 | Priya |
| Create project repo | done | Rohan | -8 | Rohan |
| Domain and hosting setup | done | Aarav | -4 | Aarav |

   This yields 3 overdue open tasks, 2 at risk tasks (todo and due within 2 days), 2 due tomorrow, and one unassigned task. Keep exactly this shape because the demo and dashboard depend on it.

6. Comments (as the listed author):
   - Integrate payment webhooks: Aarav "Stripe test keys are in the shared vault." then Rohan "Webhook signature check is failing in staging, looking into it."
   - Draft pricing page copy: Priya "Need the final plan names before I can finish this."
   - Build onboarding flow: Aarav "First pass of the stepper is done." then Priya "Can we add a skip option on step 2?"
7. A few timeline events through real updates by different users, so the timeline is not just creations: Rohan moves "Landing page QA" from todo to review (create it as todo first, then update), Aarav reassigns "Prepare support FAQ" to Rohan and then back to nobody, Priya changes the due date of "Design email templates" from +3 to +5.
8. One file: as Rohan, upload a small text file `launch-checklist.txt` (a short string converted to a Buffer, content type `text/plain`) to the `attachments` bucket at `<projectId>/<taskId>/<uuid>-launch-checklist.txt` on the task "Landing page QA", then insert the matching `attachments` row.
9. Print at the end: the three logins, the password, and the project join code.

Keep the script linear and readable, one small function per step, with `console.log` progress lines. No abstractions beyond `clientFor`.

**Done when:** `npm run seed` runs twice in a row without errors, the Supabase table editor shows the project with 15 tasks, and the `activity` table shows rows with real `actor_id` values (not null).

---

### Phase 3: Shared helpers and UI primitives

Create these small, pure, easy to read pieces:

- `lib/labels.ts`: `STATUS_ORDER = ['todo','in_progress','review','done']` and `STATUS_LABELS`.
- `lib/time.ts`:
  - `timeAgo(iso)` using `formatDistanceToNowStrict(new Date(iso), { addSuffix: true })`.
  - `formatDue(dateStr)` returns `'Oct 12'` style using `parse(dateStr, 'yyyy-MM-dd', new Date())` then `format(..., 'MMM d')`.
  - `formatBytes(n)` returns `'12 KB'`, `'1.4 MB'`.
- `lib/useNow.ts`: `useNow(intervalMs)` returns `Date.now()` and re-renders on an interval, cleaning up on unmount.
- `lib/fieldValue.ts`: `formatFieldValue(field, value, profiles)` for conflict display: status -> label, assignee_id -> name or "Unassigned", due_date -> formatted or "No due date", title/description -> the text (empty -> "Empty").
- `lib/activityText.ts`: `describeActivity(activity, profiles)` returns the sentence for **system events only** (comment and file types are rendered differently):
  - task_created: "{actor} created this task"
  - status_changed: "{actor} moved this from {From label} to {To label}"
  - assignee_changed: to null -> "{actor} unassigned this task", else "{actor} assigned this to {name}"
  - due_changed: to null -> "{actor} removed the due date", from null -> "{actor} set the due date to {date}", else "{actor} changed the due date from {a} to {b}"
  - Actor name falls back to "Someone" when `actor_id` is null or the profile is missing.
- `components/ui/Avatar.tsx`: a circle with the first letter of the name, background `color`, white text, `title` attribute with the full name, default size 28.
- `components/ui/Skeleton.tsx`: a pulsing gray block that takes a className.
- `components/ui/EmptyState.tsx`: title, optional description, optional action node, centered.

**Done when:** everything compiles and I can see an `Avatar`, `Skeleton` and `EmptyState` on a temporary page.

---

### Phase 4: Dev harness and Timeline

**Dev harness (temporary, deleted in Phase 10).** Create `app/dev/page.tsx` that, on mount, fills the store with mock data (use `useStore.setState` directly, harness only): one project id, three profiles, five tasks, `conn: 'live'`, and about 12 activity rows covering all six types for one task, including a null `actor_id` row. It renders whichever component I am currently building. If A's store does not exist yet, use the stub from the contract. Mark the whole file `// TEMP DEV HARNESS, delete before deploy`.

**`components/task/Timeline.tsx`** (props: `taskId`)
- Read `activity` and `profiles` from the store. Filter `task_id === taskId` with `useMemo`. Oldest first.
- Empty state: "No activity yet. Start the conversation." 
- Render each item through `TimelineItem` (next bullet), using the activity `id` as the React key.
- **Scrolling:** the list is a scroll container with a ref. Keep a `stickToBottom` ref updated on scroll (true when within 80px of the bottom). On mount, scroll to the bottom. When the item count changes, scroll to the bottom if `stickToBottom` is true **or** the newest item's `actor_id` is the current user. Otherwise leave the scroll position alone.
- Call `useNow(30000)` in the component so relative times refresh.

**`components/task/TimelineItem.tsx`**
- `comment_added`: avatar, actor name, time ago (full date and time in the `title` attribute), and the body in a bubble with `whitespace-pre-wrap` and `break-words`. Render as plain text, never as HTML. The current user's comments get a subtle tint.
- `file_added`: a chip with a paperclip character, file name (truncate with ellipsis, full name in `title`), size via `formatBytes`, and a **Download** button that calls `downloadTaskFile(path, file_name)` from `lib/files.ts` (built in Phase 7; until then render the button disabled).
- All other types: a single centered, small gray line from `describeActivity`, with the time ago after it.

**Done when:** the harness shows every item type correctly, comments with long words and line breaks do not break the layout, and the null actor row reads "Someone".

---

### Phase 5: Task fields, members hook, conflict dialog

**`lib/useProjectMembers.ts`**: given `projectId`, fetch once with `supabase.from('project_members').select('profiles(id, name, color)').eq('project_id', projectId)`, flatten to `Profile[]`, sort by name. Return `{ members, loading }`. Toast on error.

**`components/task/TaskFields.tsx`** (props: `task`, `members`)
- Fields: title (text input), status (select, `STATUS_ORDER` with `STATUS_LABELS`), assignee (select with "Unassigned" first, then members), due date (`<input type="date">` plus a small "Clear" button), description (textarea, 4 rows).
- **Draft state:** each text field keeps a local draft initialised from the task. A `focusedField` ref tracks which field is being edited. When the task in the store changes (realtime update from someone else), update the draft **only for fields that are not focused**, so incoming updates never wipe what the user is typing.
- **Saving:**
  - Title and description save on blur. Status, assignee and due date save immediately on change.
  - Skip the save if the value equals the current task value. Trim the title. An empty title reverts the draft and shows a toast "Title can't be empty".
  - Empty due date string becomes `null`.
  - Every save calls `editTask(task, { field: value })` inside try/catch.
  - `ConflictError` branch: if every key in `error.mine` already equals the same key in `error.latest`, do nothing silently (the store already holds the latest). Otherwise open the `ConflictDialog`.
  - Any other error: toast "Could not save. {message}". The store was already rolled back by `editTask`, and the draft resets to the task value.
- All inputs are disabled when `conn !== 'live'`.
- A tiny "Saving..." text near the title appears while a save is in flight.

**`components/task/ConflictDialog.tsx`** (props: `conflict`, `onKeepMine`, `onTakeTheirs`)
- Modal with a dark backdrop, `role="dialog"`, `aria-modal="true"`.
- Heading: "This task was changed by someone else". Subtext: "Choose which version to keep."
- For each key in `conflict.mine`: a row with the field label, a "Yours" value and a "Latest" value, formatted with `formatFieldValue`.
- Buttons: **Keep mine** (primary) and **Take theirs**. Escape triggers Take theirs and stops propagation so the drawer does not also close.
- Keep mine calls `editTask(conflict.latest, conflict.mine)`. If that throws another `ConflictError`, show the dialog again with the new conflict. Other errors toast.

**Done when (in the harness with a temporary `editTask` stub that you can make throw a `ConflictError` on demand):** edits save on blur, an incoming store update does not overwrite a focused field, the dialog shows the right values, and both buttons behave.

---

### Phase 6: Comments, typing indicator, viewers

**`components/task/CommentBox.tsx`** (props: `taskId`, `projectId`, `channelRef`, `me`)
- Textarea with auto growing height capped at about 6 lines, max length 2000.
- Enter sends. Shift+Enter inserts a newline. **Ignore Enter while IME composition is active** (`e.nativeEvent.isComposing`).
- Send button too. Trim the text. Ignore empty.
- `sending` flag: set while the insert runs, disables the box and button, prevents duplicate sends.
- Insert: `supabase.from('comments').insert({ task_id: taskId, project_id: projectId, body })`. `author_id` defaults to `auth.uid()` in the database.
- On success clear the box. On error toast and **keep the text**.
- **Do not add the comment to the store.** The trigger writes the activity row and realtime delivers it to everyone, including the sender.
- Disabled with placeholder "Reconnecting..." when `conn !== 'live'`.
- Typing broadcast: on change, if more than 1500 ms passed since the last send, call `channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { task_id: taskId, user_id: me.id } })`. Keep the last send time in a ref.

**`components/task/TypingIndicator.tsx`** (props: `taskId`, `meId`)
- Read `typing` and `profiles` from the store. Use `useNow(1000)`.
- Keep entries whose key starts with `${taskId}:`, expiry greater than now, and user id not equal to `meId`.
- Text: one person "Priya is typing...", two "Priya and Rohan are typing...", more "3 people are typing...".
- Always reserve one line of height so the layout never jumps when it appears.

**`components/task/ViewersBar.tsx`** (props: `taskId`, `meId`)
- From `online`, take users with `task_id === taskId` and `user_id !== meId`. Show their avatars and text "Priya is also viewing" (or "2 others are viewing"). Render nothing if nobody else is viewing.

**Done when (harness, with the typing and online maps edited by hand):** the indicator appears and disappears about 3 seconds after the expiry, the viewers bar updates, Enter and Shift+Enter behave correctly, and a failed send keeps the text.

---

### Phase 7: Files

**`lib/files.ts`**
- `MAX_FILE_BYTES = 10 * 1024 * 1024`.
- `uploadTaskFile(file, projectId, taskId)`:
  1. Validate: size greater than 0 and not above the limit, else throw an `Error` with a clear message (`"{name} is larger than 10 MB"`, `"{name} is empty"`).
  2. Build a safe name: replace every character not in `[A-Za-z0-9._-]` with `_`.
  3. Path: `${projectId}/${taskId}/${crypto.randomUUID()}-${safeName}`.
  4. `supabase.storage.from('attachments').upload(path, file)`. Throw on error.
  5. Insert the `attachments` row with the **original** `file.name` as `file_name`, plus `path`, `size`, `task_id`, `project_id`.
  6. If the insert fails, remove the uploaded object from storage (cleanup) and throw.
- `downloadTaskFile(path, fileName)`: `createSignedUrl(path, 3600, { download: fileName })`, then create a temporary `<a>` with that `href`, click it, remove it. (Avoid `window.open` after an await, popup blockers will stop it.) Toast on error.

**`lib/useDropZone.ts`**: `useDropZone(onFiles)` returns `{ isDragging, dropProps }`.
- `dropProps` has `onDragEnter`, `onDragOver`, `onDragLeave`, `onDrop`.
- React only to drags that contain files (`e.dataTransfer.types.includes('Files')`).
- Use a counter for enter and leave so child elements do not cause flicker. `preventDefault` on dragover and drop. On drop, call `onFiles(Array.from(e.dataTransfer.files))`.

**`components/task/AttachButton.tsx`** (props: `projectId`, `taskId`)
- A button "Attach file" that opens a hidden `<input type="file" multiple>`. Selected files and dropped files share one function `handleFiles(files)`.
- `handleFiles` uploads **sequentially**. It keeps an `uploading: string[]` list of file names and shows small "Uploading {name}..." chips while running. Each failure toasts its own message and the loop continues with the next file. Reset the input value afterwards so the same file can be chosen again.
- Disabled when `conn !== 'live'`.
- Export `handleFiles` through a prop callback or a ref so the drawer's drop zone can call it (choose the simplest approach, and tell me which).

**Update `TimelineItem`** so the Download button now calls `downloadTaskFile`.

**Done when (against real data after Phase 10, but test the pieces now with the seed project):** a 12 MB file is rejected with a toast, a normal file uploads and appears in the timeline for both browsers, download saves the file with its original name, and a filename with spaces and unicode characters works.

---

### Phase 8: The TaskDrawer

Assemble everything in `components/task/TaskDrawer.tsx` using the props from the contract.

**Layout (top to bottom):**
1. Header: close button (aria-label "Close task"), `ViewersBar` on the right.
2. `TaskFields`.
3. A "Activity" label and the `Timeline` filling the remaining height (this is the only part that scrolls).
4. Footer: `TypingIndicator`, upload chips (from `AttachButton`), then a row with `AttachButton` and the `CommentBox`.

**Behavior:**
- Reads its task from the store with `useStore(s => s.tasks[taskId])`.
- States: `conn === 'connecting'` and no task yet -> skeleton layout. `conn !== 'connecting'` and still no task -> `EmptyState` "Task not found. It may have been archived." with a Close button.
- When `conn !== 'live'`, show a thin yellow bar at the top of the drawer: "Reconnecting. Editing is paused."
- **Presence:** one effect with dependencies `[taskId, conn]`. When `conn === 'live'`, call `channelRef.current?.track({ user_id: me.id, name: me.name, color: me.color, task_id: taskId })`. The cleanup tracks again with `task_id: null`. Because the dependency includes `conn`, presence is re-announced after a reconnect (A's hook resets it to null on every subscribe).
- **Escape** closes the drawer (listener added on mount, removed on unmount). Do nothing if the conflict dialog is open (it handles Escape itself).
- **Drop zone:** the whole drawer root uses `useDropZone`. While `isDragging`, show a full overlay "Drop files to attach" with a dashed border. Dropped files go through the same `handleFiles` as the attach button.
- **Responsive:** on desktop a fixed right side panel, 480px wide, full height, left shadow, with a short CSS slide in transition (about 150ms). Below 640px it is full screen. No backdrop on desktop so the board stays visible.
- The conflict dialog state lives in `TaskFields`.

**Done when (harness):** the drawer renders all parts, resizes properly on a narrow window, Escape closes it, the not-found state works, and the offline bar appears when you set `conn: 'reconnecting'`.

---

### Phase 9: Dashboard

**`lib/dashboardStats.ts`** (pure functions, no React, no Supabase). `today` is always a `yyyy-MM-dd` string passed in. Compare strings.

```ts
export function openTasks(tasks: Task[]): Task[]               // status !== 'done'
export function overdueTasks(tasks: Task[], today: string): Task[]
  // open, due_date set, due_date < today, sorted by due_date ascending
export function atRiskTasks(tasks: Task[], today: string): Task[]
  // open, status === 'todo', due_date between today and today + 2 days inclusive, sorted by due_date
export function completionPercent(tasks: Task[]): number       // rounded, 0 when no tasks
export function workloadByMember(tasks: Task[], profiles: Record<string, Profile>):
  { id: string; name: string; color: string; count: number }[]
  // open tasks grouped by assignee, unassigned grouped as { name: 'Unassigned' }, sorted by count descending
export function progressByProject(tasks: Task[], projects: { id: string; name: string }[]):
  { id: string; name: string; done: number; total: number; percent: number }[]
  // every project included, total 0 gives percent 0
```

Use `addDays` and `format` from `date-fns` to compute today plus 2. Verify the functions with a small throwaway script using hand written arrays (including the edge cases: no tasks, all done, task due today, task due in 3 days, unassigned), then delete that script.

**`lib/useDashboardData.ts`**
- Returns `{ tasks, projects, profiles, conn, loading, error, reload }`.
- Initial load in parallel:
  `projects.select('id, name')`, `tasks.select('*').eq('archived', false)`, `profiles.select('*')`. Row level security already limits these to the user's projects.
- Realtime: one channel `dashboard:${userId}` with `postgres_changes` on `tasks`, event `*`, no filter. For each event: if `archived` is true, remove the task. Otherwise upsert **only if the incoming `updated_at` is not older than the stored one**. On `SUBSCRIBED` (first connect and every reconnect) refetch everything and set `conn` to `live`. On `CHANNEL_ERROR`, `TIMED_OUT`, `CLOSED` set `conn` to `reconnecting`. Remove the channel on unmount.
- This hook is separate from Member A's per-project store on purpose. Do not import `lib/store.ts` here.

**Components (`components/dashboard/`)**
- `StatCard.tsx`: label, big number, optional accent color (red for overdue, amber for at risk).
- `WorkloadBars.tsx`: one row per member with avatar, name, a horizontal bar whose width is the count relative to the largest count (minimum 4% so small counts are visible), and the number. Empty state "No open tasks".
- `ProjectProgress.tsx`: one row per project with name, a progress bar, "done / total" and the percent. Projects with no tasks show "No tasks yet". Clicking a row goes to `/projects/{id}`.
- `OverdueList.tsx`: two tabs, **Overdue** and **At risk**. Each row shows the title, a project name chip, the assignee `Avatar`, and a due label ("3 days overdue", "Due today", "Due tomorrow", "Due in 2 days") using `differenceInCalendarDays`. Clicking a row does `router.push('/projects/' + project_id + '?task=' + id)`. Empty state per tab: "Nothing overdue. Nice." / "Nothing at risk."

**`app/dashboard/page.tsx`**
- Wrapped by the auth guard. Header row: title "Dashboard", a small Live or Reconnecting dot (own simple element, do not reuse A's badge).
- Grid: four `StatCard`s (Overdue, At risk, Open tasks, Completion %), then two columns (`WorkloadBars`, `ProjectProgress`), then `OverdueList` full width. On narrow screens, stack everything in one column.
- States: loading -> skeletons shaped like the real layout. Error -> message with a Retry button calling `reload`. No projects -> `EmptyState` "No projects yet" with a link to `/projects`.
- Compute `today` with `format(new Date(), 'yyyy-MM-dd')` on each render.

**Done when:** with the seed data the dashboard shows 3 overdue, 2 at risk, 11 open tasks and 27% completion (4 of 15 done), the workload bars include an "Unassigned" row for the support FAQ task, and changing a task on another browser (once A's board exists) updates the numbers live without a refresh.

---

### Phase 10: Integration with Member A and removing the harness

Do this only after Member A has merged the board, store, hook and mutations to `main`. Pull `main`.

1. Delete every temporary stub. Make sure my code compiles against A's real files. Report any mismatch with the contract instead of changing A's files.
2. Change `app/dev/page.tsx` to a **real** harness for one more pass: read `projectId` and `taskId` from the query string, call `useMe()`, call `useProjectRealtime(projectId, me)`, and render `TaskDrawer` with the real `channelRef`. Use the seed project and one of its tasks.
3. Run the full test list in section 7 using two browser profiles.
4. When everything passes, **delete `app/dev` completely**, run `npm run build`, and confirm nothing references it (`grep -r "dev harness" .` and `grep -r "TEMP" .` return nothing).
5. Confirm with Member A that their board renders `TaskDrawer` with the contract props and that `?task=` opens and closes it.

**Done when:** section 7 passes and the production build succeeds.

---

### Phase 11: Polish and demo notes

- Check every screen at 375px, 768px and 1280px widths. Fix overflow and tap target sizes.
- Every screen has a loading, empty, error and offline state. List any you found missing and fix them.
- Page titles: "Sign in", "Dashboard".
- Create `docs/DEMO.md` with:
  - The 5 step demo script from the shared spec, written as exact clicks using the seed logins and the seed project.
  - A short architecture summary for slides: data flow (browser -> Supabase Postgres -> triggers -> activity -> realtime -> store -> UI), why triggers write the timeline, how version checks prevent silent overwrites, what happens on disconnect and reconnect, and why writes are blocked offline instead of queued.
  - A table mapping each judging criterion to the exact feature and file that delivers it.
  - A list of screenshots to capture (board, drawer with timeline, conflict dialog, dashboard, offline banner).

**Done when:** `docs/DEMO.md` exists and I can rehearse the demo from it without improvising.

## 7. Final test checklist (my half), use two browser profiles

1. Sign up in profile 1 and sign in as a seed user in profile 2. Both see the seed project.
2. Open the same task in both. Each sees the other in the viewers bar. Close it in one, the other's viewers bar clears within a couple of seconds.
3. Type a comment in profile 1: profile 2 shows "X is typing..." and it disappears about 3 seconds after typing stops.
4. Send the comment: it appears in both timelines, in order, exactly once. Refresh profile 2: still exactly once.
5. Change status, assignee and due date in profile 1: profile 2 shows the new field values and the matching system lines in the timeline.
6. Edit the same title in both profiles. Save in profile 1 first, then profile 2: profile 2 sees the conflict dialog with the right values. Test both buttons.
7. While typing in a focused field in profile 2, change a different field of the same task in profile 1: profile 2's typed text is not lost.
8. Upload a small file in profile 1: it appears in both timelines. Download it from profile 2 and confirm the name. Try an 11 MB file: rejected with a toast. Drag a file onto the drawer: overlay shows and it uploads.
9. Switch profile 2's network to Offline in dev tools: banner shows, inputs and comment box disable. Switch back online: banner clears and the timeline matches profile 1.
10. Dashboard: numbers match the board. Complete a task in profile 1: profile 2's dashboard updates without refresh. Click an overdue row: it opens the correct board and task drawer.
11. Run `npm run seed` again: no errors, demo project recreated.

## 8. Common pitfalls (check before asking me)

- **Timeline actors show "Someone":** data was inserted with the service role key. Seed through signed in user clients.
- **Comment appears twice:** you added it to the store manually. Remove that, rely on realtime.
- **Typed text vanishes when someone else edits:** the draft sync must skip focused fields.
- **Dates off by a day:** never `new Date('yyyy-MM-dd')`. Use `parse`.
- **Enter sends while composing with an IME:** check `isComposing`.
- **Download does nothing:** popup blocker. Use a temporary anchor, not `window.open`.
- **Upload succeeds but nothing in the timeline:** the `attachments` insert failed or the table is missing from the realtime publication. Check the toast and the Supabase logs.
- **Presence stays on the old task after reconnect:** the track effect must depend on `conn`.
- **Escape closes the drawer and the dialog at once:** the dialog must stop propagation.
- **Dashboard misses updates from a project joined later:** a refetch happens on every `SUBSCRIBED`, and realtime covers all member projects once the row level security passes.

## 9. Begin

Reply with the 6 line summary requested in Phase 0 and wait for my confirmation before starting Phase 1.

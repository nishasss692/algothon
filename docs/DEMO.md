# Demo Guide & Architecture Notes

## 1. Demo Script (5 Steps)

### Setup
- Run `npm run seed` to ensure fresh demo data.
- Open two browsers (e.g. Browser 1: Aarav `aarav@demo.com`, Browser 2: Priya `priya@demo.com`, password `demo1234`).
- Both navigate to `/projects` and select **Demo: Product Launch**.

---

### Step 1: Real-time Presence & Viewers Bar
1. In Browser 1 (Aarav), click to open the task **Landing page QA**.
2. In Browser 2 (Priya), click to open the same task **Landing page QA**.
3. **Observe:** In both task drawers, the header displays the other user in the viewers bar:
   - Browser 1 displays Priya's avatar and "Priya is also viewing".
   - Browser 2 displays Aarav's avatar and "Aarav is also viewing".
4. Close the drawer in Browser 2. Within seconds, Browser 1's viewers bar updates.

---

### Step 2: Typing Indicators & Real-time Comments
1. Re-open **Landing page QA** in Browser 2.
2. In Browser 2, start typing a comment: *"Double checking mobile responsiveness."* (do not press Enter yet).
3. **Observe:** In Browser 1, the typing indicator appears above the comment box: *"Priya is typing..."*.
4. In Browser 2, press **Enter** (without Shift).
5. **Observe:** The comment appears in both timelines instantly, formatted with avatar, timestamp, and distinct styling. The typing indicator clears.

---

### Step 3: Optimistic Updates & Version Conflict Handling
1. In Browser 1, focus the Title input of **Landing page QA** and change it to:
   `Landing page QA (Final Review)`
2. In Browser 2, focus the Title input of the same task and change it to:
   `Landing page QA & Performance Audit`
3. In Browser 1, click outside (blur) to save. It saves immediately.
4. In Browser 2, click outside (blur) to save.
5. **Observe:** Browser 2 catches the version conflict (`version` mismatch in Postgres) and displays the **Conflict Dialog**:
   - Field: **Title**
   - Yours: `Landing page QA & Performance Audit`
   - Latest: `Landing page QA (Final Review)`
6. Click **Keep mine** or **Take theirs** to resolve cleanly.

---

### Step 4: File Attachments & Drop Zone
1. In Browser 2, click **Attach file** or drag & drop a file (or image) onto the task drawer.
2. An overlay appears: *"Drop files to attach"*.
3. Drop the file: upload chips show progress (`Uploading <filename>...`).
4. Once uploaded to Supabase Storage, an attachment row is created and the timeline updates for both users with a paperclip item and file size.
5. In Browser 1, click **Download** next to the file: the signed URL triggers a clean download with the original filename.

---

### Step 5: Real-time Executive Dashboard
1. In Browser 2, click **Dashboard** in the top navigation bar.
2. **Observe:**
   - **Overdue Tasks (3):** Clearly highlighted with red badges.
   - **At Risk Tasks (2):** Tasks due within 2 days with amber badges.
   - **Open Tasks & Completion %:** 11 open tasks, 27% completion.
   - **Workload by Member:** Aarav, Priya, Rohan, and Unassigned distribution bars.
   - **Project Progress:** Visual completion bar for "Demo: Product Launch".
3. In Browser 1, open any open task and change its status to **Done**.
4. **Observe:** Without refreshing, Browser 2's dashboard updates in real time: open count decreases, completion percentage increases, and workload adjusts.

---

## 2. Architecture Summary for Judges & Slides

```
 [ Browser Client A ]               [ Supabase Postgres ]              [ Browser Client B ]
        |                                     |                                 |
        |--- 1. editTask (version check) ---->|                                 |
        |    (optimistic local update)        |--- 2. Trigger logs activity --->|
        |                                     |       (actor_id = auth.uid())   |
        |<-- 3. Broadcast postgres_changes ---|--- 3. Broadcast changes ------->|
        |       (tasks, activity)             |                                 |
        v                                                                       v
 [ Zustand Store ]                                                      [ Zustand Store ]
        |                                                                       |
        v                                                                       v
   [ TaskDrawer ]                                                         [ TaskDrawer ]
```

### Key Architectural Decisions

1. **Database Triggers as Single Source of Truth for Activity:**
   - Clients never write to the `activity` table directly.
   - Postgres triggers on `tasks`, `comments`, and `attachments` record every state change with the caller's `auth.uid()`.
   - Guaranteed consistency: you cannot alter a task without a corresponding audit event.

2. **Deterministic Version Checking & Conflict Resolution:**
   - Every task has an integer `version`. Mutations send `{ ...patch, version: currentVersion }`.
   - `UPDATE tasks SET ... version = version + 1 WHERE id = taskId AND version = currentVersion`.
   - If 0 rows updated, someone else edited first. The server returns the latest state, and the client displays a field-by-field diff dialog ("Keep mine" / "Take theirs").

3. **Offline & Disconnection Behavior:**
   - When the websocket drops, connection status switches to `reconnecting`.
   - Mutation inputs and comment submissions are disabled with clear tooltips and placeholder messaging ("Reconnecting. Editing is paused.").
   - Disconnected writes are **blocked instead of silently queued** to avoid massive out-of-order conflict cascades when reconnecting.
   - Upon reconnect (`SUBSCRIBED`), the client refetches latest state and re-announces presence.

---

## 3. Judging Criteria Mapping

| Judging Criterion | Delivering Feature & Files |
|---|---|
| **Real-time Reliability** | PostgreSQL triggers + Realtime publication subscriptions (`lib/useDashboardData.ts`, `lib/store.ts`, `lib/hooks/useProjectRealtime.ts`) |
| **Collaboration UX** | Live presence indicators (`components/task/ViewersBar.tsx`), live typing indicators (`components/task/TypingIndicator.tsx`), drag-and-drop file attachments (`lib/useDropZone.ts`, `components/task/AttachButton.tsx`) |
| **Data Consistency** | Optimistic concurrency control with version checking and Conflict Dialog (`components/task/ConflictDialog.tsx`, `components/task/TaskFields.tsx`, `lib/mutations.ts`) |
| **Completeness** | Full auth flow, empty/error/loading/offline states, executive dashboard (`app/dashboard/page.tsx`, `lib/dashboardStats.ts`), seed automation (`scripts/seed.ts`) |

---

## 4. Key Screenshots to Capture

1. **Board View with Live Presence:** Showing columns, cards, and active user avatars in the header.
2. **Task Drawer with Unified Timeline:** Showing system events (status/assignee/due date changes), threaded comments, and attachments.
3. **Conflict Resolution Modal:** Showing side-by-side diff when two users edit the same task concurrently.
4. **Executive Dashboard:** Showing StatCards (Overdue, At Risk, Completion %), Workload by Member, and Project Progress bars.
5. **Offline Disconnect Banner:** Showing "Reconnecting. Editing is paused." and disabled controls during network interruptions.

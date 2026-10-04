# Design

> Last updated: Phase 0

## Principles

1. **Simple and readable.** Write the most boring, clear version that works. No clever abstractions.
2. **No UI kits.** Plain Tailwind + divs only. No component libraries, no chart libraries.
3. **Every screen has three states.** Loading skeleton, empty state (friendly message + action), error state (toast + retry where possible).
4. **Judges notice details.** Every Supabase call checks `error` and shows a toast. No silent failures.

## Color Palette (Tailwind)

| Token | Usage |
|---|---|
| `gray-950` / `gray-900` | Page backgrounds |
| `gray-800` | Card / drawer background |
| `gray-700` | Input backgrounds, dividers |
| `gray-400` | Muted text, placeholders |
| `gray-100` | Primary text |
| `indigo-500` / `indigo-600` | Primary actions, status highlight |
| `red-500` | Overdue dates, errors |
| `amber-400` | At-risk (due within 2 days) |
| `emerald-500` | Done / success |

User avatar colors are stored in `profiles.color` (defaults to `#6366f1`). We generate 8 preset colors on signup for variety.

## Typography

- Font: system UI stack (Next.js default) — no Google Fonts import to keep it fast
- Base text: `text-sm` (14px) throughout UI
- Headings: `text-base font-semibold` (column headers, section labels)
- Page titles: `text-lg font-bold`

## Layout

- Root layout: full-height dark background, `Header` at top, `<main>` fills remaining height
- Board: horizontal scroll of 4 fixed-width columns (`w-72`) in a flex row
- Task drawer: fixed right panel, `w-96`, slides in over the board (not a modal)
- Dashboard: single column, max-width `max-w-4xl`, centered

## Component Inventory

| Component | Location | Phase |
|---|---|---|
| `Header` | `components/ui/Header.tsx` | 2 |
| `Avatar` | `components/ui/Avatar.tsx` | 2 |
| `Spinner` | `components/ui/Spinner.tsx` | 2 |
| `ConnectionBadge` | `components/ui/ConnectionBadge.tsx` | 4 |
| `OfflineBanner` | `components/ui/OfflineBanner.tsx` | 4 |
| `KanbanColumn` | `components/board/KanbanColumn.tsx` | 5 |
| `TaskCard` | `components/board/TaskCard.tsx` | 5 |
| `QuickAddInput` | `components/board/QuickAddInput.tsx` | 5 |
| `DragOverlay` | `components/board/BoardDragOverlay.tsx` | 6 |
| `TaskDrawer` | `components/task/TaskDrawer.tsx` | 7 |
| `ConflictDialog` | `components/task/ConflictDialog.tsx` | 7 |
| `Timeline` | `components/task/Timeline.tsx` | 8 |
| `CommentBox` | `components/task/CommentBox.tsx` | 8 |
| `FileUploadZone` | `components/task/FileUploadZone.tsx` | 8 |
| `StatCard` | `components/dashboard/StatCard.tsx` | 10 |
| `WorkloadBar` | `components/dashboard/WorkloadBar.tsx` | 10 |
| `ProjectProgress` | `components/dashboard/ProjectProgress.tsx` | 10 |

## Task Status Colors

| Status | Tailwind classes |
|---|---|
| `todo` | `bg-gray-700 text-gray-300` |
| `in_progress` | `bg-indigo-900 text-indigo-300` |
| `review` | `bg-amber-900 text-amber-300` |
| `done` | `bg-emerald-900 text-emerald-300` |

## Key UX Patterns

- **Due date display:** Show the raw `yyyy-MM-dd` string. Color `text-red-500` if `dueDate < today` and status is not `done`.
- **Presence avatars:** Small colored circles with user initials. Stack overlapping with `z-index`. Tooltip on hover shows name.
- **Typing indicator:** `"X is typing..."` appears below comment input, fades out after 3s.
- **Conflict dialog:** Two-button modal — "Keep mine" (retry with latest version) / "Take theirs" (discard and show their version).
- **Connection badge:** Small pill in the board header — green dot + "Live" or amber dot + "Reconnecting".
- **Offline banner:** Full-width amber bar at top: "You're offline. Reconnecting…" Inputs disabled underneath.

## Loading Skeletons (Phase 12)

- Projects page: 3 grey card skeletons while fetching
- Board: column headers visible immediately; card areas show 2–3 skeleton cards per column
- Task drawer: title and description show pulsing grey bars

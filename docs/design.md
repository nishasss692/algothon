# Design

> Last updated: Phase 2 / Phase 10 (Member B)

## Principles

1. **Simple and readable.** Write the most boring, clear version that works. No clever abstractions.
2. **No UI kits.** Inline styles and plain Tailwind utilities only. No component libraries, no chart libraries.
3. **Every screen has three states.** Loading skeleton, empty state (friendly message + action), error state (toast + retry where possible).
4. **Judges notice details.** Every Supabase call checks `error` and shows a toast. No silent failures.

## Color Palette

| Token | Hex | Usage |
|---|---|---|
| Background | `#f9fafb` | Page/form backgrounds (light theme used by Member B) |
| Surface | `#ffffff` | Cards, panels, stat cards |
| Border | `#e5e7eb` | Card borders, dividers |
| Text primary | `#111827` | Headings, main content |
| Text secondary | `#374151` | Body text |
| Text muted | `#6b7280` | Labels, captions |
| Text placeholder | `#9ca3af` | Empty states, unassigned |
| Indigo (primary) | `#6366f1` | Brand, buttons, links, active nav |
| Red (danger) | `#dc2626` / `#ef4444` | Overdue dates, errors, validation |
| Amber (warning) | `#d97706` / `#f59e0b` | At-risk tasks, reconnecting badge |
| Emerald (success) | `#10b981` | Done/complete, live badge |

User avatar colors (stored in `profiles.color`):
`#6366f1`, `#f43f5e`, `#10b981`, `#f59e0b`, `#3b82f6`, `#8b5cf6`, `#ec4899`, `#14b8a6`

## Typography

- Font: Geist Sans (loaded via `next/font/google`) — set in root layout
- Base text: `font-size: 14px` throughout UI
- Headings: `font-size: 15-16px, font-weight: 600`
- Page titles: `font-size: 22-24px, font-weight: 700`
- Captions/labels: `font-size: 12-13px`

## Layout

- Root layout: `LayoutShell` conditionally shows `Header` (56px tall); `<main>` fills remaining height
- Login page: centered card, `width: 360px`, white background, soft shadow
- Dashboard: single column, `max-width: 1100px`, centered, `padding: 24px 20px`
- Projects page: grid of cards (Phase 3)
- Board: horizontal scroll of 4 fixed-width columns `w-72` (Phase 5)
- Task drawer: fixed right panel `w-96`, slides over board (Phase 7)

## Component Inventory

| Component | File | Phase | Status |
|---|---|---|---|
| `AuthGuard` | `components/AuthGuard.tsx` | 2 | ✅ Done |
| `Header` | `components/Header.tsx` | 2 | ✅ Done |
| `LayoutShell` | `components/LayoutShell.tsx` | 2 | ✅ Done |
| `Avatar` | `components/ui/Avatar.tsx` | 2 | ✅ Done |
| `Skeleton` | `components/ui/Skeleton.tsx` | 2 | ✅ Done |
| `EmptyState` | `components/ui/EmptyState.tsx` | 2 | ✅ Done |
| `StatCard` | `components/dashboard/StatCard.tsx` | 10 | ✅ Done |
| `WorkloadBars` | `components/dashboard/WorkloadBars.tsx` | 10 | ✅ Done |
| `ProjectProgress` | `components/dashboard/ProjectProgress.tsx` | 10 | ✅ Done |
| `OverdueList` | `components/dashboard/OverdueList.tsx` | 10 | ✅ Done |
| `TaskDrawer` | `components/task/TaskDrawer.tsx` | 7 | ✅ Done (stub needs Member A's store) |
| `TaskFields` | `components/task/TaskFields.tsx` | 7 | ✅ Done |
| `ConflictDialog` | `components/task/ConflictDialog.tsx` | 7 | ✅ Done |
| `Timeline` | `components/task/Timeline.tsx` | 8 | ✅ Done |
| `TimelineItem` | `components/task/TimelineItem.tsx` | 8 | ✅ Done |
| `CommentBox` | `components/task/CommentBox.tsx` | 8 | ✅ Done |
| `AttachButton` | `components/task/AttachButton.tsx` | 8 | ✅ Done |
| `ViewersBar` | `components/task/ViewersBar.tsx` | 9 | ✅ Done |
| `TypingIndicator` | `components/task/TypingIndicator.tsx` | 9 | ✅ Done |
| `ConnectionBadge` | (inline in board header / dashboard) | 4 | Pending |
| `OfflineBanner` | (inline in board) | 4 | Pending |
| `KanbanColumn` | `components/board/KanbanColumn.tsx` | 5 | Pending |
| `TaskCard` | `components/board/TaskCard.tsx` | 5 | Pending |
| `QuickAddInput` | `components/board/QuickAddInput.tsx` | 5 | Pending |
| `DragOverlay` | `components/board/BoardDragOverlay.tsx` | 6 | Pending |

## Task Status Colors

| Status | Label | Color style |
|---|---|---|
| `todo` | To do | grey |
| `in_progress` | In progress | indigo |
| `review` | Review | amber |
| `done` | Done | emerald |

## Key UX Patterns

- **Due date display:** Show the raw `yyyy-MM-dd` string. Color red if `dueDate < today` and status is not `done`.
- **Presence avatars:** `Avatar` component — colored circle with initial, `title` tooltip for full name.
- **Typing indicator:** `TypingIndicator` — "X is typing..." fades out after 3s.
- **Conflict dialog:** `ConflictDialog` — "Keep mine" (retry with latest version) / "Take theirs" (discard).
- **Connection badge:** Pill in board header — `●  Live` (green) or `●  Reconnecting` (amber). Also inline in dashboard header.
- **Offline banner:** Full-width amber bar (Phase 4 — not yet built as a component, will be inline in board).
- **Loading state:** `Skeleton` blocks pulsing grey.
- **Empty state:** `EmptyState` centered with title, optional description, optional action.

## Activity Timeline Entry Formats (`lib/activityText.ts`)

| Type | Human-readable text |
|---|---|
| `task_created` | "Aarav created this task" |
| `status_changed` | "Aarav moved this from To do to In progress" |
| `assignee_changed` | "Aarav assigned this to Priya" / "Aarav unassigned this task" |
| `due_changed` | "Aarav set the due date to Oct 10" / "Aarav changed the due date from Oct 8 to Oct 10" |
| `comment_added` | Shown as comment bubble (handled in `TimelineItem`) |
| `file_added` | Shown as file chip with download (handled in `TimelineItem`) |

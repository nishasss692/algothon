# Agent Instructions

> This file tells any AI agent (or human) how to work on this codebase.

## What This Is

A collaborative project workspace (Kanban + real-time + file sharing) built as a 12-hour hackathon project. Stack: Next.js 16 App Router + TypeScript + Tailwind + Supabase + Zustand + dnd-kit + sonner.

## Before Writing Any Code

1. Read `docs/context.md` — the full requirements and phase order.
2. Read `docs/architecture.md` — data flow, store design, realtime channel, offline rules.
3. Read `docs/design.md` — color palette, component inventory, UX patterns.
4. Read `PROGRESS.md` — which phases are done.
5. Check the relevant Next.js docs in `node_modules/next/dist/docs/` before using any Next.js API — this version may differ from training data.

## Strict Rules

- **Work one phase at a time.** Do not implement features from future phases.
- **No clever abstractions.** Write the most boring readable version that works.
- **Files under 150 lines.** One component per file.
- **No dead code.** No commented-out code, unused imports, or placeholder TODOs.
- **TypeScript strict.** No `any`. All types come from `lib/types.ts`.
- **Error visibility.** Every Supabase call checks `error` and calls `toast.error(...)` on failure.
- **No extra libraries.** The package list in `docs/context.md § 2` is final. Ask before adding anything.
- **No service role key in app code.** Only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` in client code.
- **No SSR auth, no middleware.** Supabase client from `lib/supabase.ts` only, in `'use client'` components.
- **Never refactor completed phases** unless a bug forces it. State the reason if you do.
- **Soft delete only.** Archive tasks (`archived = true`), never delete.
- **Activity is trigger-only.** Never insert into the `activity` table from client code.

## Key Patterns to Follow

### Supabase calls
```ts
const { data, error } = await supabase.from('tasks').select('*').eq('project_id', pid);
if (error) { toast.error(error.message); return; }
```

### Version-checked task edits (drawer only)
```ts
const { data, error } = await supabase
  .from('tasks').update(patch)
  .eq('id', task.id).eq('version', task.version)
  .select().maybeSingle();
if (error) { /* roll back optimistic, toast */ return; }
if (!data) { /* conflict: fetch latest, open conflict dialog */ return; }
```

### Drag moves (no version check)
Last write wins. Roll back optimistic update on error only.

### upsertTask
Always go through the store's `upsertTask`. Never append tasks directly. It handles:
- Stale echo filtering (ignores rows with `updated_at` ≤ stored)
- Archived task removal

### due_date comparisons
```ts
// Correct — string comparison, no timezone issues
const isOverdue = task.due_date !== null && task.due_date < today && task.status !== 'done';
// today = format(new Date(), 'yyyy-MM-dd') from date-fns
```

### Offline guard
```ts
const conn = useProjectStore(s => s.conn);
if (conn !== 'live') { toast.error("You're offline"); return; }
```

## File Naming Conventions

- React components: `PascalCase.tsx`
- Hooks: `use<Name>.ts`
- Utility/lib files: `camelCase.ts`
- All new components go in the appropriate `components/<category>/` folder

## After Each Phase

1. Run `npx tsc --noEmit` — zero errors required.
2. Run `npm run dev` — app must start cleanly.
3. Update `PROGRESS.md` — tick off the phase.
4. Update `docs/architecture.md` and `docs/design.md` with anything new.
5. Report: (a) what was built, (b) manual test steps, (c) any required manual actions.

## Current Status

See `PROGRESS.md` for phase completion.  
See `docs/context.md § 9` for common pitfalls to check before debugging.

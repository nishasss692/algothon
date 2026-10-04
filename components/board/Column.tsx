'use client';

import { useState, type FormEvent } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import type { Task, TaskStatus } from '@/lib/types';
import { TaskCard } from './TaskCard';
import { createTask } from '@/lib/mutations';
import { useProjectStore } from '@/lib/store';

interface ColumnProps {
  status: TaskStatus;
  title: string;
  tasks: Task[];
  projectId: string;
  selectedTaskId?: string | null;
  currentUserId?: string;
  onSelectTask?: (taskId: string) => void;
}

const STATUS_THEMES: Record<
  TaskStatus,
  {
    dotColor: string;
    borderTop: string;
    badgeStyle: string;
  }
> = {
  todo: {
    dotColor: 'bg-slate-500',
    borderTop: 'border-t-slate-500',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
  },
  in_progress: {
    dotColor: 'bg-blue-600',
    borderTop: 'border-t-blue-600',
    badgeStyle: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  review: {
    dotColor: 'bg-amber-500',
    borderTop: 'border-t-amber-500',
    badgeStyle: 'bg-amber-50 text-amber-700 border-amber-200',
  },
  done: {
    dotColor: 'bg-emerald-600',
    borderTop: 'border-t-emerald-600',
    badgeStyle: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
};

export function Column({
  status,
  title,
  tasks,
  projectId,
  selectedTaskId,
  currentUserId,
  onSelectTask,
}: ColumnProps) {
  const conn = useProjectStore((s) => s.conn);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
    disabled: conn !== 'live',
  });

  const taskIds = tasks.map((t) => t.id);
  const theme = STATUS_THEMES[status] || STATUS_THEMES.todo;

  async function handleQuickAdd(e: FormEvent) {
    e.preventDefault();
    if (!newTitle.trim() || submitting) return;

    setSubmitting(true);
    const result = await createTask({
      projectId,
      title: newTitle.trim(),
      status,
    });

    setSubmitting(false);
    if (result.success) {
      setNewTitle('');
      setQuickAddOpen(false);
    }
  }

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col h-full rounded-2xl border border-slate-200/90 bg-slate-100/80 shadow-xs transition-all overflow-hidden ${
        isOver
          ? 'border-blue-400 bg-blue-50/40 ring-2 ring-blue-200 shadow-md'
          : 'hover:border-slate-300'
      }`}
    >
      {/* Column Top Header */}
      <div className={`border-t-[3px] ${theme.borderTop} bg-white px-4 py-3.5 border-b border-slate-200/80 flex items-center justify-between`}>
        <div className="flex items-center gap-2.5 min-w-0">
          <span className={`h-2.5 w-2.5 rounded-full ${theme.dotColor} shrink-0`} />
          <h2 className="text-sm font-semibold tracking-tight text-slate-900 truncate">
            {title}
          </h2>
          <span
            className={`rounded-full border px-2 py-0.5 text-xs font-semibold shrink-0 ${theme.badgeStyle}`}
          >
            {tasks.length}
          </span>
        </div>

        <button
          type="button"
          onClick={() => setQuickAddOpen((prev) => !prev)}
          className="flex h-7 w-7 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-600 hover:bg-slate-50 transition shadow-2xs"
          title={`Add new task to ${title}`}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {/* Task Cards Scroll Container */}
      <div className="flex-1 p-3 space-y-3 overflow-y-auto min-h-[160px]">
        {/* Quick Add Top Input when active */}
        {quickAddOpen && (
          <form
            onSubmit={handleQuickAdd}
            className="rounded-xl border border-blue-300 bg-white p-3 shadow-md space-y-2.5 animate-in fade-in duration-150"
          >
            <input
              type="text"
              autoFocus
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done? Press Enter..."
              disabled={submitting}
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:border-blue-500 focus:outline-none transition"
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setQuickAddOpen(false);
                  setNewTitle('');
                }}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim() || submitting}
                className="rounded-lg bg-blue-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-2xs"
              >
                {submitting ? 'Adding...' : 'Add Task'}
              </button>
            </div>
          </form>
        )}

        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              isSelected={selectedTaskId === task.id}
              currentUserId={currentUserId}
              onSelectTask={onSelectTask}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {tasks.length === 0 && !quickAddOpen && (
          <div
            onClick={() => setQuickAddOpen(true)}
            className="flex h-28 flex-col items-center justify-center rounded-xl border border-dashed border-slate-300/80 bg-white/50 text-center transition hover:border-blue-400 hover:bg-white cursor-pointer group"
          >
            <span className="text-xs font-medium text-slate-500 group-hover:text-blue-600 transition">
              {isOver ? 'Drop card here' : '+ New Task'}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

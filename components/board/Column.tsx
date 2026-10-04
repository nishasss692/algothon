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
  currentUserId?: string;
  onSelectTask?: (taskId: string) => void;
}

const STATUS_ACCENT_COLORS: Record<TaskStatus, { bg: string; text: string; dot: string }> = {
  todo: { bg: 'bg-slate-100', text: 'text-slate-700', dot: 'bg-slate-400' },
  in_progress: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  review: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  done: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
};

export function Column({
  status,
  title,
  tasks,
  projectId,
  currentUserId,
  onSelectTask,
}: ColumnProps) {
  const conn = useProjectStore((s) => s.conn);
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Droppable container for this column (supports empty column drops)
  const { setNodeRef, isOver } = useDroppable({
    id: status,
    data: {
      type: 'Column',
      status,
    },
    disabled: conn !== 'live',
  });

  const taskIds = tasks.map((t) => t.id);
  const color = STATUS_ACCENT_COLORS[status];

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
      className={`flex flex-col h-full rounded-2xl border transition-colors bg-gray-50/70 ${
        isOver
          ? 'border-green-400 ring-2 ring-green-400/20 bg-green-50/20'
          : 'border-gray-200/90'
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200/70">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${color.dot}`} />
          <h2 className="text-sm font-semibold text-gray-800">{title}</h2>
        </div>
        <span
          className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-xs font-semibold ${color.bg} ${color.text}`}
        >
          {tasks.length}
        </span>
      </div>

      {/* Task Cards List */}
      <div className="flex-1 p-2.5 space-y-2.5 overflow-y-auto min-h-[140px]">
        <SortableContext items={taskIds} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              currentUserId={currentUserId}
              onSelectTask={onSelectTask}
            />
          ))}
        </SortableContext>

        {/* Empty State */}
        {tasks.length === 0 && (
          <div className="flex h-28 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white/50 text-center text-xs text-gray-400 select-none">
            {isOver ? 'Drop task here' : 'No tasks yet'}
          </div>
        )}
      </div>

      {/* Quick Add Section */}
      <div className="p-2.5 pt-0">
        {quickAddOpen ? (
          <form onSubmit={handleQuickAdd} className="rounded-xl border border-gray-300 bg-white p-2.5 shadow-sm">
            <input
              type="text"
              autoFocus
              disabled={submitting || conn !== 'live'}
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="What needs to be done?"
              className="w-full text-xs text-gray-900 outline-none placeholder:text-gray-400"
            />
            <div className="mt-2.5 flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => {
                  setQuickAddOpen(false);
                  setNewTitle('');
                }}
                disabled={submitting}
                className="rounded-lg px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!newTitle.trim() || submitting || conn !== 'live'}
                className="rounded-lg bg-green-700 px-3 py-1 text-xs font-semibold text-white transition hover:bg-green-800 disabled:opacity-50"
              >
                {submitting ? 'Adding...' : 'Add'}
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setQuickAddOpen(true)}
            disabled={conn !== 'live'}
            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-gray-300 py-2 text-xs font-medium text-gray-500 hover:border-gray-400 hover:bg-white hover:text-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Add task
          </button>
        )}
      </div>
    </div>
  );
}

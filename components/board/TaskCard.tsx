'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { format, parseISO } from 'date-fns';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  currentUserId?: string;
  onSelectTask?: (taskId: string) => void;
}

export function TaskCard({
  task,
  isOverlay = false,
  currentUserId,
  onSelectTask,
}: TaskCardProps) {
  const conn = useProjectStore((s) => s.conn);
  const profiles = useProjectStore((s) => s.profiles);
  const online = useProjectStore((s) => s.online);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: task.id,
    data: {
      type: 'Task',
      task,
    },
    disabled: conn !== 'live',
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const assignee = task.assignee_id ? profiles[task.assignee_id] : null;

  // Active collaborators currently viewing this task
  const viewers = online.filter(
    (u) => u.task_id === task.id && u.user_id !== currentUserId
  );

  // Due date calculation
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isOverdue =
    Boolean(task.due_date) &&
    task.status !== 'done' &&
    (task.due_date as string) < todayStr;

  const formattedDueDate = task.due_date
    ? (() => {
        try {
          return format(parseISO(task.due_date), 'MMM d');
        } catch {
          return task.due_date;
        }
      })()
    : null;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => {
        if (!isDragging) {
          onSelectTask?.(task.id);
        }
      }}
      className={`group relative rounded-xl border bg-white p-3.5 shadow-xs transition-all select-none ${
        isDragging
          ? 'opacity-30 border-dashed border-green-500'
          : isOverlay
          ? 'rotate-1 shadow-lg ring-2 ring-green-600/30 border-green-400 cursor-grabbing'
          : 'border-gray-200/80 hover:border-gray-300 hover:shadow-sm cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Top Row: Presence indicator & Overdue */}
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-gray-900 leading-snug break-words">
          {task.title}
        </p>

        {/* Viewers indicator */}
        {viewers.length > 0 && (
          <div className="flex -space-x-1 shrink-0" title={`Currently viewed by ${viewers.map((v) => v.name).join(', ')}`}>
            {viewers.map((viewer) => (
              <span
                key={viewer.user_id}
                className="relative inline-flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ring-2 ring-white"
                style={{ backgroundColor: viewer.color || '#10b981' }}
              >
                {viewer.name.charAt(0).toUpperCase()}
                <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400 ring-1 ring-white animate-pulse" />
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Description preview if present */}
      {task.description && (
        <p className="mt-1 line-clamp-2 text-xs text-gray-500 leading-relaxed">
          {task.description}
        </p>
      )}

      {/* Bottom Meta Row */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
        {/* Due Date badge */}
        {formattedDueDate ? (
          <div
            className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium ${
              isOverdue
                ? 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-600/20'
                : 'text-gray-500 bg-gray-50'
            }`}
            title={isOverdue ? 'Overdue' : 'Due date'}
          >
            <svg
              className={`h-3.5 w-3.5 ${isOverdue ? 'text-red-500' : 'text-gray-400'}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
            <span>{formattedDueDate}</span>
          </div>
        ) : (
          <span />
        )}

        {/* Assignee Avatar */}
        {assignee ? (
          <div
            className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white shadow-xs"
            style={{ backgroundColor: assignee.color || '#6366f1' }}
            title={`Assigned to ${assignee.name}`}
          >
            {assignee.name.charAt(0).toUpperCase()}
          </div>
        ) : null}
      </div>
    </div>
  );
}

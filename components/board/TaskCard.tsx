'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Task } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { format, parseISO, isToday } from 'date-fns';

interface TaskCardProps {
  task: Task;
  isOverlay?: boolean;
  isSelected?: boolean;
  currentUserId?: string;
  onSelectTask?: (taskId: string) => void;
}

export function TaskCard({
  task,
  isOverlay = false,
  isSelected = false,
  currentUserId,
  onSelectTask,
}: TaskCardProps) {
  const conn = useProjectStore((s) => s.conn);
  const profiles = useProjectStore((s) => s.profiles);
  const online = useProjectStore((s) => s.online);
  const conflicts = useProjectStore((s) => s.conflicts);

  const hasConflict = Boolean(conflicts[task.id]);

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

  // Collaborators currently viewing this task
  const viewers = online.filter(
    (u) => u.task_id === task.id && u.user_id !== currentUserId
  );

  // Due date & priority calculation
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const isOverdue =
    Boolean(task.due_date) &&
    task.status !== 'done' &&
    (task.due_date as string) < todayStr;

  const formattedDueDate = task.due_date
    ? (() => {
        try {
          const parsed = parseISO(task.due_date);
          return format(parsed, 'MMM dd');
        } catch {
          return task.due_date;
        }
      })()
    : null;

  // Priority badge determination
  const priority = isOverdue
    ? { label: 'Urgent', color: 'text-rose-700 bg-rose-50 border-rose-200' }
    : task.due_date && isToday(parseISO(task.due_date))
    ? { label: 'High', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    : task.status === 'in_progress'
    ? { label: 'In Progress', color: 'text-blue-700 bg-blue-50 border-blue-200' }
    : { label: 'Normal', color: 'text-slate-600 bg-slate-100 border-slate-200' };

  const taskCode = `TSK-${task.id.slice(0, 4).toUpperCase()}`;
  const branchName = `feat/${task.id.slice(0, 5).toLowerCase()}`;

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
      className={`group relative rounded-xl border bg-white p-3.5 transition-all select-none ${
        isDragging
          ? 'opacity-30 border-dashed border-blue-400 bg-blue-50/20'
          : isOverlay
          ? 'shadow-xl ring-2 ring-blue-500 border-blue-400 bg-white cursor-grabbing scale-[1.02]'
          : isSelected
          ? 'border-blue-500 ring-2 ring-blue-500/20 shadow-sm cursor-pointer'
          : hasConflict
          ? 'border-rose-400 bg-rose-50/20 hover:border-rose-500 shadow-2xs cursor-grab active:cursor-grabbing'
          : 'border-slate-200 hover:border-blue-300 hover:shadow-md shadow-2xs cursor-grab active:cursor-grabbing'
      }`}
    >
      {/* Top Header: ID, Revision, Priority, Conflict Badge */}
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-500 group-hover:text-blue-600 transition">
            {taskCode}
          </span>
          {hasConflict && (
            <span
              className="inline-flex items-center gap-1 rounded-md border border-rose-300 bg-rose-50 px-2 py-0.5 text-xs font-semibold text-rose-700 animate-pulse"
              title="Concurrent edit conflict detected"
            >
              <span>!</span>
              <span>Conflict</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {/* Priority Pill */}
          <span
            className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium leading-none ${priority.color}`}
          >
            {priority.label}
          </span>

          {/* Active Viewers Bubble */}
          {viewers.length > 0 && (
            <div
              className="flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2 py-0.5 text-xs font-medium text-emerald-700"
              title={`Viewed by: ${viewers.map((v) => v.name).join(', ')}`}
            >
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{viewers[0].name.slice(0, 3)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Task Title (Bigger font, readable and prominent) */}
      <h3 className="text-sm font-semibold text-slate-900 leading-snug break-words">
        {task.title}
      </h3>

      {/* Description Snippet (if available) */}
      {task.description && (
        <p className="mt-1.5 line-clamp-2 text-xs text-slate-600 leading-relaxed font-normal">
          {task.description}
        </p>
      )}

      {/* Branch & Technical Reference Pill */}
      <div className="mt-2.5 flex items-center gap-2">
        <span
          className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 border border-slate-200 px-2 py-0.5 text-xs text-slate-600 font-medium"
          title={`Git reference: ${branchName}`}
        >
          <svg className="w-3 h-3 text-slate-500" viewBox="0 0 16 16" fill="currentColor">
            <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
          </svg>
          <span className="truncate max-w-[140px]">{branchName}</span>
        </span>
      </div>

      {/* Bottom Footer: Due Date & Assignee Avatar */}
      <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-xs">
        {/* Due Date Indicator */}
        {formattedDueDate ? (
          <span
            className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 ${
              isOverdue
                ? 'bg-rose-50 text-rose-700 font-semibold border border-rose-200'
                : 'text-slate-600 bg-slate-50 border border-slate-200'
            }`}
            title={isOverdue ? 'Task is overdue' : 'Due date'}
          >
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>{formattedDueDate}</span>
          </span>
        ) : (
          <span className="text-xs text-slate-400 flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
            <span>No due date</span>
          </span>
        )}

        {/* Assignee Avatar */}
        {assignee ? (
          <div
            className="flex items-center gap-1.5"
            title={`Assigned to ${assignee.name}`}
          >
            <span className="text-xs font-medium text-slate-700 truncate max-w-[80px]">
              {assignee.name.split(' ')[0]}
            </span>
            <span
              className="flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold text-white shadow-2xs ring-2 ring-white"
              style={{ backgroundColor: assignee.color || '#4f46e5' }}
            >
              {assignee.name.charAt(0).toUpperCase()}
            </span>
          </div>
        ) : (
          <span
            className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-slate-300 bg-slate-50 text-xs text-slate-400"
            title="Unassigned"
          >
            ?
          </span>
        )}
      </div>
    </div>
  );
}

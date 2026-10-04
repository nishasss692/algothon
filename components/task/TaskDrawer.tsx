'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { updateTaskWithVersion } from '@/lib/mutations';
import { ConflictDialog } from '@/components/board/ConflictDialog';
import { toast } from 'sonner';

interface TaskDrawerProps {
  taskId: string | null;
  projectId: string;
  onClose: () => void;
}

interface TaskDrawerContentProps {
  task: Task;
  projectId: string;
  onClose: () => void;
}

function TaskDrawerContent({ task, onClose }: TaskDrawerContentProps) {
  const profiles = useProjectStore((s) => s.profiles);
  const conn = useProjectStore((s) => s.conn);
  const online = useProjectStore((s) => s.online);

  // Form states initialized directly from initial task prop
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState<string>(task.assignee_id || '');
  const [dueDate, setDueDate] = useState<string>(task.due_date || '');
  const [baseVersion, setBaseVersion] = useState<number>(task.version);
  const [saving, setSaving] = useState(false);

  // Conflict handling state
  const [showConflictDialog, setShowConflictDialog] = useState(false);
  const [conflictedTask, setConflictedTask] = useState<Task | null>(null);
  const [pendingPatch, setPendingPatch] = useState<Partial<
    Pick<
      Task,
      'title' | 'description' | 'status' | 'assignee_id' | 'due_date' | 'archived'
    >
  > | null>(null);

  // Collaborators currently viewing this task
  const taskViewers = online.filter((u) => u.task_id === task.id);

  async function handleSave() {
    if (!title.trim()) {
      toast.error('Task title cannot be empty.');
      return;
    }

    if (conn !== 'live') {
      toast.error('Cannot save changes while offline or reconnecting.');
      return;
    }

    setSaving(true);

    const patch: Partial<
      Pick<
        Task,
        'title' | 'description' | 'status' | 'assignee_id' | 'due_date' | 'archived'
      >
    > = {
      title: title.trim(),
      description: description.trim(),
      status,
      assignee_id: assigneeId ? assigneeId : null,
      due_date: dueDate ? dueDate : null,
    };

    const result = await updateTaskWithVersion({
      taskId: task.id,
      expectedVersion: baseVersion,
      patch,
    });

    setSaving(false);

    if (result.status === 'success') {
      setBaseVersion(result.task.version);
      toast.success('Task updated successfully.');
    } else if (result.status === 'conflict') {
      // Optimistic concurrency conflict detected!
      setConflictedTask(result.latestTask);
      setPendingPatch(patch);
      setShowConflictDialog(true);
      toast.warning('Edit conflict: Another collaborator updated this task.');
    } else {
      // General error (network/RLS) — preserve edits in form
      toast.error(result.message);
    }
  }

  // Conflict Resolution: Take theirs (Discard local edits)
  function handleTakeTheirs() {
    if (conflictedTask) {
      setTitle(conflictedTask.title);
      setDescription(conflictedTask.description || '');
      setStatus(conflictedTask.status);
      setAssigneeId(conflictedTask.assignee_id || '');
      setDueDate(conflictedTask.due_date || '');
      setBaseVersion(conflictedTask.version);
    }
    setShowConflictDialog(false);
    setConflictedTask(null);
    setPendingPatch(null);
    toast.info('Discarded local changes and loaded latest server version.');
  }

  // Conflict Resolution: Keep mine (Retry with latest version token)
  async function handleKeepMine() {
    if (!conflictedTask || !pendingPatch) return;

    setSaving(true);
    const result = await updateTaskWithVersion({
      taskId: task.id,
      expectedVersion: conflictedTask.version,
      patch: pendingPatch,
    });
    setSaving(false);

    if (result.status === 'success') {
      setBaseVersion(result.task.version);
      setShowConflictDialog(false);
      setConflictedTask(null);
      setPendingPatch(null);
      toast.success('Task overwritten with your version.');
    } else if (result.status === 'conflict') {
      // Further conflict if another user wrote again
      setConflictedTask(result.latestTask);
      toast.warning('Another update occurred concurrently. Please review.');
    } else {
      toast.error(result.message);
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-2xs transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col bg-white shadow-2xl border-l border-gray-200 animate-in slide-in-from-right duration-200">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4 bg-gray-50/50">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center rounded-md bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
              v{baseVersion}
            </span>
            <span className="text-xs font-mono text-gray-500">
              Task #{task.id.slice(0, 8)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Viewers presence */}
            {taskViewers.length > 0 && (
              <div
                className="flex items-center -space-x-1"
                title={`Active viewers: ${taskViewers.map((v) => v.name).join(', ')}`}
              >
                {taskViewers.map((v) => (
                  <span
                    key={v.user_id}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold text-white ring-2 ring-white"
                    style={{ backgroundColor: v.color || '#10b981' }}
                  >
                    {v.name.charAt(0).toUpperCase()}
                  </span>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
              title="Close drawer"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer Form Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Offline Warning Banner if disconnected */}
          {conn !== 'live' && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-ping" />
              <span>You are currently {conn}. Edits are preserved in form and saving will be enabled once live.</span>
            </div>
          )}

          {/* Title */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task title"
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-sm text-gray-900 focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none transition"
            />
          </div>

          {/* Status & Assignee Row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-800 focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none bg-white transition"
              >
                <option value="todo">To do</option>
                <option value="in_progress">In progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-xl border border-gray-300 px-3 py-2 text-xs font-medium text-gray-800 focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none bg-white transition"
              >
                <option value="">Unassigned</option>
                {Object.values(profiles).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Due Date
            </label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2 text-xs font-medium text-gray-800 focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none bg-white transition"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 uppercase tracking-wider mb-1.5">
              Description
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add details, acceptance criteria, or notes..."
              className="w-full rounded-xl border border-gray-300 px-3.5 py-2.5 text-xs text-gray-900 focus:border-green-600 focus:ring-1 focus:ring-green-600 outline-none transition resize-none leading-relaxed"
            />
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-gray-200 px-6 py-4 flex items-center justify-end gap-3 bg-gray-50/50">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || conn !== 'live'}
            className="inline-flex items-center gap-2 rounded-xl bg-green-700 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-green-800 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <div className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                <span>Saving...</span>
              </>
            ) : (
              <span>Save changes</span>
            )}
          </button>
        </div>
      </aside>

      {/* Conflict Resolution Modal */}
      <ConflictDialog
        isOpen={showConflictDialog}
        localTitle={title}
        serverTitle={conflictedTask?.title}
        onTakeTheirs={handleTakeTheirs}
        onKeepMine={handleKeepMine}
      />
    </>
  );
}

export function TaskDrawer({ taskId, projectId, onClose }: TaskDrawerProps) {
  const task = useProjectStore((s) => (taskId ? s.tasks[taskId] : null));

  if (!taskId || !task) return null;

  return (
    <TaskDrawerContent
      key={task.id}
      task={task}
      projectId={projectId}
      onClose={onClose}
    />
  );
}

'use client';

import { useState } from 'react';
import type { Task, TaskStatus } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { updateTaskWithVersion, archiveTask } from '@/lib/mutations';
import { ConflictDialog } from '@/components/board/ConflictDialog';
import { toast } from 'sonner';
import { format, parseISO } from 'date-fns';
import CommentBox from './CommentBox';
import AttachButton from './AttachButton';
import { downloadTaskFile } from '@/lib/files';
import { formatBytes } from '@/lib/time';
import { useMe } from '@/lib/useMe';

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

function TaskDrawerContent({ task, projectId, onClose }: TaskDrawerContentProps) {
  const { me } = useMe();
  const profiles = useProjectStore((s) => s.profiles);
  const conn = useProjectStore((s) => s.conn);
  const online = useProjectStore((s) => s.online);
  const activityList = useProjectStore((s) => s.activity);
  const conflicts = useProjectStore((s) => s.conflicts);
  const setConflict = useProjectStore((s) => s.setConflict);
  const clearConflict = useProjectStore((s) => s.clearConflict);

  // Form states initialized directly from task
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description || '');
  const [status, setStatus] = useState<TaskStatus>(task.status);
  const [assigneeId, setAssigneeId] = useState<string>(task.assignee_id || '');
  const [dueDate, setDueDate] = useState<string>(task.due_date || '');
  const [baseVersion, setBaseVersion] = useState<number>(task.version);
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);

  // Active conflict state
  const activeConflict = conflicts[task.id];
  const [showConflictDialog, setShowConflictDialog] = useState(Boolean(activeConflict));
  const [conflictedTask, setConflictedTask] = useState<Task | null>(
    activeConflict?.serverTask || null
  );
  const [pendingPatch, setPendingPatch] = useState<Partial<Task> | null>(
    activeConflict?.localPatch || null
  );

  // Collaborators currently viewing this task
  const taskViewers = online.filter((u) => u.task_id === task.id);

  // Filter real-time activity for this specific task
  const taskActivities = activityList
    .filter((a) => a.task_id === task.id)
    .sort((a, b) => b.id - a.id);

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
      clearConflict(task.id);
      toast.success('Task committed successfully.');
    } else if (result.status === 'conflict') {
      setConflictedTask(result.latestTask);
      setPendingPatch(patch);
      if (result.latestTask) {
        setConflict({
          taskId: task.id,
          localVersion: baseVersion,
          serverVersion: result.latestTask.version,
          localPatch: patch,
          serverTask: result.latestTask,
          detectedAt: new Date().toISOString(),
        });
      }
      setShowConflictDialog(true);
      toast.warning('Edit conflict: Another collaborator updated this task.');
    } else {
      toast.error(result.message);
    }
  }

  // Conflict Resolution: Take theirs
  function handleTakeTheirs() {
    const target = conflictedTask || activeConflict?.serverTask;
    if (target) {
      setTitle(target.title);
      setDescription(target.description || '');
      setStatus(target.status);
      setAssigneeId(target.assignee_id || '');
      setDueDate(target.due_date || '');
      setBaseVersion(target.version);
    }
    clearConflict(task.id);
    setShowConflictDialog(false);
    setConflictedTask(null);
    setPendingPatch(null);
    toast.info('Discarded local buffer and adopted latest server version.');
  }

  // Conflict Resolution: Keep mine
  async function handleKeepMine() {
    const target = conflictedTask || activeConflict?.serverTask;
    const patchToApply = pendingPatch || activeConflict?.localPatch;
    if (!target || !patchToApply) return;

    setSaving(true);
    const result = await updateTaskWithVersion({
      taskId: task.id,
      expectedVersion: target.version,
      patch: patchToApply,
    });
    setSaving(false);

    if (result.status === 'success') {
      setBaseVersion(result.task.version);
      clearConflict(task.id);
      setShowConflictDialog(false);
      setConflictedTask(null);
      setPendingPatch(null);
      toast.success('Task overwritten with your version.');
    } else if (result.status === 'conflict') {
      setConflictedTask(result.latestTask);
      toast.warning('Another update occurred concurrently. Please review.');
    } else {
      toast.error(result.message);
    }
  }

  // Archive task with optimistic concurrency & conflict preservation
  async function handleArchive() {
    if (!task) return;
    if (conn !== 'live') {
      toast.error('Cannot archive task while offline or reconnecting.');
      return;
    }

    setArchiving(true);
    const result = await archiveTask(task.id, baseVersion);
    setArchiving(false);

    if (result.status === 'success') {
      clearConflict(task.id);
      toast.success('Task archived.');
      onClose();
    } else if (result.status === 'conflict') {
      setConflictedTask(result.latestTask);
      setPendingPatch({ archived: true });
      setShowConflictDialog(true);
      toast.warning('Edit conflict: Another collaborator updated this task.');
    } else {
      toast.error(result.message || 'Failed to archive task.');
    }
  }

  const taskCode = `TSK-${task.id.slice(0, 4).toUpperCase()}`;

  return (
    <>
      {/* Semi-transparent Backdrop for mobile/tablet */}
      <div
        className="fixed inset-0 z-40 bg-slate-900/20 backdrop-blur-2xs transition-opacity lg:bg-transparent lg:pointer-events-none"
        onClick={onClose}
      />

      {/* Responsive Inspector Drawer Panel */}
      <aside className="fixed inset-y-0 right-0 z-40 flex w-full sm:max-w-md lg:max-w-lg flex-col bg-white shadow-2xl border-l border-slate-200 animate-in slide-in-from-right duration-200 pointer-events-auto">
        {/* Inspector Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5 bg-slate-50/80">
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
              {taskCode}
            </span>
            <span className="font-mono text-[10px] text-slate-500 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">
              REV {baseVersion}
            </span>
            {activeConflict && (
              <span className="inline-flex items-center gap-1 font-mono text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-300 px-1.5 py-0.5 rounded">
                ! CONFLICT
              </span>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            {/* Real-time viewers indicator */}
            {taskViewers.length > 0 && (
              <div
                className="flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[11px] font-mono text-emerald-700"
                title={`Active viewers: ${taskViewers.map((v) => v.name).join(', ')}`}
              >
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>{taskViewers.length} viewing</span>
              </div>
            )}

            <button
              type="button"
              onClick={onClose}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 bg-white text-slate-500 hover:bg-slate-100 hover:text-slate-800 transition"
              title="Close inspector (Esc)"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Drawer Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 font-sans text-xs">
          {/* Active Conflict Alert Banner */}
          {activeConflict && (
            <div className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-rose-800 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-600 animate-ping" />
                  <span>Concurrent Version Collision (HTTP 409)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowConflictDialog(true)}
                  className="rounded bg-rose-600 px-2 py-0.5 text-[11px] font-medium text-white hover:bg-rose-700 transition"
                >
                  View Diff
                </button>
              </div>
              <p className="text-[11px] text-rose-700 leading-normal">
                This task was modified on the server while you held an older revision. Resolve the conflict below to persist your updates.
              </p>
            </div>
          )}

          {/* Offline Warning Banner */}
          {conn !== 'live' && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-800 flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
              <span className="font-mono text-[11px]">System offline: Changes will be buffered locally.</span>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
              Task Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Task summary or issue title"
              className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
            />
          </div>

          {/* Status & Assignee Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
                Workflow Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TaskStatus)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="todo">Backlog / To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">In Review</option>
                <option value="done">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
                Assignee
              </label>
              <select
                value={assigneeId}
                onChange={(e) => setAssigneeId(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              >
                <option value="">[Unassigned]</option>
                {Object.values(profiles).map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Due Date & Branch Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
                Target Due Date
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition"
              />
            </div>

            <div>
              <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
                Git Branch Ref
              </label>
              <div className="flex items-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 font-mono text-[11px] text-slate-700">
                <svg className="w-3.5 h-3.5 text-slate-400" viewBox="0 0 16 16" fill="currentColor">
                  <path fillRule="evenodd" d="M11.75 2.5a.75.75 0 100 1.5.75.75 0 000-1.5zm-2.25.75a2.25 2.25 0 113 2.122V6A2.5 2.5 0 0110 8.5H6a1 1 0 00-1 1v1.128a2.251 2.251 0 11-1.5 0V5.372a2.25 2.25 0 111.5 0v1.836A2.492 2.492 0 016 7h4a1 1 0 001-1v-.628A2.25 2.25 0 019.5 3.25zM4.25 12a.75.75 0 100 1.5.75.75 0 000-1.5zM3.5 3.25a.75.75 0 111.5 0 .75.75 0 01-1.5 0z" />
                </svg>
                <span className="truncate">feat/{task.id.slice(0, 6)}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-[11px] font-mono font-medium text-slate-500 uppercase tracking-wider mb-1">
              Specification & Implementation Notes
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={5}
              placeholder="Add technical context, acceptance criteria, or branch notes..."
              className="w-full rounded-md border border-slate-300 bg-white p-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 outline-none transition resize-none leading-relaxed"
            />
          </div>

          {/* Real-time Activity History Stream for this task */}
          <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-3 space-y-2">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-1.5">
              <span className="font-mono text-[11px] font-semibold text-slate-700">
                Audit Trail & Activity
              </span>
              <span className="font-mono text-[10px] text-slate-400">
                {taskActivities.length} events
              </span>
            </div>

            {taskActivities.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic py-1">
                No recent activity recorded for this task.
              </p>
            ) : (
              <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
                {taskActivities.slice(0, 6).map((item) => {
                  const actor = item.actor_id ? profiles[item.actor_id] : null;
                  const dateStr = item.created_at
                    ? (() => {
                        try {
                          return format(parseISO(item.created_at), 'MMM dd HH:mm');
                        } catch {
                          return item.created_at.slice(11, 16);
                        }
                      })()
                    : '';

                  return (
                    <div key={item.id} className="flex items-start gap-2 text-[11px] text-slate-600">
                      <span
                        className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-white mt-0.5"
                        style={{ backgroundColor: actor?.color || '#64748b' }}
                      >
                        {actor?.name?.charAt(0).toUpperCase() || 'S'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <span className="font-semibold text-slate-800 mr-1">
                          {actor?.name || 'Collaborator'}
                        </span>
                        <span>
                          {item.type === 'task_created' && 'created this task'}
                          {item.type === 'status_changed' &&
                            `changed status to ${(item.payload as any)?.to || 'new'}`}
                          {item.type === 'assignee_changed' && 'reassigned task'}
                          {item.type === 'due_changed' && 'updated due date'}
                          {item.type === 'comment_added' && 'commented'}
                          {item.type === 'file_added' && 'attached a file'}
                        </span>
                        <div className="text-[9px] text-slate-400 font-mono mt-0.5">
                          {dateStr}
                        </div>

                        {item.type === 'comment_added' && (
                          <div className="mt-1.5 rounded-md bg-white border border-slate-200 p-2 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed shadow-2xs">
                            {(item.payload as any)?.body}
                          </div>
                        )}

                        {item.type === 'file_added' && (
                          <div className="mt-1.5 flex items-center justify-between rounded-md bg-white border border-slate-200 px-2.5 py-1.5 text-xs shadow-2xs">
                            <span className="truncate max-w-[180px] font-medium text-slate-700">
                              📎 {(item.payload as any)?.file_name}
                              {(item.payload as any)?.size
                                ? ` (${formatBytes((item.payload as any).size)})`
                                : ''}
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                downloadTaskFile(
                                  (item.payload as any)?.path,
                                  (item.payload as any)?.file_name || 'download'
                                )
                              }
                              className="text-[11px] font-semibold text-blue-600 hover:text-blue-800 hover:underline cursor-pointer"
                            >
                              Download
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Comment Box & Attach Button */}
            <div className="border-t border-slate-200/80 pt-2.5 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                  Post Comment
                </span>
                <AttachButton projectId={projectId} taskId={task.id} />
              </div>
              <CommentBox taskId={task.id} projectId={projectId} me={me} />
            </div>
          </div>

          {/* Metadata Strip */}
          <div className="border border-slate-200 rounded-lg bg-slate-50 p-2.5 text-[10px] font-mono text-slate-500 space-y-1">
            <div className="flex justify-between">
              <span>CREATED:</span>
              <span className="text-slate-700 font-medium">
                {task.created_at ? task.created_at.slice(0, 19).replace('T', ' ') : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>LAST_COMMITTED:</span>
              <span className="text-slate-700 font-medium">
                {task.updated_at ? task.updated_at.slice(0, 19).replace('T', ' ') : '--'}
              </span>
            </div>
            <div className="flex justify-between">
              <span>ROW_UUID:</span>
              <span className="text-slate-600 truncate max-w-[180px]">{task.id}</span>
            </div>
          </div>
        </div>

        {/* Drawer Footer Actions */}
        <div className="border-t border-slate-200 px-5 py-3.5 flex items-center justify-between gap-3 bg-white">
          {/* Left: Archive / Delete */}
          <div>
            {confirmArchive ? (
              <div className="flex items-center gap-1.5 animate-in fade-in duration-150">
                <button
                  type="button"
                  onClick={handleArchive}
                  disabled={archiving || saving || conn !== 'live'}
                  className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 transition disabled:opacity-50"
                >
                  {archiving ? 'Archiving...' : 'Confirm Archive'}
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmArchive(false)}
                  disabled={archiving}
                  className="rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-100 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmArchive(true)}
                disabled={archiving || saving || conn !== 'live'}
                className="text-xs text-rose-600 hover:text-rose-800 hover:underline transition disabled:opacity-50 font-medium"
              >
                Archive Task
              </button>
            )}
          </div>

          {/* Right: Dismiss & Commit Changes */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 transition"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving || archiving || conn !== 'live'}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition shadow-xs"
            >
              {saving ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  <span>Committing...</span>
                </>
              ) : (
                <span>Commit Changes</span>
              )}
            </button>
          </div>
        </div>
      </aside>

      {/* Concurrent Version Conflict Dialog */}
      <ConflictDialog
        isOpen={showConflictDialog}
        localTitle={title}
        serverTitle={conflictedTask?.title || activeConflict?.serverTask.title}
        localVersion={baseVersion}
        serverVersion={conflictedTask?.version || activeConflict?.serverTask.version}
        localDescription={description}
        serverDescription={conflictedTask?.description ?? activeConflict?.serverTask.description}
        localStatus={status}
        serverStatus={conflictedTask?.status || activeConflict?.serverTask.status}
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

export default TaskDrawer;

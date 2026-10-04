import { supabase } from '@/lib/supabase';
import { useProjectStore } from './store';
import type { Task, TaskStatus } from './types';
import { toast } from 'sonner';

export interface MoveTaskParams {
  taskId: string;
  projectId: string;
  destinationStatus: TaskStatus;
  newPosition: number;
}

export interface CreateTaskParams {
  projectId: string;
  title: string;
  status?: TaskStatus;
  position?: number;
  description?: string;
  assigneeId?: string | null;
  dueDate?: string | null;
}

export type UpdateTaskResult =
  | { status: 'success'; task: Task }
  | { status: 'conflict'; latestTask: Task | null }
  | { status: 'error'; message: string };

export interface UpdateTaskWithVersionParams {
  taskId: string;
  expectedVersion: number;
  patch: Partial<
    Pick<
      Task,
      'title' | 'description' | 'status' | 'assignee_id' | 'due_date' | 'archived'
    >
  >;
}

/**
 * Optimistically moves a task to a new status and float position.
 * Reverts if Supabase write fails, ensuring no overwrite of newer realtime state.
 */
export async function moveTask({
  taskId,
  projectId,
  destinationStatus,
  newPosition,
}: MoveTaskParams): Promise<{ success: boolean; error?: string }> {
  const store = useProjectStore.getState();

  // 1. Refuse writes if connection is not live
  if (store.conn !== 'live') {
    const msg = 'Cannot move task while offline or reconnecting.';
    toast.error(msg);
    return { success: false, error: msg };
  }

  // 2. Locate existing task
  const currentTask = store.tasks[taskId];
  if (!currentTask) {
    const msg = 'Task not found in store.';
    toast.error(msg);
    return { success: false, error: msg };
  }

  // Keep snapshot for rollback
  const previousStatus = currentTask.status;
  const previousPosition = currentTask.position;
  const previousUpdatedAt = currentTask.updated_at;

  // 3. Apply optimistic update
  const optimisticUpdatedAt = new Date().toISOString();
  const optimisticTask: Task = {
    ...currentTask,
    status: destinationStatus,
    position: newPosition,
    updated_at: optimisticUpdatedAt,
  };
  store.upsertTask(optimisticTask);

  // 4. Persist to Supabase
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({
        status: destinationStatus,
        position: newPosition,
      })
      .eq('id', taskId)
      .eq('project_id', projectId)
      .select()
      .maybeSingle();

    if (error) {
      toast.error(`Failed to move task: ${error.message}`);
      // Rollback only if the task has not been superseded by a newer realtime update
      const latestInStore = useProjectStore.getState().tasks[taskId];
      if (latestInStore && latestInStore.updated_at === optimisticUpdatedAt) {
        store.upsertTask({
          ...latestInStore,
          status: previousStatus,
          position: previousPosition,
          updated_at: previousUpdatedAt,
        });
      }
      return { success: false, error: error.message };
    }

    if (data) {
      useProjectStore.getState().upsertTask(data as Task);
    }
    return { success: true };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unexpected error moving task';
    toast.error(errorMsg);

    const latestInStore = useProjectStore.getState().tasks[taskId];
    if (latestInStore && latestInStore.updated_at === optimisticUpdatedAt) {
      store.upsertTask({
        ...latestInStore,
        status: previousStatus,
        position: previousPosition,
        updated_at: previousUpdatedAt,
      });
    }
    return { success: false, error: errorMsg };
  }
}

/**
 * Creates a new task in the specified project.
 * Automatically calculates a bottom position if none is provided.
 */
export async function createTask(
  params: CreateTaskParams
): Promise<{ success: boolean; task?: Task; error?: string }> {
  const store = useProjectStore.getState();

  // 1. Refuse writes if connection is not live
  if (store.conn !== 'live') {
    const msg = 'Cannot create task while offline or reconnecting.';
    toast.error(msg);
    return { success: false, error: msg };
  }

  const targetStatus = params.status ?? 'todo';

  // 2. Position calculation: if not given, default to max position in column + 1000
  let taskPosition = params.position;
  if (taskPosition === undefined) {
    const columnTasks = Object.values(store.tasks).filter(
      (t) =>
        t.project_id === params.projectId &&
        t.status === targetStatus &&
        !t.archived
    );
    if (columnTasks.length === 0) {
      taskPosition = 1000;
    } else {
      const maxPos = Math.max(...columnTasks.map((t) => t.position));
      taskPosition = maxPos + 1000;
    }
  }

  // 3. Persist to Supabase
  try {
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        project_id: params.projectId,
        title: params.title.trim(),
        status: targetStatus,
        position: taskPosition,
        description: params.description ?? '',
        assignee_id: params.assigneeId ?? null,
        due_date: params.dueDate ?? null,
      })
      .select()
      .single();

    if (error) {
      toast.error(`Failed to create task: ${error.message}`);
      return { success: false, error: error.message };
    }

    if (data) {
      useProjectStore.getState().upsertTask(data as Task);
      return { success: true, task: data as Task };
    }

    return { success: false, error: 'No task data returned from database.' };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unexpected error creating task';
    toast.error(errorMsg);
    return { success: false, error: errorMsg };
  }
}

/**
 * Updates editable task fields using optimistic concurrency control (version checking).
 * Detects whether another collaborator edited first and returns conflict status.
 */
export async function updateTaskWithVersion({
  taskId,
  expectedVersion,
  patch,
}: UpdateTaskWithVersionParams): Promise<UpdateTaskResult> {
  const store = useProjectStore.getState();

  // 1. Refuse writes if connection is not live
  if (store.conn !== 'live') {
    const msg = 'Cannot save edits while offline or reconnecting.';
    toast.error(msg);
    return { status: 'error', message: msg };
  }

  try {
    // 2. Perform version-checked update
    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', taskId)
      .eq('version', expectedVersion)
      .select()
      .maybeSingle();

    if (error) {
      toast.error(`Save failed: ${error.message}`);
      return { status: 'error', message: error.message };
    }

    // 3. Conflict detection: row exists but version did not match
    if (!data) {
      // Fetch latest row to populate conflict state in store
      const { data: latest } = await supabase
        .from('tasks')
        .select('*')
        .eq('id', taskId)
        .maybeSingle();

      if (latest) {
        useProjectStore.getState().upsertTask(latest as Task);
      }

      return {
        status: 'conflict',
        latestTask: (latest as Task) || null,
      };
    }

    // 4. Update store with newly saved row
    useProjectStore.getState().upsertTask(data as Task);
    return {
      status: 'success',
      task: data as Task,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : 'Unexpected error saving task';
    toast.error(errorMsg);
    return { status: 'error', message: errorMsg };
  }
}

/**
 * Soft deletes (archives) a task with version check.
 */
export async function archiveTask(
  taskId: string,
  expectedVersion: number
): Promise<UpdateTaskResult> {
  return updateTaskWithVersion({
    taskId,
    expectedVersion,
    patch: { archived: true },
  });
}

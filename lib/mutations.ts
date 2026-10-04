// TEMP STUB: Member A's version replaces this on merge
import type { Task } from '@/lib/types';

export class ConflictError extends Error {
  latest: Task;
  mine: Partial<Task>;
  constructor(latest: Task, mine: Partial<Task>) {
    super('Conflict');
    this.name = 'ConflictError';
    this.latest = latest;
    this.mine = mine;
  }
}

export async function editTask(
  task: Task,
  patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'assignee_id' | 'due_date'>>
): Promise<void> {
  // Stub — real version is from Member A
  console.warn('editTask stub called', task.id, patch);
}

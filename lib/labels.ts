import type { TaskStatus } from '@/lib/types';

export const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'review', 'done'];

export const STATUS_LABELS: Record<TaskStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  review: 'Review',
  done: 'Done',
};

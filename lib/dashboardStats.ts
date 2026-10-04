import { addDays, format, parse } from 'date-fns';
import type { Task, Profile } from './types';

export function openTasks(tasks: Task[]): Task[] {
  return tasks.filter((t) => !t.archived && t.status !== 'done');
}

export function overdueTasks(tasks: Task[], today: string): Task[] {
  return openTasks(tasks)
    .filter((t) => t.due_date !== null && t.due_date < today)
    .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1));
}

export function atRiskTasks(tasks: Task[], today: string): Task[] {
  const todayDate = parse(today, 'yyyy-MM-dd', new Date());
  const in2DaysStr = format(addDays(todayDate, 2), 'yyyy-MM-dd');

  return openTasks(tasks)
    .filter(
      (t) =>
        t.status === 'todo' &&
        t.due_date !== null &&
        t.due_date >= today &&
        t.due_date <= in2DaysStr
    )
    .sort((a, b) => (a.due_date! > b.due_date! ? 1 : -1));
}

export function completionPercent(tasks: Task[]): number {
  const active = tasks.filter((t) => !t.archived);
  if (active.length === 0) return 0;
  const done = active.filter((t) => t.status === 'done').length;
  return Math.round((done / active.length) * 100);
}

export function workloadByMember(
  tasks: Task[],
  profiles: Record<string, Profile>
): { id: string; name: string; color: string; count: number }[] {
  const open = openTasks(tasks);
  const counts: Record<string, number> = {};

  for (const t of open) {
    const key = t.assignee_id ?? 'unassigned';
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const result = Object.entries(counts).map(([key, count]) => {
    if (key === 'unassigned') {
      return {
        id: 'unassigned',
        name: 'Unassigned',
        color: '#9ca3af',
        count,
      };
    }
    const profile = profiles[key];
    return {
      id: key,
      name: profile?.name ?? 'Someone',
      color: profile?.color ?? '#6366f1',
      count,
    };
  });

  return result.sort((a, b) => b.count - a.count);
}

export function progressByProject(
  tasks: Task[],
  projects: { id: string; name: string }[]
): { id: string; name: string; done: number; total: number; percent: number }[] {
  return projects.map((p) => {
    const projectTasks = tasks.filter(
      (t) => !t.archived && t.project_id === p.id
    );
    const total = projectTasks.length;
    const done = projectTasks.filter((t) => t.status === 'done').length;
    const percent = total === 0 ? 0 : Math.round((done / total) * 100);
    return {
      id: p.id,
      name: p.name,
      done,
      total,
      percent,
    };
  });
}

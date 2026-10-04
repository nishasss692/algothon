import type { Activity, Profile } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/labels';
import { formatDue } from '@/lib/time';

function actorName(actorId: string | null, profiles: Record<string, Profile>): string {
  if (!actorId) return 'Someone';
  return profiles[actorId]?.name ?? 'Someone';
}

export function describeActivity(activity: Activity, profiles: Record<string, Profile>): string {
  const actor = actorName(activity.actor_id, profiles);
  const p = activity.payload as Record<string, string | null>;

  switch (activity.type) {
    case 'task_created':
      return `${actor} created this task`;

    case 'status_changed': {
      const from = STATUS_LABELS[p.from as keyof typeof STATUS_LABELS] ?? p.from;
      const to = STATUS_LABELS[p.to as keyof typeof STATUS_LABELS] ?? p.to;
      return `${actor} moved this from ${from} to ${to}`;
    }

    case 'assignee_changed':
      if (!p.to) return `${actor} unassigned this task`;
      return `${actor} assigned this to ${profiles[p.to]?.name ?? 'someone'}`;

    case 'due_changed': {
      const fromStr = p.from ? formatDue(p.from) : null;
      const toStr = p.to ? formatDue(p.to) : null;
      if (!toStr) return `${actor} removed the due date`;
      if (!fromStr) return `${actor} set the due date to ${toStr}`;
      return `${actor} changed the due date from ${fromStr} to ${toStr}`;
    }

    default:
      return '';
  }
}

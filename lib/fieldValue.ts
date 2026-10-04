import type { Profile } from '@/lib/types';
import { STATUS_LABELS } from '@/lib/labels';
import { formatDue } from '@/lib/time';

export function formatFieldValue(
  field: string,
  value: unknown,
  profiles: Record<string, Profile>
): string {
  if (field === 'status') {
    return STATUS_LABELS[value as keyof typeof STATUS_LABELS] ?? String(value);
  }
  if (field === 'assignee_id') {
    if (!value) return 'Unassigned';
    return profiles[value as string]?.name ?? 'Unknown';
  }
  if (field === 'due_date') {
    if (!value) return 'No due date';
    return formatDue(value as string);
  }
  // title / description
  const str = String(value ?? '').trim();
  return str || 'Empty';
}

import { formatDistanceToNowStrict, format, parse } from 'date-fns';

export function timeAgo(iso: string): string {
  return formatDistanceToNowStrict(new Date(iso), { addSuffix: true });
}

export function formatDue(dateStr: string): string {
  const d = parse(dateStr, 'yyyy-MM-dd', new Date());
  return format(d, 'MMM d');
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
}

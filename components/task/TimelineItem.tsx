'use client';

import type { Activity, Profile } from '@/lib/types';
import { timeAgo, formatBytes } from '@/lib/time';
import { describeActivity } from '@/lib/activityText';
import { downloadTaskFile } from '@/lib/files';
import Avatar from '@/components/ui/Avatar';

interface TimelineItemProps {
  activity: Activity;
  profiles: Record<string, Profile>;
  meId: string | null;
}

export default function TimelineItem({ activity, profiles, meId }: TimelineItemProps) {
  const actor = activity.actor_id ? profiles[activity.actor_id] : null;
  const actorName = actor?.name ?? 'Someone';
  const actorColor = actor?.color ?? '#9ca3af';
  const ago = timeAgo(activity.created_at);
  const fullDate = new Date(activity.created_at).toLocaleString();
  const isMe = meId && activity.actor_id === meId;

  if (activity.type === 'comment_added') {
    const body = String((activity.payload as Record<string, unknown>).body ?? '');
    return (
      <div style={{ display: 'flex', gap: 10, padding: '8px 0', alignItems: 'flex-start' }}>
        <Avatar name={actorName} color={actorColor} size={28} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
            <span style={{ fontWeight: 600, fontSize: 13 }}>{actorName}</span>
            <span title={fullDate} style={{ fontSize: 11, color: '#9ca3af', cursor: 'default' }}>{ago}</span>
          </div>
          <div
            style={{
              background: isMe ? '#ede9fe' : '#f3f4f6',
              borderRadius: 8,
              padding: '8px 12px',
              fontSize: 14,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {body}
          </div>
        </div>
      </div>
    );
  }

  if (activity.type === 'file_added') {
    const p = activity.payload as Record<string, unknown>;
    const fileName = String(p.file_name ?? '');
    const filePath = String(p.path ?? '');
    const size = Number(p.size ?? 0);
    return (
      <div style={{ display: 'flex', gap: 10, padding: '6px 0', alignItems: 'center' }}>
        <Avatar name={actorName} color={actorColor} size={28} />
        <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, background: '#f3f4f6', borderRadius: 8, padding: '6px 12px' }}>
          <span style={{ fontSize: 16 }}>📎</span>
          <span title={fileName} style={{ fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 160 }}>{fileName}</span>
          <span style={{ fontSize: 11, color: '#9ca3af' }}>{formatBytes(size)}</span>
          <DownloadButton path={filePath} fileName={fileName} />
        </div>
        <span title={fullDate} style={{ fontSize: 11, color: '#9ca3af', cursor: 'default', whiteSpace: 'nowrap' }}>{ago}</span>
      </div>
    );
  }

  // System event
  const text = describeActivity(activity, profiles);
  if (!text) return null;
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '4px 0' }}>
      <span style={{ fontSize: 12, color: '#9ca3af' }}>
        {text} · <span title={fullDate}>{ago}</span>
      </span>
    </div>
  );
}

function DownloadButton({ path, fileName }: { path: string; fileName: string }) {
  async function handleClick() {
    await downloadTaskFile(path, fileName);
  }

  return (
    <button
      onClick={handleClick}
      aria-label={`Download ${fileName}`}
      style={{
        marginLeft: 'auto',
        fontSize: 12,
        padding: '2px 10px',
        borderRadius: 6,
        border: '1px solid #d1d5db',
        background: '#fff',
        cursor: 'pointer',
      }}
    >
      Download
    </button>
  );
}

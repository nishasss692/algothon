'use client';

import { useProjectStore } from '@/lib/store';
import Avatar from '@/components/ui/Avatar';
import type { PresenceUser } from '@/lib/types';

interface ViewersBarProps {
  taskId: string;
  meId: string;
}

export default function ViewersBar({ taskId, meId }: ViewersBarProps) {
  const online = useProjectStore((s) => s.online);

  const onlineList: PresenceUser[] = Array.isArray(online)
    ? online
    : Object.values(online || {});

  const viewers = onlineList.filter(
    (u) => u && u.task_id === taskId && u.user_id !== meId
  );

  if (viewers.length === 0) return null;

  const text =
    viewers.length === 1
      ? `${viewers[0].name} is also viewing`
      : `${viewers.length} others are viewing`;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 12,
        color: '#6b7280',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {viewers.map((v) => (
          <Avatar key={v.user_id} name={v.name} color={v.color} size={20} />
        ))}
      </div>
      <span>{text}</span>
    </div>
  );
}

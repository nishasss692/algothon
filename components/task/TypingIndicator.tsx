'use client';

import { useProjectStore } from '@/lib/store';

interface TypingIndicatorProps {
  taskId: string;
  meId: string;
}

export default function TypingIndicator({ taskId, meId: _meId }: TypingIndicatorProps) {
  // Store typing is Record<taskId, userName>
  const typing = useProjectStore(s => s.typing);
  const userName = typing[taskId];

  // Reserve one line of height always
  return (
    <div style={{ minHeight: 18, fontSize: 12, color: '#9ca3af', fontStyle: 'italic' }}>
      {userName ? `${userName} is typing...` : ''}
    </div>
  );
}

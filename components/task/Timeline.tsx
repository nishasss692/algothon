'use client';

import { useMemo, useEffect, useRef } from 'react';
import { useProjectStore } from '@/lib/store';
import { useMe } from '@/lib/useMe';
import { useNow } from '@/lib/useNow';
import TimelineItem from './TimelineItem';

interface TimelineProps {
  taskId: string;
}

export default function Timeline({ taskId }: TimelineProps) {
  const activity = useProjectStore(s => s.activity);
  const profiles = useProjectStore(s => s.profiles);
  const { me } = useMe();
  useNow(30000);

  const items = useMemo(
    () => activity.filter(a => a.task_id === taskId),
    [activity, taskId]
  );

  const listRef = useRef<HTMLDivElement>(null);
  const stickToBottom = useRef(true);
  const prevCount = useRef(items.length);

  // Scroll to bottom on mount
  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, []);

  // Scroll to bottom when items change, if sticky or newest is mine
  useEffect(() => {
    if (items.length === prevCount.current) return;
    prevCount.current = items.length;
    const newest = items[items.length - 1];
    const isNewestMine = me && newest && newest.actor_id === me.id;
    if (stickToBottom.current || isNewestMine) {
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }
  }, [items, me]);

  function handleScroll() {
    const el = listRef.current;
    if (!el) return;
    stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
  }

  if (items.length === 0) {
    return (
      <div style={{ padding: '24px 0', textAlign: 'center', color: '#9ca3af', fontSize: 14 }}>
        No activity yet. Start the conversation.
      </div>
    );
  }

  return (
    <div
      ref={listRef}
      onScroll={handleScroll}
      style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8 }}
    >
      {items.map(item => (
        <TimelineItem
          key={item.id}
          activity={item}
          profiles={profiles}
          meId={me?.id ?? null}
        />
      ))}
    </div>
  );
}

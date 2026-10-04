'use client';

import { useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

interface CommentBoxProps {
  taskId: string;
  projectId: string;
  channelRef: React.MutableRefObject<RealtimeChannel | undefined>;
  me: Profile;
}

export default function CommentBox({ taskId, projectId, channelRef, me }: CommentBoxProps) {
  const conn = useProjectStore(s => s.conn);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const lastTypingSend = useRef(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const disabled = conn !== 'live';

  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    setText(e.target.value);
    // Auto grow
    const ta = textareaRef.current;
    if (ta) { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 144) + 'px'; }
    // Typing broadcast
    const now = Date.now();
    if (now - lastTypingSend.current > 1500) {
      lastTypingSend.current = now;
      channelRef.current?.send({ type: 'broadcast', event: 'typing', payload: { task_id: taskId, user_id: me.id } });
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      send();
    }
  }

  async function send() {
    const body = text.trim();
    if (!body || sending || disabled) return;
    setSending(true);
    const { error } = await supabase
      .from('comments')
      .insert({ task_id: taskId, project_id: projectId, body });
    if (error) {
      toast.error(error.message);
      // keep text
    } else {
      setText('');
      if (textareaRef.current) textareaRef.current.style.height = 'auto';
    }
    setSending(false);
  }

  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', padding: '8px 0' }}>
      <textarea
        ref={textareaRef}
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        disabled={disabled || sending}
        placeholder={disabled ? 'Reconnecting...' : 'Write a comment… (Enter to send)'}
        maxLength={2000}
        rows={1}
        style={{
          flex: 1, resize: 'none', overflow: 'hidden', minHeight: 36, maxHeight: 144,
          padding: '8px 12px', border: '1px solid #d1d5db', borderRadius: 8,
          fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box',
        }}
        title={disabled ? 'Reconnecting...' : undefined}
      />
      <button
        onClick={send}
        disabled={disabled || sending || !text.trim()}
        aria-label="Send comment"
        style={{ padding: '8px 16px', background: '#6366f1', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontSize: 14, fontWeight: 600, opacity: (disabled || sending || !text.trim()) ? 0.5 : 1 }}
        title={disabled ? 'Editing is paused while reconnecting' : undefined}
      >
        Send
      </button>
    </div>
  );
}

'use client';

import { useEffect, useRef } from 'react';
import type { Task, Profile } from '@/lib/types';
import { formatFieldValue } from '@/lib/fieldValue';
import { editTask, ConflictError } from '@/lib/mutations';
import { toast } from 'sonner';

interface ConflictState {
  latest: Task;
  mine: Partial<Task>;
}

interface ConflictDialogProps {
  conflict: ConflictState;
  profiles: Record<string, Profile>;
  onClose: () => void;
}

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  description: 'Description',
  status: 'Status',
  assignee_id: 'Assignee',
  due_date: 'Due date',
};

export default function ConflictDialog({ conflict, profiles, onClose }: ConflictDialogProps) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  async function handleKeepMine() {
    try {
      await editTask(conflict.latest, conflict.mine as Parameters<typeof editTask>[1]);
      onClose();
    } catch (err) {
      if (err instanceof ConflictError) {
        // Show dialog again with new conflict — parent handles this via state
        toast.error('Another conflict occurred. Please review again.');
      } else {
        toast.error(err instanceof Error ? err.message : 'Save failed.');
      }
      onClose();
    }
  }

  const fields = Object.keys(conflict.mine) as (keyof Task)[];

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="conflict-title"
        style={{ background: '#fff', borderRadius: 12, padding: 24, width: 440, maxWidth: '90vw', boxShadow: '0 8px 40px rgba(0,0,0,0.2)' }}
      >
        <h2 id="conflict-title" style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700 }}>This task was changed by someone else</h2>
        <p style={{ margin: '0 0 20px', fontSize: 14, color: '#6b7280' }}>Choose which version to keep.</p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {fields.map(field => (
            <div key={field} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 1fr', gap: 8, alignItems: 'start' }}>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', paddingTop: 4 }}>{FIELD_LABELS[field] ?? field}</span>
              <div style={{ background: '#ede9fe', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
                <div style={{ fontSize: 10, color: '#7c3aed', fontWeight: 600, marginBottom: 2 }}>Yours</div>
                {formatFieldValue(field, conflict.mine[field], profiles)}
              </div>
              <div style={{ background: '#f3f4f6', borderRadius: 6, padding: '4px 8px', fontSize: 13 }}>
                <div style={{ fontSize: 10, color: '#6b7280', fontWeight: 600, marginBottom: 2 }}>Latest</div>
                {formatFieldValue(field, conflict.latest[field], profiles)}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 14 }}
          >
            Take theirs
          </button>
          <button
            onClick={handleKeepMine}
            style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
          >
            Keep mine
          </button>
        </div>
      </div>
    </div>
  );
}

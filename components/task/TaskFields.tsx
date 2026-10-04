'use client';

import { useRef, useState, useEffect } from 'react';
import { parse } from 'date-fns';
import type { Task, Profile } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { editTask, ConflictError } from '@/lib/mutations';
import { STATUS_ORDER, STATUS_LABELS } from '@/lib/labels';
import ConflictDialog from './ConflictDialog';
import { toast } from 'sonner';

interface TaskFieldsProps {
  task: Task;
  members: Profile[];
}

type ConflictState = { latest: Task; mine: Partial<Task> } | null;

export default function TaskFields({ task, members }: TaskFieldsProps) {
  const conn = useProjectStore(s => s.conn);
  const profiles = useProjectStore(s => s.profiles);
  const disabled = conn !== 'live';

  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const [saving, setSaving] = useState(false);
  const [conflict, setConflict] = useState<ConflictState>(null);

  const focusedField = useRef<string | null>(null);

  // Sync incoming realtime updates without wiping focused fields
  useEffect(() => {
    if (focusedField.current !== 'title') setTitle(task.title);
    if (focusedField.current !== 'description') setDescription(task.description);
  }, [task.title, task.description]);

  async function save(patch: Partial<Pick<Task, 'title' | 'description' | 'status' | 'assignee_id' | 'due_date'>>) {
    // Check nothing changed
    const key = Object.keys(patch)[0] as keyof typeof patch;
    if (patch[key] === task[key]) return;
    if (saving) return;
    setSaving(true);
    try {
      await editTask(task, patch);
    } catch (err) {
      if (err instanceof ConflictError) {
        const mineRecord = err.mine as unknown as Record<string, unknown>;
        const latestRecord = err.latest as unknown as Record<string, unknown>;
        const allSame = Object.keys(err.mine).every(
          k => mineRecord[k] === latestRecord[k]
        );
        if (!allSame) setConflict({ latest: err.latest, mine: err.mine });
      } else {
        toast.error(`Could not save. ${err instanceof Error ? err.message : ''}`);
        if (key === 'title') setTitle(task.title);
        if (key === 'description') setDescription(task.description);
      }
    } finally {
      setSaving(false);
    }
  }

  function handleTitleBlur() {
    focusedField.current = null;
    const trimmed = title.trim();
    if (!trimmed) {
      setTitle(task.title);
      toast.error("Title can't be empty");
      return;
    }
    save({ title: trimmed });
  }

  return (
    <>
      {conflict && (
        <ConflictDialog
          conflict={conflict}
          profiles={profiles}
          onClose={() => setConflict(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, padding: '12px 0' }}>
        {saving && <span style={{ fontSize: 11, color: '#9ca3af' }}>Saving...</span>}

        {/* Title */}
        <div>
          <label htmlFor="task-title" style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Title</label>
          <input
            id="task-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            onFocus={() => { focusedField.current = 'title'; }}
            onBlur={handleTitleBlur}
            disabled={disabled}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, boxSizing: 'border-box' }}
            title={disabled ? 'Editing is paused while reconnecting' : undefined}
          />
        </div>

        {/* Status */}
        <div>
          <label htmlFor="task-status" style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Status</label>
          <select
            id="task-status"
            value={task.status}
            onChange={e => save({ status: e.target.value as Task['status'] })}
            disabled={disabled}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff' }}
          >
            {STATUS_ORDER.map(s => (
              <option key={s} value={s}>{STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>

        {/* Assignee */}
        <div>
          <label htmlFor="task-assignee" style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Assignee</label>
          <select
            id="task-assignee"
            value={task.assignee_id ?? ''}
            onChange={e => save({ assignee_id: e.target.value || null })}
            disabled={disabled}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, background: '#fff' }}
          >
            <option value="">Unassigned</option>
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>

        {/* Due date */}
        <div>
          <label htmlFor="task-due" style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Due date</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              id="task-due"
              type="date"
              value={task.due_date ?? ''}
              onChange={e => {
                const val = e.target.value || null;
                // Use parse to avoid timezone issues — convert back to yyyy-MM-dd string
                const dateStr = val ? parse(val, 'yyyy-MM-dd', new Date()).toISOString().split('T')[0] : null;
                save({ due_date: dateStr });
              }}
              disabled={disabled}
              style={{ flex: 1, padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14 }}
            />
            {task.due_date && (
              <button
                onClick={() => save({ due_date: null })}
                disabled={disabled}
                style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12 }}
              >
                Clear
              </button>
            )}
          </div>
        </div>

        {/* Description */}
        <div>
          <label htmlFor="task-desc" style={{ fontSize: 12, fontWeight: 600, color: '#374151', display: 'block', marginBottom: 4 }}>Description</label>
          <textarea
            id="task-desc"
            value={description}
            rows={4}
            onChange={e => setDescription(e.target.value)}
            onFocus={() => { focusedField.current = 'description'; }}
            onBlur={() => { focusedField.current = null; save({ description }); }}
            disabled={disabled}
            style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 8, fontSize: 14, resize: 'vertical', boxSizing: 'border-box' }}
            title={disabled ? 'Editing is paused while reconnecting' : undefined}
          />
        </div>
      </div>
    </>
  );
}

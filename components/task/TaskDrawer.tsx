'use client';

import { useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Profile } from '@/lib/types';
import { useProjectStore } from '@/lib/store';
import { useProjectMembers } from '@/lib/useProjectMembers';
import { useDropZone } from '@/lib/useDropZone';
import TaskFields from './TaskFields';
import Timeline from './Timeline';
import CommentBox from './CommentBox';
import TypingIndicator from './TypingIndicator';
import ViewersBar from './ViewersBar';
import AttachButton, { type AttachButtonHandle } from './AttachButton';
import Skeleton from '@/components/ui/Skeleton';
import EmptyState from '@/components/ui/EmptyState';

export interface TaskDrawerProps {
  projectId: string;
  taskId: string;
  me: Profile;
  channelRef: React.MutableRefObject<RealtimeChannel | undefined>;
  onClose: () => void;
}

export default function TaskDrawer({
  projectId,
  taskId,
  me,
  channelRef,
  onClose,
}: TaskDrawerProps) {
  const task = useProjectStore((s) => s.tasks[taskId]);
  const conn = useProjectStore((s) => s.conn);
  const { members } = useProjectMembers(projectId);

  const attachRef = useRef<AttachButtonHandle>(null);
  const [uploadingChips, setUploadingChips] = useState<string[]>([]);

  const { isDragging, dropProps } = useDropZone((files) => {
    attachRef.current?.handleFiles(files);
  });

  // Presence tracking: announce when live, clear when unmounting/changing
  useEffect(() => {
    if (conn === 'live') {
      channelRef.current?.track({
        user_id: me.id,
        name: me.name,
        color: me.color,
        task_id: taskId,
      });
    }

    return () => {
      channelRef.current?.track({
        user_id: me.id,
        name: me.name,
        color: me.color,
        task_id: null,
      });
    };
  }, [taskId, conn, me, channelRef]);

  // Escape to close unless a dialog/modal is open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        const dialogOpen = document.querySelector('[role="dialog"][aria-modal="true"]');
        if (dialogOpen) return;
        onClose();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <div className="task-drawer-panel" {...dropProps}>
      <style>{`
        .task-drawer-panel {
          position: fixed;
          top: 0;
          right: 0;
          width: 480px;
          height: 100vh;
          background: #ffffff;
          box-shadow: -4px 0 24px rgba(0, 0, 0, 0.15);
          z-index: 50;
          display: flex;
          flex-direction: column;
          animation: slideInRight 150ms cubic-bezier(0.16, 1, 0.3, 1);
          box-sizing: border-box;
        }
        @media (max-width: 639px) {
          .task-drawer-panel {
            width: 100vw;
          }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>

      {/* Drag overlay */}
      {isDragging && (
        <div
          style={{
            position: 'absolute',
            inset: 8,
            border: '2px dashed #6366f1',
            borderRadius: 12,
            background: 'rgba(238, 242, 255, 0.9)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            color: '#4f46e5',
            fontWeight: 600,
            fontSize: 16,
            pointerEvents: 'none',
          }}
        >
          Drop files to attach
        </div>
      )}

      {/* Reconnecting offline notice */}
      {conn !== 'live' && (
        <div
          style={{
            background: '#fef3c7',
            color: '#92400e',
            padding: '6px 16px',
            fontSize: 12,
            fontWeight: 500,
            textAlign: 'center',
            borderBottom: '1px solid #fde68a',
            flexShrink: 0,
          }}
        >
          Reconnecting. Editing is paused.
        </div>
      )}

      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid #e5e7eb',
          flexShrink: 0,
        }}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close task"
          style={{
            background: 'none',
            border: 'none',
            fontSize: 18,
            cursor: 'pointer',
            padding: '4px 8px',
            borderRadius: 6,
            color: '#4b5563',
          }}
        >
          ✕
        </button>

        <ViewersBar taskId={taskId} meId={me.id} />
      </div>

      {/* Content states */}
      {conn === 'connecting' && !task ? (
        <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          <Skeleton style={{ height: 32, width: '70%' }} />
          <div style={{ display: 'flex', gap: 12 }}>
            <Skeleton style={{ height: 28, width: 90 }} />
            <Skeleton style={{ height: 28, width: 120 }} />
          </div>
          <Skeleton style={{ height: 80, width: '100%' }} />
          <Skeleton style={{ flex: 1, width: '100%' }} />
        </div>
      ) : !task ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EmptyState
            title="Task not found. It may have been archived."
            action={
              <button
                type="button"
                onClick={onClose}
                style={{
                  padding: '6px 14px',
                  background: '#f3f4f6',
                  border: '1px solid #d1d5db',
                  borderRadius: 6,
                  cursor: 'pointer',
                  fontSize: 13,
                }}
              >
                Close
              </button>
            }
          />
        </div>
      ) : (
        <>
          {/* Scrollable area: TaskFields + Timeline */}
          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              padding: '16px 16px 8px 16px',
            }}
          >
            <TaskFields task={task} members={members} />

            <div
              style={{
                fontWeight: 600,
                fontSize: 13,
                color: '#4b5563',
                padding: '16px 0 8px 0',
                borderTop: '1px solid #e5e7eb',
                marginTop: 16,
              }}
            >
              Activity
            </div>

            <div style={{ flex: 1, minHeight: 180, display: 'flex', flexDirection: 'column' }}>
              <Timeline taskId={taskId} />
            </div>
          </div>

          {/* Footer: Typing, uploading chips, attach + comment */}
          <div
            style={{
              padding: '8px 16px 12px 16px',
              borderTop: '1px solid #e5e7eb',
              background: '#ffffff',
              flexShrink: 0,
            }}
          >
            <TypingIndicator taskId={taskId} meId={me.id} />

            {uploadingChips.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, margin: '4px 0' }}>
                {uploadingChips.map((name) => (
                  <span
                    key={name}
                    style={{
                      fontSize: 11,
                      background: '#e0e7ff',
                      color: '#4338ca',
                      padding: '2px 8px',
                      borderRadius: 4,
                    }}
                  >
                    Uploading {name}...
                  </span>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <AttachButton
                ref={attachRef}
                projectId={projectId}
                taskId={taskId}
                onUploadingChange={setUploadingChips}
              />
              <div style={{ flex: 1 }}>
                <CommentBox
                  taskId={taskId}
                  projectId={projectId}
                  channelRef={channelRef}
                  me={me}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

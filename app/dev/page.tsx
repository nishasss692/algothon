// TEMP DEV HARNESS, delete before deploy
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useProjectStore } from '@/lib/store';
import TaskDrawer from '@/components/task/TaskDrawer';
import type { Profile, Task, Activity } from '@/lib/types';

const PROJECT_ID = 'proj-demo';
const TASK_ID = 'task-demo-1';

const mockMe: Profile = {
  id: 'user-aarav',
  name: 'Aarav',
  color: '#6366f1',
};

const mockProfiles: Record<string, Profile> = {
  'user-aarav': mockMe,
  'user-priya': { id: 'user-priya', name: 'Priya', color: '#f43f5e' },
  'user-rohan': { id: 'user-rohan', name: 'Rohan', color: '#10b981' },
};

const mockTasks: Record<string, Task> = {
  [TASK_ID]: {
    id: TASK_ID,
    project_id: PROJECT_ID,
    title: 'Landing page QA & Copy Review',
    description: 'Ensure all CTA buttons trigger correct modals and test responsiveness across mobile/tablet.',
    status: 'in_progress',
    assignee_id: 'user-aarav',
    due_date: '2026-10-10',
    position: 1000,
    version: 1,
    archived: false,
    created_by: 'user-aarav',
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000).toISOString(),
  },
};

const mockActivity: Activity[] = [
  {
    id: 1,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-aarav',
    type: 'task_created',
    payload: { title: 'Landing page QA & Copy Review' },
    created_at: new Date(Date.now() - 3600000 * 12).toISOString(),
  },
  {
    id: 2,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-aarav',
    type: 'status_changed',
    payload: { from: 'todo', to: 'in_progress' },
    created_at: new Date(Date.now() - 3600000 * 6).toISOString(),
  },
  {
    id: 3,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-priya',
    type: 'assignee_changed',
    payload: { to: 'user-aarav' },
    created_at: new Date(Date.now() - 3600000 * 3).toISOString(),
  },
  {
    id: 4,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-aarav',
    type: 'comment_added',
    payload: { body: 'Hero section CTA looks crisp. Checking mobile navigation now.' },
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
  },
  {
    id: 5,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-priya',
    type: 'comment_added',
    payload: { body: 'Remember to verify Safari iOS 17 rendering on the pricing tier cards.' },
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
  {
    id: 6,
    project_id: PROJECT_ID,
    task_id: TASK_ID,
    actor_id: 'user-rohan',
    type: 'file_added',
    payload: { file_name: 'launch-checklist.txt', path: `${PROJECT_ID}/${TASK_ID}/checklist.txt`, size: 24500 },
    created_at: new Date(Date.now() - 1800000).toISOString(),
  },
];

export default function DevPage() {
  const [drawerOpen, setDrawerOpen] = useState(true);
  const conn = useProjectStore((s) => s.conn);

  useEffect(() => {
    useProjectStore.setState({
      tasks: mockTasks,
      profiles: mockProfiles,
      activity: mockActivity,
      conn: 'live',
      online: [
        { user_id: 'user-priya', name: 'Priya', color: '#f43f5e', task_id: TASK_ID },
      ],
      typing: {},
    });
  }, []);

  function toggleConn() {
    useProjectStore.setState({ conn: conn === 'live' ? 'reconnecting' : 'live' });
  }

  function simulatePriyaTyping() {
    useProjectStore.setState({ typing: { [TASK_ID]: 'Priya' } });
    setTimeout(() => {
      useProjectStore.setState({ typing: {} });
    }, 3000);
  }

  function simulateIncomingComment() {
    const newId = Date.now();
    useProjectStore.getState().appendActivity([
      {
        id: newId,
        project_id: PROJECT_ID,
        task_id: TASK_ID,
        actor_id: 'user-priya',
        type: 'comment_added',
        payload: { body: `Live incoming comment from Priya at ${new Date().toLocaleTimeString()}!` },
        created_at: new Date().toISOString(),
      },
    ]);
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f9fafb', padding: '32px 24px' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 700, margin: 0, color: '#111827' }}>
              Member B Test Workbench
            </h1>
            <p style={{ margin: '4px 0 0', color: '#6b7280', fontSize: 14 }}>
              Interactive test harness for TaskDrawer, Comments, Files, and Dashboard.
            </p>
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <Link
              href="/login"
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#ffffff',
                border: '1px solid #d1d5db',
                fontSize: 13,
                fontWeight: 600,
                color: '#374151',
                textDecoration: 'none',
              }}
            >
              Go to /login
            </Link>
            <Link
              href="/dashboard"
              style={{
                padding: '8px 14px',
                borderRadius: 8,
                background: '#6366f1',
                color: '#ffffff',
                fontSize: 13,
                fontWeight: 600,
                textDecoration: 'none',
              }}
            >
              Go to /dashboard
            </Link>
          </div>
        </div>

        {/* Control Panel */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 20,
            marginBottom: 24,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 16px 0', color: '#111827' }}>
            Interactive Controls
          </h2>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            <button
              onClick={() => setDrawerOpen((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                background: drawerOpen ? '#ef4444' : '#10b981',
                color: '#fff',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              {drawerOpen ? 'Close Task Drawer' : 'Open Task Drawer'}
            </button>

            <button
              onClick={toggleConn}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: conn === 'live' ? '#ecfdf5' : '#fffbeb',
                color: conn === 'live' ? '#047857' : '#b45309',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Status: {conn.toUpperCase()} (Click to toggle offline)
            </button>

            <button
              onClick={simulatePriyaTyping}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#f3f4f6',
                color: '#374151',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Simulate Priya Typing
            </button>

            <button
              onClick={simulateIncomingComment}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                border: '1px solid #d1d5db',
                background: '#f3f4f6',
                color: '#374151',
                fontWeight: 600,
                cursor: 'pointer',
                fontSize: 13,
              }}
            >
              Simulate Incoming Realtime Activity
            </button>
          </div>
        </div>

        {/* Feature status guide */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: 12,
            border: '1px solid #e5e7eb',
            padding: 20,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <h2 style={{ fontSize: 16, fontWeight: 600, margin: '0 0 12px 0', color: '#111827' }}>
            What Is Ready To Test:
          </h2>
          <ul style={{ margin: 0, paddingLeft: 20, color: '#4b5563', fontSize: 14, lineHeight: 1.8 }}>
            <li>
              <strong>Task Drawer:</strong> Appears as a 480px side-panel on the right. Hit <code>Esc</code> or click ✕ to close.
            </li>
            <li>
              <strong>Viewers Bar:</strong> Shows Priya is viewing on the top right.
            </li>
            <li>
              <strong>Task Fields:</strong> Edit Title and Description (saves on blur), change Status/Assignee/Due Date.
            </li>
            <li>
              <strong>Timeline:</strong> Shows created, status changes, assignee changes, comments, and file attachments.
            </li>
            <li>
              <strong>Comment Box:</strong> Type a message and hit Enter to post.
            </li>
            <li>
              <strong>File Attachments:</strong> Drag & drop any file onto the drawer to test the drop zone overlay.
            </li>
            <li>
              <strong>Offline Mode:</strong> Click &quot;Status: LIVE&quot; to toggle to Reconnecting and watch the yellow banner appear while inputs disable.
            </li>
          </ul>
        </div>
      </div>

      {/* Render the drawer */}
      {drawerOpen && (
        <TaskDrawer
          projectId={PROJECT_ID}
          taskId={TASK_ID}
          onClose={() => setDrawerOpen(false)}
        />
      )}
    </div>
  );
}

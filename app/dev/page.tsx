// TEMP DEV HARNESS, delete before deploy
'use client';

import { useEffect } from 'react';
import { useProjectStore } from '@/lib/store';
import Timeline from '@/components/task/Timeline';

const PROJECT_ID = 'proj-001';
const TASK_ID = 'task-001';

const mockProfiles = {
  'user-1': { id: 'user-1', name: 'Aarav', color: '#6366f1' },
  'user-2': { id: 'user-2', name: 'Priya', color: '#f43f5e' },
};

const mockTasks = {
  [TASK_ID]: {
    id: TASK_ID, project_id: PROJECT_ID, title: 'Build onboarding flow',
    description: 'Stepper with 3 steps', status: 'in_progress' as const,
    assignee_id: 'user-1', due_date: '2026-10-10', position: 1000,
    version: 2, archived: false, created_by: 'user-1',
    created_at: new Date().toISOString(), updated_at: new Date().toISOString(),
  },
};

const mockActivity = [
  { id: 1, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'task_created' as const, payload: { title: 'Build onboarding flow' }, created_at: new Date(Date.now() - 3600000 * 5).toISOString() },
  { id: 2, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'status_changed' as const, payload: { from: 'todo', to: 'in_progress' }, created_at: new Date(Date.now() - 3600000 * 4).toISOString() },
  { id: 3, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-2', type: 'assignee_changed' as const, payload: { to: 'user-1' }, created_at: new Date(Date.now() - 3600000 * 3).toISOString() },
  { id: 4, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'due_changed' as const, payload: { from: null, to: '2026-10-10' }, created_at: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 5, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: null, type: 'assignee_changed' as const, payload: { to: null }, created_at: new Date(Date.now() - 3600000).toISOString() },
  { id: 6, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'comment_added' as const, payload: { body: 'First pass of the stepper is done.' }, created_at: new Date(Date.now() - 1800000).toISOString() },
  { id: 7, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-2', type: 'comment_added' as const, payload: { body: 'Can we add a skip option on step 2?\n\nAlso — what happens if the user closes the browser mid-flow?' }, created_at: new Date(Date.now() - 900000).toISOString() },
  { id: 8, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'file_added' as const, payload: { file_name: 'launch-checklist.txt', path: 'proj-001/task-001/uuid-launch-checklist.txt', size: 1234 }, created_at: new Date(Date.now() - 300000).toISOString() },
  { id: 9, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-2', type: 'due_changed' as const, payload: { from: '2026-10-10', to: '2026-10-12' }, created_at: new Date(Date.now() - 120000).toISOString() },
  { id: 10, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-1', type: 'status_changed' as const, payload: { from: 'in_progress', to: 'review' }, created_at: new Date(Date.now() - 60000).toISOString() },
  { id: 11, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: 'user-2', type: 'comment_added' as const, payload: { body: 'LookingGoodSoFarThisIsAVeryLongWordWithoutSpacesThatShouldBreakCorrectly' }, created_at: new Date(Date.now() - 30000).toISOString() },
  { id: 12, project_id: PROJECT_ID, task_id: TASK_ID, actor_id: null, type: 'status_changed' as const, payload: { from: 'review', to: 'done' }, created_at: new Date().toISOString() },
];

export default function DevPage() {
  useEffect(() => {
    useProjectStore.setState({
      tasks: mockTasks,
      profiles: mockProfiles,
      activity: mockActivity,
      conn: 'live',
      online: [],
      typing: {},
    });
  }, []);

  return (
    <div style={{ maxWidth: 600, margin: '40px auto', padding: '0 16px' }}>
      <h1 style={{ marginBottom: 16, fontSize: 18 }}>Dev Harness — Timeline</h1>
      <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, height: 500, display: 'flex', flexDirection: 'column' }}>
        <Timeline taskId={TASK_ID} />
      </div>
    </div>
  );
}

// Shared types — single source of truth

export type TaskStatus = 'todo' | 'in_progress' | 'review' | 'done';

export interface Profile {
  id: string;
  name: string;
  color: string;
}

export interface Project {
  id: string;
  name: string;
  join_code: string;
  created_by: string;
  created_at: string;
}

export interface Task {
  id: string;
  project_id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee_id: string | null;
  due_date: string | null; // yyyy-MM-dd string
  position: number;
  version: number;
  archived: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Comment {
  id: string;
  task_id: string;
  project_id: string;
  author_id: string;
  body: string;
  created_at: string;
}

export interface Attachment {
  id: string;
  task_id: string;
  project_id: string;
  uploader_id: string;
  path: string;
  file_name: string;
  size: number;
  created_at: string;
}

export type ActivityType =
  | 'task_created'
  | 'status_changed'
  | 'assignee_changed'
  | 'due_changed'
  | 'comment_added'
  | 'file_added';

export interface Activity {
  id: number;
  project_id: string;
  task_id: string | null;
  actor_id: string | null;
  type: ActivityType;
  payload: Record<string, unknown>;
  created_at: string;
}

export type ConnStatus = 'connecting' | 'live' | 'reconnecting';

export interface PresenceUser {
  user_id: string;
  name: string;
  color: string;
  task_id: string | null;
}

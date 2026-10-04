import { create } from 'zustand';
import type { Task, Activity, Profile, ConnStatus, PresenceUser } from './types';

interface ProjectStore {
  tasks: Record<string, Task>;
  activity: Activity[];
  profiles: Record<string, Profile>;
  online: PresenceUser[];
  typing: Record<string, string>; // task_id -> user name
  conn: ConnStatus;

  upsertTask: (task: Task) => void;
  removeTask: (id: string) => void;
  setTasks: (tasks: Task[]) => void;
  appendActivity: (items: Activity[]) => void;
  setProfiles: (profiles: Profile[]) => void;
  setOnline: (users: PresenceUser[]) => void;
  setTyping: (taskId: string, userName: string | null) => void;
  setConn: (status: ConnStatus) => void;
  reset: () => void;
}

const initialState = {
  tasks: {},
  activity: [],
  profiles: {},
  online: [],
  typing: {},
  conn: 'connecting' as ConnStatus,
};

export const useProjectStore = create<ProjectStore>((set) => ({
  ...initialState,

  upsertTask: (task) =>
    set((state) => {
      const existing = state.tasks[task.id];
      // Ignore stale realtime echoes
      if (existing && existing.updated_at >= task.updated_at) return state;
      if (task.archived) {
        const { [task.id]: _, ...rest } = state.tasks;
        return { tasks: rest };
      }
      return { tasks: { ...state.tasks, [task.id]: task } };
    }),

  removeTask: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.tasks;
      return { tasks: rest };
    }),

  setTasks: (tasks) =>
    set({
      tasks: Object.fromEntries(
        tasks.filter((t) => !t.archived).map((t) => [t.id, t])
      ),
    }),

  appendActivity: (items) =>
    set((state) => {
      const ids = new Set(state.activity.map((a) => a.id));
      const newItems = items.filter((a) => !ids.has(a.id));
      return {
        activity: [...state.activity, ...newItems].sort((a, b) => a.id - b.id),
      };
    }),

  setProfiles: (profiles) =>
    set({ profiles: Object.fromEntries(profiles.map((p) => [p.id, p])) }),

  setOnline: (users) => set({ online: users }),

  setTyping: (taskId, userName) =>
    set((state) => {
      if (userName === null) {
        const { [taskId]: _, ...rest } = state.typing;
        return { typing: rest };
      }
      return { typing: { ...state.typing, [taskId]: userName } };
    }),

  setConn: (conn) => set({ conn }),

  reset: () => set(initialState),
}));

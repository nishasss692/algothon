'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useProjectStore } from '@/lib/store';
import type { Task, Profile, Activity, PresenceUser } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface UseProjectRealtimeOptions {
  projectId: string;
  currentUser?: {
    id: string;
    name: string;
    color: string;
  } | null;
  currentTaskId?: string | null;
}

export interface UseProjectRealtimeReturn {
  broadcastTyping: (taskId: string) => void;
  trackCurrentTask: (taskId: string | null) => void;
}

/**
 * Manages the single Realtime channel for a project:
 * - Subscribes to Postgres changes on tasks & activity
 * - Tracks collaborator presence (online avatars & viewing task indicator)
 * - Broadcasts typing indicators
 * - Manages connection status (connecting -> live -> reconnecting)
 * - Fetches initial tasks & member profiles upon successful subscription
 */
export function useProjectRealtime({
  projectId,
  currentUser,
  currentTaskId,
}: UseProjectRealtimeOptions): UseProjectRealtimeReturn {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastTypingSentRef = useRef<number>(0);

  // Keep refs for presence data so callbacks and channel events always read fresh values
  const currentUserRef = useRef(currentUser);
  const currentTaskIdRef = useRef(currentTaskId);

  useEffect(() => {
    currentUserRef.current = currentUser;
    currentTaskIdRef.current = currentTaskId;
  }, [currentUser, currentTaskId]);

  // Helper to broadcast typing events with rate-limiting (max once per 1.5s)
  const broadcastTyping = useCallback((taskId: string) => {
    const user = currentUserRef.current;
    if (!channelRef.current || !user) return;
    const now = Date.now();
    if (now - lastTypingSentRef.current < 1500) return;
    lastTypingSentRef.current = now;

    channelRef.current.send({
      type: 'broadcast',
      event: 'typing',
      payload: {
        task_id: taskId,
        user_id: user.id,
        user_name: user.name,
      },
    });
  }, []);

  // Helper to re-track presence when the currently viewed task changes
  const trackCurrentTask = useCallback((taskId: string | null) => {
    const user = currentUserRef.current;
    if (!channelRef.current || !user) return;
    channelRef.current.track({
      user_id: user.id,
      name: user.name,
      color: user.color,
      task_id: taskId,
    });
  }, []);

  // 1. Channel Lifecycle Effect: Depends ONLY on projectId
  useEffect(() => {
    if (!projectId) return;

    let isCancelled = false;
    const store = useProjectStore.getState();
    store.setConn('connecting');

    // Network offline/online listeners
    const handleOnline = () => {
      // Browser returned online; let Supabase channel recover
    };
    const handleOffline = () => {
      if (!isCancelled) {
        useProjectStore.getState().setConn('reconnecting');
      }
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Establish single channel per project
    const channelName = `project:${projectId}`;
    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: currentUserRef.current?.id || undefined,
        },
      },
    });
    channelRef.current = channel;

    // Subscribe to tasks table changes (filtered by project_id)
    channel.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'tasks',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        if (isCancelled) return;
        if (payload.eventType === 'DELETE') {
          if (payload.old && payload.old.id) {
            useProjectStore.getState().removeTask(payload.old.id);
          }
        } else if (payload.new) {
          // upsertTask automatically ignores stale echoes and handles soft deletes
          useProjectStore.getState().upsertTask(payload.new as Task);
        }
      }
    );

    // Subscribe to activity table changes (filtered by project_id)
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'activity',
        filter: `project_id=eq.${projectId}`,
      },
      (payload) => {
        if (isCancelled) return;
        if (payload.new) {
          useProjectStore.getState().appendActivity([payload.new as Activity]);
        }
      }
    );

    // Presence sync: update online collaborators in store
    channel.on('presence', { event: 'sync' }, () => {
      if (isCancelled) return;
      const state = channel.presenceState<PresenceUser>();
      const onlineUsers: PresenceUser[] = [];
      const seen = new Set<string>();

      for (const key of Object.keys(state)) {
        const presences = state[key];
        if (presences && presences.length > 0) {
          const u = presences[0];
          if (!seen.has(u.user_id)) {
            seen.add(u.user_id);
            onlineUsers.push(u);
          }
        }
      }
      useProjectStore.getState().setOnline(onlineUsers);
    });

    // Broadcast typing events
    channel.on('broadcast', { event: 'typing' }, ({ payload }) => {
      if (isCancelled) return;
      if (payload?.task_id && payload?.user_name) {
        const user = currentUserRef.current;
        if (user && payload.user_id === user.id) return;

        useProjectStore.getState().setTyping(payload.task_id, payload.user_name);

        if (typingTimeoutsRef.current[payload.task_id]) {
          clearTimeout(typingTimeoutsRef.current[payload.task_id]);
        }
        typingTimeoutsRef.current[payload.task_id] = setTimeout(() => {
          useProjectStore.getState().setTyping(payload.task_id, null);
          delete typingTimeoutsRef.current[payload.task_id];
        }, 3000);
      }
    });

    // Channel subscription & lifecycle
    channel.subscribe(async (status) => {
      if (isCancelled) return;

      if (status === 'SUBSCRIBED') {
        // Track initial presence
        const user = currentUserRef.current;
        if (user) {
          await channel.track({
            user_id: user.id,
            name: user.name,
            color: user.color,
            task_id: currentTaskIdRef.current ?? null,
          });
        }

        // Fetch initial project data (tasks and member profiles)
        try {
          // A. Tasks
          const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .eq('archived', false)
            .order('position', { ascending: true });

          if (!isCancelled && !tasksError && tasks) {
            useProjectStore.getState().setTasks(tasks as Task[]);
          }

          // B. Profiles for project members
          const { data: members, error: membersError } = await supabase
            .from('project_members')
            .select('user_id')
            .eq('project_id', projectId);

          if (!isCancelled && !membersError && members && members.length > 0) {
            const userIds = members.map((m) => m.user_id);
            const { data: profiles } = await supabase
              .from('profiles')
              .select('*')
              .in('id', userIds);

            if (!isCancelled && profiles) {
              useProjectStore.getState().setProfiles(profiles as Profile[]);
            }
          }

          // C. Activity feed
          const { data: activity } = await supabase
            .from('activity')
            .select('*')
            .eq('project_id', projectId)
            .order('id', { ascending: true });

          if (!isCancelled && activity) {
            useProjectStore.getState().appendActivity(activity as Activity[]);
          }

          if (!isCancelled) {
            useProjectStore.getState().setConn('live');
          }
        } catch (err) {
          console.error('Initial data fetch error:', err);
          if (!isCancelled) {
            useProjectStore.getState().setConn('live');
          }
        }
      } else if (
        status === 'CHANNEL_ERROR' ||
        status === 'TIMED_OUT' ||
        status === 'CLOSED'
      ) {
        if (!isCancelled) {
          useProjectStore.getState().setConn('reconnecting');
        }
      }
    });

    // Cleanup when component unmounts or projectId changes
    return () => {
      isCancelled = true;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      // Clear any pending typing indicator timeouts
      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};

      // Remove channel cleanly
      supabase.removeChannel(channel);
      channelRef.current = null;

      // Reset store to clear previous project state
      useProjectStore.getState().reset();
    };
  }, [projectId]);

  // 2. Presence Update Effect: Re-tracks presence when user details or selected task change
  useEffect(() => {
    if (!channelRef.current || !currentUser) return;
    channelRef.current.track({
      user_id: currentUser.id,
      name: currentUser.name,
      color: currentUser.color,
      task_id: currentTaskId ?? null,
    });
  }, [currentUser?.id, currentUser?.name, currentUser?.color, currentTaskId, currentUser]);

  return {
    broadcastTyping,
    trackCurrentTask,
  };
}

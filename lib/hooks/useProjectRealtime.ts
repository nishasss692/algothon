'use client';

import { useEffect, useRef, useCallback, useId } from 'react';
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
 * - Tracks collaborator presence (sync, join, leave)
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
  const isSubscribedRef = useRef(false);
  const typingTimeoutsRef = useRef<Record<string, NodeJS.Timeout>>({});
  const lastTypingSentRef = useRef<number>(0);

  // Generate a stable unique session ID per browser client so multi-window sessions are distinct
  const sessionId = useId();

  // Keep refs for presence data so callbacks and channel events always read fresh values
  const currentUserRef = useRef(currentUser);
  const currentTaskIdRef = useRef(currentTaskId);

  useEffect(() => {
    currentUserRef.current = currentUser;
    currentTaskIdRef.current = currentTaskId;
  }, [currentUser, currentTaskId]);

  // Safe tracking helper that only pushes when channel is subscribed
  const trackPresence = useCallback(
    async (
      user: { id: string; name: string; color: string } | null | undefined,
      taskId: string | null | undefined
    ) => {
      if (!channelRef.current || !isSubscribedRef.current || !user) return;
      try {
        await channelRef.current.track({
          user_id: user.id,
          name: user.name,
          color: user.color,
          task_id: taskId ?? null,
        });
      } catch (err) {
        console.error('Failed to track presence:', err);
      }
    },
    []
  );

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
  const trackCurrentTask = useCallback(
    (taskId: string | null) => {
      trackPresence(currentUserRef.current, taskId);
    },
    [trackPresence]
  );

  // 1. Channel Lifecycle Effect: Depends ONLY on projectId
  useEffect(() => {
    if (!projectId) return;

    let isCancelled = false;
    isSubscribedRef.current = false;
    useProjectStore.getState().setConn('connecting');

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

    // Establish single channel per project with a unique presence key per browser session
    const channelName = `project:${projectId}`;
    const presenceKey = currentUserRef.current?.id
      ? `${currentUserRef.current.id}:${sessionId}`
      : sessionId;

    const channel = supabase.channel(channelName, {
      config: {
        presence: {
          key: presenceKey,
        },
      },
    });
    channelRef.current = channel;

    // Helper to extract and deduplicate online collaborators across all presence keys
    const updateOnlineUsers = () => {
      if (isCancelled) return;
      const state = channel.presenceState<PresenceUser>();
      const presenceKeys = Object.keys(state);
      const onlineUsers: PresenceUser[] = [];
      const seen = new Set<string>();

      for (const key of presenceKeys) {
        const presences = state[key];
        if (presences && Array.isArray(presences)) {
          for (const u of presences) {
            if (u && u.user_id && !seen.has(u.user_id)) {
              seen.add(u.user_id);
              onlineUsers.push(u);
            }
          }
        }
      }

      useProjectStore.getState().setOnline(onlineUsers);
    };

    // Presence events: handle sync, join, and leave so incoming collaborators update immediately
    channel
      .on('presence', { event: 'sync' }, () => updateOnlineUsers('sync'))
      .on('presence', { event: 'join' }, () => updateOnlineUsers('join'))
      .on('presence', { event: 'leave' }, () => updateOnlineUsers('leave'));

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
        isSubscribedRef.current = true;

        // Track initial presence once channel is confirmed subscribed
        if (currentUserRef.current) {
          await trackPresence(currentUserRef.current, currentTaskIdRef.current);
        }

        // Fetch initial project data (tasks and member profiles)
        try {
          const { data: tasks, error: tasksError } = await supabase
            .from('tasks')
            .select('*')
            .eq('project_id', projectId)
            .eq('archived', false)
            .order('position', { ascending: true });

          if (!isCancelled && !tasksError && tasks) {
            useProjectStore.getState().setTasks(tasks as Task[]);
          }

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
        isSubscribedRef.current = false;
        if (!isCancelled) {
          useProjectStore.getState().setConn('reconnecting');
        }
      }
    });

    // Cleanup when component unmounts or projectId changes
    return () => {
      isCancelled = true;
      isSubscribedRef.current = false;
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);

      Object.values(typingTimeoutsRef.current).forEach(clearTimeout);
      typingTimeoutsRef.current = {};

      supabase.removeChannel(channel);
      channelRef.current = null;

      useProjectStore.getState().reset();
    };
  }, [projectId, sessionId, trackPresence]);

  // 2. Presence Update Effect: Re-tracks presence safely when user details or selected task change
  useEffect(() => {
    if (isSubscribedRef.current && currentUser) {
      trackPresence(currentUser, currentTaskId);
    }
  }, [currentUser, currentTaskId, trackPresence]);

  return {
    broadcastTyping,
    trackCurrentTask,
  };
}

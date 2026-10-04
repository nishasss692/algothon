'use client';

import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import type { Task, Profile, ConnStatus } from './types';

export interface DashboardProject {
  id: string;
  name: string;
}

export function useDashboardData() {
  const { session } = useSession();
  const userId = session?.user?.id;

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<DashboardProject[]>([]);
  const [profiles, setProfiles] = useState<Record<string, Profile>>({});
  const [conn, setConn] = useState<ConnStatus>('connecting');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setError(null);
      const [projectsRes, tasksRes, profilesRes] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('tasks').select('*').eq('archived', false),
        supabase.from('profiles').select('*'),
      ]);

      if (projectsRes.error) throw projectsRes.error;
      if (tasksRes.error) throw tasksRes.error;
      if (profilesRes.error) throw profilesRes.error;

      setProjects(projectsRes.data ?? []);
      setTasks(tasksRes.data ?? []);

      const profileMap: Record<string, Profile> = {};
      for (const p of profilesRes.data ?? []) {
        profileMap[p.id] = p;
      }
      setProfiles(profileMap);
      setLoading(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load dashboard data');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!userId) return;

    fetchData();

    const channel = supabase.channel(`dashboard:${userId}`);

    channel
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'tasks' },
        (payload: any) => {
          if (payload.eventType === 'DELETE') {
            const oldId = payload.old?.id;
            if (oldId) {
              setTasks((prev) => prev.filter((t) => t.id !== oldId));
            }
            return;
          }

          const newRow = payload.new as Task;
          if (!newRow || !newRow.id) return;

          setTasks((prev) => {
            if (newRow.archived) {
              return prev.filter((t) => t.id !== newRow.id);
            }

            const existing = prev.find((t) => t.id === newRow.id);
            if (existing && existing.updated_at >= newRow.updated_at) {
              return prev;
            }

            if (!existing) {
              return [...prev, newRow];
            }

            return prev.map((t) => (t.id === newRow.id ? newRow : t));
          });
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          fetchData();
          setConn('live');
        } else if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT' ||
          status === 'CLOSED'
        ) {
          setConn('reconnecting');
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId, fetchData]);

  return {
    tasks,
    projects,
    profiles,
    conn,
    loading,
    error,
    reload: fetchData,
  };
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Profile } from '@/lib/types';
import { toast } from 'sonner';

export function useProjectMembers(projectId: string): { members: Profile[]; loading: boolean } {
  const [members, setMembers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    supabase
      .from('project_members')
      .select('profiles(id, name, color)')
      .eq('project_id', projectId)
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return; }
        const profiles = (data ?? [])
          .map((row: { profiles: Profile | Profile[] | null }) => {
            const p = row.profiles;
            return Array.isArray(p) ? p[0] : p;
          })
          .filter(Boolean) as Profile[];
        profiles.sort((a, b) => a.name.localeCompare(b.name));
        setMembers(profiles);
        setLoading(false);
      });
  }, [projectId]);

  return { members, loading };
}

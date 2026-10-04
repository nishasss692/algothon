'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useSession } from '@/lib/useSession';
import type { Profile } from '@/lib/types';

export function useMe(): { me: Profile | null; loading: boolean } {
  const { session, loading: sessionLoading } = useSession();
  const [me, setMe] = useState<Profile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (sessionLoading) return;
    if (!session) {
      setMe(null);
      setProfileLoading(false);
      return;
    }

    async function fetchProfile(retried = false) {
      const { data } = await supabase
        .from('profiles')
        .select('id, name, color')
        .eq('id', session!.user.id)
        .single();

      if (!data && !retried) {
        // Signup trigger may still be running
        setTimeout(() => fetchProfile(true), 500);
        return;
      }
      setMe(data ?? null);
      setProfileLoading(false);
    }

    fetchProfile();
  }, [session, sessionLoading]);

  return { me, loading: sessionLoading || profileLoading };
}

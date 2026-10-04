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

    let mounted = true;

    async function load() {
      if (!session) {
        if (mounted) {
          setMe(null);
          setProfileLoading(false);
        }
        return;
      }

      const { data } = await supabase
        .from('profiles')
        .select('id, name, color')
        .eq('id', session.user.id)
        .single();

      if (!data) {
        setTimeout(async () => {
          if (!mounted) return;
          const retry = await supabase
            .from('profiles')
            .select('id, name, color')
            .eq('id', session.user.id)
            .single();
          if (mounted) {
            setMe(retry.data ?? null);
            setProfileLoading(false);
          }
        }, 500);
        return;
      }

      if (mounted) {
        setMe(data);
        setProfileLoading(false);
      }
    }

    void load();

    return () => {
      mounted = false;
    };
  }, [session, sessionLoading]);

  return { me, loading: sessionLoading || profileLoading };
}

'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

export function useSession() {
  const [session, setSession] = useState<Session | null | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;

    // 1. Subscribe to auth state changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
      }
    });

    // 2. Fetch the initial session if not already populated
    supabase.auth
      .getSession()
      .then(({ data: { session: initialSession }, error }) => {
        if (!isMounted) return;
        if (error) {
          console.error('Error fetching session:', error.message);
          setSession(null);
          return;
        }
        setSession((prev) => (prev !== undefined ? prev : initialSession));
      })
      .catch((err) => {
        console.error('Session retrieval exception:', err);
        if (isMounted) {
          setSession(null);
        }
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return session; // undefined = loading, null = no session, Session = signed in
}

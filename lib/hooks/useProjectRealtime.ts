// TEMP STUB: Member A's version replaces this on merge
import type { Profile } from '@/lib/types';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { useRef } from 'react';

export function useProjectRealtime(
  _projectId: string,
  _me: Profile | null
): React.MutableRefObject<RealtimeChannel | undefined> {
  return useRef<RealtimeChannel | undefined>(undefined);
}

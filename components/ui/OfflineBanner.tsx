'use client';

import type { ConnStatus } from '@/lib/types';

interface OfflineBannerProps {
  status: ConnStatus;
}

export function OfflineBanner({ status }: OfflineBannerProps) {
  if (status === 'live') return null;

  return (
    <div
      role="alert"
      className="sticky top-0 z-50 flex items-center justify-center gap-2 border-b border-amber-300 bg-amber-50 px-4 py-2 font-mono text-xs text-amber-800 shadow-2xs"
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-600" />
      </span>
      <span className="font-semibold uppercase tracking-wider text-[11px] text-amber-900">[SYS_ALERT]</span>
      <span className="text-[11px]">
        {status === 'reconnecting'
          ? 'Network interrupted — Reconnecting in background. Local changes will sync when online.'
          : 'Connecting to workspace runtime...'}
      </span>
    </div>
  );
}

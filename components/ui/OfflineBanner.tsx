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
      className="sticky top-0 z-40 flex items-center justify-center gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs font-semibold text-amber-800 transition-all"
    >
      <svg
        className="h-4 w-4 animate-spin text-amber-600"
        fill="none"
        viewBox="0 0 24 24"
      >
        <circle
          className="opacity-25"
          cx="12"
          cy="12"
          r="10"
          stroke="currentColor"
          strokeWidth="4"
        />
        <path
          className="opacity-75"
          fill="currentColor"
          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
        />
      </svg>
      <span>
        {status === 'reconnecting'
          ? 'Connection interrupted. Reconnecting to real-time server... Inputs and task dragging are temporarily paused.'
          : 'Connecting to collaborative workspace...'}
      </span>
    </div>
  );
}

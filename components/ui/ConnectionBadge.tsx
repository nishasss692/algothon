'use client';

import type { ConnStatus } from '@/lib/types';

interface ConnectionBadgeProps {
  status: ConnStatus;
  pingMs?: number;
}

export function ConnectionBadge({ status, pingMs = 28 }: ConnectionBadgeProps) {
  if (status === 'live') {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 transition"
        title="Real-time WebSocket connection active"
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
        </span>
        <span className="font-semibold">Live</span>
        <span className="text-emerald-400">•</span>
        <span className="text-emerald-600 font-normal">{pingMs}ms</span>
      </div>
    );
  }

  if (status === 'reconnecting') {
    return (
      <div
        className="inline-flex items-center gap-2 rounded-full border border-amber-300 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-700 transition"
        title="Connection lost. Retrying..."
      >
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
        </span>
        <span className="font-semibold">Reconnecting</span>
      </div>
    );
  }

  return (
    <div
      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600 transition"
      title="Establishing real-time gateway channel"
    >
      <span className="inline-block h-2 w-2 rounded-full bg-slate-400 animate-pulse" />
      <span>Connecting</span>
    </div>
  );
}

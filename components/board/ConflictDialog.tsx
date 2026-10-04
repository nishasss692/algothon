'use client';

interface ConflictDialogProps {
  isOpen: boolean;
  localTitle?: string;
  serverTitle?: string;
  localVersion?: number;
  serverVersion?: number;
  localDescription?: string;
  serverDescription?: string;
  localStatus?: string;
  serverStatus?: string;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
}

export function ConflictDialog({
  isOpen,
  localTitle,
  serverTitle,
  localVersion,
  serverVersion,
  localDescription,
  serverDescription,
  localStatus,
  serverStatus,
  onKeepMine,
  onTakeTheirs,
}: ConflictDialogProps) {
  if (!isOpen) return null;

  const titleChanged = localTitle !== serverTitle;
  const descChanged =
    localDescription !== undefined &&
    serverDescription !== undefined &&
    localDescription !== serverDescription;
  const statusChanged =
    localStatus !== undefined &&
    serverStatus !== undefined &&
    localStatus !== serverStatus;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="w-full max-w-3xl rounded-xl border border-rose-200 bg-white shadow-2xl flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header with Red-Orange Warning Indicator */}
        <div className="flex items-center justify-between border-b border-rose-100 bg-rose-50/80 px-5 py-3.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-600" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-semibold text-rose-900 text-sm">
                  Concurrent Edit Conflict
                </span>
                <span className="font-mono text-[10px] font-semibold text-rose-700 bg-rose-100/80 border border-rose-300 px-1.5 py-0.5 rounded">
                  HTTP 409
                </span>
              </div>
              <p className="text-[11px] text-rose-700 mt-0.5">
                Another collaborator committed changes to this task while you were drafting.
              </p>
            </div>
          </div>
        </div>

        {/* Side-by-Side Diff Inspector */}
        <div className="flex-1 overflow-y-auto p-5 bg-slate-50/50">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Left Panel: Local Buffer (Your Edits) */}
            <div className="rounded-lg border border-emerald-200 bg-white shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-emerald-100 bg-emerald-50/70 px-3.5 py-2 font-mono text-xs">
                <span className="text-emerald-800 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Your Local Buffer
                </span>
                <span className="text-emerald-700 text-[10px] font-medium bg-emerald-100 px-1.5 py-0.5 rounded">
                  {localVersion ? `base r${localVersion}` : 'uncommitted'}
                </span>
              </div>

              <div className="p-3.5 space-y-3 font-sans text-xs">
                {/* Title field */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    <span>Field: Title</span>
                    {titleChanged && (
                      <span className="text-emerald-700 font-semibold">[+] Modified</span>
                    )}
                  </div>
                  <div
                    className={`p-2.5 rounded border text-xs leading-relaxed break-words font-medium ${
                      titleChanged
                        ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="font-mono text-emerald-600 font-bold mr-1.5">+</span>
                    {localTitle || '(Untitled)'}
                  </div>
                </div>

                {/* Description field */}
                {localDescription !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      <span>Field: Description</span>
                      {descChanged && (
                        <span className="text-emerald-700 font-semibold">[+] Modified</span>
                      )}
                    </div>
                    <div
                      className={`p-2.5 rounded border text-xs leading-relaxed max-h-32 overflow-y-auto ${
                        descChanged
                          ? 'border-emerald-300 bg-emerald-50/40 text-emerald-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-mono text-emerald-600 font-bold mr-1.5">+</span>
                      {localDescription || '(No description)'}
                    </div>
                  </div>
                )}

                {/* Status field */}
                {localStatus && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      <span>Field: Status</span>
                      {statusChanged && (
                        <span className="text-emerald-700 font-semibold">[+] Modified</span>
                      )}
                    </div>
                    <div className="p-2 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800">
                      {localStatus}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right Panel: Server State (Their Version) */}
            <div className="rounded-lg border border-blue-200 bg-white shadow-2xs flex flex-col overflow-hidden">
              <div className="flex items-center justify-between border-b border-blue-100 bg-blue-50/70 px-3.5 py-2 font-mono text-xs">
                <span className="text-blue-800 font-semibold flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500" />
                  Incoming Server State
                </span>
                <span className="text-blue-700 text-[10px] font-medium bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                  {serverVersion ? `r${serverVersion} committed` : 'latest'}
                </span>
              </div>

              <div className="p-3.5 space-y-3 font-sans text-xs">
                {/* Title field */}
                <div>
                  <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                    <span>Field: Title</span>
                    {titleChanged && (
                      <span className="text-blue-700 font-semibold">[*] Incoming</span>
                    )}
                  </div>
                  <div
                    className={`p-2.5 rounded border text-xs leading-relaxed break-words font-medium ${
                      titleChanged
                        ? 'border-blue-300 bg-blue-50/40 text-blue-950'
                        : 'border-slate-200 bg-slate-50 text-slate-600'
                    }`}
                  >
                    <span className="font-mono text-blue-600 font-bold mr-1.5">*</span>
                    {serverTitle || '(Current saved version)'}
                  </div>
                </div>

                {/* Description field */}
                {serverDescription !== undefined && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      <span>Field: Description</span>
                      {descChanged && (
                        <span className="text-blue-700 font-semibold">[*] Incoming</span>
                      )}
                    </div>
                    <div
                      className={`p-2.5 rounded border text-xs leading-relaxed max-h-32 overflow-y-auto ${
                        descChanged
                          ? 'border-blue-300 bg-blue-50/40 text-blue-950'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      <span className="font-mono text-blue-600 font-bold mr-1.5">*</span>
                      {serverDescription || '(No description)'}
                    </div>
                  </div>
                )}

                {/* Status field */}
                {serverStatus && (
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-500 uppercase tracking-wider mb-1">
                      <span>Field: Status</span>
                      {statusChanged && (
                        <span className="text-blue-700 font-semibold">[*] Incoming</span>
                      )}
                    </div>
                    <div className="p-2 rounded border border-slate-200 bg-slate-50 text-xs font-mono text-slate-800">
                      {serverStatus}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Resolution Controls */}
        <div className="border-t border-slate-200 bg-white px-5 py-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          <div className="text-[11px] text-slate-500 font-mono">
            Explicit OCC resolution required. No changes silently dropped.
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onTakeTheirs}
              className="flex-1 sm:flex-initial rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:border-slate-400 transition shadow-2xs text-center"
              title="Discard your local edits and adopt the incoming version"
            >
              <div className="font-semibold">Take Theirs</div>
              <div className="text-[10px] text-slate-500 font-normal">Discard local buffer & reload</div>
            </button>
            <button
              type="button"
              onClick={onKeepMine}
              className="flex-1 sm:flex-initial rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white hover:bg-blue-700 transition shadow-xs text-center"
              title="Re-apply your edits over the new server revision"
            >
              <div className="font-semibold">Keep Mine</div>
              <div className="text-[10px] text-blue-100 font-normal">Apply buffer with latest token</div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

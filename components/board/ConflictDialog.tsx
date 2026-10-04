'use client';

interface ConflictDialogProps {
  isOpen: boolean;
  localTitle?: string;
  serverTitle?: string;
  onKeepMine: () => void;
  onTakeTheirs: () => void;
}

export function ConflictDialog({
  isOpen,
  localTitle,
  serverTitle,
  onKeepMine,
  onTakeTheirs,
}: ConflictDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-6 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">Edit Conflict</h3>
            <p className="text-xs text-gray-500">
              Another collaborator updated this task while you were editing it.
            </p>
          </div>
        </div>

        <div className="mt-4 space-y-3 rounded-xl bg-gray-50 p-3.5 text-xs">
          <div>
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
              Your Version:
            </span>
            <p className="mt-0.5 text-gray-800 font-medium break-words">
              {localTitle || '(Your recent changes)'}
            </p>
          </div>
          <div className="border-t border-gray-200 pt-2">
            <span className="font-semibold text-gray-500 uppercase tracking-wider text-[10px]">
              Latest Server Version:
            </span>
            <p className="mt-0.5 text-gray-800 font-medium break-words">
              {serverTitle || '(Current saved version)'}
            </p>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2.5">
          <button
            type="button"
            onClick={onTakeTheirs}
            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            Take theirs (Discard mine)
          </button>
          <button
            type="button"
            onClick={onKeepMine}
            className="rounded-lg bg-green-700 px-3.5 py-2 text-xs font-semibold text-white hover:bg-green-800 transition"
          >
            Keep mine (Overwrite)
          </button>
        </div>
      </div>
    </div>
  );
}

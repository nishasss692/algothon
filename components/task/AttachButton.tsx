'use client';

import { useState, useRef, useImperativeHandle, forwardRef } from 'react';
import { useProjectStore } from '@/lib/store';
import { uploadTaskFile } from '@/lib/files';
import { toast } from 'sonner';

export interface AttachButtonHandle {
  handleFiles: (files: File[]) => Promise<void>;
}

interface AttachButtonProps {
  projectId: string;
  taskId: string;
  onUploadingChange?: (uploading: string[]) => void;
}

const AttachButton = forwardRef<AttachButtonHandle, AttachButtonProps>(
  function AttachButton({ projectId, taskId, onUploadingChange }, ref) {
    const conn = useProjectStore((s) => s.conn);
    const [uploading, setUploading] = useState<string[]>([]);
    const inputRef = useRef<HTMLInputElement>(null);

    const disabled = conn !== 'live';

    async function handleFiles(files: File[]) {
      if (files.length === 0 || disabled) return;

      for (const file of files) {
        setUploading((prev) => {
          const next = [...prev, file.name];
          onUploadingChange?.(next);
          return next;
        });

        try {
          await uploadTaskFile(file, projectId, taskId);
        } catch (err: any) {
          toast.error(err?.message || `Failed to upload ${file.name}`);
        } finally {
          setUploading((prev) => {
            const next = prev.filter((name) => name !== file.name);
            onUploadingChange?.(next);
            return next;
          });
        }
      }

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    }

    useImperativeHandle(ref, () => ({
      handleFiles,
    }));

    function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
      if (e.target.files && e.target.files.length > 0) {
        handleFiles(Array.from(e.target.files));
      }
    }

    return (
      <div style={{ display: 'inline-flex', flexDirection: 'column', gap: 4 }}>
        {!onUploadingChange && uploading.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {uploading.map((name) => (
              <span
                key={name}
                style={{
                  fontSize: 11,
                  background: '#e0e7ff',
                  color: '#4338ca',
                  padding: '2px 6px',
                  borderRadius: 4,
                }}
              >
                Uploading {name}...
              </span>
            ))}
          </div>
        )}
        <input
          ref={inputRef}
          type="file"
          multiple
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || uploading.length > 0}
          title={disabled ? 'Uploading is paused while reconnecting' : 'Attach file'}
          aria-label="Attach file"
          style={{
            padding: '8px 12px',
            fontSize: 13,
            fontWeight: 500,
            background: '#f3f4f6',
            color: '#374151',
            border: '1px solid #d1d5db',
            borderRadius: 8,
            cursor: disabled ? 'not-allowed' : 'pointer',
            opacity: disabled ? 0.5 : 1,
            whiteSpace: 'nowrap',
          }}
        >
          📎 Attach file
        </button>
      </div>
    );
  }
);

export default AttachButton;

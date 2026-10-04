import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';

export const MAX_FILE_BYTES = 10 * 1024 * 1024; // 10 MB

export async function uploadTaskFile(
  file: File,
  projectId: string,
  taskId: string
): Promise<void> {
  if (file.size <= 0) {
    throw new Error(`${file.name} is empty`);
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error(`${file.name} is larger than 10 MB`);
  }

  const safeName = file.name.replace(/[^A-Za-z0-9._-]/g, '_');
  const path = `${projectId}/${taskId}/${crypto.randomUUID()}-${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from('attachments')
    .upload(path, file);

  if (uploadError) {
    throw uploadError;
  }

  const { error: insertError } = await supabase.from('attachments').insert({
    task_id: taskId,
    project_id: projectId,
    file_name: file.name,
    path,
    size: file.size,
  });

  if (insertError) {
    await supabase.storage.from('attachments').remove([path]);
    throw insertError;
  }
}

export async function downloadTaskFile(
  path: string,
  fileName: string
): Promise<void> {
  try {
    const { data, error } = await supabase.storage
      .from('attachments')
      .createSignedUrl(path, 3600, { download: fileName });

    if (error) {
      toast.error(error.message);
      return;
    }

    if (!data?.signedUrl) {
      toast.error('Could not generate download URL');
      return;
    }

    const a = document.createElement('a');
    a.href = data.signedUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err: any) {
    toast.error(err?.message || 'Failed to download file');
  }
}

import { supabase } from './supabase';

const BUCKET = 'candidate-assets';
const PUBLIC_PREFIX = `/storage/v1/object/public/${BUCKET}/`;

/** Convert both legacy public URLs and new stored paths into a storage path. */
export function candidateAssetPath(value: string | null | undefined): string | null {
  if (!value) return null;

  const markerIndex = value.indexOf(PUBLIC_PREFIX);
  if (markerIndex >= 0) {
    return decodeURIComponent(value.slice(markerIndex + PUBLIC_PREFIX.length));
  }

  return value.replace(/^\/+/, '');
}

export async function getCandidateAssetUrl(
  value: string | null | undefined,
  expiresIn = 60 * 60
): Promise<string | null> {
  const path = candidateAssetPath(value);
  if (!path) return null;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function uploadCandidateAsset(file: File, userId: string, folder: 'avatars' | 'resumes') {
  const extension = file.name.split('.').pop()?.toLowerCase() || 'file';
  const path = `${userId}/${folder}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
    upsert: false,
    contentType: file.type || undefined,
  });

  if (error) throw error;
  return path;
}

export function candidateResumeViewerHref(value: string, fileName = 'resume.pdf', returnTo = '/') {
  const path = candidateAssetPath(value);
  if (!path) return null;

  const params = new URLSearchParams({ path, name: fileName, returnTo });
  return `/resume/view?${params.toString()}`;
}

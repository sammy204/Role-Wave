const STORAGE_PREFIX = 'rolewave_saved_jobs:';

function getStorageKey(userId: string) {
  return `${STORAGE_PREFIX}${userId}`;
}

function readIds(userId: string): string[] {
  if (typeof window === 'undefined') return [];

  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return [];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [];
  } catch {
    return [];
  }
}

function writeIds(userId: string, ids: string[]) {
  if (typeof window === 'undefined') return;

  window.localStorage.setItem(getStorageKey(userId), JSON.stringify(ids));
}

export function getSavedJobIds(userId: string) {
  return readIds(userId);
}

export function isJobSaved(userId: string, jobId: string) {
  return readIds(userId).includes(jobId);
}

export function toggleSavedJob(userId: string, jobId: string) {
  const ids = readIds(userId);
  const nextIds = ids.includes(jobId) ? ids.filter((id) => id !== jobId) : [...ids, jobId];
  writeIds(userId, nextIds);
  return nextIds;
}

import { supabase } from './supabase';
import type { Profile } from '../types';
import { withTimeout } from './withTimeout';

const PROFILE_LOOKUP_TIMEOUT_MS = 6000;

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await withTimeout(
    supabase.from('profiles').select('*').eq('id', userId).maybeSingle(),
    PROFILE_LOOKUP_TIMEOUT_MS,
    'Profile lookup'
  );

  if (error || !data) {
    return null;
  }

  return data as Profile;
}

export async function bootstrapFirstAdmin(): Promise<boolean> {
  const { data, error } = await supabase.rpc('bootstrap_first_admin');

  if (error) {
    return false;
  }

  return Boolean(data);
}

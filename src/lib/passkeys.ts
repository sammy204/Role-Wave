import { supabase } from './supabase';

export function passkeysSupported() {
  if (typeof window === 'undefined') return false;
  const isLocalHost = ['localhost', '127.0.0.1'].includes(window.location.hostname);
  const localPasskeysEnabled = import.meta.env.VITE_ENABLE_LOCAL_PASSKEYS === 'true';
  const validHost = !isLocalHost || localPasskeysEnabled;
  return validHost && window.isSecureContext && typeof window.PublicKeyCredential !== 'undefined';
}

export async function registerPasskey() {
  return supabase.auth.registerPasskey();
}

export async function signInWithPasskey() {
  return supabase.auth.signInWithPasskey();
}

export async function listPasskeys() {
  return supabase.auth.passkey.list();
}

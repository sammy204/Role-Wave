import { supabase } from './supabase';

const PASSKEY_DEVICE_STATUS_KEY = 'rolewave-passkey-device-status';

export function passkeyEnabledOnDevice() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(PASSKEY_DEVICE_STATUS_KEY) === 'enabled';
}

export function setPasskeyDeviceStatus(status: 'enabled' | 'dismissed' | 'unset') {
  if (typeof window === 'undefined') return;
  if (status === 'unset') {
    window.localStorage.removeItem(PASSKEY_DEVICE_STATUS_KEY);
  } else {
    window.localStorage.setItem(PASSKEY_DEVICE_STATUS_KEY, status);
  }
}

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

export async function signInWithPasskey(captchaToken?: string) {
  return supabase.auth.signInWithPasskey({ options: { captchaToken } });
}

export async function listPasskeys() {
  return supabase.auth.passkey.list();
}

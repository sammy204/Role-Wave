import { Capacitor } from '@capacitor/core';
import { supabase } from './supabase';

const NATIVE_AUTH_SCHEME = 'cv.rolewave.app';
const NATIVE_AUTH_HOST = 'auth-callback';

export function getNativeOAuthRedirectUrl(params: URLSearchParams) {
  return `${NATIVE_AUTH_SCHEME}://${NATIVE_AUTH_HOST}?${params.toString()}`;
}

export async function initNativeAuthDeepLink() {
  if (!Capacitor.isNativePlatform()) return;

  try {
    const { App } = await import('@capacitor/app');
    await App.addListener('appUrlOpen', ({ url }) => {
      void handleIncomingAuthUrl(url);
    });
  } catch {
    // The app plugin is unavailable; web/PWA authentication is unaffected.
  }
}

async function handleIncomingAuthUrl(rawUrl: string) {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return;
  }

  if (parsed.protocol !== `${NATIVE_AUTH_SCHEME}:` || parsed.hostname !== NATIVE_AUTH_HOST) return;

  const query = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const code = query.get('code');
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');

  try {
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (accessToken && refreshToken) {
      const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) throw error;
    } else {
      return;
    }
  } catch (error) {
    console.error('Native OAuth callback failed to establish a session:', error);
    return;
  }

  const destinationParams = new URLSearchParams(query);
  destinationParams.delete('code');
  window.location.assign(`/start?${destinationParams.toString()}`);
}

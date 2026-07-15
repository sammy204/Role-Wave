import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { withTimeout } from './withTimeout';

type AuthState = {
  session: Session | null;
  loading: boolean;
};

const AUTH_INIT_TIMEOUT_MS = 6000;

let cachedState: AuthState = { session: null, loading: true };
let resolved = false;
const listeners = new Set<(state: AuthState) => void>();

function notify() {
  listeners.forEach((fn) => fn(cachedState));
}

function setState(next: Partial<AuthState>) {
  cachedState = { ...cachedState, ...next };
  notify();
}

let initialized = false;

function init() {
  if (initialized) return;
  initialized = true;

  // This listener is intentionally never unsubscribed — it's a module-level
  // singleton that needs to keep reflecting auth state for the app's lifetime.
  supabase.auth.onAuthStateChange((_event, session) => {
    resolved = true;
    setState({ session, loading: false });
  });

  void (async () => {
    try {
      const { data, error } = await withTimeout(
        supabase.auth.getSession(),
        AUTH_INIT_TIMEOUT_MS,
        'Session lookup'
      );

      if (error) throw error;

      resolved = true;
      setState({ session: data.session, loading: false });
    } catch {
      resolved = true;
      setState({ session: null, loading: false });
    }
  })();

  setTimeout(() => {
    if (resolved) return;

    resolved = true;
    setState({ session: null, loading: false });
  }, AUTH_INIT_TIMEOUT_MS);
}

export function useAuth(): AuthState {
  const [state, setLocalState] = useState(cachedState);

  useEffect(() => {
    init();
    listeners.add(setLocalState);
    return () => {
      listeners.delete(setLocalState);
    };
  }, []);

  return state;
}
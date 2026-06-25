import { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import type { Profile } from '../types';

const AUTH_CHECK_TIMEOUT_MS = 7000;

export default function AdminGuard() {
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [debugStep, setDebugStep] = useState('Initializing admin check...');
  const [debugError, setDebugError] = useState('');

  useEffect(() => {
    let alive = true;

    async function checkAccess() {
      try {
        if (alive) {
          setDebugStep('Reading current Supabase session...');
          setDebugError('');
        }

        const { data } = await withTimeout(
          supabase.auth.getSession(),
          AUTH_CHECK_TIMEOUT_MS,
          'Session lookup'
        );
        const session = data.session;

        if (!session) {
          if (alive) {
            setProfile(null);
            setIsAdmin(false);
            setDebugStep('No session found. Redirecting to admin login.');
          }
          return;
        }

        if (alive) {
          setDebugStep(`Session found for ${session.user.email || session.user.id}. Checking profiles table...`);
        }

        const profileRequest = supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle() as unknown as Promise<{ data: Profile | null; error: { message: string } | null }>;

        const { data: nextProfile, error: profileError } = await withTimeout(profileRequest, AUTH_CHECK_TIMEOUT_MS, 'Profile lookup');

        if (profileError) {
          if (alive) {
            setDebugError(profileError.message);
            setProfile(null);
            setIsAdmin(false);
            setDebugStep('Profile query failed.');
          }
          return;
        }

        if (alive) {
          setProfile((nextProfile || null) as Profile | null);
          setIsAdmin(Boolean(nextProfile?.is_admin));
          setDebugStep(
            nextProfile
              ? `Profile loaded. is_admin = ${Boolean(nextProfile.is_admin)}.`
              : 'No matching profile row found for this user.'
          );
        }
      } catch {
        if (alive) {
          setProfile(null);
          setIsAdmin(false);
          setDebugStep('Admin check threw an unexpected error.');
          setDebugError('Unexpected error while checking admin access.');
        }
      } finally {
        if (alive) {
          setLoading(false);
        }
      }
    }

    checkAccess();

    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <div className="max-w-md rounded-xl border border-[#D3D1C7] bg-white px-4 py-3 text-center shadow-sm">
          <div className="text-[#5F5E5A]">Checking admin access...</div>
          <div className="mt-1 text-xs text-[#8A867E]">{debugStep}</div>
          {debugError && <div className="mt-2 text-xs text-[#A15A00]">{debugError}</div>}
        </div>
      </div>
    );
  }

  if (!isAdmin) {
    return <Navigate to="/admin/login" replace state={{ reason: profile ? 'no-access' : 'signed-out' }} />;
  }

  return <Outlet />;
}

import { useEffect, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { Profile } from '../types';

type AuthMode = 'signup' | 'login';

export default function AdminLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mode, setMode] = useState<AuthMode>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let alive = true;

    async function resolveAuthState() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;

        if (!session) {
          if (alive) {
            setProfile(null);
            setChecking(false);
          }
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        setProfile(nextProfile);

        if (nextProfile?.is_admin) {
          navigate('/admin', { replace: true });
        } else {
          setChecking(false);
        }
      } catch {
        if (alive) {
          setProfile(null);
          setChecking(false);
        }
      }
    }

    resolveAuthState();

    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!alive) return;

      if (!session) {
        setProfile(null);
        setChecking(false);
        return;
      }

      try {
        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        setProfile(nextProfile);

        if (nextProfile?.is_admin) {
          navigate('/admin', { replace: true });
        } else {
          setChecking(false);
        }
      } catch {
        if (alive) {
          setProfile(null);
          setChecking(false);
        }
      }
    });

    return () => {
      alive = false;
      listener.subscription.unsubscribe();
    };
  }, [navigate]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }
      setInfo('Account created. Sign in after email confirmation if Supabase requires it.');
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  };

  const reason = (location.state as { reason?: string } | null)?.reason;
  const isSignedInButNotAdmin = Boolean(profile && !profile.is_admin);

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <div className="text-[#5F5E5A]">Checking admin access...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D3D1C7] shadow-sm p-6 sm:p-8">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Admin</h1>
        <p className="mt-1 text-sm text-[#5F5E5A]">Sign in to review submissions and publish jobs.</p>

        <div className="mt-5 flex gap-2 p-1 rounded-xl bg-[#F1EFE8] border border-[#D3D1C7]">
          <button type="button" onClick={() => setMode('signup')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#5F5E5A]'}`}>
            Create account
          </button>
          <button type="button" onClick={() => setMode('login')}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#5F5E5A]'}`}>
            Sign in
          </button>
        </div>

        {reason === 'no-access' && (
          <div className="mt-4 rounded-lg border border-[#F0D080] bg-[#FFF8E6] px-3 py-2 text-sm text-[#7A5000]">
            You are signed in, but this account is not admin yet.
          </div>
        )}

        {isSignedInButNotAdmin && (
          <div className="mt-4 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] px-3 py-2 text-sm text-[#5F5E5A]">
            Signed in already. If this is the first admin account, use the claim button below.
          </div>
        )}

        {info && (
          <div className="mt-4 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] px-3 py-2 text-sm text-[#5F5E5A]">
            {info}
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-lg border border-[#F0D080] bg-[#FFF8E6] px-3 py-2 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <form onSubmit={handleAuth} className="mt-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">Email</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-[#D3D1C7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1D9E75]"
              placeholder="admin@company.com" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#D3D1C7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1D9E75]"
              placeholder="••••••••" />
          </div>
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white hover:bg-[#168a63] transition-colors disabled:opacity-60">
            {mode === 'signup' ? <UserPlus size={16} /> : <LogIn size={16} />}
            {loading ? 'Please wait...' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <Link to="/" className="text-[#1D9E75] hover:underline">Back to site</Link>
        </div>
      </div>
    </div>
  );
}

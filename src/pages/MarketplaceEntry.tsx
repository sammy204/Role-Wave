import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, LogIn, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { withTimeout } from '../lib/withTimeout';
import type { Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

type AuthMode = 'signup' | 'login';
type MarketplaceRole = 'candidate' | 'employer';

export default function MarketplaceEntry() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [mode, setMode] = useState<AuthMode>(
    searchParams.get('mode') === 'login' ? 'login' : 'signup'
  );
  const [role, setRole] = useState<MarketplaceRole>(
    searchParams.get('role') === 'employer' ? 'employer' : 'candidate'
  );
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    async function resolveSession() {
      try {
        if (!session) {
          if (alive) setChecking(false);
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        setProfile(nextProfile);
        const nextRole = nextProfile?.account_type === 'employer' ? 'employer' : 'candidate';
        setRole(nextRole);

        if (nextProfile?.onboarding_completed) {
          navigate(nextRole === 'employer' ? '/employer/dashboard' : '/candidate/dashboard', {
            replace: true,
          });
          return;
        }

        navigate(nextRole === 'employer' ? '/employer/onboarding' : '/candidate', {
          replace: true,
        });
      } catch {
        if (alive) setChecking(false);
      }
    }

    resolveSession();

    return () => {
      alive = false;
    };
  }, [authLoading, navigate, session]);

  const handleGoogle = async () => {
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { error: googleError } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/start?mode=login`,
        },
      });

      if (googleError) throw googleError;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Google sign-in failed.');
      setLoading(false);
    }
  };

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      if (mode === 'signup') {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              account_type: role,
            },
          },
        });

        if (signUpError) throw signUpError;

        const { data: postSignUpSession } = await withTimeout(
          supabase.auth.getSession(),
          6000,
          'Session lookup'
        );
        if (postSignUpSession.session) {
          const nextProfile = await fetchProfile(postSignUpSession.session.user.id);
          const nextRole = nextProfile?.account_type === 'employer' ? 'employer' : role;
          navigate(
            nextProfile?.onboarding_completed
              ? nextRole === 'employer'
                ? '/employer/dashboard'
                : '/candidate/dashboard'
              : nextRole === 'employer'
                ? '/employer/onboarding'
                : '/candidate',
            { replace: true }
          );
          return;
        }

        setInfo('Account created. Check your email to confirm your account, then sign in.');
        return;
      }

      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      console.log('Sign in response:', JSON.stringify(signInData), JSON.stringify(signInError));

      if (signInError) throw signInError;

      const { data } = await withTimeout(supabase.auth.getSession(), 6000, 'Session lookup');
      const session = data.session;
      if (!session) return;

      const nextProfile = await fetchProfile(session.user.id);
      const nextRole = nextProfile?.account_type === 'employer' ? 'employer' : 'candidate';
      navigate(
        nextProfile?.onboarding_completed
          ? nextRole === 'employer'
            ? '/employer/dashboard'
            : '/candidate/dashboard'
          : nextRole === 'employer'
            ? '/employer/onboarding'
            : '/candidate',
        { replace: true }
      );
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[980px]">
        <div className="mb-5 flex items-center justify-between gap-3">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] transition-colors hover:text-[#1A1A1A]"
          >
            <ArrowRight size={14} className="rotate-180" /> Back to home
          </Link>
          <div className="hidden rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041] sm:block">
            Job seeker first
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[32px] bg-[#1D9E75] p-6 text-white shadow-[0_24px_60px_rgba(29,158,117,0.18)] sm:p-8">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-white/70">
              <Briefcase size={12} /> RoleWave account
            </div>
            <h1 className="mt-4 font-display text-[30px] font-bold leading-[1.06] tracking-[-0.04em] sm:text-[42px]">
              sign in for job seekers.
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-relaxed text-white/75 sm:text-base">
              Sign up as a job seeker or employer
            </p>

            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Job seeker
                </div>
                <div className="mt-2 text-[14px] font-semibold leading-snug">
                  Create your profile, apply to roles, and keep your search in one place.
                </div>
              </div>
              <div className="rounded-[20px] border border-white/15 bg-white/10 p-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                  Login flow
                </div>
                <div className="mt-2 text-[14px] font-semibold leading-snug">
                  We detect your account type from your profile and send you to the right dashboard.
                </div>
              </div>
            </div>
          </div>

          <div className="panel rounded-[32px] p-5 sm:p-8">
            <div>
              <h2 className="text-2xl font-bold text-[#1A1A1A]">
                {mode === 'login' ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">
                {mode === 'login'
                  ? 'Sign in and we will route you automatically based on your account.'
                  : 'Pick a role first, then create your account.'}
              </p>
            </div>

            <div className="mt-5 flex gap-2 rounded-2xl border border-[#D3D1C7] bg-[#F1EFE8] p-1.5">
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`flex-1 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'signup' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#5F5E5A]'
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`flex-1 rounded-[14px] px-3 py-2 text-sm font-semibold transition-colors ${
                  mode === 'login' ? 'bg-white text-[#1A1A1A] shadow-sm' : 'text-[#5F5E5A]'
                }`}
              >
                Log in
              </button>
            </div>

            {mode === 'signup' && (
              <div className="mt-5">
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                  Sign up as
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => setRole('candidate')}
                    className={`rounded-[20px] border p-4 text-left transition-colors ${
                      role === 'candidate'
                        ? 'border-[#5DCAA5] bg-[#E1F5EE] text-[#085041]'
                        : 'border-[#D3D1C7] bg-[#FBFAF7] text-[#1A1A1A] hover:border-[#5DCAA5]'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      Job seeker
                    </div>
                    <div className="mt-2 text-[14px] font-semibold leading-snug">
                      Browse jobs, save your profile, and apply for roles.
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('employer')}
                    className={`rounded-[20px] border p-4 text-left transition-colors ${
                      role === 'employer'
                        ? 'border-[#5DCAA5] bg-[#E1F5EE] text-[#085041]'
                        : 'border-[#D3D1C7] bg-[#FBFAF7] text-[#1A1A1A] hover:border-[#5DCAA5]'
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">
                      Employer
                    </div>
                    <div className="mt-2 text-[14px] font-semibold leading-snug">
                      Create a company account and post jobs later.
                    </div>
                  </button>
                </div>
              </div>
            )}

            {profile && (
              <div className="mt-4 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm text-[#5F5E5A]">
                Signed in as {profile.full_name || 'member'}.
              </div>
            )}

            {info && (
              <div className="mt-4 rounded-2xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-sm text-[#085041]">
                {info}
              </div>
            )}

            {error && (
              <div className="mt-4 rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
                {error}
              </div>
            )}

            <form className="mt-5 space-y-4" onSubmit={handleAuth}>
              {mode === 'signup' && (
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                    Full name
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="field-shell"
                    placeholder="Samuel Ade"
                    required
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="field-shell"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="field-shell"
                  placeholder="••••••••"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
              >
                {mode === 'signup' ? <UserPlus size={16} /> : <LogIn size={16} />}
                {loading ? <LoadingSpinner size={16} className="text-[#1A1A1A]" label="Submitting" /> : mode === 'signup' ? 'Create account' : 'Sign in'}
              </button>
            </form>

            <div className="mt-4">
              <button
  type="button"
  onClick={handleGoogle}
  disabled={loading || (mode === 'signup' && role === 'employer')}
  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-[#D3D1C7] bg-white px-4 py-3 text-sm font-semibold text-[#1A1A1A] transition-colors hover:border-[#5DCAA5] hover:text-[#085041] disabled:cursor-not-allowed disabled:opacity-60"
>
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
    <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
    <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
    <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
  </svg>
  Continue with Google
</button>
              {mode === 'signup' && role === 'employer' && (
                <p className="mt-2 text-xs leading-relaxed text-[#5F5E5A]">
                  Google sign up is being kept simple for job seekers first. Employer accounts can use email and password for now.
                </p>
              )}
            </div>

            <div className="mt-5 flex items-center justify-between text-sm">
              <Link to="/" className="text-[#1D9E75] hover:underline">
                Back to home
              </Link>
              
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

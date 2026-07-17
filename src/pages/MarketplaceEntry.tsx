import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Briefcase, Building2, LogIn, UserPlus } from 'lucide-react';
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
  const [mode, setMode] = useState<AuthMode>(searchParams.get('mode') === 'login' ? 'login' : 'signup');
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
  const isSignup = mode === 'signup';

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

  const perforationHorizontal: React.CSSProperties = {
    backgroundImage: 'radial-gradient(circle, #D3D1C7 1.6px, transparent 1.8px)',
    backgroundSize: '14px 100%',
    backgroundRepeat: 'repeat-x',
  };

  if (checking) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="auth-fade-up w-full max-w-sm rounded-2xl border border-line bg-white px-6 py-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-line bg-paper text-accent">
            <LoadingSpinner className="text-accent" />
          </div>
          <div className="mt-4 font-display text-lg font-semibold text-ink">Preparing your workspace</div>
          <p className="mt-2 text-sm text-muted">
            We are checking your account and routing you to the right place.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-[480px]">
        <div className="mb-4 flex justify-start px-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/78 px-3 py-2 text-[13px] text-muted shadow-[0_10px_24px_rgba(26,26,26,0.04)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-[1px] hover:border-accent hover:text-ink"
          >
            <ArrowRight size={14} className="rotate-180" /> Back to home
          </Link>
        </div>

        <section className="auth-fade-up overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(26,26,26,0.08)] backdrop-blur-xl">
          {/* Masthead band */}
          <div className="flex items-center justify-between gap-4 bg-[#0E3A2E] px-5 py-3.5 sm:px-7">
            <div className="flex items-baseline gap-2.5 min-w-0">
              <span className="font-display whitespace-nowrap text-[15px] font-semibold uppercase tracking-[0.08em] text-white">
                RoleWave
              </span>
            
            </div>
            <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.1em] text-[#6FD9AE]">
              {isSignup ? 'New membership' : 'Returning'}
            </span>
          </div>
          <p className="bg-[#0E3A2E] px-5 pb-3.5 text-[13px] leading-snug text-[#CFEEE1] sm:px-7">
           
          </p>

          {/* Perforation */}
          <div className="h-px" style={perforationHorizontal} />

          {/* Form side */}
          <div className="px-5 py-5 sm:px-7 sm:py-6">
            <div className="relative flex rounded-2xl border border-line bg-paper/70 p-1 shadow-[inset_0_1px_2px_rgba(26,26,26,0.04)] backdrop-blur-md">
              <div
                className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-xl border border-white/70 bg-white/90 shadow-[0_10px_30px_rgba(26,26,26,0.1)] backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: isSignup ? 'translateX(0)' : 'translateX(calc(100% + 4px))' }}
              />
              <button
                type="button"
                onClick={() => setMode('signup')}
                className={`relative z-10 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  isSignup ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                Sign up
              </button>
              <button
                type="button"
                onClick={() => setMode('login')}
                className={`relative z-10 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                  !isSignup ? 'text-ink' : 'text-muted hover:text-ink'
                }`}
              >
                Log in
              </button>
            </div>

            <div key={mode} className="auth-fade-up mt-5">
              <div className="max-w-sm">
                <h2 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink sm:text-[32px]">
                  {isSignup ? 'Create your account' : 'Sign in'}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {isSignup ? 'Pick a role first, then fill in the essentials.' : 'Your details are saved and the dashboard is waiting.'}
                </p>
              </div>

              {isSignup && (
                <div className="mt-4">
                  <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">
                    Sign up as
                  </div>
                  <div className="flex flex-col gap-2">
                    <button
                      type="button"
                      onClick={() => setRole('candidate')}
                      className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl border p-2.5 text-left backdrop-blur-md transition-all duration-200 ${
                        role === 'candidate'
                          ? 'border-accent bg-white/85 text-ink shadow-[0_10px_24px_rgba(29,158,117,0.1)]'
                          : 'border-white/70 bg-white/60 text-ink hover:-translate-y-[1px] hover:border-accent/60 hover:bg-white/80 hover:shadow-[0_10px_24px_rgba(26,26,26,0.05)]'
                      }`}
                    >
                      <Briefcase
                        size={16}
                        className={`mt-0.5 shrink-0 ${role === 'candidate' ? 'text-accent' : 'text-muted'}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug">Job seeker</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          Browse jobs, save your profile, and apply with less friction.
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRole('employer')}
                      className={`flex w-full min-w-0 items-start gap-2.5 rounded-xl border p-2.5 text-left backdrop-blur-md transition-all duration-200 ${
                        role === 'employer'
                          ? 'border-accent bg-white/85 text-ink shadow-[0_10px_24px_rgba(29,158,117,0.1)]'
                          : 'border-white/70 bg-white/60 text-ink hover:-translate-y-[1px] hover:border-accent/60 hover:bg-white/80 hover:shadow-[0_10px_24px_rgba(26,26,26,0.05)]'
                      }`}
                    >
                      <Building2
                        size={16}
                        className={`mt-0.5 shrink-0 ${role === 'employer' ? 'text-accent' : 'text-muted'}`}
                      />
                      <span className="min-w-0">
                        <span className="block text-[14px] font-semibold leading-snug">Employer</span>
                        <span className="mt-1 block text-xs leading-relaxed text-muted">
                          Create a company account and post jobs later.
                        </span>
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {profile && (
                <div className="mt-4 rounded-xl border border-line bg-paper px-4 py-3 text-sm text-muted">
                  Signed in as {profile.full_name || 'member'}.
                </div>
              )}

              {info && (
                <div className="mt-4 rounded-xl border border-accent bg-paper px-4 py-3 text-sm text-accent">
                  {info}
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
                  {error}
                </div>
              )}

              <form className="mt-4 space-y-3" onSubmit={handleAuth}>
                {isSignup && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
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
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-shell"
                    placeholder="Enter password"
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <LoadingSpinner size={16} className="text-white" label="Submitting" />
                  ) : isSignup ? (
                    <UserPlus size={16} />
                  ) : (
                    <LogIn size={16} />
                  )}
                  <span>{isSignup ? 'Create account' : 'Sign in'}</span>
                </button>
              </form>

              <div className="mt-3">
                <button
                  type="button"
                  onClick={handleGoogle}
                  disabled={loading || (isSignup && role === 'employer')}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {loading ? (
                    <LoadingSpinner size={16} className="text-ink" label="Signing in with Google" />
                  ) : (
                    <>
                      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                        <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
                        <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
                        <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
                        <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
                      </svg>
                      Continue with Google
                    </>
                  )}
                </button>
                {isSignup && role === 'employer' && (
                  <p className="mt-2 text-xs leading-relaxed text-muted">
                    Employer accounts can use email and password for now.
                  </p>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { withTimeout } from '../lib/withTimeout';
import type { Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { SignIn, ForgotPasswordForm } from './SignIn';
import { SignUp } from './Signup';

export type AuthMode = 'signup' | 'login' | 'forgot';
export type MarketplaceRole = 'candidate' | 'employer';

export function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}

export default function AuthLayout() {
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
  const [resetSent, setResetSent] = useState(false);
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

        if (nextProfile?.account_status === 'deletion_scheduled') {
          const { error: reactivationError } = await supabase.functions.invoke('reactivate-account');
          if (reactivationError) throw reactivationError;
          const restoredProfile = await fetchProfile(session.user.id);
          if (!alive) return;
          setProfile(restoredProfile);
          navigate(restoredProfile?.account_type === 'employer' ? '/employer/dashboard' : '/candidate/dashboard?reactivated=1', { replace: true });
          return;
        }

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

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError('');
    setInfo('');
    setResetSent(false);
  };

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
            emailRedirectTo: `${window.location.origin}/confirmed`,
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

      if (signInError) throw signInError;

      const { data } = await withTimeout(supabase.auth.getSession(), 6000, 'Session lookup');
      const activeSession = data.session;
      if (!activeSession) return;

      const nextProfile = await fetchProfile(activeSession.user.id);
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

      void signInData;
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Authentication failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    try {
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (resetError) throw resetError;

      setResetSent(true);
      setInfo('Check your email for a password reset link.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send reset email.');
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

  const messageBanners = (
    <>
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
    </>
  );

  const signInPanel =
    mode === 'forgot' ? (
      <ForgotPasswordForm
        email={email}
        setEmail={setEmail}
        loading={loading}
        resetSent={resetSent}
        onSubmit={handleForgotPassword}
        onBack={() => switchMode('login')}
        messageBanners={messageBanners}
      />
    ) : (
      <SignIn
        email={email}
        setEmail={setEmail}
        password={password}
        setPassword={setPassword}
        loading={loading}
        onSubmit={handleAuth}
        onGoogle={handleGoogle}
        onForgotClick={() => switchMode('forgot')}
        messageBanners={messageBanners}
      />
    );

  const signUpPanel = (
    <SignUp
      fullName={fullName}
      setFullName={setFullName}
      email={email}
      setEmail={setEmail}
      password={password}
      setPassword={setPassword}
      role={role}
      setRole={setRole}
      loading={loading}
      onSubmit={handleAuth}
      onGoogle={handleGoogle}
      messageBanners={messageBanners}
    />
  );

  return (
    <div className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <div className="relative z-10 mx-auto w-full max-w-3xl">
        <div className="mb-4 flex justify-start px-1">
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full border border-white/70 bg-white/78 px-3 py-2 text-[13px] text-muted shadow-[0_10px_24px_rgba(26,26,26,0.04)] backdrop-blur-xl transition-all duration-200 hover:-translate-y-[1px] hover:border-accent hover:text-ink"
          >
            <ArrowRight size={14} className="rotate-180" /> Back to home
          </Link>
        </div>

        {/* ============ DESKTOP: sliding overlay panel ============ */}
        <section className="auth-fade-up relative hidden overflow-hidden rounded-2xl border border-white/70 bg-white shadow-[0_20px_60px_rgba(26,26,26,0.08)] backdrop-blur-xl md:block">
          <div className="relative" style={{ minHeight: 560 }}>
            {/* Sign-in / forgot panel — fixed on the left */}
            <div
              className="absolute inset-y-0 left-0 flex w-1/2 items-center justify-center overflow-y-auto px-10 py-10 transition-opacity duration-500"
              style={{ opacity: isSignup ? 0 : 1, pointerEvents: isSignup ? 'none' : 'auto' }}
            >
              {signInPanel}
            </div>

            {/* Sign-up panel — fixed on the right */}
            <div
              className="absolute inset-y-0 right-0 flex w-1/2 items-center justify-center overflow-y-auto px-10 py-10 transition-opacity duration-500"
              style={{ opacity: isSignup ? 1 : 0, pointerEvents: isSignup ? 'auto' : 'none' }}
            >
              {signUpPanel}
            </div>

            {/* Teal overlay — slides across, always covering the inactive side */}
            <div
              className="absolute inset-y-0 z-30 flex w-1/2 flex-col items-center justify-center bg-[#0E3A2E] px-8 text-center transition-transform duration-700 ease-in-out"
              style={{ transform: isSignup ? 'translateX(0%)' : 'translateX(100%)' }}
            >
              <div className="mb-4 inline-flex -translate-y-8 items-center justify-center">
                <img src="/rolewave-icon.png" alt="RoleWave" className="h-12 w-12 object-contain" />
              </div>

              {isSignup ? (
                <div key="welcome-back" className="auth-fade-up">
                  <h3 className="font-display text-2xl font-semibold text-white">Welcome Back!</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#CFEEE1]">
                    To keep connected with us, please sign in with your personal info.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-white/70 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10"
                  >
                    Sign in
                  </button>
                </div>
              ) : (
                <div key="hello-friend" className="auth-fade-up">
                  <h3 className="font-display text-2xl font-semibold text-white">Hello, Friend!</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#CFEEE1]">
                    Enter your details and start your journey with RoleWave.
                  </p>
                  <button
                    type="button"
                    onClick={() => switchMode('signup')}
                    className="mt-6 inline-flex items-center justify-center rounded-full border border-white/70 px-6 py-2.5 text-sm font-semibold text-white transition-colors duration-150 hover:bg-white/10"
                  >
                    Sign up
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ============ MOBILE: stacked pill-tab card (no room to slide) ============ */}
        <section className="auth-fade-up overflow-hidden rounded-2xl border border-white/70 bg-white/80 shadow-[0_20px_60px_rgba(26,26,26,0.08)] backdrop-blur-xl md:hidden">
          <div className="relative flex items-center justify-end gap-4 bg-[#0E3A2E] px-5 py-3.5 sm:px-7">
            <img
              src="/rolewave-icon.png"
              alt="RoleWave"
              className="absolute left-1/2 h-9 w-9 -translate-x-1/2 rounded-[10px]"
            />
            <span className="whitespace-nowrap text-[11px] font-medium uppercase tracking-[0.1em] text-[#6FD9AE]">
              {mode === 'forgot' ? 'Reset password' : isSignup ? 'New membership' : 'Returning'}
            </span>
          </div>

          <div className="h-px" style={perforationHorizontal} />

          <div className="px-5 py-5 sm:px-7 sm:py-6">
            {mode !== 'forgot' && (
              <div className="relative flex rounded-2xl border border-line bg-paper/70 p-1 shadow-[inset_0_1px_2px_rgba(26,26,26,0.04)] backdrop-blur-md">
                <div
                  className="absolute left-1 top-1 h-[calc(100%-8px)] w-[calc(50%-4px)] rounded-xl border border-white/70 bg-white/90 shadow-[0_10px_30px_rgba(26,26,26,0.1)] backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                  style={{ transform: isSignup ? 'translateX(0)' : 'translateX(calc(100% + 4px))' }}
                />
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`relative z-10 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    isSignup ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  Sign up
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`relative z-10 flex-1 whitespace-nowrap rounded-xl px-3 py-2.5 text-sm font-semibold transition-colors duration-200 ${
                    !isSignup ? 'text-ink' : 'text-muted hover:text-ink'
                  }`}
                >
                  Log in
                </button>
              </div>
            )}

            <div key={mode} className="auth-fade-up mt-5">
              {mode === 'forgot' ? signInPanel : mode === 'signup' ? signUpPanel : signInPanel}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, Check, ChevronLeft, Eye, EyeOff, Linkedin } from 'lucide-react';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import { withTimeout } from '../lib/withTimeout';
import type { Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { validatePassword } from '../lib/passwordPolicy';
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
  const isPwa = useIsPwa();
  const isSignup = mode === 'signup';

  // Cloudflare Turnstile — single token shared across the sign-in/sign-up/forgot
  // form (only one is ever visible at a time), cleared after every submit
  // attempt and on mode switch since tokens are single-use.
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);
  const resetCaptcha = () => {
    setCaptchaToken('');
    turnstileRef.current?.reset();
  };

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
    resetCaptcha();
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
        const passwordError = validatePassword(password);
        if (passwordError) {
          setError(passwordError);
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              account_type: role,
            },
            emailRedirectTo: `${window.location.origin}/confirmed`,
            captchaToken,
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
        options: { captchaToken },
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
      resetCaptcha();
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
        captchaToken,
      });

      if (resetError) throw resetError;

      setResetSent(true);
      setInfo('Check your email for a password reset link.');
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : 'Could not send reset email.');
    } finally {
      setLoading(false);
      resetCaptcha();
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

  if (isPwa || !isPwa) {
    return (
      <PwaAuthCard
        isPwa={isPwa}
        mode={mode}
        role={role}
        fullName={fullName}
        email={email}
        password={password}
        loading={loading}
        resetSent={resetSent}
        info={info}
        error={error}
        setFullName={setFullName}
        setEmail={setEmail}
        setPassword={setPassword}
        setRole={setRole}
        switchMode={switchMode}
        onSubmit={handleAuth}
        onForgotPassword={handleForgotPassword}
        onGoogle={handleGoogle}
        onBack={() => navigate('/welcome')}
        turnstileRef={turnstileRef}
        onCaptchaVerify={setCaptchaToken}
      />
    );
  }

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

type PwaAuthCardProps = {
  isPwa: boolean;
  mode: AuthMode;
  role: MarketplaceRole;
  fullName: string;
  email: string;
  password: string;
  loading: boolean;
  resetSent: boolean;
  info: string;
  error: string;
  setFullName: (value: string) => void;
  setEmail: (value: string) => void;
  setPassword: (value: string) => void;
  setRole: (value: MarketplaceRole) => void;
  switchMode: (next: AuthMode) => void;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onForgotPassword: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
  onBack: () => void;
  turnstileRef: React.RefObject<TurnstileInstance>;
  onCaptchaVerify: (token: string) => void;
};

function PwaAuthCard({
  isPwa,
  mode,
  role,
  fullName,
  email,
  password,
  loading,
  resetSent,
  info,
  error,
  setFullName,
  setEmail,
  setPassword,
  setRole,
  switchMode,
  onSubmit,
  onForgotPassword,
  onGoogle,
  onBack,
  turnstileRef,
  onCaptchaVerify,
}: PwaAuthCardProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const isSignup = mode === 'signup';
  const isForgot = mode === 'forgot';

  useEffect(() => {
    if (!isSignup) setAcceptedTerms(false);
  }, [isSignup]);

  return (
    <main
      className={`relative flex min-h-[100dvh] bg-[#E9F0EA] ${
        isPwa
          ? 'items-stretch justify-stretch overflow-hidden px-0 py-0'
          : 'items-stretch justify-stretch overflow-y-auto px-0 py-0'
      }`}
      style={
        isPwa
          ? {
              paddingTop: 'env(safe-area-inset-top)',
              paddingBottom: 'env(safe-area-inset-bottom)',
            }
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-24 h-80 w-80 rounded-full bg-[#1D9E75]/20 blur-3xl" />
        <div className="absolute -bottom-32 -right-24 h-96 w-96 rounded-full bg-[#5B4088]/15 blur-3xl" />
      </div>

      <section
        className={`relative z-10 flex w-full max-w-none flex-col bg-[#FBFAF7]/80 backdrop-blur-2xl ${
          isPwa ? 'h-screen min-h-[100dvh] overflow-hidden' : 'min-h-screen overflow-visible'
        }`}
      >
        <header className="mx-auto flex w-full max-w-md shrink-0 items-center justify-between px-5 pb-3 pt-5 sm:px-7">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to welcome"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/80 bg-white/70 text-[#1A1A1A] shadow-sm transition-transform active:scale-95"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <img src="/rolewave-icon.png" alt="RoleWave" className="h-8 w-8 rounded-xl object-contain shadow-[0_8px_18px_rgba(29,158,117,.2)]" />
            <span className="font-display text-lg font-semibold text-[#1A1A1A]">RoleWave</span>
          </div>
          <div className="w-9" />
        </header>

        <div
          className={`mx-auto w-full max-w-md px-5 sm:px-7 ${
            isPwa ? 'min-h-0 overflow-hidden pb-4 sm:pb-6' : 'overflow-visible pb-8 sm:pb-10'
          }`}
        >
          <div key={mode} className="auth-fade-up">
            <div className="pt-2">
              <p className="text-[10px] font-bold uppercase tracking-[1.8px] text-[#1D9E75]">
                {isForgot ? 'Account recovery' : isSignup ? 'Start your journey' : 'Welcome back'}
              </p>
              <h1 className="font-display mt-2 text-[34px] leading-[1.02] text-[#1A1A1A]">
                {isForgot ? 'Reset your password' : isSignup ? 'Create your account' : 'Good to see you.'}
              </h1>
              <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">
                {isForgot
                  ? 'Enter your email and we will send you a secure reset link.'
                  : isSignup
                    ? 'Real roles, verified employers, one profile.'
                    : 'Sign in to pick up right where you left off.'}
              </p>
            </div>

            {!isForgot && (
              <div className="relative mt-6 flex rounded-2xl border border-white/90 bg-[#E9EDE7]/80 p-1 shadow-inner">
                <div
                  className="absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-xl bg-white shadow-[0_8px_20px_rgba(26,26,26,.08)] transition-transform duration-300 ease-out"
                  style={{ transform: isSignup ? 'translateX(100%)' : 'translateX(0)' }}
                />
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  className={`relative z-10 flex-1 rounded-xl py-2.5 text-sm font-bold ${!isSignup ? 'text-[#0F6E56]' : 'text-[#8A867E]'}`}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  className={`relative z-10 flex-1 rounded-xl py-2.5 text-sm font-bold ${isSignup ? 'text-[#0F6E56]' : 'text-[#8A867E]'}`}
                >
                  Sign up
                </button>
              </div>
            )}

            {isForgot ? (
              <form className="mt-6" onSubmit={onForgotPassword}>
                <PwaField label="Email" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
                {resetSent && <PwaNotice tone="success">{info || 'Check your email for a password reset link.'}</PwaNotice>}
                {error && <PwaNotice tone="error">{error}</PwaNotice>}
                {!resetSent && <TurnstileWidget ref={turnstileRef} onVerify={onCaptchaVerify} />}
                <button type="submit" disabled={loading} className="pwa-primary-button mt-5">
                  {loading ? 'Sending reset link…' : 'Send reset link'} <ArrowRight size={17} />
                </button>
                <button type="button" onClick={() => switchMode('login')} className="mt-4 w-full text-sm font-semibold text-[#0F6E56]">
                  Back to sign in
                </button>
              </form>
            ) : (
              <form className="mt-6" onSubmit={onSubmit}>
                {isSignup && (
                  <div className="mb-5">
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[1.3px] text-[#5F5E5A]">I’m here to</label>
                    <div className="grid grid-cols-2 gap-2.5">
                      <PwaRoleButton active={role === 'candidate'} onClick={() => setRole('candidate')} title="Find work" subtitle="I’m a candidate" />
                      <PwaRoleButton active={role === 'employer'} onClick={() => setRole('employer')} title="Hire talent" subtitle="I’m an employer" employer />
                    </div>
                  </div>
                )}

                {isSignup && <PwaField label="Full name" value={fullName} onChange={setFullName} placeholder="First Last" />}
                <PwaField label="Email" value={email} onChange={setEmail} type="email" placeholder="you@email.com" />
                <div className="mt-4">
                  <label className="mb-2 block text-[10px] font-bold uppercase tracking-[1.3px] text-[#5F5E5A]">Password</label>
                  <div className="flex items-center rounded-2xl border border-[#D3D1C7] bg-white/85 px-4 transition-colors focus-within:border-[#1D9E75] focus-within:ring-4 focus-within:ring-[#1D9E75]/10">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-transparent py-3.5 text-sm text-[#1A1A1A] outline-none placeholder:text-[#B4B2A9]"
                      required
                    />
                    <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="text-[#5F5E5A]">
                      {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                    </button>
                  </div>
                  <p className="mt-2 text-[11px] leading-5 text-[#7A766F]">
                    Must contain at least one lowercase letter, one uppercase letter, and one number.
                  </p>
                </div>

                {!isSignup && (
                  <button type="button" onClick={() => switchMode('forgot')} className="mt-3 block w-full text-right text-xs font-semibold text-[#0F6E56]">
                    Forgot password?
                  </button>
                )}

                {info && <PwaNotice tone="success">{info}</PwaNotice>}
                {error && <PwaNotice tone="error">{error}</PwaNotice>}

                {isSignup && (
                  <label className="mt-5 flex cursor-pointer items-start gap-2.5 text-xs leading-5 text-[#5F5E5A]">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(event) => setAcceptedTerms(event.target.checked)}
                      required
                      className="mt-1 h-4 w-4 shrink-0 accent-[#1D9E75]"
                    />
                    <span>
                      I agree to RoleWave&apos;s{' '}
                      <Link to="/terms" className="font-semibold text-[#0F6E56] underline underline-offset-2">
                        Terms &amp; Conditions
                      </Link>{' '}
                      and{' '}
                      <Link to="/privacy" className="font-semibold text-[#0F6E56] underline underline-offset-2">
                        Privacy Policy
                      </Link>
                      .
                    </span>
                  </label>
                )}

                <TurnstileWidget ref={turnstileRef} onVerify={onCaptchaVerify} />

                <button type="submit" disabled={loading || (isSignup && !acceptedTerms)} className="pwa-primary-button mt-5">
                  {loading ? 'Please wait…' : isSignup ? 'Create account' : 'Sign in'} <ArrowRight size={17} />
                </button>

                <div className="my-5 flex items-center gap-3">
                  <div className="h-px flex-1 bg-[#D3D1C7]" />
                  <span className="text-[10px] font-semibold uppercase tracking-[1px] text-[#B4B2A9]">or continue with</span>
                  <div className="h-px flex-1 bg-[#D3D1C7]" />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button type="button" onClick={onGoogle} disabled={loading} className="flex items-center justify-center gap-2 rounded-2xl border border-[#D3D1C7] bg-white/80 py-3.5 text-sm font-semibold text-[#1A1A1A] transition-colors hover:bg-white">
                    <GoogleIcon /> Google
                  </button>
                  <button type="button" disabled className="flex items-center justify-center gap-2 rounded-2xl border border-[#D3D1C7] bg-white/60 py-3.5 text-sm font-semibold text-[#1A1A1A] opacity-75">
                    <Linkedin size={17} className="text-[#0A66C2]" /> LinkedIn
                  </button>
                </div>

                <p className="mt-5 text-center text-sm text-[#5F5E5A]">
                  {isSignup ? 'Already have an account?' : 'New to RoleWave?'}{' '}
                  <button type="button" onClick={() => switchMode(isSignup ? 'login' : 'signup')} className="font-bold text-[#0F6E56]">
                    {isSignup ? 'Sign in' : 'Sign up'}
                  </button>
                </p>
              </form>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

function PwaField({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  placeholder: string;
}) {
  return (
    <label className="mb-4 block">
      <span className="mb-2 block text-[10px] font-bold uppercase tracking-[1.3px] text-[#5F5E5A]">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-full rounded-2xl border border-[#D3D1C7] bg-white/85 px-4 py-3.5 text-sm text-[#1A1A1A] outline-none transition-colors placeholder:text-[#B4B2A9] focus:border-[#1D9E75] focus:ring-4 focus:ring-[#1D9E75]/10"
        required
      />
    </label>
  );
}

function PwaRoleButton({
  active,
  onClick,
  title,
  subtitle,
  employer = false,
}: {
  active: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
  employer?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-2xl border px-3 py-3 text-left transition-all ${
        active
          ? employer
            ? 'border-[#E4BD62] bg-[#FAEEDA]'
            : 'border-[#5DCAA5] bg-[#E1F5EE]'
          : 'border-[#D3D1C7] bg-white/70'
      }`}
    >
      <span className={`flex items-center justify-between text-sm font-bold ${active ? (employer ? 'text-[#633806]' : 'text-[#085041]') : 'text-[#1A1A1A]'}`}>
        {title}
        {active && <Check size={15} />}
      </span>
      <span className="mt-1 block text-[11px] text-[#5F5E5A]">{subtitle}</span>
    </button>
  );
}

function PwaNotice({ tone, children }: { tone: 'success' | 'error'; children: React.ReactNode }) {
  return (
    <div className={`mt-4 rounded-2xl border px-4 py-3 text-xs leading-5 ${tone === 'success' ? 'border-[#8ED7BA] bg-[#E1F5EE] text-[#085041]' : 'border-[#F0D080] bg-[#FFF8E6] text-[#7A5000]'}`}>
      {children}
    </div>
  );
}

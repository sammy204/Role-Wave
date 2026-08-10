import { Eye, EyeOff, LogIn } from 'lucide-react';
import { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { GoogleIcon } from './AuthLayout';
import CodeEntry from '../components/CodeEntry';

interface SignInProps {
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
  onForgotClick: () => void;
  messageBanners: React.ReactNode;
}

export function SignIn({
  email,
  setEmail,
  password,
  setPassword,
  loading,
  onSubmit,
  onGoogle,
  onForgotClick,
  messageBanners,
}: SignInProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [useCode, setUseCode] = useState(false);
  const [code, setCode] = useState('');

  return (
    <div className="w-full max-w-sm">
      <h2 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
        Sign in
      </h2>
      <div className="mt-2 text-sm leading-relaxed text-muted">
        <div>Your details are saved and the dashboard is waiting.</div>
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setUseCode((s) => !s)}
            className="text-xs font-semibold text-accent hover:underline"
          >
            {useCode ? 'Use password instead' : 'Sign in with code'}
          </button>
        </div>
      </div>

      {messageBanners}

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
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

        {useCode ? (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">Code</label>
            <CodeEntry value={code} onChange={setCode} />
            <p className="mt-2 text-xs text-muted">We sent a 6-digit code to your email. Expires in 10 minutes.</p>
            <div className="mt-2 flex items-center justify-between">
              <button type="button" className="text-xs font-semibold text-accent hover:underline">Resend code</button>
              <button type="button" onClick={() => setUseCode(false)} className="text-xs text-muted hover:underline">Use password instead</button>
            </div>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
              Password
            </label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="field-shell pr-11"
                placeholder="Enter password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-muted transition-colors hover:text-ink"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <div className="mt-1.5 text-right">
              <button
                type="button"
                onClick={onForgotClick}
                className="text-xs font-semibold text-accent hover:underline"
              >
                Forgot password?
              </button>
            </div>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoadingSpinner size={16} className="text-white" label="Submitting" /> : <LogIn size={16} />}
          <span>Sign in</span>
        </button>
      </form>

      <div className="mt-3">
        <button
          type="button"
          onClick={onGoogle}
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition-colors duration-150 hover:border-accent disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <LoadingSpinner size={16} className="text-ink" label="Signing in with Google" />
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>
      </div>
    </div>
  );
}

interface ForgotPasswordFormProps {
  email: string;
  setEmail: (value: string) => void;
  loading: boolean;
  resetSent: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
  messageBanners: React.ReactNode;
}

export function ForgotPasswordForm({
  email,
  setEmail,
  loading,
  resetSent,
  onSubmit,
  onBack,
  messageBanners,
}: ForgotPasswordFormProps) {
  return (
    <div className="w-full max-w-sm">
      <h2 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
        Reset your password
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Enter the email on your account and we&apos;ll send you a reset link.
      </p>

      {messageBanners}

      {!resetSent && (
        <form className="mt-4 space-y-3" onSubmit={onSubmit}>
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

          <button
            type="submit"
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? <LoadingSpinner size={16} className="text-white" label="Sending" /> : 'Send reset link'}
          </button>
        </form>
      )}

      <button
        type="button"
        onClick={onBack}
        className="mt-4 text-sm font-semibold text-muted hover:text-ink"
      >
        ← Back to sign in
      </button>
    </div>
  );
}
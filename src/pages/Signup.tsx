import { Briefcase, Building2, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useState } from 'react';
import LoadingSpinner from '../components/LoadingSpinner';
import { GoogleIcon, type MarketplaceRole } from './AuthLayout';

interface SignUpProps {
  fullName: string;
  setFullName: (value: string) => void;
  email: string;
  setEmail: (value: string) => void;
  password: string;
  setPassword: (value: string) => void;
  role: MarketplaceRole;
  setRole: (role: MarketplaceRole) => void;
  loading: boolean;
  onSubmit: (event: React.FormEvent<HTMLFormElement>) => void;
  onGoogle: () => void;
  messageBanners: React.ReactNode;
}

export function SignUp({
  fullName,
  setFullName,
  email,
  setEmail,
  password,
  setPassword,
  role,
  setRole,
  loading,
  onSubmit,
  onGoogle,
  messageBanners,
}: SignUpProps) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <div className="w-full max-w-sm">
      <h2 className="font-display text-[28px] font-semibold leading-[1.05] tracking-[-0.02em] text-ink">
        Create your account
      </h2>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Pick a role first, then fill in the essentials.
      </p>

      <div className="mt-4">
        <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.5px] text-muted">Sign up as</div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setRole('candidate')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
              role === 'candidate'
                ? 'border-accent bg-white text-ink shadow-[0_10px_24px_rgba(29,158,117,0.1)]'
                : 'border-line bg-paper/60 text-muted hover:border-accent/60'
            }`}
          >
            <Briefcase size={14} className={role === 'candidate' ? 'text-accent' : 'text-muted'} />
            Job seeker
          </button>
          <button
            type="button"
            onClick={() => setRole('employer')}
            className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-2.5 py-2.5 text-xs font-semibold transition-all duration-200 ${
              role === 'employer'
                ? 'border-accent bg-white text-ink shadow-[0_10px_24px_rgba(29,158,117,0.1)]'
                : 'border-line bg-paper/60 text-muted hover:border-accent/60'
            }`}
          >
            <Building2 size={14} className={role === 'employer' ? 'text-accent' : 'text-muted'} />
            Employer
          </button>
        </div>
      </div>

      {messageBanners}

      <form className="mt-4 space-y-3" onSubmit={onSubmit}>
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
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            Must contain at least one lowercase letter, one uppercase letter, and one number.
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? <LoadingSpinner size={16} className="text-white" label="Submitting" /> : <UserPlus size={16} />}
          <span>Create account</span>
        </button>
      </form>

      <div className="mt-3">
        <button
          type="button"
          onClick={onGoogle}
          disabled={loading || role === 'employer'}
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
        {role === 'employer' && (
          <p className="mt-2 text-xs leading-relaxed text-muted">
            Employer accounts can use email and password for now.
          </p>
        )}
      </div>
    </div>
  );
}

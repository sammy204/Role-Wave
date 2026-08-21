import { useEffect, useState } from 'react';
import { Eye, EyeOff, CheckCircle2, KeyRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { getUserFacingError } from '../lib/userFacingError';
import LoadingSpinner from '../components/LoadingSpinner';

// Supabase's client has detectSessionInUrl enabled, so clicking the password
// reset email link parses the recovery tokens out of the URL and fires a
// PASSWORD_RECOVERY auth event, establishing a temporary recovery session
// before this component finishes mounting. We listen for that event (and
// fall back to checking for an existing session, in case it already fired
// before we subscribed) to confirm the link is valid before showing the
// form. If neither shows up in time, the link was likely invalid or expired.
const LINK_CHECK_TIMEOUT_MS = 6000;
const MIN_PASSWORD_LENGTH = 8;

export default function ResetPassword() {
  const [checkingLink, setCheckingLink] = useState(true);
  const [linkValid, setLinkValid] = useState(false);

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  useEffect(() => {
    let alive = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (!alive) return;
      if (event === 'PASSWORD_RECOVERY') {
        setLinkValid(true);
        setCheckingLink(false);
      }
    });

    // Fallback: the PASSWORD_RECOVERY event may have already fired before
    // this listener was attached, in which case there's simply an active
    // session already. Treat that as valid too.
    void (async () => {
      const { data } = await supabase.auth.getSession();
      if (!alive) return;
      if (data.session) {
        setLinkValid(true);
        setCheckingLink(false);
      }
    })();

    const timeout = window.setTimeout(() => {
      if (!alive) return;
      setCheckingLink((current) => {
        if (current) setLinkValid(false);
        return false;
      });
    }, LINK_CHECK_TIMEOUT_MS);

    return () => {
      alive = false;
      subscription.unsubscribe();
      window.clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      setDone(true);
    } catch (err) {
      setError(getUserFacingError(err, 'We couldn’t reset your password. Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="auth-fade-up w-full max-w-md rounded-2xl border border-white/70 bg-white px-6 py-10 text-center shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#1D9E75]">
          {checkingLink ? (
            <LoadingSpinner className="text-[#1D9E75]" size={28} />
          ) : done ? (
            <CheckCircle2 size={34} />
          ) : (
            <KeyRound size={28} />
          )}
        </div>

        {checkingLink && (
          <>
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Verifying your link
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
              One moment while we confirm this reset link...
            </p>
          </>
        )}

        {!checkingLink && !linkValid && (
          <>
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Link expired
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
              This password reset link is invalid or has expired. Request a new one to continue.
            </p>
            <Link
              to="/start?mode=login"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63]"
            >
              Back to sign in
            </Link>
          </>
        )}

        {!checkingLink && linkValid && done && (
          <>
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Password updated
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Your password has been changed. You can now sign in with your new password.
            </p>
            <Link
              to="/start?mode=login"
              className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63]"
            >
              Continue to sign in
            </Link>
          </>
        )}

        {!checkingLink && linkValid && !done && (
          <>
            <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Set a new password
            </h1>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
              Choose a new password for your account.
            </p>

            {error && (
              <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
                {error}
              </div>
            )}

            <form className="mt-6 space-y-3 text-left" onSubmit={handleSubmit}>
              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
                  New password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="field-shell pr-11"
                    placeholder="Enter new password"
                    autoComplete="new-password"
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
                <p className="mt-1.5 text-xs text-muted">At least {MIN_PASSWORD_LENGTH} characters.</p>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
                  Confirm password
                </label>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="field-shell"
                  placeholder="Re-enter new password"
                  autoComplete="new-password"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? <LoadingSpinner size={16} className="text-white" label="Updating" /> : 'Update password'}
              </button>
            </form>
          </>
        )}

      </section>
    </main>
  );
}
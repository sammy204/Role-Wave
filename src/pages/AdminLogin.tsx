import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { LogIn, ShieldCheck, UserPlus } from 'lucide-react';
import type { TurnstileInstance } from '@marsidev/react-turnstile';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import { validatePassword } from '../lib/passwordPolicy';
import { TurnstileWidget } from '../components/TurnstileWidget';

type AuthMode = 'signup' | 'login';
interface AdminInvitePreview {
  valid: boolean;
  email: string;
}
// 'none': no ?invite= param on the URL.
// 'checking': looking up the token via get_admin_invite_preview.
// 'valid': token is real, unused, unrevoked, unexpired — email is locked to invite.email.
// 'invalid': token doesn't exist, or is expired/revoked/already accepted.
type InviteStatus = 'none' | 'checking' | 'valid' | 'invalid';

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
  const [captchaToken, setCaptchaToken] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  const inviteToken = new URLSearchParams(location.search).get('invite');
  const [inviteStatus, setInviteStatus] = useState<InviteStatus>(inviteToken ? 'checking' : 'none');
  const [inviteEmail, setInviteEmail] = useState('');
  const [acceptingInvite, setAcceptingInvite] = useState(false);

  const resetCaptcha = () => {
    setCaptchaToken('');
    turnstileRef.current?.reset();
  };

  // Look up the invite token as soon as it's on the URL. This is a public,
  // narrow RPC (email + valid flag only) so it's safe to call before any
  // session exists.
  useEffect(() => {
    if (!inviteToken) {
      setInviteStatus('none');
      return;
    }

    let alive = true;
    setInviteStatus('checking');

    supabase
      .rpc('get_admin_invite_preview', { p_token: inviteToken })
      .maybeSingle()
      .then(
        ({ data, error: previewError }) => {
          if (!alive) return;
          const preview = data as AdminInvitePreview | null;
          if (previewError || !preview || !preview.valid) {
            setInviteStatus('invalid');
            return;
          }
          setInviteEmail(preview.email);
          setEmail(preview.email);
          setInviteStatus('valid');
        },
        () => {
          if (alive) setInviteStatus('invalid');
        }
      );

    return () => {
      alive = false;
    };
  }, [inviteToken]);

  // Once a session exists and there's a valid invite on the URL, try to
  // accept it. accept_admin_invite() re-checks everything server-side
  // (token validity, email match) — this is just wiring the result up.
  const tryAcceptInvite = async (userEmail: string | null | undefined) => {
    if (!inviteToken || inviteStatus !== 'valid') return false;

    setAcceptingInvite(true);
    setError('');

    try {
      const { data: accepted, error: acceptError } = await supabase.rpc('accept_admin_invite', {
        p_token: inviteToken,
      });
      if (acceptError) throw acceptError;

      if (accepted) {
        // This also covers invitees who already had a RoleWave login. New
        // account confirmations use Confirmed.tsx; the email function
        // deduplicates so either route is safe.
        await supabase.functions.invoke('send-admin-welcome', { body: { mode: 'self' } }).catch(() => {});
        navigate('/admin', { replace: true });
        return true;
      }

      setError(
        userEmail && userEmail.toLowerCase() !== inviteEmail.toLowerCase()
          ? `You're signed in as ${userEmail}, but this invite is for ${inviteEmail}. Sign out and try again with the invited address.`
          : 'This invite link is no longer valid. Ask a founder to send a new one.'
      );
      return false;
    } catch (acceptErr) {
      setError(acceptErr instanceof Error ? acceptErr.message : 'Could not accept the invite.');
      return false;
    } finally {
      setAcceptingInvite(false);
    }
  };

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
          return;
        }

        if (inviteToken && inviteStatus === 'valid') {
          const acceptedNow = await tryAcceptInvite(session.user.email);
          if (!alive || acceptedNow) return;
        }

        setChecking(false);
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
          return;
        }

        if (inviteToken && inviteStatus === 'valid') {
          const acceptedNow = await tryAcceptInvite(session.user.email);
          if (!alive || acceptedNow) return;
        }

        setChecking(false);
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
    // inviteStatus is intentionally included so a login/signup that happens
    // while the preview is still 'checking' re-evaluates once it resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, inviteToken, inviteStatus]);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setInfo('');

    if (mode === 'signup') {
      const passwordError = validatePassword(password);
      if (passwordError) {
        setError(passwordError);
        setLoading(false);
        resetCaptcha();
        return;
      }

      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          captchaToken,
          // Carry the invite token through email confirmation so Confirmed.tsx
          // can finish accept_admin_invite() and land on /admin, instead of
          // routing this brand-new account to the candidate dashboard.
          emailRedirectTo: inviteToken
            ? `${window.location.origin}/confirmed?invite=${inviteToken}`
            : undefined,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        resetCaptcha();
        return;
      }
      setInfo(
        inviteToken
          ? `Check ${email} for a confirmation link. Opening it will finish granting admin access.`
          : 'Account created. Sign in to continue.'
      );
    } else {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
        options: { captchaToken },
      });
      if (signInError) {
        setError(signInError.message);
        setLoading(false);
        resetCaptcha();
        return;
      }
    }

    setLoading(false);
    resetCaptcha();
  };

  const reason = (location.state as { reason?: string } | null)?.reason;
  const isSignedInButNotAdmin = Boolean(profile && !profile.is_admin);
  const inviteLocked = inviteStatus === 'valid';

  if (checking || inviteStatus === 'checking' || acceptingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <LoadingSpinner className="text-[#1D9E75]" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8] px-4 py-8">
      <div className="w-full max-w-md bg-white rounded-2xl border border-[#D3D1C7] shadow-sm p-6 sm:p-8">
        {inviteLocked ? (
          <>
            <div className="mb-1 inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-semibold text-[#085041]">
              <ShieldCheck size={13} /> Admin invitation
            </div>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">You've been invited.</h1>
            <p className="mt-1 text-sm text-[#5F5E5A]">
              Sign in or create an account with <span className="font-semibold text-[#1A1A1A]">{inviteEmail}</span> to accept.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-2xl font-bold text-[#1A1A1A]">Admin</h1>
            <p className="mt-1 text-sm text-[#5F5E5A]">Sign in to review submissions and publish jobs.</p>
          </>
        )}

        {inviteStatus === 'invalid' && (
          <div className="mt-4 rounded-lg border border-[#F0D080] bg-[#FFF8E6] px-3 py-2 text-sm text-[#7A5000]">
            This invite link is invalid, expired, or already used. Ask a founder to send a new one.
          </div>
        )}

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

        {reason === 'no-access' && !inviteToken && (
          <div className="mt-4 rounded-lg border border-[#F0D080] bg-[#FFF8E6] px-3 py-2 text-sm text-[#7A5000]">
            You are signed in, but this account is not admin yet.
          </div>
        )}

        {isSignedInButNotAdmin && !inviteToken && (
          <div className="mt-4 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] px-3 py-2 text-sm text-[#5F5E5A]">
            Signed in already, but this account isn't admin. Admin access is invite-only — ask a founder to send you one.
          </div>
        )}

        {isSignedInButNotAdmin && inviteToken && (
          <div className="mt-4 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] px-3 py-2 text-sm text-[#5F5E5A]">
            Signed in as {profile?.full_name || 'this account'}.{' '}
            <button
              type="button"
              onClick={() => supabase.auth.signOut({ scope: 'local' })}
              className="font-semibold text-[#1D9E75] hover:underline"
            >
              Sign out
            </button>{' '}
            to accept with {inviteEmail}.
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
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              readOnly={inviteLocked}
              className={`w-full rounded-lg border border-[#D3D1C7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1D9E75] ${
                inviteLocked ? 'bg-[#F1EFE8] text-[#5F5E5A]' : ''
              }`}
              placeholder="admin@company.com"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#5F5E5A] uppercase tracking-[0.5px] mb-1.5">Password</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#D3D1C7] px-3.5 py-2.5 text-sm outline-none focus:border-[#1D9E75]"
              placeholder="••••••••" />
          </div>
          <TurnstileWidget
            ref={turnstileRef}
            onVerify={setCaptchaToken}
            onExpire={() => setCaptchaToken('')}
          />
          <button type="submit" disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white hover:bg-[#168a63] transition-colors disabled:opacity-60">
            {loading ? <LoadingSpinner size={16} className="text-white" label="Submitting" /> : mode === 'signup' ? <UserPlus size={16} /> : <LogIn size={16} />}
            <span>{mode === 'signup' ? 'Create account' : 'Sign in'}</span>
          </button>
        </form>
        <div className="mt-5 flex items-center justify-between text-sm">
          <Link to="/" className="text-[#1D9E75] hover:underline">Back to site</Link>
        </div>
      </div>
    </div>
  );
}

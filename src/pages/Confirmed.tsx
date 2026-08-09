import { useEffect, useState } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import LoadingSpinner from '../components/LoadingSpinner';

// Supabase's client has detectSessionInUrl enabled, so clicking the
// confirmation link already logs the user in — the tokens are parsed out of
// the URL and a session is established before this component even mounts.
// We just need to wait for useAuth to reflect that, then route the person to
// wherever they belong (mirrors the resolveSession logic in AuthLayout.tsx),
// instead of discarding the session and forcing a manual re-login.
const FALLBACK_DELAY_MS = 6000;

export default function Confirmed() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const [routing, setRouting] = useState(true);

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    void (async () => {
      if (!session) {
        // No session yet — could be a stale/already-used link, or the tokens
        // just haven't finished parsing. Fall back to login rather than
        // leaving the user stuck.
        if (alive) setRouting(false);
        return;
      }

      try {
        const profile = await fetchProfile(session.user.id);
        if (!alive) return;

        const role = profile?.account_type === 'employer' ? 'employer' : 'candidate';
        const destination = profile?.onboarding_completed
          ? role === 'employer'
            ? '/employer/dashboard'
            : '/candidate/dashboard'
          : role === 'employer'
            ? '/employer/onboarding'
            : '/candidate';

        navigate(destination, { replace: true });
      } catch {
        if (alive) setRouting(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, session, navigate]);

  // Safety net: if for any reason we're still here after a few seconds
  // (e.g. profile lookup hung), don't leave the user stranded.
  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setRouting((current) => {
        if (current) navigate('/start?mode=login', { replace: true });
        return false;
      });
    }, FALLBACK_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <main className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="auth-fade-up w-full max-w-md rounded-2xl border border-white/70 bg-white px-6 py-10 text-center shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#1D9E75]">
          {routing ? <LoadingSpinner className="text-[#1D9E75]" size={28} /> : <CheckCircle2 size={34} />}
        </div>
        <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Email confirmed
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          {routing
            ? "You're all set. Taking you into RoleWave..."
            : 'Your session link has expired. Please sign in to continue.'}
        </p>
        <Link
          to="/start?mode=login"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63]"
        >
          Continue to sign in
          <ArrowRight size={16} />
        </Link>
      </section>
    </main>
  );
}
import { useEffect } from 'react';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const REDIRECT_DELAY_MS = 4000;

export default function Confirmed() {
  const navigate = useNavigate();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      navigate('/start?mode=login', { replace: true });
    }, REDIRECT_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [navigate]);

  return (
    <main className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="auth-fade-up w-full max-w-md rounded-2xl border border-white/70 bg-white px-6 py-10 text-center shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:px-10">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#1D9E75]">
          <CheckCircle2 size={34} />
        </div>
        <h1 className="mt-6 font-display text-[30px] font-semibold leading-tight tracking-[-0.02em] text-ink">
          Email confirmed
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-muted">
          You&apos;re all set. Your RoleWave account is ready to use.
        </p>
        <Link
          to="/start?mode=login"
          className="mt-7 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63]"
        >
          Continue to sign in
          <ArrowRight size={16} />
        </Link>
        <p className="mt-4 text-xs text-muted">You&apos;ll be redirected automatically.</p>
      </section>
    </main>
  );
}

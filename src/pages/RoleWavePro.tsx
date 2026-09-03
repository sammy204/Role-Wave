import { useEffect, useState } from 'react';
import { Check, CheckCircle2, Eye, LockKeyhole, Sparkles, Target, X, Zap } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import ComingSoonPage from '../components/ComingSoonPage';
import { roleWaveProEnabled } from '../lib/featureFlags';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';

const proBenefits = [
  'More Role Pilot usage for every stage of your job search',
  'Advanced match breakdowns and practical next steps',
  'Be discoverable to employers looking for candidates like you',
  'Access to new candidate tools as they are released',
];

const freeBenefits = [
  'Basic Role Pilot access',
  'Browse and apply for verified jobs',
  'Track your applications and messages',
];

const proPlans = [
  { name: 'Monthly', duration: '1 month', price: '₦3,000', value: '₦3,000 per month', featured: false },
  { name: 'Three months', duration: '3 months', price: '₦7,000', value: 'Save ₦2,000', featured: true },
];

export default function RoleWavePro() {
  const { session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [busyPlan, setBusyPlan] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [activeUntil, setActiveUntil] = useState<string | null>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  useEffect(() => {
    if (!session) return;
    void supabase.from('ai_entitlements').select('status, current_period_end').eq('user_id', session.user.id).eq('product', 'ai_features').maybeSingle().then(({ data }) => {
      if (data?.status === 'active' && data.current_period_end && new Date(data.current_period_end) > new Date()) setActiveUntil(data.current_period_end);
    });
  }, [session]);

  useEffect(() => {
    const reference = searchParams.get('reference') || searchParams.get('trxref');
    if (!reference || !session) return;
    setMessage('Confirming your payment…');
    void supabase.functions.invoke('paystack-verify', { body: { reference } }).then(({ data, error }) => {
      const verified = !error && Boolean(data?.success);
      setMessage(verified ? 'Payment confirmed. RoleWave Pro is now active.' : (data?.error || 'We could not confirm that payment yet.'));
      if (verified) {
        if (data.current_period_end) setActiveUntil(data.current_period_end);
        setShowCelebration(true);
      }
      setSearchParams({}, { replace: true });
    });
  }, [searchParams, session, setSearchParams]);

  useEffect(() => {
    if (!showCelebration) return;
    const timeout = window.setTimeout(() => setShowCelebration(false), 6500);
    return () => window.clearTimeout(timeout);
  }, [showCelebration]);

  async function choosePlan(plan: string) {
    if (!session) { setMessage('Please sign in before choosing a plan.'); return; }
    setBusyPlan(plan);
    setMessage('Opening secure Paystack checkout…');
    const { data, error } = await supabase.functions.invoke('paystack-initialize', { body: { plan, callback_url: `${window.location.origin}/candidate/pro` } });
    setBusyPlan(null);
    if (error || !data?.authorization_url) { setMessage(data?.error || 'Could not start checkout.'); return; }
    window.location.assign(data.authorization_url);
  }

  if (!roleWaveProEnabled) {
    return (
      <ComingSoonPage
        title="RoleWave Pro"
        description="A more powerful way to get more from your job search is on the way. We’re putting the finishing touches on RoleWave Pro before it launches."
      />
    );
  }

  return (
    <main className="page-shell">
      {showCelebration && <ProCelebration onClose={() => setShowCelebration(false)} />}
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] px-5 py-10 text-white shadow-[0_28px_80px_rgba(29,158,117,0.18)] sm:px-10 sm:py-14"
          style={{ background: 'linear-gradient(135deg, #0D3028 0%, #12684F 58%, #1D9E75 100%)' }}
        >
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#1D9E75]/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#5B4088]/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#B9F4D7] backdrop-blur-xl">
              <Sparkles size={13} /> RoleWave Pro
            </div>
            <h1 className="font-display text-[38px] font-bold leading-[1.02] tracking-[-1.4px] text-white sm:text-[58px]">
            {activeUntil ? 'Your best work starts here.' : 'Put your job search on a stronger track.'}
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            {activeUntil ? 'Welcome to your RoleWave Pro workspace. Turn better guidance into focused action and stronger applications.' : 'Get more from Role Pilot, understand where you fit, and give relevant employers more opportunities to discover you.'}
            </p>
          </div>
        </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-panel border border-line bg-white p-6 shadow-card sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-accent-deep">{activeUntil ? 'Your Pro toolkit' : 'What you unlock'}</p>
              <h2 className="mt-1 font-serif text-[24px] font-bold text-ink">{activeUntil ? 'Make every application count.' : 'More clarity. More opportunity.'}</h2>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-deep">
              <Zap size={19} />
            </div>
          </div>

          <div className="space-y-4">
            {proBenefits.map((benefit) => (
              <div key={benefit} className="flex items-start gap-3 text-[14px] leading-relaxed text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-deep">
                  <Check size={13} strokeWidth={3} />
                </span>
                <span>{benefit}</span>
              </div>
            ))}
          </div>

          <div className="mt-7 rounded-panel bg-paper p-4 text-[12px] leading-relaxed text-muted">
            {activeUntil ? 'Start with Role Pilot, use Match on relevant jobs, then refine your profile and preferences as you learn what works.' : 'Employer discovery is based on your profile, preferences, and the requirements of each job. Pro never guarantees an interview or offer.'}
          </div>
        </div>

        <div className="rounded-panel border-2 border-accent bg-accent-light/40 p-6 shadow-card sm:p-7">
          {activeUntil ? (
            <>
              <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Active member</span>
              <h2 className="mt-4 font-serif text-[27px] font-bold text-ink">Welcome to RoleWave Pro.</h2>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">Your Pro tools are unlocked. Use Role Pilot for deeper guidance and match jobs to see practical next steps.</p>
              <div className="mt-6 rounded-2xl border border-accent/30 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wide text-accent-deep">Your access</p>
                <p className="mt-2 font-serif text-[23px] font-bold text-ink">Active</p>
                <p className="mt-1 text-[12px] text-muted">Available until {new Date(activeUntil).toLocaleDateString()}</p>
              </div>
              <div className="mt-5 space-y-3 text-[12px] text-ink">
                <p>✓ More Role Pilot usage</p>
                <p>✓ Advanced match breakdowns</p>
                <p>✓ Employer discovery visibility</p>
              </div>
              <p className="mt-6 text-center text-[11px] font-semibold text-muted">You already have an active plan. No additional payment is needed.</p>
            </>
          ) : (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Pro plans</span>
                  <h2 className="mt-4 font-serif text-[24px] font-bold text-ink">Choose your access</h2>
                </div>
                <span className="text-right text-[11px] font-semibold text-accent-deep">Flexible plans<br />Renew when needed</span>
              </div>
              <div className="mt-6 space-y-3">
                {proPlans.map((plan) => (
                  <div key={plan.duration} className={`rounded-2xl border p-4 ${plan.featured ? 'border-accent bg-white shadow-sm' : 'border-line bg-white/60'}`}>
                    <div className="flex items-center justify-between gap-3">
                      <div><p className="text-[13px] font-bold text-ink">{plan.name}</p><p className="mt-1 text-[11px] text-muted">RoleWave Pro access for {plan.duration}</p></div>
                      <div className="text-right"><p className="font-serif text-[25px] font-bold leading-none text-ink">{plan.price}</p><p className="mt-1 text-[10px] font-bold text-accent-deep">{plan.value}</p></div>
                    </div>
                    <button type="button" disabled={busyPlan !== null} onClick={() => void choosePlan(plan.name === 'Monthly' ? 'monthly' : 'three_months')} className="mt-4 inline-flex w-full items-center justify-center rounded-xl bg-accent px-4 py-3 text-[12px] font-bold text-white disabled:opacity-70">Choose {plan.name}</button>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-center text-[11px] font-semibold text-muted">Secure checkout by Paystack. {message || 'Choose monthly or 3-month access.'}</p>
            </>
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <InfoCard icon={Target} title="Relevant matches" text="Be surfaced for jobs that align with your profile and preferences." />
        <InfoCard icon={Eye} title="Your choice" text="Control whether employers can discover your profile from your settings." />
        <InfoCard icon={LockKeyhole} title="No surprises" text="Clear access periods, transparent pricing, and renewal when you choose." />
      </section>

      {activeUntil ? (
        <section className="mt-4 rounded-panel border border-accent/30 bg-white p-6 shadow-card sm:p-7">
          <p className="text-[12px] font-bold uppercase tracking-wide text-accent-deep">Your Pro playbook</p>
          <h2 className="mt-1 font-serif text-[24px] font-bold text-ink">Get more from your membership.</h2>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <ProStep number="01" title="Ask Role Pilot" text="Get tailored help with your search strategy, CV, applications, and interview preparation." />
            <ProStep number="02" title="Check your fit" text="Open a relevant job and use the advanced match view to understand your strengths and gaps." />
            <ProStep number="03" title="Stay discoverable" text="Keep your profile, skills, location, and preferences current so the right employers can find you." />
          </div>
        </section>
      ) : (
        <section className="mt-4 rounded-panel border border-line bg-white p-6 shadow-card sm:p-7">
          <div className="grid gap-6 md:grid-cols-2">
            <PlanColumn title="Free" subtitle="A solid foundation for your search" benefits={freeBenefits} />
            <PlanColumn title="RoleWave Pro" subtitle="More tools and more visibility" benefits={proBenefits} highlighted />
          </div>
        </section>
      )}
      </div>
    </main>
  );
}

function ProCelebration({ onClose }: { onClose: () => void }) {
  const confetti = Array.from({ length: 18 }, (_, index) => index);

  return (
    <div className="pro-celebration fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0D3028]/45 p-5 backdrop-blur-sm" role="status" aria-live="polite">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        {confetti.map((piece) => <span key={piece} className="pro-confetti" style={{ '--confetti-index': piece } as React.CSSProperties} />)}
      </div>
      <div className="pro-celebration-card relative w-full max-w-sm rounded-[30px] border border-white/70 bg-white p-8 text-center shadow-[0_30px_90px_rgba(13,48,40,0.28)]">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 rounded-full p-2 text-muted transition-colors hover:bg-paper hover:text-ink" aria-label="Close celebration">
          <X size={17} />
        </button>
        <div className="pro-celebration-icon mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-accent-light text-accent-deep">
          <CheckCircle2 size={40} strokeWidth={1.8} />
        </div>
        <p className="mt-6 text-[11px] font-bold uppercase tracking-[1.8px] text-accent-deep">Welcome to the next level</p>
        <h2 className="mt-2 font-display text-[32px] font-bold leading-tight text-ink">RoleWave Pro is active!</h2>
        <p className="mt-3 text-sm leading-6 text-muted">Your better job search starts now. Let’s make every application count.</p>
        <button type="button" onClick={onClose} className="mt-6 rounded-xl bg-accent px-5 py-3 text-xs font-bold text-white transition-colors hover:bg-accent-deep">Let’s go</button>
      </div>
    </div>
  );
}

function InfoCard({ icon: Icon, title, text }: { icon: typeof Target; title: string; text: string }) {
  return (
    <div className="rounded-panel border border-line bg-white p-5 shadow-card">
      <Icon size={19} className="text-accent-deep" />
      <h3 className="mt-3 text-[14px] font-bold text-ink">{title}</h3>
      <p className="mt-1 text-[12px] leading-relaxed text-muted">{text}</p>
    </div>
  );
}

function ProStep({ number, title, text }: { number: string; title: string; text: string }) {
  return <div className="rounded-2xl bg-accent-light/50 p-4"><p className="text-[11px] font-bold tracking-wide text-accent-deep">{number}</p><h3 className="mt-3 text-[14px] font-bold text-ink">{title}</h3><p className="mt-2 text-[12px] leading-relaxed text-muted">{text}</p></div>;
}

function PlanColumn({ title, subtitle, benefits, highlighted = false }: { title: string; subtitle: string; benefits: string[]; highlighted?: boolean }) {
  return (
    <div className={highlighted ? 'rounded-panel bg-accent-light/50 p-5' : 'p-1'}>
      <h3 className="text-[18px] font-bold text-ink">{title}</h3>
      <p className="mt-1 text-[13px] text-muted">{subtitle}</p>
      <div className="mt-4 space-y-3">
        {benefits.map((benefit) => (
          <div key={benefit} className="flex items-start gap-2.5 text-[13px] text-ink">
            <Check size={16} className="mt-0.5 shrink-0 text-accent-deep" />
            <span>{benefit}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

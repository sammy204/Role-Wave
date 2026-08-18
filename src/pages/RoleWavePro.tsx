import { Check, Eye, LockKeyhole, Sparkles, Target, Zap } from 'lucide-react';

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

export default function RoleWavePro() {
  return (
    <main className="page-shell">
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
            Put your job search on a stronger track.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
            Get more from Role Pilot, understand where you fit, and give relevant employers more opportunities to discover you.
            </p>
          </div>
        </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-panel border border-line bg-white p-6 shadow-card sm:p-7">
          <div className="mb-6 flex items-start justify-between gap-4">
            <div>
              <p className="text-[12px] font-bold uppercase tracking-wide text-accent-deep">What you unlock</p>
              <h2 className="mt-1 font-serif text-[24px] font-bold text-ink">More clarity. More opportunity.</h2>
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
            Employer discovery is based on your profile, preferences, and the requirements of each job. Pro never guarantees an interview or offer.
          </div>
        </div>

        <div className="rounded-panel border-2 border-accent bg-accent-light/40 p-6 shadow-card sm:p-7">
          <div className="flex items-center justify-between gap-3">
            <span className="rounded-full bg-accent px-3 py-1 text-[11px] font-bold uppercase tracking-wide text-white">Pro plan</span>
            <span className="text-[12px] font-semibold text-accent-deep">5 months</span>
          </div>
          <div className="mt-6 flex items-end gap-2">
            <span className="font-serif text-[38px] font-bold leading-none text-ink">₦7,000</span>
            <span className="pb-1 text-[13px] text-muted">one-time payment</span>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            Your plan lasts for five months. It will not renew automatically—you choose if and when to renew.
          </p>
          <button
            type="button"
            disabled
            className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-4 py-3.5 text-sm font-bold text-white opacity-70"
          >
            Get RoleWave Pro
          </button>
          <p className="mt-3 text-center text-[11px] font-semibold text-muted">Payments will be available soon.</p>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-3">
        <InfoCard icon={Target} title="Relevant matches" text="Be surfaced for jobs that align with your profile and preferences." />
        <InfoCard icon={Eye} title="Your choice" text="Control whether employers can discover your profile from your settings." />
        <InfoCard icon={LockKeyhole} title="No surprises" text="One payment, a clear expiry date, and no automatic renewal." />
      </section>

      <section className="mt-4 rounded-panel border border-line bg-white p-6 shadow-card sm:p-7">
        <div className="grid gap-6 md:grid-cols-2">
          <PlanColumn title="Free" subtitle="A solid foundation for your search" benefits={freeBenefits} />
          <PlanColumn title="RoleWave Pro" subtitle="More tools and more visibility" benefits={proBenefits} highlighted />
        </div>
      </section>
      </div>
    </main>
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

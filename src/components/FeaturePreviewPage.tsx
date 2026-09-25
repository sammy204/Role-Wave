import { ArrowRight, CheckCircle2, LockKeyhole } from 'lucide-react';
import { Link } from 'react-router-dom';

type FeaturePreviewPageProps = {
  eyebrow: string;
  title: string;
  description: string;
  steps: string[];
  benefits: string[];
};

export default function FeaturePreviewPage({ eyebrow, title, description, steps, benefits }: FeaturePreviewPageProps) {
  return (
    <main className="page-shell min-h-[calc(100vh-60px)] bg-[#FBFAF7] px-4 py-6 sm:px-6 sm:py-10 lg:px-8">
      <div className="mx-auto w-full max-w-[1160px]">
        <section className="overflow-hidden rounded-[30px] bg-gradient-to-br from-[#0D3028] via-[#12684F] to-[#1D9E75] px-6 py-8 text-white shadow-[0_28px_80px_rgba(18,104,79,0.2)] sm:px-10 sm:py-12 lg:px-14 lg:py-14">
          <div className="grid gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:items-end lg:gap-16">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#B8E8D2]">{eyebrow}</p>
              <h1 className="mt-5 max-w-2xl font-display text-4xl leading-[0.98] tracking-[-0.05em] sm:text-6xl">{title}</h1>
              <p className="mt-6 max-w-xl text-sm leading-7 text-white/75 sm:text-base">{description}</p>
              <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-semibold text-white/80">
                <LockKeyhole size={14} /> This feature is being prepared
              </div>
            </div>

            <div className="rounded-[24px] border border-white/15 bg-white/10 p-5 backdrop-blur-sm sm:p-6">
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B8E8D2]">How it will work</p>
              <div className="mt-5 space-y-4">
                {steps.map((step, index) => (
                  <div key={step} className="flex items-start gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B8E8D2] text-xs font-bold text-[#0D3028]">{String(index + 1).padStart(2, '0')}</span>
                    <p className="pt-1 text-sm leading-6 text-white/85">{step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[26px] border border-[#D3EDE2] bg-[#E9F7F0] p-6 sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#0F6E56]">What you will get</p>
            <div className="mt-5 space-y-4">
              {benefits.map((benefit) => (
                <div key={benefit} className="flex items-start gap-3 text-sm leading-6 text-[#275B4D]">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#1D9E75]" />
                  <span>{benefit}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[26px] border border-[#E1DED5] bg-white p-6 shadow-[0_18px_50px_rgba(26,26,26,0.05)] sm:p-8">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A867E]">Your next step</p>
            <h2 className="mt-4 max-w-lg font-display text-3xl leading-tight tracking-[-0.04em] text-[#123D35]">Keep building your profile while we finish this experience.</h2>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#6B6960]">A complete profile will help you get more value from this feature when it becomes available.</p>
            <Link to="/candidate/profile" className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#123D35] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#0F6E56]">
              Improve your profile <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

import { ArrowLeft, Clock3, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <main className="page-shell min-h-[calc(100vh-60px)] px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto flex w-full max-w-[760px] justify-center">
        <section className="relative w-full overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f4efff_52%,#eefaf6_100%)] px-6 py-12 text-center shadow-[0_24px_70px_rgba(26,26,26,0.08)] sm:px-12 sm:py-16">
          <div className="pointer-events-none absolute -left-20 -top-20 h-52 w-52 rounded-full bg-[#1D9E75]/15 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-24 -right-16 h-64 w-64 rounded-full bg-[#5B4088]/15 blur-3xl" />

          <div className="relative">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1D9E75] text-white shadow-[0_12px_26px_rgba(29,158,117,0.22)]">
              <Sparkles size={24} />
            </div>
            <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.6px] text-[#085041]">
              <Clock3 size={12} /> Coming soon
            </div>
            <h1 className="mt-4 font-display text-[36px] font-bold tracking-[-0.04em] text-[#1A1A1A] sm:text-[48px]">{title}</h1>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[#5F5E5A] sm:text-base">{description}</p>
            <Link
              to="/candidate/dashboard"
              className="mt-7 inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-5 py-3 text-sm font-semibold text-white transition-transform hover:-translate-y-[1px]"
            >
              <ArrowLeft size={15} /> Back to dashboard
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}

import { ArrowLeft, Compass, Search } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function NotFound() {
  return (
    <div className="page-shell">
      <div className="mx-auto flex w-full max-w-[1180px] flex-1 items-center px-4 py-10 sm:px-6 lg:px-8">
        <section className="relative w-full overflow-hidden rounded-[34px] border border-white/70 bg-white/78 px-5 py-12 shadow-[0_24px_70px_rgba(26,26,26,0.08)] backdrop-blur-xl sm:px-10 sm:py-16">
          <div className="pointer-events-none absolute -left-20 top-10 h-56 w-56 rounded-full bg-[#1D9E75]/15 blur-3xl" />
          <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-[#5B4088]/14 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-20 right-1/4 h-48 w-48 rounded-full bg-[#1D9E75]/10 blur-3xl" />

          <div className="relative mx-auto max-w-2xl text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#085041] shadow-[0_12px_28px_rgba(15,110,86,.12)]">
              <Compass size={25} aria-hidden="true" />
            </div>
            <p className="mt-7 text-[11px] font-bold uppercase tracking-[2px] text-[#1D9E75]">Error 404</p>
            <h1 className="font-display mt-3 text-[44px] font-bold leading-[0.98] tracking-[-1.5px] text-[#1A1A1A] sm:text-[68px]">
              This path leads nowhere.
            </h1>
            <p className="mx-auto mt-5 max-w-lg text-sm leading-7 text-[#5F5E5A] sm:text-base">
              The page you&apos;re looking for may have moved, changed, or never existed. Let&apos;s get you back to the opportunities that do.
            </p>

            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                to="/"
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#1D9E75] px-5 py-3.5 text-sm font-bold text-white shadow-[0_12px_28px_rgba(15,110,86,.22)] transition-all hover:-translate-y-0.5 hover:bg-[#0F6E56]"
              >
                <ArrowLeft size={17} aria-hidden="true" />
                Back to home
              </Link>
              <Link
                to="/jobs"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7]/80 px-5 py-3.5 text-sm font-bold text-[#1A1A1A] transition-all hover:-translate-y-0.5 hover:border-[#5DCAA5] hover:bg-white"
              >
                <Search size={17} aria-hidden="true" />
                Browse jobs
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}

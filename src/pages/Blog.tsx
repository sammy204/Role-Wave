import { ArrowUpRight, Briefcase, FileText, MessageSquare } from 'lucide-react';

const topics = [
  {
    icon: FileText,
    label: 'For candidates',
    title: 'Build a stronger CV',
    description: 'Practical guidance for presenting your experience clearly and finding the right opportunities.',
  },
  {
    icon: MessageSquare,
    label: 'For candidates',
    title: 'Prepare for better interviews',
    description: 'Useful preparation notes to help you communicate your strengths with confidence.',
  },
  {
    icon: Briefcase,
    label: 'For employers',
    title: 'Hire with more clarity',
    description: 'Simple ideas for writing better roles, reviewing applicants, and building stronger teams.',
  },
];

export default function Blog() {
  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-12 pt-6 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] px-5 py-10 text-white shadow-[0_28px_80px_rgba(29,158,117,0.18)] sm:px-10 sm:py-14"
          style={{ background: 'linear-gradient(135deg, #0D3028 0%, #12684F 58%, #1D9E75 100%)' }}
        >
          <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-32 left-1/3 h-64 w-64 rounded-full bg-[#5B4088]/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#B9F4D7] backdrop-blur-xl">
              RoleWave blog
            </div>
            <h1 className="font-display text-[40px] font-bold leading-[1.02] tracking-[-1.4px] sm:text-[58px]">
              Practical ideas for work that moves forward.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/72 sm:text-base">
              Guidance for candidates building their careers and employers building better teams.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[34px] border border-white/70 bg-white/72 p-5 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-8">
          <div className="flex flex-col gap-2 border-b border-[#D3D1C7] pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-[#1D9E75]">Coming soon</p>
              <h2 className="font-display mt-1 text-[30px] font-bold leading-none text-[#1A1A1A] sm:text-[36px]">Career resources</h2>
            </div>
            <span className="text-sm text-[#6B6960]">Useful, focused, and made for the RoleWave community.</span>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {topics.map((topic) => {
              const Icon = topic.icon;
              return (
                <article key={topic.title} className="rounded-2xl border border-[#E5E1D8] bg-[#FBFAF7]/80 p-5">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#085041]">
                    <Icon size={19} />
                  </div>
                  <p className="mt-6 text-[10px] font-bold uppercase tracking-[1.4px] text-[#1D9E75]">{topic.label}</p>
                  <h3 className="mt-2 text-lg font-bold text-[#1A1A1A]">{topic.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">{topic.description}</p>
                  <span className="mt-5 inline-flex items-center gap-1 text-xs font-bold text-[#B4B2A9]">
                    Coming soon <ArrowUpRight size={13} />
                  </span>
                </article>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

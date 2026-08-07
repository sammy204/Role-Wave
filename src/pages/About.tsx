import { useState } from 'react';
import { Building2, Check, ChevronDown, Download, Flag, LockKeyhole, ShieldCheck, Sparkles, UserRound } from 'lucide-react';

const TOPICS = [
  {
    title: 'What is RoleWave?',
    icon: Sparkles,
    body: 'RoleWave is a job marketplace for tech and digital professionals in Nigeria. We bring candidates and employers together in one focused place, with the tools to discover roles, apply, hire, and communicate clearly.',
  },
  {
    title: 'Why RoleWave exists',
    icon: Flag,
    body: 'Finding good work or the right person should not depend on guessing which listings are real. RoleWave exists to make the process calmer, more transparent, and more useful for people building careers and companies building teams in Nigeria.',
  },
  {
    title: 'How verification works',
    icon: ShieldCheck,
    body: 'We review employer accounts and job listings before they go live. Our checks are designed to reduce misleading, suspicious, or low-quality postings. Verification improves trust, but candidates should still use their own judgment before sharing sensitive information or accepting an offer.',
  },
  {
    title: 'For candidates',
    icon: UserRound,
    body: 'Candidates can create one profile, discover relevant roles, save jobs, apply directly, track application progress, and message employers. Your profile and applications stay organised so your search can keep moving.',
  },
  {
    title: 'For employers',
    icon: Building2,
    body: 'Employers can create a company profile, publish genuine openings, review applicants, manage hiring stages, and communicate with candidates. RoleWave is built to help serious teams reach work-ready talent more efficiently.',
  },
  {
    title: 'Safety and reporting',
    icon: Check,
    body: 'If something does not look right, report it through the platform. Reports help us investigate listings and accounts, remove content that violates our standards, and keep the marketplace safer for everyone.',
  },
  {
    title: 'What makes RoleWave different',
    icon: Sparkles,
    body: 'RoleWave is focused on Nigeria’s tech and digital job market, keeps the experience simple, reviews listings before publishing, and gives candidates and employers the same place to manage the full conversation.',
  },
  {
    title: 'Our commitment to users',
    icon: LockKeyhole,
    body: 'We aim to be transparent about how the platform works, protect the information users share, improve the verification process, and build features that make fairer and more useful hiring possible.',
  },
  {
    title: 'Install RoleWave on your phone',
    icon: Download,
    body: 'On Android, open RoleWave in Chrome, tap the browser menu, and choose “Install app” or “Add to Home screen.” On iPhone, open RoleWave in Safari, tap Share, choose “Add to Home Screen,” and then open RoleWave from the new icon like a normal app.',
  },
];

export default function About() {
  const [openTopic, setOpenTopic] = useState<number | null>(0);

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1180px] px-4 pb-10 pt-6 sm:px-6 lg:px-8">
        <section
          className="relative overflow-hidden rounded-[34px] px-5 py-10 text-white shadow-[0_28px_80px_rgba(29,158,117,0.18)] sm:px-10 sm:py-14"
          style={{ background: 'linear-gradient(135deg, #0D3028 0%, #12684F 58%, #1D9E75 100%)' }}
        >
          <div className="pointer-events-none absolute -right-16 -top-24 h-72 w-72 rounded-full bg-[#1D9E75]/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 left-1/3 h-64 w-64 rounded-full bg-[#5B4088]/25 blur-3xl" />
          <div className="relative max-w-2xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#B9F4D7] backdrop-blur-xl">
              About RoleWave
            </div>
            <h1 className="font-display text-[38px] font-bold leading-[1.02] tracking-[-1.4px] text-white sm:text-[58px]">
              A clearer way to find work and build teams.
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-white/70 sm:text-base">
              RoleWave connects skilled tech and digital professionals with credible employers across Nigeria. We are building a more trustworthy, focused way to move from opportunity to meaningful work.
            </p>
          </div>
        </section>

        <section className="mt-4 rounded-[34px] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-7">
          <div className="mb-5 flex items-end justify-between gap-4 border-b border-[#D3D1C7] pb-5">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[1.7px] text-[#1D9E75]">Learn more</p>
              <h2 className="font-display mt-1 text-[28px] font-bold leading-none text-[#1A1A1A] sm:text-[34px]">How RoleWave works</h2>
            </div>
          </div>

          <div className="divide-y divide-[#E5E1D8]">
            {TOPICS.map((topic, index) => {
              const Icon = topic.icon;
              const isOpen = openTopic === index;

              return (
                <div key={topic.title}>
                  <button
                    type="button"
                    onClick={() => setOpenTopic(isOpen ? null : index)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 py-5 text-left transition-colors hover:text-[#0F6E56]"
                  >
                    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${isOpen ? 'bg-[#E1F5EE] text-[#085041]' : 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>
                      <Icon size={17} />
                    </span>
                    <span className="flex-1 text-[15px] font-semibold text-[#1A1A1A] sm:text-base">{topic.title}</span>
                    <ChevronDown size={18} className={`shrink-0 text-[#8A867E] transition-transform duration-300 ${isOpen ? 'rotate-180 text-[#0F6E56]' : ''}`} />
                  </button>

                  <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${isOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
                    <div className="min-h-0 overflow-hidden">
                      <p className="pb-5 pl-[52px] pr-6 text-sm leading-6 text-[#5F5E5A]">{topic.body}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

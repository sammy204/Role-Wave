import { ArrowRight, Building2, Check, Compass, Sparkles, Target, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const principles = [
  { number: '01', title: 'Nigerians first', description: 'Built around Nigerian talent — local jobs and international jobs, on one platform.' },
  { number: '02', title: 'Know where you stand', description: 'See where your application stands at every stage, instead of applying into a black hole.' },
  { number: '03', title: 'RolePilot match scoring', description: 'See how your profile lines up with a role before you apply, so you can focus your effort.' },
];

export default function Home() {
  const navigate = useNavigate();

  return (
    <div className="page-shell bg-[#F7F5EF] text-[#1A1A1A]">
      <section className="relative overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:px-12 lg:pt-24">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#D8F2E8] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-[#EAE2F5] blur-3xl" />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <div className="mb-8 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]"><span className="h-px w-8 bg-[#1D9E75]" />The RoleWave story</div>
              <h1 className="font-display max-w-4xl text-[clamp(3.6rem,9vw,8.5rem)] font-semibold leading-[0.86] tracking-[-0.065em] text-[#123D35]">A job platform built for Nigerians.</h1>
              <p className="mt-8 max-w-xl text-base leading-8 text-[#5F5E5A] sm:text-lg">Local roles, international roles, one place — with real visibility from the moment you apply to the moment a decision is made.</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => navigate('/jobs')} className="inline-flex items-center gap-2 rounded-full bg-[#123D35] px-5 py-3.5 text-sm font-bold text-white shadow-[0_14px_32px_rgba(18,61,53,0.2)] transition-transform hover:-translate-y-0.5">Explore opportunities <ArrowRight size={16} /></button>
                <button type="button" onClick={() => navigate('/post')} className="inline-flex items-center gap-2 rounded-full border border-[#BFCAC3] bg-white/55 px-5 py-3.5 text-sm font-bold text-[#123D35] transition-colors hover:border-[#1D9E75] hover:bg-white">I&apos;m hiring</button>
              </div>
            </div>
            <div className="relative lg:pb-5">
              <div className="absolute -left-5 -top-5 hidden h-24 w-24 rounded-full border border-[#1D9E75]/30 sm:block" />
              <div className="relative rounded-[2rem] border border-white/80 bg-white/65 p-6 shadow-[0_24px_70px_rgba(26,26,26,0.08)] backdrop-blur-xl sm:p-8">
                <div className="mb-12 flex items-center justify-between"><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#9A9992]">A working belief</span><Sparkles size={18} className="text-[#1D9E75]" /></div>
                <p className="font-display text-[2.15rem] leading-[1.03] tracking-[-0.04em] text-[#123D35] sm:text-[2.8rem]">Most job platforms help you find roles. RoleWave helps you understand where you stand.</p>
                <div className="mt-10 flex items-center gap-3 border-t border-[#E5E2D9] pt-5 text-sm text-[#5F5E5A]"><span className="h-2 w-2 rounded-full bg-[#1D9E75]" />Built for Nigerians. Built for visibility.</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-y border-[#E4E0D6] bg-[#123D35] px-5 py-20 text-white sm:px-8 sm:py-28 lg:px-12">
        <div className="mx-auto grid max-w-[1240px] gap-12 lg:grid-cols-[0.7fr_1.3fr] lg:gap-24">
          <div><div className="mb-6 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8AD7B8]"><Compass size={16} />Why RoleWave exists</div><h2 className="font-display max-w-md text-5xl leading-[0.94] tracking-[-0.05em] sm:text-6xl">Built around Nigerians.</h2></div>
          <div className="max-w-2xl"><p className="text-xl leading-9 text-white/80 sm:text-2xl sm:leading-10">RoleWave exists for Nigerians. Whether the opportunity is here at home or with a company abroad, you should know where you stand.</p><p className="mt-8 max-w-xl text-base leading-8 text-white/58">From the application, through review, to a decision, RoleWave is built to make the process clearer — with visibility instead of guesswork.</p></div>
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12"><div className="mx-auto max-w-[1240px]">
        <div className="mb-12 max-w-2xl"><div className="mb-5 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]">The RoleWave approach</div><h2 className="font-display text-5xl leading-[0.95] tracking-[-0.05em] text-[#123D35] sm:text-6xl">A clearer way to find work.</h2></div>
        <div className="grid gap-px overflow-hidden rounded-[2rem] border border-[#DDD9CE] bg-[#DDD9CE] md:grid-cols-3">{principles.map((principle) => <article key={principle.number} className="bg-[#FBFAF7] p-7 sm:p-9"><div className="mb-16 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-[#A4A198]"><span>{principle.number}</span><span className="h-px w-12 bg-[#C6C2B7]" /></div><h3 className="font-display text-3xl leading-none tracking-[-0.035em] text-[#123D35]">{principle.title}</h3><p className="mt-4 text-sm leading-7 text-[#6B6962]">{principle.description}</p></article>)}</div>
      </div></section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12"><div className="mx-auto grid max-w-[1240px] gap-4 lg:grid-cols-2">
        <article className="rounded-[2rem] bg-[#E3F4EC] p-7 sm:p-10"><div className="flex items-center justify-between"><span className="rounded-full bg-white/70 p-3 text-[#0F6E56]"><Users size={20} /></span><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A8C76]">For candidates</span></div><h2 className="font-display mt-20 max-w-md text-4xl leading-[0.95] tracking-[-0.045em] text-[#123D35] sm:text-5xl">For people with somewhere to go.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#4D7163]">Discover opportunities selected for quality, learn about companies before you apply, and keep your career moving with more intention.</p><button type="button" onClick={() => navigate('/jobs')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#0F6E56] hover:gap-3">Explore opportunities <ArrowRight size={16} /></button></article>
        <article className="rounded-[2rem] bg-[#EAE3F4] p-7 sm:p-10"><div className="flex items-center justify-between"><span className="rounded-full bg-white/70 p-3 text-[#5B4088]"><Building2 size={20} /></span><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#806BA0]">For employers</span></div><h2 className="font-display mt-20 max-w-md text-4xl leading-[0.95] tracking-[-0.045em] text-[#32204F] sm:text-5xl">For companies building what comes next.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#6E5C85]">Present your opportunity properly and meet candidates who are genuinely aligned with the work, the mission, and the road ahead.</p><button type="button" onClick={() => navigate('/post')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#5B4088] hover:gap-3">Build your team on RoleWave <ArrowRight size={16} /></button></article>
      </div></section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12"><div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#F0EDE4] p-7 sm:p-10 lg:flex-row lg:items-end lg:p-14"><div><div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]"><Target size={16} />Find your fit</div><h2 className="font-display max-w-2xl text-5xl leading-[0.92] tracking-[-0.05em] text-[#123D35] sm:text-6xl">You do not need to have everything figured out.</h2><p className="mt-5 max-w-lg text-base leading-7 text-[#6B6962]">Not sure which roles are worth your time? RolePilot shows you where you actually stand, so you are not applying in the dark.</p></div><button type="button" onClick={() => navigate('/jobs')} className="inline-flex shrink-0 items-center gap-2 rounded-full bg-[#123D35] px-5 py-3.5 text-sm font-bold text-white transition-transform hover:-translate-y-0.5">Find your next opportunity <ArrowRight size={16} /></button></div></section>

      <section className="border-t border-[#E4E0D6] px-5 py-12 sm:px-8 lg:px-12"><div className="mx-auto flex max-w-[1240px] flex-col justify-between gap-3 text-sm text-[#8A887F] sm:flex-row"><span className="font-display text-xl font-semibold text-[#123D35]">RoleWave</span><span className="flex items-center gap-2"><Check size={15} className="text-[#1D9E75]" />Built for Nigerians. Transparent from application to hire.</span></div></section>
    </div>
  );
}

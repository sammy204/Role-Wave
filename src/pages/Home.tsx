import { ArrowRight, BadgeCheck, BookOpen, MapPin, Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Company, Job } from '../types';

const principles = [
  { number: '01', title: 'Discover the right role', description: 'Browse verified opportunities and learn about the companies behind them before you decide where to apply.' },
  { number: '02', title: 'Put your best self forward', description: 'Create a profile that represents your experience, skills, and the kind of work you want next.' },
  { number: '03', title: 'Track what happens next', description: 'Follow your applications from submission to decision, with updates that keep your search moving.' },
];

const roleFamilies = [
  ['engineering', ['engineer', 'engineering', 'developer', 'devops', 'software', 'technical']],
  ['design', ['designer', 'design', 'researcher']],
  ['customer', ['customer', 'support', 'success', 'care']],
  ['marketing', ['marketing', 'growth', 'brand', 'content']],
  ['data', ['data', 'analyst', 'analytics']],
  ['operations', ['operations', 'manager', 'coordinator', 'administrative']],
] as const;

function getRoleFamily(job: Job): string {
  const searchable = `${job.title} ${(job.tags || []).join(' ')}`.toLowerCase();
  return roleFamilies.find(([, keywords]) => keywords.some((keyword) => searchable.includes(keyword)))?.[0] || 'other';
}

function chooseDiverseJobs(jobs: (Job & { company?: Company })[]): (Job & { company?: Company })[] {
  const selected: (Job & { company?: Company })[] = [];
  const selectedFamilies = new Set<string>();

  for (const job of jobs) {
    const family = getRoleFamily(job);
    if (!selectedFamilies.has(family)) {
      selected.push(job);
      selectedFamilies.add(family);
    }
    if (selected.length === 10) return selected;
  }

  for (const job of jobs) {
    if (!selected.some((selectedJob) => selectedJob.id === job.id)) selected.push(job);
    if (selected.length === 10) break;
  }

  return selected;
}

export default function Home() {
  const navigate = useNavigate();
  const [liveJobs, setLiveJobs] = useState<(Job & { company?: Company })[]>([]);

  useEffect(() => {
    let active = true;

    async function fetchLiveJobs() {
      const [{ data: jobs }, { data: companies }] = await Promise.all([
        supabase
          .from('jobs')
          .select('*')
          .eq('status', 'active')
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false }),
        supabase.from('companies').select('*'),
      ]);

      if (!active) return;

      const companyById = new Map((companies || []).map((company) => [company.id, company as Company]));
      const activeJobs = (jobs || []).map((job) => ({ ...job, company: companyById.get(job.company_id) }));
      setLiveJobs(chooseDiverseJobs(activeJobs));
    }

    void fetchLiveJobs();
    return () => {
      active = false;
    };
  }, []);

  const marqueeJobs = liveJobs.length > 1 ? [...liveJobs, ...liveJobs] : liveJobs;

  return (
    <div className="page-shell landing-page bg-[#F7F5EF] text-[#1A1A1A]">
      <section className="relative overflow-hidden px-5 pb-20 pt-12 sm:px-8 sm:pb-28 sm:pt-20 lg:px-12 lg:pt-24">
        <div className="pointer-events-none absolute -right-32 -top-40 h-[34rem] w-[34rem] rounded-full bg-[#D8F2E8] blur-3xl" />
        <div className="pointer-events-none absolute -bottom-48 left-1/3 h-[30rem] w-[30rem] rounded-full bg-[#EAE2F5] blur-3xl" />
        <div className="relative mx-auto max-w-[1240px]">
          <div className="grid items-end gap-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-20">
            <div>
              <div className="mb-8 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]">A clearer way forward</div>
              <h1 className="font-display max-w-4xl text-[clamp(2.25rem,8vw,6.5rem)] font-semibold leading-[0.92] tracking-[-0.06em] text-[#123D35]">Find work with more clarity.</h1>
              <p className="mt-8 max-w-xl text-base leading-8 text-[#5F5E5A] sm:text-lg">Discover verified opportunities across Nigeria and beyond, build a profile that represents you, and know what happens after you apply.</p>
              <div className="mt-9 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => navigate('/candidate/start?mode=signup')} className="brand-gradient inline-flex min-w-0 items-center justify-center gap-2 rounded-full px-7 py-4 text-base font-bold text-white shadow-[0_14px_32px_rgba(18,61,53,0.2)] transition-transform hover:-translate-y-0.5 sm:min-w-48 sm:px-10 sm:py-5 sm:text-xl">Looking for work</button>
                <button type="button" onClick={() => navigate('/employer/start?mode=signup')} className="inline-flex min-w-0 items-center justify-center gap-2 rounded-full border border-[#BFCAC3] bg-white/55 px-7 py-4 text-base font-bold text-[#123D35] transition-colors hover:border-[#1D9E75] hover:bg-white sm:min-w-48 sm:px-10 sm:py-5 sm:text-xl">Hire talent</button>
              </div>
            </div>
            <div className="relative lg:pb-5">
              <div className="absolute -left-5 -top-5 hidden h-24 w-24 rounded-full border border-[#1D9E75]/30 sm:block" />
              <div className="relative rounded-[2rem] border border-white/80 bg-white/65 p-6 shadow-[0_24px_70px_rgba(26,26,26,0.08)] backdrop-blur-xl sm:p-8">
                <p className="font-display text-[2.15rem] leading-[1.03] tracking-[-0.04em] text-[#123D35] sm:text-[2.8rem]">Your next opportunity should not feel like a guessing game.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="brand-gradient border-y border-[#E4E0D6] px-5 py-20 text-white sm:py-24 lg:px-12">
        <div className="mx-auto max-w-[1240px]">
          <div className="flex flex-col items-start justify-between gap-7 sm:flex-row sm:items-end">
            <div>
              <div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#8AD7B8]"><span className="h-px w-8 bg-[#8AD7B8]" />Live opportunities</div>
              <h2 className="font-display max-w-2xl text-4xl leading-[0.96] tracking-[-0.05em] sm:text-6xl">Open roles worth a look.</h2>
              <p className="mt-5 max-w-xl text-base leading-8 text-white/65 sm:text-lg">Live opportunities for people ready to make their next move.</p>
            </div>
            <Link to="/find-work" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-5 py-3.5 text-sm font-bold text-[#123D35] transition-transform hover:-translate-y-0.5">Explore all opportunities <ArrowRight size={16} /></Link>
          </div>

          {liveJobs.length > 0 && (
            <div className="relative mt-12 overflow-hidden" aria-label="Live job opportunities">
              <div className="job-marquee-track flex w-max gap-4 hover:[animation-play-state:paused]">
                {marqueeJobs.map((job, index) => (
                  <Link
                    key={`${job.id}-${index}`}
                    to="/find-work"
                    className="group flex w-[280px] shrink-0 flex-col rounded-[1.5rem] border border-white/10 bg-white/[0.09] p-5 transition-colors hover:bg-white/[0.15] sm:w-[340px]"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <h3 className="truncate text-base font-bold text-white group-hover:text-[#8AD7B8]">{job.title}</h3>
                        <div className="mt-1 flex items-center gap-1 text-sm text-white/60">
                          <span className="truncate">{job.company?.name || 'RoleWave employer'}</span>
                          {job.company?.verified && <BadgeCheck size={14} className="shrink-0 text-[#8AD7B8]" aria-label="Verified employer" />}
                        </div>
                      </div>
                      <ArrowRight size={17} className="shrink-0 text-white/40 transition-transform group-hover:translate-x-1 group-hover:text-[#8AD7B8]" />
                    </div>
                    <div className="mt-7 flex items-center justify-between gap-3 text-xs text-white/55">
                      <span className="flex min-w-0 items-center gap-1.5 truncate"><MapPin size={13} className="shrink-0 text-[#8AD7B8]" />{job.location}</span>
                      <span className="shrink-0 rounded-full bg-white/10 px-2.5 py-1 font-semibold text-white/75">{job.work_type}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="px-5 py-20 sm:px-8 sm:py-28 lg:px-12"><div className="mx-auto max-w-[1240px]">
        <div className="mb-12 max-w-2xl"><h2 className="font-display text-4xl leading-[0.98] tracking-[-0.05em] text-[#123D35] sm:text-6xl">From discovery to decision.</h2></div>
        <div className="grid gap-px overflow-hidden rounded-[2rem] border border-[#DDD9CE] bg-[#DDD9CE] md:grid-cols-3">{principles.map((principle) => <article key={principle.number} className="bg-[#FBFAF7] p-7 sm:p-9"><div className="mb-16 flex items-center justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-[#A4A198]"><span>{principle.number}</span><span className="h-px w-12 bg-[#C6C2B7]" /></div><h3 className="font-display text-3xl leading-none tracking-[-0.035em] text-[#123D35]">{principle.title}</h3><p className="mt-4 text-sm leading-7 text-[#6B6962]">{principle.description}</p></article>)}</div>
      </div></section>

      <section className="px-5 pb-20 sm:px-8 sm:pb-28 lg:px-12"><div className="mx-auto grid max-w-[1240px] gap-4 lg:grid-cols-2">
        <article className="rounded-[2rem] bg-[#E3F4EC] p-7 sm:p-10"><div className="flex items-center justify-between"><span className="rounded-full bg-white/70 p-3 text-[#0F6E56]"><Target size={20} /></span><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#5A8C76]">RolePilot</span></div><h2 className="font-display mt-20 max-w-md text-4xl leading-[0.95] tracking-[-0.045em] text-[#123D35] sm:text-5xl">Know your fit before you apply.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#4D7163]">RolePilot helps you understand how your profile lines up with a role, so you can focus your effort on opportunities that make sense.</p><button type="button" onClick={() => navigate('/candidate/start?mode=login')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#0F6E56] hover:gap-3">Sign in to try RolePilot <ArrowRight size={16} /></button></article>
        <article className="rounded-[2rem] bg-[#EAE3F4] p-7 sm:p-10"><div className="flex items-center justify-between"><span className="rounded-full bg-white/70 p-3 text-[#5B4088]"><BookOpen size={20} /></span><span className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#806BA0]">From the blog</span></div><h2 className="font-display mt-20 max-w-md text-4xl leading-[0.95] tracking-[-0.045em] text-[#32204F] sm:text-5xl">Practical ideas for your next move.</h2><p className="mt-5 max-w-md text-sm leading-7 text-[#6E5C85]">Read practical advice on finding better work, preparing for interviews, and building a stronger hiring process.</p><button type="button" onClick={() => navigate('/blog')} className="mt-8 inline-flex items-center gap-2 text-sm font-bold text-[#5B4088] hover:gap-3">Read our blog <ArrowRight size={16} /></button></article>
      </div></section>

      <section className="px-5 pb-24 sm:px-8 sm:pb-32 lg:px-12"><div className="mx-auto flex max-w-[1240px] flex-col items-start justify-between gap-8 rounded-[2rem] bg-[#F0EDE4] p-7 sm:p-10 lg:flex-row lg:items-end lg:p-14"><div><div className="mb-5 flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]"><Target size={16} />Your next move</div><h2 className="font-display max-w-2xl text-5xl leading-[0.92] tracking-[-0.05em] text-[#123D35] sm:text-6xl">Your next move starts here.</h2><p className="mt-5 max-w-lg text-base leading-7 text-[#6B6962]">Browse live opportunities, find work that fits your direction, or connect with people ready to help your company grow.</p></div><div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row"><button type="button" onClick={() => navigate('/candidate/start?mode=signup')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full bg-[#123D35] px-7 py-4 text-base font-bold text-white transition-transform hover:-translate-y-0.5">Looking for work</button><button type="button" onClick={() => navigate('/employer/start?mode=signup')} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-full border border-[#BFCAC3] bg-white/60 px-7 py-4 text-base font-bold text-[#123D35] transition-colors hover:border-[#1D9E75] hover:bg-white">Hire talent</button></div></div></section>

    </div>
  );
}

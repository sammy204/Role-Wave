import { useState, type FormEvent } from 'react';
import { BadgeCheck, MapPin, Search } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import type { Company, Job } from '../types';

type PreviewJob = Pick<Job, 'id' | 'title' | 'slug' | 'location' | 'work_type' | 'job_type' | 'company_id'> & {
  company?: Pick<Company, 'name' | 'verified'>;
};

export default function FindWork() {
  const [query, setQuery] = useState('');
  const [jobs, setJobs] = useState<PreviewJob[]>([]);
  const [searched, setSearched] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const searchJobs = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const term = query.trim();
    if (term.length < 2) {
      setError('Enter at least two characters to search.');
      return;
    }

    setLoading(true);
    setError('');
    setSearched(true);

    const { data: jobRows, error: jobsError } = await supabase
      .from('jobs')
      .select('id, title, slug, location, work_type, job_type, company_id')
      .eq('status', 'active')
      .ilike('title', `%${term}%`)
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(10);

    if (jobsError) {
      setError('We could not load opportunities right now. Please try again.');
      setJobs([]);
      setLoading(false);
      return;
    }

    const companyIds = [...new Set((jobRows || []).map((job) => job.company_id))];
    const { data: companyRows } = companyIds.length
      ? await supabase.from('companies').select('id, name, verified').in('id', companyIds)
      : { data: [] as Pick<Company, 'id' | 'name' | 'verified'>[] };
    const companyById = new Map((companyRows || []).map((company) => [company.id, company]));

    setJobs((jobRows || []).map((job) => ({ ...job, company: companyById.get(job.company_id) })));
    setLoading(false);
  };

  return (
    <div className="page-shell bg-[#F7F5EF] text-[#1A1A1A]">
      <main className="mx-auto w-full max-w-[920px] px-5 pb-24 pt-16 sm:px-8 sm:pt-24">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#0F6E56]">Find your next move</p>
          <h1 className="font-display mt-4 text-4xl leading-[0.98] tracking-[-0.05em] text-[#123D35] sm:text-7xl">Search for work that fits.</h1>
          <p className="mt-6 text-base leading-8 text-[#5F5E5A] sm:text-lg">Search by job title to preview current opportunities on RoleWave.</p>

          <form onSubmit={searchJobs} className="mx-auto mt-9 flex max-w-2xl flex-col gap-3 rounded-[1.5rem] border border-[#D8D4C9] bg-white p-2 shadow-[0_18px_50px_rgba(26,26,26,0.08)] sm:flex-row">
            <label htmlFor="job-title-search" className="sr-only">Search by job title</label>
            <div className="flex min-w-0 flex-1 items-center gap-3 px-4">
              <Search size={20} className="shrink-0 text-[#8A887F]" />
              <input id="job-title-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="e.g. Frontend Developer" className="w-full bg-transparent py-3 text-sm text-[#1A1A1A] outline-none placeholder:text-[#A4A198]" />
            </div>
            <button type="submit" className="brand-gradient inline-flex items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
              {loading ? 'Searching...' : 'Search jobs'}
            </button>
          </form>
          {error && <p className="mt-3 text-sm text-[#A15A00]">{error}</p>}
        </div>

        {searched && (
          <section className="mt-14">
            <div className="mb-5 flex items-end justify-between gap-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#8A887F]">Preview results</p>
                <h2 className="font-display mt-2 text-3xl tracking-[-0.04em] text-[#123D35]">Roles matching “{query.trim()}”</h2>
              </div>
            </div>

            {jobs.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                {jobs.map((job) => (
                  <article key={job.id} className="rounded-2xl border border-[#DDD9CE] bg-white p-5 shadow-[0_8px_24px_rgba(26,26,26,0.04)]">
                    <h3 className="text-base font-bold text-[#123D35]">{job.title}</h3>
                    <div className="mt-1 flex items-center gap-1 text-sm text-[#5F5E5A]">
                      <span>{job.company?.name || 'RoleWave employer'}</span>
                      {job.company?.verified && <BadgeCheck size={14} className="text-[#1D9E75]" aria-label="Verified employer" />}
                    </div>
                    <div className="mt-5 flex flex-wrap gap-2 text-xs text-[#6B6962]">
                      <span className="inline-flex items-center gap-1"><MapPin size={13} />{job.location}</span>
                      <span className="rounded-full bg-[#E3F4EC] px-2.5 py-1 font-semibold text-[#0F6E56]">{job.work_type}</span>
                      <span className="rounded-full bg-[#F1EFE8] px-2.5 py-1">{job.job_type}</span>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#CFCBC0] bg-white/60 px-6 py-10 text-center text-sm text-[#6B6962]">No active roles matched that title. Try a different job title.</div>
            )}

            <div className="brand-gradient mt-10 rounded-[1.5rem] px-6 py-8 text-center text-white sm:px-10">
              <h2 className="font-display text-3xl tracking-[-0.04em]">Want to see the full list?</h2>
              <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-white/70">Create a candidate account or sign in to explore every opportunity and apply.</p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
                <Link to="/candidate/start?mode=signup&next=/jobs" className="inline-flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-bold text-[#123D35]">Create candidate account</Link>
                <Link to="/candidate/start?mode=login&next=/jobs" className="inline-flex items-center justify-center rounded-full border border-white/35 px-5 py-3 text-sm font-bold text-white hover:bg-white/10">Log in</Link>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

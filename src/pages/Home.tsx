import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Search } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import type { Job, Company } from '../types';
import JobCard from '../components/JobCard';
import LoadingSpinner from '../components/LoadingSpinner';

const FETCH_TIMEOUT_MS = 25000;
const FEATURED_JOBS_LIMIT = 8;

export default function Home() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [stats, setStats] = useState({ live: 0, companies: 0, new: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('All cities');
  const [typeFilter, setTypeFilter] = useState('All types');
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();

  // Installed PWA + signed-in candidate: skip the marketplace landing
  // and go straight to the personalized "Welcome back" feed.
  useEffect(() => {
    if (!isPwa || authLoading || !session) return;

    let alive = true;

    void (async () => {
      try {
        const profile = await fetchProfile(session.user.id);
        if (alive && profile?.account_type === 'candidate') {
          navigate('/candidate/home', { replace: true });
        }
      } catch {
        // If the profile lookup fails, just stay on the marketplace.
      }
    })();

    return () => {
      alive = false;
    };
  }, [isPwa, authLoading, session, navigate]);

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError('');

      try {
        const { data: jobsData, error: jobsError } = await withTimeout(
          supabase
            .from('jobs')
            .select('*')
            .eq('status', 'active')
            .order('featured', { ascending: false })
            .order('created_at', { ascending: false })
            .limit(FEATURED_JOBS_LIMIT),
          FETCH_TIMEOUT_MS,
          'Jobs query'
        );

        if (jobsError) throw jobsError;

        const { data: companiesData, error: companiesError } = await withTimeout(
          supabase.from('companies').select('*').order('job_count', { ascending: false }),
          FETCH_TIMEOUT_MS,
          'Companies query'
        );
        if (companiesError) throw companiesError;

        const companyById = new Map((companiesData || []).map((company) => [company.id, company]));
        setJobs((jobsData || []).map((job) => ({ ...job, company: companyById.get(job.company_id) })));

        const { count: liveCount, error: liveError } = await withTimeout(
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          FETCH_TIMEOUT_MS,
          'Live jobs count'
        );
        if (liveError) throw liveError;

        const { count: companyCount, error: companyCountError } = await withTimeout(
          supabase.from('companies').select('*', { count: 'exact', head: true }),
          FETCH_TIMEOUT_MS,
          'Company count'
        );
        if (companyCountError) throw companyCountError;

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const { count: newCount, error: newCountError } = await withTimeout(
          supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('created_at', oneDayAgo),
          FETCH_TIMEOUT_MS,
          'New jobs count'
        );
        if (newCountError) throw newCountError;

        setStats({
          live: liveCount || 0,
          companies: companyCount || 0,
          new: newCount || 0,
        });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (cityFilter !== 'All cities') params.set('city', cityFilter);
    if (typeFilter !== 'All types') params.set('type', typeFilter);
    navigate(`/jobs?${params.toString()}`);
  };

  return (
    <div className="page-shell">
      <div className="px-4 pt-5 pb-5 sm:px-6 sm:pt-8 sm:pb-7 lg:px-8">
        <div className="mx-auto grid max-w-[1320px] gap-4 lg:grid-cols-[1.15fr_0.85fr]">
          <section className="relative overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#16352f_0%,#1D9E75_52%,#2a7a67_100%)] px-4 py-6 shadow-[0_28px_80px_rgba(29,158,117,0.26)] ring-1 ring-white/10 sm:px-8 sm:py-10 lg:px-10">
            <div className="pointer-events-none absolute -left-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
            <div className="pointer-events-none absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-[#0F6E56]/30 blur-3xl" />

            <div className="relative max-w-3xl">
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/70 backdrop-blur-xl">
                Nigeria&apos;s Tech Job Board
              </div>

              <h1 className="font-display mb-3 max-w-2xl text-[30px] font-bold leading-[1.02] tracking-[-1.6px] text-white sm:text-[48px]">
                Find your next role.
                <br className="hidden sm:block" />
                Get hired in Nigeria.
              </h1>

              <p className="mb-6 max-w-xl text-sm leading-relaxed text-white/76 sm:text-base">
                Verified roles, laid out cleanly so you can focus on the jobs that fit your skills, location, and work style.
              </p>

              <div className="mb-4 flex items-center overflow-hidden rounded-[18px] border border-white/20 bg-white/95 shadow-[0_18px_44px_rgba(0,0,0,0.16)] ring-1 ring-black/5 sm:hidden">
                <Search size={16} className="ml-3 flex-shrink-0 text-[#B4B2A9]" />
                <input
                  type="text"
                  placeholder="Job title, skill or company..."
                  className="flex-1 border-none bg-transparent px-2 py-3 text-sm text-[#1A1A1A] outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button
                  onClick={handleSearch}
                  className="bg-[#085041] px-4 py-3 text-xs font-semibold text-white transition-all duration-200 hover:bg-[#06362a] active:scale-[0.98]"
                >
                  Search
                </button>
              </div>

              <div className="hidden max-w-[760px] items-center overflow-hidden rounded-[20px] border border-white/15 bg-white/92 shadow-[0_18px_44px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:flex">
                <Search size={18} className="ml-4 flex-shrink-0 text-[#B4B2A9]" />
                <input
                  type="text"
                  placeholder="Job title, skill or company..."
                  className="flex-1 border-none bg-transparent px-0 py-3.5 text-[15px] text-[#1A1A1A] outline-none"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <div className="h-7 w-[0.5px] flex-shrink-0 bg-[#D3D1C7]" />
                <select
                  className="cursor-pointer border-none bg-transparent px-4 text-sm text-[#5F5E5A] outline-none"
                  value={cityFilter}
                  onChange={(e) => setCityFilter(e.target.value)}
                >
                  <option>All cities</option>
                  <option>Lagos</option>
                  <option>Abuja</option>
                  <option>Port Harcourt</option>
                </select>
                <div className="h-7 w-[0.5px] flex-shrink-0 bg-[#D3D1C7]" />
                <select
                  className="cursor-pointer border-none bg-transparent px-4 text-sm text-[#5F5E5A] outline-none"
                  value={typeFilter}
                  onChange={(e) => setTypeFilter(e.target.value)}
                >
                  <option>All types</option>
                  <option>Full-time</option>
                  <option>Contract</option>
                  <option>Internship</option>
                </select>
                <button
                  onClick={handleSearch}
                  className="flex-shrink-0 bg-[#085041] px-7 py-3.5 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#06362a] active:scale-[0.98]"
                >
                  Search jobs
                </button>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {[
                  { value: `${stats.live} live jobs`, tone: 'bg-white/15 text-white' },
                  { value: `${stats.companies} companies`, tone: 'bg-white/15 text-white' },
                  { value: `${stats.new} new today`, tone: 'bg-white/15 text-white' },
                  { value: '100% verified', tone: 'bg-[#E1F5EE] text-[#085041]' },
                ].map((item) => (
                  <span
                    key={item.value}
                    className={`rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.1)] ${item.tone}`}
                  >
                    {item.value}
                  </span>
                ))}
              </div>
            </div>
          </section>

          <aside className="relative overflow-hidden rounded-[34px] border border-white/70 bg-white/78 p-5 shadow-[0_24px_70px_rgba(26,26,26,0.08)] backdrop-blur-xl sm:p-6">
            <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-[#1D9E75]/10 blur-3xl" />
            <div className="pointer-events-none absolute -left-8 bottom-0 h-36 w-36 rounded-full bg-[#5B4088]/10 blur-3xl" />

            <div className="relative">
              <div className="mb-5 flex items-start justify-between gap-4">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#B4B2A9]">
                    Market pulse
                  </div>
                  <div className="mt-1 font-display text-[24px] font-bold leading-[1.06] text-[#1A1A1A]">
                    A calmer way to browse and hire.
                  </div>
                </div>
                <div className="rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
                  Updated live
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                <div className="rounded-[24px] border border-[#E8E4DA] bg-[#FBFAF7] p-4 shadow-[0_10px_24px_rgba(26,26,26,0.04)]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B4B2A9]">Search focus</div>
                  <div className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
                    Use filters and search to jump straight into the roles that fit your skills, location, and work style.
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#E8E4DA] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.04)]">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B4B2A9]">Verified employers</div>
                  <div className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
                    Every listing is checked before it goes live, so the board stays sharp and trustworthy.
                  </div>
                </div>
                <div className="rounded-[24px] border border-[#E8E4DA] bg-[#1A1A1A] p-4 text-white shadow-[0_14px_30px_rgba(26,26,26,0.14)] sm:col-span-2 lg:col-span-1">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/50">
                    Start here
                  </div>
                  <div className="mt-2 text-lg font-semibold">Create your account when you're ready.</div>
                  <p className="mt-2 text-sm leading-relaxed text-white/68">
                    Build a profile once, then keep your applications, saved roles, and matching jobs in one place.
                  </p>
                  <button
                    type="button"
                    onClick={() => navigate('/start')}
                    className="mt-4 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] transition-transform duration-200 hover:-translate-y-[1px]"
                  >
                    Get started <ArrowRight size={14} />
                  </button>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      <div className="mx-auto grid w-full max-w-[1320px] grid-cols-1 gap-4 px-4 pb-8 sm:px-6 lg:px-8">
        <div className="min-w-0 rounded-[34px] border border-white/70 bg-white/72 p-4 shadow-[0_24px_70px_rgba(26,26,26,0.06)] backdrop-blur-xl sm:p-6">
          <div className="mb-4 flex items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-bold text-[#1A1A1A] sm:text-2xl">Featured jobs</h2>
              
            </div>
            <button
              onClick={() => navigate('/jobs')}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-4 py-2 text-sm font-semibold text-[#085041] shadow-[0_10px_24px_rgba(26,26,26,0.04)] transition-colors hover:border-[#5DCAA5]"
            >
              Browse all jobs <ArrowRight size={14} />
            </button>
          </div>

          {loading ? (
            <div className="rounded-[24px] border border-[#E8E4DA] bg-[#FBFAF7] py-20">
              <LoadingSpinner className="mx-auto text-[#1D9E75]" />
            </div>
          ) : error ? (
            <div className="mx-auto max-w-xl rounded-[24px] border border-[#E8E4DA] bg-[#FBFAF7] py-20 text-center">
              <div className="mb-2 text-lg font-semibold text-[#1A1A1A]">Could not load jobs</div>
              <div className="text-sm text-[#5F5E5A]">{error}</div>
            </div>
          ) : jobs.length === 0 ? (
            <div className="rounded-[24px] border border-[#E8E4DA] bg-[#FBFAF7] py-20 text-center text-[#5F5E5A]">
              No jobs posted yet â€” check back soon.
            </div>
          ) : (
            <div className="space-y-3 sm:space-y-3.5">
              {jobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

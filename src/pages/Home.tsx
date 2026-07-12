import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import type { Job, Company } from '../types';
import JobCard from '../components/JobCard';

const FETCH_TIMEOUT_MS = 25000;

const chipOptions = ['All jobs', 'Remote', 'Hybrid', 'Full-time', 'Contract', 'Internship'];

const workTypeFilters = [
  { label: 'Remote' },
  { label: 'Hybrid' },
  { label: 'On-site' },
];

const jobTypeFilters = [
  { label: 'Full-time' },
  { label: 'Contract' },
  { label: 'Internship' },
];

const cityFilters = [
  { label: 'Lagos' },
  { label: 'Abuja' },
  { label: 'Port Harcourt' },
  { label: 'Remote only' },
];

export default function Home() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [stats, setStats] = useState({ live: 0, companies: 0, new: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState('All cities');
  const [typeFilter, setTypeFilter] = useState('All types');
  const [activeChip, setActiveChip] = useState('All jobs');
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([
    'Remote',
    'Hybrid',
    'On-site',
  ]);
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([
    'Full-time',
    'Part-time',
    'Contract',
    'Internship',
  ]);
  const [selectedCities, setSelectedCities] = useState<string[]>([
    'Lagos',
    'Abuja',
    'Port Harcourt',
    'Remote only',
  ]);
  const [email, setEmail] = useState('');
  const [subscriptionState, setSubscriptionState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [topCompanies, setTopCompanies] = useState<Company[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();

  // Installed PWA + signed-in candidate: skip the marketplace landing
  // and go straight to the personalized "Welcome back" feed. Browser
  // visits (mobile or desktop) always stay on the marketplace here.
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
            .order('created_at', { ascending: false }),
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

        setTopCompanies((companiesData || []).slice(0, 3));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const filteredJobs = useMemo(() => {
    let result = [...jobs];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (j) =>
          j.title.toLowerCase().includes(q) ||
          j.company?.name.toLowerCase().includes(q) ||
          j.tags?.some((t) => t.toLowerCase().includes(q))
      );
    }

    if (activeChip !== 'All jobs') {
      if (activeChip === 'Remote' || activeChip === 'Hybrid') {
        result = result.filter((j) => j.work_type === activeChip);
      } else {
        result = result.filter((j) => j.job_type === activeChip);
      }
    }

    if (selectedWorkTypes.length > 0) {
      result = result.filter((j) => selectedWorkTypes.includes(j.work_type));
    }
    if (selectedJobTypes.length > 0) {
      result = result.filter((j) => selectedJobTypes.includes(j.job_type));
    }
    if (selectedCities.length > 0) {
      result = result.filter((j) => {
        if (selectedCities.includes('Remote only')) {
          return j.work_type === 'Remote' || selectedCities.includes(j.location);
        }
        return selectedCities.includes(j.location);
      });
    }

    return result;
  }, [jobs, searchQuery, activeChip, selectedWorkTypes, selectedJobTypes, selectedCities]);

  const handleSearch = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (cityFilter !== 'All cities') params.set('city', cityFilter);
    if (typeFilter !== 'All types') params.set('type', typeFilter);
    navigate(`/jobs?${params.toString()}`);
  };

  const handleSubscribe = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) {
      setSubscriptionState('error');
      setSubscriptionMessage('Please enter your email address.');
      return;
    }

    setSubscriptionState('saving');
    setSubscriptionMessage('');

    const { error } = await supabase.from('email_subscriptions').insert({
      email: normalizedEmail,
    });

    if (error) {
      if (error.code === '23505') {
        setSubscriptionState('success');
        setSubscriptionMessage('You are already subscribed.');
        return;
      }

      setSubscriptionState('error');
      setSubscriptionMessage(error.message || 'Could not save your subscription.');
      return;
    }

    setSubscriptionState('success');
    setSubscriptionMessage('You are subscribed. We will send you new job alerts.');
    setEmail('');
  };

  const toggleWorkType = (label: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const toggleJobType = (label: string) => {
    setSelectedJobTypes((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const toggleCity = (label: string) => {
    setSelectedCities((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const getFilterCount = (
    items: { label: string }[],
    key: 'work_type' | 'job_type' | 'location'
  ) => {
    return items.map((item) => {
      const label = item.label;
      if (key === 'work_type') {
        return jobs.filter((j) => j.work_type === label).length;
      }
      if (key === 'job_type') {
        return jobs.filter((j) => j.job_type === label).length;
      }
      if (label === 'Remote only') {
        return jobs.filter((j) => j.work_type === 'Remote').length;
      }
      return jobs.filter((j) => j.location === label).length;
    });
  };

  const workTypeCounts = getFilterCount(workTypeFilters, 'work_type');
  const jobTypeCounts = getFilterCount(jobTypeFilters, 'job_type');
  const cityCounts = getFilterCount(cityFilters, 'location');

  const FilterSection = () => (
    <div className="p-5 sm:p-6">
      <div className="mb-7">
        <div className="text-[11px] font-bold text-[#B4B2A9] tracking-[1.5px] uppercase mb-3">
          Work type
        </div>
        {workTypeFilters.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => toggleWorkType(item.label)}
          >
            <div className="flex items-center gap-2 text-[13px] text-[#5F5E5A]">
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                  selectedWorkTypes.includes(item.label)
                    ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                    : 'border-[1.5px] border-[#D3D1C7]'
                }`}
              >
                {selectedWorkTypes.includes(item.label) && '✓'}
              </div>
              {item.label}
            </div>
            <span className="text-[11px] text-[#B4B2A9]">{workTypeCounts[i]}</span>
          </div>
        ))}
      </div>

      <div className="mb-7">
        <div className="text-[11px] font-bold text-[#B4B2A9] tracking-[1.5px] uppercase mb-3">
          Job type
        </div>
        {jobTypeFilters.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => toggleJobType(item.label)}
          >
            <div className="flex items-center gap-2 text-[13px] text-[#5F5E5A]">
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                  selectedJobTypes.includes(item.label)
                    ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                    : 'border-[1.5px] border-[#D3D1C7]'
                }`}
              >
                {selectedJobTypes.includes(item.label) && '✓'}
              </div>
              {item.label}
            </div>
            <span className="text-[11px] text-[#B4B2A9]">{jobTypeCounts[i]}</span>
          </div>
        ))}
      </div>

      <div>
        <div className="text-[11px] font-bold text-[#B4B2A9] tracking-[1.5px] uppercase mb-3">
          City
        </div>
        {cityFilters.map((item, i) => (
          <div
            key={item.label}
            className="flex items-center justify-between mb-2 cursor-pointer"
            onClick={() => toggleCity(item.label)}
          >
            <div className="flex items-center gap-2 text-[13px] text-[#5F5E5A]">
              <div
                className={`w-3.5 h-3.5 rounded flex items-center justify-center text-[9px] ${
                  selectedCities.includes(item.label)
                    ? 'bg-[#1D9E75] border-[#1D9E75] text-white'
                    : 'border-[1.5px] border-[#D3D1C7]'
                }`}
              >
                {selectedCities.includes(item.label) && '✓'}
              </div>
              {item.label}
            </div>
            <span className="text-[11px] text-[#B4B2A9]">{cityCounts[i]}</span>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="page-shell">
      <div className="px-4 pt-5 pb-5 sm:px-6 sm:pt-8 sm:pb-7 lg:px-8">
        <div className="mx-auto max-w-[1320px] rounded-[28px] border border-white/70 bg-[#1D9E75] px-4 py-6 shadow-[0_24px_70px_rgba(29,158,117,0.22)] ring-1 ring-white/10 sm:rounded-[32px] sm:px-8 sm:py-10 lg:px-10">
          <div className="max-w-3xl">
            <p className="mb-3 text-[10px] font-semibold uppercase tracking-[1.5px] text-white/55 sm:text-[11px]">
              Nigeria&apos;s Tech Job Board
            </p>
            <h1 className="font-display mb-3 max-w-2xl text-[28px] font-bold leading-[1.06] tracking-[-1.5px] text-white sm:text-[46px]">
              Find your next role.
              <br className="hidden sm:block" />
              Get hired in Nigeria.
            </h1>
            <p className="mb-5 max-w-xl text-sm leading-relaxed text-white/70 sm:mb-7 sm:text-base">
              Verified jobs from top companies, presented cleanly. Use the header to log in or sign up
              when you are ready to build your account.
            </p>

            <div className="mb-4 flex items-center overflow-hidden rounded-[14px] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.16)] ring-1 ring-black/5 sm:hidden">
              <Search size={16} className="ml-3 flex-shrink-0 text-[#B4B2A9]" />
              <input
                type="text"
                placeholder="Job title, skill or company..."
                className="flex-1 border-none bg-transparent px-2 py-3 text-sm text-[#1A1A1A] outline-none"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              />
              <button onClick={handleSearch} className="bg-[#085041] px-4 py-3 text-xs font-semibold text-white transition-all duration-200 hover:bg-[#06362a] active:scale-[0.98]">
                Search
              </button>
            </div>

            <div className="hidden max-w-[700px] items-center overflow-hidden rounded-[16px] bg-white shadow-[0_14px_34px_rgba(0,0,0,0.14)] ring-1 ring-black/5 sm:flex">
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

            <div className="mt-5 grid grid-cols-2 gap-2.5 sm:mt-7 sm:gap-3 sm:grid-cols-4">
              {[
                { value: stats.live, label: 'Live jobs' },
                { value: stats.companies, label: 'Companies hiring' },
                { value: stats.new, label: 'New today' },
                { value: '100%', label: 'Verified listings' },
              ].map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-white/15 bg-white/10 px-3 py-3 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] transition-transform duration-200 hover:-translate-y-0.5 sm:px-4 sm:py-4"
                >
                  <div className="text-[20px] font-bold leading-none sm:text-[26px]">{item.value}</div>
                  <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-white/60 sm:text-[11px]">
                    {item.label}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
        {chipOptions.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveChip(chip)}
            className={`flex-shrink-0 rounded-full px-4 py-[8px] text-[13px] font-semibold whitespace-nowrap transition-all duration-200 active:scale-[0.98] ${
              activeChip === chip
                ? 'bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5] shadow-[0_10px_24px_rgba(29,158,117,0.12)]'
                : 'bg-white text-[#5F5E5A] border border-[#D3D1C7] hover:border-[#5DCAA5] shadow-[0_6px_18px_rgba(26,26,26,0.03)]'
            }`}
          >
            {chip}
          </button>
        ))}
        <div className="flex-1 min-w-0" />
        <span className="text-[13px] text-[#B4B2A9] whitespace-nowrap hidden sm:inline">
          Showing {filteredJobs.length} jobs
        </span>
        <button
          className="sm:hidden flex items-center gap-1 rounded-[20px] border border-[#D3D1C7] px-3 py-[6px] text-[13px] text-[#5F5E5A] transition-all duration-200 hover:border-[#5DCAA5] active:scale-[0.98]"
          onClick={() => setShowMobileFilters(true)}
        >
          <SlidersHorizontal size={14} /> Filters
        </button>
      </div>

      {showMobileFilters && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowMobileFilters(false)}
          />
          <div className="absolute right-0 top-0 bottom-0 w-[280px] bg-white shadow-xl overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-[#D3D1C7]">
              <span className="text-sm font-semibold text-[#1A1A1A]">Filters</span>
              <button onClick={() => setShowMobileFilters(false)}>
                <X size={18} className="text-[#5F5E5A]" />
              </button>
            </div>
            <FilterSection />
          </div>
        </div>
      )}

      <div className="mx-auto grid min-h-[500px] w-full max-w-[1320px] grid-cols-1 gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[260px_1fr_300px] lg:px-8">
        <div className="hidden overflow-hidden rounded-[24px] panel-soft lg:block">
          <FilterSection />
        </div>

        <div className="min-w-0">
          {loading ? (
            <div className="panel rounded-[24px] py-20 text-center text-[#5F5E5A]">Loading jobs...</div>
          ) : error ? (
            <div className="panel mx-auto max-w-xl rounded-[24px] py-20 text-center">
              <div className="text-lg font-semibold text-[#1A1A1A] mb-2">Could not load jobs</div>
              <div className="text-sm text-[#5F5E5A]">{error}</div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="panel rounded-[24px] py-20 text-center text-[#5F5E5A]">No jobs match your filters.</div>
          ) : (
            <div className="space-y-3 sm:space-y-3.5">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        <div className="hidden rounded-[24px] panel-soft p-5 lg:block">
          <div className="panel rounded-[20px] p-4 mb-3.5">
            <div className="text-[13px] font-semibold text-[#1A1A1A] mb-3">Board stats</div>
            <div className="flex justify-between mb-2">
              <span className="text-[13px] text-[#5F5E5A]">Live jobs</span>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">{stats.live}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-[13px] text-[#5F5E5A]">Companies</span>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">{stats.companies}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-[13px] text-[#5F5E5A]">New today</span>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">{stats.new}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[13px] text-[#5F5E5A]">Verified</span>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">100%</span>
            </div>
          </div>

          <form className="panel rounded-[20px] p-4 mb-3.5" onSubmit={handleSubscribe}>
            <div className="text-[13px] font-semibold text-[#1A1A1A] mb-3">Get job alerts</div>
            <input
              type="email"
              placeholder="Your email address"
              className="field-shell mb-2 px-3 py-2 text-[13px]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button
              type="submit"
              disabled={subscriptionState === 'saving'}
              className="w-full rounded-lg bg-[#1D9E75] py-2 text-[13px] font-semibold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
            >
              {subscriptionState === 'saving' ? 'Saving...' : 'Notify me'}
            </button>
            {subscriptionMessage && (
              <div
                className={`mt-2 text-[12px] ${
                  subscriptionState === 'success' ? 'text-[#085041]' : 'text-[#A15A00]'
                }`}
              >
                {subscriptionMessage}
              </div>
            )}
          </form>

          <div className="panel rounded-[20px] p-4">
            <div className="text-[13px] font-semibold text-[#1A1A1A] mb-3">Top companies</div>
            {topCompanies.map((co) => {
              const colorMap: Record<string, string> = {
                teal: 'bg-[#E1F5EE] text-[#085041]',
                blue: 'bg-[#E6F1FB] text-[#0C447C]',
                amber: 'bg-[#FAEEDA] text-[#633806]',
                purple: 'bg-[#EEEDFE] text-[#3C3489]',
                coral: 'bg-[#FAECE7] text-[#712B13]',
              };

              return (
                <div key={co.id} className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-7 h-7 rounded-md flex items-center justify-center text-[10px] font-bold ${
                        colorMap[co.avatar_color] || colorMap.teal
                      }`}
                    >
                      {co.logo_initials}
                    </div>
                    <div>
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{co.name}</div>
                      <div className="text-[11px] text-[#B4B2A9]">{co.job_count} open roles</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

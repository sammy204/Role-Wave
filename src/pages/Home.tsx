import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import type { Job, Company } from '../types';
import JobCard from '../components/JobCard';

const FETCH_TIMEOUT_MS = 10000;

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
  const [topCompanies, setTopCompanies] = useState<Company[]>([]);
  const [showMobileFilters, setShowMobileFilters] = useState(false);

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
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      <div className="bg-[#1D9E75] px-4 sm:px-10 pt-10 sm:pt-14 pb-8 sm:pb-12">
        <div className="max-w-[1120px] mx-auto">
          <p className="text-[10px] sm:text-[11px] font-semibold tracking-[1.5px] text-white/55 mb-3 uppercase">
            Nigeria's Tech Job Board
          </p>
          <h1 className="text-[28px] sm:text-[40px] font-bold text-white leading-[1.2] mb-2.5 tracking-[-1px]">
            Find your next role.
            <br className="hidden sm:block" />
            Get hired in Nigeria.
          </h1>
          <p className="text-sm sm:text-base text-white/65 mb-6 sm:mb-7 leading-relaxed">
            Verified jobs from top companies - remote, hybrid & on-site roles paying in naira.
          </p>

          <div className="sm:hidden flex items-center bg-white rounded-[10px] overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.15)] mb-4">
            <Search size={16} className="text-[#B4B2A9] ml-3 flex-shrink-0" />
            <input
              type="text"
              placeholder="Job title, skill or company..."
              className="flex-1 border-none outline-none text-sm text-[#1A1A1A] py-3 bg-transparent px-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button onClick={handleSearch} className="bg-[#085041] text-white px-4 py-3 text-xs font-semibold">
              Search
            </button>
          </div>

          <div className="hidden sm:flex items-center bg-white rounded-[10px] overflow-hidden max-w-[680px] shadow-[0_4px_24px_rgba(0,0,0,0.15)]">
            <Search size={18} className="text-[#B4B2A9] ml-4 flex-shrink-0" />
            <input
              type="text"
              placeholder="Job title, skill or company..."
              className="flex-1 border-none outline-none text-[15px] text-[#1A1A1A] py-3.5 bg-transparent px-0"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            <div className="w-[0.5px] h-7 bg-[#D3D1C7] flex-shrink-0" />
            <select
              className="border-none outline-none text-sm text-[#5F5E5A] px-4 bg-transparent cursor-pointer"
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
            >
              <option>All cities</option>
              <option>Lagos</option>
              <option>Abuja</option>
              <option>Port Harcourt</option>
            </select>
            <div className="w-[0.5px] h-7 bg-[#D3D1C7] flex-shrink-0" />
            <select
              className="border-none outline-none text-sm text-[#5F5E5A] px-4 bg-transparent cursor-pointer"
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
              className="bg-[#085041] text-white px-7 py-3.5 text-sm font-semibold hover:bg-[#06362a] transition-colors flex-shrink-0"
            >
              Search jobs
            </button>
          </div>

          <div className="sm:hidden grid grid-cols-3 gap-4 mt-6">
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.live}</div>
              <div className="text-[10px] text-white/55 mt-0.5">Live jobs</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.companies}</div>
              <div className="text-[10px] text-white/55 mt-0.5">Companies</div>
            </div>
            <div className="text-center">
              <div className="text-lg font-bold text-white">{stats.new}</div>
              <div className="text-[10px] text-white/55 mt-0.5">New today</div>
            </div>
          </div>

          <div className="hidden sm:flex gap-9 mt-7">
            <div>
              <div className="text-[22px] font-bold text-white">{stats.live}</div>
              <div className="text-xs text-white/55 mt-0.5">Live jobs</div>
            </div>
            <div>
              <div className="text-[22px] font-bold text-white">{stats.companies}</div>
              <div className="text-xs text-white/55 mt-0.5">Companies hiring</div>
            </div>
            <div>
              <div className="text-[22px] font-bold text-white">{stats.new}</div>
              <div className="text-xs text-white/55 mt-0.5">New today</div>
            </div>
            <div>
              <div className="text-[22px] font-bold text-white">100%</div>
              <div className="text-xs text-white/55 mt-0.5">Verified listings</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-10 py-3 border-b border-[#D3D1C7] bg-white overflow-x-auto">
        {chipOptions.map((chip) => (
          <button
            key={chip}
            onClick={() => setActiveChip(chip)}
            className={`px-4 py-[6px] rounded-[20px] text-[13px] font-medium whitespace-nowrap transition-colors flex-shrink-0 ${
              activeChip === chip
                ? 'bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5]'
                : 'bg-white text-[#5F5E5A] border border-[#D3D1C7] hover:border-[#5DCAA5]'
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
          className="sm:hidden flex items-center gap-1 text-[13px] text-[#5F5E5A] border border-[#D3D1C7] px-3 py-[6px] rounded-[20px]"
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

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr_300px] min-h-[500px]">
        <div className="hidden lg:block border-r border-[#D3D1C7] bg-white">
          <FilterSection />
        </div>

        <div className="p-3 sm:p-5 bg-[#F1EFE8]">
          {loading ? (
            <div className="text-center py-20 text-[#5F5E5A]">Loading jobs...</div>
          ) : error ? (
            <div className="max-w-xl mx-auto text-center py-20">
              <div className="text-lg font-semibold text-[#1A1A1A] mb-2">Could not load jobs</div>
              <div className="text-sm text-[#5F5E5A]">{error}</div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="text-center py-20 text-[#5F5E5A]">No jobs match your filters.</div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>

        <div className="hidden lg:block border-l border-[#D3D1C7] p-5 bg-white">
          <div className="bg-[#F1EFE8] rounded-xl p-4 mb-3.5">
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

          <div className="bg-[#F1EFE8] rounded-xl p-4 mb-3.5">
            <div className="text-[13px] font-semibold text-[#1A1A1A] mb-3">Get job alerts</div>
            <input
              type="email"
              placeholder="Your email address"
              className="w-full px-3 py-2 border border-[#D3D1C7] rounded-lg text-[13px] text-[#1A1A1A] bg-white mb-2 outline-none focus:border-[#1D9E75]"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <button className="w-full bg-[#1D9E75] text-white py-2 rounded-lg text-[13px] font-semibold hover:bg-[#168a63] transition-colors">
              Notify me
            </button>
          </div>

          <div className="bg-[#F1EFE8] rounded-xl p-4">
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

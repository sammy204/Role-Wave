import { useState, useEffect, useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, ArrowLeft, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import type { Job, Company } from '../types';
import JobCard from '../components/JobCard';

const FETCH_TIMEOUT_MS = 10000;

const chipOptions = ['All', 'Remote', 'Hybrid', 'Full-time', 'Contract'];

const workTypeFilters = [
  { label: 'Remote' },
  { label: 'Hybrid' },
  { label: 'On-site' },
];

const cityFilters = [
  { label: 'Lagos' },
  { label: 'Abuja' },
  { label: 'Port Harcourt' },
  { label: 'Remote only' },
];

export default function JobListings() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const initialCity = searchParams.get('city') || '';
  const initialType = searchParams.get('type') || '';

  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [activeChip, setActiveChip] = useState(initialType || 'All');
  const [selectedWorkTypes, setSelectedWorkTypes] = useState<string[]>([
    'Remote',
    'Hybrid',
    'On-site',
  ]);
  const [selectedCities, setSelectedCities] = useState<string[]>(
    initialCity ? [initialCity] : ['Lagos', 'Abuja', 'Port Harcourt', 'Remote only']
  );
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    async function fetchJobs() {
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
          supabase.from('companies').select('*'),
          FETCH_TIMEOUT_MS,
          'Companies query'
        );
        if (companiesError) throw companiesError;

        const companyById = new Map((companiesData || []).map((company) => [company.id, company]));
        setJobs((jobsData || []).map((job) => ({ ...job, company: companyById.get(job.company_id) })));
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load jobs.');
      } finally {
        setLoading(false);
      }
    }

    fetchJobs();
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

    if (activeChip !== 'All') {
      if (activeChip === 'Remote' || activeChip === 'Hybrid') {
        result = result.filter((j) => j.work_type === activeChip);
      } else {
        result = result.filter((j) => j.job_type === activeChip);
      }
    }

    if (selectedWorkTypes.length > 0) {
      result = result.filter((j) => selectedWorkTypes.includes(j.work_type));
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
  }, [jobs, searchQuery, activeChip, selectedWorkTypes, selectedCities]);

  const getFilterCount = (items: { label: string }[], key: 'work_type' | 'location') => {
    return items.map((item) => {
      const label = item.label;
      if (key === 'work_type') {
        return jobs.filter((j) => j.work_type === label).length;
      }
      if (label === 'Remote only') {
        return jobs.filter((j) => j.work_type === 'Remote').length;
      }
      return jobs.filter((j) => j.location === label).length;
    });
  };

  const workTypeCounts = getFilterCount(workTypeFilters, 'work_type');
  const cityCounts = getFilterCount(cityFilters, 'location');

  const toggleWorkType = (label: string) => {
    setSelectedWorkTypes((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

  const toggleCity = (label: string) => {
    setSelectedCities((prev) =>
      prev.includes(label) ? prev.filter((x) => x !== label) : [...prev, label]
    );
  };

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
      <div className="flex items-center gap-2 px-4 sm:px-10 py-3 border-b border-[#D3D1C7] bg-white">
        <Link
          to="/"
          className="flex items-center gap-1 text-[13px] text-[#5F5E5A] hover:text-[#1A1A1A] transition-colors"
        >
          <ArrowLeft size={14} /> <span className="hidden sm:inline">Home</span>
        </Link>
        <div className="flex-1" />
        <div className="flex items-center bg-[#F1EFE8] rounded-lg px-3 py-2 max-w-sm">
          <Search size={14} className="text-[#B4B2A9] mr-2" />
          <input
            type="text"
            placeholder="Role, skill or company..."
            className="bg-transparent border-none outline-none text-sm text-[#1A1A1A] w-32 sm:w-48"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="flex items-center gap-2 px-4 sm:px-10 py-3 border-b border-[#D3D1C7] bg-white overflow-x-auto">
        {initialQ && (
          <span className="text-sm font-semibold text-[#1A1A1A] whitespace-nowrap hidden sm:inline">
            Results for <span className="text-[#1D9E75]">"{initialQ}"</span>
            {initialCity && ` in ${initialCity}`}
          </span>
        )}
        <div className="flex-1 min-w-0" />
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
        <span className="text-[13px] text-[#B4B2A9] whitespace-nowrap hidden sm:inline">
          {filteredJobs.length} jobs found
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

      <div className="grid grid-cols-1 lg:grid-cols-[260px_1fr] min-h-[500px]">
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
            <div className="text-center py-20 text-[#5F5E5A]">No jobs found matching your criteria.</div>
          ) : (
            <div className="space-y-2 sm:space-y-2.5">
              {filteredJobs.map((job) => (
                <JobCard key={job.id} job={job} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

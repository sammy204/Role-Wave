import { useState, useEffect, useMemo, type Dispatch, type SetStateAction } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import type { Job, Company } from '../types';
import JobCard from '../components/JobCard';
import LoadingSpinner from '../components/LoadingSpinner';

const FETCH_TIMEOUT_MS = 25000;

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

const jobTypeFilters = [
  { value: 'Full-time', label: 'Full-time' },
  { value: 'Part-time', label: 'Part-time' },
  { value: 'Contract', label: 'Contract' },
  { value: 'Internship', label: 'Internship' },
];

const experienceFilters = [
  { value: 'entry', label: 'Entry level' },
  { value: 'junior', label: 'Junior' },
  { value: 'mid', label: 'Mid-level' },
  { value: 'senior', label: 'Senior' },
  { value: 'lead', label: 'Lead / Principal' },
];

const authorizationFilters = [
  { value: 'sponsorship_available', label: 'Visa sponsorship available' },
  { value: 'authorized_only', label: 'Already authorized only' },
  { value: 'anywhere', label: 'Open to applicants anywhere' },
];

const applicationFilters = [
  { value: 'internal', label: 'Apply on RoleWave' },
  { value: 'email', label: 'Apply by email' },
  { value: 'external', label: 'Apply on company site' },
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
  const [selectedJobTypes, setSelectedJobTypes] = useState<string[]>([]);
  const [selectedExperienceLevels, setSelectedExperienceLevels] = useState<string[]>([]);
  const [selectedAuthorizations, setSelectedAuthorizations] = useState<string[]>([]);
  const [selectedApplicationMethods, setSelectedApplicationMethods] = useState<string[]>([]);
  const [salaryFloor, setSalaryFloor] = useState('');
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

    if (selectedJobTypes.length > 0) {
      result = result.filter((j) => selectedJobTypes.includes(j.job_type));
    }

    if (selectedExperienceLevels.length > 0) {
      result = result.filter((j) => j.experience_level && selectedExperienceLevels.includes(j.experience_level));
    }

    if (selectedAuthorizations.length > 0) {
      result = result.filter((j) => j.work_authorization && selectedAuthorizations.includes(j.work_authorization));
    }

    if (selectedApplicationMethods.length > 0) {
      result = result.filter((j) => j.apply_method && selectedApplicationMethods.includes(j.apply_method));
    }

    if (salaryFloor) {
      const minimum = Number(salaryFloor);
      result = result.filter(
        (j) => (!j.salary_currency || j.salary_currency === 'NGN') && (j.salary_max ?? j.salary_min ?? 0) >= minimum
      );
    }

    return result;
  }, [
    jobs,
    searchQuery,
    activeChip,
    selectedWorkTypes,
    selectedCities,
    selectedJobTypes,
    selectedExperienceLevels,
    selectedAuthorizations,
    selectedApplicationMethods,
    salaryFloor,
  ]);

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

  const toggleFilter = (setter: React.Dispatch<React.SetStateAction<string[]>>, value: string) => {
    setter((prev) => (prev.includes(value) ? prev.filter((item) => item !== value) : [...prev, value]));
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

      <div className="mt-7 border-t border-[#E9E7DE] pt-5">
        <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-[#B4B2A9]">Salary minimum</div>
        <select
          value={salaryFloor}
          onChange={(event) => setSalaryFloor(event.target.value)}
          className="w-full rounded-xl border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] outline-none"
        >
          <option value="">Any salary</option>
          <option value="100000">₦100,000+</option>
          <option value="250000">₦250,000+</option>
          <option value="500000">₦500,000+</option>
          <option value="1000000">₦1,000,000+</option>
        </select>
      </div>

      {([
        { title: 'Employment type', items: jobTypeFilters, selected: selectedJobTypes, setter: setSelectedJobTypes },
        { title: 'Experience level', items: experienceFilters, selected: selectedExperienceLevels, setter: setSelectedExperienceLevels },
        { title: 'Work authorization', items: authorizationFilters, selected: selectedAuthorizations, setter: setSelectedAuthorizations },
        { title: 'Application method', items: applicationFilters, selected: selectedApplicationMethods, setter: setSelectedApplicationMethods },
      ] as Array<{
        title: string;
        items: Array<{ value: string; label: string }>;
        selected: string[];
        setter: Dispatch<SetStateAction<string[]>>;
      }>).map((section) => (
        <div key={section.title} className="mt-7 border-t border-[#E9E7DE] pt-5">
          <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.5px] text-[#B4B2A9]">{section.title}</div>
          {section.items.map((item) => {
            const value = item.value;
            return (
              <button
                key={value}
                type="button"
                className="mb-2 flex w-full items-center justify-between text-left"
                onClick={() => toggleFilter(section.setter, value)}
              >
                <span className="flex items-center gap-2 text-[13px] text-[#5F5E5A]">
                  <span className={`flex h-3.5 w-3.5 items-center justify-center rounded text-[9px] ${section.selected.includes(value) ? 'border-[#1D9E75] bg-[#1D9E75] text-white' : 'border-[1.5px] border-[#D3D1C7]'}`}>
                    {section.selected.includes(value) && '✓'}
                  </span>
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );

  return (
    <div className="page-shell">
      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 px-4 py-3 sm:px-6 lg:px-8">
        <div className="text-sm font-semibold text-[#1A1A1A]">All jobs</div>
        <div className="flex-1" />
        <div className="flex items-center rounded-full border border-[#D3D1C7] bg-white px-3 py-2 max-w-sm shadow-[0_6px_18px_rgba(26,26,26,0.03)]">
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

      <div className="mx-auto flex w-full max-w-[1320px] items-center gap-2 overflow-x-auto px-4 py-3 sm:px-6 lg:px-8">
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
            className={`flex-shrink-0 rounded-full px-4 py-[8px] text-[13px] font-semibold whitespace-nowrap transition-all duration-200 ${
              activeChip === chip
                ? 'bg-[#E1F5EE] text-[#085041] border border-[#5DCAA5]'
                : 'bg-white text-[#5F5E5A] border border-[#D3D1C7] hover:border-[#5DCAA5] shadow-[0_6px_18px_rgba(26,26,26,0.03)]'
            }`}
          >
            {chip}
          </button>
        ))}
        <span className="text-[13px] text-[#B4B2A9] whitespace-nowrap hidden sm:inline">
          {filteredJobs.length} jobs found
        </span>
        <button
          className="sm:hidden flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-[6px] text-[13px] text-[#5F5E5A]"
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

      <div className="mx-auto grid min-h-[500px] w-full max-w-[1320px] grid-cols-1 gap-4 px-4 pb-8 sm:px-6 lg:grid-cols-[260px_1fr] lg:px-8">
        <div className="hidden overflow-hidden rounded-[24px] panel-soft lg:block">
          <FilterSection />
        </div>

        <div className="min-w-0">
          {loading ? (
            <div className="panel rounded-[24px] py-20">
              <LoadingSpinner className="mx-auto text-[#1D9E75]" />
            </div>
          ) : error ? (
            <div className="panel mx-auto max-w-xl rounded-[24px] py-20 text-center">
              <div className="text-lg font-semibold text-[#1A1A1A] mb-2">Could not load jobs</div>
              <div className="text-sm text-[#5F5E5A]">{error}</div>
            </div>
          ) : filteredJobs.length === 0 ? (
            <div className="panel rounded-[24px] py-20 text-center text-[#5F5E5A]">No jobs found matching your criteria.</div>
          ) : (
            <div className="space-y-3 sm:space-y-3.5">
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

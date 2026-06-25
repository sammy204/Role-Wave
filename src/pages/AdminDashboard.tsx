import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  LogOut,
  PlayCircle,
  PlusCircle,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company, Job, JobSubmission, Profile } from '../types';

type SubmissionTab = 'pending' | 'reviewed';
type JobTab = 'all' | 'active' | 'filled' | 'closed' | 'archived';
type AdminView = 'submissions' | 'jobs' | 'create';
type JobStatus = 'active' | 'filled' | 'closed' | 'archived';

const FETCH_TIMEOUT_MS = 10000;

const avatarColors: Company['avatar_color'][] = ['teal', 'blue', 'amber', 'purple', 'coral'];
const jobTabs: Array<{ key: JobTab; label: string }> = [
  { key: 'all', label: 'All jobs' },
  { key: 'active', label: 'Active' },
  { key: 'filled', label: 'Filled' },
  { key: 'closed', label: 'Closed' },
  { key: 'archived', label: 'Archived' },
];

function initials(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('')
    .slice(0, 2);
}

function pickColor(value: string): Company['avatar_color'] {
  const hash = value.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return avatarColors[hash % avatarColors.length];
}

function buildJobSlug(title: string, companyName: string) {
  return `${slugify(title)}-${slugify(companyName)}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatRelative(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function statusTone(status: string) {
  switch (status) {
    case 'active':
      return 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]';
    case 'filled':
      return 'bg-[#E6F1FB] text-[#0C447C] border-[#9AC0E8]';
    case 'closed':
      return 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
    case 'archived':
      return 'bg-[#FAEEDA] text-[#633806] border-[#F0D080]';
    default:
      return 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
  }
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

const emptyCreateForm = {
  jobTitle: '',
  companyName: '',
  companyWebsite: '',
  city: 'Lagos',
  workType: 'Remote',
  jobType: 'Full-time',
  salary: '',
  description: '',
  requirements: '',
  whatYoullDo: '',
  tags: '',
  status: 'active' as JobStatus,
  featured: false,
};

export default function AdminDashboard() {
  const navigate = useNavigate();
  const mountedRef = useRef(true);

  const [profile, setProfile] = useState<Profile | null>(null);
  const [submissions, setSubmissions] = useState<JobSubmission[]>([]);
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<AdminView>('submissions');
  const [selectedSubmissionTab, setSelectedSubmissionTab] = useState<SubmissionTab>('pending');
  const [selectedJobTab, setSelectedJobTab] = useState<JobTab>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingJob, setSavingJob] = useState(false);

  useEffect(() => {
    mountedRef.current = true;

    async function loadDashboard() {
      setLoading(true);
      setNotice('');
      setError('');

      try {
        const { data: sessionData, error: sessionError } = await withTimeout(
          supabase.auth.getSession(),
          FETCH_TIMEOUT_MS,
          'Session lookup'
        );
        if (sessionError) throw sessionError;

        const session = sessionData.session;
        if (!session) {
          navigate('/admin/login', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!nextProfile?.is_admin) {
          navigate('/admin/login', { replace: true, state: { reason: 'no-access' } });
          return;
        }

        const [submissionResult, jobResult, companyResult] = await Promise.all([
          withTimeout(
            supabase.from('job_submissions').select('*').order('created_at', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Submissions query'
          ),
          withTimeout(
            supabase.from('jobs').select('*').order('created_at', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Jobs query'
          ),
          withTimeout(
            supabase.from('companies').select('*').order('job_count', { ascending: false }),
            FETCH_TIMEOUT_MS,
            'Companies query'
          ),
        ]);

        if (!mountedRef.current) return;

        const submissionError = submissionResult.error as { message?: string } | null;
        const jobError = jobResult.error as { message?: string } | null;
        const companyError = companyResult.error as { message?: string } | null;

        if (submissionError) throw new Error(submissionError.message || 'Failed to load submissions.');
        if (jobError) throw new Error(jobError.message || 'Failed to load jobs.');
        if (companyError) throw new Error(companyError.message || 'Failed to load companies.');

        const loadedCompanies = (companyResult.data || []) as Company[];
        const companyMap = new Map(loadedCompanies.map((company) => [company.id, company]));
        const loadedJobs = ((jobResult.data || []) as Job[]).map((job) => ({
          ...job,
          company: companyMap.get(job.company_id),
        }));

        setProfile(nextProfile);
        setSubmissions((submissionResult.data || []) as JobSubmission[]);
        setJobs(loadedJobs);
        setCompanies(loadedCompanies);
      } catch (loadError) {
        if (!mountedRef.current) return;
        setError(loadError instanceof Error ? loadError.message : 'Failed to load admin dashboard.');
      } finally {
        if (mountedRef.current) {
          setLoading(false);
        }
      }
    }

    loadDashboard();

    return () => {
      mountedRef.current = false;
    };
  }, [navigate]);

  const companyMap = useMemo(() => new Map(companies.map((company) => [company.id, company])), [companies]);

  const counts = useMemo(
    () => ({
      pendingSubmissions: submissions.filter((item) => item.status === 'pending').length,
      reviewedSubmissions: submissions.filter((item) => item.status !== 'pending').length,
      activeJobs: jobs.filter((item) => item.status === 'active').length,
      filledJobs: jobs.filter((item) => item.status === 'filled').length,
      closedJobs: jobs.filter((item) => item.status === 'closed').length,
      archivedJobs: jobs.filter((item) => item.status === 'archived').length,
      companies: companies.length,
    }),
    [submissions, jobs, companies]
  );

  const filteredSubmissions = useMemo(() => {
    let result =
      selectedSubmissionTab === 'pending'
        ? submissions.filter((item) => item.status === 'pending')
        : submissions.filter((item) => item.status !== 'pending');

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.job_title.toLowerCase().includes(q) ||
          item.company_name.toLowerCase().includes(q) ||
          item.city.toLowerCase().includes(q)
      );
    }

    return result;
  }, [searchQuery, selectedSubmissionTab, submissions]);

  const filteredJobs = useMemo(() => {
    let result =
      selectedJobTab === 'all' ? jobs : jobs.filter((item) => item.status === selectedJobTab);

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.title.toLowerCase().includes(q) ||
          item.company?.name.toLowerCase().includes(q) ||
          item.location.toLowerCase().includes(q)
      );
    }

    return result;
  }, [searchQuery, selectedJobTab, jobs]);

  const selectedSubmissionSummary = useMemo(
    () => ({
      pending: submissions.filter((item) => item.status === 'pending').length,
      reviewed: submissions.filter((item) => item.status !== 'pending').length,
    }),
    [submissions]
  );

  const updateCompanyCount = (companyId: string, delta: number) => {
    setCompanies((prev) =>
      prev.map((company) =>
        company.id === companyId ? { ...company, job_count: Math.max(0, company.job_count + delta) } : company
      )
    );
  };

  const upsertJobInState = (job: Job & { company?: Company }) => {
    setJobs((prev) => {
      const existingIndex = prev.findIndex((item) => item.id === job.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = job;
        return next;
      }
      return [job, ...prev];
    });
  };

  const removeJobFromState = (jobId: string) => {
    setJobs((prev) => prev.filter((item) => item.id !== jobId));
  };

  const setSubmissionStatusInState = (submissionId: string, status: JobSubmission['status']) => {
    setSubmissions((prev) =>
      prev.map((item) => (item.id === submissionId ? { ...item, status } : item))
    );
  };

  const ensureCompany = async (companyName: string, website?: string) => {
    const companySlug = slugify(companyName);
    const existingCompany = companies.find((company) => company.slug === companySlug);

    if (existingCompany) {
      if (website && !existingCompany.website) {
        const { error } = await supabase.from('companies').update({ website }).eq('id', existingCompany.id);
        if (error) throw error;
      }
      return existingCompany;
    }

    const { data, error } = await supabase
      .from('companies')
      .insert({
        name: companyName,
        slug: companySlug,
        logo_initials: initials(companyName) || 'CO',
        avatar_color: pickColor(companyName),
        location: null,
        website: website || null,
        description: null,
        verified: true,
        job_count: 0,
      })
      .select('*')
      .single();

    if (error || !data) throw error || new Error('Could not create company.');

    const createdCompany = data as Company;
    setCompanies((prev) => [createdCompany, ...prev]);
    return createdCompany;
  };

  const createJob = async () => {
    setSavingJob(true);
    setNotice('');
    setError('');

    try {
      if (!createForm.jobTitle || !createForm.companyName || !createForm.description || !createForm.requirements) {
        throw new Error('Please fill in the required job fields.');
      }

      const company = await ensureCompany(createForm.companyName, createForm.companyWebsite);
      const jobSlug = buildJobSlug(createForm.jobTitle, createForm.companyName);
      const tags = createForm.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const { data, error } = await supabase
        .from('jobs')
        .insert({
          title: createForm.jobTitle,
          slug: jobSlug,
          company_id: company.id,
          description: createForm.description,
          requirements: createForm.requirements,
          what_youll_do: createForm.whatYoullDo || null,
          location: createForm.city,
          work_type: createForm.workType,
          job_type: createForm.jobType,
          salary: createForm.salary || null,
          tags,
          featured: createForm.featured,
          status: createForm.status,
        })
        .select('*')
        .single();

      if (error || !data) throw error || new Error('Could not create job.');

      const createdJob = { ...(data as Job), company };
      upsertJobInState(createdJob);
      if (createForm.status === 'active') {
        updateCompanyCount(company.id, 1);
      }

      setCreateForm(emptyCreateForm);
      setSelectedView('jobs');
      setNotice(`Created "${createForm.jobTitle}" for ${createForm.companyName}.`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Failed to create job.');
    } finally {
      setSavingJob(false);
    }
  };

  const handleApproveSubmission = async (submissionId: string) => {
    setProcessingId(submissionId);
    setNotice('');
    setError('');

    const submission = submissions.find((item) => item.id === submissionId);
    if (!submission) {
      setProcessingId(null);
      return;
    }

    try {
      const company = await ensureCompany(submission.company_name);
      const jobSlug = buildJobSlug(submission.job_title, submission.company_name);

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert({
          title: submission.job_title,
          slug: jobSlug,
          company_id: company.id,
          description: submission.description,
          requirements: submission.requirements,
          what_youll_do: null,
          location: submission.city,
          work_type: submission.work_type,
          job_type: submission.job_type,
          salary: submission.salary || null,
          tags: [],
          featured: false,
          status: 'active',
        })
        .select('*')
        .single();

      if (jobError || !jobData) throw jobError || new Error('Could not publish job.');

      upsertJobInState({ ...(jobData as Job), company });
      updateCompanyCount(company.id, 1);
      setSubmissionStatusInState(submissionId, 'approved');
      setNotice(`Published "${submission.job_title}" to live jobs.`);
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : 'Failed to approve submission.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectSubmission = async (submissionId: string) => {
    setProcessingId(submissionId);
    setNotice('');
    setError('');

    try {
      const { error } = await supabase.from('job_submissions').update({ status: 'rejected' }).eq('id', submissionId);
      if (error) throw error;
      setSubmissionStatusInState(submissionId, 'rejected');
      setNotice('Submission rejected.');
    } catch (rejectError) {
      setError(rejectError instanceof Error ? rejectError.message : 'Failed to reject submission.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleJobStatus = async (jobId: string, nextStatus: JobStatus) => {
    setProcessingId(jobId);
    setNotice('');
    setError('');

    const target = jobs.find((item) => item.id === jobId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    try {
      const { data, error } = await supabase.rpc('admin_update_job_status', {
        p_job_id: jobId,
        p_status: nextStatus,
      });
      if (error) throw error;

      const updatedJob = data as Job | null;
      const prevStatus = target.status as JobStatus;
      const companyId = target.company_id;

      upsertJobInState({ ...(updatedJob || target), company: target.company });

      if (prevStatus === 'active' && nextStatus !== 'active') {
        updateCompanyCount(companyId, -1);
      } else if (prevStatus !== 'active' && nextStatus === 'active') {
        updateCompanyCount(companyId, 1);
      }

      setNotice(`Marked "${target.title}" as ${formatStatus(nextStatus).toLowerCase()}.`);
    } catch (statusError) {
      setError(statusError instanceof Error ? statusError.message : 'Failed to update job status.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleDeleteJob = async (jobId: string) => {
    setProcessingId(jobId);
    setNotice('');
    setError('');

    const target = jobs.find((item) => item.id === jobId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    const shouldDelete = window.confirm(`Delete "${target.title}"? This cannot be undone.`);
    if (!shouldDelete) {
      setProcessingId(null);
      return;
    }

    try {
      const { error } = await supabase.rpc('admin_delete_job', { p_job_id: jobId });
      if (error) throw error;

      if (target.status === 'active') {
        updateCompanyCount(target.company_id, -1);
      }
      removeJobFromState(jobId);
      setNotice(`Deleted "${target.title}".`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Failed to delete job.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/admin/login', { replace: true });
  };

  const updateCreateField = (field: keyof typeof createForm, value: string | boolean) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <div className="text-[#5F5E5A]">Loading admin dashboard...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F1EFE8]">
      <div className="max-w-[1320px] mx-auto px-4 sm:px-6 lg:px-8 py-5 sm:py-7">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between mb-6">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#E1F5EE] text-[#085041] text-xs font-semibold mb-3">
              <BadgeCheck size={12} /> Admin dashboard
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold text-[#1A1A1A] tracking-[-0.02em]">
              Manage jobs, submissions, and live listings.
            </h1>
            <p className="text-sm sm:text-base text-[#5F5E5A] mt-2 max-w-xl leading-relaxed">
              Signed in as {profile?.full_name || 'Admin'}. Review submissions, post jobs directly,
              and keep the board tidy without leaving this screen.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedView('create')}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold hover:bg-[#168a63] transition-colors"
            >
              <PlusCircle size={14} /> Create job
            </button>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm text-[#1A1A1A]"
            >
              Public site
            </Link>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1A1A1A] text-white text-sm font-semibold"
            >
              <LogOut size={14} /> Sign out
            </button>
          </div>
        </div>

        {(notice || error) && (
          <div
            className={`mb-5 rounded-xl border px-4 py-3 text-sm ${
              error
                ? 'border-[#F0D080] bg-[#FFF8E6] text-[#7A5000]'
                : 'border-[#D3D1C7] bg-white text-[#5F5E5A]'
            }`}
          >
            {error || notice}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-7 mb-6">
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Clock3 size={12} /> Pending
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.pendingSubmissions}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Briefcase size={12} /> Active jobs
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.activeJobs}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <CheckCircle2 size={12} /> Filled
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.filledJobs}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <XCircle size={12} /> Closed
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.closedJobs}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <Building2 size={12} /> Companies
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.companies}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <BadgeCheck size={12} /> Reviewed
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{selectedSubmissionSummary.reviewed}</div>
          </div>
          <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
            <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px] mb-2">
              <ArchiveStatsIcon /> Archived
            </div>
            <div className="text-2xl font-bold text-[#1A1A1A]">{counts.archivedJobs}</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-5">
          {(['submissions', 'jobs', 'create'] as AdminView[]).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                selectedView === view
                  ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                  : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
              }`}
            >
              {view === 'submissions' ? 'Submissions' : view === 'jobs' ? 'Jobs' : 'Create job'}
            </button>
          ))}
          <div className="flex-1 min-w-[120px]" />
          <div className="relative w-full sm:w-[320px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B2A9]" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search jobs or submissions"
              className="w-full rounded-full border border-[#D3D1C7] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-[#1D9E75]"
            />
          </div>
        </div>

        {selectedView === 'submissions' && (
          <div className="space-y-5">
            <div className="flex items-center gap-2">
              {(['pending', 'reviewed'] as SubmissionTab[]).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setSelectedSubmissionTab(tab)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    selectedSubmissionTab === tab
                      ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
                      : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
                  }`}
                >
                  {tab === 'pending' ? `Pending (${counts.pendingSubmissions})` : `Reviewed (${selectedSubmissionSummary.reviewed})`}
                </button>
              ))}
            </div>

            {filteredSubmissions.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No {selectedSubmissionTab} submissions right now.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredSubmissions.map((submission) => (
                  <div
                    key={submission.id}
                    className="rounded-2xl border border-[#D3D1C7] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                  >
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start gap-3">
                          <div className="w-11 h-11 rounded-xl bg-[#E1F5EE] text-[#085041] flex items-center justify-center font-bold text-sm flex-shrink-0">
                            {initials(submission.company_name) || 'CO'}
                          </div>
                          <div className="min-w-0">
                            <h2 className="text-lg font-semibold text-[#1A1A1A]">{submission.job_title}</h2>
                            <p className="text-sm text-[#5F5E5A] flex items-center gap-1">
                              <Building2 size={13} /> {submission.company_name} - {submission.city}
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 mt-3">
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#E1F5EE] text-[#085041]">
                            {submission.work_type}
                          </span>
                          <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#F1EFE8] text-[#5F5E5A]">
                            {submission.job_type}
                          </span>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusTone(submission.status)}`}>
                            {formatStatus(submission.status)}
                          </span>
                        </div>

                        <p className="text-sm text-[#5F5E5A] leading-relaxed mt-3 max-w-3xl">
                          {submission.description}
                        </p>
                      </div>

                      <div className="flex flex-row gap-2 lg:flex-col lg:min-w-[180px]">
                        {submission.status === 'pending' ? (
                          <>
                            <button
                              onClick={() => handleApproveSubmission(submission.id)}
                              disabled={processingId === submission.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-60"
                            >
                              <CheckCircle2 size={14} /> Approve
                            </button>
                            <button
                              onClick={() => handleRejectSubmission(submission.id)}
                              disabled={processingId === submission.id}
                              className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
                            >
                              <XCircle size={14} /> Reject
                            </button>
                          </>
                        ) : (
                          <div className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-[#F1EFE8] text-sm font-semibold text-[#5F5E5A]">
                            Reviewed
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {selectedView === 'jobs' && (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {jobTabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setSelectedJobTab(tab.key)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                    selectedJobTab === tab.key
                      ? 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]'
                      : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {filteredJobs.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No jobs in this section yet.
              </div>
            ) : (
              <div className="grid gap-4">
                {filteredJobs.map((job) => {
                  const company = companyMap.get(job.company_id) || job.company;
                  const isActive = job.status === 'active';

                  return (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-[#D3D1C7] bg-white p-5 shadow-[0_2px_10px_rgba(0,0,0,0.03)]"
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-3">
                            <div className="w-11 h-11 rounded-xl bg-[#F1EFE8] text-[#1A1A1A] flex items-center justify-center font-bold text-sm flex-shrink-0">
                              {company?.logo_initials || 'CO'}
                            </div>
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h2 className="text-lg font-semibold text-[#1A1A1A]">{job.title}</h2>
                                <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${statusTone(job.status)}`}>
                                  {formatStatus(job.status)}
                                </span>
                                {job.featured && (
                                  <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-[#FFF8E6] text-[#7A5000] border border-[#F0D080]">
                                    Featured
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-[#5F5E5A] flex items-center gap-1 mt-1">
                                <Building2 size={13} /> {company?.name || 'Unknown company'} - {job.location}
                              </p>
                              <p className="text-xs text-[#8A867E] mt-1">
                                {job.work_type} - {job.job_type} - Posted {formatRelative(job.created_at)}
                              </p>
                            </div>
                          </div>

                          <p className="text-sm text-[#5F5E5A] leading-relaxed mt-3 max-w-3xl line-clamp-3">
                            {job.description}
                          </p>
                        </div>

                        <div className="flex flex-row flex-wrap gap-2 lg:flex-col lg:min-w-[220px]">
                          {isActive ? (
                            <>
                              <button
                                onClick={() => handleJobStatus(job.id, 'filled')}
                                disabled={processingId === job.id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#E6F1FB] text-[#0C447C] text-sm font-semibold disabled:opacity-60"
                              >
                                <CheckCircle2 size={14} /> Mark filled
                              </button>
                              <button
                                onClick={() => handleJobStatus(job.id, 'closed')}
                                disabled={processingId === job.id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
                              >
                                <CircleSlash2 size={14} /> Close
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                onClick={() => handleJobStatus(job.id, 'active')}
                                disabled={processingId === job.id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D9E75] text-white text-sm font-semibold disabled:opacity-60"
                              >
                                <PlayCircle size={14} /> Reactivate
                              </button>
                              <button
                                onClick={() => handleJobStatus(job.id, 'archived')}
                                disabled={processingId === job.id}
                                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#D3D1C7] bg-white text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
                              >
                                <ArchiveIcon /> Archive
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => handleDeleteJob(job.id)}
                            disabled={processingId === job.id}
                            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-[#F0D080] bg-[#FFF8E6] text-[#7A5000] text-sm font-semibold disabled:opacity-60"
                          >
                            <Trash2 size={14} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {selectedView === 'create' && (
          <div className="grid gap-6 xl:grid-cols-[1fr_320px]">
            <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5 sm:p-6 shadow-[0_2px_10px_rgba(0,0,0,0.03)]">
              <div className="flex items-start justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-xl font-bold text-[#1A1A1A]">Create a job</h2>
                  <p className="text-sm text-[#5F5E5A] mt-1">
                    Post directly to the board without waiting for a submission.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Job title" required>
                  <input
                    value={createForm.jobTitle}
                    onChange={(e) => updateCreateField('jobTitle', e.target.value)}
                    className="admin-input"
                    placeholder="Product Designer"
                  />
                </Field>
                <Field label="Company name" required>
                  <input
                    value={createForm.companyName}
                    onChange={(e) => updateCreateField('companyName', e.target.value)}
                    className="admin-input"
                    placeholder="Paystack"
                  />
                </Field>
                <Field label="Company website">
                  <input
                    value={createForm.companyWebsite}
                    onChange={(e) => updateCreateField('companyWebsite', e.target.value)}
                    className="admin-input"
                    placeholder="https://company.com"
                  />
                </Field>
                <Field label="City">
                  <select
                    value={createForm.city}
                    onChange={(e) => updateCreateField('city', e.target.value)}
                    className="admin-input"
                  >
                    <option>Lagos</option>
                    <option>Abuja</option>
                    <option>Port Harcourt</option>
                    <option>Remote</option>
                  </select>
                </Field>
                <Field label="Work type">
                  <select
                    value={createForm.workType}
                    onChange={(e) => updateCreateField('workType', e.target.value)}
                    className="admin-input"
                  >
                    <option>Remote</option>
                    <option>Hybrid</option>
                    <option>On-site</option>
                  </select>
                </Field>
                <Field label="Job type">
                  <select
                    value={createForm.jobType}
                    onChange={(e) => updateCreateField('jobType', e.target.value)}
                    className="admin-input"
                  >
                    <option>Full-time</option>
                    <option>Part-time</option>
                    <option>Contract</option>
                    <option>Internship</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select
                    value={createForm.status}
                    onChange={(e) => updateCreateField('status', e.target.value as JobStatus)}
                    className="admin-input"
                  >
                    <option value="active">Active</option>
                    <option value="filled">Filled</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
                <Field label="Salary">
                  <input
                    value={createForm.salary}
                    onChange={(e) => updateCreateField('salary', e.target.value)}
                    className="admin-input"
                    placeholder="₦400,000 - ₦600,000/month"
                  />
                </Field>
                <div className="sm:col-span-2">
                  <Field label="Description" required>
                    <textarea
                      value={createForm.description}
                      onChange={(e) => updateCreateField('description', e.target.value)}
                      className="admin-input min-h-[140px] resize-y"
                      placeholder="What is the role about?"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Requirements" required>
                    <textarea
                      value={createForm.requirements}
                      onChange={(e) => updateCreateField('requirements', e.target.value)}
                      className="admin-input min-h-[140px] resize-y"
                      placeholder="List the key requirements"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="What they’ll do">
                    <textarea
                      value={createForm.whatYoullDo}
                      onChange={(e) => updateCreateField('whatYoullDo', e.target.value)}
                      className="admin-input min-h-[120px] resize-y"
                      placeholder="Optional responsibilities"
                    />
                  </Field>
                </div>
                <div className="sm:col-span-2">
                  <Field label="Tags">
                    <input
                      value={createForm.tags}
                      onChange={(e) => updateCreateField('tags', e.target.value)}
                      className="admin-input"
                      placeholder="React, TypeScript, Remote"
                    />
                  </Field>
                </div>
              </div>

              <label className="mt-4 flex items-center gap-2 text-sm text-[#5F5E5A]">
                <input
                  type="checkbox"
                  checked={createForm.featured}
                  onChange={(e) => updateCreateField('featured', e.target.checked)}
                />
                Feature this job
              </label>

              <button
                type="button"
                onClick={createJob}
                disabled={savingJob}
                className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white hover:bg-[#168a63] transition-colors disabled:opacity-60"
              >
                <PlusCircle size={14} />
                {savingJob ? 'Creating...' : 'Create job'}
              </button>
            </div>

            <div className="space-y-4">
              <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-2">Quick rules</h3>
                <p className="text-sm text-[#5F5E5A] leading-relaxed">
                  Active jobs show on the public site. Filled, closed, and archived jobs stay in the
                  dashboard for history and can be reactivated later.
                </p>
              </div>
              <div className="rounded-3xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-3">Job lifecycle</h3>
                <div className="space-y-3 text-sm text-[#5F5E5A]">
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#1D9E75]" />
                    Active jobs are visible to candidates.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#0C447C]" />
                    Filled jobs stay in records, but leave the public board.
                  </div>
                  <div className="flex items-start gap-2">
                    <span className="mt-1 inline-block w-2.5 h-2.5 rounded-full bg-[#7A5000]" />
                    Closed and archived jobs remain manageable from this screen.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: import('react').ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label} {required ? '*' : ''}
      </span>
      {children}
    </label>
  );
}

function ArchiveIcon() {
  return <span className="text-[14px] leading-none">⭳</span>;
}

function ArchiveStatsIcon() {
  return <span className="text-[12px] leading-none">⟲</span>;
}

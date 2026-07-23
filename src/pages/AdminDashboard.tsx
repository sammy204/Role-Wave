import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  CircleSlash2,
  Clock3,
  ExternalLink,
  Inbox,
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
import LoadingSpinner from '../components/LoadingSpinner';

type SubmissionTab = 'pending' | 'reviewed';
type JobTab = 'all' | 'active' | 'filled' | 'closed' | 'archived';
type AdminView = 'overview' | 'submissions' | 'jobs' | 'companies' | 'create';
type JobStatus = 'active' | 'filled' | 'closed' | 'archived';
type JobSortKey = 'created_at' | 'title' | 'company' | 'status';
type SortDir = 'asc' | 'desc';

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

function getWelcomeName(profile: Profile | null, email: string) {
  const rawName = profile?.full_name?.trim();
  const source = rawName || email.split('@')[0] || '';
  const firstPart = source
    .replace(/[._-]+/g, ' ')
    .trim()
    .split(/\s+/)[0];

  if (!firstPart) {
    return 'Admin';
  }

  return firstPart.charAt(0).toUpperCase() + firstPart.slice(1).toLowerCase();
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
  const [authEmail, setAuthEmail] = useState('');
  const [submissions, setSubmissions] = useState<JobSubmission[]>([]);
  const [jobs, setJobs] = useState<(Job & { company?: Company })[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedView, setSelectedView] = useState<AdminView>('overview');
  const [selectedSubmissionTab, setSelectedSubmissionTab] = useState<SubmissionTab>('pending');
  const [selectedJobTab, setSelectedJobTab] = useState<JobTab>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [createForm, setCreateForm] = useState(emptyCreateForm);
  const [savingJob, setSavingJob] = useState(false);
  const [jobSort, setJobSort] = useState<{ key: JobSortKey; dir: SortDir }>({ key: 'created_at', dir: 'desc' });
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);

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

        setAuthEmail(session.user.email || '');

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

    const dir = jobSort.dir === 'asc' ? 1 : -1;
    const sorted = [...result].sort((a, b) => {
      switch (jobSort.key) {
        case 'title':
          return a.title.localeCompare(b.title) * dir;
        case 'company':
          return (a.company?.name || '').localeCompare(b.company?.name || '') * dir;
        case 'status':
          return a.status.localeCompare(b.status) * dir;
        case 'created_at':
        default:
          return (new Date(a.created_at).getTime() - new Date(b.created_at).getTime()) * dir;
      }
    });

    return sorted;
  }, [searchQuery, selectedJobTab, jobs, jobSort]);

  const filteredCompanies = useMemo(() => {
    if (!searchQuery.trim()) return companies;
    const q = searchQuery.toLowerCase();
    return companies.filter((item) => item.name.toLowerCase().includes(q));
  }, [searchQuery, companies]);

  const selectedSubmissionSummary = useMemo(
    () => ({
      pending: submissions.filter((item) => item.status === 'pending').length,
      reviewed: submissions.filter((item) => item.status !== 'pending').length,
    }),
    [submissions]
  );

  const overviewData = useMemo(() => {
    const now = Date.now();
    const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
    const weekIndex = (iso: string) => Math.floor((now - new Date(iso).getTime()) / WEEK_MS);

    const inWeek = (iso: string, index: number) => weekIndex(iso) === index;
    const countInWeek = <T,>(items: T[], getDate: (item: T) => string, index: number) =>
      items.filter((item) => inWeek(getDate(item), index)).length;

    const WEEKS = 8;
    const weeklyJobs = Array.from({ length: WEEKS }, (_, i) => {
      const index = WEEKS - 1 - i;
      return { index, count: countInWeek(jobs, (j) => j.created_at, index) };
    });
    const maxWeeklyJobs = Math.max(1, ...weeklyJobs.map((w) => w.count));

    const jobsThisWeek = countInWeek(jobs, (j) => j.created_at, 0);
    const jobsLastWeek = countInWeek(jobs, (j) => j.created_at, 1);
    const submissionsThisWeek = countInWeek(submissions, (s) => s.created_at, 0);
    const submissionsLastWeek = countInWeek(submissions, (s) => s.created_at, 1);
    const companiesThisWeek = countInWeek(companies, (c) => c.created_at, 0);
    const companiesLastWeek = countInWeek(companies, (c) => c.created_at, 1);

    const delta = (current: number, previous: number) => {
      if (previous === 0) return current > 0 ? 100 : 0;
      return Math.round(((current - previous) / previous) * 100);
    };

    const funnel = [
      { label: 'Pending', count: submissions.filter((s) => s.status === 'pending').length, tone: 'bg-[#D9A441]' },
      { label: 'Approved', count: submissions.filter((s) => s.status === 'approved').length, tone: 'bg-accent' },
      { label: 'Rejected', count: submissions.filter((s) => s.status === 'rejected').length, tone: 'bg-[#C4634A]' },
    ];
    const maxFunnel = Math.max(1, ...funnel.map((f) => f.count));

    type ActivityItem = { id: string; label: string; sub: string; created_at: string; kind: 'job' | 'submission' | 'company' };
    const activity: ActivityItem[] = [
      ...jobs.map((j) => ({
        id: `job-${j.id}`,
        label: j.title,
        sub: `Job posted - ${companyMap.get(j.company_id)?.name || 'Unknown company'}`,
        created_at: j.created_at,
        kind: 'job' as const,
      })),
      ...submissions.map((s) => ({
        id: `sub-${s.id}`,
        label: s.job_title,
        sub: `Submission from ${s.company_name}`,
        created_at: s.created_at,
        kind: 'submission' as const,
      })),
      ...companies.map((c) => ({
        id: `co-${c.id}`,
        label: c.name,
        sub: 'Company added',
        created_at: c.created_at,
        kind: 'company' as const,
      })),
    ]
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    return {
      weeklyJobs,
      maxWeeklyJobs,
      jobsThisWeek,
      jobsDelta: delta(jobsThisWeek, jobsLastWeek),
      submissionsThisWeek,
      submissionsDelta: delta(submissionsThisWeek, submissionsLastWeek),
      companiesThisWeek,
      companiesDelta: delta(companiesThisWeek, companiesLastWeek),
      funnel,
      maxFunnel,
      activity,
    };
  }, [jobs, submissions, companies, companyMap]);

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

  const handleToggleVerified = async (companyId: string, nextVerified: boolean) => {
    setProcessingId(companyId);
    setNotice('');
    setError('');

    const target = companies.find((item) => item.id === companyId);
    if (!target) {
      setProcessingId(null);
      return;
    }

    try {
      const { error } = await supabase.from('companies').update({ verified: nextVerified }).eq('id', companyId);
      if (error) throw error;

      setCompanies((prev) =>
        prev.map((item) => (item.id === companyId ? { ...item, verified: nextVerified } : item))
      );
      setNotice(`${target.name} is now ${nextVerified ? 'verified' : 'unverified'}.`);
    } catch (verifyError) {
      setError(verifyError instanceof Error ? verifyError.message : 'Failed to update verification status.');
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
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigate('/admin/login', { replace: true });
  };

  const toggleJobSort = (key: JobSortKey) => {
    setJobSort((prev) =>
      prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }
    );
  };

  const toggleJobSelected = (jobId: string) => {
    setSelectedJobIds((prev) => {
      const next = new Set(prev);
      if (next.has(jobId)) next.delete(jobId);
      else next.add(jobId);
      return next;
    });
  };

  const toggleAllJobsSelected = () => {
    setSelectedJobIds((prev) =>
      prev.size === filteredJobs.length ? new Set() : new Set(filteredJobs.map((j) => j.id))
    );
  };

  const bulkUpdateJobStatus = async (nextStatus: JobStatus) => {
    if (selectedJobIds.size === 0) return;
    setBulkProcessing(true);
    setNotice('');
    setError('');

    const ids = Array.from(selectedJobIds);
    let succeeded = 0;

    for (const jobId of ids) {
      const target = jobs.find((item) => item.id === jobId);
      if (!target) continue;
      try {
        const { data, error: rpcError } = await supabase.rpc('admin_update_job_status', {
          p_job_id: jobId,
          p_status: nextStatus,
        });
        if (rpcError) throw rpcError;

        const updatedJob = data as Job | null;
        const prevStatus = target.status as JobStatus;
        upsertJobInState({ ...(updatedJob || target), company: target.company });

        if (prevStatus === 'active' && nextStatus !== 'active') {
          updateCompanyCount(target.company_id, -1);
        } else if (prevStatus !== 'active' && nextStatus === 'active') {
          updateCompanyCount(target.company_id, 1);
        }
        succeeded += 1;
      } catch (bulkError) {
        setError(bulkError instanceof Error ? bulkError.message : 'Some jobs could not be updated.');
      }
    }

    setSelectedJobIds(new Set());
    setBulkProcessing(false);
    if (succeeded > 0) {
      setNotice(`Marked ${succeeded} job${succeeded === 1 ? '' : 's'} as ${formatStatus(nextStatus).toLowerCase()}.`);
    }
  };

  const updateCreateField = (field: keyof typeof createForm, value: string | boolean) => {
    setCreateForm((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <LoadingSpinner className="text-[#1D9E75]" />
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
              Welcome, {getWelcomeName(profile, authEmail)}.
            </h1>
            <p className="text-sm sm:text-base text-[#5F5E5A] mt-2 max-w-xl leading-relaxed">
              Review submissions, publish jobs, and keep the board running smoothly.
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
          {(['overview', 'submissions', 'jobs', 'companies', 'create'] as AdminView[]).map((view) => (
            <button
              key={view}
              onClick={() => setSelectedView(view)}
              className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                selectedView === view
                  ? 'bg-[#1D9E75] text-white border-[#1D9E75]'
                  : 'bg-white text-[#5F5E5A] border-[#D3D1C7]'
              }`}
            >
              {view === 'overview'
                ? 'Overview'
                : view === 'submissions'
                ? 'Submissions'
                : view === 'jobs'
                ? 'Jobs'
                : view === 'companies'
                ? 'Companies'
                : 'Create job'}
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

        {selectedView === 'overview' && (
          <div className="space-y-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <TrendCard label="Jobs posted this week" value={overviewData.jobsThisWeek} delta={overviewData.jobsDelta} icon={Briefcase} />
              <TrendCard
                label="Submissions this week"
                value={overviewData.submissionsThisWeek}
                delta={overviewData.submissionsDelta}
                icon={Inbox}
              />
              <TrendCard
                label="Companies added this week"
                value={overviewData.companiesThisWeek}
                delta={overviewData.companiesDelta}
                icon={Building2}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Jobs posted, last 8 weeks</h3>
                  <div className="flex items-end gap-2 h-32">
                    {overviewData.weeklyJobs.map((week) => (
                      <div key={week.index} className="flex-1 flex flex-col items-center gap-1.5">
                        <div className="w-full flex items-end justify-center h-24">
                          <div
                            className="w-full max-w-[28px] rounded-t-md bg-[#1D9E75] transition-all"
                            style={{
                              height: `${Math.max(4, (week.count / overviewData.maxWeeklyJobs) * 100)}%`,
                            }}
                            title={`${week.count} job${week.count === 1 ? '' : 's'}`}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-[#8A867E] tabular-nums">{week.count}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex justify-between text-[10px] uppercase tracking-[0.5px] text-[#B4B2A9]">
                    <span>8 weeks ago</span>
                    <span>This week</span>
                  </div>
                </div>

                <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                  <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Recent activity</h3>
                  <div className="space-y-3">
                    {overviewData.activity.map((item) => (
                      <div key={item.id} className="flex items-start gap-3">
                        <div
                          className={`mt-1 h-2 w-2 rounded-full flex-shrink-0 ${
                            item.kind === 'job' ? 'bg-[#1D9E75]' : item.kind === 'submission' ? 'bg-[#D9A441]' : 'bg-[#0C447C]'
                          }`}
                        />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-[#1A1A1A] truncate">{item.label}</div>
                          <div className="text-xs text-[#8A867E]">
                            {item.sub} - {formatRelative(item.created_at)}
                          </div>
                        </div>
                      </div>
                    ))}
                    {overviewData.activity.length === 0 && (
                      <div className="text-sm text-[#8A867E]">No activity yet.</div>
                    )}
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-5">
                <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Submission funnel</h3>
                <div className="space-y-3">
                  {overviewData.funnel.map((stage) => (
                    <div key={stage.label}>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="font-medium text-[#5F5E5A]">{stage.label}</span>
                        <span className="font-semibold text-[#1A1A1A] tabular-nums">{stage.count}</span>
                      </div>
                      <div className="h-2 rounded-full bg-[#F1EFE8] overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${stage.tone}`}
                          style={{ width: `${Math.max(4, (stage.count / overviewData.maxFunnel) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

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
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
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
              <span className="text-xs text-[#8A867E] tabular-nums">
                {filteredJobs.length} job{filteredJobs.length === 1 ? '' : 's'}
              </span>
            </div>

            {selectedJobIds.size > 0 && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-2.5">
                <span className="text-sm font-semibold text-[#085041]">
                  {selectedJobIds.size} selected
                </span>
                <div className="flex-1" />
                <button
                  onClick={() => bulkUpdateJobStatus('active')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#085041] hover:underline disabled:opacity-60"
                >
                  Reactivate
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('filled')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#0C447C] hover:underline disabled:opacity-60"
                >
                  Mark filled
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('closed')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#5F5E5A] hover:underline disabled:opacity-60"
                >
                  Close
                </button>
                <button
                  onClick={() => bulkUpdateJobStatus('archived')}
                  disabled={bulkProcessing}
                  className="text-xs font-semibold text-[#7A5000] hover:underline disabled:opacity-60"
                >
                  Archive
                </button>
                <button
                  onClick={() => setSelectedJobIds(new Set())}
                  className="text-xs font-semibold text-[#8A867E] hover:underline"
                >
                  Clear
                </button>
              </div>
            )}

            {filteredJobs.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No jobs in this section yet.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D3D1C7] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D3D1C7] bg-[#FBFAF7]">
                      <th className="w-10 px-3 py-2.5">
                        <input
                          type="checkbox"
                          checked={selectedJobIds.size > 0 && selectedJobIds.size === filteredJobs.length}
                          onChange={toggleAllJobsSelected}
                        />
                      </th>
                      <SortHeader label="Job" sortKey="title" current={jobSort} onSort={toggleJobSort} />
                      <SortHeader label="Company" sortKey="company" current={jobSort} onSort={toggleJobSort} />
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Location
                      </th>
                      <SortHeader label="Status" sortKey="status" current={jobSort} onSort={toggleJobSort} />
                      <SortHeader label="Posted" sortKey="created_at" current={jobSort} onSort={toggleJobSort} />
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredJobs.map((job) => {
                      const company = companyMap.get(job.company_id) || job.company;
                      const isActive = job.status === 'active';

                      return (
                        <tr key={job.id} className="border-b border-[#EFEDE5] last:border-0 hover:bg-[#FBFAF7]">
                          <td className="px-3 py-2.5">
                            <input
                              type="checkbox"
                              checked={selectedJobIds.has(job.id)}
                              onChange={() => toggleJobSelected(job.id)}
                            />
                          </td>
                          <td className="px-3 py-2.5 max-w-[280px]">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-[#1A1A1A] truncate">{job.title}</span>
                              {job.featured && (
                                <span className="shrink-0 rounded-full bg-[#FFF8E6] border border-[#F0D080] px-1.5 py-0.5 text-[10px] font-semibold text-[#7A5000]">
                                  Featured
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-[#8A867E]">{job.work_type} - {job.job_type}</div>
                          </td>
                          <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{company?.name || 'Unknown'}</td>
                          <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{job.location}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium border ${statusTone(job.status)}`}>
                              {formatStatus(job.status)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-[#8A867E] whitespace-nowrap">{formatRelative(job.created_at)}</td>
                          <td className="px-3 py-2.5">
                            <div className="flex items-center justify-end gap-1.5">
                              {isActive ? (
                                <>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'filled')}
                                    disabled={processingId === job.id}
                                    title="Mark filled"
                                    className="rounded-md p-1.5 text-[#0C447C] hover:bg-[#E6F1FB] disabled:opacity-60"
                                  >
                                    <CheckCircle2 size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'closed')}
                                    disabled={processingId === job.id}
                                    title="Close"
                                    className="rounded-md p-1.5 text-[#5F5E5A] hover:bg-[#F1EFE8] disabled:opacity-60"
                                  >
                                    <CircleSlash2 size={14} />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'active')}
                                    disabled={processingId === job.id}
                                    title="Reactivate"
                                    className="rounded-md p-1.5 text-[#085041] hover:bg-[#E1F5EE] disabled:opacity-60"
                                  >
                                    <PlayCircle size={14} />
                                  </button>
                                  <button
                                    onClick={() => handleJobStatus(job.id, 'archived')}
                                    disabled={processingId === job.id}
                                    title="Archive"
                                    className="rounded-md p-1.5 text-[#7A5000] hover:bg-[#FFF8E6] disabled:opacity-60"
                                  >
                                    <ArchiveIcon />
                                  </button>
                                </>
                              )}
                              <Link
                                to={`/jobs/${job.slug}`}
                                target="_blank"
                                title="View live"
                                className="rounded-md p-1.5 text-[#5F5E5A] hover:bg-[#F1EFE8]"
                              >
                                <ExternalLink size={14} />
                              </Link>
                              <button
                                onClick={() => handleDeleteJob(job.id)}
                                disabled={processingId === job.id}
                                title="Delete"
                                className="rounded-md p-1.5 text-[#A15A00] hover:bg-[#FFF8E6] disabled:opacity-60"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {selectedView === 'companies' && (
          <div className="space-y-4">
            <span className="block text-xs text-[#8A867E] tabular-nums">
              {filteredCompanies.length} compan{filteredCompanies.length === 1 ? 'y' : 'ies'}
            </span>

            {filteredCompanies.length === 0 ? (
              <div className="rounded-2xl border border-[#D3D1C7] bg-white p-8 text-center text-[#5F5E5A]">
                No companies match your search.
              </div>
            ) : (
              <div className="overflow-x-auto rounded-2xl border border-[#D3D1C7] bg-white">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#D3D1C7] bg-[#FBFAF7]">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Company
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Location
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Jobs
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Status
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-[0.5px] text-[#8A867E]">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCompanies.map((item) => (
                      <tr key={item.id} className="border-b border-[#EFEDE5] last:border-0 hover:bg-[#FBFAF7]">
                        <td className="px-3 py-2.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-lg bg-[#F1EFE8] text-[#1A1A1A] flex items-center justify-center font-bold text-xs flex-shrink-0">
                              {item.logo_initials || 'CO'}
                            </div>
                            <div className="min-w-0">
                              <div className="font-medium text-[#1A1A1A] truncate">{item.name}</div>
                              {item.website && (
                                <a
                                  href={item.website}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-xs text-[#8A867E] hover:text-[#1D9E75] hover:underline truncate block"
                                >
                                  {item.website.replace(/^https?:\/\//, '')}
                                </a>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-[#5F5E5A] whitespace-nowrap">{item.location || '-'}</td>
                        <td className="px-3 py-2.5 text-[#5F5E5A] tabular-nums">{item.job_count}</td>
                        <td className="px-3 py-2.5">
                          {item.verified ? (
                            <span className="inline-flex items-center gap-1 rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2 py-0.5 text-xs font-semibold text-[#085041]">
                              <BadgeCheck size={11} /> Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded-full border border-[#D3D1C7] bg-[#F1EFE8] px-2 py-0.5 text-xs font-medium text-[#5F5E5A]">
                              Unverified
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleToggleVerified(item.id, !item.verified)}
                            disabled={processingId === item.id}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold disabled:opacity-60 ${
                              item.verified
                                ? 'border border-[#D3D1C7] bg-white text-[#5F5E5A]'
                                : 'bg-[#1D9E75] text-white'
                            }`}
                          >
                            <BadgeCheck size={12} /> {item.verified ? 'Unverify' : 'Verify'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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

function TrendCard({
  label,
  value,
  delta,
  icon: Icon,
}: {
  label: string;
  value: number;
  delta: number;
  icon: import('lucide-react').LucideIcon;
}) {
  const isUp = delta > 0;
  const isFlat = delta === 0;

  return (
    <div className="rounded-2xl bg-white border border-[#D3D1C7] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[#5F5E5A] text-xs uppercase tracking-[1px]">
          <Icon size={12} /> {label}
        </div>
      </div>
      <div className="mt-2 flex items-end justify-between">
        <span className="text-2xl font-bold text-[#1A1A1A] tabular-nums">{value}</span>
        {!isFlat && (
          <span
            className={`flex items-center gap-0.5 text-xs font-semibold tabular-nums ${
              isUp ? 'text-[#085041]' : 'text-[#A15A00]'
            }`}
          >
            {isUp ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
            {Math.abs(delta)}%
          </span>
        )}
      </div>
      <div className="mt-1 text-[11px] text-[#B4B2A9]">vs. previous week</div>
    </div>
  );
}

function SortHeader({
  label,
  sortKey,
  current,
  onSort,
}: {
  label: string;
  sortKey: JobSortKey;
  current: { key: JobSortKey; dir: SortDir };
  onSort: (key: JobSortKey) => void;
}) {
  const active = current.key === sortKey;

  return (
    <th className="px-3 py-2.5 text-left">
      <button
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-[0.5px] ${
          active ? 'text-[#1A1A1A]' : 'text-[#8A867E]'
        }`}
      >
        {label}
        {active ? (
          current.dir === 'asc' ? <ArrowUp size={11} /> : <ArrowDown size={11} />
        ) : (
          <ArrowUpDown size={11} className="opacity-50" />
        )}
      </button>
    </th>
  );
}

function ArchiveIcon() {
  return <span className="text-[14px] leading-none">⭳</span>;
}

function ArchiveStatsIcon() {
  return <span className="text-[12px] leading-none">⟲</span>;
}
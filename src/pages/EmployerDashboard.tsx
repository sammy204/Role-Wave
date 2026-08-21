import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  CalendarDays,
  Building2,
  Clock3,
  Eye,
  FileText,
  FolderOpen,
  Gift,
  MapPin,
  MessageSquareText,
  Search,
  Trash2,
  XCircle,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { startConversation } from '../lib/messages';
import { useCountUp } from '../hooks/useCountUp';
import {
  PIPELINE_STAGES,
  PIPELINE_TABS,
  formatStatus as formatApplicationStatus,
  statusTone as applicationStatusTone,
  type PipelineTab,
} from '../lib/applicationPipeline';
import type { CandidateProfile, Company, EmployerProfile, Job, JobApplication, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import ApplicantModal from '../components/ApplicantModal';
import MakeOfferModal from '../components/MakeOfferModal';
import SendOfferDocumentsModal from '../components/SendOfferDocumentsModal';
import OfferActionModal from '../components/OfferActionModal';
import InterviewProposalModal from '../components/InterviewProposalModal';
import { getUserFacingError } from '../lib/userFacingError';

type JobStatus = 'active' | 'filled' | 'closed' | 'archived';
type ApplicationStatus = JobApplication['status'];
type DashboardTab = 'overview' | 'jobs' | 'applications';
type ApplicationPipelineTab = PipelineTab;

function belongsToPipelineTab(status: ApplicationStatus, tab: ApplicationPipelineTab) {
  if (tab === 'applied') return status === 'submitted' || status === 'reviewed';
  return status === tab;
}

function deduplicateApplications(applications: JobApplication[]): JobApplication[] {
  const seen = new Set<string>();
  return applications.filter((application) => {
    const applicantKey = application.candidate_profile_id || application.applicant_email.trim().toLowerCase();
    const key = `${application.job_id}:${applicantKey}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function jobStatusTone(status: string) {
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

function formatJobStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function EmployerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employerProfile, setEmployerProfile] = useState<EmployerProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [applications, setApplications] = useState<(JobApplication & { job?: Job; candidate?: CandidateProfile | null })[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedJobId, setSelectedJobId] = useState<string>('all');
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [applicationPipelineTab, setApplicationPipelineTab] = useState<ApplicationPipelineTab>('applied');
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [confirmDeleteApplicationId, setConfirmDeleteApplicationId] = useState<string | null>(null);
  const [deletingApplicationId, setDeletingApplicationId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonDraft, setRejectionReasonDraft] = useState('');
  const [viewingApplicationId, setViewingApplicationId] = useState<string | null>(null);
  const [offerApplicationId, setOfferApplicationId] = useState<string | null>(null);
  const [offerActionApplicationId, setOfferActionApplicationId] = useState<string | null>(null);
  const [documentOfferApplicationId, setDocumentOfferApplicationId] = useState<string | null>(null);
  const [interviewProposalApplicationId, setInterviewProposalApplicationId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');
      setNotice('');

      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?role=employer', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type !== 'employer') {
          navigate('/start?role=candidate', { replace: true });
          return;
        }

        if (!nextProfile.onboarding_completed) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        setProfile(nextProfile);

        const { data: employerRow, error: employerError } = await supabase
          .from('employer_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (employerError) throw employerError;

        const typedEmployer = (employerRow || null) as EmployerProfile | null;
        setEmployerProfile(typedEmployer);

        if (!typedEmployer?.company_id) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        const { data: companyRow, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', typedEmployer.company_id)
          .maybeSingle();
        if (companyError) throw companyError;
        if (!companyRow) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }
        setCompany(companyRow as Company);

        const { data: jobsData, error: jobsError } = await supabase
          .from('jobs')
          .select('*')
          .eq('company_id', typedEmployer.company_id)
          .order('created_at', { ascending: false });
        if (jobsError) throw jobsError;

        const loadedJobs = (jobsData || []) as Job[];
        setJobs(loadedJobs);

        const jobIds = loadedJobs.map((job) => job.id);
        if (jobIds.length > 0) {
          const { data: applicationData, error: applicationError } = await supabase
            .from('job_applications')
            .select('*')
            .in('job_id', jobIds)
            .order('created_at', { ascending: false });
          if (applicationError) throw applicationError;

          const typedApplications = deduplicateApplications((applicationData || []) as JobApplication[]);
          const candidateIds = typedApplications
            .map((item) => item.candidate_profile_id)
            .filter((id): id is string => Boolean(id));

          const { data: candidateData } = candidateIds.length
            ? await supabase.from('candidate_profiles').select('*').in('id', candidateIds)
            : { data: [] as CandidateProfile[] };

          const candidateMap = new Map((candidateData || []).map((candidate) => [candidate.id, candidate]));
          const jobMap = new Map(loadedJobs.map((job) => [job.id, job]));

          setApplications(
            typedApplications.map((application) => ({
              ...application,
              job: jobMap.get(application.job_id),
              candidate: application.candidate_profile_id ? candidateMap.get(application.candidate_profile_id) || null : null,
            }))
          );
        } else {
          setApplications([]);
        }
      } catch (loadError) {
        if (alive) {
          setError(getUserFacingError(loadError, 'We couldn’t load your employer dashboard. Please try again.'));
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadDashboard();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const filteredApplications = useMemo(() => {
    let result = [...applications];
    if (selectedJobId !== 'all') {
      result = result.filter((item) => item.job_id === selectedJobId);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (item) =>
          item.applicant_name.toLowerCase().includes(q) ||
          item.applicant_email.toLowerCase().includes(q) ||
          item.job?.title.toLowerCase().includes(q) ||
          item.candidate?.headline?.toLowerCase().includes(q) ||
          item.candidate?.skills?.some((skill) => skill.toLowerCase().includes(q))
      );
    }
    return result;
  }, [applications, selectedJobId, searchQuery]);

  const pipelineApplications = useMemo(
    () => filteredApplications.filter((item) => belongsToPipelineTab(item.status, applicationPipelineTab)),
    [filteredApplications, applicationPipelineTab]
  );

  const pipelineCounts = useMemo(
    () => ({
      applied: filteredApplications.filter((item) => belongsToPipelineTab(item.status, 'applied')).length,
      shortlisted: filteredApplications.filter((item) => belongsToPipelineTab(item.status, 'shortlisted')).length,
      interview: filteredApplications.filter((item) => belongsToPipelineTab(item.status, 'interview')).length,
      offer: filteredApplications.filter((item) => belongsToPipelineTab(item.status, 'offer')).length,
      hired: filteredApplications.filter((item) => belongsToPipelineTab(item.status, 'hired')).length,
    }),
    [filteredApplications]
  );

  const counts = useMemo(
    () => ({
      jobs: jobs.length,
      active: jobs.filter((job) => job.status === 'active').length,
      applications: applications.length,
      shortlisted: applications.filter((item) => item.status === 'shortlisted').length,
      newToday: applications.filter((item) => {
        const then = new Date(item.created_at);
        return Date.now() - then.getTime() < 24 * 60 * 60 * 1000;
      }).length,
    }),
    [jobs, applications]
  );

  const needsAttention = useMemo(
    () => applications.filter((item) => ['submitted', 'reviewed', 'shortlisted', 'interview'].includes(item.status)).slice(0, 5),
    [applications]
  );
  const pendingOffers = applications.filter((item) => item.status === 'offer').length;

  const ensureOfferAcceptedForHire = async (applicationId: string) => {
    const { data, error } = await supabase
      .from('offers')
      .select('id')
      .eq('application_id', applicationId)
      .eq('status', 'accepted')
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      throw new Error('The candidate must accept the offer before this application can be marked as hired.');
    }
  };

  const jobsCount = useCountUp(counts.jobs);
  const activeCount = useCountUp(counts.active);
  const applicationsCount = useCountUp(counts.applications);
  const todayCount = useCountUp(counts.newToday);
const updateApplicationStatus = async (
    applicationId: string,
    nextStatus: ApplicationStatus,
    rejectionReason?: string
  ) => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const currentStatus = applications.find((item) => item.id === applicationId)?.status;
      if (nextStatus === 'offer' && currentStatus !== 'interview') {
        throw new Error('An offer can only be sent from the Interview stage.');
      }
      if (nextStatus === 'hired') {
        await ensureOfferAcceptedForHire(applicationId);
      }

      const payload: { status: ApplicationStatus; rejection_reason?: string | null } = { status: nextStatus };
      if (nextStatus === 'rejected') {
        payload.rejection_reason = rejectionReason?.trim() || null;
      }

      const { error: updateError } = await supabase
        .from('job_applications')
        .update(payload)
        .eq('id', applicationId);
      if (updateError) throw updateError;

      setApplications((prev) =>
        prev.map((item) =>
          item.id === applicationId
            ? { ...item, status: nextStatus, rejection_reason: payload.rejection_reason ?? item.rejection_reason }
            : item
        )
      );
      setNotice(`Application updated to ${formatApplicationStatus(nextStatus)}.`);
    } catch (updateError) {
      setError(getUserFacingError(updateError, 'We couldn’t update this application. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const handleOfferSent = (applicationId: string, message = 'Offer sent to candidate.') => {
    setApplications((prev) =>
      prev.map((item) => (item.id === applicationId ? { ...item, status: 'offer' } : item))
    );
    setNotice(message);
  };

  const cancelInterview = async (applicationId: string) => {
    setSaving(true);
    setError('');
    try {
      const { error: cancelError } = await supabase.functions.invoke('cancel-interview', {
        body: { application_id: applicationId },
      });
      if (cancelError) {
        throw cancelError;
      }
      setApplications((prev) => prev.map((item) => item.id === applicationId ? { ...item, status: 'shortlisted' } : item));
      setNotice('Interview cancelled. You can now propose new days and times.');
    } catch (cancelError) {
      setError(getUserFacingError(cancelError, 'We couldn’t cancel the interview. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const rejectApplication = async (applicationId: string) => {
    await updateApplicationStatus(applicationId, 'rejected', rejectionReasonDraft);
    setRejectingId(null);
    setRejectionReasonDraft('');
  };

  const deleteApplication = async (applicationId: string) => {
    setDeletingApplicationId(applicationId);
    setError('');
    setNotice('');

    try {
      const { error: deleteError } = await supabase
        .from('job_applications')
        .delete()
        .eq('id', applicationId)
        .eq('status', 'rejected');
      if (deleteError) throw deleteError;

      setApplications((prev) => prev.filter((item) => item.id !== applicationId));
      setNotice('Rejected application deleted.');
    } catch (deleteError) {
      setError(getUserFacingError(deleteError, 'We couldn’t delete this application. Please try again.'));
    } finally {
      setDeletingApplicationId(null);
      setConfirmDeleteApplicationId(null);
    }
  };

  const updateJobStatus = async (jobId: string, nextStatus: JobStatus) => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const { error: rpcError } = await supabase.rpc('employer_update_job_status', {
        p_job_id: jobId,
        p_status: nextStatus,
      });
      if (rpcError) throw rpcError;

      setJobs((prev) => prev.map((job) => (job.id === jobId ? { ...job, status: nextStatus } : job)));
      setNotice(`Job marked as ${formatJobStatus(nextStatus)}.`);
    } catch (updateError) {
      setError(getUserFacingError(updateError, 'We couldn’t update this job. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  const deleteJob = async (jobId: string) => {
    setDeletingJobId(jobId);
    setError('');
    setNotice('');

    try {
      const { error: rpcError } = await supabase.rpc('employer_delete_job', {
        p_job_id: jobId,
      });
      if (rpcError) throw rpcError;

      setJobs((prev) => prev.filter((job) => job.id !== jobId));
      setApplications((prev) => prev.filter((item) => item.job_id !== jobId));
      setNotice('Job deleted.');
    } catch (deleteError) {
      setError(getUserFacingError(deleteError, 'We couldn’t delete this job. Please try again.'));
    } finally {
      setDeletingJobId(null);
      setConfirmDeleteJobId(null);
    }
  };

  const handleMessageCandidate = async (candidateProfileId: string, jobId: string) => {
    setMessagingId(candidateProfileId);
    setError('');

    try {
      const conversation = await startConversation(candidateProfileId, jobId);
      navigate(`/employer/messages?conversation=${conversation.id}`);
    } catch (messageError) {
      setError(getUserFacingError(messageError, 'We couldn’t start the conversation. Please try again.'));
    } finally {
      setMessagingId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel motion-safe:animate-fade-up rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        {/* Masthead: header + ledger stats unified into one panel */}
        <div className="panel motion-safe:animate-fade-up mb-6 rounded-[28px] p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <div data-tour="employer-dashboard" className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
                <BadgeCheck size={12} /> Employer dashboard
              </div>
              <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">
                {company?.name || employerProfile?.company_name || 'Your company'}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
                Manage your posted jobs, review applications, and keep your hiring pipeline organized.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Link
                to="/jobs"
                className="ghost-chip !rounded-xl !px-4 !py-2.5"
              >
                Public board
              </Link>
            </div>
          </div>

          {(notice || error) && (
            <div
              className={`mt-4 rounded-xl border px-4 py-3 text-sm ${
                error
                  ? 'border-[#F0D080] bg-[#FFF8E6] text-[#7A5000]'
                  : 'border-line bg-white text-muted'
              }`}
            >
              {error || notice}
            </div>
          )}

          {/* Ledger: one strip, hairline dividers, count-up numbers */}
          <div className="mt-5 grid grid-cols-2 divide-y divide-line border-t border-line pt-4 sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <LedgerStat label="Jobs posted" value={jobsCount} icon={<Briefcase size={12} />} />
            <LedgerStat label="Active jobs" value={activeCount} icon={<ArrowRight size={12} />} accent />
            <LedgerStat label="Applications" value={applicationsCount} icon={<FileText size={12} />} />
            <LedgerStat label="Today" value={todayCount} icon={<Clock3 size={12} />} />
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-white p-1.5">
          {([
            ['overview', 'Overview'],
            ['jobs', 'Jobs'],
            ['applications', 'Applications'],
          ] as const).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${
                activeTab === tab ? 'bg-ink text-white' : 'text-muted hover:bg-paper hover:text-ink'
              }`}
            >
              {label}
              {tab === 'applications' && <span className="ml-2 opacity-70">{applications.length}</span>}
            </button>
          ))}
        </div>

        {activeTab === 'overview' ? (
          <div className="grid gap-4 xl:grid-cols-[1.35fr_1fr]">
            <div className="panel motion-safe:animate-fade-up rounded-[28px] p-5 sm:p-6">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">Needs your attention</div>
                  <p className="mt-1 text-sm text-muted">Review the candidates currently moving through your pipeline.</p>
                </div>
                <button onClick={() => setActiveTab('applications')} className="inline-flex items-center gap-1 text-sm font-semibold text-accent-text hover:text-ink">
                  View all <ArrowRight size={14} />
                </button>
              </div>
              <div className="mt-5 divide-y divide-line rounded-2xl border border-line bg-white">
                {needsAttention.length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted">You’re all caught up.</div>
                ) : needsAttention.map((application) => (
                  <button
                    key={application.id}
                    onClick={() => { setViewingApplicationId(application.id); setActiveTab('applications'); }}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-paper"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-ink">{application.applicant_name}</span>
                      <span className="block truncate text-xs text-muted">{application.job?.title || 'Unknown job'} · {timeAgo(application.created_at)}</span>
                    </span>
                    <span className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationStatusTone(application.status)}`}>
                      {formatApplicationStatus(application.status)}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <OverviewCard label="Active jobs" value={counts.active} detail={`${counts.jobs} total posted`} icon={<Briefcase size={16} />} onClick={() => setActiveTab('jobs')} />
              <OverviewCard label="Pending offers" value={pendingOffers} detail="Awaiting candidate response" icon={<Gift size={16} />} onClick={() => setActiveTab('applications')} />
              <OverviewCard label="Shortlisted" value={counts.shortlisted} detail="Candidates worth a closer look" icon={<BadgeCheck size={16} />} onClick={() => setActiveTab('applications')} />
            </div>

            <div className="panel rounded-[28px] p-5 sm:p-6 xl:col-span-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-semibold text-ink">Your recent jobs</div>
                  <p className="mt-1 text-sm text-muted">A quick snapshot of the roles you are managing.</p>
                </div>
                <button onClick={() => setActiveTab('jobs')} className="text-sm font-semibold text-accent-text hover:text-ink">Manage jobs</button>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {jobs.slice(0, 3).map((job) => (
                  <div key={job.id} className="rounded-2xl border border-line bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{job.title}</div>
                        <div className="mt-1 text-xs text-muted">Posted {timeAgo(job.created_at)}</div>
                      </div>
                      <span className={`shrink-0 rounded-full border px-2 py-1 text-[11px] font-semibold ${jobStatusTone(job.status)}`}>{formatJobStatus(job.status)}</span>
                    </div>
                  </div>
                ))}
                {jobs.length === 0 && <div className="text-sm text-muted">No jobs posted yet.</div>}
              </div>
            </div>
          </div>
        ) : (
        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          {/* Consolidated workspace card: company info + actions, one panel */}
          <div className="space-y-4">
            <div
              className="panel motion-safe:animate-fade-up rounded-[28px] p-5"
              style={{ animationDelay: '80ms' }}
            >
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-ink">
                <Building2 size={16} /> Workspace
              </div>
              <div className="space-y-3 text-sm text-muted">
                <Row label="Owner" value={profile?.full_name || 'Employer'} />
                <Row label="Location" value={company?.location || employerProfile?.office_location || 'Not set'} />
                <Row label="Website" value={company?.website || employerProfile?.company_website || 'Not set'} />
                <div className="flex items-start justify-between gap-3">
                  <span className="text-faint">Status</span>
                  <span
                    className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                      company?.verified
                        ? 'border-[#5DCAA5] bg-accent-light text-accent-text'
                        : 'border-line bg-[#F1EFE8] text-muted'
                    }`}
                  >
                    {company?.verified ? 'Verified' : 'Unverified'}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2 border-t border-line pt-4">
                <Link
                  to="/post"
                  data-tour="employer-create-job"
                  className="flex flex-1 items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink transition-all duration-200 hover:-translate-y-[1px] hover:border-[#5DCAA5]"
                >
                  <span className="inline-flex items-center gap-2">
                    <MessageSquareText size={14} /> Create job
                  </span>
                  <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div
              className={activeTab === 'jobs' ? 'panel motion-safe:animate-fade-up rounded-[28px] p-5' : 'hidden'}
              style={{ animationDelay: '140ms' }}
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
              <div data-tour="employer-posted-jobs" className="text-sm font-semibold text-ink">Posted jobs</div>
                  <div className="text-sm text-muted">Manage the roles under your company.</div>
                </div>
                <div className="relative w-full lg:max-w-[320px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs"
                    className="w-full rounded-full border border-line bg-white py-2 pl-9 pr-4 text-sm outline-none transition-colors duration-200 focus:border-accent"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-paper p-6 text-center text-sm text-muted">
                    No jobs posted yet.
                  </div>
                ) : (
                  jobs.map((job, index) => (
                    <div
                      key={job.id}
                      className="motion-safe:animate-fade-up group rounded-[24px] border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
                      style={{ animationDelay: `${180 + index * 60}ms` }}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-ink">{job.title}</h2>
                           <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${jobStatusTone(job.status)}`}>
                              {formatJobStatus(job.status)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-muted">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={13} /> {job.location}
                            </span>
                            <span>{job.work_type}</span>
                            <span>{job.job_type}</span>
                            <span>Posted {timeAgo(job.created_at)}</span>
                          </div>
                          <div className="mt-2 text-sm text-muted line-clamp-2">{job.description}</div>
                        </div>

                        <div className="flex flex-row flex-wrap gap-2 lg:min-w-[230px] lg:flex-col">
                          <Link
                            to={`/jobs/${job.slug}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5] hover:text-ink"
                          >
                            <Eye size={14} /> View
                          </Link>
                          {job.status === 'active' ? (
                            <button
                              onClick={() => updateJobStatus(job.id, 'closed')}
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-ink bg-white px-4 py-2 text-sm font-semibold text-ink transition-all duration-200 hover:bg-ink hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              Close job
                            </button>
                          ) : (
                            <button
                              onClick={() => updateJobStatus(job.id, 'active')}
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              Reactivate
                            </button>
                          )}

                          {confirmDeleteJobId === job.id ? (
                            <div className="flex flex-row gap-2 lg:flex-col">
                              <button
                                onClick={() => deleteJob(job.id)}
                                disabled={deletingJobId === job.id}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#B3261E] px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:bg-[#8C1D17] disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {deletingJobId === job.id ? 'Deleting...' : 'Confirm delete'}
                              </button>
                              <button
                                onClick={() => setConfirmDeleteJobId(null)}
                                disabled={deletingJobId === job.id}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5] hover:text-ink disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmDeleteJobId(job.id)}
                              disabled={saving || deletingJobId !== null}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-[#B3261E] transition-colors duration-200 hover:border-[#B3261E] hover:bg-[#FAECE7] disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              <Trash2 size={14} /> Delete
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div
              className={activeTab === 'applications' ? 'panel motion-safe:animate-fade-up rounded-[28px] p-5' : 'hidden'}
              style={{ animationDelay: '200ms' }}
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div data-tour="employer-applications" className="text-sm font-semibold text-ink">Applications</div>
                  <div className="text-sm text-muted">
                    View candidates who applied through RoleWave.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="rounded-full border border-line bg-white px-4 py-2 text-sm outline-none transition-colors duration-200 focus:border-accent"
                    value={selectedJobId}
                    onChange={(e) => setSelectedJobId(e.target.value)}
                  >
                    <option value="all">All jobs</option>
                    {jobs.map((job) => (
                      <option key={job.id} value={job.id}>
                        {job.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-[#F8F7F4] p-1.5">
                {PIPELINE_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setApplicationPipelineTab(tab.id)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${applicationPipelineTab === tab.id ? 'bg-ink text-white' : 'text-muted hover:bg-white hover:text-ink'}`}
                  >
                    {tab.label} <span className={applicationPipelineTab === tab.id ? 'text-white/70' : 'text-faint'}>({pipelineCounts[tab.id]})</span>
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {pipelineApplications.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-paper p-6 text-center text-sm text-muted">
                    No applications yet.
                  </div>
                ) : (
                  pipelineApplications.map((application, index) => (
                    <div
                      key={application.id}
                      className="motion-safe:animate-fade-up rounded-[24px] border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-ink">{application.applicant_name}</h3>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${applicationStatusTone(application.status)}`}>
                              {formatApplicationStatus(application.status)}
                            </span>
                            <span className="rounded-full border border-line bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-muted">
                              {application.source}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-muted">
                            {application.job?.title || 'Unknown job'} · {application.applicant_email}
                          </div>
                          {application.status === 'rejected' && application.rejection_reason && (
                            <div className="mt-2 rounded-xl border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">
                              Reason shared with candidate: {application.rejection_reason}
                            </div>
                          )}
                          {application.candidate?.headline && (
                            <div className="mt-2 text-sm text-ink">
                              {application.candidate.headline}
                            </div>
                          )}
                          {application.candidate?.skills?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {application.candidate.skills.slice(0, 5).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-text"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-muted">{application.cover_letter || 'No cover letter provided.'}</div>
                          )}
                        </div>

                        <div className="flex flex-row flex-wrap gap-2 lg:min-w-[210px] lg:flex-col">
                          <button
                            onClick={() => setViewingApplicationId(application.id)}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
                          >
                            <FolderOpen size={14} /> Open Application
                          </button>
                          {application.candidate_profile_id && (
                            <button
                              onClick={() => handleMessageCandidate(application.candidate_profile_id!, application.job_id)}
                              disabled={messagingId === application.candidate_profile_id}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5DCAA5] bg-accent-light px-4 py-2 text-sm font-semibold text-accent-text transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              <MessageSquareText size={14} />
                              {messagingId === application.candidate_profile_id ? 'Opening...' : 'Message'}
                            </button>
                          )}
                        {application.status === 'offer' || application.status === 'hired' ? (
                            <button
                              onClick={() => setOfferApplicationId(application.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#8FD3E8] bg-[#E3F5FB] px-4 py-2 text-sm font-semibold text-[#0B5C73] transition-colors duration-200 hover:border-[#0B5C73]"
                            >
                              <Gift size={14} /> {application.status === 'hired' ? 'View accepted offer' : 'View offer'}
                            </button>
                          ) : null}

                          {application.candidate_profile_id && !['rejected', 'withdrawn', 'hired', 'offer'].includes(application.status) && (
                            <button
                              onClick={() => setOfferActionApplicationId(application.id)}
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#8FD3E8] bg-white px-4 py-2 text-sm font-semibold text-[#0B5C73] transition-colors duration-200 hover:border-[#0B5C73]"
                            >
                              <FileText size={14} /> {application.status === 'interview' ? 'Offer options' : 'Send documents'}
                            </button>
                          )}

                          {application.status === 'interview' && (
                            <>
                              <button
                                onClick={() => setInterviewProposalApplicationId(application.id)}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#C9AEEA] bg-[#F1E9FB] px-4 py-2 text-sm font-semibold text-[#4B2E83] transition-colors duration-200 hover:border-[#4B2E83]"
                              >
                                <CalendarDays size={14} /> Propose days and times
                              </button>
                              <button
                                onClick={() => cancelInterview(application.id)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-pill-red-border bg-white px-4 py-2 text-sm font-semibold text-pill-red-text transition-colors hover:bg-pill-red-bg disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Cancel interview
                              </button>
                            </>
                          )}

                          {application.status !== 'rejected' && application.status !== 'withdrawn' && application.status !== 'offer' && (
                            <select
                              value={application.status === 'reviewed' ? 'submitted' : application.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value as ApplicationStatus;
                                if (nextStatus === 'interview') {
                                  setInterviewProposalApplicationId(application.id);
                                  return;
                                }
                                updateApplicationStatus(application.id, nextStatus);
                              }}
                              disabled={saving}
                              className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink outline-none transition-colors duration-200 focus:border-accent disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {PIPELINE_STAGES.map((stage) => (
                                <option key={stage} value={stage}>
                                  {formatApplicationStatus(stage)}
                                </option>
                              ))}
                            </select>
                          )}

                          {rejectingId === application.id ? (
                            <div className="flex w-full flex-col gap-2 rounded-lg border border-pill-red-border bg-pill-red-bg p-3 lg:w-full">
                              <textarea
                                value={rejectionReasonDraft}
                                onChange={(e) => setRejectionReasonDraft(e.target.value)}
                                placeholder="Optional reason to share with the candidate"
                                rows={2}
                                className="w-full resize-none rounded-md border border-line bg-white p-2 text-xs outline-none focus:border-accent"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => rejectApplication(application.id)}
                                  disabled={saving}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#B3261E] px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-[#8C1D17] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Confirm reject
                                </button>
                                <button
                                  onClick={() => {
                                    setRejectingId(null);
                                    setRejectionReasonDraft('');
                                  }}
                                  disabled={saving}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5]"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            application.status !== 'rejected' &&
                            application.status !== 'withdrawn' && (
                              <button
                                onClick={() => setRejectingId(application.id)}
                                disabled={saving}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-[#B3261E] transition-colors duration-200 hover:border-[#B3261E] hover:bg-[#FAECE7] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <XCircle size={14} /> Reject
                              </button>
                            )
                          )}

                          {application.status === 'rejected' && (
                            confirmDeleteApplicationId === application.id ? (
                              <div className="flex w-full flex-row gap-2 rounded-lg border border-pill-red-border bg-pill-red-bg p-2 lg:flex-col">
                                <button
                                  onClick={() => deleteApplication(application.id)}
                                  disabled={deletingApplicationId === application.id}
                                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#B3261E] px-4 py-2 text-sm font-semibold text-white transition-colors duration-200 hover:bg-[#8C1D17] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  <Trash2 size={14} />
                                  {deletingApplicationId === application.id ? 'Deleting...' : 'Confirm delete'}
                                </button>
                                <button
                                  onClick={() => setConfirmDeleteApplicationId(null)}
                                  disabled={deletingApplicationId === application.id}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            ) : (
                              <button
                                onClick={() => setConfirmDeleteApplicationId(application.id)}
                                disabled={saving || deletingApplicationId !== null}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-[#B3261E] transition-colors duration-200 hover:border-[#B3261E] hover:bg-[#FAECE7] disabled:cursor-not-allowed disabled:opacity-50"
                              >
                                <Trash2 size={14} /> Delete applicant
                              </button>
                            )
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
        )}
      </div>
      {viewingApplicationId && (() => {
        const viewingApplication = applications.find((item) => item.id === viewingApplicationId);
        if (!viewingApplication) return null;
        return (
          <ApplicantModal
            application={viewingApplication}
            onClose={() => setViewingApplicationId(null)}
            onMessage={
              viewingApplication.candidate_profile_id
                ? () => handleMessageCandidate(viewingApplication.candidate_profile_id!, viewingApplication.job_id)
                : undefined
            }
            messaging={messagingId === viewingApplication.candidate_profile_id}
          />
        );
      })()}
      {offerApplicationId && employerProfile && (() => {
        const offerApplication = applications.find((item) => item.id === offerApplicationId);
        if (!offerApplication) return null;
        return (
          <MakeOfferModal
            application={offerApplication}
            employerProfileId={employerProfile.id}
            onClose={() => setOfferApplicationId(null)}
            onOfferSent={handleOfferSent}
          />
        );
      })()}
      {offerActionApplicationId && employerProfile && (() => {
        const actionApplication = applications.find((item) => item.id === offerActionApplicationId);
        if (!actionApplication) return null;
        return (
          <OfferActionModal
            application={actionApplication}
            showQuickOffer={actionApplication.status === 'interview'}
            onClose={() => setOfferActionApplicationId(null)}
            onMakeOffer={() => {
              setOfferActionApplicationId(null);
              setOfferApplicationId(actionApplication.id);
            }}
            onSendDocuments={() => {
              setOfferActionApplicationId(null);
              setDocumentOfferApplicationId(actionApplication.id);
            }}
          />
        );
      })()}
      {documentOfferApplicationId && employerProfile && (() => {
        const documentApplication = applications.find((item) => item.id === documentOfferApplicationId);
        if (!documentApplication) return null;
        return (
          <SendOfferDocumentsModal
            application={documentApplication}
            employerProfileId={employerProfile.id}
            onClose={() => setDocumentOfferApplicationId(null)}
            onOfferSent={(applicationId) => {
              handleOfferSent(applicationId, 'Offer documents sent. The candidate has been notified by email.');
            }}
          />
        );
      })()}
      {interviewProposalApplicationId && (() => {
        const interviewApplication = applications.find((item) => item.id === interviewProposalApplicationId);
        if (!interviewApplication) return null;
        return (
          <InterviewProposalModal
            application={interviewApplication}
            onClose={() => setInterviewProposalApplicationId(null)}
            onCreated={() => {
              setApplications((prev) => prev.map((item) => item.id === interviewApplication.id ? { ...item, status: 'interview' } : item));
              setInterviewProposalApplicationId(null);
              setNotice('Interview days and times sent to the candidate.');
            }}
          />
        );
      })()}
    </div>
  );
}

function LedgerStat({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2 px-4 py-3 first:pl-0 sm:py-0">
      <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
        {icon} {label}
      </div>
      <div className={`font-display text-3xl font-semibold tabular-nums ${accent ? 'text-accent-deep' : 'text-ink'}`}>
        {value}
      </div>
    </div>
  );
}

function OverviewCard({
  label,
  value,
  detail,
  icon,
  onClick,
}: {
  label: string;
  value: number;
  detail: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="panel flex items-center justify-between gap-4 rounded-[24px] p-5 text-left transition-all duration-200 hover:-translate-y-[1px] hover:border-[#5DCAA5] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
    >
      <span>
        <span className="flex items-center gap-2 text-xs font-bold uppercase tracking-[1.4px] text-faint">
          {icon} {label}
        </span>
        <span className="mt-2 block font-display text-3xl font-semibold text-ink">{value}</span>
        <span className="mt-1 block text-xs text-muted">{detail}</span>
      </span>
      <ArrowRight size={16} className="text-faint" />
    </button>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-faint">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}

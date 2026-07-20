import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  Clock3,
  Eye,
  FileText,
  MapPin,
  MessageSquareText,
  Search,
  Send,
  Trash2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { startConversation } from '../lib/messages';
import { useCountUp } from '../hooks/useCountUp';
import type { CandidateProfile, Company, EmployerProfile, Job, JobApplication, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

type JobStatus = 'active' | 'filled' | 'closed' | 'archived';
type ApplicationStatus = JobApplication['status'];

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
    case 'shortlisted':
      return 'bg-[#E6F1FB] text-[#0C447C] border-[#9AC0E8]';
    case 'reviewed':
      return 'bg-[#FBFAF7] text-[#5F5E5A] border-[#D3D1C7]';
    case 'hired':
      return 'bg-[#E1F5EE] text-[#085041] border-[#5DCAA5]';
    case 'rejected':
      return 'bg-[#FAECE7] text-[#712B13] border-[#F0D080]';
    default:
      return 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
  }
}

function formatStatus(status: string) {
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
  const [confirmDeleteJobId, setConfirmDeleteJobId] = useState<string | null>(null);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [messagingId, setMessagingId] = useState<string | null>(null);

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

          const typedApplications = (applicationData || []) as JobApplication[];
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
          setError(loadError instanceof Error ? loadError.message : 'Could not load employer dashboard.');
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

  const jobsCount = useCountUp(counts.jobs);
  const activeCount = useCountUp(counts.active);
  const applicationsCount = useCountUp(counts.applications);
  const todayCount = useCountUp(counts.newToday);

  const updateApplicationStatus = async (applicationId: string, nextStatus: ApplicationStatus) => {
    setSaving(true);
    setError('');
    setNotice('');

    try {
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ status: nextStatus })
        .eq('id', applicationId);
      if (updateError) throw updateError;

      setApplications((prev) =>
        prev.map((item) => (item.id === applicationId ? { ...item, status: nextStatus } : item))
      );
      setNotice(`Application updated to ${formatStatus(nextStatus)}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update application.');
    } finally {
      setSaving(false);
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
      setNotice(`Job marked as ${formatStatus(nextStatus)}.`);
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not update job.');
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
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete job.');
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
      setError(messageError instanceof Error ? messageError.message : 'Could not start conversation.');
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
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
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
              className="panel motion-safe:animate-fade-up rounded-[28px] p-5"
              style={{ animationDelay: '140ms' }}
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">Posted jobs</div>
                  <div className="text-sm text-muted">Manage the roles under your company.</div>
                </div>
                <div className="relative w-full lg:max-w-[320px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-faint" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs or applicants"
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
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(job.status)}`}>
                              {formatStatus(job.status)}
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
              className="panel motion-safe:animate-fade-up rounded-[28px] p-5"
              style={{ animationDelay: '200ms' }}
            >
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-ink">Applications</div>
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

              <div className="space-y-3">
                {filteredApplications.length === 0 ? (
                  <div className="rounded-2xl border border-line bg-paper p-6 text-center text-sm text-muted">
                    No applications yet.
                  </div>
                ) : (
                  filteredApplications.map((application, index) => (
                    <div
                      key={application.id}
                      className="motion-safe:animate-fade-up rounded-[24px] border border-line bg-white p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-ink">{application.applicant_name}</h3>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                              {formatStatus(application.status)}
                            </span>
                            <span className="rounded-full border border-line bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-muted">
                              {application.source}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-muted">
                            {application.job?.title || 'Unknown job'} · {application.applicant_email}
                          </div>
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
                          {application.resume_url && (
                            <a
                              href={application.resume_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
                            >
                              <FileText size={14} /> Resume
                            </a>
                          )}
                          {application.portfolio_url && (
                            <a
                              href={application.portfolio_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
                            >
                              <Eye size={14} /> Portfolio
                            </a>
                          )}
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
                          <button
                            onClick={() => updateApplicationStatus(application.id, 'shortlisted')}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E6F1FB] px-4 py-2 text-sm font-semibold text-[#0C447C] transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Send size={14} /> Shortlist
                          </button>
                          <button
                            onClick={() => updateApplicationStatus(application.id, 'reviewed')}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F1EFE8] px-4 py-2 text-sm font-semibold text-muted transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Mark reviewed
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-faint">{label}</span>
      <span className="text-right text-ink">{value}</span>
    </div>
  );
}
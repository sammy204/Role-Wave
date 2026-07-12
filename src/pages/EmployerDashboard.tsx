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
  PlusCircle,
  Search,
  Send,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { CandidateProfile, Company, EmployerProfile, Job, JobApplication, Profile } from '../types';

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
      const { error: rpcError } = await supabase.rpc('admin_update_job_status', {
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

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading employer dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
              <BadgeCheck size={12} /> Employer dashboard
            </div>
            <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-[#1A1A1A] sm:text-4xl">
              {company?.name || employerProfile?.company_name || 'Your company'}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5F5E5A]">
              Manage your posted jobs, review applications, and keep your hiring pipeline organized.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              to="/post"
              className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#168a63]"
            >
              <PlusCircle size={14} /> Post job
            </Link>
            <Link
              to="/employer/onboarding"
              className="inline-flex items-center gap-2 rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A]"
            >
              <Building2 size={14} /> Company
            </Link>
            <Link
              to="/jobs"
              className="inline-flex items-center gap-2 rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A]"
            >
              Public board
            </Link>
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

        <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Jobs posted" value={counts.jobs} icon={<Briefcase size={12} />} />
          <Stat label="Active jobs" value={counts.active} icon={<ArrowRight size={12} />} />
          <Stat label="Applications" value={counts.applications} icon={<FileText size={12} />} />
          <Stat label="Today" value={counts.newToday} icon={<Clock3 size={12} />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
          <div className="space-y-4">
            <div className="panel rounded-[28px] p-5">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                <Building2 size={16} /> Company info
              </div>
              <div className="space-y-3 text-sm text-[#5F5E5A]">
                <Row label="Owner" value={profile?.full_name || 'Employer'} />
                <Row label="Location" value={company?.location || employerProfile?.office_location || 'Not set'} />
                <Row label="Website" value={company?.website || employerProfile?.company_website || 'Not set'} />
                <Row label="Status" value={company?.verified ? 'Verified' : 'Unverified'} />
              </div>
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                <MessageSquareText size={16} /> Quick actions
              </div>
              <div className="space-y-2">
                <Link
                  to="/post"
                  className="flex items-center justify-between rounded-2xl border border-[#D3D1C7] bg-white px-4 py-3 text-sm font-semibold text-[#1A1A1A]"
                >
                  Create job <ArrowRight size={14} />
                </Link>
                <Link
                  to="/candidate/profile"
                  className="flex items-center justify-between rounded-2xl border border-[#D3D1C7] bg-white px-4 py-3 text-sm font-semibold text-[#1A1A1A]"
                >
                  Review candidate model <ArrowRight size={14} />
                </Link>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel rounded-[28px] p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1A1A1A]">Posted jobs</div>
                  <div className="text-sm text-[#5F5E5A]">Manage the roles under your company.</div>
                </div>
                <div className="relative w-full lg:max-w-[320px]">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B4B2A9]" />
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search jobs or applicants"
                    className="w-full rounded-full border border-[#D3D1C7] bg-white py-2 pl-9 pr-4 text-sm outline-none focus:border-[#1D9E75]"
                  />
                </div>
              </div>

              <div className="space-y-3">
                {jobs.length === 0 ? (
                  <div className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] p-6 text-center text-sm text-[#5F5E5A]">
                    No jobs posted yet.
                  </div>
                ) : (
                  jobs.map((job) => (
                    <div key={job.id} className="rounded-[24px] border border-[#D3D1C7] bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <h2 className="text-lg font-semibold text-[#1A1A1A]">{job.title}</h2>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(job.status)}`}>
                              {formatStatus(job.status)}
                            </span>
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-[#5F5E5A]">
                            <span className="inline-flex items-center gap-1">
                              <MapPin size={13} /> {job.location}
                            </span>
                            <span>{job.work_type}</span>
                            <span>{job.job_type}</span>
                            <span>Posted {timeAgo(job.created_at)}</span>
                          </div>
                          <div className="mt-2 text-sm text-[#5F5E5A] line-clamp-2">{job.description}</div>
                        </div>

                        <div className="flex flex-row flex-wrap gap-2 lg:min-w-[230px] lg:flex-col">
                          <Link
                            to={`/jobs/${job.slug}`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-4 py-2 text-sm font-semibold text-[#5F5E5A]"
                          >
                            <Eye size={14} /> View
                          </Link>
                          {job.status === 'active' ? (
                            <button
                              onClick={() => updateJobStatus(job.id, 'closed')}
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F1EFE8] px-4 py-2 text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
                            >
                              Close job
                            </button>
                          ) : (
                            <button
                              onClick={() => updateJobStatus(job.id, 'active')}
                              disabled={saving}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                            >
                              Reactivate
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-sm font-semibold text-[#1A1A1A]">Applications</div>
                  <div className="text-sm text-[#5F5E5A]">
                    View candidates who applied through RoleWave.
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <select
                    className="rounded-full border border-[#D3D1C7] bg-white px-4 py-2 text-sm outline-none"
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
                  <div className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] p-6 text-center text-sm text-[#5F5E5A]">
                    No applications yet.
                  </div>
                ) : (
                  filteredApplications.map((application) => (
                    <div key={application.id} className="rounded-[24px] border border-[#D3D1C7] bg-white p-4">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="text-base font-semibold text-[#1A1A1A]">{application.applicant_name}</h3>
                            <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                              {formatStatus(application.status)}
                            </span>
                            <span className="rounded-full border border-[#D3D1C7] bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]">
                              {application.source}
                            </span>
                          </div>
                          <div className="mt-1 text-sm text-[#5F5E5A]">
                            {application.job?.title || 'Unknown job'} · {application.applicant_email}
                          </div>
                          {application.candidate?.headline && (
                            <div className="mt-2 text-sm text-[#1A1A1A]">
                              {application.candidate.headline}
                            </div>
                          )}
                          {application.candidate?.skills?.length ? (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {application.candidate.skills.slice(0, 5).map((skill) => (
                                <span
                                  key={skill}
                                  className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-xs font-semibold text-[#085041]"
                                >
                                  {skill}
                                </span>
                              ))}
                            </div>
                          ) : (
                            <div className="mt-2 text-sm text-[#5F5E5A]">{application.cover_letter || 'No cover letter provided.'}</div>
                          )}
                        </div>

                        <div className="flex flex-row flex-wrap gap-2 lg:min-w-[210px] lg:flex-col">
                          {application.resume_url && (
                            <a
                              href={application.resume_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A]"
                            >
                              <FileText size={14} /> Resume
                            </a>
                          )}
                          {application.portfolio_url && (
                            <a
                              href={application.portfolio_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-4 py-2 text-sm font-semibold text-[#1A1A1A]"
                            >
                              <Eye size={14} /> Portfolio
                            </a>
                          )}
                          <button
                            onClick={() => updateApplicationStatus(application.id, 'shortlisted')}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E6F1FB] px-4 py-2 text-sm font-semibold text-[#0C447C] disabled:opacity-60"
                          >
                            <Send size={14} /> Shortlist
                          </button>
                          <button
                            onClick={() => updateApplicationStatus(application.id, 'reviewed')}
                            disabled={saving}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#F1EFE8] px-4 py-2 text-sm font-semibold text-[#5F5E5A] disabled:opacity-60"
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

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
      <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[1px] text-[#5F5E5A]">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold text-[#1A1A1A]">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[#B4B2A9]">{label}</span>
      <span className="text-right text-[#1A1A1A]">{value}</span>
    </div>
  );
}

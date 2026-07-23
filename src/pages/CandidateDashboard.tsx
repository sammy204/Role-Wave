import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  Briefcase,
  ArrowRight,
  MapPin,
  MessageSquareText,
  Pencil,
  Send,
  Trash2,
  Sparkles,
  Star,
  Undo2,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { getSavedJobIds } from '../lib/savedJobs';
import { useCountUp } from '../hooks/useCountUp';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessages';
import type { CandidateProfile, Company, Job, JobApplication, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

function timeAgo(date: string): string {
  const then = new Date(date).getTime();
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function statusTone(status: string) {
  switch (status) {
    case 'withdrawn':
      return 'bg-[#FFF1E6] text-[#A15A00] border-[#F0D080]';
    case 'shortlisted':
      return 'bg-pill-blue-bg text-pill-blue-text border-pill-blue-border';
    case 'hired':
      return 'bg-pill-green-bg text-pill-green-text border-pill-green-border';
    case 'rejected':
      return 'bg-pill-red-bg text-pill-red-text border-pill-red-border';
    case 'reviewed':
      return 'bg-pill-amber-bg text-pill-amber-text border-pill-amber-border';
    default:
      return 'bg-[#F1EFE8] text-muted border-line';
  }
}

function formatStatus(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const unreadMessagesCount = useUnreadMessagesCount('candidate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<(JobApplication & { job?: Job & { company?: Company } })[]>([]);
  const [savedJobs, setSavedJobs] = useState<(Job & { company?: Company })[]>([]);
  const [matchedJobs, setMatchedJobs] = useState<(Job & { company?: Company })[]>([]);
  const [marketplaceStats, setMarketplaceStats] = useState({ live: 0, companies: 0, new: 0, verifiedPct: 0 });
  const [topCompanies, setTopCompanies] = useState<Company[]>([]);
  const [subscriptionEmail, setSubscriptionEmail] = useState('');
  const [subscriptionState, setSubscriptionState] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [subscriptionMessage, setSubscriptionMessage] = useState('');
  const [mutatingApplicationId, setMutatingApplicationId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadDashboard() {
      setLoading(true);
      setError('');

      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?mode=login', { replace: true });
          return;
        }

        setSubscriptionEmail(session.user.email || '');

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type === 'employer') {
          navigate('/employer/dashboard', { replace: true });
          return;
        }
        setProfile(nextProfile);

        const { data: candidateRow } = await supabase
          .from('candidate_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (!alive) return;
        const typedCandidate = (candidateRow || null) as CandidateProfile | null;
        setCandidateProfile(typedCandidate);

        const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

        const [
          { count: liveCount },
          { count: companyCount },
          { count: newCount },
        ] = await Promise.all([
          supabase.from('jobs').select('*', { count: 'exact', head: true }).eq('status', 'active'),
          supabase.from('companies').select('*', { count: 'exact', head: true }),
          supabase
            .from('jobs')
            .select('*', { count: 'exact', head: true })
            .eq('status', 'active')
            .gte('created_at', oneDayAgo),
        ]);

        if (alive) {
          setMarketplaceStats((prev) => ({
            ...prev,
            live: liveCount || 0,
            companies: companyCount || 0,
            new: newCount || 0,
          }));
        }

        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .order('job_count', { ascending: false });
        const companyMap = new Map((companiesData || []).map((c: Company) => [c.id, c]));
        if (alive) {
          setTopCompanies((companiesData || []).slice(0, 3));
          const totalCompanies = (companiesData || []).length;
          const verifiedCompanies = (companiesData || []).filter((c: Company) => c.verified).length;
          setMarketplaceStats((prev) => ({
            ...prev,
            verifiedPct: totalCompanies > 0 ? Math.round((verifiedCompanies / totalCompanies) * 100) : 0,
          }));
        }

        const { data: applicationRows } = await supabase
          .from('job_applications')
          .select('*')
          .eq('candidate_profile_id', session.user.id)
          .is('candidate_deleted_at', null)
          .order('created_at', { ascending: false });

        const typedApplications = (applicationRows || []) as JobApplication[];
        const appliedJobIds = typedApplications.map((a) => a.job_id);

        const savedIds = getSavedJobIds(session.user.id);

        const allNeededJobIds = Array.from(new Set([...appliedJobIds, ...savedIds]));
        const { data: neededJobsData } = allNeededJobIds.length
          ? await supabase.from('jobs').select('*').in('id', allNeededJobIds)
          : { data: [] as Job[] };
        const jobMap = new Map(
          ((neededJobsData || []) as Job[]).map((job) => [job.id, { ...job, company: companyMap.get(job.company_id) }])
        );

        if (!alive) return;

        setApplications(
          typedApplications.map((application) => ({
            ...application,
            job: jobMap.get(application.job_id),
          }))
        );

        setSavedJobs(
          savedIds
            .map((id) => jobMap.get(id))
            .filter((j): j is NonNullable<typeof j> => Boolean(j))
        );

        // Skill-matched jobs: active jobs whose tags overlap with the
        // candidate's skills, excluding anything already applied to.
        if (typedCandidate?.skills?.length) {
          const { data: activeJobsData } = await supabase
            .from('jobs')
            .select('*')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(60);

          const lowerSkills = typedCandidate.skills.map((s) => s.toLowerCase());
          const matches = ((activeJobsData || []) as Job[])
            .filter((job) => !appliedJobIds.includes(job.id))
            .filter((job) => job.tags?.some((tag) => lowerSkills.includes(tag.toLowerCase())))
            .slice(0, 4)
            .map((job) => ({ ...job, company: companyMap.get(job.company_id) }));

          if (alive) setMatchedJobs(matches);
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your dashboard.');
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

  const handleSubscribe = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const normalizedEmail = subscriptionEmail.trim().toLowerCase();
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
  };

  const completionFields = useMemo(
    () => [
      candidateProfile?.avatar_url,
      candidateProfile?.headline,
      candidateProfile?.bio,
      candidateProfile?.location,
      candidateProfile?.years_experience,
      candidateProfile?.skills?.length ? candidateProfile.skills.length : 0,
      candidateProfile?.preferred_locations?.length ? candidateProfile.preferred_locations.length : 0,
      candidateProfile?.preferred_salary,
      candidateProfile?.work_preference,
      candidateProfile?.availability,
      candidateProfile?.resume_url,
      candidateProfile?.portfolio_url,
      candidateProfile?.github_url,
      candidateProfile?.linkedin_url,
      candidateProfile?.education,
      candidateProfile?.experience,
      candidateProfile?.projects,
      candidateProfile?.whatsapp_number,
    ],
    [candidateProfile]
  );
  const completedFields = completionFields.filter((v) => (typeof v === 'number' ? v > 0 : Boolean(v))).length;
  const profileCompletion = Math.round((completedFields / completionFields.length) * 100);

  const counts = useMemo(
    () => ({
      applications: applications.length,
      saved: savedJobs.length,
      shortlisted: applications.filter((a) => a.status === 'shortlisted').length,
    }),
    [applications, savedJobs]
  );

  const applicationsCount = useCountUp(counts.applications);
  const savedCount = useCountUp(counts.saved);
  const shortlistedCount = useCountUp(counts.shortlisted);

 const withdrawApplication = async (applicationId: string) => {
    setMutatingApplicationId(applicationId);
    setError('');
    try {
      const { error: updateError } = await supabase
        .from('job_applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);
      if (updateError) throw updateError;
      setApplications((prev) =>
        prev.map((item) => (item.id === applicationId ? { ...item, status: 'withdrawn' } : item))
      );
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not withdraw application.');
    } finally {
      setMutatingApplicationId(null);
    }
  };

  const deleteApplication = async (applicationId: string) => {
    setMutatingApplicationId(applicationId);
    setError('');

    try {
  const { error: deleteError } = await supabase
    .rpc('candidate_delete_application', { p_application_id: applicationId });
  if (deleteError) throw deleteError;
  
      setApplications((prev) => prev.filter((item) => item.id !== applicationId));
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : 'Could not delete application.');
    } finally {
      setMutatingApplicationId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4">
        <div className="rounded-panel border border-line bg-surface px-5 py-5 shadow-card">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
      <div className="pointer-events-none absolute -left-20 top-10 h-64 w-64 rounded-full bg-[#1D9E75]/10 blur-3xl" />
      <div className="pointer-events-none absolute right-0 top-16 h-72 w-72 rounded-full bg-[#5B4088]/10 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-[#0F6E56]/8 blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-[1200px] space-y-5">
        {error && (
          <div className="rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-[34px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f4efff_52%,#eefaf6_100%)] p-5 shadow-[0_24px_70px_rgba(26,26,26,0.07)] backdrop-blur-xl sm:p-6 lg:p-7">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#085041]">
                Candidate workspace
              </div>
              <h1 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.04em] text-[#1A1A1A] sm:text-[42px]">
                Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5F5E5A] sm:text-base">
                Track applications, save jobs, and keep your profile polished without the page feeling busy.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  className="inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-[1px]"
                >
                  Browse jobs <ArrowRight size={14} />
                </button>
                <Link
                  to="/candidate/profile"
                  className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] shadow-[0_10px_24px_rgba(26,26,26,0.04)] transition-colors hover:border-[#5DCAA5]"
                >
                  Complete profile
                </Link>
              </div>
            </div>

            <div className="grid min-w-[260px] grid-cols-2 gap-3">
              <div className="rounded-[24px] border border-white/70 bg-white/80 p-4 shadow-[0_10px_24px_rgba(26,26,26,0.06)]">
                <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#B4B2A9]">
                  Profile strength
                </div>
                <div className="mt-2 font-display text-3xl font-bold text-[#1A1A1A]">{profileCompletion}%</div>
                <div className="mt-1 text-xs text-[#5F5E5A]">Ready for employers</div>
              </div>
              <Link
                to="/candidate/messages"
                className="group rounded-[24px] border border-white/70 bg-[#1A1A1A] p-4 text-white shadow-[0_10px_24px_rgba(26,26,26,0.12)] transition-transform duration-200 hover:-translate-y-[1px]"
              >
                <div className="flex items-center justify-between">
                  <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/45">Messages</div>
                  {unreadMessagesCount > 0 && (
                    <span className="h-2 w-2 rounded-full bg-[#5DCAA5]" />
                  )}
                </div>
                <div className="mt-2 font-display text-3xl font-bold">{unreadMessagesCount}</div>
                <div className="mt-1 text-xs text-white/65">
                  {unreadMessagesCount > 0
                    ? unreadMessagesCount === 1
                      ? 'You got a message'
                      : "You've got messages"
                    : 'All caught up'}
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* Stat cards + profile strength */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
              <Send size={13} /> Applications sent
            </div>
            <div className="mt-2 font-serif text-3xl font-semibold text-ink tabular-nums">{applicationsCount}</div>
          </div>
          <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
              <Bookmark size={13} /> Saved jobs
            </div>
            <div className="mt-2 font-serif text-3xl font-semibold text-ink tabular-nums">{savedCount}</div>
          </div>
          <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
            <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
              <Star size={13} /> Shortlisted
            </div>
            <div className="mt-2 font-serif text-3xl font-semibold text-accent-deep tabular-nums">{shortlistedCount}</div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {/* Recent applications */}
            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Recent applications</div>
                <Link to="/candidate/activity" className="text-xs font-semibold text-accent-text hover:underline">
                  View all
                </Link>
              </div>

              {applications.length === 0 ? (
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] p-6 text-center text-sm text-muted">
                  You haven't applied to any jobs yet.{' '}
                  <Link to="/jobs" className="font-semibold text-accent-text hover:underline">
                    Browse jobs
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  {applications.slice(0, 5).map((application) => (
                    <div
                      key={application.id}
                      className="flex flex-col gap-3 rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-4 py-3 shadow-[0_10px_24px_rgba(26,26,26,0.03)] sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">
                          {application.job?.title || 'Job listing removed'}
                        </div>
                        <div className="truncate text-xs text-muted">
                          {application.job?.company?.name || 'Unknown company'} · {timeAgo(application.created_at)}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`shrink-0 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(application.status)}`}
                        >
                          {formatStatus(application.status)}
                        </span>
                        {application.status === 'withdrawn' ? (
                          <button
                            type="button"
                            onClick={() => deleteApplication(application.id)}
                            disabled={mutatingApplicationId === application.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#A15A00] transition-colors hover:border-[#F0D080] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 size={12} /> Delete
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => withdrawApplication(application.id)}
                            disabled={mutatingApplicationId === application.id}
                            className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:border-[#5DCAA5] hover:text-[#085041] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Undo2 size={12} /> Withdraw
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Jobs matching your skills */}
            {matchedJobs.length > 0 ? (
              <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={15} className="text-accent-deep" />
                  <div className="text-sm font-semibold text-ink">Jobs matching your skills</div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {matchedJobs.map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.slug}`}
                      className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] p-4 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-[0_14px_30px_rgba(26,26,26,0.06)]"
                    >
                      <div className="truncate text-sm font-semibold text-ink">{job.title}</div>
                      <div className="mt-1 truncate text-xs text-muted">{job.company?.name || 'Company'}</div>
                      <div className="mt-2 flex items-center gap-1 text-xs text-faint">
                        <MapPin size={11} /> {job.location}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : (
              !candidateProfile?.skills?.length && (
                <div className="rounded-panel border border-dashed border-[#D3D1C7] bg-white/50 p-5 text-center backdrop-blur-xl">
                  <Sparkles size={18} className="mx-auto text-accent-deep" />
                  <div className="mt-2 text-sm font-semibold text-ink">Add your skills to see matches</div>
                  <p className="mt-1 text-xs text-muted">
                    Tell us what you're good at and we'll surface jobs that fit — right here.
                  </p>
                  <Link
                    to="/candidate/profile"
                    className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-text hover:underline"
                  >
                    Add skills to your profile →
                  </Link>
                </div>
              )
            )}
          </div>

          <div className="space-y-4">
            {/* Profile strength */}
            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Profile strength</div>
                <Link to="/candidate/profile" className="text-accent-text hover:text-accent-deep">
                  <Pencil size={14} />
                </Link>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#E9E7DE]">
                <div
                  className="h-2 rounded-full bg-accent"
                  style={{ width: `${Math.max(6, profileCompletion)}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-muted">You're {profileCompletion}% ready for employers.</div>
              {profileCompletion < 100 && (
                <Link
                  to="/candidate/profile"
                  className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-accent-text hover:underline"
                >
                  Complete your profile →
                </Link>
              )}
            </div>

            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Marketplace pulse</div>
                <span className="text-xs text-faint">Live data</span>
              </div>

              <div className="grid grid-cols-2 gap-2 border-b border-line pb-4">
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-3 py-3">
                  <div className="text-xs text-muted">Live jobs</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{marketplaceStats.live}</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-3 py-3">
                  <div className="text-xs text-muted">Companies</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{marketplaceStats.companies}</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-3 py-3">
                  <div className="text-xs text-muted">New today</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{marketplaceStats.new}</div>
                </div>
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-3 py-3">
                  <div className="text-xs text-muted">Verified</div>
                  <div className="mt-1 text-lg font-semibold text-ink">{marketplaceStats.verifiedPct}%</div>
                </div>
              </div>

              <form className="mt-4" onSubmit={handleSubscribe}>
                <div className="mb-2 text-sm font-semibold text-ink">Get job alerts</div>
                <p className="mb-3 text-xs leading-relaxed text-muted">
                  Stay on top of new roles without checking the board every day.
                </p>
                <input
                  type="email"
                  value={subscriptionEmail}
                  onChange={(event) => setSubscriptionEmail(event.target.value)}
                  placeholder="Your email address"
                  className="field-shell mb-2 px-3 py-2 text-[13px]"
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
            </div>

            {/* Saved jobs preview */}
            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Saved jobs</div>
                <Link to="/candidate/activity" className="text-xs font-semibold text-accent-text hover:underline">
                  View all
                </Link>
              </div>
              {savedJobs.length === 0 ? (
                <div className="rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] p-6 text-center text-sm text-muted">
                  No saved jobs yet.
                </div>
              ) : (
                <div className="space-y-2">
                  {savedJobs.slice(0, 3).map((job) => (
                    <Link
                      key={job.id}
                      to={`/jobs/${job.slug}`}
                      className="flex items-center gap-3 rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-4 py-3 transition-colors duration-200 hover:border-[#5DCAA5]"
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-accent-light text-accent-text">
                        <Briefcase size={15} />
                      </div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-ink">{job.title}</div>
                        <div className="truncate text-xs text-muted">{job.company?.name || 'Company'}</div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Top companies</div>
                <Link to="/jobs" className="text-xs font-semibold text-accent-text hover:underline">
                  Explore jobs
                </Link>
              </div>
              <div className="space-y-2">
                {topCompanies.slice(0, 3).map((company) => {
                  const colorMap: Record<string, string> = {
                    teal: 'bg-[#E1F5EE] text-[#085041]',
                    blue: 'bg-[#E6F1FB] text-[#0C447C]',
                    amber: 'bg-[#FAEEDA] text-[#633806]',
                    purple: 'bg-[#EEEDFE] text-[#3C3489]',
                    coral: 'bg-[#FAECE7] text-[#712B13]',
                  };

                  return (
                    <div key={company.id} className="flex items-center justify-between gap-3 rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-4 py-3 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                      <div className="flex items-center gap-3">
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-xl text-xs font-bold ${
                            colorMap[company.avatar_color] || colorMap.teal
                          }`}
                        >
                          {company.logo_initials}
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-ink">{company.name}</div>
                          <div className="text-xs text-muted">{company.job_count} open roles</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
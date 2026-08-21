import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bookmark,
  Briefcase,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  MapPin,
  Pencil,
  Send,
  Trash2,
  Sparkles,
  Star,
  Target,
  Undo2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { getSavedJobIds } from '../lib/savedJobs';
import { useCountUp } from '../hooks/useCountUp';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessages';
import { formatStatus, statusTone } from '../lib/applicationPipeline';
import { calculateProfileCompletion, getProfileCompletionSuggestions } from '../lib/profileCompletion';
import type { CandidateProfile, Company, Job, JobApplication, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import CompanyLogo from '../components/CompanyLogo';
import { getUserFacingError } from '../lib/userFacingError';

function timeAgo(date: string): string {
  const then = new Date(date).getTime();
  const diff = Math.floor((Date.now() - then) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function normalized(value: string | null | undefined) {
  return (value || '').trim().toLowerCase();
}

function wordSet(value: string | null | undefined) {
  return new Set(normalized(value).split(/[^a-z0-9+#]+/).filter((word) => word.length > 1));
}

function scoreJob(job: Job, candidate: CandidateProfile) {
  let score = 0;
  const jobTitleWords = wordSet(job.title);
  const jobTagWords = new Set((job.tags || []).flatMap((tag) => [...wordSet(tag)]));
  const candidateTitleWords = (candidate.preferred_job_titles || []).flatMap((title) => [...wordSet(title)]);
  const candidateSkillWords = (candidate.skills || []).flatMap((skill) => [...wordSet(skill)]);

  candidateTitleWords.forEach((word) => {
    if (jobTitleWords.has(word)) score += 12;
    if (jobTagWords.has(word)) score += 5;
  });
  candidateSkillWords.forEach((word) => {
    if (jobTagWords.has(word)) score += 10;
    if (jobTitleWords.has(word)) score += 4;
  });

  if (candidate.job_type && normalized(candidate.job_type) === normalized(job.job_type)) score += 30;

  const preferredLocations = (candidate.preferred_locations || []).map(normalized);
  const jobLocation = normalized(job.location);
  if (preferredLocations.includes(jobLocation)) score += 20;
  if (job.work_type === 'Remote' && preferredLocations.includes('remote')) score += 20;

  const experience = candidate.years_experience ?? 0;
  if (!job.experience_level || (experience === 0 && ['entry', 'junior'].includes(normalized(job.experience_level)))) {
    score += 8;
  } else if (experience >= 3 && ['senior', 'lead'].includes(normalized(job.experience_level))) {
    score += 8;
  } else if (experience >= 1 && ['junior', 'mid'].includes(normalized(job.experience_level))) {
    score += 6;
  }

  if (job.featured) score += 2;
  return score;
}


export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const unreadMessagesCount = useUnreadMessagesCount('candidate');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<(JobApplication & { job?: Job & { company?: Company } })[]>([]);
  const [savedJobs, setSavedJobs] = useState<(Job & { company?: Company })[]>([]);
  const [matchedJobs, setMatchedJobs] = useState<(Job & { company?: Company })[]>([]);
  const [topCompanies, setTopCompanies] = useState<Company[]>([]);
  const [mutatingApplicationId, setMutatingApplicationId] = useState<string | null>(null);
  const [reactivatedMessage, setReactivatedMessage] = useState('');

  useEffect(() => {
    if (searchParams.get('reactivated') !== '1') return;
    setReactivatedMessage('Welcome back. Your account has been reactivated successfully.');
    navigate('/candidate/dashboard', { replace: true });
  }, [navigate, searchParams]);

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

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type === 'employer') {
          navigate('/employer/dashboard', { replace: true });
          return;
        }
        if (!nextProfile?.onboarding_completed) {
          navigate('/candidate/onboarding', { replace: true });
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
        const browserTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
        if (typedCandidate && typedCandidate.timezone !== browserTimezone) {
          void supabase.from('candidate_profiles').update({ timezone: browserTimezone }).eq('id', session.user.id);
        }
        setCandidateProfile(typedCandidate);

        const { data: companiesData } = await supabase
          .from('companies')
          .select('*')
          .order('job_count', { ascending: false });
        const companyMap = new Map((companiesData || []).map((c: Company) => [c.id, c]));
        if (alive) {
          setTopCompanies((companiesData || []).slice(0, 3));
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

        // Build a personalized feed from every preference captured during
        // onboarding. Jobs already applied to are excluded so the dashboard
        // keeps showing genuinely actionable opportunities.
        const { data: activeJobsData } = await supabase
          .from('jobs')
          .select('*')
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(100);

        const matches = typedCandidate
          ? ((activeJobsData || []) as Job[])
              .filter((job) => !appliedJobIds.includes(job.id))
              .map((job) => ({
                job: { ...job, company: companyMap.get(job.company_id) },
                score: scoreJob(job, typedCandidate),
              }))
              .sort((a, b) => b.score - a.score || new Date(b.job.created_at).getTime() - new Date(a.job.created_at).getTime())
              .slice(0, 6)
              .map(({ job }) => job)
          : [];

        if (alive) setMatchedJobs(matches);
      } catch (loadError) {
        if (alive) {
          setError(getUserFacingError(loadError, 'We couldn’t load your dashboard. Please try again.'));
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

  const profileCompletion = calculateProfileCompletion(profile, candidateProfile);
  const profileSuggestions = getProfileCompletionSuggestions(profile, candidateProfile);

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

  const weeklyApplications = useMemo(() => {
    const weekStart = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return applications.filter((application) => new Date(application.created_at).getTime() >= weekStart).length;
  }, [applications]);

  const todayFocus = useMemo(() => {
    const focus: { title: string; description: string; href: string }[] = [];

    if (profileCompletion < 100) {
      const nextSuggestion = profileSuggestions[0];
      focus.push({
        title: 'Strengthen your profile',
        description: nextSuggestion?.label || `You are ${profileCompletion}% complete. Add the missing details employers look for.`,
        href: '/candidate/profile',
      });
    }

    if (unreadMessagesCount > 0) {
      focus.push({
        title: 'Check your messages',
        description: `You have ${unreadMessagesCount} unread ${unreadMessagesCount === 1 ? 'message' : 'messages'} from employers.`,
        href: '/candidate/messages',
      });
    }

    if (matchedJobs.length > 0) {
      focus.push({
        title: 'Review your job matches',
        description: `${matchedJobs.length} ${matchedJobs.length === 1 ? 'role matches' : 'roles match'} your listed skills.`,
        href: '/jobs',
      });
    }

    if (focus.length === 0) {
      focus.push({
        title: 'Explore new opportunities',
        description: 'Browse the latest verified roles and find your next application.',
        href: '/jobs',
      });
    }

    return focus.slice(0, 3);
  }, [matchedJobs.length, profileCompletion, profileSuggestions, unreadMessagesCount]);

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
      setError(getUserFacingError(mutationError, 'We couldn’t withdraw this application. Please try again.'));
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
      setError(getUserFacingError(mutationError, 'We couldn’t delete this application. Please try again.'));
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
              <div data-tour="candidate-dashboard" className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#085041]">
                Candidate workspace
              </div>
              <h1 className="font-display text-[30px] font-bold leading-[1.04] tracking-[-0.04em] text-[#1A1A1A] sm:text-[42px]">
                Welcome back{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}.
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-[#5F5E5A] sm:text-base">
                Keep track of your applications, discover new opportunities, and stay ready for what&apos;s next.
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => navigate('/jobs')}
                  data-tour="candidate-browse"
                  className="inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-4 py-2.5 text-sm font-semibold text-white transition-transform duration-200 hover:-translate-y-[1px]"
                >
                  Browse jobs <ArrowRight size={14} />
                </button>
                {profileCompletion < 100 && (
                  <Link
                    to="/candidate/profile"
                    className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#1A1A1A] shadow-[0_10px_24px_rgba(26,26,26,0.04)] transition-colors hover:border-[#5DCAA5]"
                  >
                    Complete profile
                  </Link>
                )}
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
                data-tour="candidate-messages"
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

        <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
          <section className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold text-ink">
                  <Target size={16} className="text-accent-deep" /> Today&apos;s focus
                </div>
                <p className="mt-1 text-xs text-muted">Small steps that keep your search moving.</p>
              </div>
              <span className="rounded-full bg-accent-light px-2.5 py-1 text-[11px] font-semibold text-accent-text">{todayFocus.length} priorities</span>
            </div>
            <div className="space-y-2">
              {todayFocus.map((item, index) => (
                <Link key={item.title} to={item.href} className="flex items-center gap-3 rounded-2xl border border-[#E8E4DA] bg-[#FBFAF7] px-3.5 py-3 transition-colors hover:border-[#5DCAA5]">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-light text-xs font-bold text-accent-text">{index + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-ink">{item.title}</span>
                    <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                  </span>
                  <ArrowRight size={15} className="shrink-0 text-faint" />
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-panel border border-white/70 bg-[#1A1A1A] p-5 text-white shadow-[0_18px_50px_rgba(26,26,26,0.12)]">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold"><CalendarDays size={16} className="text-[#5DCAA5]" /> Weekly progress</div>
                <p className="mt-1 text-xs text-white/65">Your activity over the last 7 days.</p>
              </div>
              <span className="text-xs font-semibold text-[#5DCAA5]">This week</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-white/10 px-3 py-3"><div className="text-xl font-bold">{weeklyApplications}</div><div className="mt-1 text-[11px] text-white/65">Applications</div></div>
              <div className="rounded-2xl bg-white/10 px-3 py-3"><div className="text-xl font-bold">{matchedJobs.length}</div><div className="mt-1 text-[11px] text-white/65">Matches</div></div>
              <div className="rounded-2xl bg-white/10 px-3 py-3"><div className="text-xl font-bold">{unreadMessagesCount}</div><div className="mt-1 text-[11px] text-white/65">Unread</div></div>
            </div>
            <div className="mt-4 flex items-center gap-2 text-xs text-white/70"><CheckCircle2 size={14} className="text-[#5DCAA5]" /> Keep building consistent momentum.</div>
          </section>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            {/* Recent applications */}
            <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
              <div className="mb-3 flex items-center justify-between">
                <div className="text-sm font-semibold text-ink">Recent applications</div>
                <Link to="/candidate/activity" data-tour="candidate-activity" className="text-xs font-semibold text-accent-text hover:underline">
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
                        {application.status === 'rejected' && application.rejection_reason && (
                          <div className="mt-1 text-xs text-pill-red-text">{application.rejection_reason}</div>
                        )}
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

            {/* Personalized recommendations */}
            {matchedJobs.length > 0 ? (
              <div className="rounded-panel border border-white/70 bg-white/78 p-5 shadow-[0_18px_50px_rgba(26,26,26,0.06)] backdrop-blur-xl">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles size={15} className="text-accent-deep" />
                  <div className="text-sm font-semibold text-ink">Recommended for you</div>
                </div>
                <p className="mb-3 text-xs text-muted">Based on your opportunity type, interests, skills, experience, and preferred locations.</p>
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
              <div className="rounded-panel border border-dashed border-[#D3D1C7] bg-white/50 p-5 text-center backdrop-blur-xl">
                  <Sparkles size={18} className="mx-auto text-accent-deep" />
                  <div className="mt-2 text-sm font-semibold text-ink">We&apos;re looking for a closer fit</div>
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
              {profileSuggestions.length > 0 && (
                <div className="mt-3 rounded-2xl border border-line bg-paper p-3">
                  <div className="text-xs font-semibold text-ink">To reach 100%</div>
                  <ul className="mt-2 space-y-1.5">
                    {profileSuggestions.slice(0, 3).map((suggestion) => (
                      <li key={suggestion.key} className="text-xs text-muted">• {suggestion.label}</li>
                    ))}
                  </ul>
                  <Link to="/candidate/profile" className="mt-2 inline-flex text-xs font-semibold text-accent-text hover:underline">
                    Update profile →
                  </Link>
                </div>
              )}
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
                        <CompanyLogo
                          company={company}
                          size={36}
                          radiusClassName="rounded-xl"
                          textClassName="text-xs"
                          fallbackClassName={colorMap[company.avatar_color] || colorMap.teal}
                        />
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

      {reactivatedMessage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="reactivated-title">
          <div className="relative w-full max-w-md rounded-[28px] border border-white/70 bg-white p-7 text-center shadow-2xl sm:p-8">
            <button
              type="button"
              onClick={() => setReactivatedMessage('')}
              className="absolute right-4 top-4 rounded-full p-2 text-[#8A867E] hover:bg-[#F3F2EE]"
              aria-label="Close notification"
            >
              <X size={18} />
            </button>
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#E1F5EE] text-2xl text-[#1D9E75]">✓</div>
            <h2 id="reactivated-title" className="mt-5 text-2xl font-bold text-[#1A1A1A]">Welcome back</h2>
            <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">{reactivatedMessage}</p>
            <button
              type="button"
              onClick={() => {
                setReactivatedMessage('');
                navigate('/jobs');
              }}
              className="mt-6 w-full rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168563]"
            >
              Continue job hunting
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bookmark, CalendarClock, CheckCircle2, Undo2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { getSavedJobIds } from '../lib/savedJobs';
import type { CandidateProfile, Job, JobApplication } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

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

export default function CandidateActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, Job>>(new Map());
  const [error, setError] = useState('');
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?mode=login', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type !== 'candidate') {
          navigate('/', { replace: true });
          return;
        }

        const [
          { data: candidateRow },
          { data: applicationRows },
          { data: jobRows },
        ] = await Promise.all([
          supabase.from('candidate_profiles').select('*').eq('id', session.user.id).maybeSingle(),
          supabase
            .from('job_applications')
            .select('*')
            .eq('candidate_profile_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false }),
        ]);

        if (!alive) return;

        const typedJobs = (jobRows || []) as Job[];
        const mappedJobs = new Map(typedJobs.map((job) => [job.id, job]));
        const savedIds = getSavedJobIds(session.user.id);
        const savedJobRows = savedIds
          .map((id) => mappedJobs.get(id))
          .filter((job): job is Job => Boolean(job));

        setJobMap(mappedJobs);
        setCandidateProfile((candidateRow || null) as CandidateProfile | null);
        setApplications((applicationRows || []) as JobApplication[]);
        setSavedJobs(savedJobRows);
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your activity.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const appliedJobs = useMemo(
    () =>
      applications.map((application) => ({
        application,
        job: jobMap.get(application.job_id),
      })),
    [applications, jobMap]
  );

  const withdrawApplication = async (applicationId: string) => {
    setWithdrawingId(applicationId);
    setError('');

    try {
      const { error: withdrawError } = await supabase
        .from('job_applications')
        .update({ status: 'withdrawn' })
        .eq('id', applicationId);
      if (withdrawError) throw withdrawError;

      setApplications((prev) =>
        prev.map((item) => (item.id === applicationId ? { ...item, status: 'withdrawn' } : item))
      );
    } catch (withdrawError) {
      setError(withdrawError instanceof Error ? withdrawError.message : 'Could not withdraw application.');
    } finally {
      setWithdrawingId(null);
      setConfirmWithdrawId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
        <div className="panel rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <div className="panel rounded-[28px] p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
            <Bookmark size={12} /> Saved & applied
          </div>
          <h1 className="font-display text-2xl font-bold text-[#1A1A1A]">Your job activity</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
            Keep track of jobs you save and where you have already applied.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <div className="panel rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#1A1A1A]">Saved jobs</div>
            <div className="text-xs text-[#B4B2A9]">{savedJobs.length} saved</div>
          </div>

          {savedJobs.length === 0 ? (
            <div className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] p-6 text-center text-sm text-[#5F5E5A]">
              No saved jobs yet.
            </div>
          ) : (
            <div className="space-y-3">
              {savedJobs.map((job) => (
                <Link
                  key={job.id}
                  to={`/jobs/${job.slug}`}
                  className="block rounded-2xl border border-[#D3D1C7] bg-white p-4 transition-colors hover:border-[#5DCAA5] hover:bg-[#FBFAF7]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-base font-semibold text-[#1A1A1A]">{job.title}</div>
                      <div className="mt-1 text-sm text-[#5F5E5A]">{job.location}</div>
                    </div>
                    <div className="text-xs font-semibold text-[#1D9E75]">Open</div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="panel rounded-[28px] p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="text-sm font-semibold text-[#1A1A1A]">Applied jobs</div>
            <div className="inline-flex items-center gap-1 text-xs text-[#B4B2A9]">
              <CalendarClock size={12} /> Recent first
            </div>
          </div>

          {appliedJobs.length === 0 ? (
            <div className="rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] p-6 text-center text-sm text-[#5F5E5A]">
              No applications yet.
            </div>
          ) : (
            <div className="space-y-3">
              {appliedJobs.map(({ application, job }) => {
                const isWithdrawn = application.status === 'withdrawn';
                const statusPillClass = isWithdrawn
                  ? 'bg-[#F1EFE8] text-[#5F5E5A]'
                  : 'bg-[#E1F5EE] text-[#085041]';

                return (
                  <div key={application.id} className="rounded-2xl border border-[#D3D1C7] bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {job ? (
                          <Link to={`/jobs/${job.slug}`} className="text-base font-semibold text-[#1A1A1A] hover:underline">
                            {job.title}
                          </Link>
                        ) : (
                          <div className="text-base font-semibold text-[#1A1A1A]">Job no longer available</div>
                        )}
                        <div className="mt-1 text-sm text-[#5F5E5A]">{job?.company?.name || 'Application submitted'}</div>
                        <div className="mt-1 text-xs text-[#B4B2A9]">{formatRelative(application.created_at)}</div>
                      </div>
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${statusPillClass}`}>
                        <CheckCircle2 size={12} /> {application.status}
                      </span>
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {isWithdrawn ? (
                        job && (
                          <Link
                            to={`/jobs/${job.slug}/apply`}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#168a63]"
                          >
                            Reapply
                          </Link>
                        )
                      ) : confirmWithdrawId === application.id ? (
                        <>
                          <button
                            onClick={() => withdrawApplication(application.id)}
                            disabled={withdrawingId === application.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#B3261E] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#8C1D17] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {withdrawingId === application.id ? 'Withdrawing...' : 'Confirm withdraw'}
                          </button>
                          <button
                            onClick={() => setConfirmWithdrawId(null)}
                            disabled={withdrawingId === application.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-3.5 py-2 text-xs font-semibold text-[#5F5E5A] transition-colors hover:border-[#5DCAA5] hover:text-[#1A1A1A] disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setConfirmWithdrawId(application.id)}
                          disabled={withdrawingId !== null}
                          className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-3.5 py-2 text-xs font-semibold text-[#5F5E5A] transition-colors hover:border-[#B3261E] hover:text-[#B3261E] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          <Undo2 size={13} /> Withdraw
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="rounded-[24px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 text-sm text-[#5F5E5A]">
          {candidateProfile?.open_to_work ? 'You are open to work.' : 'You are not marked as open to work.'}
        </div>
      </div>
    </div>
  );
}

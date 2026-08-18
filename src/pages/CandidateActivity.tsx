import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bookmark,
  CalendarClock,
  CheckCircle2,
  Trash2,
  Undo2,
  Gift,
  Ban,
  MapPin,
  Clock3,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { getSavedJobIds } from '../lib/savedJobs';
import { formatStatus, statusTone } from '../lib/applicationPipeline';
import { formatDate } from '../lib/dateFormat';
import type { CandidateProfile, Job, JobApplication, Offer } from '../types';
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

function formatMoney(amount: number | null, currency: string, period: string) {
  if (amount == null) return 'Not specified';
  const formatted = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount);
  return `${currency} ${formatted} / ${period}`;
}

export default function CandidateActivity() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [savedJobs, setSavedJobs] = useState<Job[]>([]);
  const [jobMap, setJobMap] = useState<Map<string, Job>>(new Map());
  const [offersByApplication, setOffersByApplication] = useState<Map<string, Offer>>(new Map());
  const [error, setError] = useState('');
  const [confirmWithdrawId, setConfirmWithdrawId] = useState<string | null>(null);
  const [withdrawingId, setWithdrawingId] = useState<string | null>(null);
  const [dismissingId, setDismissingId] = useState<string | null>(null);
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingBusy, setRespondingBusy] = useState(false);

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
          { data: offerRows },
        ] = await Promise.all([
          supabase.from('candidate_profiles').select('*').eq('id', session.user.id).maybeSingle(),
          supabase
            .from('job_applications')
            .select('*')
            .eq('candidate_profile_id', session.user.id)
            .order('created_at', { ascending: false }),
          supabase.from('jobs').select('*').eq('status', 'active').order('created_at', { ascending: false }),
          supabase
            .from('offers')
            .select('*')
            .eq('candidate_profile_id', session.user.id)
            .order('created_at', { ascending: false }),
        ]);

        if (!alive) return;

        const typedJobs = (jobRows || []) as Job[];
        const mappedJobs = new Map(typedJobs.map((job) => [job.id, job]));
        const savedIds = getSavedJobIds(session.user.id);
        const savedJobRows = savedIds
          .map((id) => mappedJobs.get(id))
          .filter((job): job is Job => Boolean(job));

        // Keep only the most recent offer per application (rows already ordered newest first).
        const offerMap = new Map<string, Offer>();
        for (const offer of (offerRows || []) as Offer[]) {
          if (!offerMap.has(offer.application_id)) {
            offerMap.set(offer.application_id, offer);
          }
        }

        setJobMap(mappedJobs);
        setCandidateProfile((candidateRow || null) as CandidateProfile | null);
        setApplications((applicationRows || []) as JobApplication[]);
        setSavedJobs(savedJobRows);
        setOffersByApplication(offerMap);
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
     const { error } = await supabase
  .rpc('candidate_delete_application', { p_application_id: applicationId });
if (error) throw error;

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

  const dismissApplication = async (applicationId: string) => {
    setDismissingId(applicationId);
    setError('');

    try {
      const { error: dismissError } = await supabase
        .from('job_applications')
        .update({ candidate_deleted_at: new Date().toISOString() })
        .eq('id', applicationId);
      if (dismissError) throw dismissError;

      setApplications((prev) => prev.filter((item) => item.id !== applicationId));
    } catch (dismissError) {
      setError(dismissError instanceof Error ? dismissError.message : 'Could not remove application.');
    } finally {
      setDismissingId(null);
    }
  };

  const openResponse = (offerId: string, action: 'accepted' | 'declined') => {
    setRespondingOfferId(offerId);
    setResponseAction(action);
    setResponseMessage('');
    setError('');
  };

  const cancelResponse = () => {
    setRespondingOfferId(null);
    setResponseAction(null);
    setResponseMessage('');
  };

  const submitResponse = async (offer: Offer) => {
    if (!responseAction) return;
    setRespondingBusy(true);
    setError('');

    try {
      const { data, error: respondError } = await supabase
        .from('offers')
        .update({ status: responseAction, response_message: responseMessage.trim() || null })
        .eq('id', offer.id)
        .select('*')
        .single();
      if (respondError) throw respondError;

      const updated = data as Offer;
      setOffersByApplication((prev) => {
        const next = new Map(prev);
        next.set(updated.application_id, updated);
        return next;
      });
      setRespondingOfferId(null);
      setResponseAction(null);
      setResponseMessage('');
    } catch (respondError) {
      setError(respondError instanceof Error ? respondError.message : 'Could not send your response.');
    } finally {
      setRespondingBusy(false);
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
    <div className="page-shell px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[720px] space-y-4">
        <div className="panel rounded-[28px] p-5">
          <div data-tour="candidate-activity-page" className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
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
                const offer = application.status === 'offer' ? offersByApplication.get(application.id) : undefined;

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
                      <span className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                        <CheckCircle2 size={12} /> {formatStatus(application.status)}
                      </span>
                    </div>

                    {application.status === 'rejected' && application.rejection_reason && (
                      <div className="mt-3 rounded-xl border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">
                        {application.rejection_reason}
                      </div>
                    )}

                    {offer && (
                      <div className="mt-3 rounded-2xl border border-[#8FD3E8] bg-[#E3F5FB] p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#0B5C73]">
                          <Gift size={14} /> Offer letter — {offer.role_title}
                        </div>

                        <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                          <div className="flex items-center gap-2 text-[#0B5C73]">
                            <span className="font-semibold">
                              {formatMoney(offer.salary_amount, offer.salary_currency, offer.salary_period)}
                            </span>
                          </div>
                          {offer.work_arrangement && (
                            <div className="flex items-center gap-2 text-[#0B5C73]">
                              <MapPin size={13} /> {offer.work_arrangement}
                              {offer.location ? ` · ${offer.location}` : ''}
                            </div>
                          )}
                          {offer.start_date && (
                            <div className="flex items-center gap-2 text-[#0B5C73]">
                              <Clock3 size={13} /> Starts {formatDate(offer.start_date)}
                            </div>
                          )}
                          {offer.expiry_date && offer.status === 'sent' && (
                            <div className="flex items-center gap-2 text-[#0B5C73]">
                              Offer expires {formatDate(offer.expiry_date)}
                            </div>
                          )}
                        </div>

                        {offer.benefits_notes && (
                          <p className="mt-3 whitespace-pre-wrap text-sm text-[#0B5C73]">{offer.benefits_notes}</p>
                        )}

                        {offer.status === 'sent' ? (
                          respondingOfferId === offer.id ? (
                            <div className="mt-4 flex flex-col gap-2 rounded-xl border border-[#8FD3E8] bg-white p-3">
                              <textarea
                                value={responseMessage}
                                onChange={(e) => setResponseMessage(e.target.value)}
                                placeholder={
                                  responseAction === 'accepted'
                                    ? 'Optional note to the employer'
                                    : 'Optional reason to share with the employer'
                                }
                                rows={2}
                                className="w-full resize-none rounded-md border border-line bg-white p-2 text-xs outline-none focus:border-accent"
                              />
                              <div className="flex gap-2">
                                <button
                                  onClick={() => submitResponse(offer)}
                                  disabled={respondingBusy}
                                  className={`inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-white transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-60 ${
                                    responseAction === 'accepted'
                                      ? 'bg-[#1D9E75] hover:bg-[#168a63]'
                                      : 'bg-[#B3261E] hover:bg-[#8C1D17]'
                                  }`}
                                >
                                  {respondingBusy
                                    ? 'Sending...'
                                    : responseAction === 'accepted'
                                    ? 'Confirm accept'
                                    : 'Confirm decline'}
                                </button>
                                <button
                                  onClick={cancelResponse}
                                  disabled={respondingBusy}
                                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <button
                                onClick={() => openResponse(offer.id, 'accepted')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#168a63]"
                              >
                                <CheckCircle2 size={13} /> Accept offer
                              </button>
                              <button
                                onClick={() => openResponse(offer.id, 'declined')}
                                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#0B5C73] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B5C73] transition-colors hover:bg-[#D6EEF7]"
                              >
                                <Ban size={13} /> Decline
                              </button>
                            </div>
                          )
                        ) : offer.status === 'accepted' ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-[#1D9E75]/10 px-3 py-2 text-xs font-semibold text-[#085041]">
                            <CheckCircle2 size={13} /> You accepted this offer.
                          </div>
                        ) : offer.status === 'declined' ? (
                          <div className="mt-4 inline-flex items-center gap-2 rounded-lg bg-white px-3 py-2 text-xs font-semibold text-[#0B5C73]">
                            <Ban size={13} /> You declined this offer.
                          </div>
                        ) : offer.status === 'withdrawn' ? (
                          <div className="mt-4 text-xs font-semibold text-[#0B5C73]">
                            The employer withdrew this offer.
                          </div>
                        ) : offer.status === 'expired' ? (
                          <div className="mt-4 text-xs font-semibold text-[#0B5C73]">This offer has expired.</div>
                        ) : null}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">                      {isWithdrawn ? (
                        <>
                          {job && (
                            <Link
                              to={`/jobs/${job.slug}/apply`}
                              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#1D9E75] px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#168a63]"
                            >
                              Reapply
                            </Link>
                          )}
                          <button
                            onClick={() => dismissApplication(application.id)}
                            disabled={dismissingId === application.id}
                            className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#D3D1C7] bg-white px-3.5 py-2 text-xs font-semibold text-[#5F5E5A] transition-colors hover:border-[#B3261E] hover:text-[#B3261E] disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            <Trash2 size={13} /> {dismissingId === application.id ? 'Removing...' : 'Remove'}
                          </button>
                        </>
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

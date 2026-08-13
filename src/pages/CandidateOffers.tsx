import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, CheckCircle2, ChevronDown, Clock3, Gift, MapPin, Trash2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { Job, Offer } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

function formatDate(date: string) {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatMoney(amount: number | null, currency: string, period: string) {
  if (amount == null) return 'Not specified';
  return `${currency} ${new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount)} / ${period}`;
}

function statusLabel(status: Offer['status']) {
  return status === 'sent' ? 'Awaiting your response' : status.charAt(0).toUpperCase() + status.slice(1);
}

function statusClass(status: Offer['status']) {
  if (status === 'accepted') return 'border-[#9BD8BF] bg-[#E1F5EE] text-[#085041]';
  if (status === 'declined' || status === 'withdrawn' || status === 'expired') return 'border-[#E6B8B5] bg-[#FDECEA] text-[#8C1D17]';
  return 'border-[#8FD3E8] bg-[#E3F5FB] text-[#0B5C73]';
}

export default function CandidateOffers() {
  const navigate = useNavigate();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [jobs, setJobs] = useState<Map<string, Job>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingBusy, setRespondingBusy] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [removingOfferId, setRemovingOfferId] = useState<string | null>(null);

  const loadOffers = useCallback(async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const session = sessionData.session;
    if (!session) {
      navigate('/start?mode=login', { replace: true });
      return;
    }

    const profile = await fetchProfile(session.user.id);
    if (profile?.account_type !== 'candidate') {
      navigate('/', { replace: true });
      return;
    }

    const { data, error: offersError } = await supabase
      .from('offers')
      .select('*')
      .eq('candidate_profile_id', session.user.id)
      .is('candidate_deleted_at', null)
      .neq('status', 'draft')
      .order('created_at', { ascending: false });
    if (offersError) throw offersError;

    const nextOffers = (data || []) as Offer[];
    const jobIds = [...new Set(nextOffers.map((offer) => offer.job_id))];
    const { data: jobRows, error: jobsError } = jobIds.length
      ? await supabase.from('jobs').select('*').in('id', jobIds)
      : { data: [], error: null };
    if (jobsError) throw jobsError;

    setOffers(nextOffers);
    setJobs(new Map(((jobRows || []) as Job[]).map((job) => [job.id, job])));
    setExpandedOfferId((current) => current && nextOffers.some((offer) => offer.id === current) ? current : nextOffers.find((offer) => offer.status === 'sent')?.id ?? nextOffers[0]?.id ?? null);
  }, [navigate]);

  useEffect(() => {
    let alive = true;
    void loadOffers()
      .catch((loadError) => {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load your offers.');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => { alive = false; };
  }, [loadOffers]);

  const openResponse = (offerId: string, action: 'accepted' | 'declined') => {
    setRespondingOfferId(offerId);
    setResponseAction(action);
    setResponseMessage('');
    setError('');
  };

  const submitResponse = async (offer: Offer) => {
    if (!responseAction) return;
    setRespondingBusy(true);
    setError('');
    try {
      const { data, error: responseError } = await supabase
        .from('offers')
        .update({ status: responseAction, response_message: responseMessage.trim() || null })
        .eq('id', offer.id)
        .eq('candidate_profile_id', offer.candidate_profile_id)
        .eq('status', 'sent')
        .select('*')
        .single();
      if (responseError) throw responseError;
      setOffers((previous) => previous.map((item) => item.id === offer.id ? data as Offer : item));
      setRespondingOfferId(null);
      setResponseAction(null);
      setResponseMessage('');
    } catch (responseError) {
      setError(responseError instanceof Error ? responseError.message : 'Could not send your response.');
    } finally {
      setRespondingBusy(false);
    }
  };

  const removeOffer = async (offer: Offer) => {
    if (offer.status === 'sent') return;
    setRemovingOfferId(offer.id);
    setError('');
    try {
      const { error: removeError } = await supabase.rpc('candidate_remove_offer', { p_offer_id: offer.id });
      if (removeError) throw removeError;
      setOffers((previous) => previous.filter((item) => item.id !== offer.id));
    } catch (removeError) {
      const errorMessage = removeError && typeof removeError === 'object' && 'message' in removeError
        ? String(removeError.message)
        : removeError instanceof Error
          ? removeError.message
          : 'Could not remove this offer.';
      setError(errorMessage);
    } finally {
      setRemovingOfferId(null);
    }
  };

  const activeOffers = useMemo(() => offers.filter((offer) => offer.status === 'sent'), [offers]);

  if (loading) return <div className="flex min-h-screen items-center justify-center px-4"><div className="rounded-panel border border-line bg-surface px-5 py-5 shadow-card"><LoadingSpinner className="text-[#1D9E75]" /></div></div>;

  return (
    <div className="page-shell px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[760px] space-y-4">
        <div className="panel rounded-[28px] p-5">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]"><Gift size={12} /> Offers</div>
          <h1 className="font-display text-2xl font-bold text-[#1A1A1A]">Your offers</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Review offers from employers and respond when you’re ready.</p>
        </div>

        {error && <div className="rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">{error}</div>}

        {offers.length === 0 ? (
          <div className="panel rounded-[28px] p-8 text-center">
            <Gift className="mx-auto text-[#1D9E75]" size={28} />
            <h2 className="mt-3 font-semibold text-[#1A1A1A]">No offers yet</h2>
            <p className="mt-1 text-sm text-[#5F5E5A]">Offers you receive will appear here.</p>
            <Link to="/jobs" className="mt-4 inline-flex rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white">Browse jobs</Link>
          </div>
        ) : (
          offers.map((offer) => {
            const job = jobs.get(offer.job_id);
            const isResponding = respondingOfferId === offer.id;
            const isExpanded = expandedOfferId === offer.id;
            return (
              <article key={offer.id} className="panel rounded-[28px] p-5">
                <div
                  onClick={() => setExpandedOfferId((current) => current === offer.id ? null : offer.id)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setExpandedOfferId((current) => current === offer.id ? null : offer.id);
                  }}
                  role="button"
                  tabIndex={0}
                  className="flex w-full cursor-pointer flex-wrap items-start justify-between gap-3 text-left"
                  aria-expanded={isExpanded}
                >
                  <div>
                    {job ? <Link to={`/jobs/${job.slug}`} className="text-lg font-semibold text-[#1A1A1A] hover:underline">{job.title}</Link> : <h2 className="text-lg font-semibold text-[#1A1A1A]">{offer.role_title}</h2>}
                    <p className="mt-1 text-sm text-[#5F5E5A]">{offer.role_title}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusClass(offer.status)}`}>{statusLabel(offer.status)}</span>
                    <ChevronDown size={18} className={`text-[#8A8982] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                  </div>
                </div>

                {!isExpanded ? <p className="mt-3 text-sm font-semibold text-[#0B5C73]">{formatMoney(offer.salary_amount, offer.salary_currency, offer.salary_period)}</p> : <>
                <div className="mt-4 grid gap-3 text-sm text-[#0B5C73] sm:grid-cols-2">
                  <strong>{formatMoney(offer.salary_amount, offer.salary_currency, offer.salary_period)}</strong>
                  {offer.work_arrangement && <span className="inline-flex items-center gap-2"><MapPin size={14} />{offer.work_arrangement}{offer.location ? ` · ${offer.location}` : ''}</span>}
                  {offer.start_date && <span className="inline-flex items-center gap-2"><Clock3 size={14} />Starts {formatDate(offer.start_date)}</span>}
                  {offer.expiry_date && offer.status === 'sent' && <span>Expires {formatDate(offer.expiry_date)}</span>}
                </div>
                {offer.benefits_notes && <p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-[#0B5C73]">{offer.benefits_notes}</p>}

                {offer.status === 'sent' ? (isResponding ? (
                  <div className="mt-5 rounded-xl border border-[#8FD3E8] bg-[#FBFAF7] p-3">
                    <textarea value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} rows={3} placeholder={responseAction === 'accepted' ? 'Optional note to the employer' : 'Optional reason to share with the employer'} className="w-full resize-none rounded-md border border-line bg-white p-2 text-sm outline-none focus:border-accent" />
                    <div className="mt-2 flex gap-2">
                      <button onClick={() => submitResponse(offer)} disabled={respondingBusy} className={`rounded-lg px-3.5 py-2 text-xs font-semibold text-white disabled:opacity-60 ${responseAction === 'accepted' ? 'bg-[#1D9E75]' : 'bg-[#B3261E]'}`}>{respondingBusy ? 'Sending...' : `Confirm ${responseAction === 'accepted' ? 'accept' : 'decline'}`}</button>
                      <button onClick={() => setRespondingOfferId(null)} disabled={respondingBusy} className="rounded-lg border border-line bg-white px-3.5 py-2 text-xs font-semibold text-muted">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 flex flex-wrap gap-2">
                    <button onClick={() => openResponse(offer.id, 'accepted')} className="inline-flex items-center gap-2 rounded-lg bg-[#1D9E75] px-3.5 py-2 text-xs font-semibold text-white"><CheckCircle2 size={13} /> Accept offer</button>
                    <button onClick={() => openResponse(offer.id, 'declined')} className="inline-flex items-center gap-2 rounded-lg border border-[#0B5C73] bg-white px-3.5 py-2 text-xs font-semibold text-[#0B5C73]"><Ban size={13} /> Decline</button>
                  </div>
                )) : offer.status === 'accepted' ? <p className="mt-5 text-sm font-semibold text-[#085041]"><CheckCircle2 className="mr-1 inline" size={15} /> You accepted this offer.</p> : offer.status === 'declined' ? <p className="mt-5 text-sm font-semibold text-[#0B5C73]"><Ban className="mr-1 inline" size={15} /> You declined this offer.</p> : offer.status === 'withdrawn' ? <p className="mt-5 text-sm font-semibold text-[#8C1D17]">The employer withdrew this offer.</p> : offer.status === 'expired' ? <p className="mt-5 text-sm font-semibold text-[#8C1D17]">This offer expired.</p> : null}
                {offer.status !== 'sent' && (
                  <button type="button" onClick={() => removeOffer(offer)} disabled={removingOfferId === offer.id} className="mt-5 inline-flex items-center gap-2 rounded-lg border border-[#E6B8B5] px-3.5 py-2 text-xs font-semibold text-[#8C1D17] hover:bg-[#FDECEA] disabled:opacity-60">
                    <Trash2 size={13} /> {removingOfferId === offer.id ? 'Removing...' : 'Remove offer'}
                  </button>
                )}
                </>}
              </article>
            );
          })
        )}
        {activeOffers.length > 0 && <p className="text-center text-xs text-[#8A8982]">You have {activeOffers.length} offer{activeOffers.length === 1 ? '' : 's'} awaiting a response.</p>}
      </div>
    </div>
  );
}

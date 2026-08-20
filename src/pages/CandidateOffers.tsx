import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Ban, CheckCircle2, ChevronDown, Clock3, Download, FileText, Gift, MapPin, Trash2, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { formatDate } from '../lib/dateFormat';
import type { Job, Offer, OfferDocument } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

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
  const [documentsByOffer, setDocumentsByOffer] = useState<Map<string, OfferDocument[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [respondingOfferId, setRespondingOfferId] = useState<string | null>(null);
  const [responseAction, setResponseAction] = useState<'accepted' | 'declined' | null>(null);
  const [responseMessage, setResponseMessage] = useState('');
  const [respondingBusy, setRespondingBusy] = useState(false);
  const [expandedOfferId, setExpandedOfferId] = useState<string | null>(null);
  const [removingOfferId, setRemovingOfferId] = useState<string | null>(null);
  const [signedFile, setSignedFile] = useState<File | null>(null);
  const [signedMessage, setSignedMessage] = useState('');
  const [uploadingSignedOfferId, setUploadingSignedOfferId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'pending' | 'history'>('pending');

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
    const { data: documentRows, error: documentsError } = nextOffers.length
      ? await supabase.from('offer_documents').select('*').in('offer_id', nextOffers.map((offer) => offer.id)).order('sort_order', { ascending: true })
      : { data: [], error: null };
    if (documentsError) throw documentsError;
    const documentMap = new Map<string, OfferDocument[]>();
    for (const document of (documentRows || []) as OfferDocument[]) {
      documentMap.set(document.offer_id, [...(documentMap.get(document.offer_id) || []), document]);
    }
    setDocumentsByOffer(documentMap);
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
      const offerDocuments = documentsByOffer.get(offer.id) || [];
      const hasEmployerDocuments = offerDocuments.some((document) => document.document_type === 'employer_offer');
      const hasSignedDocument = offerDocuments.some((document) => document.document_type === 'candidate_signed');
      if (responseAction === 'accepted' && hasEmployerDocuments && !signedFile && !hasSignedDocument) {
        throw new Error('Choose the signed offer document before accepting this offer.');
      }
      if (responseAction === 'accepted' && signedFile) {
        const uploaded = await uploadSignedDocument(offer);
        if (!uploaded) throw new Error('Could not upload the signed offer document.');
      }
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

  const downloadDocument = async (document: OfferDocument) => {
    setError('');
    const { data, error: signedUrlError } = await supabase.storage.from('offer-documents').createSignedUrl(document.storage_path, 60 * 10);
    if (signedUrlError || !data?.signedUrl) {
      setError(signedUrlError?.message || 'Could not open this document.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const uploadSignedDocument = async (offer: Offer): Promise<boolean> => {
    if (!signedFile) return true;
    if (!['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'].includes(signedFile.type)) {
      setError('Signed documents must be PDF, DOC, or DOCX files.');
      return false;
    }
    if (signedFile.size > 10 * 1024 * 1024) {
      setError('Signed documents must be smaller than 10 MB.');
      return false;
    }

    setUploadingSignedOfferId(offer.id);
    setError('');
    try {
      const safeName = signedFile.name.replace(/[^a-zA-Z0-9._-]/g, '-');
      const path = `${offer.id}/candidate-${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from('offer-documents').upload(path, signedFile, { contentType: signedFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const { data: document, error: documentError } = await supabase.from('offer_documents').insert({
        offer_id: offer.id,
        storage_path: path,
        file_name: signedFile.name,
        mime_type: signedFile.type,
        file_size: signedFile.size,
        sort_order: (documentsByOffer.get(offer.id) || []).length,
        document_type: 'candidate_signed',
        uploaded_by: offer.candidate_profile_id,
        document_message: signedMessage.trim() || null,
      }).select('*').single();
      if (documentError) {
        await supabase.storage.from('offer-documents').remove([path]);
        throw documentError;
      }

      setDocumentsByOffer((current) => new Map(current).set(offer.id, [...(current.get(offer.id) || []), document as OfferDocument]));
      setSignedFile(null);
      setSignedMessage('');
      return true;
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not send the signed document.');
      return false;
    } finally {
      setUploadingSignedOfferId(null);
    }
  };

  const activeOffers = useMemo(() => offers.filter((offer) => offer.status === 'sent'), [offers]);
  const historyOffers = useMemo(() => offers.filter((offer) => offer.status !== 'sent'), [offers]);
  const visibleOffers = activeTab === 'pending' ? activeOffers : historyOffers;

  if (loading) return <div className="flex min-h-screen items-center justify-center px-4"><div className="rounded-panel border border-line bg-surface px-5 py-5 shadow-card"><LoadingSpinner className="text-[#1D9E75]" /></div></div>;

  return (
    <div className="page-shell px-4 py-6 pb-24 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-[760px] space-y-4">
        <div className="overflow-hidden rounded-[30px] border border-white/70 bg-[linear-gradient(135deg,#ffffff_0%,#f4efff_54%,#eefaf6_100%)] p-5 shadow-[0_20px_55px_rgba(26,26,26,0.07)] sm:p-6">
          <div data-tour="candidate-offers-page" className="mb-2 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]"><Gift size={12} /> Offer center</div>
          <h1 className="font-display text-2xl font-bold tracking-[-0.03em] text-[#1A1A1A] sm:text-3xl">Your offers</h1>
          <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">Review offers from employers and respond when you’re ready.</p>
        </div>

        <div className="mt-[-8px] grid grid-cols-2 gap-2 sm:mt-[-12px] sm:ml-auto sm:max-w-[220px]">
          <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A867E]">Pending</div><div className="mt-1 text-xl font-bold text-[#0B5C73]">{activeOffers.length}</div></div>
          <div className="rounded-2xl border border-white/80 bg-white/85 px-3 py-2.5 shadow-sm"><div className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#8A867E]">History</div><div className="mt-1 text-xl font-bold text-[#1A1A1A]">{historyOffers.length}</div></div>
        </div>

        {error && <div className="rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">{error}</div>}

        <div className="flex rounded-2xl border border-[#E9E7DE] bg-white p-1.5 shadow-[0_8px_22px_rgba(26,26,26,0.04)]">
          {(['pending', 'history'] as const).map((tab) => {
            const count = tab === 'pending' ? activeOffers.length : historyOffers.length;
            return (
              <button key={tab} type="button" onClick={() => setActiveTab(tab)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors ${activeTab === tab ? 'bg-[#1A1A1A] text-white shadow-sm' : 'text-[#5F5E5A] hover:bg-[#F1EFE8]'}`}>
                {tab === 'pending' ? 'Pending' : 'History'} <span className={activeTab === tab ? 'text-white/65' : 'text-[#B4B2A9]'}>({count})</span>
              </button>
            );
          })}
        </div>

        {visibleOffers.length === 0 ? (
          <div className="panel rounded-[28px] p-8 text-center">
            <Gift className="mx-auto text-[#1D9E75]" size={28} />
            <h2 className="mt-3 font-semibold text-[#1A1A1A]">{activeTab === 'pending' ? 'No pending offers' : 'No offer history yet'}</h2>
            <p className="mt-1 text-sm text-[#5F5E5A]">{activeTab === 'pending' ? 'New offers from employers will appear here when they are ready for your response.' : 'Accepted, declined, withdrawn, and expired offers will appear here.'}</p>
            {activeTab === 'pending' && offers.length === 0 && <Link to="/jobs" className="mt-4 inline-flex rounded-lg bg-[#1D9E75] px-4 py-2 text-sm font-semibold text-white">Browse jobs</Link>}
          </div>
        ) : (
          visibleOffers.map((offer) => {
            const job = jobs.get(offer.job_id);
            const isResponding = respondingOfferId === offer.id;
            const isExpanded = expandedOfferId === offer.id;
            return (
              <article key={offer.id} className={`rounded-[28px] border bg-white p-5 shadow-[0_14px_35px_rgba(26,26,26,0.05)] ${offer.status === 'sent' ? 'border-[#8FD3E8]' : 'border-[#E9E7DE]'}`}>
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
                 {offer.employer_message && <div className="mt-4 rounded-xl border border-[#D6EAF0] bg-[#F3FBFD] p-3 text-sm leading-relaxed text-[#0B5C73]"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em]">Message from employer</div><p className="whitespace-pre-wrap">{offer.employer_message}</p></div>}
                 {(documentsByOffer.get(offer.id) || []).length > 0 && offer.status !== 'expired' && (
                   <div className="mt-4 rounded-xl border border-line bg-[#FBFAF7] p-3">
                     <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Offer documents</div>
                     <div className="space-y-2">
                       {(documentsByOffer.get(offer.id) || []).map((document) => (
                         <button key={document.id} type="button" onClick={() => downloadDocument(document)} className="flex w-full items-center gap-3 rounded-lg border border-line bg-white px-3 py-2 text-left text-sm font-semibold text-ink hover:border-accent">
                           <FileText size={15} className="shrink-0 text-accent-deep" /><span className="min-w-0 flex-1 truncate">{document.file_name}</span><Download size={14} className="shrink-0 text-muted" />
                         </button>
                       ))}
                     </div>
                   </div>
                 )}
                  {offer.status === 'sent' && (documentsByOffer.get(offer.id) || []).some((document) => document.document_type === 'employer_offer') && (
                    <div className="mt-4 rounded-xl border border-dashed border-[#5DCAA5] bg-[#F3FBF7] p-3">
                      <div className="text-sm font-semibold text-[#085041]">Signed copy for acceptance</div>
                      <p className="mt-1 text-xs leading-relaxed text-[#5F5E5A]">Sign the document externally, then choose it here. It will be sent to the employer when you accept the offer.</p>
                      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[#5DCAA5] bg-white px-3 py-2 text-xs font-semibold text-[#085041] hover:bg-[#E1F5EE]">
                        <Upload size={13} /> {signedFile ? 'Choose a different file' : 'Choose signed document'}
                        <input type="file" accept="application/pdf,.pdf,.doc,.docx" className="sr-only" onChange={(event) => setSignedFile(event.target.files?.[0] || null)} />
                      </label>
                      {signedFile && <div className="mt-2 truncate text-xs font-semibold text-[#085041]">Selected: {signedFile.name}</div>}
                      {signedFile && <textarea value={signedMessage} onChange={(event) => setSignedMessage(event.target.value)} rows={2} placeholder="Optional message to the employer" className="mt-3 w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-xs outline-none focus:border-accent" />}
                      {(documentsByOffer.get(offer.id) || []).some((document) => document.document_type === 'candidate_signed') && !signedFile && <div className="mt-2 text-xs font-semibold text-[#085041]">A signed document has already been uploaded. Accept the offer to complete your response.</div>}
                      {uploadingSignedOfferId === offer.id && <div className="mt-2 text-xs font-semibold text-[#085041]">Uploading signed document...</div>}
                    </div>
                  )}

                {offer.status === 'sent' ? (isResponding ? (
                  <div className="mt-5 rounded-xl border border-[#8FD3E8] bg-[#FBFAF7] p-3">
                     {responseAction === 'declined' ? (
                       <textarea value={responseMessage} onChange={(event) => setResponseMessage(event.target.value)} rows={3} placeholder="Optional reason to share with the employer" className="w-full resize-none rounded-md border border-line bg-white p-2 text-sm outline-none focus:border-accent" />
                     ) : (
                       <p className="text-sm leading-relaxed text-[#5F5E5A]">Your signed document and its message will be sent to the employer with your acceptance.</p>
                     )}
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
        {activeTab === 'pending' && activeOffers.length > 0 && <p className="text-center text-xs text-[#8A8982]">You have {activeOffers.length} offer{activeOffers.length === 1 ? '' : 's'} awaiting a response.</p>}
      </div>
    </div>
  );
}

import { useEffect, useState } from 'react';
import { X, Send, Save, Ban, CheckCircle2, Clock3 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CandidateProfile, Job, JobApplication, Offer } from '../types';

type MakeOfferModalProps = {
  application: JobApplication & { job?: Job; candidate?: CandidateProfile | null };
  employerProfileId: string;
  onClose: () => void;
  onOfferSent: (applicationId: string) => void;
};

type FormState = {
  role_title: string;
  salary_amount: string;
  salary_currency: string;
  salary_period: string;
  start_date: string;
  work_arrangement: string;
  location: string;
  benefits_notes: string;
  expiry_date: string;
};

const CURRENCIES = ['NGN', 'USD', 'GBP', 'EUR'];
const PERIODS = ['year', 'month'];
const ARRANGEMENTS = ['Remote', 'Hybrid', 'On-site'];

function emptyForm(job?: Job): FormState {
  return {
    role_title: job?.title || '',
    salary_amount: '',
    salary_currency: 'NGN',
    salary_period: 'month',
    start_date: '',
    work_arrangement: '',
    location: '',
    benefits_notes: '',
    expiry_date: '',
  };
}

function formToOfferPayload(form: FormState) {
  return {
    role_title: form.role_title.trim(),
    salary_amount: form.salary_amount.trim() ? Number(form.salary_amount) : null,
    salary_currency: form.salary_currency,
    salary_period: form.salary_period,
    start_date: form.start_date || null,
    work_arrangement: form.work_arrangement || null,
    location: form.location.trim() || null,
    benefits_notes: form.benefits_notes.trim() || null,
    expiry_date: form.expiry_date || null,
  };
}

function offerToForm(offer: Offer): FormState {
  return {
    role_title: offer.role_title,
    salary_amount: offer.salary_amount != null ? String(offer.salary_amount) : '',
    salary_currency: offer.salary_currency,
    salary_period: offer.salary_period,
    start_date: offer.start_date || '',
    work_arrangement: offer.work_arrangement || '',
    location: offer.location || '',
    benefits_notes: offer.benefits_notes || '',
    expiry_date: offer.expiry_date || '',
  };
}

function formatMoney(amount: number | null, currency: string, period: string) {
  if (amount == null) return 'Not specified';
  const formatted = new Intl.NumberFormat('en-NG', { maximumFractionDigits: 0 }).format(amount);
  return `${currency} ${formatted} / ${period}`;
}

export default function MakeOfferModal({ application, employerProfileId, onClose, onOfferSent }: MakeOfferModalProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [existingOffer, setExistingOffer] = useState<Offer | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm(application.job));

  const candidateProfileId = application.candidate_profile_id;

  useEffect(() => {
    let alive = true;

    async function loadOffer() {
      setLoading(true);
      setError('');
      try {
        const { data, error: fetchError } = await supabase
          .from('offers')
          .select('*')
          .eq('application_id', application.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (fetchError) throw fetchError;
        if (!alive) return;

        const offer = (data || null) as Offer | null;
        setExistingOffer(offer);
        if (offer && offer.status === 'draft') {
          setForm(offerToForm(offer));
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load offer.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadOffer();
    return () => {
      alive = false;
    };
  }, [application.id]);

  const updateField = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const saveDraft = async (): Promise<Offer | null> => {
    if (!candidateProfileId) {
      setError('This applicant does not have a registered profile, so an offer cannot be created.');
      return null;
    }
    if (!form.role_title.trim()) {
      setError('Role title is required.');
      return null;
    }

    setSaving(true);
    setError('');
    try {
      const payload = formToOfferPayload(form);

      if (existingOffer && existingOffer.status === 'draft') {
        const { data, error: updateError } = await supabase
          .from('offers')
          .update(payload)
          .eq('id', existingOffer.id)
          .select('*')
          .single();
        if (updateError) throw updateError;
        const updated = data as Offer;
        setExistingOffer(updated);
        return updated;
      }

      const { data, error: insertError } = await supabase
        .from('offers')
        .insert({
          application_id: application.id,
          job_id: application.job_id,
          employer_profile_id: employerProfileId,
          candidate_profile_id: candidateProfileId,
          status: 'draft',
          ...payload,
        })
        .select('*')
        .single();
      if (insertError) throw insertError;
      const created = data as Offer;
      setExistingOffer(created);
      return created;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save offer draft.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    await saveDraft();
  };

  const handleSend = async () => {
    setError('');
    if (!form.salary_amount.trim()) {
      setError('Add a salary amount before sending the offer.');
      return;
    }
    const draft = await saveDraft();
    if (!draft) return;

    setSaving(true);
    try {
      const { data, error: sendError } = await supabase
        .from('offers')
        .update({ status: 'sent' })
        .eq('id', draft.id)
        .select('*')
        .single();
      if (sendError) throw sendError;
      setExistingOffer(data as Offer);
      onOfferSent(application.id);
    } catch (sendErr) {
      setError(sendErr instanceof Error ? sendErr.message : 'Could not send offer.');
    } finally {
      setSaving(false);
    }
  };

  const handleWithdraw = async () => {
    if (!existingOffer) return;
    setSaving(true);
    setError('');
    try {
      const { data, error: withdrawError } = await supabase
        .from('offers')
        .update({ status: 'withdrawn' })
        .eq('id', existingOffer.id)
        .select('*')
        .single();
      if (withdrawError) throw withdrawError;
      setExistingOffer(data as Offer);
    } catch (withdrawErr) {
      setError(withdrawErr instanceof Error ? withdrawErr.message : 'Could not withdraw offer.');
    } finally {
      setSaving(false);
    }
  };

  const isReadOnly = Boolean(existingOffer) && existingOffer!.status !== 'draft';
  const isSent = existingOffer?.status === 'sent';
  const isResolved = existingOffer && ['accepted', 'declined', 'withdrawn', 'expired'].includes(existingOffer.status);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-panel bg-white shadow-card-hover">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">
              {isSent ? 'Offer sent' : isResolved ? 'Offer letter' : 'Make an offer'}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {application.applicant_name} · {application.job?.title || 'Unknown job'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted transition-colors duration-200 hover:bg-[#F1EFE8] hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {loading ? (
            <div className="py-8 text-center text-sm text-muted">Loading...</div>
          ) : !candidateProfileId ? (
            <div className="rounded-xl border border-line bg-[#F1EFE8] px-4 py-3 text-sm text-muted">
              This applicant does not have a registered candidate profile, so an in-site offer letter can't be created for them.
            </div>
          ) : (
            <>
              {isSent && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-[#8FD3E8] bg-[#E3F5FB] px-3 py-2 text-sm text-[#0B5C73]">
                  <Clock3 size={14} /> Awaiting the candidate's response.
                </div>
              )}
              {existingOffer?.status === 'accepted' && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-pill-green-border bg-pill-green-bg px-3 py-2 text-sm text-pill-green-text">
                  <CheckCircle2 size={14} /> Candidate accepted this offer.
                </div>
              )}
              {existingOffer?.status === 'declined' && (
                <div className="mb-4 flex items-center gap-2 rounded-xl border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">
                  <Ban size={14} /> Candidate declined this offer.
                </div>
              )}
              {existingOffer?.status === 'withdrawn' && (
                <div className="mb-4 rounded-xl border border-line bg-[#F1EFE8] px-3 py-2 text-sm text-muted">
                  This offer was withdrawn.
                </div>
              )}
              {existingOffer?.response_message && (
                <div className="mb-4">
                  <div className="mb-1 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">Candidate message</div>
                  <p className="whitespace-pre-wrap text-sm text-ink">{existingOffer.response_message}</p>
                </div>
              )}

              {isReadOnly ? (
                <div className="flex flex-col gap-3">
                  <ReadRow label="Role" value={existingOffer!.role_title} />
                  <ReadRow
                    label="Compensation"
                    value={formatMoney(existingOffer!.salary_amount, existingOffer!.salary_currency, existingOffer!.salary_period)}
                  />
                  {existingOffer!.start_date && <ReadRow label="Start date" value={existingOffer!.start_date} />}
                  {existingOffer!.work_arrangement && <ReadRow label="Work arrangement" value={existingOffer!.work_arrangement} />}
                  {existingOffer!.location && <ReadRow label="Location" value={existingOffer!.location} />}
                  {existingOffer!.expiry_date && <ReadRow label="Offer expires" value={existingOffer!.expiry_date} />}
                  {existingOffer!.benefits_notes && (
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">Benefits &amp; notes</div>
                      <p className="whitespace-pre-wrap text-sm text-ink">{existingOffer!.benefits_notes}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <Field label="Role title">
                    <input
                      value={form.role_title}
                      onChange={(e) => updateField('role_title', e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </Field>

                  <div className="grid grid-cols-3 gap-3">
                    <Field label="Salary amount" className="col-span-1">
                      <input
                        type="number"
                        min="0"
                        value={form.salary_amount}
                        onChange={(e) => updateField('salary_amount', e.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </Field>
                    <Field label="Currency">
                      <select
                        value={form.salary_currency}
                        onChange={(e) => updateField('salary_currency', e.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Per">
                      <select
                        value={form.salary_period}
                        onChange={(e) => updateField('salary_period', e.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        {PERIODS.map((p) => (
                          <option key={p} value={p}>
                            {p}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Field label="Start date">
                      <input
                        type="date"
                        value={form.start_date}
                        onChange={(e) => updateField('start_date', e.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                      />
                    </Field>
                    <Field label="Work arrangement">
                      <select
                        value={form.work_arrangement}
                        onChange={(e) => updateField('work_arrangement', e.target.value)}
                        className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                      >
                        <option value="">Not specified</option>
                        {ARRANGEMENTS.map((a) => (
                          <option key={a} value={a}>
                            {a}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>

                  <Field label="Location">
                    <input
                      value={form.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="e.g. Lagos, Nigeria"
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </Field>

                  <Field label="Offer expires">
                    <input
                      type="date"
                      value={form.expiry_date}
                      onChange={(e) => updateField('expiry_date', e.target.value)}
                      className="w-full rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </Field>

                  <Field label="Benefits & notes">
                    <textarea
                      value={form.benefits_notes}
                      onChange={(e) => updateField('benefits_notes', e.target.value)}
                      rows={3}
                      placeholder="Health insurance, equity, relocation support..."
                      className="w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm outline-none focus:border-accent"
                    />
                  </Field>
                </div>
              )}

              {error && (
                <div className="mt-4 rounded-lg border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">
                  {error}
                </div>
              )}
            </>
          )}
        </div>

        {candidateProfileId && !loading && (
          <div className="flex flex-wrap justify-end gap-2 border-t border-line px-6 py-4">
            {isSent ? (
              <button
                onClick={handleWithdraw}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-[#B3261E] transition-colors duration-200 hover:border-[#B3261E] hover:bg-[#FAECE7] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Ban size={14} /> {saving ? 'Withdrawing...' : 'Withdraw offer'}
              </button>
            ) : !isReadOnly ? (
              <>
                <button
                  onClick={handleSaveDraft}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Save size={14} /> Save draft
                </button>
                <button
                  onClick={handleSend}
                  disabled={saving}
                  className="inline-flex items-center justify-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send size={14} /> {saving ? 'Sending...' : 'Send offer'}
                </button>
              </>
            ) : (
              <button
                onClick={onClose}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
              >
                Close
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className || ''}`}>
      <span className="text-[11px] font-bold uppercase tracking-[1.6px] text-faint">{label}</span>
      {children}
    </label>
  );
}

function ReadRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="text-faint">{label}</span>
      <span className="text-right font-medium text-ink">{value}</span>
    </div>
  );
}
import { useState } from 'react';
import { CheckCircle2, FileText, Send, Upload, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { CandidateProfile, Job, JobApplication, Offer } from '../types';

type Props = {
  application: JobApplication & { job?: Job; candidate?: CandidateProfile | null };
  employerProfileId: string;
  onClose: () => void;
  onOfferSent: (applicationId: string) => void;
};

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ACCEPTED_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

function formatSize(size: number) {
  return size < 1024 * 1024 ? `${Math.ceil(size / 1024)} KB` : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

export default function SendOfferDocumentsModal({ application, employerProfileId, onClose, onOfferSent }: Props) {
  const [files, setFiles] = useState<File[]>([]);
  const [message, setMessage] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);

  const addFiles = (selected: FileList | null) => {
    if (!selected) return;
    const next = [...files];
    for (const file of Array.from(selected)) {
      if (!ACCEPTED_TYPES.has(file.type)) {
        setError('Only PDF, DOC, and DOCX files can be attached.');
        return;
      }
      if (file.size > MAX_FILE_SIZE) {
        setError(`${file.name} is larger than 10 MB.`);
        return;
      }
      if (!next.some((current) => current.name === file.name && current.size === file.size)) next.push(file);
    }
    setError('');
    setFiles(next);
  };

  const sendDocuments = async () => {
    if (!application.candidate_profile_id) {
      setError('This applicant does not have a registered candidate profile.');
      return;
    }
    if (!files.length) {
      setError('Attach at least one offer document.');
      return;
    }

    setSaving(true);
    setError('');
    let offer: Offer | null = null;
    try {
      const { data: created, error: createError } = await supabase
        .from('offers')
        .insert({
          application_id: application.id,
          job_id: application.job_id,
          employer_profile_id: employerProfileId,
          candidate_profile_id: application.candidate_profile_id,
          role_title: application.job?.title || 'Offer',
          salary_amount: null,
          salary_currency: 'NGN',
          salary_period: 'month',
          expiry_date: expiryDate || null,
          expires_at: expiryDate ? `${expiryDate}T23:59:59+01:00` : null,
          employer_message: message.trim() || null,
          status: 'draft',
        })
        .select('*')
        .single();
      if (createError) throw createError;
      offer = created as Offer;

      for (const [index, file] of files.entries()) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '-');
        const path = `${offer.id}/${crypto.randomUUID()}-${safeName}`;
        const { error: uploadError } = await supabase.storage.from('offer-documents').upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (uploadError) throw uploadError;

        const { error: documentError } = await supabase.from('offer_documents').insert({
          offer_id: offer.id,
          storage_path: path,
          file_name: file.name,
          mime_type: file.type,
          file_size: file.size,
          sort_order: index,
          document_type: 'employer_offer',
          uploaded_by: employerProfileId,
        });
        if (documentError) throw documentError;
      }

      const { error: sendError } = await supabase.from('offers').update({ status: 'sent' }).eq('id', offer.id).select('*').single();
      if (sendError) throw sendError;
      onOfferSent(application.id);
      setSent(true);
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send the offer documents.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-lg flex-col overflow-hidden rounded-panel bg-white shadow-card-hover">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">{sent ? 'Offer sent successfully' : 'Send offer documents'}</h2>
            <p className="mt-1 text-sm text-muted">{application.applicant_name} · {application.job?.title || 'Offer'}</p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-muted hover:bg-[#F1EFE8]" aria-label="Close"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {sent ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#E1F5EE] text-[#1D9E75]"><CheckCircle2 size={34} /></div>
              <h3 className="mt-5 text-xl font-bold text-ink">Your documents have been sent</h3>
              <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted">{files.length} document{files.length === 1 ? '' : 's'} were sent to {application.applicant_name}. They have also been notified by email.</p>
              {message.trim() && <div className="mt-4 w-full max-w-sm rounded-xl border border-line bg-paper p-3 text-left text-sm text-muted"><div className="mb-1 text-[10px] font-bold uppercase tracking-[0.14em] text-faint">Message included</div>{message}</div>}
            </div>
          ) : (
          <>
          <div className="rounded-xl border border-[#8FD3E8] bg-[#E3F5FB] p-4 text-sm text-[#0B5C73]">
            Upload the offer letter or supporting documents here. You do not need to retype the contents in the quick offer form.
          </div>

          <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-[#8FD3E8] bg-[#FBFAF7] px-4 py-7 text-center hover:border-[#1D9E75]">
            <Upload size={21} className="text-[#0B5C73]" />
            <span className="mt-2 text-sm font-semibold text-ink">Attach one or more documents</span>
            <span className="mt-1 text-xs text-muted">PDF, DOC, or DOCX · up to 10 MB each</span>
            <input type="file" multiple accept="application/pdf,.pdf,.doc,.docx" className="sr-only" onChange={(event) => addFiles(event.target.files)} />
          </label>

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              {files.map((file) => (
                <div key={`${file.name}-${file.size}`} className="flex items-center gap-3 rounded-xl border border-line bg-white px-3 py-2.5">
                  <FileText size={16} className="shrink-0 text-[#0B5C73]" />
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold text-ink">{file.name}</div><div className="text-xs text-muted">{formatSize(file.size)}</div></div>
                  <button type="button" onClick={() => setFiles((current) => current.filter((item) => item !== file))} className="rounded-full p-1 text-muted hover:bg-[#F1EFE8]" aria-label={`Remove ${file.name}`}><X size={15} /></button>
                </div>
              ))}
            </div>
          )}

          <label className="mt-4 block text-sm font-semibold text-ink">Message to candidate <span className="font-normal text-muted">(optional)</span>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} rows={4} placeholder="Add a note to accompany the documents..." className="mt-2 w-full resize-none rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal outline-none focus:border-accent" />
          </label>
          <label className="mt-4 block text-sm font-semibold text-ink">Response deadline <span className="font-normal text-muted">(optional)</span>
            <input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} className="mt-2 w-full rounded-lg border border-line bg-white px-3 py-2 text-sm font-normal outline-none focus:border-accent" />
          </label>

          {error && <div className="mt-4 rounded-lg border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">{error}</div>}
          </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-line px-6 py-4">
          {sent ? (
            <button type="button" onClick={onClose} className="rounded-lg bg-accent px-5 py-2 text-sm font-semibold text-white">Close</button>
          ) : (
            <>
              <button type="button" onClick={onClose} disabled={saving} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">Cancel</button>
              <button type="button" onClick={sendDocuments} disabled={saving} className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"><Send size={14} /> {saving ? 'Sending...' : 'Send documents'}</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

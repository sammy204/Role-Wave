import { useRef, useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { trackEvent } from '../lib/analytics';
import { TurnstileWidget } from './TurnstileWidget';
import type { TurnstileInstance } from '@marsidev/react-turnstile';

interface ReportJobModalProps {
  jobId: string;
  isOpen: boolean;
  onClose: () => void;
}

const REASONS = [
  { value: 'scam', label: 'This looks like a scam' },
  { value: 'spam', label: 'Spam or duplicate posting' },
  { value: 'inappropriate', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'other', label: 'Other' },
] as const;

type ReportReason = (typeof REASONS)[number]['value'];

export default function ReportJobModal({ jobId, isOpen, onClose }: ReportJobModalProps) {
  const [reason, setReason] = useState<ReportReason | ''>('');
  const [details, setDetails] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const turnstileRef = useRef<TurnstileInstance>(null);

  if (!isOpen) return null;

  const handleClose = () => {
    if (submitting) return;
    setReason('');
    setDetails('');
    setCaptchaToken('');
    setSubmitting(false);
    setSubmitted(false);
    setError('');
    turnstileRef.current?.reset();
    onClose();
  };

  const handleSubmit = async () => {
    if (!reason) {
      setError('Please select a reason.');
      return;
    }

    if (!captchaToken) {
      setError('Please complete the security check.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setError('Please sign in before reporting a job.');
        return;
      }

      const { data: verification, error: verificationError } = await supabase.functions.invoke('verify-turnstile', {
        body: {
          token: captchaToken,
          action: 'job_report',
        },
      });

      if (verificationError || !verification?.success) {
        throw new Error('Security verification failed. Please try again.');
      }

      const { error: insertError } = await supabase.from('reports').insert({
        reporter_profile_id: user.id,
        target_type: 'job',
        target_id: jobId,
        reason,
        details: details.trim() || null,
      });

      if (insertError) throw insertError;
      void trackEvent('report_submitted', { target_type: 'job', reason });
      setSubmitted(true);
    } catch (submitError) {
      console.error('Job report submission failed:', submitError);
      setError(submitError instanceof Error ? submitError.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
      setCaptchaToken('');
      turnstileRef.current?.reset();
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 px-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-labelledby="report-job-title" onClick={handleClose}>
      <div className="w-full max-w-md rounded-[28px] border border-white/70 bg-[#FBFAF7] p-6 shadow-[0_24px_80px_rgba(26,26,26,0.2)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FAECE7] text-[#B3261E]"><AlertTriangle size={21} /></div>
            <div>
              <h2 id="report-job-title" className="text-lg font-bold text-[#1A1A1A]">Report this job</h2>
              <p className="mt-1 text-sm text-[#5F5E5A]">Help us keep RoleWave safe and trustworthy.</p>
            </div>
          </div>
          <button type="button" onClick={handleClose} aria-label="Close report dialog" className="rounded-full p-1 text-[#8A867E] hover:bg-white hover:text-[#1A1A1A]"><X size={18} /></button>
        </div>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F5EE] text-[#0F6E56]">✓</div>
            <p className="mt-4 font-semibold text-[#1A1A1A]">Thanks for letting us know.</p>
            <p className="mt-1 text-sm text-[#5F5E5A]">We’ll review this listing shortly.</p>
            <button type="button" onClick={handleClose} className="mt-5 rounded-xl bg-[#1D9E75] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[#168a63]">Close</button>
          </div>
        ) : (
          <>
            <fieldset className="mt-6 space-y-2">
              <legend className="mb-3 text-xs font-bold uppercase tracking-[1px] text-[#8A867E]">Why are you reporting it?</legend>
              {REASONS.map((item) => (
                <label key={item.value} className="flex cursor-pointer items-center gap-3 rounded-xl border border-[#D3D1C7] bg-white px-3.5 py-3 text-sm text-[#3D3D3A] transition-colors hover:border-[#5DCAA5]">
                  <input type="radio" name="report-job-reason" value={item.value} checked={reason === item.value} onChange={() => setReason(item.value)} className="h-4 w-4 accent-[#1D9E75]" />
                  {item.label}
                </label>
              ))}
            </fieldset>

            <label className="mt-5 block text-xs font-bold uppercase tracking-[1px] text-[#8A867E]" htmlFor="report-job-details">Additional details <span className="font-normal normal-case tracking-normal">(optional)</span></label>
            <textarea id="report-job-details" value={details} onChange={(event) => setDetails(event.target.value)} rows={3} maxLength={1000} placeholder="Tell us what looks wrong..." className="mt-2 w-full resize-none rounded-xl border border-[#D3D1C7] bg-white px-3 py-2.5 text-sm text-[#1A1A1A] outline-none placeholder:text-[#B4B2A9] focus:border-[#1D9E75]" />
            <TurnstileWidget
              ref={turnstileRef}
              onVerify={setCaptchaToken}
              onExpire={() => setCaptchaToken('')}
              action="job_report"
            />
            {error && <p className="mt-3 text-sm text-[#B3261E]" role="alert">{error}</p>}

            <div className="mt-6 flex justify-end gap-2">
              <button type="button" onClick={handleClose} disabled={submitting} className="rounded-xl border border-[#D3D1C7] bg-white px-4 py-2.5 text-sm font-semibold text-[#5F5E5A] hover:bg-[#F1EFE8] disabled:opacity-50">Cancel</button>
              <button type="button" onClick={() => void handleSubmit()} disabled={submitting || !captchaToken} className="rounded-xl bg-[#B3261E] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#922018] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? 'Submitting...' : 'Submit report'}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

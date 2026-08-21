import { FileText, Gift, X } from 'lucide-react';
import type { CandidateProfile, Job, JobApplication } from '../types';

type Props = {
  application: JobApplication & { job?: Job; candidate?: CandidateProfile | null };
  onClose: () => void;
  onMakeOffer: () => void;
  onSendDocuments: () => void;
  showQuickOffer?: boolean;
};

export default function OfferActionModal({ application, onClose, onMakeOffer, onSendDocuments, showQuickOffer = true }: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg rounded-panel bg-white shadow-card-hover">
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div>
            <h2 className="font-serif text-lg font-semibold text-ink">Choose an offer method</h2>
            <p className="mt-1 text-sm text-muted">{application.applicant_name} · {application.job?.title || 'Unknown job'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted transition-colors hover:bg-[#F1EFE8] hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className={`grid gap-3 px-6 py-6 ${showQuickOffer ? 'sm:grid-cols-2' : ''}`}>
          {showQuickOffer && (
            <button
              type="button"
              onClick={onMakeOffer}
              className="group rounded-2xl border border-line bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#5DCAA5] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
            >
              <Gift size={20} className="text-accent-deep" />
              <span className="mt-4 block text-sm font-semibold text-ink">Create quick offer</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted">Enter the role, salary, start date, and terms in RoleWave.</span>
            </button>
          )}
          <button
            type="button"
            onClick={onSendDocuments}
            className="group rounded-2xl border border-line bg-white p-5 text-left transition-all hover:-translate-y-0.5 hover:border-[#8FD3E8] hover:shadow-[0_10px_28px_rgba(26,26,26,0.06)]"
          >
            <FileText size={20} className="text-[#0B5C73]" />
            <span className="mt-4 block text-sm font-semibold text-ink">Send documents</span>
            <span className="mt-1 block text-xs leading-relaxed text-muted">Upload an existing offer letter or supporting documents.</span>
          </button>
        </div>

        <div className="flex justify-end border-t border-line px-6 py-4">
          <button type="button" onClick={onClose} className="rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

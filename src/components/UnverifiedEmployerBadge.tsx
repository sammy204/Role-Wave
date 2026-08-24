import { AlertTriangle } from 'lucide-react';

export default function UnverifiedEmployerBadge({ verified }: { verified: boolean }) {
  if (verified) return null;

  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#F0D080] bg-[#FFF8E6] px-2 py-0.5 text-[10px] font-semibold text-[#7A5000]" title="This employer has not been verified by RoleWave">
      <AlertTriangle size={11} /> New employer · unverified
    </span>
  );
}

import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

type EmptyStateProps = {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
};

export default function EmptyState({ icon: Icon, title, description, action, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center justify-center px-6 py-14 text-center ${className}`.trim()}>
      {Icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#E1F5EE] text-[#1D9E75]"><Icon size={22} aria-hidden="true" /></div>}
      <h2 className="text-base font-semibold text-[#1A1A1A]">{title}</h2>
      {description && <p className="mt-2 max-w-md text-sm leading-relaxed text-[#5F5E5A]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

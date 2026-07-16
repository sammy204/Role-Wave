import { Loader2 } from 'lucide-react';

type LoadingSpinnerProps = {
  className?: string;
  size?: number;
  label?: string;
};

export default function LoadingSpinner({
  className = '',
  size = 24,
  label = 'Loading',
}: LoadingSpinnerProps) {
  return (
    <Loader2
      role="status"
      aria-label={label}
      size={size}
      className={`animate-spin ${className}`.trim()}
    />
  );
}

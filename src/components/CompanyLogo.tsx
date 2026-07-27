import type { Company } from '../types';

const avatarColorMap: Record<Company['avatar_color'], string> = {
  teal: 'bg-accent-deep',
  blue: 'bg-[#0C447C]',
  amber: 'bg-[#96690A]',
  purple: 'bg-[#5B4088]',
  coral: 'bg-[#A6432B]',
};

type CompanyLogoProps = {
  company: Pick<Company, 'logo_url' | 'logo_initials' | 'avatar_color'> | null | undefined;
  size?: number;
  radiusClassName?: string;
  textClassName?: string;
  className?: string;
  /** Override the fallback initials styling (e.g. a lighter tint chip). Defaults to the solid brand-color avatar. */
  fallbackClassName?: string;
  /** Tailwind width/height classes (e.g. responsive sizing). When set, takes precedence over `size`. */
  sizeClassName?: string;
};

export default function CompanyLogo({
  company,
  size = 44,
  radiusClassName = 'rounded-xl',
  textClassName = 'text-sm',
  className = '',
  fallbackClassName,
  sizeClassName,
}: CompanyLogoProps) {
  const style = sizeClassName ? undefined : { width: size, height: size };
  const sizingClasses = sizeClassName || '';

  if (company?.logo_url) {
    return (
      <img
        src={company.logo_url}
        alt=""
        style={style}
        className={`shrink-0 border border-line bg-white object-contain ${radiusClassName} ${sizingClasses} ${className}`}
      />
    );
  }

  const colorClass = fallbackClassName ?? `text-white ${avatarColorMap[company?.avatar_color || 'teal']}`;

  return (
    <div
      style={style}
      className={`flex shrink-0 items-center justify-center font-bold ${colorClass} ${radiusClassName} ${textClassName} ${sizingClasses} ${className}`}
    >
      {company?.logo_initials || '??'}
    </div>
  );
}
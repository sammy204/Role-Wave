import { Link } from 'react-router-dom';
import { Star, BadgeCheck } from 'lucide-react';
import type { Job, Company } from '../types';

interface JobCardProps {
  job: Job & { company?: Company };
}

const colorMap: Record<string, { bg: string; text: string }> = {
  teal: { bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  blue: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
  amber: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  purple: { bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
  coral: { bg: 'bg-[#FAECE7]', text: 'text-[#712B13]' },
};

const workTypeColors: Record<string, string> = {
  Remote: 'bg-[#E1F5EE] text-[#085041]',
  Hybrid: 'bg-[#E6F1FB] text-[#0C447C]',
  'On-site': 'bg-[#FAEEDA] text-[#633806]',
};

function timeAgo(date: string): string {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 86400) return 'Today';
  if (diff < 172800) return '1 day ago';
  if (diff < 604800) return `${Math.floor(diff / 86400)} days ago`;
  if (diff < 2592000) return `${Math.floor(diff / 604800)} weeks ago`;
  return `${Math.floor(diff / 2592000)} months ago`;
}

function isNew(date: string): boolean {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  return diff < 3 * 86400 * 1000;
}

export default function JobCard({ job }: JobCardProps) {
  const company = job.company;
  const color = company ? colorMap[company.avatar_color] || colorMap.teal : colorMap.teal;
  const isFeatured = job.featured;

  return (
    <Link
      to={`/jobs/${job.slug}`}
      className={`group flex gap-3 sm:gap-4 items-start rounded-2xl border bg-white p-4 sm:p-5 transition-all duration-200 hover:-translate-y-[2px] hover:border-[#5DCAA5] hover:shadow-[0_16px_34px_rgba(29,158,117,0.08)] cursor-pointer ${
        isFeatured ? 'border-[#5DCAA5]' : 'border-[#D3D1C7]'
      }`}
    >
      <div
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[14px] flex-shrink-0 flex items-center justify-center text-[11px] sm:text-[13px] font-bold ring-1 ring-black/5 ${color.bg} ${color.text}`}
      >
        {company?.logo_initials || '??'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0 pr-2">
            <div className="text-[15px] sm:text-[16px] font-semibold text-[#1A1A1A] truncate group-hover:text-[#085041]">
              {job.title}
            </div>
            <div className="mt-0.5 flex items-center gap-1 text-xs sm:text-[13px] text-[#5F5E5A]">
              <span className="truncate">
                {company?.name || 'Unknown'} · {job.location}
              </span>
              {company?.verified && (
                <BadgeCheck size={13} className="flex-shrink-0 text-[#1D9E75]" aria-label="Verified employer" />
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isFeatured && (
              <span className="hidden sm:flex items-center gap-1 rounded-full border border-[#F0D080] bg-[#FFF8E6] px-[9px] py-[3px] text-[11px] font-semibold whitespace-nowrap text-[#7A5000]">
                <Star size={10} /> Featured
              </span>
            )}
            {isNew(job.created_at) && (
              <span className="rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2 sm:px-[9px] py-[3px] text-[10px] sm:text-[11px] font-semibold whitespace-nowrap text-[#085041]">
                New
              </span>
            )}
          </div>
        </div>

        <div className="mt-2.5 flex flex-wrap gap-2 sm:mt-3">
          <span
            className={`rounded-full px-2.5 py-[4px] text-[10px] sm:text-xs font-semibold ${
              workTypeColors[job.work_type] || 'bg-[#F1EFE8] text-[#5F5E5A]'
            }`}
          >
            {job.work_type}
          </span>
          <span className="rounded-full bg-[#F1EFE8] px-2.5 py-[4px] text-[10px] sm:text-xs font-semibold text-[#5F5E5A]">
            {job.job_type}
          </span>
          {job.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="hidden rounded-full bg-[#F1EFE8] px-[10px] py-[4px] text-xs font-semibold text-[#5F5E5A] sm:inline"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden shrink-0 self-start whitespace-nowrap pt-0.5 text-[11px] text-[#B4B2A9] sm:block">
        {timeAgo(job.created_at)}
      </div>
    </Link>
  );
}
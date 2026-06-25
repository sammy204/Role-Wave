import { Link } from 'react-router-dom';
import { Star } from 'lucide-react';
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
      className={`flex gap-3 sm:gap-4 items-start p-4 sm:p-5 bg-white rounded-xl border transition-all hover:border-[#5DCAA5] hover:shadow-[0_2px_12px_rgba(29,158,117,0.08)] cursor-pointer ${
        isFeatured ? 'border-[#5DCAA5]' : 'border-[#D3D1C7]'
      }`}
    >
      <div
        className={`w-10 h-10 sm:w-11 sm:h-11 rounded-[10px] flex-shrink-0 flex items-center justify-center text-[11px] sm:text-[13px] font-bold ${color.bg} ${color.text}`}
      >
        {company?.logo_initials || '??'}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between mb-1">
          <div className="min-w-0 pr-2">
            <div className="text-sm sm:text-[15px] font-semibold text-[#1A1A1A] truncate">{job.title}</div>
            <div className="text-xs sm:text-[13px] text-[#5F5E5A]">
              {company?.name || 'Unknown'} · {job.location}
            </div>
          </div>
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {isFeatured && (
              <span className="hidden sm:flex items-center gap-1 text-[11px] font-semibold bg-[#FFF8E6] text-[#7A5000] px-[9px] py-[3px] rounded-[10px] border border-[#F0D080] whitespace-nowrap">
                <Star size={10} /> Featured
              </span>
            )}
            {isNew(job.created_at) && (
              <span className="text-[10px] sm:text-[11px] font-semibold bg-[#E1F5EE] text-[#085041] px-2 sm:px-[9px] py-[3px] rounded-[10px] border border-[#5DCAA5] whitespace-nowrap">
                New
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-[6px] flex-wrap mt-2 sm:mt-2.5">
          <span
            className={`text-[10px] sm:text-xs px-2 sm:px-[10px] py-[3px] rounded-[10px] font-medium ${
              workTypeColors[job.work_type] || 'bg-[#F1EFE8] text-[#5F5E5A]'
            }`}
          >
            {job.work_type}
          </span>
          <span className="text-[10px] sm:text-xs px-2 sm:px-[10px] py-[3px] rounded-[10px] font-medium bg-[#F1EFE8] text-[#5F5E5A]">
            {job.job_type}
          </span>
          {job.tags?.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="hidden sm:inline text-xs px-[10px] py-[3px] rounded-[10px] font-medium bg-[#F1EFE8] text-[#5F5E5A]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>

      <div className="hidden sm:block text-[11px] text-[#B4B2A9] flex-shrink-0 self-start whitespace-nowrap ml-2">
        {timeAgo(job.created_at)}
      </div>
    </Link>
  );
}

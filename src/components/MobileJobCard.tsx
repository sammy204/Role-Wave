import { Link } from 'react-router-dom';
import type { Job, Company } from '../types';

interface MobileJobCardProps {
  job: Job & { company?: Company };
}

const colorMap: Record<string, { bg: string; text: string }> = {
  teal: { bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  blue: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
  amber: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  purple: { bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
  coral: { bg: 'bg-[#FAECE7]', text: 'text-[#712B13]' },
};

const tagColors: Record<string, string> = {
  Remote: 'bg-[#E1F5EE] text-[#085041]',
  Hybrid: 'bg-[#E6F1FB] text-[#0C447C]',
  'On-site': 'bg-[#FAEEDA] text-[#633806]',
  Internship: 'bg-[#EEEDFE] text-[#3C3489]',
};

function isNew(date: string): boolean {
  const now = new Date();
  const then = new Date(date);
  const diff = now.getTime() - then.getTime();
  return diff < 3 * 86400 * 1000;
}

export default function MobileJobCard({ job }: MobileJobCardProps) {
  const company = job.company;
  const color = company ? colorMap[company.avatar_color] || colorMap.teal : colorMap.teal;
  const isFeatured = job.featured;

  return (
    <Link
      to={`/jobs/${job.slug}`}
      className={`mx-3 mb-2 block rounded-[18px] border bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.04)] ${
        isFeatured ? 'border-[#5DCAA5]' : 'border-[#D3D1C7]'
      }`}
    >
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {isFeatured && (
            <span className="rounded-full bg-[#FFF8E6] px-2 py-1 text-[10px] font-semibold text-[#7A5000]">
              Featured
            </span>
          )}
          {isNew(job.created_at) && (
            <span className="rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2 py-1 text-[10px] font-semibold text-[#085041]">
              New
            </span>
          )}
        </div>
      </div>

      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="flex items-center gap-[10px]">
          <div
            className={`flex h-[38px] w-[38px] items-center justify-center rounded-xl text-[11px] font-bold ring-1 ring-black/5 ${color.bg} ${color.text}`}
          >
            {job.company?.logo_initials || '??'}
          </div>
          <div>
            <div className="text-[14px] font-semibold text-[#1A1A1A]">{job.title}</div>
            <div className="text-[11px] text-[#5F5E5A]">
              {company?.name || 'Unknown'} · {job.location}
            </div>
          </div>
        </div>
      </div>

      <div className="mb-2 flex gap-3 text-[10px] text-[#5F5E5A]">
        <span>{job.location}</span>
        <span>{job.job_type}</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <span className={`rounded-full px-2 py-[3px] text-[10px] font-semibold ${tagColors[job.work_type] || 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>
          {job.work_type}
        </span>
        {job.tags?.slice(0, 2).map((tag) => (
          <span key={tag} className="rounded-full bg-[#F1EFE8] px-2 py-[3px] text-[10px] font-semibold text-[#5F5E5A]">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

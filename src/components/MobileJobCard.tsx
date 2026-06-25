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
      className={`block mx-3 mb-2 p-3 bg-white rounded-[14px] border ${
        isFeatured ? 'border-[#5DCAA5]' : 'border-[#D3D1C7]'
      }`}
    >
      {isFeatured && (
        <div className="flex items-center gap-[5px] mb-2">
          <div className="w-[5px] h-[5px] rounded-full bg-[#1D9E75]" />
          <span className="text-[10px] text-[#085041] font-semibold">Featured</span>
        </div>
      )}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-[9px]">
          <div className={`w-[34px] h-[34px] rounded-lg flex items-center justify-center text-[11px] font-bold ${color.bg} ${color.text}`}>
            {company?.logo_initials || '??'}
          </div>
          <div>
            <div className="text-[13px] font-semibold text-[#1A1A1A]">{job.title}</div>
            <div className="text-[11px] text-[#5F5E5A]">{company?.name || 'Unknown'} · {job.location}</div>
          </div>
        </div>
        {isNew(job.created_at) && (
          <span className="text-[10px] bg-[#E1F5EE] text-[#085041] px-2 py-[3px] rounded-[10px] border border-[#5DCAA5] font-semibold whitespace-nowrap">
            New
          </span>
        )}
      </div>
      <div className="flex gap-[10px] mb-2">
        <span className="text-[10px] text-[#B4B2A9] flex items-center gap-[3px]">
          <span>📍</span> {job.location}
        </span>
        <span className="text-[10px] text-[#B4B2A9] flex items-center gap-[3px]">
          <span>💼</span> {job.job_type}
        </span>
      </div>
      <div className="flex gap-[5px] flex-wrap">
        <span className={`text-[10px] px-2 py-[3px] rounded-[10px] font-medium ${tagColors[job.work_type] || 'bg-[#F1EFE8] text-[#5F5E5A]'}`}>
          {job.work_type}
        </span>
        {job.tags?.slice(0, 2).map((tag) => (
          <span key={tag} className="text-[10px] px-2 py-[3px] rounded-[10px] font-medium bg-[#F1EFE8] text-[#5F5E5A]">
            {tag}
          </span>
        ))}
      </div>
    </Link>
  );
}

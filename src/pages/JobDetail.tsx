import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Home, Briefcase, Clock, CheckCircle, Share2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import type { Job, Company } from '../types';

const colorMap: Record<string, { bg: string; text: string }> = {
  teal: { bg: 'bg-[#E1F5EE]', text: 'text-[#085041]' },
  blue: { bg: 'bg-[#E6F1FB]', text: 'text-[#0C447C]' },
  amber: { bg: 'bg-[#FAEEDA]', text: 'text-[#633806]' },
  purple: { bg: 'bg-[#EEEDFE]', text: 'text-[#3C3489]' },
  coral: { bg: 'bg-[#FAECE7]', text: 'text-[#712B13]' },
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

export default function JobDetail() {
  const { slug } = useParams<{ slug: string }>();
  const [job, setJob] = useState<(Job & { company?: Company }) | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCopied, setShowCopied] = useState(false);
  const FETCH_TIMEOUT_MS = 10000;

  useEffect(() => {
    async function fetchJob() {
      if (!slug) return;
      setLoading(true);
      setError('');

      try {
        const { data: data, error: jobError } = await withTimeout(
          supabase
            .from('jobs')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'active')
            .maybeSingle(),
          FETCH_TIMEOUT_MS,
          'Job query'
        );

        if (jobError) throw jobError;
        if (!data) return;

        const { data: companyData, error: companyError } = await withTimeout(
          supabase.from('companies').select('*').eq('id', data.company_id).maybeSingle(),
          FETCH_TIMEOUT_MS,
          'Company query'
        );
        if (companyError) throw companyError;

        setJob({ ...(data as Job), company: companyData || undefined });
      } catch (fetchError) {
        setError(fetchError instanceof Error ? fetchError.message : 'Failed to load job details.');
      } finally {
        setLoading(false);
      }
    }

    fetchJob();
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F1EFE8]">
        <div className="text-[#5F5E5A]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1EFE8] px-4">
        <div className="text-[#1A1A1A] text-xl font-semibold mb-2">Could not load job</div>
        <div className="text-[#5F5E5A] text-sm text-center max-w-md mb-4">{error}</div>
        <Link to="/jobs" className="text-[#1D9E75] hover:underline">
          Browse all jobs
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F1EFE8] px-4">
        <div className="text-[#1A1A1A] text-xl font-semibold mb-2">Job not found</div>
        <Link to="/jobs" className="text-[#1D9E75] hover:underline">
          Browse all jobs
        </Link>
      </div>
    );
  }

  const company = job.company;
  const color = company ? colorMap[company.avatar_color] || colorMap.teal : colorMap.teal;

  const requirements = job.requirements
    ? job.requirements.split('\n').filter((r) => r.trim().length > 0)
    : [];
  const whatYoullDo = job.what_youll_do
    ? job.what_youll_do.split('\n').filter((r) => r.trim().length > 0)
    : [];

  return (
    <div className="min-h-screen flex flex-col bg-[#F1EFE8]">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] flex-1">
        <div className="px-4 sm:px-10 py-6 sm:py-8 lg:border-r border-[#D3D1C7]">
          <Link
            to="/jobs"
            className="inline-flex items-center gap-1 text-[13px] text-[#5F5E5A] hover:text-[#1A1A1A] mb-4 sm:mb-6 transition-colors"
          >
            <ArrowLeft size={14} /> Back to jobs
          </Link>

          <div className="flex items-center gap-3 sm:gap-3.5 mb-4">
            <div
              className={`w-12 h-12 sm:w-14 sm:h-14 rounded-xl sm:rounded-[14px] flex items-center justify-center text-[15px] sm:text-[17px] font-bold ${color.bg} ${color.text}`}
            >
              {company?.logo_initials || '??'}
            </div>
            <div>
              <h2 className="text-lg sm:text-[22px] font-bold text-[#1A1A1A] mb-0.5">{job.title}</h2>
              <p className="text-xs sm:text-sm text-[#5F5E5A]">
                {company?.name || 'Unknown'} · {job.location}
              </p>
            </div>
          </div>

          {company?.verified && (
            <div className="inline-flex items-center gap-[5px] bg-[#E1F5EE] text-[#085041] text-xs font-semibold px-3 py-[5px] rounded-[10px] mb-4 sm:mb-5">
              <CheckCircle size={12} /> Verified by Career Connect
            </div>
          )}

          <div className="flex gap-2 flex-wrap mb-6 sm:mb-7">
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[10px] font-medium bg-[#E1F5EE] text-[#085041]">
              <MapPin size={12} /> {job.location}
            </span>
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[10px] font-medium bg-[#E1F5EE] text-[#085041]">
              <Home size={12} /> {job.work_type}
            </span>
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[10px] font-medium bg-[#F1EFE8] text-[#5F5E5A]">
              <Briefcase size={12} /> {job.job_type}
            </span>
            <span className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-[10px] font-medium bg-[#F1EFE8] text-[#5F5E5A]">
              <Clock size={12} /> Posted {timeAgo(job.created_at)}
            </span>
          </div>

          <div className="mb-6">
            <h3 className="text-xs font-bold text-[#B4B2A9] tracking-[1px] uppercase mb-3">
              About this role
            </h3>
            {job.description.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-[#5F5E5A] leading-[1.7] mb-2">
                {para}
              </p>
            ))}
          </div>

          {whatYoullDo.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#B4B2A9] tracking-[1px] uppercase mb-3">
                What you'll do
              </h3>
              {whatYoullDo.map((item, i) => (
                <div key={i} className="flex gap-2.5 items-start mb-2">
                  <div className="w-[5px] h-[5px] rounded-full bg-[#1D9E75] mt-[7px] flex-shrink-0" />
                  <div className="text-sm text-[#5F5E5A] leading-[1.5]">{item}</div>
                </div>
              ))}
            </div>
          )}

          {requirements.length > 0 && (
            <div className="mb-6">
              <h3 className="text-xs font-bold text-[#B4B2A9] tracking-[1px] uppercase mb-3">
                Requirements
              </h3>
              {requirements.map((item, i) => (
                <div key={i} className="flex gap-2.5 items-start mb-2">
                  <div className="w-[5px] h-[5px] rounded-full bg-[#1D9E75] mt-[7px] flex-shrink-0" />
                  <div className="text-sm text-[#5F5E5A] leading-[1.5]">{item}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 sm:px-6 py-6 sm:py-7 bg-white border-t lg:border-t-0 lg:border-l border-[#D3D1C7]">
          <div className="bg-[#1D9E75] rounded-xl p-5 mb-3.5">
            <h3 className="text-[15px] font-bold text-white mb-1">Ready to apply?</h3>
            <p className="text-xs text-white/65 mb-4">
              Takes about 5 minutes on the company's careers page.
            </p>
            <a
              href={job.company?.website || '#'}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-white text-[#1D9E75] py-3 rounded-lg text-sm font-bold text-center hover:bg-gray-50 transition-colors"
            >
              Apply for this role →
            </a>
            <button
              onClick={handleShare}
              className="w-full bg-transparent text-white/70 border border-white/25 py-2.5 rounded-lg text-[13px] mt-2 hover:bg-white/10 transition-colors flex items-center justify-center gap-2"
            >
              <Share2 size={14} /> {showCopied ? 'Copied!' : 'Share this job'}
            </button>
          </div>

          <div className="h-4" />

          <div className="flex justify-between py-2.5 border-b border-[#D3D1C7]">
            <span className="text-[13px] text-[#B4B2A9]">Location</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.location}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-[#D3D1C7]">
            <span className="text-[13px] text-[#B4B2A9]">Work type</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.work_type}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-[#D3D1C7]">
            <span className="text-[13px] text-[#B4B2A9]">Job type</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.job_type}</span>
          </div>
          <div className="flex justify-between py-2.5 border-b border-[#D3D1C7]">
            <span className="text-[13px] text-[#B4B2A9]">Posted</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{timeAgo(job.created_at)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Verified</span>
            <span className="text-[13px] font-medium text-[#1D9E75]">✓ Yes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

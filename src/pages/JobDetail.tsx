import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, MapPin, Home, Briefcase, Clock, CheckCircle, Share2, Send, Bookmark } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { withTimeout } from '../lib/withTimeout';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { isJobSaved, toggleSavedJob } from '../lib/savedJobs';
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
  const [candidateId, setCandidateId] = useState('');
  const [saved, setSaved] = useState(false);
  const FETCH_TIMEOUT_MS = 10000;
  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    async function fetchJob() {
      if (!slug) return;
      setLoading(true);
      setError('');

      try {
        const { data, error: jobError } = await withTimeout(
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

  useEffect(() => {
    let alive = true;

    async function loadCandidate() {
      if (authLoading) return;
      if (!session) return;

      const nextProfile = await fetchProfile(session.user.id);
      if (!alive) return;

      if (nextProfile?.account_type !== 'candidate') return;

      setCandidateId(session.user.id);
    }

    loadCandidate();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  useEffect(() => {
    if (!candidateId || !job) return;
    setSaved(isJobSaved(candidateId, job.id));
  }, [candidateId, job]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center">
        <div className="panel rounded-2xl px-4 py-3 text-center text-[#5F5E5A]">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel max-w-md rounded-[24px] p-6 text-center">
          <div className="mb-2 text-xl font-semibold text-[#1A1A1A]">Could not load job</div>
          <div className="mb-4 text-sm text-[#5F5E5A]">{error}</div>
          <Link to="/jobs" className="text-[#1D9E75] hover:underline">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel max-w-md rounded-[24px] p-6 text-center">
          <div className="mb-2 text-xl font-semibold text-[#1A1A1A]">Job not found</div>
          <Link to="/jobs" className="text-[#1D9E75] hover:underline">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  const company = job.company;
  const color = company ? colorMap[company.avatar_color] || colorMap.teal : colorMap.teal;

  const requirements = job.requirements ? job.requirements.split('\n').filter((r) => r.trim().length > 0) : [];
  const whatYoullDo = job.what_youll_do ? job.what_youll_do.split('\n').filter((r) => r.trim().length > 0) : [];
  const applyHref =
    job.apply_method === 'email' && job.application_email
      ? `mailto:${job.application_email}?subject=${encodeURIComponent(`Application for ${job.title}`)}`
      : job.apply_method === 'external' && job.apply_url
        ? job.apply_url
        : job.company?.website || '#';
  const internalApply = job.apply_method === 'internal';

  const handleSave = () => {
    if (!candidateId || !job) return;
    const nextIds = toggleSavedJob(candidateId, job.id);
    setSaved(nextIds.includes(job.id));
  };

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1fr_320px] lg:px-8">
        <div className="panel rounded-[28px] px-4 py-6 sm:px-6 sm:py-8 lg:rounded-[32px]">
          <Link
            to="/jobs"
            className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] transition-colors hover:text-[#1A1A1A] sm:mb-6"
          >
            <ArrowLeft size={14} /> Back to jobs
          </Link>

          <div className="mb-4 flex items-center gap-3 sm:gap-3.5">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-2xl text-[15px] font-bold ring-1 ring-black/5 sm:h-14 sm:w-14 sm:text-[17px] ${color.bg} ${color.text}`}
            >
              {company?.logo_initials || '??'}
            </div>
            <div>
              <h1 className="font-display text-[22px] font-bold text-[#1A1A1A] sm:text-[28px]">{job.title}</h1>
              <p className="text-xs text-[#5F5E5A] sm:text-sm">
                {company?.name || 'Unknown'} · {job.location}
              </p>
            </div>
          </div>

          {company?.verified && (
            <div className="mb-4 inline-flex items-center gap-[5px] rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-3 py-[5px] text-xs font-semibold text-[#085041] sm:mb-5">
              <CheckCircle size={12} /> Verified by RoleWave
            </div>
          )}

          <div className="mb-6 flex flex-wrap gap-2 sm:mb-7">
            <span className="flex items-center gap-1 rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2.5 py-1 text-xs font-semibold text-[#085041]">
              <MapPin size={12} /> {job.location}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-[#5DCAA5] bg-[#E1F5EE] px-2.5 py-1 text-xs font-semibold text-[#085041]">
              <Home size={12} /> {job.work_type}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]">
              <Briefcase size={12} /> {job.job_type}
            </span>
            <span className="flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]">
              <Clock size={12} /> Posted {timeAgo(job.created_at)}
            </span>
          </div>

          <div className="mb-6 rounded-[24px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:p-5">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-[1px] text-[#B4B2A9]">About this role</h2>
            {job.description.split('\n\n').map((para, i) => (
              <p key={i} className="mb-2 text-sm leading-[1.8] text-[#5F5E5A] last:mb-0">
                {para}
              </p>
            ))}
          </div>

          {whatYoullDo.length > 0 && (
            <div className="mb-6 rounded-[24px] border border-[#D3D1C7] bg-white p-4 sm:p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[1px] text-[#B4B2A9]">What you'll do</h2>
              {whatYoullDo.map((item, i) => (
                <div key={i} className="mb-2 flex items-start gap-2.5 last:mb-0">
                  <div className="mt-[7px] h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#1D9E75]" />
                  <div className="text-sm leading-[1.6] text-[#5F5E5A]">{item}</div>
                </div>
              ))}
            </div>
          )}

          {requirements.length > 0 && (
            <div className="mb-6 rounded-[24px] border border-[#D3D1C7] bg-white p-4 sm:p-5">
              <h2 className="mb-3 text-xs font-bold uppercase tracking-[1px] text-[#B4B2A9]">Requirements</h2>
              {requirements.map((item, i) => (
                <div key={i} className="mb-2 flex items-start gap-2.5 last:mb-0">
                  <div className="mt-[7px] h-[5px] w-[5px] flex-shrink-0 rounded-full bg-[#1D9E75]" />
                  <div className="text-sm leading-[1.6] text-[#5F5E5A]">{item}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-[28px] panel-soft px-4 py-6 sm:px-6 sm:py-7">
          <div className="mb-3.5 rounded-[24px] bg-[#1D9E75] p-5 shadow-[0_16px_30px_rgba(29,158,117,0.18)]">
            <h2 className="mb-1 text-[15px] font-bold text-white">Ready to apply?</h2>
            <p className="mb-4 text-xs text-white/65">
              {internalApply
                ? 'Apply directly on RoleWave and keep your application in one place.'
                : "Takes about 5 minutes on the company's careers page."}
            </p>
            {internalApply ? (
              <Link
                to={`/jobs/${job.slug}/apply`}
                className="block w-full rounded-xl bg-white py-3 text-center text-sm font-bold text-[#1D9E75] transition-colors hover:bg-gray-50"
              >
                <span className="inline-flex items-center gap-2">
                  <Send size={14} /> Apply on RoleWave
                </span>
              </Link>
            ) : (
              <a
                href={applyHref}
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full rounded-xl bg-white py-3 text-center text-sm font-bold text-[#1D9E75] transition-colors hover:bg-gray-50"
              >
                Apply for this role →
              </a>
            )}
            <button
              onClick={handleShare}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-transparent py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/10"
            >
              <Share2 size={14} /> {showCopied ? 'Copied!' : 'Share this job'}
            </button>
            <button
              onClick={handleSave}
              disabled={!candidateId}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl border border-white/25 bg-transparent py-2.5 text-[13px] text-white/70 transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Bookmark size={14} /> {saved ? 'Saved' : 'Save job'}
            </button>
          </div>

          <div className="h-4" />

          <div className="flex justify-between border-b border-[#D3D1C7] py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Location</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.location}</span>
          </div>
          <div className="flex justify-between border-b border-[#D3D1C7] py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Work type</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.work_type}</span>
          </div>
          <div className="flex justify-between border-b border-[#D3D1C7] py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Job type</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{job.job_type}</span>
          </div>
          <div className="flex justify-between border-b border-[#D3D1C7] py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Posted</span>
            <span className="text-[13px] font-medium text-[#1A1A1A]">{timeAgo(job.created_at)}</span>
          </div>
          <div className="flex justify-between py-2.5">
            <span className="text-[13px] text-[#B4B2A9]">Verified</span>
            <span className="text-[13px] font-medium text-[#1D9E75]">Yes</span>
          </div>
        </div>
      </div>
    </div>
  );
}

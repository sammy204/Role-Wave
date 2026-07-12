import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { CandidateProfile, Company, Job, Profile } from '../types';

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  coverLetter: '',
  resumeUrl: '',
  portfolioUrl: '',
};

export default function JobApplication() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [job, setJob] = useState<(Job & { company?: Company }) | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        if (!slug) {
          navigate('/jobs', { replace: true });
          return;
        }

        const [{ data }, sessionProfile] = await Promise.all([
          supabase
            .from('jobs')
            .select('*')
            .eq('slug', slug)
            .eq('status', 'active')
            .maybeSingle(),
          supabase.auth.getSession(),
        ]);

        if (!alive) return;

        if (!data) {
          navigate('/jobs', { replace: true });
          return;
        }

        const { data: companyData } = await supabase
          .from('companies')
          .select('*')
          .eq('id', data.company_id)
          .maybeSingle();

        if (!alive) return;

        setJob({ ...(data as Job), company: companyData || undefined });

        const session = sessionProfile.data.session;
        if (session) {
          const nextProfile = await fetchProfile(session.user.id);
          if (!alive) return;
          setProfile(nextProfile);

          if (nextProfile?.account_type === 'candidate') {
            const { data: nextCandidateProfile } = await supabase
              .from('candidate_profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!alive) return;
            setCandidateProfile((nextCandidateProfile || null) as CandidateProfile | null);

            if (nextCandidateProfile) {
              const typed = nextCandidateProfile as CandidateProfile;
              setForm({
                name: nextProfile.full_name || '',
                email: session.user.email || '',
                phone: '',
                coverLetter: '',
                resumeUrl: typed.resume_url || '',
                portfolioUrl: typed.portfolio_url || '',
              });
            } else {
              setForm((prev) => ({
                ...prev,
                name: nextProfile.full_name || '',
                email: session.user.email || '',
              }));
            }
          } else {
            setForm((prev) => ({
              ...prev,
              email: session.user.email || '',
            }));
          }
        }
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load application form.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [navigate, slug]);

  const updateField = (field: keyof typeof form, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');

    try {
      if (!job) throw new Error('Job is missing.');
      if (!form.name || !form.email) throw new Error('Please add your name and email.');

      const { data } = await supabase.auth.getSession();
      const session = data.session;

      const source = profile?.account_type === 'candidate' ? 'registered' : 'guest';
      const candidateProfileId = candidateProfile?.id || (source === 'registered' && session ? session.user.id : null);

      const { error: submitError } = await supabase.from('job_applications').insert({
        job_id: job.id,
        candidate_profile_id: candidateProfileId,
        applicant_name: form.name,
        applicant_email: form.email,
        applicant_phone: form.phone || null,
        cover_letter: form.coverLetter || null,
        resume_url: form.resumeUrl || null,
        portfolio_url: form.portfolioUrl || null,
        source,
      });

      if (submitError) throw submitError;
      setSuccess(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Could not submit application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading application...
        </div>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] p-6 text-center">
          <div className="mb-2 text-xl font-semibold text-[#1A1A1A]">Application unavailable</div>
          <Link to="/jobs" className="text-[#1D9E75] hover:underline">
            Browse all jobs
          </Link>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel w-full max-w-md rounded-[28px] p-8 text-center sm:p-10">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#E1F5EE]">
            <Send size={24} className="text-[#1D9E75]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-[#1A1A1A]">Application sent</h2>
          <p className="mb-6 text-sm text-[#5F5E5A]">
            Your application has been sent for {job.title}. We’ll keep building the employer side next.
          </p>
          <Link
            to={`/jobs/${job.slug}`}
            className="inline-flex items-center justify-center rounded-xl bg-[#1D9E75] px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[#168a63]"
          >
            Back to job
          </Link>
        </div>
      </div>
    );
  }

  const fieldClass =
    'field-shell rounded-xl bg-white px-3.5 py-2.5 text-sm text-[#1A1A1A] outline-none transition-colors';

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="panel rounded-[28px] px-4 py-6 sm:px-6 sm:py-8">
          <Link
            to={`/jobs/${job.slug}`}
            className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] transition-colors hover:text-[#1A1A1A] sm:mb-6"
          >
            <ArrowLeft size={14} /> Back to job
          </Link>

          <div className="mb-1.5 text-2xl font-bold text-[#1A1A1A]">Apply for {job.title}</div>
          <div className="mb-6 text-sm text-[#5F5E5A]">
            This form works for guests and registered candidates. If you already have a profile, we can
            use it to strengthen your application later.
          </div>

          {error && (
            <div className="mb-6 rounded-[18px] border border-[#F0D080] bg-[#FFF8E6] p-4 text-sm text-[#7A5000]">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Name</label>
              <input className={fieldClass} value={form.name} onChange={(e) => updateField('name', e.target.value)} placeholder="Your full name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Email</label>
              <input className={fieldClass} type="email" value={form.email} onChange={(e) => updateField('email', e.target.value)} placeholder="you@example.com" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Phone</label>
              <input className={fieldClass} value={form.phone} onChange={(e) => updateField('phone', e.target.value)} placeholder="+234..." />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Resume URL</label>
              <input className={fieldClass} value={form.resumeUrl} onChange={(e) => updateField('resumeUrl', e.target.value)} placeholder="https://..." />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Cover letter</label>
              <textarea
                rows={5}
                className={`${fieldClass} resize-y leading-relaxed`}
                value={form.coverLetter}
                onChange={(e) => updateField('coverLetter', e.target.value)}
                placeholder="Tell the employer why you're a good fit."
              />
            </div>
            <div className="sm:col-span-2 flex flex-col gap-1.5">
              <label className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Portfolio URL</label>
              <input className={fieldClass} value={form.portfolioUrl} onChange={(e) => updateField('portfolioUrl', e.target.value)} placeholder="https://..." />
            </div>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-6 rounded-xl bg-[#1D9E75] px-8 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
          >
            {submitting ? 'Sending...' : 'Submit application'}
          </button>
        </div>

        <div className="rounded-[28px] panel-soft px-4 py-6 sm:px-6 sm:py-7">
          <div className="mb-3.5 rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Job summary</h3>
            <div className="text-sm font-medium text-[#1A1A1A]">{job.title}</div>
            <div className="mt-1 text-xs text-[#5F5E5A]">{job.company?.name || 'Company'} · {job.location}</div>
          </div>
          <div className="rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Why this flow exists</h3>
            <p className="text-xs leading-relaxed text-[#5F5E5A]">
              Guest applicants can apply quickly, while registered candidates can reuse their profile data
              and become discoverable in the talent network later.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

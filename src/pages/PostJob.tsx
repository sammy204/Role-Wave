import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Save } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company, EmployerProfile, Job, Profile } from '../types';

type ApplyMethod = 'external' | 'email' | 'internal';
type JobStatus = 'active' | 'filled' | 'closed' | 'archived';

const emptyForm = {
  jobTitle: '',
  city: 'Lagos',
  workType: 'Remote',
  jobType: 'Full-time',
  salary: '',
  description: '',
  requirements: '',
  whatYoullDo: '',
  tags: '',
  status: 'active' as JobStatus,
  applyMethod: 'external' as ApplyMethod,
  applyUrl: '',
  applicationEmail: '',
};

function buildJobSlug(title: string, companyName: string) {
  return `${slugify(title)}-${slugify(companyName)}-${Math.random().toString(36).slice(2, 6)}`;
}

export default function PostJob() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [successSlug, setSuccessSlug] = useState('');
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [employerProfile, setEmployerProfile] = useState<EmployerProfile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?role=employer', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type !== 'employer') {
          navigate('/start?role=candidate', { replace: true });
          return;
        }

        if (!nextProfile.onboarding_completed) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        setProfile(nextProfile);

        const { data: employerRow, error: employerError } = await supabase
          .from('employer_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();
        if (employerError) throw employerError;

        const typedEmployer = (employerRow || null) as EmployerProfile | null;
        setEmployerProfile(typedEmployer);

        if (!typedEmployer?.company_id) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        const { data: companyRow, error: companyError } = await supabase
          .from('companies')
          .select('*')
          .eq('id', typedEmployer.company_id)
          .maybeSingle();
        if (companyError) throw companyError;

        if (!companyRow) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        setCompany(companyRow as Company);
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load employer workspace.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    setError('');
    setSuccessSlug('');

    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) throw new Error('Please sign in again.');
      if (!company) throw new Error('Company profile is not ready.');
      if (!form.jobTitle || !form.description || !form.requirements) {
        throw new Error('Please complete the required job fields.');
      }

      const jobSlug = buildJobSlug(form.jobTitle, company.name);
      const tags = form.tags
        .split(',')
        .map((tag) => tag.trim())
        .filter(Boolean);

      const insertPayload: Partial<Job> & {
        title: string;
        slug: string;
        company_id: string;
        description: string;
        requirements: string;
        what_youll_do: string | null;
        location: string;
        work_type: string;
        job_type: string;
        salary: string | null;
        tags: string[];
        featured: boolean;
        status: JobStatus;
        apply_method: ApplyMethod;
        apply_url: string | null;
        application_email: string | null;
      } = {
        title: form.jobTitle,
        slug: jobSlug,
        company_id: company.id,
        description: form.description,
        requirements: form.requirements,
        what_youll_do: form.whatYoullDo || null,
        location: form.city,
        work_type: form.workType,
        job_type: form.jobType,
        salary: form.salary || null,
        tags,
        featured: false,
        status: form.status,
        apply_method: form.applyMethod,
        apply_url: form.applyMethod === 'external' ? form.applyUrl || null : null,
        application_email: form.applyMethod === 'email' ? form.applicationEmail || null : null,
      };

      const { data: jobData, error: jobError } = await supabase
        .from('jobs')
        .insert(insertPayload)
        .select('*')
        .single();
      if (jobError || !jobData) throw jobError || new Error('Could not save the job.');

      setSuccessSlug(jobSlug);
      setForm(emptyForm);

      const { error: companyError } = await supabase
        .from('companies')
        .update({ job_count: (company.job_count || 0) + (form.status === 'active' ? 1 : 0) })
        .eq('id', company.id);
      if (companyError) throw companyError;
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not create job.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading employer workspace...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="panel rounded-[28px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              to="/employer/onboarding"
              className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A] transition-colors hover:text-[#1A1A1A] sm:mb-2"
            >
              <ArrowLeft size={14} /> Company
            </Link>
            <span className="rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
              Employer workspace
            </span>
          </div>

          <div className="mb-1.5 text-2xl font-bold text-[#1A1A1A]">Post a job</div>
          <div className="mb-6 text-sm text-[#5F5E5A]">
            Post directly from your employer account. You can choose whether applications go external,
            by email, or through RoleWave.
          </div>

          {successSlug && (
            <div className="mb-6 rounded-[18px] border border-[#5DCAA5] bg-[#E1F5EE] p-4 text-sm text-[#085041]">
              <div className="flex items-center gap-2 font-semibold">
                <Check size={16} /> Job created successfully.
              </div>
              <p className="mt-1">Your listing is ready to view on the public board.</p>
              <Link to={`/jobs/${successSlug}`} className="mt-3 inline-flex text-sm font-semibold underline">
                Open job listing
              </Link>
            </div>
          )}

          {error && (
            <div className="mb-6 rounded-[18px] border border-[#F0D080] bg-[#FFF8E6] p-4 text-sm text-[#7A5000]">
              {error}
            </div>
          )}

          <div className="mb-4 rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 text-sm text-[#5F5E5A]">
            <div className="font-semibold text-[#1A1A1A]">{company?.name || employerProfile?.company_name || 'Your company'}</div>
            <p className="mt-1">
              {profile?.full_name || 'Employer'} is posting under this company profile.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Job title" required>
              <input
                type="text"
                placeholder="e.g. Product Designer"
                className="admin-input"
                value={form.jobTitle}
                onChange={(e) => updateField('jobTitle', e.target.value)}
              />
            </Field>
            <Field label="City">
              <select className="admin-input" value={form.city} onChange={(e) => updateField('city', e.target.value)}>
                <option>Lagos</option>
                <option>Abuja</option>
                <option>Port Harcourt</option>
                <option>Remote</option>
              </select>
            </Field>
            <Field label="Work type">
              <select className="admin-input" value={form.workType} onChange={(e) => updateField('workType', e.target.value)}>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
              </select>
            </Field>
            <Field label="Job type">
              <select className="admin-input" value={form.jobType} onChange={(e) => updateField('jobType', e.target.value)}>
                <option>Full-time</option>
                <option>Part-time</option>
                <option>Contract</option>
                <option>Internship</option>
              </select>
            </Field>
            <Field label="Salary">
              <input
                type="text"
                placeholder="e.g. ₦300,000/month"
                className="admin-input"
                value={form.salary}
                onChange={(e) => updateField('salary', e.target.value)}
              />
            </Field>
            <Field label="Status">
              <select className="admin-input" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                <option value="active">Active</option>
                <option value="filled">Filled</option>
                <option value="closed">Closed</option>
                <option value="archived">Archived</option>
              </select>
            </Field>
            <div className="sm:col-span-2">
              <Field label="Job description" required>
                <textarea
                  placeholder="Describe the role, responsibilities, and what makes it a great opportunity..."
                  rows={4}
                  className="admin-input min-h-[140px] resize-y"
                  value={form.description}
                  onChange={(e) => updateField('description', e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Requirements" required>
                <textarea
                  placeholder="List the key skills, qualifications, and experience needed..."
                  rows={4}
                  className="admin-input min-h-[140px] resize-y"
                  value={form.requirements}
                  onChange={(e) => updateField('requirements', e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="What they'll do">
                <textarea
                  placeholder="Optional responsibilities"
                  rows={4}
                  className="admin-input min-h-[120px] resize-y"
                  value={form.whatYoullDo}
                  onChange={(e) => updateField('whatYoullDo', e.target.value)}
                />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Tags">
                <input
                  type="text"
                  placeholder="React, TypeScript, Remote"
                  className="admin-input"
                  value={form.tags}
                  onChange={(e) => updateField('tags', e.target.value)}
                />
              </Field>
            </div>
            <Field label="Application method">
              <select
                className="admin-input"
                value={form.applyMethod}
                onChange={(e) => updateField('applyMethod', e.target.value)}
              >
                <option value="external">External link</option>
                <option value="email">Email</option>
                <option value="internal">RoleWave application</option>
              </select>
            </Field>
            {form.applyMethod === 'external' && (
              <Field label="Apply URL">
                <input
                  type="url"
                  className="admin-input"
                  placeholder="https://company.com/careers/apply"
                  value={form.applyUrl}
                  onChange={(e) => updateField('applyUrl', e.target.value)}
                />
              </Field>
            )}
            {form.applyMethod === 'email' && (
              <Field label="Application email">
                <input
                  type="email"
                  className="admin-input"
                  placeholder="jobs@company.com"
                  value={form.applicationEmail}
                  onChange={(e) => updateField('applicationEmail', e.target.value)}
                />
              </Field>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-8 py-3.5 text-[15px] font-bold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Post job'}
          </button>
        </div>

        <div className="rounded-[28px] panel-soft px-4 py-6 sm:px-6 sm:py-7">
          <div className="mb-3.5 rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">What happens next?</h3>
            <p className="text-xs leading-relaxed text-[#5F5E5A]">
              Active jobs appear on the public board immediately. Internal applications can then be collected
              on RoleWave later from your employer dashboard.
            </p>
          </div>
          <div className="mb-3.5 rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Employer note</h3>
            <p className="text-xs leading-relaxed text-[#5F5E5A]">
              We are building toward candidate search next, so the data you save here is the start of your
              talent pipeline.
            </p>
          </div>
          <div className="rounded-[20px] border border-[#D3D1C7] bg-white p-4">
            <h3 className="mb-1.5 text-[13px] font-semibold text-[#1A1A1A]">Job posting tips</h3>
            <ul className="space-y-1.5 text-xs text-[#5F5E5A]">
              <li>• Keep the title specific</li>
              <li>• Include a real application method</li>
              <li>• Use internal applications when you want RoleWave to collect leads</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: import('react').ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label} {required ? '*' : ''}
      </span>
      {children}
    </label>
  );
}

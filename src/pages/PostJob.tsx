import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check, Clock3, MapPin, Plus, Save, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getUserFacingError } from '../lib/userFacingError';
import { fetchProfile, slugify } from '../lib/admin';
import type { Company, EmployerProfile, Job, Profile } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';
import CompanyLogo from '../components/CompanyLogo';

type ApplyMethod = 'external' | 'email' | 'internal';
type JobStatus = 'active' | 'filled' | 'closed' | 'archived';

// Same vocabulary as the candidate skill picker, so job tags and candidate
// skills line up for future matching.
const suggestedTags = [
  'React',
  'TypeScript',
  'Next.js',
  'Node.js',
  'Supabase',
  'Tailwind CSS',
  'UI/UX',
  'Figma',
  'Python',
  'PostgreSQL',
  'Docker',
  'AWS',
  'Product Design',
  'GraphQL',
  'Testing',
  'Remote',
];

const applyMethodCopy: Record<ApplyMethod, string> = {
  external: 'Applicants will be sent to your external link.',
  email: 'Applicants will be asked to email you directly.',
  internal: 'Applicants apply in-site and appear on your dashboard.',
};

const emptyForm = {
  jobTitle: '',
  city: 'Lagos',
  workType: 'Remote',
  jobType: 'Full-time',
  salary: '',
  salaryMin: '',
  salaryMax: '',
  salaryCurrency: 'NGN',
  salaryPeriod: 'month',
  experienceLevel: 'entry',
  workAuthorization: 'anywhere',
  description: '',
  requirements: '',
  whatYoullDo: '',
  tags: [] as string[],
  status: 'active' as JobStatus,
  applyMethod: 'external' as ApplyMethod,
  applyUrl: '',
  applicationEmail: '',
};

function buildJobSlug(title: string, companyName: string) {
  return `${slugify(title)}-${slugify(companyName)}-${Math.random().toString(36).slice(2, 6)}`;
}

function formatSalaryRange(form: typeof emptyForm) {
  const min = Number(form.salaryMin);
  const max = Number(form.salaryMax);
  if (!min && !max) return form.salary || '';

  const currency = form.salaryCurrency === 'NGN' ? '₦' : form.salaryCurrency;
  const format = (value: number) => `${currency}${value.toLocaleString()}`;
  const range = min && max ? `${format(min)} – ${format(max)}` : min ? `${format(min)}+` : `Up to ${format(max)}`;
  return `${range}/${form.salaryPeriod}`;
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
  const [tagInput, setTagInput] = useState('');

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
          setError(getUserFacingError(loadError, 'We couldn’t load your employer workspace. Please try again.'));
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

  const updateField = (field: keyof typeof form, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addTag = (rawTag?: string) => {
    const nextTag = (rawTag ?? tagInput).trim();
    if (!nextTag) return;
    if (form.tags.includes(nextTag)) {
      setTagInput('');
      return;
    }
    updateField('tags', [...form.tags, nextTag]);
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateField('tags', form.tags.filter((item) => item !== tag));
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addTag();
    }
  };

  const previewTags = useMemo(() => form.tags, [form.tags]);

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

      const minimumSalary = form.salaryMin ? Number(form.salaryMin) : null;
      const maximumSalary = form.salaryMax ? Number(form.salaryMax) : null;
      if (minimumSalary !== null && maximumSalary !== null && maximumSalary < minimumSalary) {
        throw new Error('Maximum salary must be greater than or equal to minimum salary.');
      }
      if (form.applyMethod === 'external' && form.applyUrl && !/^https?:\/\//i.test(form.applyUrl.trim())) {
        throw new Error('Apply URL must start with http:// or https://.');
      }
      if (form.applyMethod === 'email' && !form.applicationEmail.trim()) {
        throw new Error('Please enter an application email address.');
      }

      const jobSlug = buildJobSlug(form.jobTitle, company.name);
      const tags = form.tags;

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
        salary_min: number | null;
        salary_max: number | null;
        salary_currency: string;
        salary_period: string;
        experience_level: string;
        work_authorization: string;
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
        salary: formatSalaryRange(form) || null,
        salary_min: minimumSalary,
        salary_max: maximumSalary,
        salary_currency: form.salaryCurrency,
        salary_period: form.salaryPeriod,
        experience_level: form.experienceLevel,
        work_authorization: form.workAuthorization,
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
      setError(getUserFacingError(saveError, 'We couldn’t create the job. Please try again.'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel motion-safe:animate-fade-up rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }


  return (
    <div className="page-shell">
      <div className="mx-auto grid w-full max-w-[1320px] flex-1 grid-cols-1 gap-4 px-4 pb-8 pt-6 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="panel motion-safe:animate-fade-up rounded-[28px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <Link
              to="/employer/onboarding"
              className="ghost-chip !rounded-full !px-3 !py-2 !text-[13px]"
            >
              <ArrowLeft size={14} /> Company
            </Link>
            <span className="rounded-full bg-accent-light px-3 py-1 text-xs font-semibold text-accent-text">
              Employer workspace
            </span>
          </div>

          <div data-tour="employer-post-job-page" className="mb-1.5 font-display text-2xl font-bold text-ink">Post a job</div>
          <div className="mb-6 text-sm text-muted">
            Post directly from your employer account. You can choose whether applications go external,
            by email, or through RoleWave.
          </div>

          {successSlug && (
            <div className="motion-safe:animate-fade-up mb-6 rounded-[18px] border border-[#5DCAA5] bg-accent-light p-4 text-sm text-accent-text">
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

          <div className="mb-6 flex items-center gap-3 rounded-[18px] border border-line bg-paper p-4">
            <CompanyLogo
              company={company}
              size={40}
              radiusClassName="rounded-xl"
              textClassName="text-sm"
            />
            <div className="min-w-0 text-sm text-muted">
              <span className="font-semibold text-ink">{company?.name || employerProfile?.company_name || 'Your company'}</span>
              {' '}· {profile?.full_name || 'Employer'} is posting under this company profile.
            </div>
          </div>

          <div className="space-y-6">
            <section>
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                Role details
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
                    <option>SIWES</option>
                    <option>NYSC PPA</option>
                  </select>
                </Field>
                <Field label="Salary">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="number"
                      min="0"
                      placeholder="Minimum"
                      className="admin-input"
                      value={form.salaryMin}
                      onChange={(e) => updateField('salaryMin', e.target.value)}
                    />
                    <input
                      type="number"
                      min="0"
                      placeholder="Maximum"
                      className="admin-input"
                      value={form.salaryMax}
                      onChange={(e) => updateField('salaryMax', e.target.value)}
                    />
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <select className="admin-input" value={form.salaryCurrency} onChange={(e) => updateField('salaryCurrency', e.target.value)}>
                      <option value="NGN">NGN (₦)</option>
                      <option value="USD">USD ($)</option>
                      <option value="GBP">GBP (£)</option>
                    </select>
                    <select className="admin-input" value={form.salaryPeriod} onChange={(e) => updateField('salaryPeriod', e.target.value)}>
                      <option value="hour">Per hour</option>
                      <option value="month">Per month</option>
                      <option value="year">Per year</option>
                    </select>
                  </div>
                  <input
                    type="text"
                    placeholder="Optional display text for older/custom salary formats"
                    className="admin-input mt-2"
                    value={form.salary}
                    onChange={(e) => updateField('salary', e.target.value)}
                  />
                </Field>
                <Field label="Experience level">
                  <select className="admin-input" value={form.experienceLevel} onChange={(e) => updateField('experienceLevel', e.target.value)}>
                    <option value="entry">Entry level</option>
                    <option value="junior">Junior</option>
                    <option value="mid">Mid-level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead / Principal</option>
                  </select>
                </Field>
                <Field label="Work authorization">
                  <select className="admin-input" value={form.workAuthorization} onChange={(e) => updateField('workAuthorization', e.target.value)}>
                    <option value="anywhere">Open to applicants anywhere</option>
                    <option value="authorized_only">Must already be authorized to work</option>
                    <option value="sponsorship_available">Visa sponsorship available</option>
                  </select>
                </Field>
                <Field label="Status">
                  <select className="admin-input" value={form.status} onChange={(e) => updateField('status', e.target.value)}>
                    <option value="active">Active</option>
                    <option value="filled">Filled</option>
                    <option value="closed">Closed</option>
                    <option value="archived">Archived</option>
                  </select>
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                Description
              </div>
              <div className="grid grid-cols-1 gap-4">
                <Field label="Job description" required>
                  <textarea
                    placeholder="Describe the role, responsibilities, and what makes it a great opportunity..."
                    rows={4}
                    className="admin-input min-h-[140px] resize-y"
                    value={form.description}
                    onChange={(e) => updateField('description', e.target.value)}
                  />
                </Field>
                <Field label="Requirements" required>
                  <textarea
                    placeholder="List the key skills, qualifications, and experience needed..."
                    rows={4}
                    className="admin-input min-h-[140px] resize-y"
                    value={form.requirements}
                    onChange={(e) => updateField('requirements', e.target.value)}
                  />
                </Field>
                <Field label="What they'll do">
                  <textarea
                    placeholder="Optional responsibilities"
                    rows={4}
                    className="admin-input min-h-[120px] resize-y"
                    value={form.whatYoullDo}
                    onChange={(e) => updateField('whatYoullDo', e.target.value)}
                  />
                </Field>
                <Field label="Tags">
                  <div className="space-y-2">
                    {form.tags.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {form.tags.map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => removeTag(tag)}
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-paper px-2.5 py-1 text-xs font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
                          >
                            {tag}
                            <X size={12} />
                          </button>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap gap-2">
                      {suggestedTags
                        .filter((tag) => !form.tags.includes(tag))
                        .slice(0, 8)
                        .map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            onClick={() => addTag(tag)}
                            className="inline-flex items-center gap-1 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-muted transition-colors duration-200 hover:border-[#5DCAA5] hover:text-ink"
                          >
                            <Plus size={11} /> {tag}
                          </button>
                        ))}
                    </div>

                    <div className="flex gap-2">
                      <input
                        className="admin-input flex-1"
                        value={tagInput}
                        onChange={(e) => setTagInput(e.target.value)}
                        onKeyDown={handleTagKeyDown}
                        placeholder="Type a tag and press Enter"
                      />
                      <button
                        type="button"
                        onClick={() => addTag()}
                        className="rounded-xl border border-line bg-paper px-3 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                </Field>
              </div>
            </section>

            <section className="border-t border-line pt-6">
              <div className="mb-3 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
                How to apply
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
            </section>
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-[15px] font-bold text-white transition-all duration-200 hover:-translate-y-[1px] hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Post job'}
          </button>
        </div>

        <div className="space-y-4">
          {/* Live listing preview: shows exactly what candidates will see on the public board */}
          <div
            className="panel motion-safe:animate-fade-up sticky top-6 rounded-[28px] p-5"
            style={{ animationDelay: '100ms' }}
          >
            <div className="mb-4 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">
              Preview
            </div>

            <div className="flex items-start gap-3">
              <CompanyLogo
                company={company}
                size={44}
                radiusClassName="rounded-xl"
                textClassName="text-sm"
              />
              <div className="min-w-0">
                <h3 className="truncate font-display text-lg font-bold text-ink">
                  {form.jobTitle || 'Job title'}
                </h3>
                <div className="truncate text-sm text-muted">
                  {company?.name || employerProfile?.company_name || 'Your company'}
                </div>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="inline-flex items-center gap-1">
                <MapPin size={12} /> {form.city}
              </span>
              <span>{form.workType}</span>
              <span>{form.jobType}</span>
              {formatSalaryRange(form) && <span>{formatSalaryRange(form)}</span>}
            </div>

            <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-line bg-white px-2.5 py-1 text-xs font-semibold text-muted">
              <Clock3 size={11} /> Posted just now
            </div>

            {previewTags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {previewTags.slice(0, 6).map((tag) => (
                  <span key={tag} className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-text">
                    {tag}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-sm leading-relaxed text-muted line-clamp-3">
              {form.description || 'Your job description will appear here as candidates see it.'}
            </p>

            <div className="mt-4 border-t border-line pt-3 text-xs text-muted">
              {applyMethodCopy[form.applyMethod]}
            </div>
          </div>

          <div
            className="panel motion-safe:animate-fade-up rounded-[28px] p-5"
            style={{ animationDelay: '160ms' }}
          >
            <h3 className="mb-1.5 text-sm font-semibold text-ink">Job posting tips</h3>
            <ul className="space-y-1.5 text-sm text-muted">
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
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">
        {label} {required ? '*' : ''}
      </span>
      {children}
    </label>
  );
}

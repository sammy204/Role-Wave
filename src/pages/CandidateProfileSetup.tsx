import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, FileText, Save, Upload } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../lib/useAuth';
import type { CandidateProfile } from '../types';

type CandidateProfileForm = {
  fullName: string;
  avatarUrl: string;
  headline: string;
  bio: string;
  location: string;
  yearsExperience: string;
  skills: string;
  preferredLocations: string;
  preferredSalary: string;
  workPreference: string;
  workAuthorization: string;
  availability: string;
  resumeUrl: string;
  portfolioUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  education: string;
  experience: string;
  projects: string;
  openToWork: boolean;
  visibilityToEmployers: 'open' | 'not_open' | 'hidden';
};

const emptyForm: CandidateProfileForm = {
  fullName: '',
  avatarUrl: '',
  headline: '',
  bio: '',
  location: '',
  yearsExperience: '',
  skills: '',
  preferredLocations: '',
  preferredSalary: '',
  workPreference: 'Remote',
  workAuthorization: '',
  availability: 'Immediately available',
  resumeUrl: '',
  portfolioUrl: '',
  githubUrl: '',
  linkedinUrl: '',
  education: '',
  experience: '',
  projects: '',
  openToWork: true,
  visibilityToEmployers: 'open',
};

export default function CandidateProfileSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const { session, loading: authLoading } = useAuth();

  useEffect(() => {
    if (authLoading) return;

    if (!session) {
      navigate('/start?mode=login', { replace: true });
      return;
    }

    let alive = true;

    async function loadProfileForSession() {
      try {
        const { data: nextProfile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session!.user.id)
          .maybeSingle();

        if (!alive) return;

        if (nextProfile?.account_type === 'employer') {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        setForm((prev) => ({ ...prev, fullName: nextProfile?.full_name || '' }));

        const { data: candidateProfile } = await supabase
          .from('candidate_profiles')
          .select('*')
          .eq('id', session!.user.id)
          .maybeSingle();

        if (!alive) return;

        if (candidateProfile) {
          const existing = candidateProfile as CandidateProfile;
          setForm({
            fullName: nextProfile?.full_name || '',
            avatarUrl: existing.avatar_url || '',
            headline: existing.headline || '',
            bio: existing.bio || '',
            location: existing.location || '',
            yearsExperience: existing.years_experience?.toString() || '',
            skills: existing.skills.join(', '),
            preferredLocations: existing.preferred_locations.join(', '),
            preferredSalary: existing.preferred_salary || '',
            workPreference: existing.work_preference || 'Remote',
            workAuthorization: existing.work_authorization || '',
            availability: existing.availability || 'Immediately available',
            resumeUrl: existing.resume_url || '',
            portfolioUrl: existing.portfolio_url || '',
            githubUrl: existing.github_url || '',
            linkedinUrl: existing.linkedin_url || '',
            education: existing.education || '',
            experience: existing.experience || '',
            projects: existing.projects || '',
            openToWork: existing.open_to_work,
            visibilityToEmployers: existing.visibility_to_employers || 'open',
          });
        }
      } catch (err) {
        if (alive) setError(err instanceof Error ? err.message : 'Could not load profile.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadProfileForSession();

    return () => {
      alive = false;
    };
  }, [authLoading, session, navigate]);

  const updateField = (field: keyof typeof form, value: string | boolean) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const uploadProfileFile = async (
    file: File,
    folder: 'avatars' | 'resumes',
    userId: string
  ) => {
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file';
    const fileName = `${userId}/${folder}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('candidate-assets')
      .upload(fileName, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('candidate-assets').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAvatarUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingAvatar(true);
    setError('');

    try {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      if (!currentSession) throw new Error('Please sign in again.');
      if (!file.type.startsWith('image/')) throw new Error('Please upload an image file.');

      const publicUrl = await uploadProfileFile(file, 'avatars', currentSession.user.id);
      updateField('avatarUrl', publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleResumeUpload = async (file: File | null) => {
    if (!file) return;
    setUploadingResume(true);
    setError('');

    try {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      if (!currentSession) throw new Error('Please sign in again.');

      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a PDF, DOC, or DOCX CV.');
      }

      const publicUrl = await uploadProfileFile(file, 'resumes', currentSession.user.id);
      updateField('resumeUrl', publicUrl);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload CV.');
    } finally {
      setUploadingResume(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');

    try {
      const { data } = await supabase.auth.getSession();
      const currentSession = data.session;
      if (!currentSession) throw new Error('Please sign in again.');

      const payload: Partial<CandidateProfile> & { id: string } = {
        id: currentSession.user.id,
        avatar_url: form.avatarUrl || null,
        headline: form.headline || null,
        bio: form.bio || null,
        location: form.location || null,
        years_experience: form.yearsExperience ? Number(form.yearsExperience) : null,
        skills: form.skills
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        preferred_locations: form.preferredLocations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        preferred_salary: form.preferredSalary || null,
        work_preference: form.workPreference || null,
        work_authorization: form.workAuthorization || null,
        availability: form.availability || null,
        resume_url: form.resumeUrl || null,
        portfolio_url: form.portfolioUrl || null,
        github_url: form.githubUrl || null,
        linkedin_url: form.linkedinUrl || null,
        education: form.education || null,
        experience: form.experience || null,
        projects: form.projects || null,
        open_to_work: form.openToWork,
        visibility_to_employers: form.visibilityToEmployers,
      };

      const { error: saveError } = await supabase.from('candidate_profiles').upsert(payload);
      if (saveError) throw saveError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: form.fullName || null, onboarding_completed: true })
        .eq('id', currentSession.user.id);
      if (profileError) throw profileError;

      navigate('/', { replace: true });
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save your profile.');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading candidate profile...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto grid w-full max-w-[1180px] gap-4 lg:grid-cols-[1fr_320px]">
        <div className="panel rounded-[32px] p-5 sm:p-8">
          <Link
            to="/candidate/dashboard"
            className="mb-5 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-[13px] text-[#5F5E5A]"
          >
            <ArrowLeft size={14} /> Profile
          </Link>

          <div className="mb-2 text-2xl font-bold text-[#1A1A1A]">Create your candidate profile</div>
          <p className="mb-6 max-w-2xl text-sm leading-relaxed text-[#5F5E5A]">
            This is your mini CV on RoleWave. Employers can use it later to discover and shortlist talent.
          </p>

          {error && (
            <div className="mb-4 rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
              {error}
            </div>
          )}

          <div className="mb-6 grid gap-4 rounded-[24px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:grid-cols-[220px_1fr]">
            <div className="flex flex-col items-center justify-center rounded-[20px] border border-[#D3D1C7] bg-white p-4 text-center">
              <div className="mb-3 flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-[#E1F5EE] text-[#085041]">
                {form.avatarUrl ? (
                  <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  <Camera size={28} />
                )}
              </div>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[#168a63]">
                <Upload size={14} />
                {uploadingAvatar ? 'Uploading...' : 'Upload picture'}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  disabled={uploadingAvatar}
                  onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                />
              </label>
            </div>

            <div className="rounded-[20px] border border-[#D3D1C7] bg-white p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-[#1A1A1A]">
                <FileText size={16} /> CV / Resume
              </div>
              <p className="mb-3 text-sm leading-relaxed text-[#5F5E5A]">
                Upload a PDF, DOC, or DOCX CV. You can still paste a resume link below if your CV lives online.
              </p>
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-[#D3D1C7] bg-white px-3 py-2 text-xs font-semibold text-[#1A1A1A] transition-colors hover:border-[#5DCAA5]">
                <Upload size={14} />
                {uploadingResume ? 'Uploading...' : form.resumeUrl ? 'Replace CV' : 'Upload CV'}
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                  className="hidden"
                  disabled={uploadingResume}
                  onChange={(e) => handleResumeUpload(e.target.files?.[0] || null)}
                />
              </label>
              {form.resumeUrl && (
                <a
                  href={form.resumeUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-3 inline-flex text-xs font-semibold text-[#1D9E75] hover:underline"
                >
                  View CV
                </a>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Full name">
              <input className="admin-input" value={form.fullName} onChange={(e) => updateField('fullName', e.target.value)} placeholder="Samuel Ade" />
            </Field>
            <Field label="Headline">
              <input className="admin-input" value={form.headline} onChange={(e) => updateField('headline', e.target.value)} placeholder="Frontend Engineer" />
            </Field>
            <Field label="Location">
              <input className="admin-input" value={form.location} onChange={(e) => updateField('location', e.target.value)} placeholder="Lagos, Nigeria" />
            </Field>
            <Field label="Years of experience">
              <input className="admin-input" type="number" min="0" value={form.yearsExperience} onChange={(e) => updateField('yearsExperience', e.target.value)} placeholder="3" />
            </Field>
            <Field label="Availability">
              <input className="admin-input" value={form.availability} onChange={(e) => updateField('availability', e.target.value)} placeholder="Immediately available" />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Bio">
                <textarea className="admin-input min-h-[120px] resize-y" value={form.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Tell employers a little about yourself." />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Skills">
                <input className="admin-input" value={form.skills} onChange={(e) => updateField('skills', e.target.value)} placeholder="React, TypeScript, Supabase" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Preferred locations">
                <input className="admin-input" value={form.preferredLocations} onChange={(e) => updateField('preferredLocations', e.target.value)} placeholder="Remote, Lagos, Abuja" />
              </Field>
            </div>
            <Field label="Preferred salary">
              <input className="admin-input" value={form.preferredSalary} onChange={(e) => updateField('preferredSalary', e.target.value)} placeholder="₦600k - ₦900k" />
            </Field>
            <Field label="Work preference">
              <select className="admin-input" value={form.workPreference} onChange={(e) => updateField('workPreference', e.target.value)}>
                <option>Remote</option>
                <option>Hybrid</option>
                <option>On-site</option>
                <option>Flexible</option>
              </select>
            </Field>
            <Field label="Work authorization">
              <input className="admin-input" value={form.workAuthorization} onChange={(e) => updateField('workAuthorization', e.target.value)} placeholder="Authorized to work in Nigeria" />
            </Field>
            <Field label="Resume URL">
              <input className="admin-input" value={form.resumeUrl} onChange={(e) => updateField('resumeUrl', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="Portfolio URL">
              <input className="admin-input" value={form.portfolioUrl} onChange={(e) => updateField('portfolioUrl', e.target.value)} placeholder="https://..." />
            </Field>
            <Field label="GitHub">
              <input className="admin-input" value={form.githubUrl} onChange={(e) => updateField('githubUrl', e.target.value)} placeholder="https://github.com/..." />
            </Field>
            <Field label="LinkedIn">
              <input className="admin-input" value={form.linkedinUrl} onChange={(e) => updateField('linkedinUrl', e.target.value)} placeholder="https://linkedin.com/in/..." />
            </Field>
            <div className="sm:col-span-2">
              <Field label="Education">
                <textarea className="admin-input min-h-[100px] resize-y" value={form.education} onChange={(e) => updateField('education', e.target.value)} placeholder="School, degree, certifications" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Experience">
                <textarea className="admin-input min-h-[120px] resize-y" value={form.experience} onChange={(e) => updateField('experience', e.target.value)} placeholder="Work history and responsibilities" />
              </Field>
            </div>
            <div className="sm:col-span-2">
              <Field label="Projects">
                <textarea className="admin-input min-h-[120px] resize-y" value={form.projects} onChange={(e) => updateField('projects', e.target.value)} placeholder="Projects and outcomes" />
              </Field>
            </div>
          </div>

          <label className="mt-4 flex items-center gap-2 text-sm text-[#5F5E5A]">
            <input
              type="checkbox"
              checked={form.openToWork}
              onChange={(e) => updateField('openToWork', e.target.checked)}
            />
            I am open to work
          </label>

          <div className="mt-4">
            <Field label="Visibility to employers">
              <select
                className="admin-input"
                value={form.visibilityToEmployers}
                onChange={(e) => updateField('visibilityToEmployers', e.target.value)}
              >
                <option value="open">Open</option>
                <option value="not_open">Not open</option>
                <option value="hidden">Hidden</option>
              </select>
            </Field>
          </div>

          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168a63] disabled:opacity-60"
          >
            <Save size={16} />
            {saving ? 'Saving...' : 'Save profile'}
          </button>
        </div>

        <div className="space-y-4">
          <div className="panel rounded-[28px] p-5">
            <div className="text-sm font-semibold text-[#1A1A1A]">Why this matters</div>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
              Guest candidates can still apply for free. Registered candidates become discoverable by employers.
            </p>
          </div>
          <div className="panel rounded-[28px] p-5">
            <div className="text-sm font-semibold text-[#1A1A1A]">What employers can see later</div>
            <ul className="mt-3 space-y-2 text-sm text-[#5F5E5A]">
              <li>• Headline and skills</li>
              <li>• Experience and education</li>
              <li>• Portfolio and GitHub</li>
              <li>• Open to work status</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: import('react').ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label}
      </span>
      {children}
    </label>
  );
}

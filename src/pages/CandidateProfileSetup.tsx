import { useEffect, useState, type KeyboardEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Camera, FileText, Plus, Save, Upload, X } from 'lucide-react';
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
  skills: string[];
  preferredLocations: string;
  preferredSalary: string;
  workPreference: string;
  workAuthorization: string;
  availability: string;
  whatsappNumber: string;
  resumeUrl: string;
  resumeName: string;
  portfolioUrl: string;
  githubUrl: string;
  linkedinUrl: string;
  education: string;
  experience: string[];
  projects: string[];
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
  skills: [],
  preferredLocations: '',
  preferredSalary: '',
  workPreference: 'Remote',
  workAuthorization: '',
  availability: 'Immediately available',
  whatsappNumber: '',
  resumeUrl: '',
  resumeName: '',
  portfolioUrl: '',
  githubUrl: '',
  linkedinUrl: '',
  education: '',
  experience: [''],
  projects: [''],
  openToWork: true,
  visibilityToEmployers: 'open',
};

const suggestedSkills = [
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
];

export default function CandidateProfileSetup() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);
  const [skillInput, setSkillInput] = useState('');

  const { session, loading: authLoading } = useAuth();

  const toBoolean = (value: unknown) => value === true || value === 'true' || value === 1 || value === '1';

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
            skills: Array.isArray(existing.skills) ? existing.skills : [],
            preferredLocations: Array.isArray(existing.preferred_locations) ? existing.preferred_locations.join(', ') : '',
            preferredSalary: existing.preferred_salary || '',
            workPreference: existing.work_preference || 'Remote',
            workAuthorization: existing.work_authorization || '',
            availability: existing.availability || 'Immediately available',
            whatsappNumber: existing.whatsapp_number || '',
            resumeUrl: existing.resume_url || '',
            resumeName: existing.resume_name || existing.resume_url?.split('/').pop()?.split('?')[0] || '',
            portfolioUrl: existing.portfolio_url || '',
            githubUrl: existing.github_url || '',
            linkedinUrl: existing.linkedin_url || '',
            education: existing.education || '',
            experience: existing.experience ? existing.experience.split(/\n\s*---\s*\n/).map((item: string) => item.trim()).filter(Boolean) : [''],
            projects: existing.projects ? existing.projects.split(/\n\s*---\s*\n/).map((item: string) => item.trim()).filter(Boolean) : [''],
            openToWork: toBoolean(existing.open_to_work),
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

  const updateField = (field: keyof typeof form, value: string | boolean | string[]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const addSkill = () => {
    const nextSkill = skillInput.trim();
    if (!nextSkill) return;
    if (form.skills.includes(nextSkill)) {
      setSkillInput('');
      return;
    }
    updateField('skills', [...form.skills, nextSkill]);
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    updateField('skills', form.skills.filter((item) => item !== skill));
  };

  const handleSkillKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addSkill();
    }
  };

  const updateListItem = (field: 'experience' | 'projects', index: number, value: string) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].map((item, itemIndex) => (itemIndex === index ? value : item)),
    }));
  };

  const addListItem = (field: 'experience' | 'projects') => {
    setForm((prev) => ({ ...prev, [field]: [...prev[field], ''] }));
  };

  const removeListItem = (field: 'experience' | 'projects', index: number) => {
    setForm((prev) => ({
      ...prev,
      [field]: prev[field].filter((_, itemIndex) => itemIndex !== index),
    }));
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
      updateField('resumeName', file.name);
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
        skills: form.skills.map((item) => item.trim()).filter(Boolean),
        preferred_locations: form.preferredLocations
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean),
        preferred_salary: form.preferredSalary || null,
        work_preference: form.workPreference || null,
        work_authorization: form.workAuthorization || null,
        availability: form.availability || null,
        whatsapp_number: form.whatsappNumber || null,
        resume_url: form.resumeUrl || null,
        resume_name: form.resumeName || null,
        portfolio_url: form.portfolioUrl || null,
        github_url: form.githubUrl || null,
        linkedin_url: form.linkedinUrl || null,
        education: form.education || null,
        experience: form.experience.map((item) => item.trim()).filter(Boolean).join('\n\n---\n\n') || null,
        projects: form.projects.map((item) => item.trim()).filter(Boolean).join('\n\n---\n\n') || null,
        open_to_work: toBoolean(form.openToWork),
        visibility_to_employers: form.visibilityToEmployers,
      };

      const { error: saveError } = await supabase.from('candidate_profiles').upsert(payload);
      if (saveError) throw saveError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({ full_name: form.fullName || null, onboarding_completed: true })
        .eq('id', currentSession.user.id);
      if (profileError) throw profileError;

      navigate('/candidate/dashboard', { replace: true });
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
    <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto grid w-full max-w-[1240px] gap-5 xl:grid-cols-[1.3fr_0.7fr]">
        <div className="overflow-hidden rounded-[32px] border border-[#D3D1C7] bg-[#FBFAF7] shadow-[0_24px_70px_rgba(26,26,26,0.06)]">
          <div className="border-b border-[#D3D1C7] bg-[linear-gradient(135deg,#F7F6F2_0%,#E1F5EE_100%)] p-5 sm:p-7">
            <Link
              to="/candidate/dashboard"
              className="mb-4 inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-white/80 px-3 py-2 text-[13px] text-[#5F5E5A] transition-all duration-200 hover:border-[#5DCAA5] hover:bg-white hover:text-[#1A1A1A] active:scale-[0.98]"
            >
              <ArrowLeft size={14} /> Back to dashboard
            </Link>

            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-4">
                <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl bg-[#1D9E75] text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)]">
                  {form.avatarUrl ? (
                    <img src={form.avatarUrl} alt="Profile" className="h-full w-full object-cover" />
                  ) : (
                    <Camera size={24} />
                  )}
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#085041]/70">
                    Candidate profile
                  </div>
                  <div className="mt-1 text-2xl font-bold text-[#1A1A1A]">
                    {form.fullName || 'Your profile'}
                  </div>
                  <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[#5F5E5A]">
                    Shape your public profile into a polished, employer-ready snapshot.
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-2 rounded-full border border-[#5DCAA5]/40 bg-white/80 px-3 py-2 text-sm font-semibold text-[#085041] shadow-sm">
                <FileText size={14} />
                {form.openToWork ? 'Open to work' : 'Not open to work'}
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7">
            {error && (
              <div className="mb-5 rounded-2xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
                {error}
              </div>
            )}

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="rounded-[24px] border border-[#D3D1C7] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold text-[#1A1A1A]">Profile essentials</div>
                    <div className="text-xs text-[#B4B2A9]">Add a photo and CV</div>
                  </div>
                  <div className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-semibold text-[#085041]">
                    Essentials
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-3 transition-all duration-200 hover:border-[#5DCAA5]">
                    <div>
                      <div className="text-sm font-semibold text-[#1A1A1A]">Profile photo</div>
                      <div className="text-xs text-[#5F5E5A]">Upload a clear headshot</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl bg-[#1D9E75] px-3 py-2 text-xs font-semibold text-white">
                      <Upload size={14} />
                      {uploadingAvatar ? 'Uploading...' : 'Upload'}
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploadingAvatar}
                      onChange={(e) => handleAvatarUpload(e.target.files?.[0] || null)}
                    />
                  </label>

                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-[18px] border border-[#D3D1C7] bg-white px-3 py-3 transition-all duration-200 hover:border-[#5DCAA5]">
                    <div>
                      <div className="text-sm font-semibold text-[#1A1A1A]">Resume / CV</div>
                      <div className="text-xs text-[#5F5E5A]">PDF, DOC, or DOCX</div>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-xs font-semibold text-[#1A1A1A]">
                      <Upload size={14} />
                      {uploadingResume ? 'Uploading...' : form.resumeUrl ? 'Replace' : 'Upload'}
                    </div>
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      disabled={uploadingResume}
                      onChange={(e) => handleResumeUpload(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                {form.resumeUrl && (
                  <a
                    href={form.resumeUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex text-xs font-semibold text-[#1D9E75] hover:underline"
                  >
                    View uploaded CV
                  </a>
                )}
              </div>

              <div className="rounded-[24px] border border-[#D3D1C7] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Visibility and discoverability</div>
                <div className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                  Employers see your headline, skills, experience, and availability.
                </div>
                <label className="mt-3 flex items-center justify-between gap-3 rounded-[18px] border border-[#D3D1C7] bg-white px-3 py-3 text-sm text-[#5F5E5A]">
                  <span>Open to work</span>
                  <input
                    type="checkbox"
                    checked={form.openToWork}
                    onChange={(e) => updateField('openToWork', e.target.checked)}
                  />
                </label>
                <div className="mt-3">
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
              </div>
            </div>

            <div className="mt-5 space-y-4">
              <section className="rounded-[24px] border border-[#D3D1C7] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                <div className="mb-4 text-sm font-semibold text-[#1A1A1A]">Core details</div>
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
                  <Field label="WhatsApp number">
                    <input className="admin-input" value={form.whatsappNumber} onChange={(e) => updateField('whatsappNumber', e.target.value)} placeholder="+234..." />
                  </Field>
                  <Field label="Years of experience">
                    <input className="admin-input" type="number" min="0" value={form.yearsExperience} onChange={(e) => updateField('yearsExperience', e.target.value)} placeholder="3" />
                  </Field>
                  <Field label="Availability">
                    <input className="admin-input" value={form.availability} onChange={(e) => updateField('availability', e.target.value)} placeholder="Immediately available" />
                  </Field>
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
                </div>
              </section>

              <section className="rounded-[24px] border border-[#D3D1C7] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                <div className="mb-4 text-sm font-semibold text-[#1A1A1A]">Profile story</div>
                <div className="grid gap-4">
                  <Field label="Bio">
                    <textarea className="admin-input min-h-[120px] resize-y" value={form.bio} onChange={(e) => updateField('bio', e.target.value)} placeholder="Tell employers a little about yourself." />
                  </Field>
                  <Field label="Skills">
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {form.skills.map((skill) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => removeSkill(skill)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]"
                          >
                            {skill}
                            <X size={12} />
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedSkills
                          .filter((skill) => !form.skills.includes(skill))
                          .slice(0, 8)
                          .map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => {
                                updateField('skills', [...form.skills, skill]);
                              }}
                              className="rounded-full border border-[#D3D1C7] bg-white px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]"
                            >
                              + {skill}
                            </button>
                          ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          className="admin-input flex-1"
                          value={skillInput}
                          onChange={(e) => setSkillInput(e.target.value)}
                          onKeyDown={handleSkillKeyDown}
                          placeholder="Type a skill and press Enter"
                        />
                        <button type="button" onClick={addSkill} className="rounded-xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm font-semibold text-[#1A1A1A]">
                          Add
                        </button>
                      </div>
                    </div>
                  </Field>
                  <Field label="Preferred locations">
                    <input className="admin-input" value={form.preferredLocations} onChange={(e) => updateField('preferredLocations', e.target.value)} placeholder="Remote, Lagos, Abuja" />
                  </Field>
                </div>
              </section>

              <section className="rounded-[24px] border border-[#D3D1C7] bg-white p-4 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-[#1A1A1A]">Experience, projects and links</div>
                  <div className="rounded-full bg-[#E1F5EE] px-2.5 py-1 text-[11px] font-semibold text-[#085041]">Builder</div>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
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
                  <div className="sm:col-span-2 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Experience</div>
                    {form.experience.map((item, index) => (
                      <div key={`experience-${index}`} className="rounded-[16px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Entry {index + 1}</span>
                          {form.experience.length > 1 && (
                            <button type="button" onClick={() => removeListItem('experience', index)} className="text-xs font-semibold text-[#B74D3A]">
                              Remove
                            </button>
                          )}
                        </div>
                        <textarea className="admin-input min-h-[100px] resize-y" value={item} onChange={(e) => updateListItem('experience', index, e.target.value)} placeholder="Role, company, achievements, dates" />
                      </div>
                    ))}
                    <button type="button" onClick={() => addListItem('experience')} className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]">
                      <Plus size={12} /> Add another
                    </button>
                  </div>
                  <div className="sm:col-span-2 space-y-2">
                    <div className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Projects</div>
                    {form.projects.map((item, index) => (
                      <div key={`project-${index}`} className="rounded-[16px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">Entry {index + 1}</span>
                          {form.projects.length > 1 && (
                            <button type="button" onClick={() => removeListItem('projects', index)} className="text-xs font-semibold text-[#B74D3A]">
                              Remove
                            </button>
                          )}
                        </div>
                        <textarea className="admin-input min-h-[100px] resize-y" value={item} onChange={(e) => updateListItem('projects', index, e.target.value)} placeholder="Project name, impact, tools used" />
                      </div>
                    ))}
                    <button type="button" onClick={() => addListItem('projects')} className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]">
                      <Plus size={12} /> Add another
                    </button>
                  </div>
                </div>
              </section>
            </div>

            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)] transition-all duration-200 hover:bg-[#168a63] active:scale-[0.98] disabled:opacity-60"
            >
              <Save size={16} />
              {saving ? 'Saving...' : 'Save profile'}
            </button>
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_16px_40px_rgba(26,26,26,0.05)]">
            <div className="text-sm font-semibold text-[#1A1A1A]">Why it matters</div>
            <p className="mt-2 text-sm leading-relaxed text-[#5F5E5A]">
              A stronger profile helps employers understand your background faster.
            </p>
          </div>
          <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_16px_40px_rgba(26,26,26,0.05)]">
            <div className="text-sm font-semibold text-[#1A1A1A]">What employers notice</div>
            <ul className="mt-3 space-y-2 text-sm text-[#5F5E5A]">
              <li>• Clear headline and summary</li>
              <li>• Relevant skills and experience</li>
              <li>• Portfolio and GitHub links</li>
              <li>• Current availability status</li>
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
    <label className="block rounded-[16px] border border-[#D3D1C7] bg-[#FBFAF7] p-3 shadow-[0_6px_18px_rgba(26,26,26,0.02)]">
      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
        {label}
      </span>
      {children}
    </label>
  );
}

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  BadgeCheck,
  Briefcase,
  Camera,
  Check,
  Download,
  FileText,
  Github,
  GraduationCap,
  Linkedin,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { CandidateProfile, Profile } from '../types';
import { calculateProfileCompletion } from '../lib/profileCompletion';
import LoadingSpinner from '../components/LoadingSpinner';
import AvatarCropModal from '../components/AvatarCropModal';

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

type EditableSection = 'about' | 'contact' | 'preferences' | 'skills' | 'experience' | 'projects' | 'education';

type ExperienceDraft = {
  title: string;
  company: string;
  dates: string;
  details: string;
};

const emptyExperienceDraft = (): ExperienceDraft => ({
  title: '',
  company: '',
  dates: '',
  details: '',
});

function looksLikeDates(value: string) {
  return /\d{4}|present|current|[-–—]/i.test(value);
}

function parseExperienceEntry(entry: string): ExperienceDraft {
  const lines = entry
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const [firstLine = '', secondLine = '', thirdLine = '', ...remainingLines] = lines;
  const titleParts = firstLine.split('|').map((part) => part.trim());
  const title = titleParts[0] || '';
  let company = titleParts[1] || '';
  let dates = '';
  let details = '';

  if (company) {
    dates = secondLine;
    details = [thirdLine, ...remainingLines].filter(Boolean).join('\n');
  } else if (looksLikeDates(secondLine)) {
    dates = secondLine;
    details = [thirdLine, ...remainingLines].filter(Boolean).join('\n');
  } else {
    company = secondLine;
    dates = thirdLine;
    details = remainingLines.join('\n');
  }

  return { title, company, dates, details };
}

function parseExperienceEntries(value: string | null | undefined): ExperienceDraft[] {
  const entries = (value || '')
    .split(/\n\s*---\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseExperienceEntry);

  return entries.length ? entries : [emptyExperienceDraft()];
}

function serializeExperienceEntries(entries: ExperienceDraft[]) {
  return entries
    .map((entry) => [entry.title, entry.company, entry.dates, entry.details].map((value) => value.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n---\n\n') || null;
}

type ProjectDraft = {
  name: string;
  tools: string;
  details: string;
};

const emptyProjectDraft = (): ProjectDraft => ({ name: '', tools: '', details: '' });

function parseProjectEntry(entry: string): ProjectDraft {
  const lines = entry
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    name: lines[0] || '',
    tools: lines[1] || '',
    details: lines.slice(2).join('\n'),
  };
}

function parseProjectEntries(value: string | null | undefined): ProjectDraft[] {
  const entries = (value || '')
    .split(/\n\s*---\s*\n/)
    .map((item) => item.trim())
    .filter(Boolean)
    .map(parseProjectEntry);

  return entries.length ? entries : [emptyProjectDraft()];
}

function serializeProjectEntries(entries: ProjectDraft[]) {
  return entries
    .map((entry) => [entry.name, entry.tools, entry.details].map((value) => value.trim()).filter(Boolean).join('\n'))
    .filter(Boolean)
    .join('\n\n---\n\n') || null;
}

type EducationDraft = {
  institution: string;
  qualification: string;
  dates: string;
  details: string;
};

const emptyEducationDraft = (): EducationDraft => ({ institution: '', qualification: '', dates: '', details: '' });

function parseEducationEntry(value: string | null | undefined): EducationDraft {
  const lines = (value || '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    institution: lines[0] || '',
    qualification: lines[1] || '',
    dates: lines[2] || '',
    details: lines.slice(3).join('\n'),
  };
}

function serializeEducationEntry(entry: EducationDraft) {
  return [entry.institution, entry.qualification, entry.dates, entry.details]
    .map((value) => value.trim())
    .filter(Boolean)
    .join('\n');
}

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [editingSection, setEditingSection] = useState<EditableSection | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionDraft, setSectionDraft] = useState<Record<string, string | boolean>>({});
  const [skillsDraft, setSkillsDraft] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [experienceDraft, setExperienceDraft] = useState<ExperienceDraft[]>([emptyExperienceDraft()]);
  const [projectsDraft, setProjectsDraft] = useState<ProjectDraft[]>([emptyProjectDraft()]);
  const [educationDraft, setEducationDraft] = useState<EducationDraft>(emptyEducationDraft());
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [avatarMenuOpen, setAvatarMenuOpen] = useState(false);
  const [cropSourceFile, setCropSourceFile] = useState<File | null>(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?mode=login', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type === 'employer') {
          navigate('/employer/dashboard', { replace: true });
          return;
        }

        setProfile(nextProfile);
        setUserId(session.user.id);
        setEmail(session.user.email || '');

        const { data: candidateRow } = await supabase
          .from('candidate_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (!alive) return;

        setCandidateProfile((candidateRow || null) as CandidateProfile | null);
      } catch (loadError) {
        if (alive) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load your account.');
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

  const profileInitials =
    profile?.full_name
      ?.trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0])
      .join('')
      .toUpperCase() || 'RW';

  const startEditingSection = (section: EditableSection) => {
    setError('');
    setEditingSection(section);

    if (section === 'about') {
      setSectionDraft({
        full_name: profile?.full_name || '',
        headline: candidateProfile?.headline || '',
        bio: candidateProfile?.bio || '',
        location: candidateProfile?.location || '',
        years_experience: candidateProfile?.years_experience?.toString() || '',
        work_authorization: candidateProfile?.work_authorization || '',
      });
      return;
    }

    if (section === 'contact') {
      setSectionDraft({
        whatsapp_number: candidateProfile?.whatsapp_number || '',
        github_url: candidateProfile?.github_url || '',
        linkedin_url: candidateProfile?.linkedin_url || '',
        portfolio_url: candidateProfile?.portfolio_url || '',
      });
      return;
    }

    if (section === 'preferences') {
      setSectionDraft({
        preferred_salary: candidateProfile?.preferred_salary || '',
        work_preference: candidateProfile?.work_preference || 'Remote',
        preferred_locations: candidateProfile?.preferred_locations?.join(', ') || '',
        availability: candidateProfile?.availability || 'Immediately available',
        open_to_work: candidateProfile?.open_to_work ?? true,
        visibility_to_employers: candidateProfile?.visibility_to_employers || 'open',
      });
      return;
    }

    if (section === 'skills') {
      setSkillsDraft(candidateProfile?.skills ? [...candidateProfile.skills] : []);
      setSkillInput('');
      return;
    }

    if (section === 'experience') {
      setExperienceDraft(parseExperienceEntries(candidateProfile?.experience));
      return;
    }

    if (section === 'projects') {
      setProjectsDraft(parseProjectEntries(candidateProfile?.projects));
      return;
    }

    if (section === 'education') {
      setEducationDraft(parseEducationEntry(candidateProfile?.education));
    }
  };

  const updateSectionDraft = (field: string, value: string | boolean) => {
    setSectionDraft((prev) => ({ ...prev, [field]: value }));
  };

  const addDraftSkill = () => {
    const nextSkill = skillInput.trim();
    if (!nextSkill) return;
    if (skillsDraft.includes(nextSkill)) {
      setSkillInput('');
      return;
    }
    setSkillsDraft((prev) => [...prev, nextSkill]);
    setSkillInput('');
  };

  const removeDraftSkill = (skill: string) => {
    setSkillsDraft((prev) => prev.filter((item) => item !== skill));
  };

  const handleSkillInputKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftSkill();
    }
  };

  const updateExperienceDraft = (index: number, field: keyof ExperienceDraft, value: string) => {
    setExperienceDraft((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const updateProjectDraft = (index: number, field: keyof ProjectDraft, value: string) => {
    setProjectsDraft((prev) =>
      prev.map((item, itemIndex) => (itemIndex === index ? { ...item, [field]: value } : item))
    );
  };

  const addExperienceDraft = () => setExperienceDraft((prev) => [...prev, emptyExperienceDraft()]);
  const addProjectDraft = () => setProjectsDraft((prev) => [...prev, emptyProjectDraft()]);
  const removeExperienceDraft = (index: number) => setExperienceDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  const removeProjectDraft = (index: number) => setProjectsDraft((prev) => prev.filter((_, itemIndex) => itemIndex !== index));

  const cancelEditingSection = () => {
    setEditingSection(null);
    setSectionDraft({});
    setSkillsDraft([]);
    setSkillInput('');
    setExperienceDraft([emptyExperienceDraft()]);
    setProjectsDraft([emptyProjectDraft()]);
    setEducationDraft(emptyEducationDraft());
    setError('');
  };

  const saveSectionChanges = async () => {
    if (!userId || !editingSection) return;

    setSavingSection(true);
    setError('');

    try {
      const updates: Record<string, unknown> = {};
      let nextFullName: string | null = null;

      if (editingSection === 'about') {
        nextFullName = String(sectionDraft.full_name ?? '').trim();
        updates.headline = sectionDraft.headline ?? '';
        updates.bio = sectionDraft.bio ?? '';
        updates.location = sectionDraft.location ?? '';
        updates.years_experience = sectionDraft.years_experience ? Number(sectionDraft.years_experience) : null;
        updates.work_authorization = sectionDraft.work_authorization ?? '';
      }

      if (editingSection === 'contact') {
        updates.whatsapp_number = sectionDraft.whatsapp_number ?? '';
        updates.github_url = sectionDraft.github_url ?? '';
        updates.linkedin_url = sectionDraft.linkedin_url ?? '';
        updates.portfolio_url = sectionDraft.portfolio_url ?? '';
      }

      if (editingSection === 'preferences') {
        updates.preferred_salary = sectionDraft.preferred_salary ?? '';
        updates.work_preference = sectionDraft.work_preference ?? 'Remote';
        updates.preferred_locations = String(sectionDraft.preferred_locations ?? '')
          .split(',')
          .map((item) => item.trim())
          .filter(Boolean);
        updates.availability = sectionDraft.availability ?? 'Immediately available';
        updates.open_to_work = Boolean(sectionDraft.open_to_work);
        updates.visibility_to_employers = sectionDraft.visibility_to_employers ?? 'open';
      }

      if (editingSection === 'skills') {
        updates.skills = skillsDraft.map((item) => item.trim()).filter(Boolean);
      }

      if (editingSection === 'experience') {
        updates.experience = serializeExperienceEntries(experienceDraft);
      }

      if (editingSection === 'projects') {
        updates.projects = serializeProjectEntries(projectsDraft);
      }

      if (editingSection === 'education') {
        updates.education = serializeEducationEntry(educationDraft) || null;
      }

      const { error: updateError } = await supabase.from('candidate_profiles').update(updates).eq('id', userId);
      if (updateError) throw updateError;

      if (nextFullName !== null) {
        const { error: profileError } = await supabase
          .from('profiles')
          .update({ full_name: nextFullName || null })
          .eq('id', userId);
        if (profileError) throw profileError;
        setProfile((prev) => (prev ? { ...prev, full_name: nextFullName } : prev));
      }

      setCandidateProfile((prev) => (prev ? { ...prev, ...(updates as Partial<CandidateProfile>) } : prev));
      setEditingSection(null);
      setSectionDraft({});
      setSkillsDraft([]);
      setExperienceDraft([emptyExperienceDraft()]);
      setProjectsDraft([emptyProjectDraft()]);
      setEducationDraft(emptyEducationDraft());
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save changes.');
    } finally {
      setSavingSection(false);
    }
  };

  const MIN_AVATAR_DIMENSION = 300;

  const readImageDimensions = (file: File): Promise<{ width: number; height: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(url);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Could not read that image file.'));
      };
      img.src = url;
    });
  };

  const uploadCandidateFile = async (file: File, folder: 'avatars' | 'resumes') => {
    if (!userId) throw new Error('Please sign in again.');
    const extension = file.name.split('.').pop()?.toLowerCase() || 'file';
    const fileName = `${userId}/${folder}/${Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from('candidate-assets')
      .upload(fileName, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data } = supabase.storage.from('candidate-assets').getPublicUrl(fileName);
    return data.publicUrl;
  };

  const handleAvatarFileChange = async (file: File | null) => {
    if (!file || !userId) return;
    setError('');

    try {
      if (!file.type.startsWith('image/')) throw new Error('Please upload an image file.');

      const { width, height } = await readImageDimensions(file);
      if (width < MIN_AVATAR_DIMENSION || height < MIN_AVATAR_DIMENSION) {
        throw new Error(
          `Please upload a clearer photo, at least ${MIN_AVATAR_DIMENSION}×${MIN_AVATAR_DIMENSION}px. This one is ${width}×${height}px.`
        );
      }

      setCropSourceFile(file);
    } catch (validationError) {
      setError(validationError instanceof Error ? validationError.message : 'Could not read that image.');
    } finally {
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    }
  };

  const handleCropConfirm = async (croppedFile: File) => {
    if (!userId) return;
    setUploadingAvatar(true);
    setError('');
    setCropSourceFile(null);

    try {
      const publicUrl = await uploadCandidateFile(croppedFile, 'avatars');

      const { error: updateError } = await supabase
        .from('candidate_profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);
      if (updateError) throw updateError;

      setCandidateProfile((prev) => (prev ? { ...prev, avatar_url: publicUrl } : prev));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleRemoveAvatar = async () => {
    if (!userId) return;
    setAvatarMenuOpen(false);
    const shouldRemove = window.confirm('Remove your profile picture?');
    if (!shouldRemove) return;

    setUploadingAvatar(true);
    setError('');

    try {
      const { error: updateError } = await supabase
        .from('candidate_profiles')
        .update({ avatar_url: null })
        .eq('id', userId);
      if (updateError) throw updateError;

      setCandidateProfile((prev) => (prev ? { ...prev, avatar_url: null } : prev));
    } catch (removeError) {
      setError(removeError instanceof Error ? removeError.message : 'Could not remove profile picture.');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleResumeFileChange = async (file: File | null) => {
    if (!file || !userId) return;
    setUploadingResume(true);
    setError('');

    try {
      const allowedTypes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Please upload a PDF, DOC, or DOCX CV.');
      }

      const publicUrl = await uploadCandidateFile(file, 'resumes');

      const { error: updateError } = await supabase
        .from('candidate_profiles')
        .update({ resume_url: publicUrl, resume_name: file.name })
        .eq('id', userId);
      if (updateError) throw updateError;

      setCandidateProfile((prev) => (prev ? { ...prev, resume_url: publicUrl, resume_name: file.name } : prev));
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload CV.');
    } finally {
      setUploadingResume(false);
      if (resumeInputRef.current) resumeInputRef.current.value = '';
    }
  };
  const profileSkills = (candidateProfile?.skills || []).slice(0, 6);
  const profileCompletion = calculateProfileCompletion(profile, candidateProfile);
  const contactItems = [
    { icon: Mail, label: email || 'Email not set', href: email ? `mailto:${email}` : undefined },
    {
      icon: Phone,
      label: candidateProfile?.whatsapp_number || 'WhatsApp not set',
      href: candidateProfile?.whatsapp_number ? `https://wa.me/${candidateProfile.whatsapp_number.replace(/[^0-9]/g, '')}` : undefined,
    },
    { icon: Github, label: candidateProfile?.github_url || 'GitHub not set', href: candidateProfile?.github_url || undefined },
    { icon: Linkedin, label: candidateProfile?.linkedin_url || 'LinkedIn not set', href: candidateProfile?.linkedin_url || undefined },
  ];
  const resumeDisplayName = candidateProfile?.resume_name || candidateProfile?.resume_url?.split('/').pop()?.split('?')[0] || 'candidate-cv.pdf';

  const handleDownloadCv = async () => {
    if (!candidateProfile?.resume_url) return;

    try {
      const response = await fetch(candidateProfile.resume_url);
      if (!response.ok) throw new Error('Could not download CV.');

      const blob = await response.blob();
      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = resumeDisplayName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      console.error(downloadError);
      window.open(candidateProfile.resume_url, '_blank', 'noopener,noreferrer');
    }
  };

  const visibilityLabels: Record<string, string> = {
    open: 'Visible to employers',
    not_open: 'Not open, but visible',
    hidden: 'Hidden from employers',
  };

  const preferences = [
    { label: 'Work style', value: candidateProfile?.work_preference || 'Not set' },
    { label: 'Salary', value: candidateProfile?.preferred_salary || 'Not set' },
    {
      label: 'Locations',
      value: candidateProfile?.preferred_locations?.length
        ? candidateProfile.preferred_locations.join(', ')
        : 'Not set',
    },
    {
      label: 'Visibility',
      value: visibilityLabels[candidateProfile?.visibility_to_employers || 'open'],
    },
  ];

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-4">
        <button
          type="button"
          onClick={() => navigate('/jobs')}
          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-2 text-xs font-semibold text-[#5F5E5A] shadow-sm transition-colors hover:text-[#1A1A1A] md:hidden"
        >
          <ArrowLeft size={14} /> Back to jobs
        </button>
        <div className="overflow-hidden rounded-[32px] border border-[#D3D1C7] bg-[#FBFAF7] shadow-[0_24px_70px_rgba(26,26,26,0.06)]">
          <div className="border-b border-[#D3D1C7] bg-[linear-gradient(135deg,#F7F6F2_0%,#E1F5EE_100%)] p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setAvatarMenuOpen((prev) => !prev)}
                    disabled={uploadingAvatar}
                    className="group relative flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-[#1D9E75] text-2xl font-bold text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)] transition active:scale-[0.97]"
                    title="Click to change photo (at least 300×300px)"
                  >
                    {candidateProfile?.avatar_url ? (
                      <img
                        src={candidateProfile.avatar_url}
                        alt={profile?.full_name || 'Candidate profile'}
                        className="h-full w-full rounded-[24px] object-cover"
                      />
                    ) : (
                      profileInitials
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/40 group-hover:opacity-100">
                      {uploadingAvatar ? (
                        <span className="text-[10px] font-semibold">Uploading...</span>
                      ) : (
                        <Camera size={18} />
                      )}
                    </div>
                  </button>
                  <input
                    ref={avatarInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploadingAvatar}
                    onChange={(event) => handleAvatarFileChange(event.target.files?.[0] || null)}
                  />

                  {avatarMenuOpen && (
                    <>
                      <div className="fixed inset-0 z-10" onClick={() => setAvatarMenuOpen(false)} />
                      <div className="absolute left-0 top-[calc(100%+8px)] z-20 w-44 overflow-hidden rounded-xl border border-line bg-white shadow-card-hover">
                        <button
                          type="button"
                          onClick={() => {
                            setAvatarMenuOpen(false);
                            avatarInputRef.current?.click();
                          }}
                          className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-ink transition-colors hover:bg-[#F1EFE8]"
                        >
                          <Camera size={14} /> Upload photo
                        </button>
                        {candidateProfile?.avatar_url && (
                          <button
                            type="button"
                            onClick={handleRemoveAvatar}
                            className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#B3261E] transition-colors hover:bg-[#FAECE7]"
                          >
                            <Trash2 size={14} /> Remove photo
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>

                {cropSourceFile && (
                  <AvatarCropModal
                    file={cropSourceFile}
                    onCancel={() => setCropSourceFile(null)}
                    onConfirm={handleCropConfirm}
                  />
                )}

                <div className="max-w-2xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/80 px-3 py-1 text-xs font-semibold text-[#085041] shadow-sm">
                    <BadgeCheck size={12} /> Candidate dashboard
                  </div>
                  <h1 className="font-display text-3xl font-bold text-[#1A1A1A] sm:text-4xl">
                    {profile?.full_name || 'Your profile'}
                  </h1>
                  <p className="mt-1 text-sm font-medium text-[#5F5E5A]">
                    {candidateProfile?.headline || 'Add a headline that tells employers what you do best'}
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-[#5F5E5A]">
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin size={14} /> {candidateProfile?.location || 'Location not set'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Briefcase size={14} />{' '}
                      {candidateProfile?.years_experience
                        ? `${candidateProfile.years_experience} years experience`
                        : 'Experience not set'}
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles size={14} /> {candidateProfile?.work_preference || 'Work preference not set'}
                    </span>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {profileSkills.length > 0 ? (
                      profileSkills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full border border-[#D3D1C7] bg-white/80 px-3 py-1 text-xs font-semibold text-[#5F5E5A] shadow-sm"
                        >
                          {skill}
                        </span>
                      ))
                    ) : (
                      <span className="text-sm text-[#5F5E5A]">Add skills to make this profile easier to scan.</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex flex-col items-start gap-3 lg:items-end">
                <div className="inline-flex items-center gap-2 rounded-full bg-[#F3F7ED] px-3 py-1 text-xs font-semibold text-[#6B7D3A] shadow-sm">
                  {candidateProfile?.open_to_work ? 'Open to work' : 'Not open to work'}
                </div>
                <div className="rounded-[20px] border border-[#D3D1C7] bg-white/80 px-3 py-2.5 shadow-sm">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#B4B2A9]">Profile strength</div>
                  <div className="mt-2 h-2 w-40 rounded-full bg-[#E1F5EE]">
                    <div className="h-2 rounded-full bg-[#1D9E75]" style={{ width: `${Math.max(6, profileCompletion)}%` }} />
                  </div>
                  <div className="mt-2 text-xs text-[#5F5E5A]">You’re {profileCompletion}% ready for employers.</div>
                </div>
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-6 lg:p-7">
            {error && (
              <div className="mb-5 rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
                {error}
              </div>
            )}

            <div className="grid gap-4 xl:grid-cols-[1.15fr_320px]">
              <div className="space-y-4">
                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">About</div>
                    {editingSection === 'about' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('about')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'about' ? (
                    <div className="space-y-3">
                      <input
                        value={(sectionDraft.full_name as string) || ''}
                        onChange={(event) => updateSectionDraft('full_name', event.target.value)}
                        placeholder="Full name"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.headline as string) || ''}
                        onChange={(event) => updateSectionDraft('headline', event.target.value)}
                        placeholder="Headline"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <textarea
                        value={(sectionDraft.bio as string) || ''}
                        onChange={(event) => updateSectionDraft('bio', event.target.value)}
                        placeholder="Tell employers who you are and what you do best"
                        rows={4}
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <div className="grid gap-3 sm:grid-cols-2">
                        <input
                          value={(sectionDraft.location as string) || ''}
                          onChange={(event) => updateSectionDraft('location', event.target.value)}
                          placeholder="Location"
                          className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                        />
                        <input
                          value={(sectionDraft.years_experience as string) || ''}
                          onChange={(event) => updateSectionDraft('years_experience', event.target.value)}
                          placeholder="Years of experience"
                          className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                        />
                      </div>
                      <input
                        value={(sectionDraft.work_authorization as string) || ''}
                        onChange={(event) => updateSectionDraft('work_authorization', event.target.value)}
                        placeholder="Work authorization (e.g. Authorized to work in Nigeria)"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium text-[#1A1A1A]">
                        {candidateProfile?.headline || 'Add a headline that tells employers what you do best'}
                      </p>
                      <p className="text-sm leading-relaxed text-[#5F5E5A]">
                        {candidateProfile?.bio ||
                          'Add a short summary about your background, what you build, and the kind of roles you want.'}
                      </p>
                      {candidateProfile?.work_authorization && (
                        <p className="text-xs text-[#B4B2A9]">{candidateProfile.work_authorization}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Experience</div>
                    {editingSection === 'experience' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('experience')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'experience' ? (
                    <div className="space-y-3">
                      {experienceDraft.map((item, index) => (
                        <div key={`experience-draft-${index}`} className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                              Entry {index + 1}
                            </span>
                            {experienceDraft.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeExperienceDraft(index)}
                                className="text-xs font-semibold text-[#B74D3A]"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <div className="grid gap-2 sm:grid-cols-2">
                            <input
                              value={item.title}
                              onChange={(event) => updateExperienceDraft(index, 'title', event.target.value)}
                              placeholder="Job title"
                              className="w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A] outline-none ring-0"
                            />
                            <input
                              value={item.company}
                              onChange={(event) => updateExperienceDraft(index, 'company', event.target.value)}
                              placeholder="Company"
                              className="w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                            />
                          </div>
                          <input
                            value={item.dates}
                            onChange={(event) => updateExperienceDraft(index, 'dates', event.target.value)}
                            placeholder="Dates (e.g. 2025 – 2026)"
                            className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                          />
                          <textarea
                            value={item.details}
                            onChange={(event) => updateExperienceDraft(index, 'details', event.target.value)}
                            placeholder="Achievements and responsibilities"
                            rows={4}
                            className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addExperienceDraft}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]"
                      >
                        <Plus size={12} /> Add another
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {candidateProfile?.experience ? (
                        candidateProfile.experience
                          .split(/\n\s*---\s*\n/)
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((entry, index) => {
                            const parsedEntry = parseExperienceEntry(entry);

                            return (
                              <div
                                key={`experience-${index}`}
                                className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:p-5"
                              >
                                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                  <h3 className="font-display text-base font-semibold leading-tight text-[#1A1A1A] sm:text-lg">
                                    {parsedEntry.title || 'Experience'}
                                  </h3>
                                  {parsedEntry.dates && (
                                    <span className="text-xs font-medium text-[#8A8880]">{parsedEntry.dates}</span>
                                  )}
                                </div>
                                {parsedEntry.company && (
                                  <div className="mt-1 text-sm font-medium text-[#5F5E5A]">{parsedEntry.company}</div>
                                )}
                                {parsedEntry.details && (
                                  <p className="mt-3 whitespace-pre-line border-t border-[#E5E1D8] pt-3 text-sm leading-relaxed text-[#5F5E5A]">
                                    {parsedEntry.details}
                                  </p>
                                )}
                              </div>
                            );
                          })
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                          List your recent roles, responsibilities, and measurable outcomes here.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Projects</div>
                    {editingSection === 'projects' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('projects')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'projects' ? (
                    <div className="space-y-3">
                      {projectsDraft.map((item, index) => (
                        <div key={`project-draft-${index}`} className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                          <div className="mb-2 flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold uppercase tracking-[0.5px] text-[#5F5E5A]">
                              Entry {index + 1}
                            </span>
                            {projectsDraft.length > 1 && (
                              <button
                                type="button"
                                onClick={() => removeProjectDraft(index)}
                                className="text-xs font-semibold text-[#B74D3A]"
                              >
                                Remove
                              </button>
                            )}
                          </div>
                          <input
                            value={item.name}
                            onChange={(event) => updateProjectDraft(index, 'name', event.target.value)}
                            placeholder="Project name"
                            className="w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm font-semibold text-[#1A1A1A] outline-none ring-0"
                          />
                          <input
                            value={item.tools}
                            onChange={(event) => updateProjectDraft(index, 'tools', event.target.value)}
                            placeholder="Tools or stack (e.g. React, Supabase)"
                            className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                          />
                          <textarea
                            value={item.details}
                            onChange={(event) => updateProjectDraft(index, 'details', event.target.value)}
                            placeholder="What you built, your contribution, and the impact"
                            rows={4}
                            className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={addProjectDraft}
                        className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]"
                      >
                        <Plus size={12} /> Add another
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {candidateProfile?.projects ? (
                        candidateProfile.projects
                          .split(/\n\s*---\s*\n/)
                          .map((item) => item.trim())
                          .filter(Boolean)
                          .map((entry, index) => {
                            const parsedEntry = parseProjectEntry(entry);

                            return (
                              <div key={`project-${index}`} className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:p-5">
                                <h3 className="font-display text-base font-semibold leading-tight text-[#1A1A1A] sm:text-lg">
                                  {parsedEntry.name || 'Project'}
                                </h3>
                                {parsedEntry.tools && (
                                  <div className="mt-1 text-xs font-medium uppercase tracking-[0.08em] text-[#8A8880]">
                                    {parsedEntry.tools}
                                  </div>
                                )}
                                {parsedEntry.details && (
                                  <p className="mt-3 whitespace-pre-line border-t border-[#E5E1D8] pt-3 text-sm leading-relaxed text-[#5F5E5A]">
                                    {parsedEntry.details}
                                  </p>
                                )}
                              </div>
                            );
                          })
                      ) : (
                        <div className="rounded-[18px] border border-dashed border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                          Showcase a few projects that prove your skills and impact.
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#1A1A1A]">
                      <GraduationCap size={14} /> Education
                    </div>
                    {editingSection === 'education' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('education')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'education' ? (
                    <div>
                      <div className="grid gap-2 sm:grid-cols-2">
                        <input
                          value={educationDraft.institution}
                          onChange={(event) => setEducationDraft((prev) => ({ ...prev, institution: event.target.value }))}
                          placeholder="School or institution"
                          className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm font-semibold text-[#1A1A1A] outline-none ring-0"
                        />
                        <input
                          value={educationDraft.qualification}
                          onChange={(event) => setEducationDraft((prev) => ({ ...prev, qualification: event.target.value }))}
                          placeholder="Degree, certification, or course"
                          className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                        />
                      </div>
                      <input
                        value={educationDraft.dates}
                        onChange={(event) => setEducationDraft((prev) => ({ ...prev, dates: event.target.value }))}
                        placeholder="Dates (e.g. 2021 – 2025)"
                        className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <textarea
                        value={educationDraft.details}
                        onChange={(event) => setEducationDraft((prev) => ({ ...prev, details: event.target.value }))}
                        placeholder="Relevant focus, achievements, or additional details"
                        rows={3}
                        className="mt-2 w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                    </div>
                  ) : (
                    candidateProfile?.education ? (
                      <div className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-4 sm:p-5">
                        {(() => {
                          const parsedEducation = parseEducationEntry(candidateProfile.education);
                          return (
                            <>
                              <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                                <h3 className="font-display text-base font-semibold leading-tight text-[#1A1A1A] sm:text-lg">
                                  {parsedEducation.institution || 'Education'}
                                </h3>
                                {parsedEducation.dates && (
                                  <span className="text-xs font-medium text-[#8A8880]">{parsedEducation.dates}</span>
                                )}
                              </div>
                              {parsedEducation.qualification && (
                                <div className="mt-1 text-sm font-medium text-[#5F5E5A]">{parsedEducation.qualification}</div>
                              )}
                              {parsedEducation.details && (
                                <p className="mt-3 whitespace-pre-line border-t border-[#E5E1D8] pt-3 text-sm leading-relaxed text-[#5F5E5A]">
                                  {parsedEducation.details}
                                </p>
                              )}
                            </>
                          );
                        })()}
                      </div>
                    ) : (
                      <div className="rounded-[18px] border border-dashed border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                        Add your school, degree, certifications, or important training.
                      </div>
                    )
                  )}
                </div>
              </div>

              <div className="space-y-4">
                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Skills</div>
                    {editingSection === 'skills' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('skills')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'skills' ? (
                    <div className="space-y-2">
                      <div className="flex flex-wrap gap-2">
                        {skillsDraft.map((skill) => (
                          <button
                            key={skill}
                            type="button"
                            onClick={() => removeDraftSkill(skill)}
                            className="inline-flex items-center gap-1 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#1A1A1A]"
                          >
                            {skill} <X size={12} />
                          </button>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {suggestedSkills
                          .filter((skill) => !skillsDraft.includes(skill))
                          .slice(0, 8)
                          .map((skill) => (
                            <button
                              key={skill}
                              type="button"
                              onClick={() => setSkillsDraft((prev) => [...prev, skill])}
                              className="rounded-full border border-[#D3D1C7] bg-white px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]"
                            >
                              + {skill}
                            </button>
                          ))}
                      </div>
                      <div className="flex gap-2">
                        <input
                          value={skillInput}
                          onChange={(event) => setSkillInput(event.target.value)}
                          onKeyDown={handleSkillInputKeyDown}
                          placeholder="Type a skill and press Enter"
                          className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                        />
                        <button
                          type="button"
                          onClick={addDraftSkill}
                          className="rounded-xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm font-semibold text-[#1A1A1A]"
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {candidateProfile?.skills?.length ? (
                        candidateProfile.skills.map((skill) => (
                          <span
                            key={skill}
                            className="rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-2.5 py-1 text-xs font-semibold text-[#5F5E5A]"
                          >
                            {skill}
                          </span>
                        ))
                      ) : (
                        <p className="text-sm text-[#5F5E5A]">
                          Add skills so employers can find you for the right roles.
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Contact</div>
                    {editingSection === 'contact' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('contact')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'contact' ? (
                    <div className="space-y-3">
                      <input
                        value={(sectionDraft.whatsapp_number as string) || ''}
                        onChange={(event) => updateSectionDraft('whatsapp_number', event.target.value)}
                        placeholder="WhatsApp number"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.github_url as string) || ''}
                        onChange={(event) => updateSectionDraft('github_url', event.target.value)}
                        placeholder="GitHub URL"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.linkedin_url as string) || ''}
                        onChange={(event) => updateSectionDraft('linkedin_url', event.target.value)}
                        placeholder="LinkedIn URL"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.portfolio_url as string) || ''}
                        onChange={(event) => updateSectionDraft('portfolio_url', event.target.value)}
                        placeholder="Portfolio URL"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        {contactItems.map((item) => {
                          const Icon = item.icon;
                          const content = (
                            <div className="flex items-center gap-2 text-sm text-[#5F5E5A]">
                              <Icon size={14} />
                              <span className="break-all">{item.label}</span>
                            </div>
                          );

                          return item.href ? (
                            <a key={item.label} href={item.href} target="_blank" rel="noreferrer" className="block">
                              {content}
                            </a>
                          ) : (
                            <div key={item.label}>{content}</div>
                          );
                        })}
                      </div>
                      <p className="mt-3 text-xs leading-relaxed text-[#B4B2A9]">
                        Visible to employers only. Reach out directly, there is no in-app messaging.
                      </p>
                    </>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div className="text-sm font-semibold text-[#1A1A1A]">Preferences</div>
                    {editingSection === 'preferences' ? (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={saveSectionChanges}
                          disabled={savingSection}
                          className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-[#168a63] disabled:opacity-60"
                        >
                          <Check size={12} /> {savingSection ? 'Saving...' : 'Save'}
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditingSection}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-white px-3 py-1.5 text-xs font-semibold text-[#5F5E5A] transition hover:bg-[#F7F6F2]"
                        >
                          <X size={12} /> Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditingSection('preferences')}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] transition hover:bg-[#F2EEE7]"
                      >
                        <Pencil size={12} /> Edit
                      </button>
                    )}
                  </div>

                  {editingSection === 'preferences' ? (
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center justify-between rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2">
                        <span className="text-[#5F5E5A]">Open to work</span>
                        <input
                          type="checkbox"
                          checked={Boolean(sectionDraft.open_to_work)}
                          onChange={(event) => updateSectionDraft('open_to_work', event.target.checked)}
                          className="h-4 w-4 rounded border-[#D3D1C7] text-[#1D9E75] focus:ring-[#1D9E75]"
                        />
                      </div>
                      <input
                        value={(sectionDraft.work_preference as string) || ''}
                        onChange={(event) => updateSectionDraft('work_preference', event.target.value)}
                        placeholder="Work preference"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.preferred_salary as string) || ''}
                        onChange={(event) => updateSectionDraft('preferred_salary', event.target.value)}
                        placeholder="Preferred salary"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.preferred_locations as string) || ''}
                        onChange={(event) => updateSectionDraft('preferred_locations', event.target.value)}
                        placeholder="Preferred locations"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <input
                        value={(sectionDraft.availability as string) || ''}
                        onChange={(event) => updateSectionDraft('availability', event.target.value)}
                        placeholder="Availability"
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      />
                      <select
                        value={(sectionDraft.visibility_to_employers as string) || 'open'}
                        onChange={(event) => updateSectionDraft('visibility_to_employers', event.target.value)}
                        className="w-full rounded-2xl border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 text-sm text-[#1A1A1A] outline-none ring-0"
                      >
                        <option value="open">Visible to employers</option>
                        <option value="not_open">Not open, but visible</option>
                        <option value="hidden">Hidden from employers</option>
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-2 text-sm">
                      {preferences.map((item) => (
                        <div key={item.label} className="flex items-start justify-between gap-3">
                          <span className="text-[#B4B2A9]">{item.label}</span>
                          <span className="text-right text-[#1A1A1A]">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadCv}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)] transition-all duration-200 hover:bg-[#168a63] active:scale-[0.98] ${
                      candidateProfile?.resume_url ? '' : 'pointer-events-none opacity-60'
                    }`}
                  >
                    <Download size={16} /> Download CV
                  </button>

                  <label className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-[#D3D1C7] bg-[#FBFAF7] px-4 py-3 text-sm font-semibold text-[#1A1A1A] transition-all duration-200 hover:bg-[#F2EEE7] active:scale-[0.98]">
                    <FileText size={16} />
                    {uploadingResume ? 'Uploading...' : candidateProfile?.resume_url ? 'Replace CV' : 'Upload CV'}
                    <input
                      ref={resumeInputRef}
                      type="file"
                      accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                      className="hidden"
                      disabled={uploadingResume}
                      onChange={(event) => handleResumeFileChange(event.target.files?.[0] || null)}
                    />
                  </label>
                  {candidateProfile?.resume_url && (
                    <p className="text-center text-xs text-[#B4B2A9]">{resumeDisplayName}</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

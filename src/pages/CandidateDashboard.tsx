import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Briefcase,
  Check,
  Download,
  Github,
  Linkedin,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Sparkles,
  X,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { CandidateProfile, Profile } from '../types';

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [editingSection, setEditingSection] = useState<'about' | 'contact' | 'preferences' | null>(null);
  const [savingSection, setSavingSection] = useState(false);
  const [sectionDraft, setSectionDraft] = useState<Record<string, string | boolean>>({});

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

  const startEditingSection = (section: 'about' | 'contact' | 'preferences') => {
    setError('');
    setEditingSection(section);

    if (section === 'about') {
      setSectionDraft({
        headline: candidateProfile?.headline || '',
        bio: candidateProfile?.bio || '',
        location: candidateProfile?.location || '',
        years_experience: candidateProfile?.years_experience?.toString() || '',
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

    setSectionDraft({
      preferred_salary: candidateProfile?.preferred_salary || '',
      work_preference: candidateProfile?.work_preference || 'Remote',
      preferred_locations: candidateProfile?.preferred_locations?.join(', ') || '',
      availability: candidateProfile?.availability || 'Immediately available',
      open_to_work: candidateProfile?.open_to_work ?? true,
    });
  };

  const updateSectionDraft = (field: string, value: string | boolean) => {
    setSectionDraft((prev) => ({ ...prev, [field]: value }));
  };

  const cancelEditingSection = () => {
    setEditingSection(null);
    setSectionDraft({});
    setError('');
  };

  const saveSectionChanges = async () => {
    if (!userId || !editingSection) return;

    setSavingSection(true);
    setError('');

    try {
      const updates: Record<string, unknown> = {};

      if (editingSection === 'about') {
        updates.headline = sectionDraft.headline ?? '';
        updates.bio = sectionDraft.bio ?? '';
        updates.location = sectionDraft.location ?? '';
        updates.years_experience = sectionDraft.years_experience ? Number(sectionDraft.years_experience) : null;
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
      }

      const { error: updateError } = await supabase.from('candidate_profiles').update(updates).eq('id', userId);
      if (updateError) throw updateError;

      setCandidateProfile((prev) => (prev ? { ...prev, ...(updates as Partial<CandidateProfile>) } : prev));
      setEditingSection(null);
      setSectionDraft({});
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Could not save changes.');
    } finally {
      setSavingSection(false);
    }
  };
  const profileSkills = (candidateProfile?.skills || []).slice(0, 6);
  const completionFields = [
    profile?.full_name,
    candidateProfile?.avatar_url,
    candidateProfile?.headline,
    candidateProfile?.bio,
    candidateProfile?.location,
    candidateProfile?.years_experience,
    candidateProfile?.skills?.length ? candidateProfile.skills.length : 0,
    candidateProfile?.preferred_locations?.length ? candidateProfile.preferred_locations.length : 0,
    candidateProfile?.preferred_salary,
    candidateProfile?.work_preference,
    candidateProfile?.availability,
    candidateProfile?.resume_url,
    candidateProfile?.portfolio_url,
    candidateProfile?.github_url,
    candidateProfile?.linkedin_url,
    candidateProfile?.education,
    candidateProfile?.experience,
    candidateProfile?.projects,
    candidateProfile?.whatsapp_number,
  ];
  const completedFields = completionFields.filter((value) => {
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
  }).length;
  const profileCompletion = Math.round((completedFields / completionFields.length) * 100);
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

  const preferences = [
    { label: 'Work style', value: candidateProfile?.work_preference || 'Not set' },
    { label: 'Salary', value: candidateProfile?.preferred_salary || 'Not set' },
    {
      label: 'Locations',
      value: candidateProfile?.preferred_locations?.length
        ? candidateProfile.preferred_locations.join(', ')
        : 'Not set',
    },
  ];

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel rounded-[24px] px-5 py-4 text-sm text-[#5F5E5A]">
          Loading candidate dashboard...
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-8">
      <div className="mx-auto w-full max-w-[1320px] space-y-4">
        <div className="overflow-hidden rounded-[32px] border border-[#D3D1C7] bg-[#FBFAF7] shadow-[0_24px_70px_rgba(26,26,26,0.06)]">
          <div className="border-b border-[#D3D1C7] bg-[linear-gradient(135deg,#F7F6F2_0%,#E1F5EE_100%)] p-5 sm:p-6 lg:p-7">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-[24px] bg-[#1D9E75] text-2xl font-bold text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)]">
                  {candidateProfile?.avatar_url ? (
                    <img
                      src={candidateProfile.avatar_url}
                      alt={profile?.full_name || 'Candidate profile'}
                      className="h-full w-full rounded-[24px] object-cover"
                    />
                  ) : (
                    profileInitials
                  )}
                </div>

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
                    </div>
                  )}
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Experience</div>
                  <div className="space-y-3">
                    {candidateProfile?.experience ? (
                      candidateProfile.experience
                        .split(/\n\s*---\s*\n/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((entry, index) => (
                          <div key={`experience-${index}`} className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                            <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">{entry}</p>
                          </div>
                        ))
                    ) : (
                      <div className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                        List your recent roles, responsibilities, and measurable outcomes here.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Projects</div>
                  <div className="space-y-3">
                    {candidateProfile?.projects ? (
                      candidateProfile.projects
                        .split(/\n\s*---\s*\n/)
                        .map((item) => item.trim())
                        .filter(Boolean)
                        .map((entry, index) => (
                          <div key={`project-${index}`} className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3">
                            <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">{entry}</p>
                          </div>
                        ))
                    ) : (
                      <div className="rounded-[18px] border border-[#D3D1C7] bg-[#FBFAF7] p-3 text-sm text-[#5F5E5A]">
                        Showcase a few projects that prove your skills and impact.
                      </div>
                    )}
                  </div>
                </div>

                <div className="rounded-[28px] border border-[#D3D1C7] bg-white p-5 shadow-[0_10px_24px_rgba(26,26,26,0.03)]">
                  <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Education</div>
                  <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">
                    {candidateProfile?.education ||
                      'Add your school, degree, certifications, or important training.'}
                  </p>
                </div>
              </div>

              <div className="space-y-4">
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

                <button
                  type="button"
                  onClick={handleDownloadCv}
                  className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white shadow-[0_12px_28px_rgba(29,158,117,0.18)] transition-all duration-200 hover:bg-[#168a63] active:scale-[0.98] ${
                    candidateProfile?.resume_url ? '' : 'pointer-events-none opacity-60'
                  }`}
                >
                  <Download size={16} /> Download CV
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
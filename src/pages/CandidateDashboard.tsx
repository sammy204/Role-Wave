import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Download,
  Github,
  Linkedin,
  Mail,
  MapPin,
  Briefcase,
  Phone,
  Sparkles,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import type { CandidateProfile, Profile } from '../types';

export default function CandidateDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [candidateProfile, setCandidateProfile] = useState<CandidateProfile | null>(null);
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');

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
  const profileSkills = (candidateProfile?.skills || []).slice(0, 6);
  const contactItems = [
    { icon: Mail, label: email || 'Email not set', href: email ? `mailto:${email}` : undefined },
    { icon: Phone, label: 'WhatsApp not set' },
    { icon: Github, label: candidateProfile?.github_url || 'GitHub not set', href: candidateProfile?.github_url || undefined },
    { icon: Linkedin, label: candidateProfile?.linkedin_url || 'LinkedIn not set', href: candidateProfile?.linkedin_url || undefined },
  ];
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
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="panel mb-5 overflow-hidden rounded-[32px] border border-[#D3D1C7] bg-white p-5 shadow-[0_16px_40px_rgba(26,26,26,0.06)] sm:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex h-20 w-20 items-center justify-center rounded-[24px] bg-[#E1F5EE] text-2xl font-bold text-[#085041]">
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
                <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-xs font-semibold text-[#085041]">
                  <BadgeCheck size={12} /> Profile
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
                        className="rounded-full border border-[#D3D1C7] bg-[#FBFAF7] px-3 py-1 text-xs font-semibold text-[#5F5E5A]"
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
              <div className="inline-flex items-center gap-2 rounded-full bg-[#F3F7ED] px-3 py-1 text-xs font-semibold text-[#6B7D3A]">
                {candidateProfile?.open_to_work ? 'Open to work' : 'Not open to work'}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-5 rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <div className="grid gap-4 xl:grid-cols-[1.15fr_320px]">
          <div className="space-y-4">
            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">About</div>
              <p className="text-sm leading-relaxed text-[#5F5E5A]">
                {candidateProfile?.bio ||
                  'Add a short summary about your background, what you build, and the kind of roles you want.'}
              </p>
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Experience</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">
                {candidateProfile?.experience ||
                  'List your recent roles, responsibilities, and measurable outcomes here.'}
              </p>
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Projects</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">
                {candidateProfile?.projects ||
                  'Showcase a few projects that prove your skills and impact.'}
              </p>
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Education</div>
              <p className="whitespace-pre-line text-sm leading-relaxed text-[#5F5E5A]">
                {candidateProfile?.education ||
                  'Add your school, degree, certifications, or important training.'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Contact</div>
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
            </div>

            <div className="panel rounded-[28px] p-5">
              <div className="mb-3 text-sm font-semibold text-[#1A1A1A]">Preferences</div>
              <div className="space-y-2 text-sm">
                {preferences.map((item) => (
                  <div key={item.label} className="flex items-start justify-between gap-3">
                    <span className="text-[#B4B2A9]">{item.label}</span>
                    <span className="text-right text-[#1A1A1A]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <a
              href={candidateProfile?.resume_url || '#'}
              target={candidateProfile?.resume_url ? '_blank' : undefined}
              rel={candidateProfile?.resume_url ? 'noreferrer' : undefined}
              className={`inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#1D9E75] px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#168a63] ${
                candidateProfile?.resume_url ? '' : 'pointer-events-none opacity-60'
              }`}
            >
              <Download size={16} /> Download CV
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

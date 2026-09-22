import { useEffect, useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, ArrowLeft, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import LoadingSpinner from '../components/LoadingSpinner';
import { uploadCandidateAsset } from '../lib/candidateAssets';

// A short, opinionated question flow shown once, right after signup, before a
// candidate ever sees the general job board. The goal is to capture just
// enough structured preference data — job type, field, skills, location,
// experience level — to power a personalized dashboard from the very first
// visit, instead of the generic feed everyone used to land on regardless of
// what they were actually looking for.
//
// Every answer here maps directly onto an existing candidate_profiles
// column, so this feeds the same structured data the (future) deterministic
// match engine will read from. Nothing here computes a match — it's purely
// preference capture.

const JOB_TYPE_OPTIONS = [
  { value: 'Full-time', description: 'A regular full-time role' },
  { value: 'Part-time', description: 'Part-time or flexible hours' },
  { value: 'Contract', description: 'Fixed-term or freelance work' },
  { value: 'Other', description: 'Another type of opportunity' },
];

const LOCATION_OPTIONS = ['Lagos', 'Abuja', 'Port Harcourt', 'Remote'];

const EXPERIENCE_OPTIONS = [
  { label: 'Still in school', years: 0 },
  { label: 'Recent graduate', years: 0 },
  { label: '1–3 years', years: 2 },
  { label: '3+ years', years: 5 },
];

const TOTAL_STEPS = 2;

type ParsedResume = {
  full_name: string;
  phone: string;
  country: string;
  headline: string;
  skills: string[];
  preferred_job_titles: string[];
  years_experience: number | null;
  education: string;
  experience: string;
};

export default function CandidateOnboarding() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [jobType, setJobType] = useState('');
  const [jobTitleInput, setJobTitleInput] = useState('');
  const [jobTitles, setJobTitles] = useState<string[]>([]);
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [locations, setLocations] = useState<string[]>([]);
  const [experienceLabel, setExperienceLabel] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [country, setCountry] = useState('');
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [resumePath, setResumePath] = useState<string | null>(null);
  const [parsedResume, setParsedResume] = useState<ParsedResume | null>(null);
  const [educationDraft, setEducationDraft] = useState('');
  const [experienceDraft, setExperienceDraft] = useState('');
  const [parsing, setParsing] = useState(false);

  useEffect(() => {
    let alive = true;

    void (async () => {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        navigate('/start?mode=login', { replace: true });
        return;
      }

      const { data: profileRow } = await supabase
        .from('profiles')
        .select('account_type, onboarding_completed, full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      if (!alive) return;

      if (profileRow?.account_type === 'employer') {
        navigate('/employer/dashboard', { replace: true });
        return;
      }

      if (profileRow?.onboarding_completed) {
        navigate('/candidate/dashboard', { replace: true });
        return;
      }

      const { data: candidateRow } = await supabase
        .from('candidate_profiles')
        .select('phone, country, resume_url, resume_name')
        .eq('id', session.user.id)
        .maybeSingle();

      const nameParts = (profileRow?.full_name || '').trim().split(/\s+/).filter(Boolean);
      setFirstName(nameParts[0] || '');
      setLastName(nameParts.slice(1).join(' '));
      setPhone(candidateRow?.phone || '');
      setCountry(candidateRow?.country || '');
      
      setUserId(session.user.id);
      setChecking(false);
    })();

    return () => {
      alive = false;
    };
  }, [navigate]);

  const addJobTitle = () => {
    const next = jobTitleInput.trim();
    if (!next || jobTitles.includes(next)) {
      setJobTitleInput('');
      return;
    }
    setJobTitles((prev) => [...prev, next]);
    setJobTitleInput('');
  };

  const addSkill = () => {
    const next = skillInput.trim();
    if (!next || skills.includes(next)) {
      setSkillInput('');
      return;
    }
    setSkills((prev) => [...prev, next]);
    setSkillInput('');
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>, onAdd: () => void) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      onAdd();
    }
  };

  const toggleLocation = (loc: string) => {
    setLocations((prev) => (prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]));
  };

  const canAdvance = () => step === 1
    ? Boolean(resumeFile)
    : Boolean(firstName.trim() && lastName.trim() && phone.trim() && country.trim() && jobType);

  const goNext = async () => {
    if (!canAdvance()) return;
    if (step === 1) {
      await parseResume();
      return;
    }
    await handleFinish();
  };

  const goBack = () => {
    if (step > 1) setStep((s) => s - 1);
  };

  const handleFinish = async () => {
    if (!userId) return;
    setSaving(true);
    setError('');

    try {
      const yearsExperience = parsedResume?.years_experience ?? EXPERIENCE_OPTIONS.find((o) => o.label === experienceLabel)?.years ?? 0;

      const { error: upsertError } = await supabase.from('candidate_profiles').upsert({
        id: userId,
        phone: phone.trim(),
        country: country.trim(),
        resume_url: resumePath,
        resume_name: resumeFile?.name || null,
        headline: parsedResume?.headline || null,
        education: educationDraft.trim() || null,
        experience: experienceDraft.trim() || null,
        job_type: jobType,
        preferred_job_titles: jobTitles,
        skills,
        preferred_locations: locations,
        years_experience: yearsExperience,
      });
      if (upsertError) throw upsertError;

      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          full_name: `${firstName.trim()} ${lastName.trim()}`,
          onboarding_completed: true,
          account_type: 'candidate',
        })
        .eq('id', userId);
      if (profileError) throw profileError;

      navigate('/candidate/dashboard', { replace: true });
    } catch (err) {
      setError('We couldn’t complete your onboarding. Please try again.');
      setSaving(false);
    }
  };

  const parseResume = async () => {
    if (!userId || !resumeFile || parsing) return;
    setParsing(true);
    setError('');
    try {
      const path = await uploadCandidateAsset(resumeFile, userId, 'resumes');
      const { data, error: parseError } = await supabase.functions.invoke('parse-resume', {
        body: { path, file_name: resumeFile.name, content_type: resumeFile.type },
      });
      if (parseError) throw parseError;
      const profile = data?.profile as ParsedResume | undefined;
      if (!profile) throw new Error('No profile data was returned from the resume.');
      setResumePath(path);
      setParsedResume(profile);
      setEducationDraft(profile.education || '');
      setExperienceDraft(profile.experience || '');
      const nameParts = profile.full_name.trim().split(/\s+/).filter(Boolean);
      if (nameParts.length > 0) setFirstName(nameParts[0]);
      if (nameParts.length > 1) setLastName(nameParts.slice(1).join(' '));
      if (profile.phone) setPhone(profile.phone);
      if (profile.country) setCountry(profile.country);
      setJobTitles(profile.preferred_job_titles || []);
      setSkills(profile.skills || []);
      setExperienceLabel(profile.years_experience === null ? '' : profile.years_experience >= 3 ? '3+ years' : profile.years_experience >= 1 ? '1–3 years' : 'Recent graduate');
      setStep(2);
    } catch (parseError) {
      setError(parseError instanceof Error ? parseError.message : 'We couldn’t parse that resume. Please try again.');
    } finally {
      setParsing(false);
    }
  };

  if (checking) {
    return (
      <main className="page-shell items-center justify-center px-4 py-8">
        <LoadingSpinner className="text-[#1D9E75]" size={28} />
      </main>
    );
  }

  return (
    <main className="page-shell items-center justify-center px-4 py-8 sm:px-6 lg:px-8">
      <section className="auth-fade-up w-full max-w-lg rounded-2xl border border-white/70 bg-white px-6 py-10 shadow-[0_20px_60px_rgba(26,26,26,0.08)] sm:px-10">
        <div className="mb-6 flex items-center gap-1.5">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full transition-colors duration-200 ${
                s <= step ? 'bg-accent' : 'bg-[#E5E1D8]'
              }`}
            />
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {step === 1 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">Upload your resume</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">We’ll use it to prefill your RoleWave profile, including your education and experience.</p>
            <label className="mt-6 flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-[#5DCAA5] bg-[#E1F5EE] px-5 py-10 text-center">
              <span className="text-sm font-semibold text-[#085041]">{resumeFile ? resumeFile.name : 'Choose your resume'}</span>
              <span className="mt-1 text-xs text-[#4D7668]">PDF, DOC, or DOCX · max 5MB</span>
              <input type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0] || null;
                if (!file) return;
                if (file.size > 5 * 1024 * 1024) {
                  setError('Your resume must be 5 MB or smaller.');
                  return;
                }
                setError('');
                setResumeFile(file);
              }} />
            </label>
          </div>
        )}

        {step === 2 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">Check your profile</h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">We extracted these details from your resume. Correct anything before continuing.</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">First name</span><input className="field-shell" value={firstName} onChange={(e) => setFirstName(e.target.value)} required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">Last name</span><input className="field-shell" value={lastName} onChange={(e) => setLastName(e.target.value)} required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">Phone number</span><input className="field-shell" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+234..." required /></label>
              <label className="block"><span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.5px] text-muted">Country</span><input className="field-shell" value={country} onChange={(e) => setCountry(e.target.value)} placeholder="Nigeria" required /></label>
            </div>
            <div className="mt-5 rounded-2xl border border-line bg-[#FBFAF7] p-4">
              <p className="text-xs font-bold uppercase tracking-[0.5px] text-muted">Extracted profile</p>
              <label className="mt-3 block text-sm text-ink"><span className="font-semibold">Skills</span><input className="field-shell mt-1" value={skills.join(', ')} onChange={(event) => setSkills(event.target.value.split(',').map((skill) => skill.trim()).filter(Boolean))} /></label>
              <label className="mt-3 block text-sm text-ink"><span className="font-semibold">Job titles</span><input className="field-shell mt-1" value={jobTitles.join(', ')} onChange={(event) => setJobTitles(event.target.value.split(',').map((title) => title.trim()).filter(Boolean))} /></label>
              <label className="mt-3 block text-sm text-ink"><span className="font-semibold">Education</span><textarea className="field-shell mt-1 min-h-20 resize-y" value={educationDraft} onChange={(event) => setEducationDraft(event.target.value)} /></label>
              <label className="mt-3 block text-sm text-ink"><span className="font-semibold">Experience</span><textarea className="field-shell mt-1 min-h-28 resize-y" value={experienceDraft} onChange={(event) => setExperienceDraft(event.target.value)} /></label>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.5px] text-muted">Preferred locations <span className="font-normal normal-case tracking-normal">(optional)</span></p>
              <div className="grid grid-cols-2 gap-2">
                {LOCATION_OPTIONS.map((location) => <button key={location} type="button" onClick={() => toggleLocation(location)} className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors ${locations.includes(location) ? 'border-accent bg-[#E1F5EE] text-[#085041]' : 'border-[#D3D1C7] bg-[#FBFAF7] text-ink hover:border-[#5DCAA5]'}`}>{location}</button>)}
              </div>
            </div>
            <div className="mt-5">
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.5px] text-muted">What type of work are you looking for?</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {JOB_TYPE_OPTIONS.map((option) => <button key={option.value} type="button" onClick={() => setJobType(option.value)} className={`rounded-xl border px-4 py-3 text-left transition-colors ${jobType === option.value ? 'border-accent bg-[#E1F5EE]' : 'border-[#D3D1C7] bg-[#FBFAF7] hover:border-[#5DCAA5]'}`}><span className="text-sm font-semibold text-ink">{option.value}</span><span className="mt-0.5 block text-xs text-muted">{option.description}</span></button>)}
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              What are you looking for?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              This includes students looking for SIWES or NYSC placements, not just full-time roles.
            </p>
            <div className="mt-5 space-y-2">
              {JOB_TYPE_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setJobType(option.value)}
                  className={`flex w-full flex-col items-start rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                    jobType === option.value
                      ? 'border-accent bg-[#E1F5EE]'
                      : 'border-[#D3D1C7] bg-[#FBFAF7] hover:border-[#5DCAA5]'
                  }`}
                >
                  <span className="text-sm font-semibold text-ink">{option.value}</span>
                  <span className="mt-0.5 text-xs text-muted">{option.description}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              What's your field?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Add the roles or fields you're interested in. Press Enter after each one.
            </p>
            <div className="mt-5">
              <input
                type="text"
                value={jobTitleInput}
                onChange={(e) => setJobTitleInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, addJobTitle)}
                className="field-shell"
                placeholder="e.g. Software Engineering, Marketing, Accounting"
              />
              {jobTitles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {jobTitles.map((title) => (
                    <span
                      key={title}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-xs font-semibold text-[#085041]"
                    >
                      {title}
                      <button
                        type="button"
                        onClick={() => setJobTitles((prev) => prev.filter((t) => t !== title))}
                        aria-label={`Remove ${title}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 5 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              What are your skills?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Add a few. Press Enter after each one.
            </p>
            <div className="mt-5">
              <input
                type="text"
                value={skillInput}
                onChange={(e) => setSkillInput(e.target.value)}
                onKeyDown={(e) => handleTagKeyDown(e, addSkill)}
                className="field-shell"
                placeholder="e.g. Excel, Figma, Python"
              />
              {skills.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1.5 rounded-full bg-[#E1F5EE] px-3 py-1.5 text-xs font-semibold text-[#085041]"
                    >
                      {skill}
                      <button
                        type="button"
                        onClick={() => setSkills((prev) => prev.filter((s) => s !== skill))}
                        aria-label={`Remove ${skill}`}
                      >
                        <X size={12} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {step === 6 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              Where do you want to work?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">Select as many as apply.</p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              {LOCATION_OPTIONS.map((loc) => (
                <button
                  key={loc}
                  type="button"
                  onClick={() => toggleLocation(loc)}
                  className={`rounded-xl border px-4 py-3 text-sm font-semibold transition-colors duration-150 ${
                    locations.includes(loc)
                      ? 'border-accent bg-[#E1F5EE] text-[#085041]'
                      : 'border-[#D3D1C7] bg-[#FBFAF7] text-ink hover:border-[#5DCAA5]'
                  }`}
                >
                  {loc}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 7 && (
          <div>
            <h1 className="font-display text-[26px] font-semibold leading-tight tracking-[-0.02em] text-ink">
              What's your experience level?
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              No wrong answer here — this just helps us show you relevant roles.
            </p>
            <div className="mt-5 space-y-2">
              {EXPERIENCE_OPTIONS.map((option) => (
                <button
                  key={option.label}
                  type="button"
                  onClick={() => setExperienceLabel(option.label)}
                  className={`w-full rounded-xl border px-4 py-3 text-left text-sm font-semibold transition-colors duration-150 ${
                    experienceLabel === option.label
                      ? 'border-accent bg-[#E1F5EE] text-[#085041]'
                      : 'border-[#D3D1C7] bg-[#FBFAF7] text-ink hover:border-[#5DCAA5]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex items-center justify-between gap-3">
          {step > 1 ? (
            <button
              type="button"
              onClick={goBack}
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted hover:text-ink"
            >
              <ArrowLeft size={15} />
              Back
            </button>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={goNext}
            disabled={!canAdvance() || saving || parsing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 text-sm font-semibold text-white transition-colors duration-150 hover:bg-[#168a63] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving || parsing ? (
              <LoadingSpinner size={16} className="text-white" label={parsing ? 'Parsing resume' : 'Saving'} />
            ) : step === TOTAL_STEPS ? (
              'Finish'
            ) : (
              <>
                Next
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </div>
      </section>
    </main>
  );
}

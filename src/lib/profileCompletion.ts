import type { CandidateProfile, Profile } from '../types';

export type ProfileCompletionSuggestion = {
  key: string;
  label: string;
  description: string;
};

function completionFields(profile: Profile | null, candidateProfile: CandidateProfile | null) {
  return [
    { key: 'full_name', label: 'Add your full name', description: 'Use the name employers should see.', value: profile?.full_name },
    { key: 'avatar_url', label: 'Upload a profile photo', description: 'A clear photo helps your profile feel complete.', value: candidateProfile?.avatar_url },
    { key: 'headline', label: 'Add a professional headline', description: 'Summarize the role or value you bring.', value: candidateProfile?.headline },
    { key: 'bio', label: 'Write your professional summary', description: 'Tell employers what you do and what you are looking for.', value: candidateProfile?.bio },
    { key: 'location', label: 'Add your location', description: 'Help employers understand where you can work from.', value: candidateProfile?.location },
    { key: 'years_experience', label: 'Add your years of experience', description: 'Include your current experience level.', value: candidateProfile?.years_experience },
    { key: 'skills', label: 'Add at least one skill', description: 'Skills help RoleWave find relevant jobs for you.', value: candidateProfile?.skills?.length ? candidateProfile.skills.length : 0 },
    { key: 'preferred_locations', label: 'Add preferred locations', description: 'Tell us where you would like to work.', value: candidateProfile?.preferred_locations?.length ? candidateProfile.preferred_locations.length : 0 },
    { key: 'preferred_salary', label: 'Add your preferred salary', description: 'This improves the relevance of job recommendations.', value: candidateProfile?.preferred_salary },
    { key: 'work_preference', label: 'Choose a work preference', description: 'Select remote, hybrid, or onsite work.', value: candidateProfile?.work_preference },
    { key: 'availability', label: 'Set your availability', description: 'Let employers know when you can start.', value: candidateProfile?.availability },
    { key: 'resume_url', label: 'Upload your resume', description: 'A resume gives employers more context about your experience.', value: candidateProfile?.resume_url },
    { key: 'portfolio_url', label: 'Add a portfolio link', description: 'Show examples of your work.', value: candidateProfile?.portfolio_url },
    { key: 'github_url', label: 'Add your GitHub profile', description: 'Let employers review your technical work.', value: candidateProfile?.github_url },
    { key: 'linkedin_url', label: 'Add your LinkedIn profile', description: 'Connect your professional presence.', value: candidateProfile?.linkedin_url },
    { key: 'education', label: 'Add your education', description: 'Include relevant education or certifications.', value: candidateProfile?.education },
    { key: 'experience', label: 'Add your work experience', description: 'Describe your previous roles and achievements.', value: candidateProfile?.experience },
    { key: 'projects', label: 'Add a project', description: 'Highlight practical work you have completed.', value: candidateProfile?.projects },
    { key: 'whatsapp_number', label: 'Add a WhatsApp number', description: 'Give employers another way to reach you.', value: candidateProfile?.whatsapp_number },
  ];
}

function isComplete(value: string | number | null | undefined) {
  if (typeof value === 'number') return value > 0;
  return Boolean(value);
}

export function calculateProfileCompletion(
  profile: Profile | null,
  candidateProfile: CandidateProfile | null
): number {
  const fields = completionFields(profile, candidateProfile);
  const completedFields = fields.filter((field) => isComplete(field.value)).length;
  return Math.round((completedFields / fields.length) * 100);
}

export function getProfileCompletionSuggestions(
  profile: Profile | null,
  candidateProfile: CandidateProfile | null
): ProfileCompletionSuggestion[] {
  return completionFields(profile, candidateProfile)
    .filter((field) => !isComplete(field.value))
    .map(({ key, label, description }) => ({ key, label, description }));
}

import type { CandidateProfile, Profile } from '../types';

export function calculateProfileCompletion(
  profile: Profile | null,
  candidateProfile: CandidateProfile | null
): number {
  const fields: Array<string | number | null | undefined> = [
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

  const completedFields = fields.filter((value) => {
    if (typeof value === 'number') return value > 0;
    return Boolean(value);
  }).length;

  return Math.round((completedFields / fields.length) * 100);
}

export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_initials: string;
  avatar_color: 'teal' | 'blue' | 'amber' | 'purple' | 'coral';
  location: string | null;
  website: string | null;
  description: string | null;
  verified: boolean;
  job_count: number;
  owner_profile_id?: string | null;
  created_at: string;
}

export interface Job {
  id: string;
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
  status: string;
  apply_method?: 'external' | 'email' | 'internal';
  apply_url?: string | null;
  application_email?: string | null;
  created_at: string;
  updated_at: string;
  company?: Company;
}

export interface JobSubmission {
  id: string;
  job_title: string;
  company_name: string;
  city: string;
  work_type: string;
  job_type: string;
  salary: string | null;
  description: string;
  requirements: string;
  how_to_apply: string;
  contact_email: string;
  status: 'pending' | 'approved' | 'rejected';
  created_at: string;
}

export interface Profile {
  id: string;
  full_name: string | null;
  is_admin: boolean;
  account_type?: 'candidate' | 'employer';
  onboarding_completed?: boolean;
  created_at: string;
}

export interface CandidateProfile {
  id: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  years_experience: number | null;
  skills: string[];
  preferred_locations: string[];
  preferred_salary: string | null;
  work_preference: string | null;
  availability: string | null;
  resume_url: string | null;
  resume_name: string | null;
  whatsapp_number: string | null;
  work_authorization: string | null;
  portfolio_url: string | null;
  github_url: string | null;
  linkedin_url: string | null;
  education: string | null;
  experience: string | null;
  projects: string | null;
  open_to_work: boolean;
  visibility_to_employers: 'open' | 'not_open' | 'hidden';
  created_at: string;
  updated_at: string;
}

export interface EmployerProfile {
  id: string;
  company_id: string | null;
  company_name: string;
  company_website: string | null;
  company_size: string | null;
  role_title: string | null;
  phone: string | null;
  office_location: string | null;
  created_at: string;
  updated_at: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  candidate_profile_id: string | null;
  applicant_name: string;
  applicant_email: string;
  applicant_phone: string | null;
  cover_letter: string | null;
  resume_url: string | null;
  portfolio_url: string | null;
  source: 'guest' | 'registered';
  status: 'submitted' | 'reviewed' | 'shortlisted' | 'rejected' | 'hired' | 'withdrawn';
  candidate_deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkType = 'Remote' | 'Hybrid' | 'On-site';
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';
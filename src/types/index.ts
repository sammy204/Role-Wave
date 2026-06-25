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
  created_at: string;
}

export type WorkType = 'Remote' | 'Hybrid' | 'On-site';
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

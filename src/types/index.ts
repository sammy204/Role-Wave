export interface Company {
  id: string;
  name: string;
  slug: string;
  logo_initials: string;
  logo_url: string | null;
  avatar_color: 'teal' | 'blue' | 'amber' | 'purple' | 'coral';
  location: string | null;
  timezone?: string | null;
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
  experience_level?: string | null;
  salary_min?: number | null;
  salary_max?: number | null;
  salary_currency?: string;
  salary_period?: string;
  work_authorization?: string;
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
  is_founder?: boolean;
  account_type?: 'candidate' | 'employer';
  onboarding_completed?: boolean;
  account_status?: 'active' | 'deletion_scheduled';
  deletion_scheduled_for?: string | null;
  email_application_updates?: boolean;
  email_job_recommendations?: boolean;
  created_at: string;
}

export interface CandidateProfile {
  id: string;
  avatar_url: string | null;
  headline: string | null;
  bio: string | null;
  location: string | null;
  years_experience: number | null;
  job_type?: string | null;
  skills: string[];
  preferred_locations: string[];
  preferred_job_titles: string[];
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
  timezone?: string | null;
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
  status: 'submitted' | 'reviewed' | 'shortlisted' | 'interview' | 'offer' | 'rejected' | 'hired' | 'withdrawn';
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface InterviewSchedule {
  id: string;
  application_id: string;
  meeting_link: string;
  employer_timezone: string;
  status: 'proposed' | 'confirmed' | 'cancelled';
  selected_slot_id: string | null;
  selected_at: string | null;
  proposed_at: string;
}

export interface InterviewSlot {
  id: string;
  schedule_id: string;
  starts_at: string;
  duration_minutes: number;
  slot_order: number;
}

export interface Offer {
  id: string;
  application_id: string;
  job_id: string;
  employer_profile_id: string;
  candidate_profile_id: string;
  role_title: string;
  salary_amount: number | null;
  salary_currency: string;
  salary_period: string;
  start_date: string | null;
  work_arrangement: string | null;
  location: string | null;
  benefits_notes: string | null;
  expiry_date: string | null;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'withdrawn' | 'expired';
  response_message: string | null;
  sent_at: string | null;
  responded_at: string | null;
  letter_pdf_path?: string | null;
  letter_file_name?: string | null;
  letter_file_size?: number | null;
  letter_mime_type?: string | null;
  letter_uploaded_at?: string | null;
  expires_at?: string | null;
  employer_message?: string | null;
  candidate_deleted_at?: string | null;
  created_at: string;
  updated_at: string;
}

export type WorkType = 'Remote' | 'Hybrid' | 'On-site';
export type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Internship';

export interface Conversation {
  id: string;
  company_id: string;
  candidate_profile_id: string;
  source_job_id: string | null;
  employer_last_read_at: string | null;
  candidate_last_read_at: string | null;
  last_message_at: string;
  created_at: string;
  company?: Company;
  candidate?: CandidateProfile;
  candidate_full_name?: string | null;
  source_job?: Job;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_profile_id: string;
  body: string;
  created_at: string;
  edited_at: string | null;
  deleted_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  attachments?: MessageAttachment[];
}

export interface MessageAttachment {
  id: string;
  message_id: string;
  conversation_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  created_at: string;
}

export type NotificationType =
  | 'message_received'
  | 'application_submitted'
  | 'application_status_changed'
  | 'employer_verification_approved'
  | 'employer_verification_rejected'
  | 'job_post_approved';

export interface AppNotification {
  id: string;
  user_id: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

export interface OfferDocument {
  id: string;
  offer_id: string;
  storage_path: string;
  file_name: string;
  mime_type: string;
  file_size: number;
  sort_order: number;
  document_type: 'employer_offer' | 'candidate_signed';
  uploaded_by: string | null;
  document_message: string | null;
  created_at: string;
}

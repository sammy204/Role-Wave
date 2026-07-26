import type { Job } from '../types';

const experienceLabels: Record<string, string> = {
  entry: 'Entry level',
  junior: 'Junior',
  mid: 'Mid-level',
  senior: 'Senior',
  lead: 'Lead / Principal',
};

const authorizationLabels: Record<string, string> = {
  anywhere: 'Open to applicants anywhere',
  authorized_only: 'Already authorized only',
  sponsorship_available: 'Visa sponsorship available',
};

const applicationLabels: Record<string, string> = {
  internal: 'Apply on RoleWave',
  email: 'Apply by email',
  external: 'Apply on company site',
};

export function formatJobSalary(job: Job): string | null {
  if (job.salary_min == null && job.salary_max == null) return job.salary || null;

  const symbol = job.salary_currency === 'NGN' ? '₦' : job.salary_currency === 'USD' ? '$' : job.salary_currency === 'GBP' ? '£' : `${job.salary_currency || ''} `;
  const format = (value: number) => `${symbol}${value.toLocaleString()}`;
  const min = job.salary_min;
  const max = job.salary_max;
  const range = min != null && max != null ? `${format(min)} – ${format(max)}` : min != null ? `${format(min)}+` : `Up to ${format(max as number)}`;
  const period = job.salary_period ? `/${job.salary_period}` : '';
  return `${range}${period}`;
}

export function formatExperienceLevel(value: Job['experience_level']): string | null {
  return value ? experienceLabels[value] || value : null;
}

export function formatWorkAuthorization(value: Job['work_authorization']): string | null {
  return value ? authorizationLabels[value] || value : null;
}

export function formatApplicationMethod(value: Job['apply_method']): string | null {
  return value ? applicationLabels[value] || value : null;
}

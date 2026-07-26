import type { JobApplication } from '../types';

export type ApplicationStatus = JobApplication['status'];

/**
 * Forward progression an employer moves an application through.
 * 'rejected' and 'withdrawn' are side-exits, not part of the sequence,
 * so they're deliberately left out of this list.
 */
export const PIPELINE_STAGES: ApplicationStatus[] = [
  'submitted',
  'reviewed',
  'shortlisted',
  'interview',
  'offer',
  'hired',
];

export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  submitted: 'Applied',
  reviewed: 'Reviewing',
  shortlisted: 'Shortlisted',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
};

export function formatStatus(status: ApplicationStatus): string {
  return STATUS_LABELS[status] ?? status;
}

export const STATUS_TONE: Record<ApplicationStatus, string> = {
  submitted: 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]',
  reviewed: 'bg-pill-amber-bg text-pill-amber-text border-pill-amber-border',
  shortlisted: 'bg-pill-blue-bg text-pill-blue-text border-pill-blue-border',
  interview: 'bg-[#F1E9FB] text-[#4B2E83] border-[#C9AEEA]',
  offer: 'bg-[#E3F5FB] text-[#0B5C73] border-[#8FD3E8]',
  hired: 'bg-pill-green-bg text-pill-green-text border-pill-green-border',
  rejected: 'bg-pill-red-bg text-pill-red-text border-pill-red-border',
  withdrawn: 'bg-[#FFF1E6] text-[#A15A00] border-[#F0D080]',
};

export function statusTone(status: ApplicationStatus): string {
  return STATUS_TONE[status] ?? 'bg-[#F1EFE8] text-[#5F5E5A] border-[#D3D1C7]';
}

/** The next stage in the pipeline after `current`, or null at the end. */
export function nextStage(current: ApplicationStatus): ApplicationStatus | null {
  const index = PIPELINE_STAGES.indexOf(current);
  if (index === -1 || index === PIPELINE_STAGES.length - 1) return null;
  return PIPELINE_STAGES[index + 1];
}
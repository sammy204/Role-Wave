import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import {
  X,
  FileText,
  Eye,
  Mail,
  Phone,
  MapPin,
  Briefcase,
  GraduationCap,
  Github,
  Linkedin,
  Globe,
  MessageSquareText,
  Clock3,
  Layers,
} from 'lucide-react';
import type { CandidateProfile, Job, JobApplication } from '../types';
import { formatStatus, statusTone } from '../lib/applicationPipeline';
import { candidateResumeViewerHref, getCandidateAssetUrl } from '../lib/candidateAssets';

type ApplicantModalProps = {
  application: JobApplication & { job?: Job; candidate?: CandidateProfile | null };
  onClose: () => void;
  onMessage?: () => void;
  messaging?: boolean;
};

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initialsFor(name: string): string {
  return (
    name
      .split(' ')
      .map((part) => part[0])
      .filter(Boolean)
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?'
  );
}

function LinkButton({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-white px-4 py-2 text-sm font-semibold text-ink transition-colors duration-200 hover:border-[#5DCAA5]"
    >
      {icon} {label}
    </a>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6 last:mb-0">
      <h4 className="mb-2 text-[11px] font-bold uppercase tracking-[1.6px] text-faint">{title}</h4>
      {children}
    </div>
  );
}

function MetaRow({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-muted">
      {icon}
      <span>{label}</span>
    </div>
  );
}

export default function ApplicantModal({ application, onClose, onMessage, messaging }: ApplicantModalProps) {
  const location = useLocation();
  const candidate = application.candidate;
  const hasProfile = Boolean(candidate);
  const [tab, setTab] = useState<'application' | 'profile'>('application');
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [candidateResumeUrl, setCandidateResumeUrl] = useState<string | null>(null);
  const [applicationResumeUrl, setApplicationResumeUrl] = useState<string | null>(null);
  const returnTo = `${location.pathname}${location.search}`;
  const portfolioUrl = application.portfolio_url || candidate?.portfolio_url || null;

  useEffect(() => {
    let alive = true;
    void Promise.all([
      candidate?.avatar_url ? getCandidateAssetUrl(candidate.avatar_url) : null,
      candidate?.resume_url ? getCandidateAssetUrl(candidate.resume_url) : null,
      application.resume_url && isStoredCandidateAsset(application.resume_url)
        ? getCandidateAssetUrl(application.resume_url)
        : application.resume_url || null,
    ]).then(([nextAvatarUrl, nextCandidateResumeUrl, nextApplicationResumeUrl]) => {
      if (!alive) return;
      setAvatarUrl(nextAvatarUrl);
      setCandidateResumeUrl(nextCandidateResumeUrl);
      setApplicationResumeUrl(nextApplicationResumeUrl);
    }).catch(() => {
      if (!alive) return;
      setAvatarUrl(null);
      setCandidateResumeUrl(null);
      setApplicationResumeUrl(null);
    });

    return () => {
      alive = false;
    };
  }, [application.resume_url, candidate?.avatar_url, candidate?.resume_url]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-panel bg-white shadow-card-hover">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex min-w-0 items-center gap-4">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={application.applicant_name}
                className="h-14 w-14 shrink-0 rounded-full border border-line object-cover"
              />
            ) : (
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-line bg-accent-light text-lg font-semibold text-accent-text">
                {initialsFor(application.applicant_name)}
              </div>
            )}
            <div className="min-w-0">
              <h2 className="truncate font-serif text-lg font-semibold text-ink">{application.applicant_name}</h2>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${statusTone(application.status)}`}>
                  {formatStatus(application.status)}
                </span>
                <span className="rounded-full border border-line bg-[#F1EFE8] px-2.5 py-1 text-xs font-semibold text-muted">
                  {application.source}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="shrink-0 rounded-full p-2 text-muted transition-colors duration-200 hover:bg-[#F1EFE8] hover:text-ink"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Tabs */}
        {hasProfile && (
          <div className="flex gap-1 border-b border-line px-6 pt-3">
            <button
              onClick={() => setTab('application')}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                tab === 'application'
                  ? 'border-b-2 border-accent text-accent-deep'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Application
            </button>
            <button
              onClick={() => setTab('profile')}
              className={`rounded-t-lg px-4 py-2 text-sm font-semibold transition-colors duration-200 ${
                tab === 'profile'
                  ? 'border-b-2 border-accent text-accent-deep'
                  : 'text-muted hover:text-ink'
              }`}
            >
              Candidate Profile
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {tab === 'application' ? (
            <div>
              <Section title="Applied for">
                <div className="flex items-center gap-2 text-sm text-ink">
                  <Briefcase size={14} className="text-muted" />
                  {application.job?.title || 'Unknown job'}
                </div>
              </Section>

              <Section title="Contact">
                <div className="flex flex-col gap-2">
                  <MetaRow icon={<Mail size={14} />} label={application.applicant_email} />
                  {application.applicant_phone && (
                    <MetaRow icon={<Phone size={14} />} label={application.applicant_phone} />
                  )}
                  <MetaRow icon={<Clock3 size={14} />} label={`Applied ${formatDate(application.created_at)}`} />
                </div>
              </Section>

              <Section title="Cover letter">
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">
                  {application.cover_letter || 'No cover letter provided.'}
                </p>
              </Section>

              {application.status === 'rejected' && application.rejection_reason && (
                <Section title="Rejection reason shared with candidate">
                  <p className="whitespace-pre-wrap rounded-xl border border-pill-red-border bg-pill-red-bg px-3 py-2 text-sm text-pill-red-text">
                    {application.rejection_reason}
                  </p>
                </Section>
              )}

              {(application.resume_url || portfolioUrl) && (
                <Section title="Attachments">
                  <div className="flex flex-wrap gap-2">
                    {applicationResumeUrl && (
                      <LinkButton
                        href={applicationResumeUrl && application.resume_url && isStoredCandidateAsset(application.resume_url)
                          ? candidateResumeViewerHref(application.resume_url, candidate?.resume_name || 'resume.pdf', returnTo) || applicationResumeUrl
                          : applicationResumeUrl || ''}
                        icon={<FileText size={14} />}
                        label={candidate?.resume_name || 'Resume'}
                      />
                    )}
                    {portfolioUrl && (
                      <LinkButton href={portfolioUrl} icon={<Eye size={14} />} label="Portfolio" />
                    )}
                  </div>
                </Section>
              )}
            </div>
          ) : (
            candidate && (
              <div>
                {(candidate.headline || candidate.bio) && (
                  <Section title="About">
                    {candidate.headline && <div className="mb-1 text-sm font-semibold text-ink">{candidate.headline}</div>}
                    {candidate.bio && <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted">{candidate.bio}</p>}
                  </Section>
                )}

                <Section title="Overview">
                  <div className="flex flex-col gap-2">
                    {candidate.location && <MetaRow icon={<MapPin size={14} />} label={candidate.location} />}
                    {typeof candidate.years_experience === 'number' && (
                      <MetaRow icon={<Briefcase size={14} />} label={`${candidate.years_experience} years experience`} />
                    )}
                    {candidate.work_preference && <MetaRow icon={<Layers size={14} />} label={candidate.work_preference} />}
                    {candidate.availability && <MetaRow icon={<Clock3 size={14} />} label={candidate.availability} />}
                  </div>
                </Section>

                {candidate.skills?.length ? (
                  <Section title="Skills">
                    <div className="flex flex-wrap gap-2">
                      {candidate.skills.map((skill) => (
                        <span
                          key={skill}
                          className="rounded-full bg-accent-light px-2.5 py-1 text-xs font-semibold text-accent-text"
                        >
                          {skill}
                        </span>
                      ))}
                    </div>
                  </Section>
                ) : null}

                {candidate.experience && (
                  <Section title="Experience">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{candidate.experience}</p>
                  </Section>
                )}

                {candidate.education && (
                  <Section title="Education">
                    <div className="flex items-start gap-2">
                      <GraduationCap size={14} className="mt-0.5 shrink-0 text-muted" />
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{candidate.education}</p>
                    </div>
                  </Section>
                )}

                {candidate.projects && (
                  <Section title="Projects">
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-ink">{candidate.projects}</p>
                  </Section>
                )}

                {(candidate.resume_url || candidate.portfolio_url || candidate.github_url || candidate.linkedin_url) && (
                  <Section title="Links">
                    <div className="flex flex-wrap gap-2">
                      {candidateResumeUrl && (
                        <LinkButton
                          href={candidate.resume_url ? candidateResumeViewerHref(candidate.resume_url, candidate.resume_name || 'candidate-resume.pdf', returnTo) || candidateResumeUrl || '' : candidateResumeUrl || ''}
                          icon={<FileText size={14} />}
                          label={candidate.resume_name || 'Resume'}
                        />
                      )}
                      {candidate.portfolio_url && (
                        <LinkButton href={candidate.portfolio_url} icon={<Globe size={14} />} label="Portfolio" />
                      )}
                      {candidate.github_url && (
                        <LinkButton href={candidate.github_url} icon={<Github size={14} />} label="GitHub" />
                      )}
                      {candidate.linkedin_url && (
                        <LinkButton href={candidate.linkedin_url} icon={<Linkedin size={14} />} label="LinkedIn" />
                      )}
                    </div>
                  </Section>
                )}
              </div>
            )
          )}
        </div>

        {/* Footer */}
        {onMessage && (
          <div className="flex justify-end border-t border-line px-6 py-4">
            <button
              onClick={onMessage}
              disabled={messaging}
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#5DCAA5] bg-accent-light px-4 py-2 text-sm font-semibold text-accent-text transition-all duration-200 hover:-translate-y-[1px] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <MessageSquareText size={14} />
              {messaging ? 'Opening...' : 'Message candidate'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function isStoredCandidateAsset(value: string) {
  return !/^https?:\/\//i.test(value) || value.includes('/storage/v1/object/public/candidate-assets/');
}

import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ArrowRight, Sparkles, X } from 'lucide-react';
import { tutorialStorageKey, type TutorialRole } from '../lib/tutorial';

type TutorialStep = {
  title: string;
  description: string;
  selector: string;
  path: string;
};

const stepsByRole: Record<TutorialRole, TutorialStep[]> = {
  candidate: [
    {
      title: 'Your workspace starts here',
      description: 'Use this dashboard to see your progress, applications, saved jobs, and recommended roles in one place.',
      selector: '[data-tour="candidate-dashboard"]',
      path: '/candidate/dashboard',
    },
    {
      title: 'Make your profile work harder',
      description: 'A complete profile helps employers understand your strengths and improves the job matches you see.',
      selector: '[data-tour="candidate-profile-page"]',
      path: '/candidate/profile',
    },
    {
      title: 'Find verified opportunities',
      description: 'Browse jobs that fit your goals, then save the ones you want to come back to or apply straight away.',
      selector: '[data-tour="candidate-jobs-page"]',
      path: '/jobs',
    },
    {
      title: 'Keep track of your applications',
      description: 'Your saved jobs and application progress stay organised in Saved & Applied.',
      selector: '[data-tour="candidate-activity-page"]',
      path: '/candidate/activity',
    },
    {
      title: 'Review offers in one place',
      description: 'When an employer sends you an offer, you can review the details and accept or decline it from Offers.',
      selector: '[data-tour="candidate-offers-page"]',
      path: '/candidate/offers',
    },
    {
      title: 'Stay connected',
      description: 'Employers can message you through RoleWave when they want to continue the conversation.',
      selector: '[data-tour="candidate-messages-page"]',
      path: '/candidate/messages',
    },
  ],
  employer: [
    {
      title: 'Welcome to your hiring workspace',
      description: 'This dashboard gives you a quick view of your jobs, applications, and hiring activity.',
      selector: '[data-tour="employer-dashboard"]',
      path: '/employer/dashboard',
    },
    {
      title: 'Post your first job',
      description: 'Create a clear, genuine opening so relevant candidates can discover and apply to it.',
      selector: '[data-tour="employer-post-job-page"]',
      path: '/post',
    },
    {
      title: 'Manage your posted jobs',
      description: 'Edit, pause, and review the roles your company has published from this section.',
      selector: '[data-tour="employer-posted-jobs"]',
      path: '/employer/dashboard',
    },
    {
      title: 'Review applicants',
      description: 'Move candidates through your hiring pipeline, open their profiles, and make decisions from here.',
      selector: '[data-tour="employer-applications"]',
      path: '/employer/dashboard',
    },
    {
      title: 'Message candidates',
      description: 'Keep conversations and follow-ups in one place using Employer Messages.',
      selector: '[data-tour="employer-messages"]',
      path: '/employer/messages',
    },
  ],
};

export default function InAppTutorial({ userId, role, active, autoStart }: { userId: string; role: TutorialRole; active: boolean; autoStart: boolean }) {
  const location = useLocation();
  const navigate = useNavigate();
  const steps = useMemo(() => stepsByRole[role], [role]);
  const [open, setOpen] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const key = tutorialStorageKey(userId, role);

  useEffect(() => {
    if (!active) {
      setOpen(false);
      return;
    }

    if (!autoStart) return;

    try {
      if (window.localStorage.getItem(key) !== '1') {
        // Mark it as seen when it opens, so leaving midway through the tour
        // does not make it interrupt the user again after the next login.
        window.localStorage.setItem(key, '1');
        setStepIndex(0);
        setOpen(true);
      }
    } catch {
      setStepIndex(0);
      setOpen(true);
    }
  }, [active, autoStart, key]);

  useEffect(() => {
    if (!open) return;

    const updateTarget = () => {
      const target = document.querySelector(steps[stepIndex]?.selector);
      if (!target) {
        setTargetRect(null);
        return;
      }

      target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
      window.requestAnimationFrame(() => setTargetRect(target.getBoundingClientRect()));
    };

    updateTarget();
    window.addEventListener('resize', updateTarget);
    window.addEventListener('scroll', updateTarget, true);
    return () => {
      window.removeEventListener('resize', updateTarget);
      window.removeEventListener('scroll', updateTarget, true);
    };
  }, [location.pathname, open, stepIndex, steps]);

  const dismiss = () => {
    try {
      window.localStorage.setItem(key, '1');
    } catch {
      // The tour can still be dismissed when storage is unavailable.
    }
    setOpen(false);
  };

  const complete = () => {
    dismiss();
    navigate(role === 'candidate' ? '/candidate/dashboard' : '/employer/dashboard');
  };

  const goToStep = (nextIndex: number) => {
    const nextStep = steps[nextIndex];
    if (nextStep.path !== location.pathname) navigate(nextStep.path);
    setStepIndex(nextIndex);
  };

  const next = () => {
    if (stepIndex === steps.length - 1) {
      complete();
      return;
    }
    goToStep(stepIndex + 1);
  };

  const popoverWidth = Math.min(420, window.innerWidth - 32);
  const popoverHeight = 280;
  const popoverTop = targetRect
    ? targetRect.bottom + 18 + popoverHeight <= window.innerHeight
      ? targetRect.bottom + 18
      : targetRect.top - popoverHeight - 18 >= 16
        ? targetRect.top - popoverHeight - 18
        : Math.max(16, (window.innerHeight - popoverHeight) / 2)
    : Math.max(16, (window.innerHeight - popoverHeight) / 2);
  const popoverLeft = targetRect
    ? Math.min(Math.max(16, targetRect.left + targetRect.width / 2 - popoverWidth / 2), window.innerWidth - popoverWidth - 16)
    : Math.max(16, (window.innerWidth - popoverWidth) / 2);

  if (!active) return null;

  return (
    <>
      {open && (
        <div className="fixed inset-0 z-[100]" aria-label="RoleWave product tour">
          <div className="absolute inset-0 bg-[#10231E]/55" />

          {targetRect && (
            <div
              className="pointer-events-none absolute rounded-[18px] border-2 border-[#5DCAA5] shadow-[0_0_0_9999px_rgba(16,35,30,0.55),0_0_0_5px_rgba(93,202,165,0.22)] transition-all duration-300"
              style={{
                left: Math.max(8, targetRect.left - 6),
                top: Math.max(8, targetRect.top - 6),
                width: targetRect.width + 12,
                height: targetRect.height + 12,
              }}
            />
          )}

          <div
            className="absolute rounded-[26px] border border-white/70 bg-white p-5 text-[#1A1A1A] shadow-[0_24px_80px_rgba(0,0,0,0.24)] transition-[top,left] duration-300 sm:p-6"
            style={{ width: popoverWidth, top: popoverTop, left: popoverLeft }}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-[#E1F5EE] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.14em] text-[#085041]">
                <Sparkles size={13} /> RoleWave tour
              </div>
              <button type="button" onClick={dismiss} aria-label="Close tour" className="rounded-full p-1.5 text-[#8A867E] transition-colors hover:bg-[#F1EFE8] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="mt-6">
              <div className="mb-2 text-xs font-semibold text-[#8A867E]">Step {stepIndex + 1} of {steps.length}</div>
              <h2 className="font-display text-2xl font-bold tracking-[-0.03em]">{steps[stepIndex].title}</h2>
              <p className="mt-3 text-sm leading-6 text-[#5F5E5A]">{steps[stepIndex].description}</p>
            </div>

            <div className="mt-6 flex items-center justify-between gap-3">
              <button type="button" onClick={dismiss} className="text-xs font-semibold text-[#8A867E] hover:text-[#1A1A1A]">Skip tour</button>
              <div className="flex items-center gap-2">
                {stepIndex > 0 && (
                    <button type="button" onClick={() => goToStep(stepIndex - 1)} className="inline-flex items-center gap-1.5 rounded-full border border-[#D3D1C7] px-3.5 py-2 text-xs font-semibold text-[#5F5E5A] hover:border-[#5DCAA5]">
                    <ArrowLeft size={13} /> Back
                  </button>
                )}
                <button type="button" onClick={next} className="inline-flex items-center gap-1.5 rounded-full bg-[#1D9E75] px-4 py-2 text-xs font-semibold text-white hover:bg-[#168a63]">
                  {stepIndex === steps.length - 1 ? 'Done' : 'Next'} <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

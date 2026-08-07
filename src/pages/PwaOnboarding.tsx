import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Briefcase, MessageCircle, ShieldCheck } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';

type Slide = {
  eyebrow: string;
  headline: string;
  body: string;
  icon: typeof Briefcase;
  image: string;
};

const SLIDES: Slide[] = [
  {
    eyebrow: 'Welcome to RoleWave',
    headline: 'Real jobs, real companies — right here in Nigeria.',
    body: 'Every employer role is reviewed before it goes live in Lagos, Abuja, and Port Harcourt.',
    icon: ShieldCheck,
    image:
      'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=1600&q=90',
  },
  {
    eyebrow: 'Apply in seconds',
    headline: 'Apply without ever leaving the app.',
    body: 'Build one mini-CV, apply with a tap, and track every application from one dashboard.',
    icon: Briefcase,
    image:
      'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1600&q=90',
  },
  {
    eyebrow: 'Stay in the loop',
    headline: 'Know the moment things move.',
    body: 'Message employers directly and get real-time updates on every application.',
    icon: MessageCircle,
    image:
      'https://images.unsplash.com/photo-1556761175-b413da4baf72?auto=format&fit=crop&w=1600&q=90',
  },
];

const SWIPE_THRESHOLD_PX = 40;

export default function PwaOnboarding() {
  const navigate = useNavigate();
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();
  const [index, setIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (session) {
      navigate('/', { replace: true });
      return;
    }
    if (!isPwa) navigate('/', { replace: true });
  }, [authLoading, session, isPwa, navigate]);

  const isLast = index === SLIDES.length - 1;
  const slide = SLIDES[index];
  const Icon = slide.icon;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setIndex((current) => (current + 1) % SLIDES.length);
    }, 5000);

    return () => window.clearTimeout(timer);
  }, [index]);

  const goTo = (next: number) => {
    setIndex(Math.max(0, Math.min(SLIDES.length - 1, next)));
  };

  const handleTouchStart = (event: React.TouchEvent) => {
    touchStartX.current = event.touches[0].clientX;
  };

  const handleTouchEnd = (event: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const deltaX = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(deltaX) >= SWIPE_THRESHOLD_PX) goTo(index + (deltaX < 0 ? 1 : -1));
  };

  return (
    <main
      className="relative isolate flex min-h-screen min-h-[100dvh] flex-col overflow-hidden bg-[#111613] text-white"
      style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 bg-[#111613]">
        {SLIDES.map((item, slideIndex) => (
          <img
            key={item.image}
            src={item.image}
            alt=""
            aria-hidden="true"
            draggable={false}
            className={`absolute inset-0 h-full w-full object-cover object-center transition-opacity duration-1000 ease-in-out ${
              slideIndex === index ? 'opacity-100' : 'opacity-0'
            }`}
          />
        ))}
        <div className="absolute inset-0 bg-gradient-to-b from-black/45 via-black/5 to-black/90" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#07130F]/60 via-transparent to-transparent" />
      </div>

      <header className="relative z-10 flex items-center justify-between px-6 pb-4 pt-5 sm:px-8">
        <span className="rounded-full border border-white/35 bg-black/20 px-4 py-2 font-display text-lg font-semibold text-white shadow-lg backdrop-blur-md">
          RoleWave
        </span>
        {!isLast && (
          <button
            type="button"
            onClick={() => navigate('/start')}
            className="rounded-full border border-white/35 bg-black/20 px-4 py-2 text-[10px] font-bold uppercase tracking-[1.4px] text-white backdrop-blur-md"
          >
            Skip
          </button>
        )}
      </header>

      <section className="relative z-10 mt-auto px-6 pb-44 pt-24 sm:px-8 sm:pb-48" aria-live="polite">
        <div key={slide.headline} className="mx-auto w-full max-w-md animate-fade-up">
          <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/40 bg-[#1D9E75]/60 text-white shadow-lg backdrop-blur-md">
            <Icon size={22} strokeWidth={1.8} />
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[1.8px] text-[#B9F4D7]">{slide.eyebrow}</p>
          <h1 className="mt-3 max-w-[380px] font-display text-[38px] leading-[1.02] tracking-[-.02em] text-white drop-shadow-lg sm:text-[48px]">
            {slide.headline}
          </h1>
          <p className="mt-4 max-w-[360px] text-sm leading-6 text-white/85 drop-shadow-md">{slide.body}</p>

          <div className="mt-7 flex items-center gap-2">
            {SLIDES.map((item, dotIndex) => (
              <button
                key={item.headline}
                type="button"
                aria-label={`Go to slide ${dotIndex + 1}`}
                aria-current={dotIndex === index ? 'step' : undefined}
                onClick={() => goTo(dotIndex)}
                className={`h-1.5 rounded-full transition-all duration-500 ${
                  dotIndex === index ? 'w-9 bg-[#B9F4D7]' : 'w-1.5 bg-white/60'
                }`}
              />
            ))}
          </div>
        </div>

        <div
          className="fixed left-1/2 z-30 grid w-[calc(100%-3rem)] max-w-sm -translate-x-1/2 gap-3 sm:w-[calc(100%-4rem)]"
          style={{ bottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}
        >
          <button
            type="button"
            onClick={() => (isLast ? navigate('/start') : goTo(index + 1))}
            className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#B9F4D7]/60 bg-[#1D9E75]/70 px-4 py-4 text-sm font-bold text-white shadow-[0_12px_32px_rgba(0,0,0,.25)] backdrop-blur-md transition-colors hover:bg-[#1D9E75]/85 active:scale-[.98]"
          >
            {isLast ? 'Get started' : 'Next'} <ArrowRight size={17} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/start?mode=login')}
            className="w-full rounded-2xl border border-white/45 bg-black/20 px-4 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-colors hover:bg-black/35"
          >
            Already have an account? Log in
          </button>
        </div>
      </section>
    </main>
  );
}

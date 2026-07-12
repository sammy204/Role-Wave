import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Bookmark, Briefcase, Home, UserCircle2 } from 'lucide-react';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import type { Profile } from '../types';

export default function CandidateMobileNav() {
  const location = useLocation();
  const path = location.pathname;
  const { session, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionReady, setSessionReady] = useState(false);
  const [isPwa, setIsPwa] = useState(false);

  useEffect(() => {
    const updatePwaState = () => {
      const standalone = window.matchMedia('(display-mode: standalone)').matches;
      const iosStandalone = typeof window !== 'undefined' && 'standalone' in window.navigator && Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone);
      setIsPwa(standalone || iosStandalone);
    };

    updatePwaState();

    const mediaQuery = window.matchMedia('(display-mode: standalone)');
    mediaQuery.addEventListener?.('change', updatePwaState);

    return () => {
      mediaQuery.removeEventListener?.('change', updatePwaState);
    };
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    if (!session) {
      if (alive) {
        setProfile(null);
        setSessionReady(true);
      }
      return;
    }

    if (alive) {
      setProfile(null);
      setSessionReady(true);
    }

    void (async () => {
      try {
        const nextProfile = await fetchProfile(session.user.id);
        if (alive) {
          setProfile(nextProfile);
        }
      } catch {
        if (alive) {
          setProfile(null);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  if (!isPwa || !sessionReady || !session) {
    return null;
  }

  if (profile && profile.account_type !== 'candidate') {
    return null;
  }

  const items = [
    { to: '/candidate/home', label: 'Home', icon: Home },
    { to: '/jobs', label: 'Browse', icon: Briefcase },
    { to: '/candidate/activity', label: 'Saved', icon: Bookmark },
    { to: '/candidate', label: 'Profile', icon: UserCircle2 },
  ];

  const isActive = (route: string) => {
    if (route === '/candidate') {
      return path === '/candidate' || path === '/candidate/dashboard' || path === '/candidate/profile';
    }
    return path === route || path.startsWith(`${route}/`);
  };

  return (
    <>
      <div className="h-20 md:hidden" aria-hidden="true" />
      <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#D3D1C7] bg-[#FBFAF7] px-3 py-2 md:hidden">
        <div className="mx-auto grid max-w-[480px] grid-cols-4 gap-1">
          {items.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.to);

            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex flex-col items-center gap-1 border-t-2 px-2 py-2 text-[11px] font-semibold transition-colors ${
                  active ? 'border-[#1D9E75] text-[#085041]' : 'border-transparent text-[#5F5E5A]'
                }`}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </>
  );
}
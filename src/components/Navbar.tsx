import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, Menu, UserCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import { useIsPwa } from '../lib/usePwaDisplayMode';
import type { Profile } from '../types';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const isPwa = useIsPwa();

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    if (!session) {
      if (alive) {
        setProfile(null);
        setAvatarUrl(null);
        setIsSignedIn(false);
        setSessionReady(true);
      }
      return;
    }

    if (alive) {
      setProfile(null);
      setAvatarUrl(null);
      setIsSignedIn(true);
      setSessionReady(true);
    }

    void (async () => {
      try {
        const nextProfile = await fetchProfile(session.user.id);
        if (alive) {
          setProfile(nextProfile);
        }

        if (nextProfile?.account_type === 'candidate') {
          const { data: candidateRow } = await supabase
            .from('candidate_profiles')
            .select('avatar_url')
            .eq('id', session.user.id)
            .maybeSingle();

          if (alive) {
            setAvatarUrl((candidateRow as { avatar_url: string | null } | null)?.avatar_url ?? null);
          }
        }
      } catch {
        if (alive) {
          setProfile(null);
          setAvatarUrl(null);
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  const isActive = (route: string) => {
    if (route === '/') return path === '/';
    return path.startsWith(route);
  };

  const profilePath = profile?.account_type === 'employer' ? '/employer/dashboard' : '/candidate';
  const profileLabel = 'Profile';
  const ProfileIcon = UserCircle2;
  // Web (browser, any screen size) always goes to the marketplace.
  // Only the installed PWA gets the personalized candidate feed.
  const brandPath = isPwa && profile?.account_type === 'candidate' ? '/candidate/home' : '/';

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setProfile(null);
    setIsSignedIn(false);
    setMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/88 backdrop-blur-xl shadow-[0_6px_30px_rgba(26,26,26,0.05)]">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={brandPath} className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-[#1D9E75] text-white shadow-[0_10px_18px_rgba(29,158,117,0.18)]">
            <Briefcase size={15} />
          </div>
          <div className="leading-tight">
            <span className="block text-[17px] font-bold text-[#1A1A1A]">RoleWave</span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[#B4B2A9] sm:block">Verified jobs board</span>
          </div>
        </Link>

        <div className="hidden items-center gap-2 md:flex">
          {sessionReady && isSignedIn ? (
            <>
              <Link
                to={profilePath}
                aria-label={profileLabel}
                className={`inline-flex items-center gap-2 rounded-full bg-[#1D9E75] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#168a63] ${
                  avatarUrl ? 'p-[3px]' : 'px-[18px]'
                } ${isActive('/candidate') || isActive('/employer') ? 'bg-[#168a63]' : ''}`}
              >
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt=""
                    className="h-[30px] w-[30px] rounded-full object-cover"
                  />
                ) : (
                  <>
                    <ProfileIcon size={15} />
                    {profileLabel}
                  </>
                )}
              </Link>
              <button
                type="button"
                onClick={handleSignOut}
                className="inline-flex items-center gap-2 rounded-full border border-[#D3D1C7] bg-white px-3 py-2.5 text-[13px] font-semibold text-[#5F5E5A] transition-colors hover:text-[#1A1A1A]"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/start?mode=login"
                className="rounded-full border border-[#D3D1C7] bg-white px-[18px] py-2.5 text-[13px] font-semibold text-[#1A1A1A] shadow-[0_10px_24px_rgba(26,26,26,0.06)] transition-all duration-200 hover:border-[#5DCAA5] hover:text-[#085041]"
              >
                Log in
              </Link>
              <Link
                to="/start?mode=signup&role=candidate"
                className="inline-flex items-center gap-2 rounded-full bg-[#1D9E75] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#168a63]"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-full border border-[#D3D1C7] bg-white p-2 text-[#1A1A1A] shadow-[0_8px_18px_rgba(26,26,26,0.04)] md:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        {/* Mobile menu */}
        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close mobile menu"
              className="fixed inset-0 z-40 cursor-default bg-black/20 md:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 right-0 top-[68px] z-50 mx-3 rounded-[24px] border border-[#D3D1C7] bg-white px-4 py-4 shadow-[0_18px_38px_rgba(26,26,26,0.12)] md:hidden">
              <div className="grid gap-2">
                {sessionReady && isSignedIn ? (
                  <>
                    <Link
                      to={profilePath}
                      onClick={() => setMenuOpen(false)}
                      className="flex items-center justify-center gap-2 rounded-[16px] bg-[#1D9E75] px-[18px] py-3 text-center text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)]"
                    >
                      {avatarUrl ? (
                        <img
                          src={avatarUrl}
                          alt=""
                          className="h-5 w-5 rounded-full object-cover"
                        />
                      ) : (
                        <ProfileIcon size={15} />
                      )}
                      {profileLabel}
                    </Link>
                    <button
                      type="button"
                      onClick={handleSignOut}
                      className="block rounded-[16px] border border-[#D3D1C7] bg-white px-[18px] py-3 text-center text-[13px] font-semibold text-[#1A1A1A]"
                    >
                      Sign out
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      to="/start?mode=login"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] border border-[#D3D1C7] bg-white px-[18px] py-3 text-center text-[13px] font-semibold text-[#1A1A1A]"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/start?mode=signup&role=candidate"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] bg-[#1D9E75] px-[18px] py-3 text-center text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)]"
                    >
                      Sign up
                    </Link>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, LogOut, Menu, UserCircle2, X } from 'lucide-react';
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
        setIsSignedIn(false);
        setSessionReady(true);
      }
      return;
    }

    if (alive) {
      setProfile(null);
      setIsSignedIn(true);
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

  const isActive = (route: string) => {
    if (route === '/') return path === '/';
    return path.startsWith(route);
  };

  const isCandidateProfileView = path === '/candidate' || path === '/candidate/dashboard';
  const showBrowseJobs = profile?.account_type === 'candidate' && isCandidateProfileView;

  const profilePath = showBrowseJobs
    ? '/jobs'
    : profile?.account_type === 'employer'
      ? '/employer/dashboard'
      : '/candidate';
  const profileLabel = showBrowseJobs ? 'Browse jobs' : 'Profile';
  const ProfileIcon = showBrowseJobs ? ArrowLeft : UserCircle2;
  const brandPath = isPwa && profile?.account_type === 'candidate' ? '/candidate/home' : '/';

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    setProfile(null);
    setIsSignedIn(false);
    setMenuOpen(false);
    navigate('/', { replace: true });
  };

  return (
    <nav style={isPwa ? { paddingTop: 'env(safe-area-inset-top)' } : undefined} className="sticky top-0 z-50 border-b border-[#E4E0D6]/80 bg-[#F7F5EF]/90 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] max-w-[1240px] items-center justify-between px-5 sm:h-[70px] sm:px-8 lg:px-0">
        <Link to={brandPath} className="flex items-center gap-3">
          <img
            src="/rolewave-horizontal-tagline.png"
            alt="RoleWave — Your Career, Rising."
            className="h-7 w-auto object-contain sm:h-9"
          />
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {sessionReady && isSignedIn ? (
  <>
      <Link
      to={profilePath}
      aria-label={profileLabel}
      className={`inline-flex items-center gap-2 rounded-full bg-[#123D35] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(18,61,53,0.16)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0F6E56] ${
        isActive('/candidate') || isActive('/employer') ? 'bg-[#168a63]' : ''
      }`}
    >
      <ProfileIcon size={15} />
      {profileLabel}
    </Link>
    <button
      type="button"
      onClick={handleSignOut}
      className="inline-flex items-center gap-2 rounded-full border border-[#CFCBC0] bg-white/60 px-3 py-2.5 text-[13px] font-semibold text-[#5F5E5A] transition-colors hover:border-[#1D9E75] hover:text-[#123D35]"
    >
      <LogOut size={14} />
      Sign out
    </button>
  </>
) : (
            <>
              <div className="flex items-center gap-7">
                <Link
                  to="/find-work"
                  className={`text-[13px] font-semibold transition-colors ${isActive('/find-work') ? 'text-[#0F6E56]' : 'text-[#5F5E5A] hover:text-[#0F6E56]'}`}
                >
                  Find work
                </Link>
                <Link
                  to="/employer/start?mode=signup"
                  className={`text-[13px] font-semibold transition-colors ${isActive('/post') ? 'text-[#0F6E56]' : 'text-[#5F5E5A] hover:text-[#0F6E56]'}`}
                >
                  For employers
                </Link>
                <Link
                  to="/blog"
                  className={`text-[13px] font-semibold transition-colors ${isActive('/blog') ? 'text-[#0F6E56]' : 'text-[#5F5E5A] hover:text-[#0F6E56]'}`}
                >
                  Blog
                </Link>
              </div>
              <Link
                to="/candidate/start?mode=login"
                className="rounded-full border border-[#B8C5BE] bg-transparent px-5 py-3 text-[13px] font-bold text-[#123D35] transition-all duration-200 hover:border-[#1D9E75] hover:bg-white/70"
              >
                Log in
              </Link>
              <Link
                to="/candidate/start?mode=signup"
                className="inline-flex items-center gap-2 rounded-full bg-[#123D35] px-6 py-3 text-[13px] font-bold text-white shadow-[0_12px_26px_rgba(18,61,53,0.2)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#0F6E56]"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        {/* Mobile hamburger */}
        <button
          className="rounded-full border border-[#CFCBC0] bg-white/60 p-2 text-[#123D35] shadow-[0_8px_18px_rgba(26,26,26,0.04)] md:hidden"
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
<div
  className="absolute left-0 right-0 z-50 mx-3 rounded-[24px] border border-[#E4E0D6] bg-[#FBFAF7] px-4 py-4 shadow-[0_18px_38px_rgba(26,26,26,0.12)] md:hidden"
  style={{ top: isPwa ? 'calc(60px + env(safe-area-inset-top))' : '60px' }}
>              <div className="grid gap-2">
 {sessionReady && isSignedIn ? (
  <>
    <Link
      to={profilePath}
      onClick={() => setMenuOpen(false)}
      className="flex items-center justify-center gap-2 rounded-[16px] bg-[#1D9E75] px-[18px] py-3 text-center text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)]"
    >
      <ProfileIcon size={15} />
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
                      to="/find-work"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] px-[18px] py-3 text-center text-[13px] font-semibold text-[#123D35] hover:bg-[#E3F4EC]"
                    >
                      Find work
                    </Link>
                    <Link
                      to="/employer/start?mode=signup"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] px-[18px] py-3 text-center text-[13px] font-semibold text-[#123D35] hover:bg-[#E3F4EC]"
                    >
                      For employers
                    </Link>
                    <Link
                      to="/blog"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] px-[18px] py-3 text-center text-[13px] font-semibold text-[#123D35] hover:bg-[#E3F4EC]"
                    >
                      Blog
                    </Link>
                    <Link
                      to="/candidate/start?mode=login"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] border border-[#B8C5BE] bg-white px-[18px] py-3.5 text-center text-[13px] font-bold text-[#123D35]"
                    >
                      Log in
                    </Link>
                    <Link
                      to="/candidate/start?mode=signup"
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] bg-[#123D35] px-[18px] py-3.5 text-center text-[13px] font-bold text-white shadow-[0_10px_24px_rgba(18,61,53,0.16)]"
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

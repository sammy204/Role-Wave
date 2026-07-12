import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, LogOut, Menu, PencilLine, UserCircle2, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import { useAuth } from '../lib/useAuth';
import type { Profile } from '../types';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const path = location.pathname;
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isSignedIn, setIsSignedIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const { session, loading: authLoading } = useAuth();
  const isCandidateArea = path.startsWith('/candidate');
  const isCandidateProfileView = path === '/candidate' || path === '/candidate/dashboard';

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');

    const update = () => setIsMobile(media.matches);
    update();

    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (authLoading) return;

    let alive = true;

    async function loadProfile() {
      if (!session) {
        if (alive) {
          setProfile(null);
          setIsSignedIn(false);
          setSessionReady(true);
        }
        return;
      }

      const nextProfile = await fetchProfile(session.user.id);
      if (alive) {
        setProfile(nextProfile);
        setIsSignedIn(true);
        setSessionReady(true);
      }
    }

    loadProfile();

    return () => {
      alive = false;
    };
  }, [authLoading, session]);

  const isActive = (route: string) => {
    if (route === '/') return path === '/';
    return path.startsWith(route);
  };

  const profilePath =
    profile?.account_type === 'employer'
      ? '/employer/dashboard'
      : isCandidateProfileView
        ? '/candidate/profile'
        : '/candidate';
  const profileLabel =
    profile?.account_type === 'employer'
      ? 'Profile'
      : isCandidateProfileView
        ? 'Edit profile'
        : 'Profile';
  const ProfileIcon =
    profile?.account_type === 'employer'
      ? UserCircle2
      : isCandidateProfileView
        ? PencilLine
        : UserCircle2;
  const brandPath =
    isMobile && profile?.account_type === 'candidate' ? '/candidate/home' : '/';

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

        {/* Desktop nav */}
        {!isCandidateArea && (
          <div className="hidden items-center gap-2 rounded-full border border-[#D3D1C7] bg-white/80 p-1.5 shadow-[0_8px_20px_rgba(26,26,26,0.04)] md:flex">
            <Link
              to="/about"
              className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                isActive('/about')
                  ? 'bg-[#E1F5EE] text-[#085041]'
                  : 'text-[#5F5E5A] hover:bg-[#F1EFE8] hover:text-[#1A1A1A]'
              }`}
            >
              About
            </Link>
          </div>
        )}

        <div className="hidden items-center gap-2 md:flex">
          {sessionReady && isSignedIn ? (
            <>
              <Link
                to={profilePath}
                className={`inline-flex items-center gap-2 rounded-full bg-[#1D9E75] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)] transition-all duration-200 hover:-translate-y-[1px] hover:bg-[#168a63] ${
                  isActive('/candidate') || isActive('/employer') ? 'bg-[#168a63]' : ''
                }`}
              >
                <ProfileIcon size={15} />
                {profileLabel}
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
              {!isCandidateArea && (
                <div className="mb-3 rounded-2xl bg-[#F7F6F2] p-1.5">
                  <Link
                    to="/about"
                    onClick={() => setMenuOpen(false)}
                    className={`mt-1 block rounded-[14px] px-4 py-3 text-sm font-semibold transition-colors ${
                      isActive('/about') ? 'bg-white text-[#085041] shadow-sm' : 'text-[#5F5E5A]'
                    }`}
                  >
                    About
                  </Link>
                </div>
              )}
              <div className="grid gap-2">
                {sessionReady && isSignedIn ? (
                  <>
                    <Link
                      to={profilePath}
                      onClick={() => setMenuOpen(false)}
                      className="block rounded-[16px] bg-[#1D9E75] px-[18px] py-3 text-center text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(29,158,117,0.18)]"
                    >
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

import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Briefcase, Info, LayoutDashboard, LogOut, Mail, MessageSquareText, Menu, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

const links = [
  { to: '/candidate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/candidate/profile', label: 'Profile', icon: User },
  { to: '/jobs', label: 'Browse jobs', icon: Briefcase },
  { to: '/candidate/activity', label: 'Saved & Applied', icon: Bookmark },
  { to: '/candidate/messages', label: 'Messages', icon: MessageSquareText },
];

const utilityLinks = [
  { to: '/about', label: 'About', icon: Info },
  { to: '/contact', label: 'Contact us', icon: Mail },
];

export default function CandidateSidebar({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const path = location.pathname;

  const isActive = (route: string) => {
    if (route === '/candidate/dashboard') {
      return path === '/candidate' || path === '/candidate/dashboard' || path === '/candidate/home';
    }
    if (route === '/candidate/profile') {
      return path === '/candidate/profile';
    }
    if (route === '/jobs') {
      return path === '/jobs' || (path.startsWith('/jobs/') && !path.endsWith('/apply'));
    }
    return path.startsWith(route);
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigate('/', { replace: true });
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-1">
      {links.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-panel px-4 py-3 text-[14px] font-semibold transition-colors duration-200 ${
              active ? 'bg-sidebar-active text-white' : 'text-white/85 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={17} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  const UtilityLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-col gap-1 border-t border-white/10 pt-3">
      {utilityLinks.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={`flex items-center gap-3 rounded-panel px-4 py-2.5 text-[13px] font-semibold transition-colors duration-200 ${
              active ? 'bg-sidebar-active text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'
            }`}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-paper lg:flex">
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-sidebar px-4 py-6 shadow-sidebar lg:flex">
        <Link to="/candidate/dashboard" className="mb-8 flex items-center gap-3 px-1">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/15 text-white">
            <Briefcase size={16} />
          </div>
          <div className="leading-tight">
            <span className="block text-[16px] font-bold text-white">RoleWave</span>
            <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">Workspace</span>
          </div>
        </Link>

        <NavLinks />

        <UtilityLinks />

        <button
          onClick={handleSignOut}
          className="mt-3 flex items-center gap-3 rounded-panel px-4 py-3 text-[14px] font-semibold text-white/85 transition-colors duration-200 hover:bg-white/10 hover:text-white"
        >
          <LogOut size={17} />
          Sign out
        </button>
      </aside>

      {/* Mobile top bar */}
      <div className="sticky top-0 z-40 flex h-[60px] items-center justify-between border-b border-line bg-sidebar px-4 lg:hidden">
        <Link to="/candidate/dashboard" className="flex items-center gap-2">
          <div className="flex h-[28px] w-[28px] items-center justify-center rounded-lg bg-white/15 text-white">
            <Briefcase size={14} />
          </div>
          <span className="text-[15px] font-bold text-white">RoleWave</span>
        </Link>
        <button
          onClick={() => setDrawerOpen(true)}
          aria-label="Open menu"
          className="rounded-full p-2 text-white hover:bg-white/10"
        >
          <Menu size={22} />
        </button>
      </div>

      {/* Mobile drawer */}
      {drawerOpen && (
        <>
          <button
            type="button"
            aria-label="Close menu"
            className="fixed inset-0 z-50 bg-black/30 lg:hidden"
            onClick={() => setDrawerOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar px-4 py-6 shadow-card-hover lg:hidden">
            <div className="mb-8 flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-white/15 text-white">
                  <Briefcase size={16} />
                </div>
                <span className="text-[16px] font-bold text-white">RoleWave</span>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                aria-label="Close menu"
                className="rounded-full p-1.5 text-white hover:bg-white/10"
              >
                <X size={20} />
              </button>
            </div>

            <NavLinks onNavigate={() => setDrawerOpen(false)} />

            <UtilityLinks onNavigate={() => setDrawerOpen(false)} />

            <button
              onClick={handleSignOut}
              className="mt-3 flex items-center gap-3 rounded-panel px-4 py-3 text-[14px] font-semibold text-white/85 hover:bg-white/10 hover:text-white"
            >
              <LogOut size={17} />
              Sign out
            </button>
          </div>
        </>
      )}

      {/* Page content */}
      <div className="flex-1 lg:pl-[260px]">{children}</div>
    </div>
  );
}
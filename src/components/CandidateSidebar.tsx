import { useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Bookmark, Briefcase, Gift, HelpCircle, Info, LayoutDashboard, LogOut, Mail, MessageSquareText, Menu, Settings, Sparkles, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessages';
import NotificationBell from './NotificationBell';

const links = [
  { to: '/candidate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/candidate/profile', label: 'Profile', icon: User },
  { to: '/jobs', label: 'Browse jobs', icon: Briefcase },
  { to: '/candidate/activity', label: 'Saved & Applied', icon: Bookmark },
  { to: '/candidate/messages', label: 'Messages', icon: MessageSquareText },
  { to: '/candidate/offers', label: 'Offers', icon: Gift },
  { to: '/candidate/role-pilot', label: 'Role Pilot', icon: Sparkles },
  { to: '/candidate/settings', label: 'Settings', icon: Settings },
];

const utilityLinks = [
  { to: '/about', label: 'About', icon: Info },
  { to: '/contact', label: 'Contact us', icon: Mail },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
];

function UnreadDot() {
  return (
    <span
      aria-label="Unread messages"
      className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-emerald-400 ring-2 ring-sidebar"
    />
  );
}

export default function CandidateSidebar({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const edgeSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const drawerSwipeStart = useRef<{ x: number; y: number } | null>(null);
  const path = location.pathname;
  const unreadCount = useUnreadMessagesCount('candidate');

  const isActive = (route: string) => {
    if (route === '/candidate/dashboard') {
      return path === '/candidate' || path === '/candidate/dashboard' || path === '/candidate/home';
    }
    if (route === '/candidate/profile') {
      return path === '/candidate/profile';
    }
    if (route === '/candidate/settings') {
      return path === '/candidate/settings';
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

  const handleEdgeSwipeStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    if (touch.clientX <= 28) edgeSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleEdgeSwipeEnd = (event: React.TouchEvent) => {
    const start = edgeSwipeStart.current;
    edgeSwipeStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX > 48 && deltaX > deltaY * 1.25) setDrawerOpen(true);
  };

  const handleDrawerSwipeStart = (event: React.TouchEvent) => {
    const touch = event.touches[0];
    drawerSwipeStart.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleDrawerSwipeEnd = (event: React.TouchEvent) => {
    const start = drawerSwipeStart.current;
    drawerSwipeStart.current = null;
    if (!start) return;

    const touch = event.changedTouches[0];
    const deltaX = touch.clientX - start.x;
    const deltaY = Math.abs(touch.clientY - start.y);
    if (deltaX < -48 && Math.abs(deltaX) > deltaY * 1.25) setDrawerOpen(false);
  };

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <nav className="flex flex-1 flex-col gap-1">
      {links.map((item) => {
        const Icon = item.icon;
        const active = isActive(item.to);
        const showUnread = item.to === '/candidate/messages' && unreadCount > 0;
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
            {showUnread && <UnreadDot />}
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
    <div
      className="min-h-screen bg-paper lg:flex"
      onTouchStart={handleEdgeSwipeStart}
      onTouchEnd={handleEdgeSwipeEnd}
    >
      {/* Desktop fixed sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[260px] flex-col bg-sidebar px-4 py-6 shadow-sidebar lg:flex">
        <div className="mb-8 flex items-center justify-between px-1">
          <Link to="/candidate/dashboard" className="flex items-center gap-3">
            <img src="/rolewave-icon.png" alt="RoleWave" className="h-[34px] w-[34px] object-contain" />
            <div className="leading-tight">
              <span className="block text-[16px] font-bold text-white">RoleWave</span>
              <span className="block text-[11px] uppercase tracking-[0.18em] text-white/70">Workspace</span>
            </div>
          </Link>
          <NotificationBell role="candidate" variant="dark" />
        </div>

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
          <img src="/rolewave-icon.png" alt="RoleWave" className="h-[28px] w-[28px] object-contain" />
          <span className="text-[15px] font-bold text-white">RoleWave</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <NotificationBell role="candidate" variant="dark" />
          <button
            onClick={() => setDrawerOpen(true)}
            aria-label="Open menu"
            className="relative rounded-full p-2 text-white hover:bg-white/10"
          >
            <Menu size={22} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-sidebar" />
            )}
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      <>
        <button
          type="button"
          aria-label="Close menu"
          aria-hidden={!drawerOpen}
          className={`fixed inset-0 z-50 bg-black/30 transition-opacity duration-300 lg:hidden ${
            drawerOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          onClick={() => setDrawerOpen(false)}
        />
        <div
          aria-hidden={!drawerOpen}
          onTouchStart={handleDrawerSwipeStart}
          onTouchEnd={handleDrawerSwipeEnd}
          className={`fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-sidebar px-4 py-6 shadow-card-hover transition-transform duration-300 ease-out lg:hidden ${
            drawerOpen ? 'translate-x-0' : 'pointer-events-none -translate-x-full'
          }`}
        >
            <div className="mb-8 flex items-center justify-between px-1">
              <div className="flex items-center gap-3">
                <img src="/rolewave-icon.png" alt="RoleWave" className="h-[34px] w-[34px] object-contain" />
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

      {/* Page content */}
      <div className="flex-1 lg:pl-[260px]">{children}</div>
    </div>
  );
}
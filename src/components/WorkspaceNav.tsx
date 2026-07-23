import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Briefcase, Building2, LayoutDashboard, LogOut, Menu, MessageSquareText, PencilLine, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useUnreadMessagesCount } from '../hooks/useUnreadMessages';

type WorkspaceRole = 'candidate' | 'employer';

function UnreadDot() {
  return <span aria-label="Unread messages" className="h-2 w-2 flex-shrink-0 rounded-full bg-[#1D9E75]" />;
}

export default function WorkspaceNav({ role }: { role: WorkspaceRole }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const path = location.pathname;
  const unreadCount = useUnreadMessagesCount(role);

  const basePath = role === 'employer' ? '/employer' : '/candidate';
  const messagesPath = role === 'employer' ? '/employer/messages' : '/candidate/messages';
  const isActive = (route: string) => path.startsWith(route);

  const handleSignOut = async () => {
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    navigate('/', { replace: true });
  };

  const links =
    role === 'employer'
      ? [
          { to: '/employer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/employer/onboarding', label: 'Company', icon: Building2 },
          { to: '/post', label: 'Post job', icon: Briefcase },
          { to: '/employer/messages', label: 'Messages', icon: MessageSquareText },
        ]
      : [
          { to: '/candidate/dashboard', label: 'Dashboard', icon: LayoutDashboard },
          { to: '/candidate/profile', label: 'Edit profile', icon: PencilLine },
          { to: '/jobs', label: 'Browse jobs', icon: Briefcase },
          { to: '/candidate/messages', label: 'Messages', icon: MessageSquareText },
        ];

  return (
    <nav className="sticky top-0 z-50 border-b border-white/70 bg-white/88 backdrop-blur-xl shadow-[0_6px_30px_rgba(26,26,26,0.05)]">
      <div className="mx-auto flex h-[68px] max-w-[1320px] items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to={basePath} className="flex items-center gap-3">
          <div className="flex h-[34px] w-[34px] items-center justify-center rounded-xl bg-[#1D9E75] text-white shadow-[0_10px_18px_rgba(29,158,117,0.18)]">
            {role === 'employer' ? <Building2 size={15} /> : <Briefcase size={15} />}
          </div>
          <div className="leading-tight">
            <span className="block text-[17px] font-bold text-[#1A1A1A]">
              {role === 'employer' ? 'Employer Account' : 'Candidate Account'}
            </span>
            <span className="hidden text-[11px] uppercase tracking-[0.18em] text-[#B4B2A9] sm:block">
              RoleWave workspace
            </span>
          </div>
        </Link>

        <div className="hidden items-center gap-2 rounded-full border border-[#D3D1C7] bg-white/80 p-1.5 shadow-[0_8px_20px_rgba(26,26,26,0.04)] lg:flex">
          {links.map((item) => {
            const Icon = item.icon;
            const showUnread = item.to === messagesPath && unreadCount > 0;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
                  isActive(item.to)
                    ? 'bg-[#E1F5EE] text-[#085041]'
                    : 'text-[#5F5E5A] hover:bg-[#F1EFE8] hover:text-[#1A1A1A]'
                }`}
              >
                <Icon size={14} /> {item.label}
                {showUnread && <UnreadDot />}
              </Link>
            );
          })}
        </div>

        <div className="hidden lg:block">
          <button
            onClick={handleSignOut}
            className="inline-flex items-center gap-2 rounded-full bg-[#1A1A1A] px-[18px] py-2.5 text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(26,26,26,0.15)] transition-all duration-200 hover:-translate-y-[1px]"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>

        <button
          className="relative rounded-full border border-[#D3D1C7] bg-white p-2 text-[#1A1A1A] shadow-[0_8px_18px_rgba(26,26,26,0.04)] lg:hidden"
          onClick={() => setMenuOpen(!menuOpen)}
          aria-label="Toggle workspace menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
          {!menuOpen && unreadCount > 0 && (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-[#1D9E75] ring-2 ring-white" />
          )}
        </button>

        {menuOpen && (
          <>
            <button
              type="button"
              aria-label="Close workspace menu"
              className="fixed inset-0 z-40 cursor-default bg-black/20 lg:hidden"
              onClick={() => setMenuOpen(false)}
            />
            <div className="absolute left-0 right-0 top-[68px] z-50 mx-3 rounded-[24px] border border-[#D3D1C7] bg-white px-4 py-4 shadow-[0_18px_38px_rgba(26,26,26,0.12)] lg:hidden">
              <div className="grid gap-2">
                {links.map((item) => {
                  const Icon = item.icon;
                  const showUnread = item.to === messagesPath && unreadCount > 0;
                  return (
                    <Link
                      key={item.to}
                      to={item.to}
                      onClick={() => setMenuOpen(false)}
                      className={`flex items-center gap-2 rounded-[16px] px-4 py-3 text-sm font-semibold ${
                        isActive(item.to)
                          ? 'bg-[#E1F5EE] text-[#085041]'
                          : 'text-[#5F5E5A]'
                      }`}
                    >
                      <Icon size={14} /> {item.label}
                      {showUnread && <UnreadDot />}
                    </Link>
                  );
                })}
                <button
                  onClick={handleSignOut}
                  className="mt-1 inline-flex items-center justify-center gap-2 rounded-[16px] bg-[#1A1A1A] px-[18px] py-3 text-center text-[13px] font-semibold text-white"
                >
                  <LogOut size={14} /> Sign out
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </nav>
  );
}
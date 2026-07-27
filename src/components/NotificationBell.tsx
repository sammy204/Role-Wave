import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, CheckCheck } from 'lucide-react';
import { useNotifications } from '../hooks/useNotifications';
import { describeNotification, notificationHref, timeAgo } from '../lib/notifications';

type Variant = 'light' | 'dark';

export default function NotificationBell({
  role,
  variant = 'light',
}: {
  role: 'candidate' | 'employer';
  variant?: Variant;
}) {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [open]);

  const buttonClass =
    variant === 'dark'
      ? 'relative rounded-full p-2 text-white/85 transition-colors hover:bg-white/10 hover:text-white'
      : 'relative rounded-full border border-line bg-white p-2 text-ink shadow-[0_8px_18px_rgba(26,26,26,0.04)] transition-colors hover:border-accent';

  const badgeRing = variant === 'dark' ? 'ring-sidebar' : 'ring-white';

  const handleSelect = async (id: string, href: string) => {
    await markRead(id);
    setOpen(false);
    navigate(href);
  };

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Notifications"
        className={buttonClass}
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span
            className={`absolute -right-0.5 -top-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-bold text-white ring-2 ${badgeRing}`}
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className={`absolute top-[calc(100%+10px)] z-[70] w-[320px] max-w-[90vw] rounded-panel border border-line bg-white shadow-card-hover ${
            variant === 'dark' ? 'right-0 lg:left-[calc(100%+10px)] lg:right-auto' : 'right-0'
          }`}
        >
          <div className="flex items-center justify-between border-b border-line px-4 py-3">
            <span className="text-[13px] font-semibold text-ink">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead()}
                className="flex items-center gap-1 text-[12px] font-semibold text-accent-text hover:underline"
              >
                <CheckCheck size={13} />
                Mark all read
              </button>
            )}
          </div>

          <div className="max-h-[360px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="px-4 py-8 text-center text-[13px] text-faint">
                You're all caught up.
              </div>
            ) : (
              notifications.slice(0, 10).map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSelect(n.id, notificationHref(n, role))}
                  className={`flex w-full items-start gap-2.5 border-b border-line/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-paper ${
                    n.read_at ? '' : 'bg-accent-light/40'
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 flex-shrink-0 rounded-full ${
                      n.read_at ? 'bg-transparent' : 'bg-accent'
                    }`}
                  />
                  <span className="flex-1">
                    <span className="block text-[12.5px] leading-snug text-ink">
                      {describeNotification(n)}
                    </span>
                    <span className="mt-0.5 block text-[11px] text-faint">{timeAgo(n.created_at)} ago</span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

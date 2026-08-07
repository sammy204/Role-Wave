import { useLocation, useNavigate } from 'react-router-dom';
import { X, MessageCircle } from 'lucide-react';
import { useAuth } from '../lib/useAuth';
import { useMessageToasts } from '../hooks/useMessageToasts';

/**
 * Renders a short-lived toast for each incoming message while the tab is
 * open. This is the counterpart to send-message-push's presence check: when
 * the app is open, the edge function skips the push and this is what the
 * recipient sees instead.
 */
export default function MessageToastHost() {
  const { session } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const { toasts, dismiss } = useMessageToasts(session?.user.id ?? null);

  if (toasts.length === 0) return null;

  const messagesPath = location.pathname.startsWith('/employer') ? '/employer/messages' : '/candidate/messages';
  const openConversationId = location.pathname === messagesPath
    ? new URLSearchParams(location.search).get('conversation')
    : null;

  const visibleToasts = toasts.filter(
    (t) => t.notification.payload.conversation_id !== openConversationId
  );

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[70] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
      {visibleToasts.map(({ toastId, notification }) => {
        const preview =
          typeof notification.payload.preview === 'string'
            ? notification.payload.preview
            : 'You have a new message.';
        const conversationId =
          typeof notification.payload.conversation_id === 'string'
            ? notification.payload.conversation_id
            : null;

        return (
          <div
            key={toastId}
            role="status"
            className="bg-card border border-line rounded-panel shadow-lg p-4 flex items-start gap-3 cursor-pointer animate-in fade-in slide-in-from-bottom-2"
            onClick={() => {
              dismiss(toastId);
              navigate(conversationId ? `${messagesPath}?conversation=${conversationId}` : messagesPath);
            }}
          >
            <div className="shrink-0 w-9 h-9 rounded-full bg-accent/10 text-accent flex items-center justify-center">
              <MessageCircle size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-ink">New message</p>
              <p className="text-sm text-muted line-clamp-2">{preview}</p>
            </div>
            <button
              type="button"
              aria-label="Dismiss"
              className="shrink-0 text-muted hover:text-ink"
              onClick={(event) => {
                event.stopPropagation();
                dismiss(toastId);
              }}
            >
              <X size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
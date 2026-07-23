import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import {
  fetchCandidateConversations,
  fetchEmployerConversations,
  isConversationUnread,
  subscribeToConversationMessages,
} from '../lib/messages';
import type { Conversation } from '../types';

type Role = 'candidate' | 'employer';

const POLL_INTERVAL_MS = 45000;

/**
 * Live unread-conversation count for the given role, meant to back a nav badge.
 *
 * Reuses the same conversation fetchers and `isConversationUnread` the
 * Messages pages already use, so "unread" is defined in exactly one place.
 * Freshness comes from three angles, since there's no single global
 * "new conversation" event to subscribe to:
 *  - a per-conversation realtime subscription (same one the Messages page
 *    uses) catches new messages in conversations we already know about
 *  - a refetch on route change catches conversations marked read on the
 *    Messages page itself (that page has its own local state, so this
 *    hook has no way to know about it otherwise)
 *  - a background poll + refetch-on-focus catches brand-new conversations
 *    and covers the case where realtime silently drops a connection
 */
export function useUnreadMessagesCount(role: Role): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  const conversationsRef = useRef<Conversation[]>([]);
  const unsubscribesRef = useRef<Array<() => void>>([]);

  const recompute = useCallback(() => {
    setCount(conversationsRef.current.filter((c) => isConversationUnread(c, role)).length);
  }, [role]);

  const teardownSubscriptions = useCallback(() => {
    unsubscribesRef.current.forEach((unsub) => unsub());
    unsubscribesRef.current = [];
  }, []);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      const session = data.session;
      if (!session) {
        conversationsRef.current = [];
        recompute();
        return;
      }

      let rows: Conversation[] = [];

      if (role === 'candidate') {
        rows = await fetchCandidateConversations(session.user.id);
      } else {
        const { data: employerRow } = await supabase
          .from('employer_profiles')
          .select('company_id')
          .eq('id', session.user.id)
          .maybeSingle();

        const companyId = employerRow?.company_id;
        if (!companyId) {
          conversationsRef.current = [];
          recompute();
          return;
        }

        rows = await fetchEmployerConversations(companyId);
      }

      conversationsRef.current = rows;
      recompute();

      teardownSubscriptions();
      unsubscribesRef.current = rows.map((conversation) =>
        subscribeToConversationMessages(conversation.id, {
          onInsert: (message) => {
            conversationsRef.current = conversationsRef.current.map((c) =>
              c.id === conversation.id ? { ...c, last_message_at: message.created_at } : c
            );
            recompute();
          },
          onUpdate: () => recompute(),
        })
      );
    } catch {
      // A badge that fails to load shouldn't break navigation - just leave the count as-is.
    }
  }, [role, recompute, teardownSubscriptions]);

  useEffect(() => {
    load();
    const interval = setInterval(load, POLL_INTERVAL_MS);
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', onFocus);
      teardownSubscriptions();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [role]);

  // Leaving the Messages page is the most common moment a conversation just
  // got marked read - refetch then rather than waiting for the next poll.
  useEffect(() => {
    if (!location.pathname.includes('/messages')) {
      load();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  return count;
}
import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation, Message } from '../types';

/**
 * Starts (or reopens, since it's idempotent server-side) a conversation
 * between the signed-in employer and a candidate. Only callable by an
 * employer — enforced by the start_conversation RPC via RLS/ownership
 * checks, not by this helper.
 */
export async function startConversation(candidateProfileId: string, jobId?: string): Promise<Conversation> {
  const { data, error } = await supabase.rpc('start_conversation', {
    p_candidate_profile_id: candidateProfileId,
    p_job_id: jobId ?? null,
  });

  if (error) throw error;
  return data as Conversation;
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: conversationId,
  });

  if (error) throw error;
}

/**
 * Conversations for the signed-in employer, newest activity first, with
 * the candidate and source job joined in for display. candidate_profiles
 * has no full_name column and no direct FK to profiles (both merely share
 * an id with auth.users), so names are fetched separately and merged in.
 */
export async function fetchEmployerConversations(companyId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, candidate:candidate_profiles(*), source_job:jobs(*)')
    .eq('company_id', companyId)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  const conversations = (data || []) as Conversation[];

  const candidateIds = conversations.map((c) => c.candidate_profile_id).filter(Boolean);
  if (candidateIds.length === 0) return conversations;

  const { data: profileRows, error: profileError } = await supabase
    .from('profiles')
    .select('id, full_name')
    .in('id', candidateIds);

  if (profileError) throw profileError;

  const nameMap = new Map((profileRows || []).map((p) => [p.id, p.full_name as string | null]));
  return conversations.map((c) => ({ ...c, candidate_full_name: nameMap.get(c.candidate_profile_id) || null }));
}

/**
 * Conversations for the signed-in candidate, newest activity first, with
 * the company joined in for display.
 */
export async function fetchCandidateConversations(candidateProfileId: string): Promise<Conversation[]> {
  const { data, error } = await supabase
    .from('conversations')
    .select('*, company:companies(*), source_job:jobs(*)')
    .eq('candidate_profile_id', candidateProfileId)
    .order('last_message_at', { ascending: false });

  if (error) throw error;
  return (data || []) as Conversation[];
}

export const MESSAGES_PAGE_SIZE = 40;

export interface MessagesPage {
  messages: Message[];
  hasMore: boolean;
}

/**
 * Fetches one page of messages for a conversation, newest-first under the
 * hood but returned in ascending (chat) order. Pass `before` (an ISO
 * timestamp, typically the `created_at` of the oldest message currently
 * loaded) to page further back in history. Without it, this returns the
 * most recent page — so opening a long conversation only pulls the last
 * `limit` messages instead of the entire thread.
 */
export async function fetchMessages(
  conversationId: string,
  options: { limit?: number; before?: string } = {}
): Promise<MessagesPage> {
  const limit = options.limit ?? MESSAGES_PAGE_SIZE;

  let query = supabase
    .from('messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(limit + 1);

  if (options.before) {
    query = query.lt('created_at', options.before);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data || []) as Message[];
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  return { messages: page.reverse(), hasMore };
}

export async function sendMessage(conversationId: string, senderProfileId: string, body: string): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 5000) throw new Error('Message is too long.');

  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: conversationId, sender_profile_id: senderProfileId, body: trimmed })
    .select('*')
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Edits a message's body. RLS restricts this to the original sender
 * regardless of what senderProfileId is passed, so this can't be spoofed
 * from the client — it's just used here to build the .eq() filter.
 */
export async function editMessage(messageId: string, senderProfileId: string, body: string): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Message cannot be empty.');
  if (trimmed.length > 5000) throw new Error('Message is too long.');

  const { data, error } = await supabase
    .from('messages')
    .update({ body: trimmed, edited_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_profile_id', senderProfileId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Message;
}

/**
 * Soft-deletes a message (sets deleted_at) rather than removing the row,
 * so the thread keeps its shape and other participants see a "message
 * deleted" placeholder instead of a gap.
 */
export async function deleteMessage(messageId: string, senderProfileId: string): Promise<Message> {
  const { data, error } = await supabase
    .from('messages')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', messageId)
    .eq('sender_profile_id', senderProfileId)
    .select('*')
    .single();

  if (error) throw error;
  return data as Message;
}

export type ConnectionStatus = 'connecting' | 'connected' | 'disconnected';

/**
 * Subscribes to new and edited/deleted messages in a single conversation.
 * Returns an unsubscribe function — always call it on cleanup (e.g.
 * useEffect return) to avoid leaking realtime channels.
 *
 * The optional onStatusChange callback reports connection health so the
 * UI can show a "reconnecting" indicator and, more importantly, refetch
 * on reconnect — postgres_changes only streams events while the socket
 * is live, so anything sent during a drop is otherwise lost silently.
 */
export function subscribeToConversationMessages(
  conversationId: string,
  handlers: {
    onInsert: (message: Message) => void;
    onUpdate: (message: Message) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }
): () => void {
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}`)
    .on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => handlers.onInsert(payload.new as Message)
    )
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => handlers.onUpdate(payload.new as Message)
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        handlers.onStatusChange?.('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        handlers.onStatusChange?.('disconnected');
      }
    });

  handlers.onStatusChange?.('connecting');

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Whether a conversation has unread activity for the given viewer role,
 * based on comparing last_message_at against that side's last_read_at.
 */
export function isConversationUnread(conversation: Conversation, role: 'employer' | 'candidate'): boolean {
  const lastRead = role === 'employer' ? conversation.employer_last_read_at : conversation.candidate_last_read_at;
  if (!lastRead) return true;
  return new Date(conversation.last_message_at).getTime() > new Date(lastRead).getTime();
}
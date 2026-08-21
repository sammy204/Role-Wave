import { supabase } from './supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type { Conversation, Message, MessageAttachment } from '../types';
import { sendMessagePush } from './push';

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

export async function markMessagesDelivered(conversationId: string): Promise<void> {
  const { error } = await supabase.rpc('mark_messages_delivered', {
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

export const MAX_MESSAGE_ATTACHMENT_BYTES = 10 * 1024 * 1024;

async function addAttachmentsToMessages(messages: Message[]): Promise<Message[]> {
  if (messages.length === 0) return messages;
  const { data, error } = await supabase
    .from('message_attachments')
    .select('*')
    .in('message_id', messages.map((message) => message.id))
    .order('created_at');
  if (error) throw error;
  const attachmentsByMessage = new Map<string, MessageAttachment[]>();
  for (const attachment of (data || []) as MessageAttachment[]) {
    attachmentsByMessage.set(attachment.message_id, [...(attachmentsByMessage.get(attachment.message_id) || []), attachment]);
  }
  return messages.map((message) => ({ ...message, attachments: attachmentsByMessage.get(message.id) || [] }));
}

export async function fetchMessageAttachments(messageId: string): Promise<MessageAttachment[]> {
  const { data, error } = await supabase
    .from('message_attachments')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at');
  if (error) throw error;
  return (data || []) as MessageAttachment[];
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

  return { messages: await addAttachmentsToMessages(page.reverse()), hasMore };
}

export async function sendMessage(
  conversationId: string,
  senderProfileId: string,
  body: string,
  files: File[] = []
): Promise<Message> {
  const trimmed = body.trim();
  if (!trimmed && files.length === 0) throw new Error('Message or attachment is required.');
  if (trimmed.length > 5000) throw new Error('Message is too long.');

  for (const file of files) {
    if (file.size <= 0 || file.size > MAX_MESSAGE_ATTACHMENT_BYTES) {
      throw new Error(`${file.name} is too large. Attachments must be 10 MB or smaller.`);
    }
    if (!file.type) throw new Error(`${file.name} has an unsupported file type.`);
  }

  const messageId = crypto.randomUUID();
  const uploadedPaths: string[] = [];
  const attachmentRows: Omit<MessageAttachment, 'id' | 'created_at'>[] = [];
  try {
    for (const file of files) {
      const attachmentId = crypto.randomUUID();
      const extension = file.name.match(/\.[a-z0-9]{1,10}$/i)?.[0].toLowerCase() || '';
      const storagePath = `${conversationId}/${senderProfileId}/${messageId}/${attachmentId}${extension}`;
      const { error: uploadError } = await supabase.storage
        .from('message-attachments')
        .upload(storagePath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw uploadError;
      uploadedPaths.push(storagePath);
      attachmentRows.push({
        message_id: messageId,
        conversation_id: conversationId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: file.type,
        size_bytes: file.size,
      });
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({ id: messageId, conversation_id: conversationId, sender_profile_id: senderProfileId, body: trimmed })
      .select('*')
      .single();

    if (error) throw error;
    let savedAttachments: MessageAttachment[] = [];
    if (attachmentRows.length) {
      const { data: insertedAttachments, error: attachmentError } = await supabase
        .from('message_attachments')
        .insert(attachmentRows)
        .select('*');
      if (attachmentError) throw attachmentError;
      savedAttachments = (insertedAttachments || []) as MessageAttachment[];
    }
    const message = { ...(data as Message), attachments: savedAttachments };

    // Push delivery is best-effort. The message is already saved successfully,
    // so a missing subscription or temporary push-service failure must not make
    // the sender think the message was lost.
    void sendMessagePush({
      conversationId,
      messageId: message.id,
      message: trimmed || 'Sent an attachment',
    }).catch(() => undefined);

    return message;
  } catch (error) {
    if (uploadedPaths.length) {
      await supabase.storage.from('message-attachments').remove(uploadedPaths).catch(() => undefined);
    }
    throw error;
  }
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

/** Permanently deletes a message. Its attachments cascade-delete with it. */
export async function deleteMessage(messageId: string, senderProfileId: string): Promise<void> {
  const { error } = await supabase
    .from('messages')
    .delete()
    .eq('id', messageId)
    .eq('sender_profile_id', senderProfileId);

  if (error) throw error;
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
    onDelete?: (messageId: string) => void;
    onStatusChange?: (status: ConnectionStatus) => void;
  }
): () => void {
  // A page can have more than one message listener (active conversation,
  // unread counts, and reconnects). Use a unique topic for each listener so
  // Supabase cannot attach callbacks to a channel that has already subscribed.
  const listenerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const channel: RealtimeChannel = supabase
    .channel(`messages:${conversationId}:${listenerId}`)
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
    .on(
      'postgres_changes',
      { event: 'DELETE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
      (payload) => handlers.onDelete?.((payload.old as Message).id)
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

/** Subscribe to all messages visible to the signed-in user for inbox updates. */
export function subscribeToInboxMessages(handlers: {
  onInsert: (message: Message) => void;
  onUpdate: (message: Message) => void;
}): () => void {
  const listenerId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  const channel = supabase
    .channel(`messages:inbox:${listenerId}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      handlers.onInsert(payload.new as Message);
    })
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'messages' }, (payload) => {
      handlers.onUpdate(payload.new as Message);
    })
    .subscribe();

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

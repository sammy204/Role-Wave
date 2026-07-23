import { useEffect, useLayoutEffect, useMemo, useRef, useState, type UIEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Check, MessageSquareText, Pencil, Send, Trash2, User, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { fetchProfile } from '../lib/admin';
import {
  fetchEmployerConversations,
  fetchMessages,
  markConversationRead,
  sendMessage,
  editMessage,
  deleteMessage,
  subscribeToConversationMessages,
  isConversationUnread,
  MESSAGES_PAGE_SIZE,
  type ConnectionStatus,
} from '../lib/messages';
import type { Conversation, EmployerProfile, Message } from '../types';
import LoadingSpinner from '../components/LoadingSpinner';

function formatRelative(date: string) {
  const now = new Date();
  const then = new Date(date);
  const diff = Math.floor((now.getTime() - then.getTime()) / 1000);
  if (diff < 60) return 'Just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return then.toLocaleDateString();
}

function formatTime(date: string) {
  return new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function EmployerMessages() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [userId, setUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mobileView, setMobileView] = useState<'list' | 'conversation'>('list');
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [loadingMoreMessages, setLoadingMoreMessages] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('connecting');
  const wasDisconnectedRef = useRef(false);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pendingScrollRef = useRef<
    { type: 'bottom' } | { type: 'preserve'; prevScrollHeight: number; prevScrollTop: number } | null
  >(null);

  /**
   * Runs after `messages` has actually committed to the DOM (unlike
   * requestAnimationFrame after an async setState, which can fire before
   * the new list has painted and land the scroll in the wrong place —
   * e.g. appearing to jump to the top of a long thread). Whoever changes
   * `messages` sets pendingScrollRef first to say what should happen.
   */
  useLayoutEffect(() => {
    const container = scrollRef.current;
    const pending = pendingScrollRef.current;
    if (!container || !pending) return;
    // The message list is only rendered once messagesLoading is false (a
    // spinner occupies the container until then), so applying the scroll
    // while it's still true measures the spinner's height, not the
    // thread's — leave the pending action queued until it's actually safe.
    if (messagesLoading) return;

    if (pending.type === 'bottom') {
      container.scrollTop = container.scrollHeight;
    } else {
      container.scrollTop = container.scrollHeight - pending.prevScrollHeight + pending.prevScrollTop;
    }
    pendingScrollRef.current = null;
  }, [messages, messagesLoading, mobileView]);

  useEffect(() => {
    let alive = true;

    async function loadData() {
      try {
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        if (!session) {
          navigate('/start?role=employer', { replace: true });
          return;
        }

        const nextProfile = await fetchProfile(session.user.id);
        if (!alive) return;

        if (nextProfile?.account_type !== 'employer') {
          navigate('/', { replace: true });
          return;
        }

        if (!nextProfile.onboarding_completed) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        setUserId(session.user.id);

        const { data: employerRow } = await supabase
          .from('employer_profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        const typedEmployer = (employerRow || null) as EmployerProfile | null;
        if (!alive) return;

        if (!typedEmployer?.company_id) {
          navigate('/employer/onboarding', { replace: true });
          return;
        }

        const rows = await fetchEmployerConversations(typedEmployer.company_id);
        if (!alive) return;

        setConversations(rows);

        const requested = searchParams.get('conversation');
        const initial = requested && rows.some((c) => c.id === requested) ? requested : rows[0]?.id || null;
        setActiveId(initial);
      } catch (loadError) {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load your messages.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadData();

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate]);

  useEffect(() => {
    if (!activeId) {
      setMessages([]);
      return;
    }

    let alive = true;
    setMessagesLoading(true);
    setEditingId(null);
    setConfirmDeleteId(null);
    setConnectionStatus('connecting');
    wasDisconnectedRef.current = false;
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set('conversation', activeId);
      return next;
    }, { replace: true });

    (async () => {
      try {
        const { messages: rows, hasMore } = await fetchMessages(activeId);
        if (!alive) return;
        pendingScrollRef.current = { type: 'bottom' };
        setMessages(rows);
        setHasMoreMessages(hasMore);
        await markConversationRead(activeId);
        if (!alive) return;
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, employer_last_read_at: new Date().toISOString() } : c))
        );
      } catch (loadError) {
        if (alive) setError(loadError instanceof Error ? loadError.message : 'Could not load conversation.');
      } finally {
        if (alive) setMessagesLoading(false);
      }
    })();

    const unsubscribe = subscribeToConversationMessages(activeId, {
      onInsert: (message) => {
        pendingScrollRef.current = { type: 'bottom' };
        setMessages((prev) => (prev.some((m) => m.id === message.id) ? prev : [...prev, message]));
        setConversations((prev) =>
          prev.map((c) => (c.id === activeId ? { ...c, last_message_at: message.created_at } : c))
        );
      },
      onUpdate: (message) => {
        setMessages((prev) => prev.map((m) => (m.id === message.id ? message : m)));
      },
      onStatusChange: (status) => {
        setConnectionStatus(status);

        if (status === 'disconnected') {
          wasDisconnectedRef.current = true;
          return;
        }

        // Reconnected after a drop: postgres_changes only streams while the
        // socket is live, so re-sync the latest page to pick up anything
        // sent or edited while we were disconnected.
        if (status === 'connected' && wasDisconnectedRef.current) {
          wasDisconnectedRef.current = false;
          (async () => {
            try {
              const { messages: rows } = await fetchMessages(activeId, { limit: MESSAGES_PAGE_SIZE });
              if (!alive) return;
              setMessages((prev) => {
                const latestById = new Map(rows.map((m) => [m.id, m]));
                const refreshed = prev.map((m) => latestById.get(m.id) ?? m);
                const missing = rows.filter((m) => !prev.some((p) => p.id === m.id));
                return [...refreshed, ...missing].sort((a, b) => a.created_at.localeCompare(b.created_at));
              });
            } catch {
              // Best-effort recovery — the connection indicator already
              // cleared, and the next realtime event will self-correct.
            }
          })();
        }
      },
    });

    return () => {
      alive = false;
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeId]);

  /**
   * Loads the next page of older messages and preserves scroll position
   * (rather than jumping to bottom, which is only appropriate for new
   * messages) by re-anchoring on the scroll height delta after render.
   */
  const handleLoadOlderMessages = async () => {
    if (!activeId || loadingMoreMessages || !hasMoreMessages || messages.length === 0) return;

    const container = scrollRef.current;
    const prevScrollHeight = container?.scrollHeight ?? 0;
    const prevScrollTop = container?.scrollTop ?? 0;

    setLoadingMoreMessages(true);
    try {
      const { messages: older, hasMore } = await fetchMessages(activeId, {
        limit: MESSAGES_PAGE_SIZE,
        before: messages[0].created_at,
      });
      pendingScrollRef.current = { type: 'preserve', prevScrollHeight, prevScrollTop };
      setMessages((prev) => {
        const existingIds = new Set(prev.map((m) => m.id));
        return [...older.filter((m) => !existingIds.has(m.id)), ...prev];
      });
      setHasMoreMessages(hasMore);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load older messages.');
    } finally {
      setLoadingMoreMessages(false);
    }
  };

  const handleMessagesScroll = (event: UIEvent<HTMLDivElement>) => {
    if (event.currentTarget.scrollTop < 80) {
      handleLoadOlderMessages();
    }
  };

  const activeConversation = useMemo(
    () => conversations.find((c) => c.id === activeId) || null,
    [conversations, activeId]
  );

  const handleSend = async () => {
    if (!activeId || !userId || !draft.trim() || sending) return;

    setSending(true);
    setError('');
    try {
      const message = await sendMessage(activeId, userId, draft);
      pendingScrollRef.current = { type: 'bottom' };
      setMessages((prev) => [...prev, message]);
      setConversations((prev) =>
        prev.map((c) => (c.id === activeId ? { ...c, last_message_at: message.created_at } : c))
      );
      setDraft('');
    } catch (sendError) {
      setError(sendError instanceof Error ? sendError.message : 'Could not send message.');
    } finally {
      setSending(false);
    }
  };

  const startEdit = (message: Message) => {
    setEditingId(message.id);
    setEditDraft(message.body);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditDraft('');
  };

  const saveEdit = async () => {
    if (!editingId || !userId || !editDraft.trim() || savingEdit) return;

    setSavingEdit(true);
    setError('');
    try {
      const updated = await editMessage(editingId, userId, editDraft);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
      setEditingId(null);
      setEditDraft('');
    } catch (editError) {
      setError(editError instanceof Error ? editError.message : 'Could not edit message.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleDelete = async (messageId: string) => {
    if (!userId) return;

    setDeletingId(messageId);
    setError('');
    try {
      const updated = await deleteMessage(messageId, userId);
      setMessages((prev) => prev.map((m) => (m.id === updated.id ? updated : m)));
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete message.');
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  };

  if (loading) {
    return (
      <div className="page-shell items-center justify-center px-4">
        <div className="panel motion-safe:animate-fade-up rounded-[24px] px-5 py-5">
          <LoadingSpinner className="text-[#1D9E75]" />
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell">
      <div className="mx-auto w-full max-w-[1320px] px-4 pb-8 pt-6 sm:px-6 lg:px-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-bold tracking-[-0.03em] text-ink sm:text-4xl">Messages</h1>
          <p className="mt-2 text-sm leading-relaxed text-muted">Conversations with candidates you've reached out to.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-[#F0D080] bg-[#FFF8E6] px-4 py-3 text-sm text-[#7A5000]">
            {error}
          </div>
        )}

        <div className="panel grid overflow-hidden rounded-[28px] lg:grid-cols-[320px_1fr]" style={{ minHeight: '65vh' }}>
          {/* Thread list */}
          <div className={`${mobileView === 'list' ? 'block' : 'hidden'} border-b border-line lg:block lg:border-b-0 lg:border-r`}>
            {conversations.length === 0 ? (
              <div className="p-6 text-center text-sm text-muted">
                No conversations yet. Message a candidate from your applicant list to start one.
              </div>
            ) : (
              <div className="max-h-[65vh] overflow-y-auto">
                {conversations.map((conversation) => {
                  const unread = isConversationUnread(conversation, 'employer');
                  const active = conversation.id === activeId;
                  return (
                    <button
                      key={conversation.id}
                      onClick={() => {
                        setActiveId(conversation.id);
                        pendingScrollRef.current = { type: 'bottom' };
                        setMobileView('conversation');
                      }}
                      className={`flex w-full items-start gap-3 border-b border-line px-4 py-3 text-left transition-colors duration-150 ${
                        active ? 'bg-accent-light' : 'hover:bg-[#F1EFE8]'
                      }`}
                    >
                      <div className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-[#1A1A1A] text-white">
                        <User size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`truncate text-sm ${unread ? 'font-bold text-ink' : 'font-semibold text-ink'}`}>
                            {conversation.candidate_full_name || conversation.candidate?.headline || 'Candidate'}
                          </span>
                          <span className="flex-shrink-0 text-xs text-faint">{formatRelative(conversation.last_message_at)}</span>
                        </div>
                        {conversation.candidate_full_name && conversation.candidate?.headline && (
                          <div className="truncate text-xs text-muted">{conversation.candidate.headline}</div>
                        )}
                        {conversation.source_job?.title && (
                          <div className="truncate text-xs text-muted">Re: {conversation.source_job.title}</div>
                        )}
                      </div>
                      {unread && <span className="mt-1.5 h-2 w-2 flex-shrink-0 rounded-full bg-[#1D9E75]" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Active conversation */}
          <div className={`${mobileView === 'conversation' ? 'flex' : 'hidden'} flex-col lg:flex`}>
            {!activeConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted">
                <MessageSquareText size={28} className="text-faint" />
                Select a conversation to view messages.
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b border-line px-4 py-4 sm:px-5">
                  <button
                    type="button"
                    onClick={() => setMobileView('list')}
                    aria-label="Back to conversations"
                    className="rounded-full p-1.5 text-muted hover:bg-[#F1EFE8] hover:text-ink lg:hidden"
                  >
                    <ArrowLeft size={19} />
                  </button>
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A1A] text-white">
                    <User size={14} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold text-ink">
                      {activeConversation.candidate_full_name || activeConversation.candidate?.headline || 'Candidate'}
                    </div>
                    {activeConversation.candidate_full_name && activeConversation.candidate?.headline && (
                      <div className="text-xs text-muted">{activeConversation.candidate.headline}</div>
                    )}
                    {activeConversation.source_job?.title && (
                      <div className="text-xs text-muted">Re: {activeConversation.source_job.title}</div>
                    )}
                  </div>
                  {connectionStatus === 'disconnected' && (
                    <span className="flex-shrink-0 rounded-full bg-[#FFF8E6] px-2.5 py-1 text-[11px] font-medium text-[#7A5000]">
                      Reconnecting…
                    </span>
                  )}
                </div>

                <div
                  ref={scrollRef}
                  onScroll={handleMessagesScroll}
                  className="flex-1 space-y-3 overflow-y-auto px-5 py-4"
                  style={{ maxHeight: '52vh' }}
                >
                  {messagesLoading ? (
                    <div className="flex justify-center py-6">
                      <LoadingSpinner className="text-[#1D9E75]" size={20} />
                    </div>
                  ) : (
                    <>
                      {loadingMoreMessages && (
                        <div className="flex justify-center pb-2">
                          <LoadingSpinner className="text-[#1D9E75]" size={16} />
                        </div>
                      )}
                      {!loadingMoreMessages && hasMoreMessages && (
                        <div className="flex justify-center pb-2">
                          <button
                            onClick={handleLoadOlderMessages}
                            className="text-xs font-medium text-muted hover:text-ink"
                          >
                            Load earlier messages
                          </button>
                        </div>
                      )}
                    </>
                  )}
                  {!messagesLoading &&
                    messages.map((message) => {
                      const isMine = message.sender_profile_id === userId;
                      const isDeleted = Boolean(message.deleted_at);
                      const isEditing = editingId === message.id;

                      if (isDeleted) {
                        return (
                          <div key={message.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                            <div className="max-w-[75%] rounded-2xl border border-line bg-transparent px-4 py-2.5 text-sm italic text-faint">
                              Message deleted
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div key={message.id} className={`group flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                          {isMine && !isEditing && (
                            <div className="mr-1.5 flex items-start gap-1 self-center opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                              <button
                                onClick={() => startEdit(message)}
                                aria-label="Edit message"
                                className="rounded-full p-1.5 text-faint hover:bg-[#F1EFE8] hover:text-ink"
                              >
                                <Pencil size={13} />
                              </button>
                              {confirmDeleteId === message.id ? (
                                <button
                                  onClick={() => handleDelete(message.id)}
                                  disabled={deletingId === message.id}
                                  aria-label="Confirm delete"
                                  className="rounded-full p-1.5 text-white bg-[#B3261E] hover:bg-[#8C1D17]"
                                >
                                  <Check size={13} />
                                </button>
                              ) : (
                                <button
                                  onClick={() => setConfirmDeleteId(message.id)}
                                  aria-label="Delete message"
                                  className="rounded-full p-1.5 text-faint hover:bg-[#FAECE7] hover:text-[#B3261E]"
                                >
                                  <Trash2 size={13} />
                                </button>
                              )}
                            </div>
                          )}

                          <div
                            className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${
                              isMine ? 'bg-[#1D9E75] text-white' : 'bg-[#F1EFE8] text-ink'
                            }`}
                          >
                            {isEditing ? (
                              <div className="min-w-[220px]">
                                <textarea
                                  value={editDraft}
                                  onChange={(e) => setEditDraft(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter' && !e.shiftKey) {
                                      e.preventDefault();
                                      saveEdit();
                                    }
                                    if (e.key === 'Escape') cancelEdit();
                                  }}
                                  autoFocus
                                  rows={2}
                                  maxLength={5000}
                                  className="w-full resize-none rounded-lg border-none bg-white/15 px-2 py-1.5 text-sm text-white outline-none placeholder:text-white/60"
                                />
                                <div className="mt-1.5 flex justify-end gap-1">
                                  <button
                                    onClick={cancelEdit}
                                    className="rounded-full p-1 text-white/80 hover:bg-white/15"
                                    aria-label="Cancel edit"
                                  >
                                    <X size={13} />
                                  </button>
                                  <button
                                    onClick={saveEdit}
                                    disabled={!editDraft.trim() || savingEdit}
                                    className="rounded-full p-1 text-white/80 hover:bg-white/15 disabled:opacity-50"
                                    aria-label="Save edit"
                                  >
                                    <Check size={13} />
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="whitespace-pre-wrap break-words">{message.body}</div>
                                <div className={`mt-1 flex items-center gap-1 text-[11px] ${isMine ? 'text-white/70' : 'text-faint'}`}>
                                  {formatTime(message.created_at)}
                                  {message.edited_at && <span>(edited)</span>}
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>

                <div className="flex items-end gap-2 border-t border-line px-4 py-3">
                  <textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSend();
                      }
                    }}
                    placeholder="Write a message..."
                    rows={1}
                    maxLength={5000}
                    className="flex-1 resize-none rounded-2xl border border-line bg-white px-4 py-2.5 text-sm outline-none transition-colors duration-200 focus:border-accent"
                  />
                  <button
                    onClick={handleSend}
                    disabled={!draft.trim() || sending}
                    className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-[#1D9E75] text-white transition-all duration-200 hover:bg-accent-deep disabled:cursor-not-allowed disabled:opacity-50"
                    aria-label="Send message"
                  >
                    <Send size={16} />
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

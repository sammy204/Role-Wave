import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// usePresenceHeartbeat pings touch_presence(true) every 15s while a tab is
// visible. Two missed beats (30s) is our cutoff for trusting "online" —
// past that, a killed tab (crash, force-quit, lost network) that never got
// to send touch_presence(false) should lapse back to receiving push.
const PRESENCE_STALE_MS = 30000;

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PresenceRow = {
  is_online: boolean;
  last_seen_at: string;
};

type ConversationRow = {
  id: string;
  candidate_profile_id: string;
  company_id: string;
  companies: { owner_profile_id: string } | { owner_profile_id: string }[] | null;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const vapidSubject = Deno.env.get('VAPID_SUBJECT');
    const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY');
    const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey || !vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
      return json({ error: 'Push service environment variables are not configured.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const conversationId = typeof body.conversationId === 'string' ? body.conversationId : '';
    const messageId = typeof body.messageId === 'string' ? body.messageId : '';
    const preview = typeof body.message === 'string' ? body.message.slice(0, 140) : 'You have a new message.';

    if (!conversationId || !messageId) {
      return json({ error: 'conversationId and messageId are required.' }, 400);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .select('id, conversation_id, sender_profile_id')
      .eq('id', messageId)
      .eq('conversation_id', conversationId)
      .maybeSingle();

    if (messageError) throw messageError;
    if (!message || message.sender_profile_id !== userData.user.id) {
      return json({ error: 'Message sender could not be verified.' }, 403);
    }

    const { data: conversation, error: conversationError } = await adminClient
      .from('conversations')
      .select('id, candidate_profile_id, company_id, companies(owner_profile_id)')
      .eq('id', conversationId)
      .maybeSingle<ConversationRow>();

    if (conversationError) throw conversationError;
    if (!conversation) return json({ error: 'Conversation not found.' }, 404);

    const company = Array.isArray(conversation.companies)
      ? conversation.companies[0]
      : conversation.companies;
    const employerId = company?.owner_profile_id;
    const recipientId =
      userData.user.id === conversation.candidate_profile_id ? employerId : conversation.candidate_profile_id;

    if (!recipientId || recipientId === userData.user.id) return json({ sent: 0, subscriptions: 0 });

    // Presence-aware delivery: if the recipient's app is open and visible
    // (a recent, still-online heartbeat), MessageToastHost already shows
    // them an in-app toast via realtime — sending a push too would double
    // them up. Skip push in that case; a stale or missing presence row
    // falls through to push as normal.
    const { data: presence, error: presenceError } = await adminClient
      .from('user_presence')
      .select('is_online, last_seen_at')
      .eq('user_id', recipientId)
      .maybeSingle<PresenceRow>();

    if (presenceError) throw presenceError;

    if (presence?.is_online) {
      const lastSeenMs = new Date(presence.last_seen_at).getTime();
      const isFresh = Number.isFinite(lastSeenMs) && Date.now() - lastSeenMs <= PRESENCE_STALE_MS;
      if (isFresh) return json({ sent: 0, subscriptions: 0, skipped: 'recipient_online' });
    }

    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', recipientId)
      .eq('enabled', true);

    if (subscriptionError) throw subscriptionError;

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const recipientUrl =
      recipientId === conversation.candidate_profile_id
        ? `/candidate/messages?conversation=${conversationId}`
        : `/employer/messages?conversation=${conversationId}`;
    const payload = JSON.stringify({
      title: 'New RoleWave message',
      body: preview,
      url: recipientUrl,
    });

    let sent = 0;
    for (const subscription of (subscriptions || []) as PushSubscriptionRow[]) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          payload
        );
        sent += 1;
      } catch (error) {
        const statusCode = (error as { statusCode?: number }).statusCode;
        if (statusCode === 404 || statusCode === 410) {
          await adminClient.from('push_subscriptions').delete().eq('id', subscription.id);
        }
      }
    }

    return json({ sent, subscriptions: subscriptions?.length || 0 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not send message push.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
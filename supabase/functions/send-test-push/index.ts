import webpush from 'npm:web-push@3.6.7';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

type PushSubscriptionRow = {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
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

    // Identify the caller from their own JWT — this function only ever
    // sends a test push to the signed-in user's own subscriptions, never
    // to an arbitrary user_id supplied in the body.
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'RoleWave test notification';
    const message =
      typeof body.message === 'string' && body.message.trim()
        ? body.message.trim().slice(0, 140)
        : 'Push notifications are working.';
    const url = typeof body.url === 'string' && body.url.trim() ? body.url.trim() : '/';

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: subscriptions, error: subscriptionError } = await adminClient
      .from('push_subscriptions')
      .select('id, endpoint, p256dh, auth')
      .eq('user_id', userData.user.id)
      .eq('enabled', true);

    if (subscriptionError) throw subscriptionError;

    if (!subscriptions || subscriptions.length === 0) {
      return json({ sent: 0, subscriptions: 0 });
    }

    webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);
    const payload = JSON.stringify({ title, body: message, url });

    let sent = 0;
    for (const subscription of subscriptions as PushSubscriptionRow[]) {
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

    return json({ sent, subscriptions: subscriptions.length });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not send test push.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
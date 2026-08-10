import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCandidateWelcomeHtml } from './templates/candidate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const FROM_ADDRESS = 'RoleWave <welcome@rolewave.cv>';
const ENDPOINT_NAME = 'send-welcome-email';
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_CALLS = 20; // generous for real signup traffic, tight enough to blunt abuse

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // This function is called only by the on_auth_user_email_confirmed
    // trigger (via pg_net), never directly by clients. Authenticate the
    // caller with a shared secret rather than a user JWT.
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return json({ error: 'Welcome email is not configured.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: log this call, then check how many calls have landed for
    // this endpoint in the last window. Caps damage if the webhook secret
    // ever leaks — a burst of calls gets throttled instead of hammering
    // Resend / burning domain reputation.
    await adminClient.from('webhook_call_log').insert({ endpoint: ENDPOINT_NAME });
    const { count: recentCallCount } = await adminClient
      .from('webhook_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', ENDPOINT_NAME)
      .gte('called_at', new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString());

    if ((recentCallCount ?? 0) > RATE_LIMIT_MAX_CALLS) {
      return json({ error: 'Rate limit exceeded.' }, 429);
    }
    // Opportunistic cleanup, fire-and-forget — doesn't block the response.
    adminClient.rpc('prune_webhook_call_log').then(() => {}).catch(() => {});

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    if (!userId) return json({ error: 'Missing user_id.' }, 400);

    // Look up the email server-side from auth.users rather than trusting
    // whatever the caller sends. Previously the request body's `email`
    // field was used as-is with no check that it belonged to `user_id` —
    // anyone holding the webhook secret could route the welcome template
    // to an arbitrary address, using RoleWave's sending domain as an open
    // relay. Deriving it here closes that off.
    const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(userId);
    if (authUserError || !authUserResult?.user?.email) {
      // Generic response — doesn't confirm or deny whether user_id exists,
      // so this can't be used to enumerate accounts.
      return json({ processed: true });
    }
    const email = authUserResult.user.email;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, account_type, welcome_email_sent_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;

    // Idempotency guard — the trigger only fires once per confirmation, but
    // pg_net retries on transient failure, so this protects against
    // double-sends on retry. Also collapses "no profile", "already sent",
    // and "employer template not built" into the same generic response as
    // success, so a secret-holder can't fingerprint account state from the
    // response shape.
    if (!profile || profile.welcome_email_sent_at || profile.account_type !== 'candidate') {
      return json({ processed: true });
    }

    const name = profile.full_name?.trim() || 'there';
    const subject = `Welcome to RoleWave, ${name}`;
    const html = buildCandidateWelcomeHtml(name);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [email],
        subject,
        html,
      }),
    });

    if (!resendResponse.ok) {
      // Don't echo Resend's raw response body back to the caller — log it
      // server-side only, return a generic error to whoever's calling us.
      const errorText = await resendResponse.text().catch(() => '');
      console.error(`Resend API error (${resendResponse.status}): ${errorText}`);
      return json({ error: 'Could not send welcome email.' }, 502);
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) throw updateError;

    return json({ processed: true });
  } catch (error) {
    console.error('send-welcome-email error:', error);
    return json({ error: 'Could not process request.' }, 500);
  }
});

// Manual constant-time string comparison (no Deno-native timingSafeEqual
// for strings). Avoids leaking the webhook secret's correct prefix length
// via response-time side channel.
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
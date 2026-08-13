/// <reference lib="deno.ns" />
import { createClient } from '@supabase/supabase-js';
import { buildMessageEmailHtml } from './templates/message.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const FROM_ADDRESS = 'RoleWave <updates@rolewave.cv>';
const ENDPOINT_NAME = 'send-message-email';
const RATE_LIMIT_WINDOW_SECONDS = 60;
const RATE_LIMIT_MAX_CALLS = 40;

// Same "app looks open" freshness window used by send-message-push, kept
// as a shared convention rather than a shared constant since the two
// functions have no code dependency on each other.
const PRESENCE_FRESHNESS_MS = 30000;

const MESSAGE_PREVIEW_LENGTH = 160;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // Called only by the messages_new_message_email trigger (via pg_net),
    // never directly by clients. Own dedicated secret, same shared-secret
    // pattern as send-application-status-email.
    const webhookSecret = Deno.env.get('NEW_MESSAGE_EMAIL_WEBHOOK_SECRET');
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || !timingSafeEqual(providedSecret, webhookSecret)) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return json({ error: 'Message email is not configured.' }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Rate limit: log this call, then check how many calls have landed for
    // this endpoint in the last window. Shares webhook_call_log with the
    // other trigger-fired functions, keyed by endpoint name so budgets
    // don't bleed into each other. Higher ceiling than status emails since
    // messages fire far more often in normal use.
    await adminClient.from('webhook_call_log').insert({ endpoint: ENDPOINT_NAME });
    const { count: recentCallCount } = await adminClient
      .from('webhook_call_log')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', ENDPOINT_NAME)
      .gte('called_at', new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString());

    if ((recentCallCount ?? 0) > RATE_LIMIT_MAX_CALLS) {
      return json({ error: 'Rate limit exceeded.' }, 429);
    }
    const { error: pruneError } = await adminClient.rpc('prune_webhook_call_log');
    if (pruneError) {
      console.error('Failed to prune webhook call log:', pruneError);
    }

    const body = await request.json().catch(() => ({}));
    const messageId = typeof body.message_id === 'string' ? body.message_id : '';
    if (!messageId) {
      return json({ error: 'Missing or invalid message_id.' }, 400);
    }

    const { data: message, error: messageError } = await adminClient
      .from('messages')
      .select('id, conversation_id, sender_profile_id, body')
      .eq('id', messageId)
      .maybeSingle();

    if (messageError) throw messageError;

    // No message, already emailed for this exact message — collapse to the
    // same generic response so the response shape can't be used to probe
    // state, same convention as send-application-status-email.
    if (!message) {
      return json({ processed: true });
    }

    const { data: existingSend } = await adminClient
      .from('message_emails_sent')
      .select('id')
      .eq('message_id', messageId)
      .maybeSingle();

    if (existingSend) {
      return json({ processed: true });
    }

    const { data: conversation, error: conversationError } = await adminClient
      .from('conversations')
      .select('id, candidate_profile_id, company_id, source_job_id')
      .eq('id', message.conversation_id)
      .maybeSingle();

    if (conversationError) throw conversationError;
    if (!conversation) {
      return json({ processed: true });
    }

    const { data: company, error: companyError } = await adminClient
      .from('companies')
      .select('name, owner_profile_id')
      .eq('id', conversation.company_id)
      .maybeSingle();

    if (companyError) throw companyError;

    // Re-derive direction server-side rather than trusting that the
    // trigger only ever calls us for the right direction. Belt and
    // braces: if this ever fires for a candidate-sent message, bail.
    if (!company || message.sender_profile_id !== company.owner_profile_id) {
      return json({ processed: true });
    }

    // Skip if the candidate's app looks open right now. Mirrors the
    // presence check in send-message-push; re-checked here (rather than
    // trusting the trigger's timing) since a few hundred ms can pass
    // between the DB trigger firing and this function actually running.
    const { data: presence } = await adminClient
      .from('user_presence')
      .select('is_online, last_seen_at')
      .eq('user_id', conversation.candidate_profile_id)
      .maybeSingle();

    if (presence?.is_online && Date.now() - new Date(presence.last_seen_at).getTime() < PRESENCE_FRESHNESS_MS) {
      return json({ processed: true, skipped: 'recipient_online' });
    }

    // Email derived server-side from auth.users, never trusted from the
    // trigger payload.
    const { data: authUserResult, error: authUserError } = await adminClient.auth.admin.getUserById(
      conversation.candidate_profile_id,
    );
    if (authUserError || !authUserResult?.user?.email) {
      return json({ processed: true });
    }
    const email = authUserResult.user.email;

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, email_new_messages')
      .eq('id', conversation.candidate_profile_id)
      .maybeSingle();

    if (profileError) throw profileError;

    // Respect the candidate's preference. Don't record a "sent" row here
    // since nothing was sent.
    if (!profile || profile.email_new_messages === false) {
      return json({ processed: true });
    }

    let jobTitle: string | null = null;
    if (conversation.source_job_id) {
      const { data: job } = await adminClient
        .from('jobs')
        .select('title')
        .eq('id', conversation.source_job_id)
        .maybeSingle();
      jobTitle = job?.title ?? null;
    }

    const name = profile.full_name?.trim() || 'there';
    const companyName = company.name || 'An employer';
    const preview =
      message.body.length > MESSAGE_PREVIEW_LENGTH
        ? `${message.body.slice(0, MESSAGE_PREVIEW_LENGTH).trim()}…`
        : message.body;

    const subject = `New message from ${companyName}`;
    const html = buildMessageEmailHtml({
      name,
      companyName,
      jobTitle,
      preview,
      ctaUrl: `https://rolewave.cv/candidate/messages?conversation=${conversation.id}`,
    });

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
      const errorText = await resendResponse.text().catch(() => '');
      console.error(`Resend API error (${resendResponse.status}): ${errorText}`);
      return json({ error: 'Could not send message email.' }, 502);
    }

    const { error: insertError } = await adminClient
      .from('message_emails_sent')
      .upsert({ message_id: messageId }, { onConflict: 'message_id', ignoreDuplicates: true });

    if (insertError) throw insertError;

    return json({ processed: true });
  } catch (error) {
    console.error('send-message-email error:', error);
    return json({ error: 'Could not process request.' }, 500);
  }
});

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

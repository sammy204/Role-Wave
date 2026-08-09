import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildCandidateWelcomeHtml } from './templates/candidate.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-webhook-secret',
};

const FROM_ADDRESS = 'RoleWave <welcome@rolewave.cv>';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // This function is called only by the on_auth_user_email_confirmed
    // trigger (via pg_net), never directly by clients. Authenticate the
    // caller with a shared secret rather than a user JWT.
    const webhookSecret = Deno.env.get('WEBHOOK_SECRET');
    const providedSecret = request.headers.get('x-webhook-secret');
    if (!webhookSecret || !providedSecret || providedSecret !== webhookSecret) {
      return json({ error: 'Unauthorized.' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !serviceRoleKey || !resendApiKey) {
      return json({ error: 'Welcome email is not configured.' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const userId = typeof body.user_id === 'string' ? body.user_id : '';
    const email = typeof body.email === 'string' ? body.email : '';
    if (!userId || !email) return json({ error: 'Missing user_id or email.' }, 400);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('full_name, account_type, welcome_email_sent_at')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return json({ skipped: true, reason: 'No profile found.' });

    // Idempotency guard — the trigger only fires once per confirmation, but
    // pg_net retries on transient failure, so this protects against
    // double-sends on retry.
    if (profile.welcome_email_sent_at) {
      return json({ skipped: true, reason: 'Welcome email already sent.' });
    }

    const name = profile.full_name?.trim() || 'there';

    let subject: string;
    let html: string;

    if (profile.account_type === 'candidate') {
      subject = `Welcome to RoleWave, ${name}`;
      html = buildCandidateWelcomeHtml(name);
    } else {
      // Employer welcome email content hasn't been scoped yet. Skip
      // cleanly for now rather than sending an unstyled placeholder.
      return json({ skipped: true, reason: 'Employer welcome email not yet built.' });
    }

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
      throw new Error(`Resend API error (${resendResponse.status}): ${errorText}`);
    }

    const { error: updateError } = await adminClient
      .from('profiles')
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq('id', userId);

    if (updateError) throw updateError;

    return json({ sent: true });
  } catch (error) {
    console.error('send-welcome-email error:', error);
    return json({ error: error instanceof Error ? error.message : 'Could not send welcome email.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}
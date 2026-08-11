/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAdminInviteHtml } from './templates/invite.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FROM_ADDRESS = 'RoleWave <admin@rolewave.cv>';
const ACCEPT_BASE_URL = 'https://rolewave.cv/admin/login';

type AdminInvite = {
  token: string;
  id: number;
  email: string;
  first_name: string;
  last_name: string | null;
  expires_at: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    // This is a founder-triggered action from the admin dashboard, not a
    // webhook — authenticate with the caller's own session so the founder
    // check inside create_admin_invite() runs against the real auth.uid().
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !anonKey || !resendApiKey) {
      return json({ error: 'Admin invites are not configured.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const firstName = typeof body.firstName === 'string' ? body.firstName.trim() : '';
    const lastName = typeof body.lastName === 'string' ? body.lastName.trim() : '';
    if (!email || !firstName) return json({ error: 'First name and email are required.' }, 400);

    // create_admin_invite() itself re-checks is_founder_user() server-side
    // and re-validates the email — this call can't be used to grant an
    // invite even if the client-side founder-only UI check were bypassed.
    const { data: rawInvite, error: inviteError } = await userClient
      .rpc('create_admin_invite', { p_email: email, p_first_name: firstName, p_last_name: lastName || null })
      .single();
    const invite = rawInvite as AdminInvite | null;

    if (inviteError) {
      // Surface the RPC's own messages (Not authorized / invalid email /
      // already an admin) — they're written to be shown to the founder.
      const status = inviteError.code === '42501' ? 403 : inviteError.code === '23505' ? 409 : 400;
      return json({ error: inviteError.message || 'Could not create invite.' }, status);
    }
    if (!invite) return json({ error: 'Could not create invite.' }, 500);

    const { data: inviterProfile } = await userClient
      .from('profiles')
      .select('full_name')
      .eq('id', userData.user.id)
      .maybeSingle();

    const inviterName = firstNameOnly(inviterProfile?.full_name) || 'A RoleWave founder';
    const acceptUrl = `${ACCEPT_BASE_URL}?invite=${invite.token}`;
    const html = buildAdminInviteHtml(invite.first_name, inviterName, acceptUrl);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [invite.email],
        subject: 'You have been invited to RoleWave admin',
        html,
      }),
    });

    if (!resendResponse.ok) {
      const errorText = await resendResponse.text().catch(() => '');
      console.error(`Resend API error (${resendResponse.status}): ${errorText}`);
      // The invite row already exists at this point, so it's not entirely
      // lost — but tell the caller the email didn't go out.
      return json({ error: 'Invite created, but the email failed to send. Try resending.' }, 502);
    }

    return json({ invite: { id: invite.id, email: invite.email, expires_at: invite.expires_at } });
  } catch (error) {
    console.error('send-admin-invite error:', error);
    return json({ error: 'Could not process request.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

function firstNameOnly(value: string | null | undefined) {
  const name = value?.trim().split(/\s+/)[0];
  return name || '';
}

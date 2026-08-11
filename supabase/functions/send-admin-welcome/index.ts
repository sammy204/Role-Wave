/// <reference lib="deno.ns" />
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { buildAdminWelcomeHtml } from './templates/admin.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const FROM_ADDRESS = 'RoleWave <admin@rolewave.cv>';
const ADMIN_URL = 'https://rolewave.cv/admin';

type AdminUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  is_admin: boolean;
};

type ProfileWelcomeState = {
  id: string;
  first_name: string;
  welcome_email_sent_at: string | null;
};

type SendTarget = {
  id: string;
  email: string;
  fullName: string | null;
  alreadySent: boolean;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey || !resendApiKey) {
      return json({ error: 'Admin welcome email is not configured.' }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const mode = body.mode === 'all' ? 'all' : 'self';
    const force = body.force === true;

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const serviceClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const targets = mode === 'all'
      ? await getAllAdminTargets(userClient, serviceClient)
      : await getSelfTarget(serviceClient, userData.user.id, userData.user.email || '');

    const results = await Promise.all(targets.map((target) => sendWelcome(serviceClient, resendApiKey, target, force)));
    const sent = results.filter((result) => result === 'sent').length;
    const skipped = results.filter((result) => result === 'skipped').length;

    return json({ processed: true, sent, skipped });
  } catch (error) {
    console.error('send-admin-welcome error:', error);
    const status = error instanceof ResponseError ? error.status : 500;
    return json({ error: error instanceof Error ? error.message : 'Could not process request.' }, status);
  }
});

async function getAllAdminTargets(userClient: ReturnType<typeof createClient>, serviceClient: ReturnType<typeof createClient>) {
  const { data: isFounder, error: founderError } = await userClient.rpc('is_founder_user');
  if (founderError) throw founderError;
  if (!isFounder) throw new ResponseError('Not authorized.', 403);

  const { data: users, error: usersError } = await userClient.rpc('admin_list_users');
  if (usersError) throw usersError;

  const admins = ((users || []) as AdminUser[]).filter((user) => user.is_admin && user.email);
  if (admins.length === 0) return [];

  const { data: profiles, error: profilesError } = await serviceClient
    .from('admin_profiles')
    .select('id, first_name, welcome_email_sent_at')
    .in('id', admins.map((admin) => admin.id));
  if (profilesError) throw profilesError;

  const profileRows = (profiles || []) as ProfileWelcomeState[];
  const profileMap = new Map(profileRows.map((profile) => [profile.id, profile]));

  return admins.map((admin) => {
    const profile = profileMap.get(admin.id);
    return {
      id: admin.id,
      email: admin.email as string,
      fullName: profile?.first_name || admin.full_name,
      alreadySent: Boolean(profile?.welcome_email_sent_at),
    };
  });
}

async function getSelfTarget(serviceClient: ReturnType<typeof createClient>, userId: string, email: string) {
  if (!email) throw new ResponseError('No email address found for this user.', 400);

  const { data: profile, error: profileError } = await serviceClient
    .from('profiles')
    .select('id, is_admin')
    .eq('id', userId)
    .maybeSingle();
  if (profileError) throw profileError;
  if (!profile?.is_admin) throw new ResponseError('Not authorized.', 403);

  const { data: adminProfile, error: adminProfileError } = await serviceClient
    .from('admin_profiles')
    .select('first_name, welcome_email_sent_at')
    .eq('id', userId)
    .maybeSingle();
  if (adminProfileError) throw adminProfileError;

  return [{
    id: userId,
    email,
    fullName: adminProfile?.first_name || null,
    alreadySent: Boolean(adminProfile?.welcome_email_sent_at),
  }];
}

async function sendWelcome(
  serviceClient: ReturnType<typeof createClient>,
  resendApiKey: string,
  target: SendTarget,
  force: boolean
) {
  if (target.alreadySent && !force) return 'skipped';

  const name = getDisplayName(target.fullName, target.email);
  const html = buildAdminWelcomeHtml(name, ADMIN_URL);

  const resendResponse = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: FROM_ADDRESS,
      to: [target.email],
      subject: `Welcome to RoleWave Admin, ${name}`,
      html,
    }),
  });

  if (!resendResponse.ok) {
    const errorText = await resendResponse.text().catch(() => '');
    console.error(`Resend API error (${resendResponse.status}): ${errorText}`);
    throw new ResponseError('Could not send admin welcome email.', 502);
  }

  const { error: updateError } = await serviceClient
    .from('admin_profiles')
    .update({ welcome_email_sent_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq('id', target.id);
  if (updateError) throw updateError;

  return 'sent';
}

function getDisplayName(fullName: string | null, email: string) {
  const trimmed = fullName?.trim();
  if (trimmed) return trimmed.split(/\s+/)[0];

  const localPart = email.split('@')[0]?.replace(/[._-]+/g, ' ').trim();
  if (!localPart) return 'there';

  const first = localPart.split(/\s+/)[0];
  return first ? first.charAt(0).toUpperCase() + first.slice(1).toLowerCase() : 'there';
}

class ResponseError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

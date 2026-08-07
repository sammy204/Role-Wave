import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
const DELETION_GRACE_PERIOD_DAYS = 10;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Account deletion is not configured.' }, 500);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    if (body.confirmation !== 'DELETE') return json({ error: 'Type DELETE to confirm account deletion.' }, 400);

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('account_type, is_admin, account_status, deletion_scheduled_for')
      .eq('id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile) return json({ error: 'Profile not found.' }, 404);
    if (profile.is_admin) return json({ error: 'Admin accounts cannot be self-deleted.' }, 403);
    if (profile.account_type !== 'candidate') return json({ error: 'Employer account deletion is not available yet.' }, 400);
    if (profile.account_status === 'deletion_scheduled') {
      return json({ deleted: false, already_scheduled: true, deletion_scheduled_for: profile.deletion_scheduled_for });
    }

    const { data: candidateProfile, error: candidateError } = await adminClient
      .from('candidate_profiles').select('visibility_to_employers').eq('id', userId).maybeSingle();
    if (candidateError) throw candidateError;
    const deletionDate = new Date(Date.now() + DELETION_GRACE_PERIOD_DAYS * 86400000).toISOString();

    const { error: scheduleError } = await adminClient.from('profiles').update({
      account_status: 'deletion_scheduled', deletion_scheduled_for: deletionDate,
    }).eq('id', userId).eq('account_status', 'active');
    if (scheduleError) throw scheduleError;
    const { error: hideError } = await adminClient.from('candidate_profiles').update({
      visibility_to_employers: 'hidden',
      visibility_before_deletion: candidateProfile?.visibility_to_employers || 'open',
    }).eq('id', userId);
    if (hideError) throw hideError;

    await adminClient.auth.admin.signOut(userId, 'global').catch(() => {});
    return json({ deleted: false, deletion_scheduled_for: deletionDate });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not schedule account deletion.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

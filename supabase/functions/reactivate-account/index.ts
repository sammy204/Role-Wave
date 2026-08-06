import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !anonKey || !serviceRoleKey) return json({ error: 'Account reactivation is not configured.' }, 500);
    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authorization } } });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const userId = userData.user.id;
    const { data: profile, error: profileError } = await adminClient.from('profiles')
      .select('account_status, deletion_scheduled_for').eq('id', userId).maybeSingle();
    if (profileError) throw profileError;
    if (!profile || profile.account_status !== 'deletion_scheduled') return json({ reactivated: false });
    if (profile.deletion_scheduled_for && new Date(profile.deletion_scheduled_for).getTime() <= Date.now()) {
      return json({ error: 'The account deletion deadline has passed.' }, 410);
    }
    const { data: candidateProfile, error: candidateError } = await adminClient.from('candidate_profiles')
      .select('visibility_before_deletion').eq('id', userId).maybeSingle();
    if (candidateError) throw candidateError;
    const { error: restoreError } = await adminClient.from('profiles').update({
      account_status: 'active', deletion_scheduled_for: null,
    }).eq('id', userId).eq('account_status', 'deletion_scheduled');
    if (restoreError) throw restoreError;
    const { error: visibilityError } = await adminClient.from('candidate_profiles').update({
      visibility_to_employers: candidateProfile?.visibility_before_deletion || 'open',
      visibility_before_deletion: null,
    }).eq('id', userId);
    if (visibilityError) throw visibilityError;
    return json({ reactivated: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not reactivate account.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

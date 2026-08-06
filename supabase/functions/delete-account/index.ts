import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CANDIDATE_ASSETS_BUCKET = 'candidate-assets';

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const authorization = request.headers.get('Authorization');
    if (!authorization) return json({ error: 'Missing authorization.' }, 401);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !anonKey || !serviceRoleKey) {
      return json({ error: 'Account deletion is not configured.' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    if (userError || !userData.user) return json({ error: 'Unauthorized.' }, 401);

    const body = await request.json().catch(() => ({}));
    const confirmation = typeof body.confirmation === 'string' ? body.confirmation : '';
    if (confirmation !== 'DELETE') {
      return json({ error: 'Type DELETE to confirm account deletion.' }, 400);
    }

    const userId = userData.user.id;
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile, error: profileError } = await adminClient
      .from('profiles')
      .select('account_type, is_admin')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) return json({ error: 'Profile not found.' }, 404);
    if (profile.is_admin) {
      return json({ error: 'Admin accounts cannot be self-deleted. Ask another admin to remove your access first.' }, 403);
    }
    if (profile.account_type !== 'candidate') {
      return json({ error: 'Employer account deletion is not available yet. Contact support.' }, 400);
    }

    // Remove uploaded files (avatars + resumes) so they don't linger as orphaned storage objects.
    for (const folder of ['avatars', 'resumes']) {
      const { data: files, error: listError } = await adminClient.storage
        .from(CANDIDATE_ASSETS_BUCKET)
        .list(`${userId}/${folder}`);
      if (listError) continue;
      if (files && files.length > 0) {
        const paths = files.map((file) => `${userId}/${folder}/${file.name}`);
        await adminClient.storage.from(CANDIDATE_ASSETS_BUCKET).remove(paths);
      }
    }

    // Defensive: clear any report review attribution so the delete can't be blocked by
    // reports.reviewed_by (NO ACTION). Candidates shouldn't have reviewed anything, but this
    // keeps the deletion resilient if that ever changes.
    await adminClient.from('reports').update({ reviewed_by: null }).eq('reviewed_by', userId);

    // Deleting the auth user cascades through profiles, candidate_profiles, conversations,
    // messages, notifications, push_subscriptions, user_presence, and blocks. job_applications
    // keep their row (candidate_profile_id is set to null) so employer application history and
    // the snapshot applicant_name/applicant_email/applicant_phone fields are preserved.
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) throw deleteError;

    return json({ deleted: true });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not delete account.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
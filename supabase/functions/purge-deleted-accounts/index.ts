import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const CANDIDATE_ASSETS_BUCKET = 'candidate-assets';

Deno.serve(async (request) => {
  const secret = Deno.env.get('ACCOUNT_DELETION_CRON_SECRET');
  if (!secret || request.headers.get('x-account-deletion-secret') !== secret) return json({ error: 'Unauthorized.' }, 401);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceRoleKey) return json({ error: 'Account cleanup is not configured.' }, 500);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: profiles, error: profileError } = await adminClient.from('profiles')
      .select('id').eq('account_status', 'deletion_scheduled')
      .lte('deletion_scheduled_for', new Date().toISOString()).limit(100);
    if (profileError) throw profileError;
    let deleted = 0;
    for (const profile of profiles || []) {
      for (const folder of ['avatars', 'resumes']) {
        const { data: files } = await adminClient.storage.from(CANDIDATE_ASSETS_BUCKET).list(`${profile.id}/${folder}`);
        if (files?.length) await adminClient.storage.from(CANDIDATE_ASSETS_BUCKET).remove(files.map((file) => `${profile.id}/${folder}/${file.name}`));
      }
      await adminClient.from('reports').update({ reviewed_by: null }).eq('reviewed_by', profile.id);
      const { error } = await adminClient.auth.admin.deleteUser(profile.id);
      if (!error) deleted += 1;
    }
    return json({ deleted, checked: profiles?.length || 0 });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Could not purge deleted accounts.' }, 500);
  }
});

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

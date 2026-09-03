import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };
const plans = { monthly: { amount: 300000, months: 1 }, three_months: { amount: 700000, months: 3 } } as const;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !anon || !service || !secret || !authorization) return json({ error: 'Authentication or payment configuration is missing.' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user?.email) return json({ error: 'Please sign in before purchasing RoleWave Pro.' }, 401);
  const body = await request.json().catch(() => ({}));
  const plan = body.plan as keyof typeof plans;
  if (!plans[plan]) return json({ error: 'Invalid RoleWave Pro plan.' }, 400);
  const callbackUrl = typeof body.callback_url === 'string' ? body.callback_url : '';
  if (!/^https?:\/\//i.test(callbackUrl)) return json({ error: 'A valid checkout return URL is required.' }, 400);
  const reference = `rwpro_${data.user.id.replaceAll('-', '')}_${crypto.randomUUID().replaceAll('-', '')}`;
  const admin = createClient(url, service);
  const { data: entitlement } = await admin.from('ai_entitlements').select('status, current_period_end').eq('user_id', data.user.id).eq('product', 'ai_features').maybeSingle();
  if (entitlement?.status === 'active' && (!entitlement.current_period_end || new Date(entitlement.current_period_end) > new Date())) {
    return json({ error: 'You already have an active RoleWave Pro plan.' }, 409);
  }
  const { error: insertError } = await admin.from('rolewave_pro_payments').insert({ user_id: data.user.id, reference, plan, amount: plans[plan].amount });
  if (insertError) return json({ error: 'Could not create the payment.' }, 500);
  const response = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: data.user.email, amount: String(plans[plan].amount), currency: 'NGN', reference, callback_url: callbackUrl, metadata: { user_id: data.user.id, plan } }) });
  const result = await response.json().catch(() => null);
  if (!response.ok || !result?.status || !result?.data?.authorization_url) {
    await admin.from('rolewave_pro_payments').update({ status: 'failed', updated_at: new Date().toISOString() }).eq('reference', reference);
    return json({ error: 'Paystack could not start checkout.' }, 502);
  }
  return json({ authorization_url: result.data.authorization_url, reference });
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }

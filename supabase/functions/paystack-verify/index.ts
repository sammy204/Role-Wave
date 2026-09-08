import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info' };

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  const url = Deno.env.get('SUPABASE_URL'), anon = Deno.env.get('SUPABASE_ANON_KEY'), service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'), secret = Deno.env.get('PAYSTACK_SECRET_KEY');
  const authorization = request.headers.get('Authorization');
  if (!url || !anon || !service || !secret || !authorization) return json({ error: 'Authentication or payment configuration is missing.' }, 401);
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authorization } } });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401);
  const body = await request.json().catch(() => ({}));
  const reference = typeof body.reference === 'string' ? body.reference : '';
  if (!reference) return json({ error: 'Payment reference is required.' }, 400);
  const admin = createClient(url, service);
  const { data: payment, error: paymentError } = await admin.from('rolewave_pro_payments').select('*').eq('reference', reference).eq('user_id', userData.user.id).maybeSingle();
  if (paymentError || !payment) return json({ error: 'Payment not found.' }, 404);
  if (payment.status === 'success') return json({ success: true, already_processed: true });
  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${secret}` } });
  const result = await paystackResponse.json().catch(() => null);
  const transaction = result?.data;
  if (!paystackResponse.ok || !result?.status || transaction?.status !== 'success' || transaction.amount !== payment.amount || transaction.currency !== 'NGN') {
    return json({ error: 'Payment has not been confirmed by Paystack.' }, 402);
  }
  const paidAt = new Date().toISOString();
  const { data: completion, error: completionError } = await admin.rpc('complete_rolewave_pro_payment', {
    p_reference: reference,
    p_user_id: userData.user.id,
    p_paystack_transaction_id: String(transaction.id),
    p_customer_code: transaction.customer?.customer_code ?? null,
    p_paid_at: paidAt,
  });
  if (completionError) return json({ error: 'Payment succeeded, but access activation needs attention.' }, 500);

  const result = Array.isArray(completion) ? completion[0] : completion;
  if (!result?.success) return json({ error: 'Payment could not be completed.' }, 409);
  return json({
    success: true,
    already_processed: result.already_processed === true,
    current_period_end: result.current_period_end,
  });
});

function json(body: unknown, status = 200) { return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } }); }

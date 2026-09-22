import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info, x-paystack-signature',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const url = Deno.env.get('SUPABASE_URL');
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const secret = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!url || !service || !secret) {
      console.error('paystack-webhook: missing env config', {
        hasUrl: !!url,
        hasService: !!service,
        hasSecret: !!secret,
      });
      return json({ error: 'Payment configuration is missing.' }, 500);
    }

    // Signature must be verified against the RAW body, before any JSON parsing.
    const rawBody = await request.text();
    const signatureHeader = request.headers.get('x-paystack-signature') ?? '';
    const expectedSignature = await hmacSha512Hex(secret, rawBody);
    if (!timingSafeEqual(signatureHeader, expectedSignature)) {
      console.error('paystack-webhook: signature mismatch');
      return json({ error: 'Invalid signature.' }, 401);
    }

    const event = JSON.parse(rawBody);
    const admin = createClient(url, service);

    if (event?.event === 'charge.success') {
      return await handleChargeSuccess(admin, secret, event);
    }
    if (event?.event === 'refund.processed') {
      return await handleRefundProcessed(admin, event);
    }
    if (event?.event === 'charge.dispute.create') {
      return await handleDisputeCreated(admin, event);
    }

    // Acknowledge anything we don't act on so Paystack doesn't retry it.
    return json({ received: true, ignored: true });
  } catch (err) {
    console.error('paystack-webhook: unhandled exception', err instanceof Error ? err.stack ?? err.message : err);
    return json({ error: 'Internal error.' }, 500);
  }
});

// deno-lint-ignore no-explicit-any
async function handleChargeSuccess(admin: any, secret: string, event: any) {
  const transaction = event.data;
  const reference = typeof transaction?.reference === 'string' ? transaction.reference : '';
  if (!reference) return json({ error: 'Missing reference.' }, 400);

  const { data: payment, error: paymentError } = await admin
    .from('rolewave_pro_payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (paymentError) {
    console.error('paystack-webhook: payment lookup error', paymentError);
    return json({ error: 'Payment lookup failed.' }, 500);
  }
  if (!payment) {
    console.error('paystack-webhook: no payment row for reference', reference);
    return json({ error: 'Payment not found.' }, 404);
  }

  // Re-verify against Paystack's API directly, never trust the webhook payload alone.
  const verifyResponse = await fetch(
    `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
    { headers: { Authorization: `Bearer ${secret}` } },
  );
  const verifyResult = await verifyResponse.json().catch((err) => {
    console.error('paystack-webhook: failed to parse verify response', err);
    return null;
  });
  const verified = verifyResult?.data;
  if (
    !verifyResponse.ok ||
    !verifyResult?.status ||
    verified?.status !== 'success' ||
    verified.amount !== payment.amount ||
    verified.currency !== 'NGN' ||
    verified.reference !== reference
  ) {
    console.error('paystack-webhook: verify mismatch', {
      ok: verifyResponse.ok,
      status: verifyResult?.status,
      verifiedStatus: verified?.status,
      verifiedAmount: verified?.amount,
      paymentAmount: payment.amount,
      verifiedCurrency: verified?.currency,
      verifiedReference: verified?.reference,
      expectedReference: reference,
    });
    return json({ error: 'Payment could not be confirmed by Paystack.' }, 402);
  }

  const paidAt = new Date().toISOString();

  // Complete the payment and entitlement in one database transaction. This is
  // also race-safe with the browser-driven paystack-verify function.
  const { data: completion, error: completionError } = await admin.rpc('complete_rolewave_pro_payment', {
    p_reference: reference,
    p_user_id: payment.user_id,
    p_paystack_transaction_id: String(verified.id),
    p_customer_code: verified.customer?.customer_code ?? null,
    p_paid_at: paidAt,
  });

  if (completionError) {
    console.error('paystack-webhook: payment completion error', completionError);
    return json({ error: 'Failed to record payment.' }, 500);
  }

  const result = Array.isArray(completion) ? completion[0] : completion;
  if (!result?.success) {
    console.error('paystack-webhook: payment completion rejected', { reference, result });
    return json({ error: 'Payment could not be completed.' }, 409);
  }

  return json({
    received: true,
    already_processed: result.already_processed === true,
    current_period_end: result.current_period_end,
  });
/*
  const { data: claimed, error: claimError } = await admin
    .from('rolewave_pro_payments')
    .update({
      status: 'success',
      paystack_transaction_id: String(verified.id),
      paid_at: paidAt,
      updated_at: paidAt,
    })
    .eq('reference', reference)
    .neq('status', 'success')
    .select()
    .maybeSingle();

  if (claimError) {
    console.error('paystack-webhook: claim update error', claimError);
    return json({ error: 'Failed to record payment.' }, 500);
  }
  if (!claimed) {
    // Already processed by paystack-verify or a prior webhook delivery — safe no-op.
    return json({ received: true, already_processed: true });
  }

  const { data: current, error: currentError } = await admin
    .from('ai_entitlements')
    .select('current_period_end')
    .eq('user_id', payment.user_id)
    .eq('product', 'ai_features')
    .maybeSingle();
  if (currentError) {
    console.error('paystack-webhook: current entitlement lookup error', currentError);
  }

  const now = new Date();
  const base = current?.current_period_end && new Date(current.current_period_end) > now
    ? new Date(current.current_period_end)
    : now;
  base.setUTCMonth(base.getUTCMonth() + (payment.plan === 'monthly' ? 1 : 3));

  const { error: entitlementError } = await admin.from('ai_entitlements').upsert(
    {
      user_id: payment.user_id,
      product: 'ai_features',
      status: 'active',
      provider: 'paystack',
      provider_customer_id: verified.customer?.customer_code ?? null,
      provider_subscription_id: null,
      current_period_end: base.toISOString(),
      updated_at: paidAt,
    },
    { onConflict: 'user_id' },
  );

  if (entitlementError) {
    console.error('paystack-webhook: entitlement upsert error', entitlementError);
    // Payment is already marked success; this is now a support-queue item, not a retry candidate.
    return json({ received: true, entitlement_error: true });
  }

  return json({ received: true, current_period_end: base.toISOString() });
*/
}

// Paystack's refund.processed payload carries the original charge's reference
// as `data.transaction_reference` (the refund itself has its own separate
// `refund_reference`, which is not what we key rolewave_pro_payments on).
// deno-lint-ignore no-explicit-any
async function handleRefundProcessed(admin: any, event: any) {
  const reference = typeof event.data?.transaction_reference === 'string' ? event.data.transaction_reference : '';
  if (!reference) {
    console.error('paystack-webhook: refund.processed missing transaction_reference', event.data);
    return json({ received: true, ignored: true });
  }

  return await revokeForReference(admin, reference, 'refunded', 'refund.processed');
}

// Dispute payloads vary by dispute type; check the shapes Paystack is known to
// send rather than assuming one fixed structure.
// deno-lint-ignore no-explicit-any
async function handleDisputeCreated(admin: any, event: any) {
  const reference =
    (typeof event.data?.transaction?.reference === 'string' && event.data.transaction.reference) ||
    (typeof event.data?.transaction_reference === 'string' && event.data.transaction_reference) ||
    (typeof event.data?.reference === 'string' && event.data.reference) ||
    '';

  if (!reference) {
    console.error('paystack-webhook: charge.dispute.create missing a recognizable reference', event.data);
    // We can't act without a reference, but still ack so Paystack doesn't retry —
    // this needs a manual look at the Paystack dashboard.
    return json({ received: true, ignored: true, needs_manual_review: true });
  }

  // A dispute is opened, not necessarily lost — Paystack can still resolve it in
  // our favor later (charge.dispute.resolve). We revoke access immediately as a
  // conservative default since funds may already be frozen; if the dispute is
  // later declined in RoleWave's favor, access needs to be manually restored.
  return await revokeForReference(admin, reference, 'disputed', 'charge.dispute.create');
}

async function revokeForReference(
  admin: any,
  reference: string,
  paymentStatus: 'refunded' | 'disputed',
  eventName: string,
) {
  const { data: payment, error: paymentError } = await admin
    .from('rolewave_pro_payments')
    .select('*')
    .eq('reference', reference)
    .maybeSingle();
  if (paymentError) {
    console.error(`paystack-webhook: ${eventName} payment lookup error`, paymentError);
    return json({ error: 'Payment lookup failed.' }, 500);
  }
  if (!payment) {
    console.error(`paystack-webhook: ${eventName} no payment row for reference`, reference);
    return json({ received: true, ignored: true });
  }
  if (payment.status !== 'success') {
    // Nothing to revoke — payment was never completed on our side, or was
    // already refunded/disputed by a prior delivery of this event.
    return json({ received: true, already_processed: true });
  }

  const now = new Date().toISOString();

  const { error: paymentUpdateError } = await admin
    .from('rolewave_pro_payments')
    .update({ status: paymentStatus, updated_at: now })
    .eq('id', payment.id)
    .eq('status', 'success'); // Atomic — only flips a still-'success' row.

  if (paymentUpdateError) {
    console.error(`paystack-webhook: ${eventName} payment status update error`, paymentUpdateError);
    return json({ error: 'Failed to update payment record.' }, 500);
  }

  const { error: entitlementError } = await admin
    .from('ai_entitlements')
    .update({ status: 'cancelled', updated_at: now })
    .eq('user_id', payment.user_id)
    .eq('product', 'ai_features')
    .eq('status', 'active');

  if (entitlementError) {
    console.error(`paystack-webhook: ${eventName} entitlement revoke error`, entitlementError);
    return json({ received: true, entitlement_error: true });
  }

  console.log(`paystack-webhook: ${eventName} revoked Pro access`, { reference, userId: payment.user_id });
  return json({ received: true, revoked: true });
}

async function hmacSha512Hex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    'raw',
    enc.encode(key),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign('HMAC', cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(signature))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

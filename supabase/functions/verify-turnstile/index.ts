/// <reference lib="deno.ns" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ success: false, error: 'method_not_allowed' }, 405);

  try {
    const secret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!secret) return json({ success: false, error: 'verification_unavailable' }, 500);

    const body = await request.json().catch(() => ({}));
    const token = clean(body.token, 4096);
    const action = clean(body.action, 100);
    if (!token) return json({ success: false, error: 'verification_failed' }, 400);

    const remoteIp = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
    const payload: Record<string, string> = { secret, response: token };
    if (remoteIp) payload.remoteip = remoteIp.split(',')[0].trim();

    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payload),
    });
    const result = await response.json().catch(() => ({ success: false }));
    if (!result.success || (action && result.action && result.action !== action)) {
      return json({ success: false, error: 'verification_failed' }, 400);
    }

    return json({ success: true });
  } catch {
    return json({ success: false, error: 'verification_failed' }, 400);
  }
});

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

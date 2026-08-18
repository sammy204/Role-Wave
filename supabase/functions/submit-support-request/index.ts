/// <reference lib="deno.ns" />

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SUPPORT_ADDRESS = 'support@rolewave.cv';
const FROM_ADDRESS = 'RoleWave Support <support@rolewave.cv>';
const MAX_MESSAGE_LENGTH = 5000;

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const name = clean(body.name, 100);
    const email = clean(body.email, 254).toLowerCase();
    const category = clean(body.category, 60) || 'General support';
    const message = clean(body.message, MAX_MESSAGE_LENGTH);
    const website = clean(body.website, 200);
    const captchaToken = clean(body.captchaToken, 4096);

    // Quietly accept honeypot submissions so bots do not learn the check.
    if (website) return json({ ok: true });
    if (!name || !message || !isValidEmail(email)) return json({ error: 'Please provide a valid name, email, and message.' }, 400);
    if (message.length < 10) return json({ error: 'Please include a little more detail in your message.' }, 400);

    const resendApiKey = Deno.env.get('RESEND_API_KEY');
    const turnstileSecret = Deno.env.get('TURNSTILE_SECRET_KEY');
    if (!resendApiKey || !turnstileSecret) return json({ error: 'Support email is not configured.' }, 500);

    const turnstileResponse = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret: turnstileSecret, response: captchaToken }),
    });
    const turnstileResult = await turnstileResponse.json().catch(() => ({ success: false }));
    if (!turnstileResult.success) return json({ error: 'Please complete the security check and try again.' }, 400);

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendApiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: FROM_ADDRESS,
        to: [SUPPORT_ADDRESS],
        reply_to: email,
        subject: `[${category}] Support request from ${name}`,
        text: `Name: ${name}\nEmail: ${email}\nCategory: ${category}\n\n${message}`,
        html: `<h2>RoleWave support request</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Category:</strong> ${escapeHtml(category)}</p><hr><p>${escapeHtml(message).replaceAll('\n', '<br>')}</p>`,
      }),
    });

    if (!resendResponse.ok) {
      console.error(`Resend support email failed: ${await resendResponse.text().catch(() => '')}`);
      return json({ error: 'We could not send your message. Please try again.' }, 502);
    }

    return json({ ok: true });
  } catch (error) {
    console.error('submit-support-request error:', error);
    return json({ error: 'We could not process your request.' }, 500);
  }
});

function clean(value: unknown, maxLength: number) {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] || character);
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

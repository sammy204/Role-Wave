import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const BUCKET = 'candidate-assets';
const MAX_RESUME_BYTES = 5 * 1024 * 1024;
const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
]);

type ParsedResume = {
  full_name: string;
  phone: string;
  country: string;
  headline: string;
  skills: string[];
  preferred_job_titles: string[];
  years_experience: number | null;
  education: string;
  experience: string;
};

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, request);

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const openAiKey = Deno.env.get('OPENAI_API_KEY');
  const parserMode = Deno.env.get('RESUME_PARSER_MODE') || 'openai';
  const authorization = request.headers.get('Authorization');

  if (!supabaseUrl || !anonKey || !serviceRoleKey || !authorization) {
    return json({ error: 'Authentication required.' }, 401, request);
  }
  if (!openAiKey && parserMode !== 'mock') return json({ error: 'Resume parsing is not configured yet.' }, 503, request);

  const userClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: userData, error: userError } = await userClient.auth.getUser();
  if (userError || !userData.user) return json({ error: 'Authentication required.' }, 401, request);

  const body = await request.json().catch(() => ({}));
  const path = typeof body.path === 'string' ? body.path.trim() : '';
  const fileName = typeof body.file_name === 'string' ? body.file_name.trim() : 'resume';
  const contentType = typeof body.content_type === 'string' ? body.content_type : '';

  if (!path || !path.startsWith(`${userData.user.id}/resumes/`)) {
    return json({ error: 'That resume does not belong to your account.' }, 403, request);
  }
  if (!ALLOWED_TYPES.has(contentType) && !/\.(pdf|docx?|PDF|DOCX?)$/.test(fileName)) {
    return json({ error: 'Please upload a PDF, DOC, or DOCX resume.' }, 400, request);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);
  const { data: file, error: downloadError } = await admin.storage.from(BUCKET).download(path);
  if (downloadError || !file) return json({ error: 'We could not read that resume.' }, 400, request);
  if (file.size > MAX_RESUME_BYTES) return json({ error: 'Your resume must be 5 MB or smaller.' }, 413, request);

  if (parserMode === 'mock') {
    return json({ profile: mockProfile(fileName), parser_mode: 'mock' }, 200, request);
  }

  const fileData = `data:${contentType || mimeFromName(fileName)};base64,${toBase64(new Uint8Array(await file.arrayBuffer()))}`;
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: { Authorization: `Bearer ${openAiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: Deno.env.get('OPENAI_RESUME_MODEL') || Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini',
      input: [{
        role: 'user',
        content: [
          { type: 'input_file', filename: fileName, file_data: fileData },
          { type: 'input_text', text: 'Extract the candidate information from this resume. Never invent details. Use empty strings or empty arrays when a field is not present. Keep education and experience as concise, readable text suitable for a candidate profile.' },
        ],
      }],
      text: {
        format: {
          type: 'json_schema',
          name: 'resume_profile',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            properties: {
              full_name: { type: 'string' },
              phone: { type: 'string' },
              country: { type: 'string' },
              headline: { type: 'string' },
              skills: { type: 'array', items: { type: 'string' } },
              preferred_job_titles: { type: 'array', items: { type: 'string' } },
              years_experience: { anyOf: [{ type: 'number' }, { type: 'null' }] },
              education: { type: 'string' },
              experience: { type: 'string' },
            },
            required: ['full_name', 'phone', 'country', 'headline', 'skills', 'preferred_job_titles', 'years_experience', 'education', 'experience'],
          },
        },
      },
      max_output_tokens: 1800,
    }),
  });

  if (!response.ok) {
    console.error('Resume parsing request failed:', response.status, await response.text().catch(() => ''));
    return json({ error: 'We could not parse that resume right now. You can try again.' }, 502, request);
  }

  const payload = await response.json() as { output_text?: string };
  if (!payload.output_text) return json({ error: 'The parser returned no profile data.' }, 502, request);

  try {
    const parsed = JSON.parse(payload.output_text) as ParsedResume;
    return json({ profile: normalizeProfile(parsed) }, 200, request);
  } catch {
    return json({ error: 'The parser returned invalid profile data.' }, 502, request);
  }
});

function normalizeProfile(value: ParsedResume): ParsedResume {
  return {
    full_name: clean(value.full_name),
    phone: clean(value.phone),
    country: clean(value.country),
    headline: clean(value.headline),
    skills: uniqueStrings(value.skills),
    preferred_job_titles: uniqueStrings(value.preferred_job_titles),
    years_experience: typeof value.years_experience === 'number' && Number.isFinite(value.years_experience)
      ? Math.max(0, Math.round(value.years_experience))
      : null,
    education: clean(value.education),
    experience: clean(value.experience),
  };
}

function mockProfile(fileName: string): ParsedResume {
  return {
    full_name: 'Sample Candidate',
    phone: '+234 800 000 0000',
    country: 'Nigeria',
    headline: 'Professional candidate',
    skills: ['Communication', 'Microsoft Excel', 'Project coordination'],
    preferred_job_titles: ['Operations', 'Administration'],
    years_experience: 2,
    education: 'Sample University — Bachelor’s degree',
    experience: `Sample role extracted from ${fileName}. Replace this mock result when OPENAI_API_KEY is configured.`,
  };
}

function clean(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 8000) : '';
}

function uniqueStrings(value: unknown) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))].slice(0, 40);
}

function mimeFromName(name: string) {
  if (/\.pdf$/i.test(name)) return 'application/pdf';
  if (/\.docx$/i.test(name)) return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  return 'application/msword';
}

function toBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function json(body: Record<string, unknown>, status: number, request: Request) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(request) });
}

function corsHeaders(request: Request) {
  return {
    'Access-Control-Allow-Origin': request.headers.get('Origin') || '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

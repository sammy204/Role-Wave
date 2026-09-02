import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WEBHOOK_SECRET = Deno.env.get("ATS_INGEST_WEBHOOK_SECRET");

const ENDPOINT_NAME = "import-jobs-ats";
const RATE_LIMIT_WINDOW_SECONDS = 300;
const RATE_LIMIT_MAX_CALLS = 3;

const AVATAR_COLORS = ["teal", "amber", "purple", "blue", "coral"];

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  const maxLen = Math.max(aBytes.length, bBytes.length);
  let diff = aBytes.length === bBytes.length ? 0 : 1;
  for (let i = 0; i < maxLen; i++) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }
  return diff === 0;
}

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)+/g, "")
    .slice(0, 80);
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

// Mirrors lib/normalize.ts's normalizeDescription (kept in sync by hand,
// same convention as the eligibility patterns below). Some ATS boards
// (confirmed on One Acre Fund and Remote.com's Greenhouse content) return
// job content that's already HTML-entity-escaped rather than raw markup.
// Decoding here Ã¢â‚¬â€ instead of flattening to plain text Ã¢â‚¬â€ keeps the real
// <h2>/<p>/<ul> structure intact, which JobDetail.tsx expects: it renders
// job.description via dangerouslySetInnerHTML + DOMPurify.sanitize with
// Tailwind rules targeting those exact tags. Flattening to plain text (the
// old approach) loses that structure, and for double-escaped content leaves
// literal "&lt;h3&gt;"-style text that decodes to visible "<h3>" characters
// on render instead of an actual heading.
function decodeHtmlEntities(html: string): string {
  return html
    .replace(/\\u003c/g, "<")
    .replace(/\\u003e/g, ">")
    .replace(/\\u0026/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .trim();
}

function logoInitials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

function mapWorkType(text: string): "Remote" | "On-site" | "Hybrid" {
  const t = text.toLowerCase();
  if (t.includes("hybrid")) return "Hybrid";
  if (t.includes("remote")) return "Remote";
  return "On-site";
}

function mapJobType(text: string): "Full-time" | "Contract" | "Internship" {
  const t = text.toLowerCase();
  if (t.includes("intern")) return "Internship";
  if (t.includes("contract") || t.includes("temp")) return "Contract";
  return "Full-time";
}

// Same Nigeria-eligibility gate as import-jobs-jooble, kept in sync by hand.
// If that function's filter changes, mirror the change here too.
const EXCLUDE_PATTERNS = [
  /us citizen/i,
  /must be (based|located) in the (us|united states|uk|eu)/i,
  /authorized to work in the (us|united states|uk)/i,
  /eu residents? only/i,
  /this role is not open to applicants outside/i,
];

// Title-only, word-boundaried. Previously matched against title + full body
// text, which let unrelated roles slip through on incidental phrase matches
// deep in the description (e.g. an agriculture M&E role mentioning "quality
// assurance trackers" for farm data, or "product manager" used in a
// non-engineering context). Matching only the job title is a much tighter
// signal of what the role actually is.
//
// "product manager" alone was also too broad Ã¢â‚¬â€ RoleWave wants engineering-
// adjacent PM roles, not every PM opening a company has (billing, fraud,
// contractor ops, etc. are product roles but not tech hiring in the sense
// candidates here are looking for). Narrowed to require a technical/platform/
// engineering qualifier. Same qualifier convention applied to "project
// manager" below Ã¢â‚¬â€ generic PM titles (office/event/construction PM) aren't
// what candidates here are after, only tech/eng-flavored ones.
//
// "customer care" added alongside "customer support/service" Ã¢â‚¬â€ Nigerian-
// market job titles commonly use "Customer Care" specifically, and the
// original pattern didn't catch it.
const TECH_ALLOWLIST = [
  /engineer/i, /developer/i, /programmer/i, /designer/i,
  /technical product manager/i, /platform product manager/i, /engineering product manager/i,
  /technical project manager/i, /platform project manager/i, /engineering project manager/i,
  /data (scientist|analyst)/i, /devops/i,
  /\bqa\b/i, /quality assurance/i, /\bux\b/i, /\bui\b/i,
  /customer (support|service|care)/i,
];

// Location must positively indicate Nigeria, or be unqualified remote/global Ã¢â‚¬â€
// text-only exclusion matching (the Jooble function's approach) isn't enough
// here because ATS boards span many countries per company and most postings
// never mention the US/UK/EU at all, they just aren't for Nigeria.
//
// "Remote" or "Flexible" only count when unqualified. Boards routinely write
// "Remote - Germany and Switzerland" or "Flexible: Poland, Spain, Portugal,
// Estonia, Romania, South Africa, and Kenya" Ã¢â‚¬â€ those are remote-within-a-
// specific-list, and the list doesn't include Nigeria, so they must NOT pass.
const UNQUALIFIED_REMOTE_PATTERNS = [
  /^remote$/i,
  /^anywhere$/i,
  /^flexible$/i,
  /^global$/i,
  /^worldwide$/i,
  /^work from home$/i,
];

// Broad multi-region tags that geographically include Nigeria even when the
// country isn't named Ã¢â‚¬â€ e.g. Greenhouse boards commonly use "Remote-EMEA".
const BROAD_REGION_PATTERNS = [
  /\bemea\b/i,
  /\bafrica\b/i,
  /\bmea\b/i, // Middle East & Africa
];

function isLocationEligible(location: string): boolean {
  const trimmed = location.trim();
  if (/nigeria/i.test(trimmed)) return true;
  if (BROAD_REGION_PATTERNS.some((re) => re.test(trimmed))) return true;
  return UNQUALIFIED_REMOTE_PATTERNS.some((re) => re.test(trimmed));
}

function isEligibleForNigeria(title: string, bodyText: string, location: string): boolean {
  const isTech = TECH_ALLOWLIST.some((re) => re.test(title));
  const isExcluded = EXCLUDE_PATTERNS.some((re) => re.test(`${title} ${bodyText}`));
  return isTech && !isExcluded && isLocationEligible(location);
}

interface GreenhouseJob {
  id: number | string;
  title: string;
  absolute_url: string;
  updated_at?: string;
  location?: { name?: string };
  content?: string;
}

interface AtsSourceCompany {
  slug: string;
  ats_platform: "greenhouse" | "lever" | "ashby" | "smartrecruiters" | "workable";
  display_name: string;
  enabled: boolean;
}

function normalizeLocation(value: unknown): string {
  if (typeof value === "string") return value;
  if (!value || typeof value !== "object") return "";
  const item = value as Record<string, unknown>;
  return [item.name, item.city, item.region, item.country, item.countryCode]
    .filter((part): part is string => typeof part === "string" && part.length > 0)
    .join(", ");
}

function toGreenhouseShape(job: Record<string, any>, fallbackUrl: string): GreenhouseJob {
  const location = normalizeLocation(job.location) ||
    (Array.isArray(job.locations)
      ? job.locations.map((item: unknown) => normalizeLocation(item)).filter(Boolean).join(", ")
      : "");

  return {
    id: job.id ?? job.shortcode ?? job.hostedUrl ?? job.url,
    title: job.title ?? job.text ?? job.name ?? "",
    absolute_url: job.absolute_url ?? job.hostedUrl ?? job.applyUrl ?? job.url ?? fallbackUrl,
    updated_at: job.updated_at ?? job.publishedAt ?? job.created_at,
    location: { name: location },
    content: job.content ?? job.descriptionHtml ?? job.description ?? job.descriptionPlain ?? "",
  };
}

async function fetchGreenhouseJobs(boardToken: string): Promise<GreenhouseJob[]> {
  const url = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(boardToken)}/jobs?content=true`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Greenhouse API ${res.status} for board "${boardToken}"`);
  const data = await res.json();
  return (data.jobs || []).map((job: Record<string, any>) =>
    toGreenhouseShape(job, `https://job-boards.greenhouse.io/${boardToken}`)
  );
}

async function fetchLeverJobs(slug: string): Promise<GreenhouseJob[]> {
  const res = await fetch(`https://api.lever.co/v0/postings/${encodeURIComponent(slug)}?mode=json`);
  if (!res.ok) throw new Error(`Lever API ${res.status} for board "${slug}"`);
  const data = await res.json();
  return (Array.isArray(data) ? data : []).map((job: Record<string, any>) =>
    toGreenhouseShape({
      ...job,
      location: job.categories?.location ?? job.location,
      title: job.text ?? job.title,
      description: job.description ?? job.descriptionPlain,
      applyUrl: job.applyUrl ?? job.hostedUrl,
    }, `https://jobs.lever.co/${slug}`)
  );
}

async function fetchAshbyJobs(slug: string): Promise<GreenhouseJob[]> {
  const res = await fetch(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(slug)}?includeCompensation=true`);
  if (!res.ok) throw new Error(`Ashby API ${res.status} for board "${slug}"`);
  const data = await res.json();
  return (data.jobs || []).map((job: Record<string, any>) =>
    toGreenhouseShape(job, `https://jobs.ashbyhq.com/${slug}`)
  );
}

async function fetchSmartRecruitersJobs(companyId: string): Promise<GreenhouseJob[]> {
  const listRes = await fetch(
    `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings?limit=100`
  );
  if (!listRes.ok) throw new Error(`SmartRecruiters API ${listRes.status} for company "${companyId}"`);
  const data = await listRes.json();
  const postings = data.content || [];

  const jobs = await Promise.all(postings.map(async (posting: Record<string, any>) => {
    const detailRes = await fetch(
      `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(companyId)}/postings/${encodeURIComponent(String(posting.id))}`
    );
    const detail = detailRes.ok ? await detailRes.json() : posting;
    return toGreenhouseShape({
      ...posting,
      ...detail,
      title: posting.name ?? detail.name ?? detail.title,
      description: Array.isArray(detail.jobAd?.sections)
        ? detail.jobAd.sections.map((section: Record<string, any>) => section.content ?? "").join("\n")
        : detail.description,
      applyUrl: detail.ref ?? `https://jobs.smartrecruiters.com/${companyId}/${posting.id}`,
    }, `https://jobs.smartrecruiters.com/${companyId}/${posting.id}`);
  }));

  return jobs;
}

async function fetchWorkableJobs(subdomain: string): Promise<GreenhouseJob[]> {
  const res = await fetch(
    `https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(subdomain)}`
  );
  if (!res.ok) throw new Error(`Workable API ${res.status} for account "${subdomain}"`);
  const data = await res.json();
  return (data.jobs || data.results || []).map((job: Record<string, any>) =>
    toGreenhouseShape({
      ...job,
      location: job.location ?? job.locations,
      description: job.description ?? job.descriptionHtml,
      applyUrl: job.url ?? job.application_url,
    }, `https://apply.workable.com/${subdomain}/`)
  );
}

async function fetchAtsJobs(source: AtsSourceCompany): Promise<GreenhouseJob[]> {
  switch (source.ats_platform) {
    case "greenhouse": return fetchGreenhouseJobs(source.slug);
    case "lever": return fetchLeverJobs(source.slug);
    case "ashby": return fetchAshbyJobs(source.slug);
    case "smartrecruiters": return fetchSmartRecruitersJobs(source.slug);
    case "workable": return fetchWorkableJobs(source.slug);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok");
  if (req.method !== "POST") {
    return json({ error: "Use POST" }, 405);
  }

  if (!WEBHOOK_SECRET) {
    return json({ error: "ATS_INGEST_WEBHOOK_SECRET not set on this function" }, 500);
  }
  const providedSecret = req.headers.get("x-webhook-secret");
  if (!providedSecret || !timingSafeEqual(providedSecret, WEBHOOK_SECRET)) {
    return json({ error: "Unauthorized." }, 401);
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // Rate limit, same convention as send-digest-emails.
  await admin.from("webhook_call_log").insert({ endpoint: ENDPOINT_NAME });
  const { count: recentCallCount } = await admin
    .from("webhook_call_log")
    .select("id", { count: "exact", head: true })
    .eq("endpoint", ENDPOINT_NAME)
    .gte("called_at", new Date(Date.now() - RATE_LIMIT_WINDOW_SECONDS * 1000).toISOString());
  if ((recentCallCount ?? 0) > RATE_LIMIT_MAX_CALLS) {
    return json({ error: "Rate limit exceeded." }, 429);
  }
  admin.rpc("prune_webhook_call_log").then(() => {}).catch(() => {});

  const { data: sourceCompanies, error: companiesErr } = await admin
    .from("ats_source_companies")
    .select("slug, ats_platform, display_name, enabled")
    .eq("enabled", true);

  if (companiesErr) {
    return json({ error: `Could not load ats_source_companies: ${companiesErr.message}` }, 500);
  }
  if (!sourceCompanies || sourceCompanies.length === 0) {
    return json({ processed: true, companiesProcessed: 0, note: "No enabled ats_source_companies." });
  }

  let companiesProcessed = 0;
  let jobsFetched = 0;
  let jobsInserted = 0;
  let jobsUpdated = 0;
  let jobsReopened = 0;
  let jobsAutoClosed = 0;
  let jobsSkippedIneligible = 0;
  const errors: string[] = [];

  for (const src of sourceCompanies as AtsSourceCompany[]) {
    let sourceJobs: GreenhouseJob[];
    try {
      sourceJobs = await fetchAtsJobs(src);
    } catch (e) {
      errors.push(`Fetch failed for "${src.slug}" (${src.ats_platform}): ${(e as Error).message}`);
      continue;
    }
    companiesProcessed++;
    jobsFetched += sourceJobs.length;

    // Find or create the company row. Slug is deterministic (matches
    // ats_source_companies.slug) so re-runs always resolve the same row.
    const { data: existingCompany } = await admin
      .from("companies")
      .select("id")
      .eq("slug", src.slug)
      .maybeSingle();

    let companyId = existingCompany?.id as string | undefined;
    if (!companyId) {
      const { data: newCompany, error: companyErr } = await admin
        .from("companies")
        .insert({
          name: src.display_name,
          slug: src.slug,
          logo_initials: logoInitials(src.display_name),
          avatar_color: AVATAR_COLORS[companiesProcessed % AVATAR_COLORS.length],
          location: sourceJobs[0]?.location?.name || "Remote",
          verified: true,
        })
        .select("id")
        .single();
      if (companyErr || !newCompany) {
        errors.push(`Company insert failed for "${src.slug}": ${companyErr?.message}`);
        continue;
      }
      companyId = newCompany.id;
    }

    const seenExternalIds: string[] = [];

    for (const job of sourceJobs) {
      if (!job.id || !job.title || !job.absolute_url) continue;
      const externalId = String(job.id);
      seenExternalIds.push(externalId);

      const decodedHtml = decodeHtmlEntities(job.content || "");
      const bodyText = stripHtml(decodedHtml);
      const location = job.location?.name || "Remote";
      if (!isEligibleForNigeria(job.title, bodyText, location)) {
        jobsSkippedIneligible++;
        continue;
      }

      const combinedText = `${job.title} ${bodyText} ${location}`;
      const description = decodedHtml ? decodedHtml.slice(0, 6000) : "See full listing via the apply link for details.";

      const { data: existingJob } = await admin
        .from("jobs")
        .select("id, status")
        .eq("source", src.ats_platform)
        .eq("source_company", src.slug)
        .eq("external_id", externalId)
        .maybeSingle();

      if (!existingJob) {
        const baseSlug = slugify(`${job.title}-${src.slug}`);
        const { error: insertErr } = await admin.from("jobs").insert({
          title: job.title.trim(),
          slug: `${baseSlug}-${externalId}`,
          company_id: companyId,
          description,
          requirements: "See the original listing via the apply link for full requirements.",
          location,
          work_type: mapWorkType(combinedText),
          job_type: mapJobType(combinedText),
          apply_method: "external",
          apply_url: job.absolute_url,
          application_url: job.absolute_url,
          source: src.ats_platform,
          source_company: src.slug,
          external_id: externalId,
          is_external: true,
          status: "pending_review",
        });
        if (insertErr) {
          errors.push(`Insert failed for "${job.title}" (${src.slug}): ${insertErr.message}`);
          continue;
        }
        jobsInserted++;
      } else {
        // A job that reappears after being auto-closed goes back to
        // pending_review rather than silently reactivating Ã¢â‚¬â€ someone
        // should confirm it's genuinely open again. Any other status
        // (active, filled, archived, rejected) is left as a human called it.
        const nextStatus = existingJob.status === "closed" ? "pending_review" : existingJob.status;
        const { error: updateErr } = await admin
          .from("jobs")
          .update({
            title: job.title.trim(),
            description,
            location,
            work_type: mapWorkType(combinedText),
            apply_url: job.absolute_url,
            application_url: job.absolute_url,
            status: nextStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existingJob.id);
        if (updateErr) {
          errors.push(`Update failed for "${job.title}" (${src.slug}): ${updateErr.message}`);
          continue;
        }
        if (existingJob.status === "closed") jobsReopened++;
        jobsUpdated++;
      }
    }

    // Auto-close: any previously-ingested job for this company that didn't
    // show up in this fetch is assumed taken down at the source.
    const { data: openJobs, error: openJobsErr } = await admin
      .from("jobs")
      .select("id, external_id")
      .eq("source", src.ats_platform)
      .eq("source_company", src.slug)
      .eq("is_external", true)
      .in("status", ["active", "pending_review"]);

    if (openJobsErr) {
      errors.push(`Auto-close lookup failed for "${src.slug}": ${openJobsErr.message}`);
    } else {
      const seen = new Set(seenExternalIds);
      const staleIds = (openJobs ?? [])
        .filter((job) => !seen.has(String(job.external_id)))
        .map((job) => job.id);

      if (staleIds.length > 0) {
        const { data: closedRows, error: closeErr } = await admin
          .from("jobs")
          .update({ status: "closed", updated_at: new Date().toISOString() })
          .in("id", staleIds)
          .select("id");
        if (closeErr) {
          errors.push(`Auto-close failed for "${src.slug}": ${closeErr.message}`);
        } else {
          jobsAutoClosed += closedRows?.length ?? 0;
        }
      }
    }
  }

  return json({
    companiesProcessed,
    jobsFetched,
    jobsInserted,
    jobsUpdated,
    jobsReopened,
    jobsAutoClosed,
    jobsSkippedIneligible,
    errors,
  });
});

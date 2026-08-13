import "dotenv/config";

import { createClient } from '@supabase/supabase-js';

import {
  fetchGreenhouseJobs,
  fetchFlutterwaveJobs,
  fetchNexTriumJobs,
  fetchIKSFJobs,
  fetchTechyx360Jobs,
} from '../lib/ats-fetchers';
import {
  normalizeGreenhouseJob,
  normalizeAshbyJob,
  normalizeDescription,
  isRoleWaveTechJob,
  isNigeriaEligible,
  normalizeDirectJob,
} from '../lib/normalize';
import { atsSources } from '../config/ats-sources';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function createJobSlug(
  company: string,
  title: string,
  source: string,
  externalId: string
) {
  const base = `${company}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `${base}-${source}-${externalId}`;
}

async function getOrCreateCompany(companyName: string) {
  const { data: existingCompany, error: lookupError } = await supabase
    .from('companies')
    .select('id')
    .eq('name', companyName)
    .maybeSingle();

  if (lookupError) throw lookupError;
  if (existingCompany) return existingCompany.id;

  const slug = companyName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  const { data: newCompany, error: createError } = await supabase
    .from('companies')
    .insert({
      name: companyName,
      slug,
      logo_initials: companyName
        .split(/\s+/)
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase(),
      avatar_color: 'teal',
      verified: true,
      job_count: 0,
    })
    .select('id')
    .single();

  if (createError) throw createError;
  return newCompany.id;
}

async function main() {
  for (const source of atsSources) {
    if (!source.active) continue;

    console.log(`\nFetching ${source.company} (${source.source})...`);

    let fetchedJobs: any[] = [];

    if (source.source === 'greenhouse') {
      if (!source.slug) throw new Error(`Missing Greenhouse slug for ${source.company}`);
      fetchedJobs = (await fetchGreenhouseJobs(source.slug)).jobs;
    } else if (source.source === 'flutterwave') {
      fetchedJobs = (await fetchFlutterwaveJobs(source.url!)).jobs;
    } else if (source.source === 'nextrium') {
      fetchedJobs = (await fetchNexTriumJobs(source.url!)).jobs;
    } else if (source.source === 'iksf') {
      fetchedJobs = (await fetchIKSFJobs(source.url!)).jobs;
    } else if (source.source === 'techyx360') {
      fetchedJobs = (await fetchTechyx360Jobs(source.url!)).jobs;
    }

    const acceptedRawJobs = fetchedJobs.filter(
      (job: any) => isRoleWaveTechJob(job.title) && isNigeriaEligible(job)
    );
    const normalizedJobs = acceptedRawJobs.map((job: any) =>
      source.source === 'greenhouse'
        ? normalizeGreenhouseJob(job, source.company)
        : normalizeDirectJob(job, source.source, source.company)
    );
    const uniqueJobs = Array.from(
      new Map(normalizedJobs.map((job) => [`${job.source}:${job.externalId}`, job])).values()
    );

    console.log(`Total fetched: ${fetchedJobs.length}`);
    console.log(`Accepted: ${acceptedRawJobs.length}`);
    console.log(`Rejected: ${fetchedJobs.length - acceptedRawJobs.length}`);
    console.log(`Unique accepted: ${uniqueJobs.length}`);

    const companyId = await getOrCreateCompany(source.company);
    const existingIds = new Set<string>();

    if (uniqueJobs.length > 0) {
      const { data: existingJobs, error: existingError } = await supabase
        .from('jobs')
        .select('external_id')
        .eq('source', source.source)
        .in('external_id', uniqueJobs.map((job) => job.externalId));

      if (existingError) throw existingError;
      for (const existingJob of existingJobs ?? []) {
        if (existingJob.external_id) existingIds.add(String(existingJob.external_id));
      }
    }

    let insertedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    for (const job of uniqueJobs) {
      const { error } = await supabase.from('jobs').upsert(
        {
          company_id: companyId,
          source: job.source,
          external_id: job.externalId,
          slug: createJobSlug(
            job.company,
            job.title,
            job.source,
            job.externalId
          ),
          title: job.title,
          description: normalizeDescription(job.descriptionHtml),
          requirements: '',
          location: job.location ?? 'Not specified',
          work_type: job.remote ? 'Remote' : 'On-site',
          job_type: 'Full-time',
          apply_url: job.applyUrl,
          application_url: job.applyUrl,
          apply_method: 'external',
          is_external: true,
          status: 'active',
        },
        {
          onConflict: 'source,external_id',
        }
      );

      if (error) {
        console.error(`Failed to insert ${job.title}:`, error);
        errorCount += 1;
        continue;
      }

      if (existingIds.has(job.externalId)) updatedCount += 1;
      else insertedCount += 1;

      console.log(`✓ ${job.title}`);
    }

    console.log(`Inserted: ${insertedCount}`);
    console.log(`Updated: ${updatedCount}`);
    console.log(`Skipped: ${normalizedJobs.length - uniqueJobs.length}`);
    console.log(`Errors: ${errorCount}`);
  }

  console.log('\nATS test ingestion complete.');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

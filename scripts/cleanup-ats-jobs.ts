import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

import { fetchGreenhouseJobs, fetchAshbyJobs } from '../lib/ats-fetchers';
import { atsSources } from '../config/ats-sources';
import { isNigeriaEligible, isRoleWaveTechJob } from '../lib/normalize';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const execute = process.argv.includes('--execute');

async function fetchJobs(source: (typeof atsSources)[number]) {
  if (source.source === 'greenhouse') {
    const response = await fetchGreenhouseJobs(source.slug);
    return response.jobs as any[];
  }

  const response = await fetchAshbyJobs(source.slug);
  return response.jobs as any[];
}

async function main() {
  console.log(execute ? 'ATS cleanup: EXECUTE MODE' : 'ATS cleanup: DRY RUN');
  let totalToRemove = 0;

  const { data: importedJobs, error: jobsError } = await supabase
    .from('jobs')
    .select('id, source, external_id, title')
    .eq('is_external', true)
    .in('source', ['greenhouse', 'ashby']);

  if (jobsError) throw jobsError;

  for (const source of atsSources) {
    if (!source.active) continue;

    const currentJobs = await fetchJobs(source);
    const eligibleExternalIds = new Set(
      currentJobs
        .filter((job) => isRoleWaveTechJob(job.title) && isNigeriaEligible(job))
        .map((job) => String(job.id))
    );

    const sourceJobs = (importedJobs ?? []).filter((job) => job.source === source.source);
    const toRemove = sourceJobs.filter(
      (job) => !job.external_id || !eligibleExternalIds.has(String(job.external_id))
    );
    totalToRemove += toRemove.length;

    console.log(`\n${source.company.toUpperCase()} (${source.source})`);
    console.log(`Imported external jobs found: ${sourceJobs.length}`);
    console.log(`Would remove: ${toRemove.length}`);

    for (const job of toRemove) {
      console.log(`- ${job.title} [${job.external_id ?? 'missing external id'}]`);
    }

    if (execute && toRemove.length > 0) {
      const { error: deleteError } = await supabase
        .from('jobs')
        .delete()
        .in('id', toRemove.map((job) => job.id));

      if (deleteError) throw deleteError;
      console.log(`Removed: ${toRemove.length}`);
    }
  }

  console.log(`\nTotal external jobs ${execute ? 'removed' : 'that would be removed'}: ${totalToRemove}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

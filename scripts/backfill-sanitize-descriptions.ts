import 'dotenv/config';

import { createClient } from '@supabase/supabase-js';

import { normalizeDescription } from '../lib/normalize';

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);
const execute = process.argv.includes('--execute');

async function main() {
  console.log(execute ? 'Description backfill: EXECUTE MODE' : 'Description backfill: DRY RUN');

  const { data: jobs, error } = await supabase
    .from('jobs')
    .select('id, title, source, description')
    .eq('is_external', true);

  if (error) throw error;

  let changedCount = 0;
  let unchangedCount = 0;
  let errorCount = 0;

  for (const job of jobs ?? []) {
    const sanitized = normalizeDescription(job.description);

    if (sanitized === (job.description ?? '')) {
      unchangedCount += 1;
      continue;
    }

    changedCount += 1;
    console.log(`\n~ ${job.title} [${job.source}] (id: ${job.id})`);
    console.log(`  before (${(job.description ?? '').length} chars): ${(job.description ?? '').slice(0, 120)}`);
    console.log(`  after  (${sanitized.length} chars): ${sanitized.slice(0, 120)}`);

    if (execute) {
      const { error: updateError } = await supabase
        .from('jobs')
        .update({ description: sanitized })
        .eq('id', job.id);

      if (updateError) {
        console.error(`  FAILED to update ${job.id}:`, updateError);
        errorCount += 1;
      } else {
        console.log('  ✓ updated');
      }
    }
  }

  console.log(`\nTotal external jobs scanned: ${(jobs ?? []).length}`);
  console.log(`Changed by sanitization: ${changedCount}`);
  console.log(`Already clean: ${unchangedCount}`);
  if (execute) console.log(`Update errors: ${errorCount}`);
  if (!execute && changedCount > 0) {
    console.log('\nRun again with --execute to apply these changes.');
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
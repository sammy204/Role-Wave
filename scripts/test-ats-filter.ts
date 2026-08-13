import { fetchGreenhouseJobs } from '../lib/ats-fetchers';
import { isRoleWaveTechJob } from '../lib/normalize';

const STRIPE_GREENHOUSE_SLUG = 'stripe';

async function main() {
  const response = await fetchGreenhouseJobs(STRIPE_GREENHOUSE_SLUG);
  const jobs = response.jobs as Array<{ title: string }>;
  const accepted = jobs.filter((job) => isRoleWaveTechJob(job.title));
  const rejected = jobs.filter((job) => !isRoleWaveTechJob(job.title));

  console.log('GREENHOUSE: Stripe');
  console.log(`\nTotal fetched: ${jobs.length}`);
  console.log(`Accepted: ${accepted.length}`);
  console.log(`Rejected: ${rejected.length}`);

  console.log('\n=== ACCEPTED ===');
  for (const job of accepted) console.log(job.title);

  console.log('\n=== REJECTED ===');
  for (const job of rejected) console.log(job.title);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

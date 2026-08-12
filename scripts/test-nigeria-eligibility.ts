import { fetchGreenhouseJobs, fetchAshbyJobs } from '../lib/ats-fetchers';
import { atsSources } from '../config/ats-sources';
import { isNigeriaEligible, isRoleWaveTechJob } from '../lib/normalize';

async function fetchJobs(source: (typeof atsSources)[number]) {
  if (source.source === 'greenhouse') {
    const response = await fetchGreenhouseJobs(source.slug);
    return response.jobs as any[];
  }

  const response = await fetchAshbyJobs(source.slug);
  return response.jobs as any[];
}

function getLocation(job: any): string {
  return [
    job.location?.name,
    typeof job.location === 'string' ? job.location : null,
    job.locationName,
    job.address?.postalAddress?.addressLocality,
    job.address?.postalAddress?.addressCountry,
  ]
    .filter(Boolean)
    .join(' · ') || 'Unknown location';
}

async function main() {
  for (const source of atsSources) {
    if (!source.active) continue;

    const jobs = await fetchJobs(source);
    const techJobs = jobs.filter((job) => isRoleWaveTechJob(job.title));
    const eligibleJobs = techJobs.filter((job) => isNigeriaEligible(job));

    console.log(`\n${source.company.toUpperCase()}`);
    console.log(`Total fetched: ${jobs.length}`);
    console.log(`Tech jobs: ${techJobs.length}`);
    console.log(`Nigeria eligible: ${eligibleJobs.length}`);
    console.log(`Rejected: ${techJobs.length - eligibleJobs.length}`);

    console.log('\n=== NIGERIA ELIGIBLE ===');
    for (const job of eligibleJobs) {
      console.log(`${job.title} — ${getLocation(job)}`);
    }
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

import {
  fetchGreenhouseJobs,
  fetchAshbyJobs,
} from "../lib/ats-fetchers";

import {
  normalizeGreenhouseJob,
  normalizeAshbyJob,
} from "../lib/normalize";

async function main() {
  const greenhouse = await fetchGreenhouseJobs("stripe");
  const ashby = await fetchAshbyJobs("notion");

  const greenhouseJobs = greenhouse.jobs
    .slice(0, 3)
    .map((job: any) =>
      normalizeGreenhouseJob(job, "Stripe")
    );

  const ashbyJobs = ashby.jobs
    .slice(0, 3)
    .map((job: any) =>
      normalizeAshbyJob(job, "Notion")
    );

  console.log("\n=== NORMALIZED GREENHOUSE ===");
  console.log(JSON.stringify(greenhouseJobs, null, 2));

  console.log("\n=== NORMALIZED ASHBY ===");
  console.log(JSON.stringify(ashbyJobs, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

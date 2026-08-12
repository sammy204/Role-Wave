import {
  fetchGreenhouseJobs,
  fetchFlutterwaveJobs,
  fetchNexTriumJobs,
  fetchIKSFJobs,
  fetchTechyx360Jobs,
} from '../lib/ats-fetchers';
import { isNigeriaEligible, isRoleWaveTechJob, normalizeDescription } from '../lib/normalize';

type VerifiedJob = {
  title: string;
  location: string;
  applyUrl: string;
  descriptionHtml?: string;
};

const greenhouseSources = [
  { company: 'Moniepoint', slug: 'moniepoint', endpoint: 'api' },
  { company: 'ALX Africa', slug: 'alxafrica', endpoint: 'html' },
  
];

const directSources = [
  { company: 'Flutterwave', url: 'https://flutterwave.com/ng/careers/vacancies', parser: 'flutterwave' },
  { company: 'NexTrium', url: 'https://www.nextrium.org/careers', parser: 'nextrium' },
  { company: 'IKSF', url: 'https://iksf.ng/careers/', parser: 'iksf' },
  { company: 'Techyx360', url: 'https://techyx360.com/careers', parser: 'techyx360' },
] as const;

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function absoluteUrl(url: string, base: string): string {
  return new URL(url, base).toString();
}

function parseGreenhouseBoardHtml(html: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /<a href="([^"]+\/jobs\/[^" ]+)"[^>]*>[\s\S]*?<p[^>]*body--medium[^>]*>([\s\S]*?)<\/p>[\s\S]*?<p[^>]*body--metadata[^>]*>([\s\S]*?)<\/p>[\s\S]*?<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({
      title: decodeHtml(match[2]),
      location: decodeHtml(match[3]),
      applyUrl: match[1],
    });
  }

  return jobs;
}

function parseFlutterwave(html: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /<p[^>]*section-roles__role[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span>[\s\S]*?<\/span>[\s\S]*?<span>[\s\S]*?country__flag[^>]*>[\s\S]*?([A-Za-z ]+)[\s\S]*?<\/span>[\s\S]*?<\/p>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({ title: decodeHtml(match[2]), location: decodeHtml(match[3]), applyUrl: match[1] });
  }

  return jobs;
}

function parseNexTrium(html: string, base: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /<a[^>]+class="role-row"[^>]+href="([^"]+)"[\s\S]*?<div class="role-title">([^<]+)<\/div>[\s\S]*?<div class="role-badges">([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const badges = decodeHtml(match[3]);
    const location = badges.match(/(?:Remote[^|]*|Lagos[^|]*|Nigeria[^|]*)/i)?.[0] ?? badges;
    jobs.push({ title: decodeHtml(match[2]), location, applyUrl: absoluteUrl(match[1], base) });
  }

  return jobs;
}

function parseIKSF(html: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>Apply<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({ title: decodeHtml(match[1]), location: decodeHtml(match[3]), applyUrl: match[4] });
  }

  return jobs;
}

function parseTechyx360(html: string, base: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /href="(\/careers\/[^"#]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const slug = match[1].split('/').filter(Boolean).pop() ?? '';
    const title = slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    jobs.push({ title, location: 'Lagos, Nigeria', applyUrl: match[1] });
  }

  return jobs.map((job) => ({ ...job, applyUrl: absoluteUrl(job.applyUrl, base) }));
}

function parsePaystack(html: string): VerifiedJob[] {
  const jobs: VerifiedJob[] = [];
  const pattern = /href="(https:\/\/careers\.paystack\.com\/jobs\/[^" ]+)"[\s\S]*?title="([^"]+)"[\s\S]*?<span>([^<]+)<\/span>[\s\S]*?&middot;[\s\S]*?<span>([^<]+)<\/span>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({ title: decodeHtml(match[2]), location: decodeHtml(match[4]), applyUrl: match[1] });
  }

  return jobs;
}

function printReport(company: string, sourceType: string, endpoint: string, jobs: VerifiedJob[]) {
  const techJobs = jobs.filter((job) => isRoleWaveTechJob(job.title));
  const nigeriaJobs = techJobs.filter((job) => isNigeriaEligible({ location: job.location }));

  console.log(`\n${company.toUpperCase()}`);
  console.log(`Source type: ${sourceType}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Total jobs found: ${jobs.length}`);
  console.log(`Tech jobs: ${techJobs.length}`);
  console.log(`Nigeria-eligible jobs: ${nigeriaJobs.length}`);
  console.log('Sample Nigeria jobs:');

  for (const job of nigeriaJobs.slice(0, 10)) {
    console.log(`✓ ${job.title}`);
    console.log(`  ${job.location}`);
    console.log(`  ${job.applyUrl}`);
    const description = normalizeDescription(job.descriptionHtml);
    console.log(`  description: ${description ? `yes (${description.length})` : 'NO'}`);
    console.log(`  preview: ${description.slice(0, 100)}`);
  }
}

async function main() {
  for (const source of greenhouseSources) {
    let jobs: VerifiedJob[];
    let endpoint: string;

    if (source.endpoint === 'api') {
      const response = await fetchGreenhouseJobs(source.slug);
      jobs = response.jobs.map((job: any): VerifiedJob => ({
        title: job.title,
        location: job.location?.name ?? '',
        applyUrl: job.absolute_url,
        descriptionHtml: job.content ?? '',
      }));
      endpoint = `greenhouse:${source.slug}`;
    } else {
      endpoint = `https://job-boards.greenhouse.io/${source.slug}`;
      const response = await fetch(endpoint);
      if (!response.ok) throw new Error(`${endpoint} returned ${response.status}`);
      jobs = parseGreenhouseBoardHtml(await response.text());
    }

    printReport(source.company, 'Greenhouse', endpoint, jobs);
  }

  for (const source of directSources) {
    const fetchedJobs = source.parser === 'flutterwave'
      ? await fetchFlutterwaveJobs(source.url)
      : source.parser === 'nextrium'
        ? await fetchNexTriumJobs(source.url)
        : source.parser === 'iksf'
          ? await fetchIKSFJobs(source.url)
          : await fetchTechyx360Jobs(source.url);
    const jobs = fetchedJobs.jobs.map((job: any): VerifiedJob => ({
      title: job.title,
      location: job.location ?? '',
      applyUrl: job.applyUrl,
      descriptionHtml: job.descriptionHtml ?? '',
    }));

    printReport(source.company, 'Direct careers page', source.url, jobs);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

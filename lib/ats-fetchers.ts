export async function fetchGreenhouseJobs(slug: string) {
  const response = await fetch(
    `https://boards-api.greenhouse.io/v1/boards/${slug}/jobs?content=true`
  );

  if (!response.ok) {
    throw new Error(
      `Greenhouse request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function fetchLeverJobs(slug: string) {
  const response = await fetch(
    `https://api.lever.co/v0/postings/${slug}?mode=json`
  );

  if (!response.ok) {
    throw new Error(
      `Lever request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

export async function fetchAshbyJobs(slug: string) {
  const response = await fetch(
    `https://api.ashbyhq.com/posting-api/job-board/${slug}?includeCompensation=true`
  );

  if (!response.ok) {
    throw new Error(
      `Ashby request failed: ${response.status} ${response.statusText}`
    );
  }

  return response.json();
}

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

async function fetchCareerPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Careers request failed: ${response.status} ${response.statusText}`);
  return response.text();
}

export async function fetchFlutterwaveJobs(url: string) {
  const html = await fetchCareerPage(url);
  const jobs: any[] = [];
  const pattern = /<p[^>]*section-roles__role[^>]*>[\s\S]*?<a href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span>[\s\S]*?<\/span>[\s\S]*?<span>[\s\S]*?country__flag[^>]*>[\s\S]*?([A-Za-z ]+)[\s\S]*?<\/span>[\s\S]*?<\/p>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({ id: match[1].split('/').pop(), title: decodeHtml(match[2]), location: decodeHtml(match[3]), applyUrl: match[1], descriptionHtml: '' });
  }

  await Promise.all(jobs.map(async (job) => {
    const detail = await fetchCareerPage(`${job.applyUrl}/detail`);
    const payload = JSON.parse(detail);
    const opening = payload.result?.jobOpening;
    job.location = [opening?.location?.city, opening?.location?.state, opening?.location?.addressCountry]
      .filter(Boolean)
      .join(', ') || job.location;
    job.descriptionHtml = opening?.description ?? '';
  }));

  return { jobs };
}

export async function fetchNexTriumJobs(url: string) {
  const html = await fetchCareerPage(url);
  const jobs: any[] = [];
  const pattern = /<a[^>]+class="role-row"[^>]+href="([^"]+)"[\s\S]*?<div class="role-title">([^<]+)<\/div>[\s\S]*?<div class="role-badges">([\s\S]*?)<\/div>/gi;

  for (const match of html.matchAll(pattern)) {
    const badges = decodeHtml(match[3]);
    jobs.push({
      id: match[1].split('/').filter(Boolean).pop(),
      title: decodeHtml(match[2]),
      location: badges.match(/(?:Remote[^|]*|Lagos[^|]*|Nigeria[^|]*)/i)?.[0] ?? badges,
      applyUrl: new URL(match[1], url).toString(),
      descriptionHtml: '',
    });
  }

  await Promise.all(jobs.map(async (job) => {
    const detail = await fetchCareerPage(job.applyUrl);
    job.descriptionHtml = detail.match(/<section class="role-body-section">([\s\S]*?)<\/section>/i)?.[1] ?? '';
  }));

  return { jobs };
}

export async function fetchIKSFJobs(url: string) {
  const html = await fetchCareerPage(url);
  const jobs: any[] = [];
  const pattern = /<h3[^>]*>([^<]+)<\/h3>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<span[^>]*>([^<]+)<\/span>[\s\S]*?<p[^>]*>([\s\S]*?)<\/p>[\s\S]*?<a[^>]+href="([^"]+)"[^>]*>Apply<\/a>/gi;

  for (const match of html.matchAll(pattern)) {
    jobs.push({
      id: decodeHtml(match[1]).toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      title: decodeHtml(match[1]),
      location: decodeHtml(match[3]),
      applyUrl: match[5],
      descriptionHtml: match[4],
    });
  }

  return { jobs };
}

export async function fetchTechyx360Jobs(url: string) {
  const html = await fetchCareerPage(url);
  const jobs: any[] = [];
  const pattern = /href="(\/careers\/[^"#]+)"/g;

  for (const match of html.matchAll(pattern)) {
    const slug = match[1].split('/').filter(Boolean).pop() ?? '';
    const title = slug
      .split('-')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
    jobs.push({
      id: slug,
      title,
      location: 'Lagos, Nigeria',
      applyUrl: new URL(match[1], url).toString(),
      descriptionHtml: '',
    });
  }

  await Promise.all(jobs.map(async (job) => {
    const detail = await fetchCareerPage(job.applyUrl);
    job.descriptionHtml = detail.match(/<article[\s\S]*?>([\s\S]*?)<\/article>/i)?.[1] ?? '';
  }));

  return { jobs };
}

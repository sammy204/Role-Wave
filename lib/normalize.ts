export interface RawJobPosting {
  source: "greenhouse" | "ashby" | "flutterwave" | "nextrium" | "iksf" | "techyx360";
  externalId: string;
  company: string;
  title: string;
  location: string | null;
  remote: boolean;
  department: string | null;
  descriptionHtml: string;
  applyUrl: string;
  postedAt: string | null;
  salaryMin?: number;
  salaryMax?: number;
  salaryCurrency?: string;
}

const clearlyNonTechRole =
  /\b(account executive|account manager|sales|business development|marketing|partner manager|recruit|recruiting|human resources|hr|finance|accounting|legal|counsel|procurement|facilities|workplace|executive assistant|administrative|operations manager|customer success|customer support|strategist|creative director)\b/i;

const techRoleCategories = [
  /\b(software engineer|software engineering|frontend engineer|front-end engineer|backend engineer|back-end engineer|full[ -]?stack engineer|developer|react developer|product engineer|engineering manager|engineer|engineering)\b/i,
  /\b(data scientist|data analyst|data engineer|data science|machine learning|\bAI engineer\b|\bML engineer\b|artificial intelligence)\b/i,
  /\b(devops|site reliability engineer|\bSRE\b|cloud engineer|infrastructure engineer|platform engineer)\b/i,
  /\b(QA engineer|quality assurance engineer|test engineer|software test)\b/i,
  /\b(cybersecurity|cyber security|security engineer|security analyst|application security|product security|information security)\b/i,
  /\b(product designer|product design|UX designer|UI designer|user experience designer|design engineer)\b/i,
  /\b(product manager|product management|technical product manager)\b/i,
  /\b(technical support engineer|support engineer|solutions engineer)\b/i,
  /\btechnical program manager\b/i,
];

export function isRoleWaveTechJob(title: string): boolean {
  if (clearlyNonTechRole.test(title)) return false;
  return techRoleCategories.some((category) => category.test(title));
}

export function isNigeriaEligible(job: any): boolean {
  const location = [
    job.location?.name,
    typeof job.location === 'string' ? job.location : null,
    job.locationName,
    job.address?.postalAddress?.addressLocality,
    job.address?.postalAddress?.addressCountry,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return /\b(nigeria|nigerian|lagos|abuja|port harcourt|ibadan|benin city|enugu|kano|kaduna|jos|ilorin|abeokuta|calabar|uyo)\b/i.test(location);
}

export function normalizeDescription(description: string | null | undefined): string {
  if (!description) return '';

  return description
    .replace(/\\u003c/g, '<')
    .replace(/\\u003e/g, '>')
    .replace(/\\u0026/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .trim();
}

function detectRemote(location: string | null, title = ""): boolean {
  const text = `${location ?? ""} ${title}`.toLowerCase();

  return (
    text.includes("remote") ||
    text.includes("anywhere") ||
    text.includes("worldwide")
  );
}

export function normalizeGreenhouseJob(
  job: any,
  company: string
): RawJobPosting {
  return {
    source: "greenhouse",
    externalId: String(job.id),
    company,
    title: job.title,
    location: job.location?.name ?? null,
    remote: detectRemote(job.location?.name, job.title),
    department: job.departments?.[0]?.name ?? null,
    descriptionHtml: normalizeDescription(job.content),
    applyUrl: job.absolute_url,
    postedAt: job.updated_at ?? null,
  };
}

export function normalizeAshbyJob(
  job: any,
  company: string
): RawJobPosting {
  const location =
    job.location ||
    job.address?.postalAddress?.addressLocality ||
    null;

  return {
    source: "ashby",
    externalId: String(job.id),
    company,
    title: job.title,
    location,
    remote:
      job.isRemote === true ||
      detectRemote(location, job.title),
    department: job.department ?? null,
    descriptionHtml: normalizeDescription(job.descriptionHtml),
    applyUrl: job.applyUrl,
    postedAt: job.publishedAt ?? null,
    salaryMin: job.compensation?.minSalary,
    salaryMax: job.compensation?.maxSalary,
    salaryCurrency: job.compensation?.currency,
  };
}

export function normalizeDirectJob(
  job: any,
  source: RawJobPosting['source'],
  company: string
): RawJobPosting {
  return {
    source,
    externalId: String(job.id),
    company,
    title: job.title,
    location: job.location ?? null,
    remote: detectRemote(job.location, job.title),
    department: null,
    descriptionHtml: normalizeDescription(job.descriptionHtml),
    applyUrl: job.applyUrl,
    postedAt: null,
  };
}

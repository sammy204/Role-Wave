import type { LucideIcon } from 'lucide-react';
import { Briefcase, FileText, MessageSquare } from 'lucide-react';

export type BlogSection =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'quote'; text: string };

export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  category: 'For candidates' | 'For employers';
  icon: LucideIcon;
  readTime: string;
  publishedAt: string;
  ctaLabel: string;
  ctaHref: string;
  content: BlogSection[];
}

export const blogPosts: BlogPost[] = [
  {
    slug: 'build-a-stronger-cv',
    title: 'Build a Stronger CV',
    excerpt: 'Practical guidance for presenting your experience clearly and finding the right opportunities.',
    category: 'For candidates', icon: FileText, readTime: '6 min read', publishedAt: '2026-08-13',
    ctaLabel: 'Browse verified jobs in Nigeria', ctaHref: '/jobs',
    content: [
      { type: 'paragraph', text: 'Most CVs get rejected not because the candidate is unqualified, but because the CV fails to show it. Your job is to make the relevant facts impossible to miss.' },
      { type: 'heading', text: '1. Lead with impact, not duties' },
      { type: 'paragraph', text: 'Listing what you were responsible for tells a hiring manager almost nothing. Show what changed because you were there. Instead of “Responsible for backend development,” write “Rebuilt the payments service, cutting checkout failures by 30%.”' },
      { type: 'list', items: ['Every bullet should answer: so what?', 'Use numbers where you have them — percentages, time saved, users served, revenue, uptime.', 'If you cannot measure the outcome, describe the scope or the before-and-after.'] },
      { type: 'heading', text: '2. Tailor it to the role, every time' },
      { type: 'paragraph', text: 'Read the job description twice and note the specific skills and tools mentioned. Reorder your bullet points so the most relevant experience is easy to find, and use the listing’s terminology where it genuinely matches your experience.' },
      { type: 'heading', text: '3. Keep the format boring, on purpose' },
      { type: 'paragraph', text: 'A clean, single-column CV in a standard font reads correctly everywhere and lets your experience do the work. Save the creativity for your portfolio or cover letter.' },
      { type: 'heading', text: '4. Cut anything that does not earn its place' },
      { type: 'paragraph', text: 'A CV is not a full career history — it is a pitch. If a line does not support the specific role you are applying for, remove it.' },
      { type: 'quote', text: 'Aim for one page if you have under 8 years of experience, two at most beyond that.' },
    ],
  },
  {
    slug: 'prepare-for-better-interviews', title: 'Prepare for Better Interviews',
    excerpt: 'Useful preparation notes to help you communicate your strengths with confidence.',
    category: 'For candidates', icon: MessageSquare, readTime: '7 min read', publishedAt: '2026-08-13',
    ctaLabel: 'Browse verified jobs in Nigeria', ctaHref: '/jobs',
    content: [
      { type: 'paragraph', text: 'Technical ability gets you the interview. How clearly you communicate under pressure often decides the outcome. Preparation is about having your best examples ready.' },
      { type: 'heading', text: '1. Build a story bank before you need it' },
      { type: 'paragraph', text: 'Pull out five to seven concrete situations from recent roles and projects: a hard bug, a disagreement, a failed project, a quick learning experience, and something you are proud of. Write each using STAR — Situation, Task, Action, Result.' },
      { type: 'list', items: ['A time you solved a hard technical problem', 'A time you disagreed with a decision', 'A time you missed a deadline or made a mistake', 'A time you had to learn something quickly', 'A project you are genuinely proud of, and why'] },
      { type: 'heading', text: '2. Research the company beyond the homepage' },
      { type: 'paragraph', text: 'Look at what they have shipped recently, how they talk about their product, and the technology choices visible in their listing or engineering blog. Prepare one specific question that shows genuine interest.' },
      { type: 'heading', text: '3. Think out loud in technical interviews' },
      { type: 'paragraph', text: 'State your assumptions, narrate your reasoning, and if you get stuck, say what you are stuck on rather than going silent. Clear reasoning through a partial solution is valuable.' },
      { type: 'heading', text: '4. Treat it as a two-way conversation' },
      { type: 'paragraph', text: 'Prepare real questions about the work: what the first project looks like, how the team handles disagreement, and what success means in the first three months.' },
      { type: 'quote', text: 'The goal of preparation is not a perfect script. It is walking in with fewer unknowns.' },
    ],
  },
  {
    slug: 'hire-with-more-clarity', title: 'Hire with More Clarity',
    excerpt: 'Simple ideas for writing better roles, reviewing applicants, and building stronger teams.',
    category: 'For employers', icon: Briefcase, readTime: '6 min read', publishedAt: '2026-08-13',
    ctaLabel: 'Post a job on RoleWave', ctaHref: '/post',
    content: [
      { type: 'paragraph', text: 'Most hiring problems trace back to an unclear starting point: a rushed role description, no shared review standard, and interviews that vary by interviewer.' },
      { type: 'heading', text: '1. Write the role around outcomes, not a wish list' },
      { type: 'paragraph', text: 'Define what the person needs to accomplish in the first six months, then work backward to the two or three skills that matter for that outcome. Everything else is negotiable.' },
      { type: 'list', items: ['What will this person own in the first 90 days?', 'What decision-making authority do they actually have?', 'Which skills are truly non-negotiable versus nice to have?'] },
      { type: 'heading', text: '2. Be specific about compensation and logistics early' },
      { type: 'paragraph', text: 'Clear salary ranges, remote policy, and timezone expectations help strong candidates decide quickly and filter for genuine fit.' },
      { type: 'heading', text: '3. Use a consistent scorecard, not gut feel' },
      { type: 'paragraph', text: 'Agree on three to five criteria before the first interview and have every interviewer score against the same criteria. This reduces bias and disagreement.' },
      { type: 'heading', text: '4. Give every applicant a real answer' },
      { type: 'paragraph', text: 'A short, honest rejection is worth more than silence and protects your reputation with people who may apply again or refer someone else.' },
      { type: 'quote', text: 'Clarity earlier in the process saves time for everyone later in it — including you.' },
    ],
  },
];

export function getPostBySlug(slug: string) {
  return blogPosts.find((post) => post.slug === slug);
}

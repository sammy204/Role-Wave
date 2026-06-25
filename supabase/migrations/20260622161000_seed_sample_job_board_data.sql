/*
Seed data for the repaired job board schema.

This inserts sample companies and jobs so the homepage and listings pages
render immediately after the schema repair migration.
*/

insert into public.companies (name, slug, logo_initials, avatar_color, location, website, description, verified, job_count)
values
('Paystack', 'paystack', 'PS', 'teal', 'Lagos', 'https://paystack.com', 'Modern payments infrastructure for Africa', true, 2),
('Flutterwave', 'flutterwave', 'FW', 'blue', 'Lagos', 'https://flutterwave.com', 'Payment technology company', true, 2),
('Andela', 'andela', 'AN', 'teal', 'Remote', 'https://andela.com', 'Global talent network', true, 1),
('Konga', 'konga', 'KG', 'amber', 'Lagos', 'https://konga.com', 'E-commerce platform', true, 1),
('Cowrywise', 'cowrywise', 'CW', 'purple', 'Lagos', 'https://cowrywise.com', 'Digital wealth management', true, 1),
('PiggyVest', 'piggyvest', 'PV', 'purple', 'Lagos', 'https://piggyvest.com', 'Savings and investment platform', true, 1),
('Interswitch', 'interswitch', 'IS', 'coral', 'Lagos', 'https://interswitchgroup.com', 'Integrated digital payments', true, 2),
('MTN Nigeria', 'mtn-nigeria', 'MT', 'amber', 'Abuja', 'https://mtn.ng', 'Telecommunications', true, 1),
('GTBank', 'gtbank', 'GT', 'blue', 'Lagos', 'https://gtbank.com', 'Commercial bank', true, 1)
on conflict (slug) do nothing;

insert into public.jobs (title, slug, company_id, description, requirements, what_youll_do, location, work_type, job_type, salary, tags, featured, status)
values
(
  'Product Designer',
  'product-designer-paystack',
  (select id from public.companies where slug = 'paystack'),
  'Paystack is looking for a talented Product Designer to help build world-class financial products used by over 200,000 businesses across Nigeria and Africa.' || E'\n\n' ||
  'You''ll work closely with product managers and engineers to design intuitive, accessible experiences that make payments simpler for merchants and their customers every day.',
  '3+ years of product design experience, ideally fintech or SaaS' || E'\n' ||
  'Strong Figma skills and a portfolio showing end-to-end design process' || E'\n' ||
  'Experience with user research and usability testing' || E'\n' ||
  'Clear communication with cross-functional teams',
  'Lead design for 1-2 product squads from discovery through to launch' || E'\n' ||
  'Run user research and translate insights into actionable design decisions' || E'\n' ||
  'Maintain and grow our design system components in Figma' || E'\n' ||
  'Present design decisions clearly to engineers and stakeholders',
  'Lagos',
  'Remote',
  'Full-time',
  '₦400,000 - ₦600,000/month',
  array['Figma', 'UX Research', 'Product'],
  true,
  'active'
),
(
  'Backend Engineer',
  'backend-engineer-flutterwave',
  (select id from public.companies where slug = 'flutterwave'),
  'Flutterwave is building the infrastructure for digital payments across Africa. We need a Backend Engineer to help scale our API platform.',
  '4+ years backend development experience' || E'\n' ||
  'Strong Node.js and TypeScript skills' || E'\n' ||
  'Experience with PostgreSQL and Redis' || E'\n' ||
  'Understanding of microservices architecture',
  'Design and build scalable APIs' || E'\n' ||
  'Optimize database queries and system performance' || E'\n' ||
  'Collaborate with frontend and mobile teams' || E'\n' ||
  'Mentor junior engineers',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦500,000 - ₦800,000/month',
  array['Node.js', 'PostgreSQL', 'API'],
  true,
  'active'
),
(
  'Frontend Developer',
  'frontend-developer-andela',
  (select id from public.companies where slug = 'andela'),
  'Andela connects African talent with global opportunities. Join our team as a Frontend Developer working on our talent platform.',
  '3+ years React experience' || E'\n' ||
  'Strong TypeScript skills' || E'\n' ||
  'Experience with CSS-in-JS or Tailwind' || E'\n' ||
  'Good understanding of web performance',
  'Build responsive UI components' || E'\n' ||
  'Implement design system patterns' || E'\n' ||
  'Write unit and integration tests' || E'\n' ||
  'Collaborate with designers and product managers',
  'Remote',
  'Remote',
  'Contract',
  '₦350,000 - ₦500,000/month',
  array['React', 'TypeScript', 'CSS'],
  true,
  'active'
),
(
  'Marketing Manager',
  'marketing-manager-konga',
  (select id from public.companies where slug = 'konga'),
  'Konga is Nigeria''s leading e-commerce platform. We are looking for a Marketing Manager to drive growth and brand awareness.',
  '5+ years marketing experience' || E'\n' ||
  'Proven track record in growth marketing' || E'\n' ||
  'Strong analytical skills' || E'\n' ||
  'Experience with digital marketing tools',
  'Develop and execute marketing strategy' || E'\n' ||
  'Manage growth campaigns across channels' || E'\n' ||
  'Analyze performance metrics and optimize' || E'\n' ||
  'Lead brand positioning initiatives',
  'Lagos',
  'On-site',
  'Full-time',
  '₦300,000 - ₦450,000/month',
  array['Growth', 'SEO', 'Brand'],
  false,
  'active'
),
(
  'UX Researcher',
  'ux-researcher-cowrywise',
  (select id from public.companies where slug = 'cowrywise'),
  'Cowrywise is making wealth management accessible to every African. We need a UX Researcher to help us understand our users better.',
  '2+ years UX research experience' || E'\n' ||
  'Experience with qualitative and quantitative methods' || E'\n' ||
  'Strong communication and presentation skills' || E'\n' ||
  'Familiarity with fintech products',
  'Plan and conduct user research studies' || E'\n' ||
  'Synthesize findings into actionable insights' || E'\n' ||
  'Create user personas and journey maps' || E'\n' ||
  'Collaborate with design and product teams',
  'Lagos',
  'Remote',
  'Full-time',
  '₦250,000 - ₦400,000/month',
  array['User Research', 'Figma'],
  false,
  'active'
),
(
  'DevOps Engineer',
  'devops-engineer-piggyvest',
  (select id from public.companies where slug = 'piggyvest'),
  'PiggyVest is Nigeria''s leading savings and investment platform. We need a DevOps Engineer to manage our cloud infrastructure.',
  '3+ years DevOps experience' || E'\n' ||
  'Strong AWS and Docker skills' || E'\n' ||
  'Experience with CI/CD pipelines' || E'\n' ||
  'Knowledge of Kubernetes',
  'Manage cloud infrastructure on AWS' || E'\n' ||
  'Build and maintain CI/CD pipelines' || E'\n' ||
  'Monitor system health and performance' || E'\n' ||
  'Implement security best practices',
  'Lagos',
  'Remote',
  'Full-time',
  '₦450,000 - ₦700,000/month',
  array['AWS', 'Docker', 'Kubernetes'],
  false,
  'active'
),
(
  'Mobile Developer',
  'mobile-developer-interswitch',
  (select id from public.companies where slug = 'interswitch'),
  'Interswitch is Africa''s leading integrated digital payments company. Join us to build mobile payment solutions.',
  '3+ years mobile development' || E'\n' ||
  'Experience with Flutter or React Native' || E'\n' ||
  'Understanding of payment systems' || E'\n' ||
  'Strong problem-solving skills',
  'Build and maintain mobile applications' || E'\n' ||
  'Implement payment features' || E'\n' ||
  'Optimize app performance' || E'\n' ||
  'Collaborate with backend teams',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦350,000 - ₦550,000/month',
  array['Flutter', 'React Native', 'Mobile'],
  false,
  'active'
),
(
  'Data Analyst',
  'data-analyst-mtn',
  (select id from public.companies where slug = 'mtn-nigeria'),
  'MTN Nigeria is the leading telecommunications provider. We need a Data Analyst to drive insights from our vast data.',
  '2+ years data analysis experience' || E'\n' ||
  'Strong SQL and Python skills' || E'\n' ||
  'Experience with Tableau or Power BI' || E'\n' ||
  'Good communication skills',
  'Analyze large datasets to find insights' || E'\n' ||
  'Build dashboards and reports' || E'\n' ||
  'Support business decisions with data' || E'\n' ||
  'Collaborate with stakeholders',
  'Abuja',
  'On-site',
  'Full-time',
  '₦280,000 - ₦400,000/month',
  array['SQL', 'Tableau', 'Python'],
  false,
  'active'
),
(
  'Customer Success Manager',
  'customer-success-interswitch',
  (select id from public.companies where slug = 'interswitch'),
  'Interswitch needs a Customer Success Manager to ensure our merchant partners thrive on our platform.',
  '3+ years customer success experience' || E'\n' ||
  'Strong relationship management skills' || E'\n' ||
  'Experience with CRM tools' || E'\n' ||
  'Understanding of payments industry',
  'Onboard and support merchant partners' || E'\n' ||
  'Drive product adoption and retention' || E'\n' ||
  'Handle escalations and feedback' || E'\n' ||
  'Collaborate with product and engineering',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦250,000 - ₦350,000/month',
  array['CRM', 'Support', 'Payments'],
  false,
  'active'
),
(
  'Graduate Trainee',
  'graduate-trainee-gtbank',
  (select id from public.companies where slug = 'gtbank'),
  'GTBank is looking for bright graduates to join our technology team. This is a 12-month rotational program.',
  'Recent graduate (0-1 year experience)' || E'\n' ||
  'Strong academic record' || E'\n' ||
  'Good communication skills' || E'\n' ||
  'Interest in banking technology',
  'Rotate through different tech teams' || E'\n' ||
  'Learn banking systems and processes' || E'\n' ||
  'Contribute to real projects' || E'\n' ||
  'Receive mentorship and training',
  'Lagos',
  'On-site',
  'Internship',
  '₦150,000/month',
  array['Finance', 'Training', 'Banking'],
  false,
  'active'
)
on conflict (slug) do nothing;

update public.companies
set job_count = (
  select count(*)
  from public.jobs
  where jobs.company_id = companies.id
    and jobs.status = 'active'
);

/*
# Seed NaijaJobs with sample data

1. Insert sample companies (Paystack, Flutterwave, Andela, Konga, Cowrywise, PiggyVest, Interswitch, MTN Nigeria, GTBank)
2. Insert sample jobs for each company
3. Update company job counts
*/

-- Insert companies
INSERT INTO companies (name, slug, logo_initials, avatar_color, location, website, description, verified, job_count) VALUES
('Paystack', 'paystack', 'PS', 'teal', 'Lagos', 'https://paystack.com', 'Modern payments infrastructure for Africa', true, 2),
('Flutterwave', 'flutterwave', 'FW', 'blue', 'Lagos', 'https://flutterwave.com', 'Payment technology company', true, 2),
('Andela', 'andela', 'AN', 'teal', 'Remote', 'https://andela.com', 'Global talent network', true, 1),
('Konga', 'konga', 'KG', 'amber', 'Lagos', 'https://konga.com', 'E-commerce platform', true, 1),
('Cowrywise', 'cowrywise', 'CW', 'purple', 'Lagos', 'https://cowrywise.com', 'Digital wealth management', true, 1),
('PiggyVest', 'piggyvest', 'PV', 'purple', 'Lagos', 'https://piggyvest.com', 'Savings and investment platform', true, 1),
('Interswitch', 'interswitch', 'IS', 'coral', 'Lagos', 'https://interswitchgroup.com', 'Integrated digital payments', true, 2),
('MTN Nigeria', 'mtn-nigeria', 'MT', 'amber', 'Abuja', 'https://mtn.ng', 'Telecommunications', true, 1),
('GTBank', 'gtbank', 'GT', 'blue', 'Lagos', 'https://gtbank.com', 'Commercial bank', true, 1)
ON CONFLICT (slug) DO NOTHING;

-- Insert jobs
INSERT INTO jobs (title, slug, company_id, description, requirements, what_youll_do, location, work_type, job_type, salary, tags, featured, status) VALUES
(
  'Product Designer',
  'product-designer-paystack',
  (SELECT id FROM companies WHERE slug = 'paystack'),
  'Paystack is looking for a talented Product Designer to help build world-class financial products used by over 200,000 businesses across Nigeria and Africa.\n\nYou''ll work closely with product managers and engineers to design intuitive, accessible experiences that make payments simpler for merchants and their customers every day.',
  '3+ years of product design experience, ideally fintech or SaaS\nStrong Figma skills and a portfolio showing end-to-end design process\nExperience with user research and usability testing\nClear communication with cross-functional teams',
  'Lead design for 1–2 product squads from discovery through to launch\nRun user research and translate insights into actionable design decisions\nMaintain and grow our design system components in Figma\nPresent design decisions clearly to engineers and stakeholders',
  'Lagos',
  'Remote',
  'Full-time',
  '₦400,000 - ₦600,000/month',
  ARRAY['Figma', 'UX Research', 'Product'],
  true,
  'active'
),
(
  'Backend Engineer',
  'backend-engineer-flutterwave',
  (SELECT id FROM companies WHERE slug = 'flutterwave'),
  'Flutterwave is building the infrastructure for digital payments across Africa. We need a Backend Engineer to help scale our API platform.',
  '4+ years backend development experience\nStrong Node.js and TypeScript skills\nExperience with PostgreSQL and Redis\nUnderstanding of microservices architecture',
  'Design and build scalable APIs\nOptimize database queries and system performance\nCollaborate with frontend and mobile teams\nMentor junior engineers',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦500,000 - ₦800,000/month',
  ARRAY['Node.js', 'PostgreSQL', 'API'],
  true,
  'active'
),
(
  'Frontend Developer',
  'frontend-developer-andela',
  (SELECT id FROM companies WHERE slug = 'andela'),
  'Andela connects African talent with global opportunities. Join our team as a Frontend Developer working on our talent platform.',
  '3+ years React experience\nStrong TypeScript skills\nExperience with CSS-in-JS or Tailwind\nGood understanding of web performance',
  'Build responsive UI components\nImplement design system patterns\nWrite unit and integration tests\nCollaborate with designers and product managers',
  'Remote',
  'Remote',
  'Contract',
  '₦350,000 - ₦500,000/month',
  ARRAY['React', 'TypeScript', 'CSS'],
  true,
  'active'
),
(
  'Marketing Manager',
  'marketing-manager-konga',
  (SELECT id FROM companies WHERE slug = 'konga'),
  'Konga is Nigeria''s leading e-commerce platform. We are looking for a Marketing Manager to drive growth and brand awareness.',
  '5+ years marketing experience\nProven track record in growth marketing\nStrong analytical skills\nExperience with digital marketing tools',
  'Develop and execute marketing strategy\nManage growth campaigns across channels\nAnalyze performance metrics and optimize\nLead brand positioning initiatives',
  'Lagos',
  'On-site',
  'Full-time',
  '₦300,000 - ₦450,000/month',
  ARRAY['Growth', 'SEO', 'Brand'],
  false,
  'active'
),
(
  'UX Researcher',
  'ux-researcher-cowrywise',
  (SELECT id FROM companies WHERE slug = 'cowrywise'),
  'Cowrywise is making wealth management accessible to every African. We need a UX Researcher to help us understand our users better.',
  '2+ years UX research experience\nExperience with qualitative and quantitative methods\nStrong communication and presentation skills\nFamiliarity with fintech products',
  'Plan and conduct user research studies\nSynthesize findings into actionable insights\nCreate user personas and journey maps\nCollaborate with design and product teams',
  'Lagos',
  'Remote',
  'Full-time',
  '₦250,000 - ₦400,000/month',
  ARRAY['User Research', 'Figma'],
  false,
  'active'
),
(
  'DevOps Engineer',
  'devops-engineer-piggyvest',
  (SELECT id FROM companies WHERE slug = 'piggyvest'),
  'PiggyVest is Nigeria''s leading savings and investment platform. We need a DevOps Engineer to manage our cloud infrastructure.',
  '3+ years DevOps experience\nStrong AWS and Docker skills\nExperience with CI/CD pipelines\nKnowledge of Kubernetes',
  'Manage cloud infrastructure on AWS\nBuild and maintain CI/CD pipelines\nMonitor system health and performance\nImplement security best practices',
  'Lagos',
  'Remote',
  'Full-time',
  '₦450,000 - ₦700,000/month',
  ARRAY['AWS', 'Docker', 'Kubernetes'],
  false,
  'active'
),
(
  'Mobile Developer',
  'mobile-developer-interswitch',
  (SELECT id FROM companies WHERE slug = 'interswitch'),
  'Interswitch is Africa''s leading integrated digital payments company. Join us to build mobile payment solutions.',
  '3+ years mobile development\nExperience with Flutter or React Native\nUnderstanding of payment systems\nStrong problem-solving skills',
  'Build and maintain mobile applications\nImplement payment features\nOptimize app performance\nCollaborate with backend teams',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦350,000 - ₦550,000/month',
  ARRAY['Flutter', 'React Native', 'Mobile'],
  false,
  'active'
),
(
  'Data Analyst',
  'data-analyst-mtn',
  (SELECT id FROM companies WHERE slug = 'mtn-nigeria'),
  'MTN Nigeria is the leading telecommunications provider. We need a Data Analyst to drive insights from our vast data.',
  '2+ years data analysis experience\nStrong SQL and Python skills\nExperience with Tableau or Power BI\nGood communication skills',
  'Analyze large datasets to find insights\nBuild dashboards and reports\nSupport business decisions with data\nCollaborate with stakeholders',
  'Abuja',
  'On-site',
  'Full-time',
  '₦280,000 - ₦400,000/month',
  ARRAY['SQL', 'Tableau', 'Python'],
  false,
  'active'
),
(
  'Customer Success Manager',
  'customer-success-interswitch',
  (SELECT id FROM companies WHERE slug = 'interswitch'),
  'Interswitch needs a Customer Success Manager to ensure our merchant partners thrive on our platform.',
  '3+ years customer success experience\nStrong relationship management skills\nExperience with CRM tools\nUnderstanding of payments industry',
  'Onboard and support merchant partners\nDrive product adoption and retention\nHandle escalations and feedback\nCollaborate with product and engineering',
  'Lagos',
  'Hybrid',
  'Full-time',
  '₦250,000 - ₦350,000/month',
  ARRAY['CRM', 'Support', 'Payments'],
  false,
  'active'
),
(
  'Graduate Trainee',
  'graduate-trainee-gtbank',
  (SELECT id FROM companies WHERE slug = 'gtbank'),
  'GTBank is looking for bright graduates to join our technology team. This is a 12-month rotational program.',
  'Recent graduate (0-1 year experience)\nStrong academic record\nGood communication skills\nInterest in banking technology',
  'Rotate through different tech teams\nLearn banking systems and processes\nContribute to real projects\nReceive mentorship and training',
  'Lagos',
  'On-site',
  'Internship',
  '₦150,000/month',
  ARRAY['Finance', 'Training', 'Banking'],
  false,
  'active'
)
ON CONFLICT (slug) DO NOTHING;

-- Update job counts
UPDATE companies SET job_count = (
  SELECT COUNT(*) FROM jobs WHERE jobs.company_id = companies.id AND jobs.status = 'active'
);

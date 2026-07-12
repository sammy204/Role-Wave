# RoleWave

RoleWave is a modern job marketplace that helps candidates discover roles and helps employers manage hiring. The platform includes job discovery, applications, candidate profiles, employer dashboards, admin moderation, and mobile-friendly browsing.

## What the website does

- Lets candidates browse and filter jobs
- Supports job detail pages and application flows
- Includes saved jobs and candidate activity tracking
- Offers employer onboarding and job posting tools
- Provides admin tools for reviewing and managing listings
- Supports email subscriptions for new opportunities
- Includes a responsive mobile experience with mobile navigation and filters

## Tech stack

- React + TypeScript
- Vite
- React Router
- Tailwind CSS
- Supabase for auth, database, and data access
- ESLint and TypeScript for quality checks

## Project structure

- src/pages - main app views and routes
- src/components - reusable UI components
- src/lib - auth, Supabase, and helper logic
- src/types - shared TypeScript types
- supabase/migrations - database schema and seed migrations

## Getting started

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create a local environment file with your Supabase values:

   ```env
   VITE_SUPABASE_URL=your_supabase_project_url
   VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

3. Start the development server:

   ```bash
   npm run dev
   ```

## Useful scripts

- npm run dev - start the app locally
- npm run build - create a production build
- npm run preview - preview the production build
- npm run lint - run ESLint
- npm run typecheck - run TypeScript checks

## Main areas

- / - homepage and job discovery
- /jobs - job listings
- /candidate - candidate dashboard and profile area
- /employer/onboarding - employer onboarding
- /employer/dashboard - employer workspace
- /post - create a new job
- /admin - admin dashboard

# RoleWave Project Roadmap

This is the working plan for the next product phases. Update it as decisions change.

## When the custom domain is ready

- Connect the domain to Netlify and Supabase.
- Fix production authentication redirects and password-reset URLs.
- Configure a transactional email provider.
- Add SPF, DKIM, and DMARC records.
- Review and finalize the Privacy Policy and Terms with the real legal entity and contact details.

## Employer dashboard priorities

1. Fix employer RLS so only approved employer accounts can create companies and jobs.
2. Add job editing.
3. Build a hiring pipeline: new, reviewing, shortlisted, interview, hired, and rejected.
4. Add realtime application updates and employer notifications.
5. Add job performance analytics: views, applications, conversion, and closing dates.
6. Add stronger candidate filters, saved candidates, employer notes, and bulk actions.
7. Add duplicate-job, screening-question, CSV-export, and team-access features later.

## Email and subscriptions

- Improve email subscriptions with confirmation, unsubscribe links, preferences, duplicate protection, and abuse/rate limiting.
- Add transactional emails for account confirmation, password resets, application updates, employer messages, and verification updates.
- Add scheduled job-alert emails based on candidate preferences.
- Add paid subscription infrastructure later with Stripe, plan entitlements, billing periods, webhooks, and usage limits.

## Account deletion

- Add confirmation plus recent password/OTP verification.
- Use a protected backend/Edge Function workflow.
- Revoke sessions and push subscriptions.
- Delete private candidate files and employer assets.
- Delete or anonymize profiles and related records safely.
- Preserve only records needed for legal, security, or hiring-history purposes.
- Add a 7–30 day recovery period and permanent deletion afterward.
- Offer a data export before deletion.

## Monthly Career Summary

- Send candidates a monthly summary of applications, statuses, shortlists, messages, saved jobs, matches, and profile progress.
- Keep sensitive details out of email and link back to the dashboard.
- Make the email opt-in and include unsubscribe/preferences controls.
- Use a scheduled Supabase Edge Function and transactional email provider.
- Add server-side tracking for saved jobs, profile views, matches, and monthly snapshots.

## RoleWave AI — later major phase

Build only after the core product and backend are stable:

- AI cover-letter generation.
- AI job matching and match explanations.
- Resume/profile improvement.
- Skill-gap analysis.
- Interview preparation.
- AI career assistant.
- Free monthly credits, such as three cover letters per month.
- Premium plan with higher limits and advanced tools.
- Enforce usage limits server-side and keep AI keys out of the browser.

## Already completed reference work

- Candidate asset privacy and signed resume viewing.
- Job-submission and application-write protections.
- Internal applications require accounts.
- Messaging delivery/read states and realtime updates.
- Candidate settings page, dark/light/system themes, and delete-account placeholder.
- Candidate visibility RLS.
- Netlify security headers and dependency/build checks.

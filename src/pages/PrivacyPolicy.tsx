import { ChevronLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { useIsPwa } from '../lib/usePwaDisplayMode';

const LAST_UPDATED = 'August 10, 2026';

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-8">
      <h2 className="font-display mb-2 text-[18px] font-semibold text-ink sm:text-[20px]">{title}</h2>
      <div className="space-y-3 text-[13.5px] leading-relaxed text-muted">{children}</div>
    </div>
  );
}

export default function PrivacyPolicy() {
  const navigate = useNavigate();
  const isPwa = useIsPwa();

  return (
    <div className={isPwa ? 'min-h-screen bg-[#F1EFE8]' : 'page-shell'}>
      <div className="mx-auto w-full max-w-[820px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {isPwa && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-3.5 py-2 text-sm font-semibold text-[#1A1A1A] shadow-sm backdrop-blur-xl"
          >
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <div className="panel rounded-panel p-5 sm:p-10">
          <div className="mb-8">
            <h1 className="font-display text-[26px] font-bold text-ink sm:text-[34px]">Privacy Policy</h1>
            <p className="mt-2 text-[13px] text-faint">Last updated: {LAST_UPDATED}</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
              RoleWave ("RoleWave," "we," "us," or "our") operates a job marketplace connecting tech
              and digital talent with employers in Nigeria. This Privacy Policy explains what
              personal data we collect, why we collect it, how it's used and protected, and the
              rights you have over it. It applies to everyone who uses the RoleWave platform,
              whether as a candidate, an employer, or a visitor browsing job listings.
            </p>
          </div>

          <Section title="1. Who this policy covers">
            <p>
              This policy is written to comply with the Nigeria Data Protection Act, 2023 ("NDPA")
              and the regulatory guidance of the Nigeria Data Protection Commission ("NDPC"). If you
              access RoleWave from outside Nigeria, your data may still be processed as described
              here, and by using the platform you consent to that processing.
            </p>
          </Section>

          <Section title="2. Information we collect">
            <p>
              <span className="font-semibold text-ink">Account information.</span> When you sign up,
              we collect your name, email address, password, and your account role, candidate or employer. Each account operates under a
              single, fixed role chosen at signup.
            </p>
            <p>
              <span className="font-semibold text-ink">Candidate profile data.</span> If you use
              RoleWave to look for work, we may collect your phone or WhatsApp number, location and
              preferred work locations, skills, avatar image, and your resume/CV file along with its
              file name. You choose what to include in your profile, most fields are optional.
            </p>
            <p>
              <span className="font-semibold text-ink">Employer & company data.</span> If you post
              jobs, we collect company name, website, size, office location, a contact phone number,
              and any verification documents you voluntarily submit to speed up employer review.
            </p>
            <p>
              <span className="font-semibold text-ink">Applications & messages.</span> When you apply
              to a job, we store your application, its status as it moves through an employer's
              hiring pipeline, and any messages exchanged between candidates and employers on the
              platform.
            </p>
            <p>
              <span className="font-semibold text-ink">Usage data.</span> We automatically log basic
              technical information (such as browser type, device type, and general access times)
              needed to operate and secure the platform.
            </p>
          </Section>

          <Section title="3. Cookies and similar technologies">
            <p>
              RoleWave uses your browser's local storage to keep you signed in between visits, this
              is <span className="font-semibold text-ink">strictly necessary</span> and cannot be
              turned off without logging you out. We do not currently use third party advertising or
              tracking cookies. We may use analytics and diagnostic tools to monitor errors,
              performance, and platform reliability when you allow them. See our{' '}
              <Link
                to="/cookie-policy"
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="font-semibold text-ink underline underline-offset-2"
              >
                Cookie Policy
              </Link>{' '}
              for more details about how these technologies are used.
            </p>
          </Section>

          <Section title="4. How we use your information">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>To create and maintain your account under your chosen role (candidate or employer)</li>
              <li>To show candidates relevant job listings and let employers evaluate applicants</li>
              <li>To operate messaging between candidates and employers</li>
              <li>To manually review and verify employer accounts and job postings before they go live</li>
              <li>To send you service related notices (e.g. application updates, verification status)</li>
              <li>To detect fraud, abuse, and violations of our Terms of Service</li>
              <li>To improve the platform based on aggregate, non-identifying usage patterns</li>
            </ul>
            <p>
              We do not sell your personal data, and we do not use your resume, profile, or messages
              to train third party advertising systems.
            </p>
          </Section>

          <Section title="5. Who we share it with">
            <p>
              <span className="font-semibold text-ink">Other users, as intended by the product.</span>{' '}
              Your candidate profile is visible to employers you apply to (and, where you have enabled
              it, to employers browsing candidates). Employer/company information is public to anyone
              browsing job listings.
            </p>
            <p>
              <span className="font-semibold text-ink">Service providers.</span> We use a small number
              of trusted infrastructure providers to run RoleWave: a database and authentication
              provider for account data, file storage, and realtime messaging; an email provider to
              send account-related emails; a
              bot-verification provider to confirm you're a real visitor on our sign-up and login
              forms; and a hosting provider to serve the RoleWave website. These providers process
              data on our behalf under their own security commitments and only as needed to run
              RoleWave.
            </p>
            <p>
              <span className="font-semibold text-ink">Legal reasons.</span> We may disclose
              information if required by law, court order, or to protect the rights, property, or
              safety of RoleWave, our users, or the public.
            </p>
          </Section>

          <Section title="6. Data retention">
            <p>
              We keep your account and profile data for as long as your account is active. If you
              delete your account, it enters a 10-day grace period during which you can reverse the
              deletion by signing back in. After the grace period ends, your account and associated
              personal data are permanently deleted, except where we're required to retain records
              for legal, security, or resolving disputes purposes.
            </p>
          </Section>

          <Section title="7. Your rights">
            <p>Under the NDPA, you have the right to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Access the personal data we hold about you</li>
              <li>Correct inaccurate or incomplete data</li>
              <li>Request deletion of your data, subject to legal retention requirements</li>
              <li>Object to or restrict certain processing of your data</li>
              <li>Request a portable copy of your data in a common format</li>
              <li>Withdraw consent at any time where processing is based on consent</li>
              <li>Lodge a complaint with the Nigeria Data Protection Commission</li>
            </ul>
            <p>
              You can exercise most of these rights directly from your account settings. For anything
              else, contact us using the details below.
            </p>
          </Section>

          <Section title="8. Security">
            <p>
              We use standard safeguards, including encrypted connections, access controls,
              and database row security on our database, to protect your data. No system is perfectly
              secure, and we encourage you to use a strong, unique password and to report any concerns
              to us right away.
            </p>
          </Section>

          <Section title="9. Children's privacy">
            <p>
              RoleWave is intended for people who are at least 18 years old or otherwise old enough to
              legally work in their jurisdiction. We do not knowingly collect data from children.
            </p>
          </Section>

          <Section title="10. Changes to this policy">
            <p>
              We may update this Privacy Policy as RoleWave grows, We will update the "Last updated" date
              above, and where changes are material, we will make reasonable efforts to notify you.
            </p>
          </Section>

          <Section title="11. Contact us">
            <p>
              For any privacy questions, requests, or complaints, reach us at{' '}
              <a href="mailto:support@rolewave.cv" className="font-semibold text-ink underline underline-offset-2">
                support@rolewave.cv
              </a>
              .
            </p>
          </Section>

          
        </div>
      </div>
    </div>
  );
}

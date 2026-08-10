import { ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
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

export default function TermsOfService() {
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
            <h1 className="font-display text-[26px] font-bold text-ink sm:text-[34px]">Terms of Service</h1>
            <p className="mt-2 text-[13px] text-faint">Last updated: {LAST_UPDATED}</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
              These Terms of Service ("Terms") govern your use of RoleWave, a job marketplace
              connecting tech and digital professionals with employers in Nigeria. By creating an
              account or using the site, you agree to these Terms. If you do not agree, please do not
              use RoleWave.
            </p>
          </div>

          <Section title="1. Eligibility">
            <p>
              You must be at least 18 years old, or the legal working age in your jurisdiction if
              higher, and able to form a binding contract to use RoleWave. By using the platform, you
              confirm that you meet these requirements.
            </p>
          </Section>

          <Section title="2. Your account">
            <p>
              You are responsible for keeping your login credentials confidential and for all activity
              under your account. Each RoleWave account operates under a single role, candidate or
              employer, chosen when you sign up. If you need the other type of account, you'll need
              to create it separately.
            </p>
            <p>
              You agree to provide accurate information when creating your profile or company page,
              and to keep it reasonably up to date. You may not impersonate another person or
              organization, or create an account for anyone other than yourself or the company you are
              authorized to represent.
            </p>
          </Section>

          <Section title="3. For candidates">
            <p>
              You may browse jobs, build a profile, upload a resume, and apply to listings free of
              charge. Applying to a job does not guarantee any response, interview, or offer, hiring
              decisions are made solely by the employer. RoleWave is not a party to and does not
              guarantee the outcome of any employment relationship formed through the platform.
            </p>
            <p>
              You can withdraw an application at any time; the employer will see it marked as
              withdrawn rather than deleted from their records.
            </p>
          </Section>

          <Section title="4. For employers">
            <p>
              You may create a company profile and post job listings, subject to review. Unverified
              employer accounts require admin approval before a job goes live; you may optionally
              submit documentation to help speed up that review.
            </p>
            <p>
              <span className="font-semibold text-ink">Verification is not a guarantee.</span> Our
              review process is intended to reduce fraud and low quality postings, but it does not
              constitute a legal certification of a company's identity, solvency, or legitimacy.
              Candidates should exercise their own judgment, especially before sharing sensitive
              personal information or accepting an offer.
            </p>
            <p>
              Job postings must be genuine, currently open roles. You may not post listings that are
              discriminatory on any legally protected basis, misleading about compensation or job
              duties, or that require payment from candidates as a condition of applying or being
              hired.
            </p>
            <p>
              You are responsible for managing applicants through your hiring pipeline in good faith
              and for keeping candidates' application data confidential and used only for your
              hiring purposes.
            </p>
          </Section>

          <Section title="5. Prohibited conduct">
            <p>You agree not to:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>Scrape, harvest, or bulk-extract data from RoleWave without our written permission</li>
              <li>Post false, fraudulent, or misleading job listings or profile information</li>
              <li>Use the messaging system to spam, harass, or solicit users for unrelated purposes</li>
              <li>Attempt to bypass employer verification or platform security controls</li>
              <li>Upload malware, or content that infringes on someone else's rights</li>
              <li>Use the platform in a way that violates applicable Nigerian or local law</li>
            </ul>
            <p>We may suspend or terminate accounts that violate these Terms.</p>
          </Section>

          <Section title="6. Content you submit">
            <p>
              You retain ownership of the content you upload (resumes, profile details, company
              information, job posts, messages). By submitting it, you grant RoleWave a license to
              store, display, and process that content as needed to operate the platform, for
              example, showing your profile to employers you apply to, or your job post to candidates
              browsing listings.
            </p>
          </Section>

          <Section title="7. Fees">
            <p>
              RoleWave is currently free to use for both candidates and employers. If we introduce
              paid plans or features in the future, we will communicate pricing clearly before you are
              charged, and continued free use will not be affected retroactively.
            </p>
          </Section>

          <Section title="8. Termination">
            <p>
              You may stop using RoleWave and delete your account at any time. We may suspend or
              terminate accounts that violate these Terms, pose a security risk, or are inactive for
              an extended period, with notice where reasonably possible.
            </p>
          </Section>

          <Section title="9. Disclaimers">
            <p>
              RoleWave is provided "as is" without warranties of any kind, express or implied. We do
              not guarantee that job listings are accurate, that employers are legitimate beyond our
              stated verification process, or that the platform will be uninterrupted or free of errors.
              You use RoleWave at your own risk, and any hiring or employment decision is between you
              and the other party, not RoleWave.
            </p>
          </Section>

          <Section title="10. Limitation of liability">
            <p>
              To the maximum extent permitted by law, RoleWave and its team will not be liable for any
              indirect, incidental, or consequential damages arising from your use of the platform,
              including but not limited to loss of employment opportunity, lost profits, or data loss.
              Our total liability for any claim relating to RoleWave will not exceed the amount, if
              any, you have paid us in the twelve months before the claim arose.
            </p>
          </Section>

          <Section title="11. Governing law">
            <p>
              These Terms are governed by the laws of the Federal Republic of Nigeria. Any dispute
              arising from these Terms or your use of RoleWave will be subject to the exclusive
              jurisdiction of the Nigerian courts.
            </p>
          </Section>

          <Section title="12. Changes to these Terms">
            <p>
              We may update these Terms as RoleWave evolves. We will update the "Last updated" date
              above, and for material changes, we will make reasonable efforts to notify users. Continued
              use of RoleWave after changes take effect means you accept the updated Terms.
            </p>
          </Section>

          <Section title="13. Contact us">
            <p>
              Questions about these Terms? Reach us at{' '}
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

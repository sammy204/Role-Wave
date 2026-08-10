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

export default function CookiePolicy() {
  const navigate = useNavigate();
  const isPwa = useIsPwa();

  return (
    <div className={isPwa ? 'min-h-screen bg-[#F1EFE8]' : 'page-shell'}>
      <div className="mx-auto w-full max-w-[820px] px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        {isPwa && (
          <button type="button" onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-1.5 rounded-full border border-white/80 bg-white/75 px-3.5 py-2 text-sm font-semibold text-[#1A1A1A] shadow-sm backdrop-blur-xl">
            <ChevronLeft size={16} /> Back
          </button>
        )}
        <div className="panel rounded-panel p-5 sm:p-10">
          <div className="mb-8">
            <h1 className="font-display text-[26px] font-bold text-ink sm:text-[34px]">Cookie Policy</h1>
            <p className="mt-2 text-[13px] text-faint">Last updated: {LAST_UPDATED}</p>
            <p className="mt-4 text-[13.5px] leading-relaxed text-muted">
              This policy explains how RoleWave uses cookies and similar technologies, such as your browser's local storage, when you visit rolewave.cv.
            </p>
          </div>

          <Section title="1. What we actually use">
            <p>Most of what RoleWave remembers about your visit is stored using your browser's <span className="font-semibold text-ink">local storage</span> rather than traditional cookies. This includes:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li><span className="font-semibold text-ink">Session and sign in</span>. This keeps you signed in between visits so you do not have to log in every time.</li>
              <li><span className="font-semibold text-ink">Preferences</span>. This remembers choices such as light or dark theme and your cookie consent selection.</li>
            </ul>
            <p>These are strictly necessary for RoleWave to work, and cannot be turned off without signing you out.</p>
          </Section>

          <Section title="2. Third party cookies">
            <p>One third party service sets its own cookies when you use RoleWave:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-semibold text-ink">Cloudflare Turnstile</span>. This is used on our signup and login forms to confirm you are a real visitor and not a bot. See{' '}
                <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-text underline underline-offset-2">Cloudflare's privacy policy</a>{' '}for details.
              </li>
            </ul>
            <p>We do not use Google Analytics, advertising cookies, or any other tracking technology at this time.</p>
          </Section>

          <Section title="3. Analytics">
            <p>We do not currently run analytics on RoleWave. Our cookie banner includes an optional, off by default analytics setting reserved for future use. If we ever turn analytics on, it will only apply to visitors who opt in, and we will update this policy first.</p>
          </Section>

          <Section title="4. Managing cookies and local storage">
            <p>Most browsers let you:</p>
            <ul className="list-disc space-y-1.5 pl-5">
              <li>View what is stored and delete it individually</li>
              <li>Block third party cookies</li>
              <li>Block cookies from specific sites</li>
              <li>Clear all cookies and site data when you close your browser</li>
            </ul>
            <p>If you block cookies or clear local storage, you may be signed out, your theme preference may reset, and the signup or login form's bot protection check may not load properly.</p>
          </Section>

          <Section title="5. Changes to this policy">
            <p>We may update this Cookie Policy from time to time. We will update the "Last updated" date above when we do.</p>
          </Section>

          <Section title="6. Contact us">
            <p>Questions about this Cookie Policy? Reach us at{' '}<a href="mailto:support@rolewave.cv" className="font-semibold text-ink underline underline-offset-2">support@rolewave.cv</a>.</p>
          </Section>
        </div>
      </div>
    </div>
  );
}

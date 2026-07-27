import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const STORAGE_KEY = 'rw_cookie_consent';

type ConsentRecord = {
  necessary: true;
  analytics: boolean;
  decidedAt: string;
};

/**
 * Reads the stored consent decision, if any.
 * Safe to call from anywhere (analytics init, etc.) once that's wired up.
 */
export function getCookieConsent(): ConsentRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as ConsentRecord;
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return getCookieConsent()?.analytics === true;
}

function saveConsent(analytics: boolean) {
  const record: ConsentRecord = { necessary: true, analytics, decidedAt: new Date().toISOString() };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
  } catch {
    // localStorage unavailable (private mode, etc.) — banner will just reappear next visit
  }
}

export default function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [analyticsChecked, setAnalyticsChecked] = useState(false);

  useEffect(() => {
    setVisible(getCookieConsent() === null);
  }, []);

  if (!visible) return null;

  const acceptAll = () => {
    saveConsent(true);
    setVisible(false);
  };

  const necessaryOnly = () => {
    saveConsent(false);
    setVisible(false);
  };

  const saveChoices = () => {
    saveConsent(analyticsChecked);
    setVisible(false);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-[60] px-3 pb-3 sm:px-4 sm:pb-4">
      <div className="mx-auto w-full max-w-[560px] rounded-panel border border-line bg-white/95 p-4 shadow-card-hover backdrop-blur-xl sm:p-5">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-light text-accent-text">
            <Cookie size={16} />
          </div>
          <div className="flex-1">
            <div className="text-[14px] font-semibold text-ink">We use cookies</div>
            <p className="mt-1 text-[12.5px] leading-relaxed text-muted">
              We use essential cookies and local storage to keep you signed in and RoleWave working
              properly. With your permission, we'd also like to use optional analytics cookies to
              understand how the site is used. See our{' '}
              <Link to="/privacy" className="font-semibold text-accent-text underline underline-offset-2">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>

            {expanded && (
              <div className="mt-3 flex flex-col gap-2 rounded-[16px] border border-line bg-paper p-3">
                <label className="flex items-start gap-2 text-[12.5px] text-ink opacity-60">
                  <input type="checkbox" checked disabled className="mt-0.5" />
                  <span>
                    <span className="font-semibold">Necessary</span> — required for login sessions and
                    core site function. Always on.
                  </span>
                </label>
                <label className="flex items-start gap-2 text-[12.5px] text-ink">
                  <input
                    type="checkbox"
                    checked={analyticsChecked}
                    onChange={(e) => setAnalyticsChecked(e.target.checked)}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="font-semibold">Analytics</span> — helps us understand usage so we
                    can improve RoleWave. Off by default.
                  </span>
                </label>
              </div>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                onClick={acceptAll}
                className="rounded-full bg-accent px-4 py-2 text-[12.5px] font-semibold text-white transition hover:bg-accent-deep"
              >
                Accept all
              </button>
              <button
                onClick={necessaryOnly}
                className="rounded-full border border-line bg-white px-4 py-2 text-[12.5px] font-semibold text-ink transition hover:border-accent"
              >
                Necessary only
              </button>
              {!expanded ? (
                <button
                  onClick={() => setExpanded(true)}
                  className="px-2 py-2 text-[12.5px] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                >
                  Customize
                </button>
              ) : (
                <button
                  onClick={saveChoices}
                  className="px-2 py-2 text-[12.5px] font-semibold text-muted underline underline-offset-2 hover:text-ink"
                >
                  Save choices
                </button>
              )}
            </div>
          </div>
          <button
            onClick={necessaryOnly}
            aria-label="Dismiss (necessary cookies only)"
            className="mt-0.5 flex-shrink-0 rounded-full p-1 text-faint hover:bg-paper hover:text-ink"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
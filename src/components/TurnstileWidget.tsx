import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef } from 'react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
}

/**
 * Cloudflare Turnstile widget used to gate signup, login, and password reset.
 * Renders nothing (and auth forms fall back to no captchaToken) if the site key
 * env var isn't set, so local dev without a key configured doesn't hard-crash —
 * but Supabase will reject the request if Attack Protection is enabled there
 * and no token is supplied, so the key should always be set once CAPTCHA is on.
 */
export const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  ({ onVerify, onExpire }, ref) => {
    if (!TURNSTILE_SITE_KEY) {
      if (import.meta.env.DEV) {
        console.warn(
          'VITE_TURNSTILE_SITE_KEY is not set — the Turnstile widget will not render. ' +
            'Auth requests will be sent without a captchaToken.'
        );
      }
      return null;
    }

    return (
      <div className="mt-1 flex justify-center">
        <Turnstile
          ref={ref}
          siteKey={TURNSTILE_SITE_KEY}
          onSuccess={onVerify}
          onExpire={() => {
            onVerify('');
            onExpire?.();
          }}
          options={{ size: 'flexible' }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';
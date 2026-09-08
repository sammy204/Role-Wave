import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { forwardRef } from 'react';

const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY as string | undefined;

interface TurnstileWidgetProps {
  onVerify: (token: string) => void;
  onExpire?: () => void;
  appearance?: 'always' | 'execute' | 'interaction-only';
  action?: string;
}

/**
 * Cloudflare Turnstile widget used by protected public forms such as support
 * requests and admin login. Renders nothing if the site key
 * env var isn't set, so local dev without a key configured doesn't hard-crash —
 * callers remain responsible for handling the missing token.
 */
export const TurnstileWidget = forwardRef<TurnstileInstance, TurnstileWidgetProps>(
  ({ onVerify, onExpire, appearance = 'always', action }, ref) => {
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
          options={{ size: 'flexible', appearance, action }}
        />
      </div>
    );
  }
);

TurnstileWidget.displayName = 'TurnstileWidget';

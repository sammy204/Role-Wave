import * as Sentry from '@sentry/react';

const dsn = import.meta.env.VITE_SENTRY_DSN as string | undefined;

export function initializeSentry() {
  if (!dsn) return;

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: import.meta.env.PROD ? 0.1 : 1,
    sendDefaultPii: false,
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>) {
  if (!dsn) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}

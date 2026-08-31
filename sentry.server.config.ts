import * as Sentry from '@sentry/astro';

Sentry.init({
  dsn: import.meta.env.SENTRY_DSN || undefined,
  tracesSampleRate: 0.2,
  enabled: !!import.meta.env.SENTRY_DSN,
});

// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import netlify from '@astrojs/netlify';
import sentry from '@sentry/astro';

import cacheNetlify from './integrations/cache-netlify.mjs';

const integrations = [
  react(),
  cacheNetlify(),
];

// Only enable Sentry when a real DSN is configured — the integration's
// build/dev hooks stall when it cannot reach Sentry. Placeholder values
// like "your-sentry-dsn" must not count as enabled.
const sentryDsn = process.env.SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith('http')) {
  integrations.push(
    sentry({
      sourceMapsUploadOptions: {
        project: 'firstcrop',
        authToken: process.env.SENTRY_AUTH_TOKEN,
      },
    })
  );
}

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: netlify(),
  integrations,
  vite: {
    ssr: {
      noExternal: ['lucide-react'],
    },
  },
});

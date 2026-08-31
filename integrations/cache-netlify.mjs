/**
 * Custom Netlify cache integration for Astro ISR.
 * Adds production cache headers + Netlify-Cache-Tags via injected middleware.
 *
 * Page-level tags: set `Astro.locals.cacheTags = ['products']` (optional) or
 * rely on the default 'products' tag for catalog pages.
 *
 * Purge from admin:
 *   import { purgeCache } from '../integrations/cache-netlify.mjs';
 *   await purgeCache({ tags: ['products'] });
 */

const CACHEABLE_PREFIXES = ['/', '/products', '/categories'];
const DEFAULT_MAX_AGE = 60; // seconds

/**
 * Call this in page frontmatter for documentation/dev parity (no-op at runtime).
 */
export function cacheNetlify(options = {}) {
  void options;
}

/**
 * Purge cache by tags. Call from admin API endpoints.
 * Uses Netlify's cache tags API when credentials are available.
 */
export async function purgeCache(options = {}) {
  const siteId = options.siteId || process.env.SITE_ID;
  const token = process.env.NETLIFY_AUTH_TOKEN;

  if (!siteId || !token) {
    console.warn('[cacheNetlify] Missing SITE_ID or NETLIFY_AUTH_TOKEN — cache purge skipped');
    return;
  }

  if (options.tags?.length) {
    for (const tag of options.tags) {
      try {
        await fetch(`https://api.netlify.com/api/v1/sites/${siteId}/cache_tags/${tag}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch (err) {
        console.error(`[cacheNetlify] Failed to purge tag "${tag}":`, err);
      }
    }
  }
}

/**
 * Astro integration that adds cache-control headers in production
 * via a post middleware (works on Netlify Functions runtime).
 */
export default function cacheNetlifyIntegration() {
  return {
    name: 'cache-netlify',
    hooks: {
      'astro:middleware:setup': ({ addMiddleware }) => {
        addMiddleware({
          order: 'post',
          entrypoint: new URL('./cache-middleware.mjs', import.meta.url),
        });
      },
    },
  };
}

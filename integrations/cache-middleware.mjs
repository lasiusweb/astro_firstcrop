/**
 * Post middleware: injects ISR-style cache headers for cacheable catalog pages.
 * Never caches HTML for cart/checkout/account/admin/api routes.
 */
const CACHEABLE_PREFIXES = ['/', '/products', '/categories'];
const DEFAULT_MAX_AGE = 60;

export const onRequest = async (context, next) => {
  const response = await next();

  const { url, request } = context;
  const path = url.pathname;
  const isCacheable =
    (request.method === 'GET' || request.method === 'HEAD') &&
    CACHEABLE_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || p === '/');

  if (!isCacheable || !response.headers.get('content-type')?.includes('text/html')) {
    // Explicitly never cache dynamic HTML
    if (request.method === 'GET' && response.headers.get('content-type')?.includes('text/html')) {
      response.headers.set('Cache-Control', 'private, no-store');
    }
    return response;
  }

  const maxAge = Number(process.env.CATALOG_CACHE_MAX_AGE) || DEFAULT_MAX_AGE;
  response.headers.set('Cache-Control', `public, s-maxage=${maxAge}, stale-while-revalidate=${maxAge}`);
  response.headers.set('Netlify-Cache-Tags', 'products');

  return response;
};
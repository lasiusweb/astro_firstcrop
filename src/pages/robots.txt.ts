import type { APIRoute } from 'astro';

export const prerender = true;

export const GET: APIRoute = () => {
  const body = `User-agent: *
Allow: /
Disallow: /account
Disallow: /admin
Disallow: /checkout
Disallow: /api/

Sitemap: https://firstcrop.in/sitemap-index.xml
`;
  return new Response(body, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  });
};
import type { APIRoute } from 'astro';
import { listProducts, listCategories } from '../lib/products';

export const prerender = false;

const SITE = 'https://firstcrop.in';

function urlEntry(path: string, changefreq: string, priority: string): string {
  return `  <url><loc>${SITE}${path}</loc><changefreq>${changefreq}</changefreq><priority>${priority}</priority></url>`;
}

export const GET: APIRoute = async ({ cookies }) => {
  const staticPaths = [
    ['', 'daily', '1.0'],
    ['/products', 'daily', '0.9'],
    ['/about', 'monthly', '0.4'],
    ['/blog', 'weekly', '0.6'],
    ['/learn', 'weekly', '0.6'],
    ['/privacy', 'yearly', '0.2'],
    ['/terms', 'yearly', '0.2'],
  ];

  const rows = staticPaths.map(([p, f, pr]) => urlEntry(p, f, pr));

  // Live catalog entries (best-effort; sitemap still serves if DB is down)
  try {
    const categories = await listCategories(cookies);
    for (const c of categories) rows.push(urlEntry(`/categories/${c.slug}`, 'weekly', '0.7'));
    const { products } = await listProducts(cookies, { perPage: 48 });
    for (const p of products) rows.push(urlEntry(`/products/${p.slug}`, 'weekly', '0.8'));
  } catch (err) {
    console.error('[sitemap] DB fetch failed, serving static-only sitemap:', (err as Error).message);
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${rows.join('\n')}
</urlset>`;

  return new Response(xml, {
    headers: { 'Content-Type': 'application/xml; charset=utf-8' },
  });
};
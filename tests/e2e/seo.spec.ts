import { test, expect } from '@playwright/test';

test('404 page renders for unknown routes', async ({ page }) => {
  const res = await page.goto('/this-page-does-not-exist-xyz');
  expect(res?.status()).toBe(404);
  await expect(page.getByText('This field lies fallow')).toBeVisible();
});

test('robots.txt blocks private areas and points to sitemap', async ({ request }) => {
  const res = await request.get('/robots.txt');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('Disallow: /admin');
  expect(body).toContain('Disallow: /api/');
  expect(body).toContain('Sitemap: https://firstcrop.in/sitemap-index.xml');
});

test('sitemap is valid XML with core routes', async ({ request }) => {
  const res = await request.get('/sitemap-index.xml');
  expect(res.status()).toBe(200);
  const body = await res.text();
  expect(body).toContain('<urlset');
  expect(body).toContain('<loc>https://firstcrop.in/products</loc>');
  expect(body).toContain('<loc>https://firstcrop.in/blog</loc>');
});

test('static content pages are served', async ({ page }) => {
  for (const path of ['/about', '/privacy', '/terms', '/blog', '/learn']) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
  }
});

test('blog article renders from content collection', async ({ page }) => {
  await page.goto('/blog/beginners-guide-bio-fertilizers');
  // Scope to the article title — the Astro dev-toolbar injects its own <h1>s
  // (Audit / Settings / a11y checks) which would trip `locator('h1')` strict mode.
  await expect(page.locator('.blog-post-title')).toContainText("Beginner's Guide");
});

test('learn article renders from content collection', async ({ page }) => {
  await page.goto('/learn/soil-microbiology-basics');
  await expect(page.locator('.learn-post-title')).toContainText('Soil Microbiology');
});
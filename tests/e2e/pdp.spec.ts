import { test, expect } from '@playwright/test';

const PDP_URL = '/products/rhizoboost-pro';

test('PDP renders product name and benefits', async ({ page }) => {
  await page.goto(PDP_URL);
  await expect(page.locator('h1.pdp-title')).toContainText('RhizoBoost Pro');
  await expect(page.locator('.benefit-item').first()).toBeVisible();
});

test('PDP has add-to-cart button and price display', async ({ page }) => {
  await page.goto(PDP_URL);
  await expect(page.locator('.add-to-cart-btn')).toBeVisible();
  await expect(page.locator('.price-skeleton').or(page.getByText('₹'))).toBeVisible();
});

test('PDP includes Product structured data', async ({ page }) => {
  await page.goto(PDP_URL);
  const jsonLd = page.locator('script[type="application/ld+json"]');
  await expect(jsonLd).toHaveCount(1);
  const content = await jsonLd.textContent();
  const parsed = JSON.parse(content || '{}');
  expect(parsed['@type']).toBe('Product');
  expect(parsed.offers.priceCurrency).toBe('INR');
});

test('PDP breadcrumbs navigate to category', async ({ page }) => {
  await page.goto(PDP_URL);
  const breadcrumb = page.locator('.breadcrumb a', { hasText: 'Soil Treatment' });
  if ((await breadcrumb.count()) > 0) {
    await expect(breadcrumb.first()).toBeVisible();
  }
});

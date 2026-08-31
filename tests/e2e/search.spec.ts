import { test, expect } from '@playwright/test';

test('header search button opens search drawer', async ({ page }) => {
  await page.goto('/');
  await page.click('#search-toggle');
  await expect(page.locator('.search-drawer')).toBeVisible();
  // `getByLabel('Search products')` is ambiguous (the dialog and the input
  // share that accessible name) — the searchbox role uniquely targets the input.
  await expect(page.getByRole('searchbox', { name: 'Search products' })).toBeFocused();
});

test('Escape closes the search drawer', async ({ page }) => {
  await page.goto('/');
  await page.click('#search-toggle');
  await expect(page.locator('.search-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.search-drawer')).toHaveCount(0);
});

test('/search page renders with search form', async ({ page }) => {
  await page.goto('/search');
  await expect(page.locator('h1.search-title')).toContainText('Search');
  await expect(page.locator('#search-input')).toBeVisible();
});

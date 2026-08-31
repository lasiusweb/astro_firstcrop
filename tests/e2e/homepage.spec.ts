import { test, expect } from '@playwright/test';

test('homepage loads and displays heading', async ({ page }) => {
  await page.goto('/');
  const heading = page.locator('h1.hero-title');
  await expect(heading).toContainText('Grow Smarter');
});

test('page title is set', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Firstcrop/);
});

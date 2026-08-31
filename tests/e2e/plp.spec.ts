import { test, expect } from '@playwright/test';

test('PLP renders all products with prices', async ({ page }) => {
  await page.goto('/products');
  await expect(page.locator('h1.plp-title')).toContainText('All Products');
  await expect(page.locator('.product-card')).toHaveCount(8);
  await expect(page.locator('.product-price').first()).toContainText('₹');
});

test('PLP product cards link to PDPs', async ({ page }) => {
  await page.goto('/products');
  const firstCardLink = page.locator('.product-card-link').first();
  await expect(firstCardLink).toHaveAttribute(/href/, /\/products\//);
});

test('category page filters products', async ({ page }) => {
  await page.goto('/categories/soil-treatment');
  await expect(page.locator('.product-card').first()).toBeVisible();
});

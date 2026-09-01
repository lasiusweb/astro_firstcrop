import { test, expect } from '@playwright/test';

test('unauthenticated user is redirected from /admin to login', async ({ page }) => {
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('unauthenticated user is redirected from /admin/orders to login', async ({ page }) => {
  await page.goto('/admin/orders');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('unauthenticated user is redirected from /admin/products to login', async ({ page }) => {
  await page.goto('/admin/products');
  await expect(page).toHaveURL(/\/auth\/login/);
});

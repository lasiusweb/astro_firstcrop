import { test, expect } from '@playwright/test';

test('header cart button opens cart drawer', async ({ page }) => {
  await page.goto('/');
  await page.click('#cart-toggle');
  const drawer = page.locator('.cart-drawer');
  await expect(drawer).toBeVisible();
  await expect(page.locator('.cart-drawer-title')).toContainText('Cart');
});

test('guest cart drawer shows empty state', async ({ page }) => {
  await page.goto('/');
  await page.click('#cart-toggle');
  await expect(page.locator('.cart-drawer-empty')).toBeVisible();
});

test('Escape closes the cart drawer', async ({ page }) => {
  await page.goto('/');
  await page.click('#cart-toggle');
  await expect(page.locator('.cart-drawer')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.cart-drawer')).toHaveCount(0);
});

test('/cart page prompts guests to log in', async ({ page }) => {
  await page.goto('/cart');
  await expect(page.getByText('Log in to view your cart')).toBeVisible();
});

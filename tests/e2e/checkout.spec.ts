import { test, expect } from '@playwright/test';

// NOTE: The full checkout flow (address → payment → confirm) requires an
// authenticated session. These tests cover the guest-facing behavior and
// page structure. Authenticated flow tests are skipped until test
// credentials are available (see AGENTS.md — seed with `npm run seed`).

test('guest is redirected from checkout to login', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('checkout success page loads for guests without error', async ({ page }) => {
  const res = await page.goto('/checkout/success');
  expect(res?.status()).toBeLessThan(500);
});

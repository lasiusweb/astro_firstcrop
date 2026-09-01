import { test, expect } from '@playwright/test';

test('login page renders phone form', async ({ page }) => {
  await page.goto('/auth/login');
  await expect(page.locator('.auth-title')).toContainText('Login with Phone');
  await expect(page.locator('#phone')).toBeVisible();
  await expect(page.locator('#send-otp-btn')).toBeVisible();
  // OTP form is hidden until a phone number is submitted
  await expect(page.locator('#otp-form')).toBeHidden();
});

test('empty phone submission does not advance to OTP step', async ({ page }) => {
  await page.goto('/auth/login');
  // Native pattern validation blocks submission for an empty/invalid phone
  await page.locator('#send-otp-btn').click();
  await expect(page.locator('#phone-form')).toBeVisible();
  await expect(page.locator('#otp-form')).toBeHidden();
});

test('phone input enforces 10-digit Indian mobile pattern', async ({ page }) => {
  await page.goto('/auth/login');
  const phone = page.locator('#phone');
  await expect(phone).toHaveAttribute('pattern', '[6-9]\\d{9}');
  await expect(phone).toHaveAttribute('maxlength', '10');
  await expect(phone).toHaveAttribute('type', 'tel');
});

test('protected route /checkout redirects guests to login', async ({ page }) => {
  await page.goto('/checkout');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('protected route /account redirects guests to login', async ({ page }) => {
  await page.goto('/account');
  await expect(page).toHaveURL(/\/auth\/login/);
});

test('protected route /account/orders redirects guests to login', async ({ page }) => {
  await page.goto('/account/orders');
  await expect(page).toHaveURL(/\/auth\/login/);
});

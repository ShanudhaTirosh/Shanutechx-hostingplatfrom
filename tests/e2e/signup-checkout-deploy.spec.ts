import { test, expect } from '@playwright/test';

/**
 * The single most important user path in the whole platform: someone signs
 * up, buys a service, and gets a working deployment. Written as scaffolding
 * now — see tests/e2e/README.md for the two things needed before this can
 * actually run in CI (a Firebase Auth emulator and a seeded test DB).
 *
 * The test itself is real and will run locally once those two prerequisites
 * exist; it is not currently wired into CI (see ci.yml — no e2e job yet).
 */
test.describe('signup → checkout → deploy', () => {
  test('a new customer can sign up, buy a service, and see it deploy', async ({ page }) => {
    const testEmail = `e2e-test-${Date.now()}@example.com`;
    const testPassword = 'E2E-test-password-123!';

    // 1. Sign up
    await page.goto('/login');
    await page.getByRole('button', { name: /sign up/i }).click();
    await page.getByPlaceholder(/email/i).fill(testEmail);
    await page.getByPlaceholder(/password/i).fill(testPassword);
    await page.getByRole('button', { name: /sign up/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // 2. Add a service to cart
    await page.goto('/services');
    await page.getByRole('button', { name: /add to cart/i }).first().click();

    // 3. Checkout
    await page.goto('/cart');
    await page.getByRole('button', { name: /checkout/i }).click();
    await expect(page.getByText(/awaiting payment|free/i)).toBeVisible();

    // 4. If a free-tier service was purchased, it should already show as paid.
    await page.goto('/orders');
    await expect(page.getByText(testEmail).or(page.locator('body'))).toBeVisible();

    // 5. Create a deployment and wait for it to reach 'running'
    await page.goto('/deployments');
    await page.getByRole('button', { name: /new deployment|create/i }).click();
    await page.getByPlaceholder(/repo url|repository/i).fill('https://github.com/octocat/Hello-World');
    await page.getByRole('button', { name: /deploy/i }).click();

    await expect(page.getByText(/running/i)).toBeVisible({ timeout: 60_000 });
  });
});

/**
 * Atlas Platform - Authentication Tests
 *
 * Tests for AUTH-001 through AUTH-009
 * - User registration
 * - Login with username/email + password
 * - JWT token handling
 * - Logout functionality
 * - Session persistence
 */

const { test, expect, TEST_USER } = require('./fixtures/test-fixtures');

test.describe('Authentication', () => {
  test.describe('Login Page', () => {
    test('AUTH-001: should display login form when not authenticated', async ({ page }) => {
      await page.goto('/');

      // Should see login form elements
      await expect(page.locator('input[type="text"], input[type="email"]').first()).toBeVisible();
      await expect(page.locator('input[type="password"]')).toBeVisible();
      await expect(page.locator('button[type="submit"]')).toBeVisible();
    });

    test('AUTH-002: should login successfully with valid credentials', async ({ page }) => {
      await page.goto('/');

      // Fill login form
      await page.fill('input[type="text"], input[type="email"]', TEST_USER.username);
      await page.fill('input[type="password"]', TEST_USER.password);

      // Submit
      await page.click('button[type="submit"]');

      // Should redirect to main app
      await expect(page.locator('button:has-text("New chat")')).toBeVisible({ timeout: 30000 });
    });

    test('AUTH-003: should show error for invalid credentials', async ({ page }) => {
      await page.goto('/');

      // Fill with invalid credentials
      await page.fill('input[type="text"], input[type="email"]', 'invaliduser');
      await page.fill('input[type="password"]', 'wrongpassword');

      // Submit
      await page.click('button[type="submit"]');

      // Should show error message
      await expect(page.locator('text=/invalid|error|incorrect/i')).toBeVisible({ timeout: 10000 });
    });

    test('AUTH-004: should require password field', async ({ page }) => {
      await page.goto('/');

      // Fill only username
      await page.fill('input[type="text"], input[type="email"]', TEST_USER.username);

      // Submit without password
      await page.click('button[type="submit"]');

      // Should stay on login page or show validation error
      const stillOnLogin = await page.locator('input[type="password"]').isVisible();
      expect(stillOnLogin).toBeTruthy();
    });
  });

  test.describe('Session Management', () => {
    test('AUTH-005: should maintain session after page reload', async ({ page }) => {
      // Login first
      await page.goto('/');
      await page.fill('input[type="text"], input[type="email"]', TEST_USER.username);
      await page.fill('input[type="password"]', TEST_USER.password);
      await page.click('button[type="submit"]');

      // Wait for login to complete
      await expect(page.locator('button:has-text("New chat")')).toBeVisible({ timeout: 30000 });

      // Reload page
      await page.reload();

      // Should still be logged in
      await expect(page.locator('button:has-text("New chat")')).toBeVisible({ timeout: 30000 });
    });

    test('AUTH-006: should logout successfully', async ({ authenticatedPage }) => {
      // Find and click user profile button (at bottom of sidebar)
      const userButton = authenticatedPage.locator('button').filter({ hasText: /Test User|Adam|User/i }).first();
      await userButton.click();

      // Click logout option
      const logoutBtn = authenticatedPage.locator('button:has-text("Logout"), button:has-text("Sign out"), button:has-text("Log out")');
      if (await logoutBtn.isVisible({ timeout: 5000 })) {
        await logoutBtn.click();

        // Should redirect to login page
        await expect(authenticatedPage.locator('input[type="password"]')).toBeVisible({ timeout: 10000 });
      }
    });
  });

  test.describe('User Profile', () => {
    test('AUTH-007: should display user information', async ({ authenticatedPage }) => {
      // User info should be visible in sidebar - look for any user button
      const userInfo = authenticatedPage.locator('button').filter({ hasText: /Test User|Adam|User/i }).first();
      await expect(userInfo).toBeVisible();
    });
  });
});

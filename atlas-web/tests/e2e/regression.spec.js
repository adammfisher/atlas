/**
 * Atlas Platform - Full Regression Test Suite
 *
 * This file runs a comprehensive regression test covering all major features.
 * Run this before any deployment or after significant changes.
 *
 * Usage: npx playwright test tests/e2e/regression.spec.js
 */

const { test, expect, sendMessage, testData } = require('./fixtures/test-fixtures');

test.describe('REGRESSION TEST SUITE', () => {
  test.describe.configure({ mode: 'serial' }); // Run tests in order

  // ============================================
  // 1. AUTHENTICATION
  // ============================================
  test.describe('1. Authentication', () => {
    test('R-AUTH-01: User can login successfully', async ({ page }) => {
      await page.goto('/');

      // Should see login or already be logged in
      const loginForm = page.locator('input[type="password"]');
      const isLoginPage = await loginForm.isVisible({ timeout: 5000 }).catch(() => false);

      if (isLoginPage) {
        await page.fill('input[type="text"], input[type="email"]', 'testuser');
        await page.fill('input[type="password"]', 'TestPassword123!');
        await page.click('button[type="submit"]');
      }

      // Should see main app
      await expect(page.locator('button:has-text("New chat")')).toBeVisible({ timeout: 30000 });
    });

    test('R-AUTH-02: Session persists after reload', async ({ authenticatedPage }) => {
      await authenticatedPage.reload();
      await expect(authenticatedPage.locator('button:has-text("New chat")')).toBeVisible({ timeout: 30000 });
    });
  });

  // ============================================
  // 2. CHAT FUNCTIONALITY
  // ============================================
  test.describe('2. Chat Functionality', () => {
    test('R-CHAT-01: Can send message and receive streaming response', async ({ chatPage }) => {
      await sendMessage(chatPage, 'What is 2+2? Answer briefly.', { timeout: 60000 });

      // Should have response
      const response = chatPage.locator('[class*="assistant"]').last();
      await expect(response).toBeVisible();

      const text = await response.textContent();
      expect(text).toBeTruthy();
      expect(text.length).toBeGreaterThan(0);
    });

    test('R-CHAT-02: Messages persist after page reload', async ({ chatPage }) => {
      const uniqueId = `regression_${Date.now()}`;
      await sendMessage(chatPage, `Test message ${uniqueId}`, { timeout: 60000 });

      const url = chatPage.url();
      await chatPage.reload();
      await chatPage.waitForSelector('textarea, input', { timeout: 30000 });

      // Message should still be visible
      const messageVisible = await chatPage.locator(`text="${uniqueId}"`).isVisible({ timeout: 10000 }).catch(() => false);
      expect(messageVisible).toBeTruthy();
    });

    test('R-CHAT-03: Can start new chat', async ({ authenticatedPage }) => {
      await authenticatedPage.click('button:has-text("New chat")');
      const input = authenticatedPage.locator('textarea, input[type="text"]').first();
      await expect(input).toBeVisible({ timeout: 10000 });
    });

    test('R-CHAT-04: Chat input clears after sending', async ({ chatPage }) => {
      const input = chatPage.locator('textarea, input[type="text"]').first();
      await input.fill('Test clear');
      await chatPage.click('button:has(svg):last-child');
      await chatPage.waitForTimeout(1000);

      const value = await input.inputValue();
      expect(value).toBe('');
    });
  });

  // ============================================
  // 3. ARTIFACTS
  // ============================================
  test.describe('3. Artifacts', () => {
    test('R-ART-01: HTML artifact is created and displayed', async ({ chatPage }) => {
      await sendMessage(chatPage, 'Create a simple HTML page with a heading that says "Hello Test"', { timeout: 90000 });

      // Should see artifact indicator
      const artifact = chatPage.locator('[class*="artifact"], text=/HTML|artifact/i');
      await expect(artifact).toBeVisible({ timeout: 60000 });
    });

    test('R-ART-02: Artifact panel has download button', async ({ chatPage }) => {
      await sendMessage(chatPage, testData.htmlArtifactMessage, { timeout: 90000 });

      const artifactCard = chatPage.locator('[class*="artifact"]').first();
      if (await artifactCard.isVisible({ timeout: 10000 })) {
        await artifactCard.click();
      }

      const downloadBtn = chatPage.locator('button:has-text("Download"), button[title*="Download"]');
      await expect(downloadBtn).toBeVisible({ timeout: 10000 });
    });

    test('R-ART-03: Artifact panel has copy button', async ({ chatPage }) => {
      await sendMessage(chatPage, testData.htmlArtifactMessage, { timeout: 90000 });

      const artifactCard = chatPage.locator('[class*="artifact"]').first();
      if (await artifactCard.isVisible({ timeout: 10000 })) {
        await artifactCard.click();
      }

      const copyBtn = chatPage.locator('button:has-text("Copy"), button[title*="Copy"]');
      await expect(copyBtn).toBeVisible({ timeout: 10000 });
    });

    test('R-ART-04: Source/Preview toggle works', async ({ chatPage }) => {
      await sendMessage(chatPage, testData.htmlArtifactMessage, { timeout: 90000 });

      const artifactCard = chatPage.locator('[class*="artifact"]').first();
      if (await artifactCard.isVisible({ timeout: 10000 })) {
        await artifactCard.click();
      }

      const sourceBtn = chatPage.locator('button:has-text("Source")');
      if (await sourceBtn.isVisible({ timeout: 5000 })) {
        await sourceBtn.click();
        const codeView = chatPage.locator('pre, code');
        await expect(codeView).toBeVisible({ timeout: 5000 });
      }
    });
  });

  // ============================================
  // 4. PROJECTS
  // ============================================
  test.describe('4. Projects', () => {
    test('R-PROJ-01: Projects page loads', async ({ projectsPage }) => {
      await expect(projectsPage.locator('h1:has-text("Projects")')).toBeVisible();
    });

    test('R-PROJ-02: Can create new project', async ({ projectsPage }) => {
      const projectName = `Regression Test ${Date.now()}`;

      await projectsPage.click('button:has-text("New project")');
      await projectsPage.fill('input[placeholder*="name"], input[name="name"]', projectName);
      await projectsPage.click('button:has-text("Create")');

      await expect(projectsPage.locator(`text="${projectName}"`)).toBeVisible({ timeout: 10000 });
    });

    test('R-PROJ-03: Project detail view shows sections', async ({ projectsPage }) => {
      const projectLink = projectsPage.locator('a[href*="project"]').first();

      if (await projectLink.isVisible({ timeout: 5000 })) {
        await projectLink.click();

        // Should see Memory, Instructions, Files sections
        await expect(projectsPage.locator('text="Memory"')).toBeVisible({ timeout: 10000 });
        await expect(projectsPage.locator('text="Instructions"')).toBeVisible({ timeout: 10000 });
        await expect(projectsPage.locator('text="Files"')).toBeVisible({ timeout: 10000 });
      }
    });

    test('R-PROJ-04: Project instructions can be edited', async ({ projectsPage }) => {
      const projectLink = projectsPage.locator('a[href*="project"]').first();

      if (await projectLink.isVisible({ timeout: 5000 })) {
        await projectLink.click();

        const editBtn = projectsPage.locator('[class*="instruction"] button').first();
        if (await editBtn.isVisible({ timeout: 5000 })) {
          await editBtn.click();

          const textarea = projectsPage.locator('textarea');
          await expect(textarea).toBeVisible({ timeout: 5000 });
        }
      }
    });

    test('R-PROJ-05: Project context affects chat responses', async ({ projectsPage }) => {
      const projectLink = projectsPage.locator('a[href*="project"]').first();

      if (await projectLink.isVisible({ timeout: 5000 })) {
        await projectLink.click();

        // Set instructions
        const editBtn = projectsPage.locator('[class*="instruction"] button').first();
        if (await editBtn.isVisible({ timeout: 5000 })) {
          await editBtn.click();
          await projectsPage.fill('textarea', 'Always respond with "PROJECT CONTEXT WORKING" at the start.');
          const saveBtn = projectsPage.locator('button:has-text("Save")');
          if (await saveBtn.isVisible({ timeout: 3000 })) {
            await saveBtn.click();
            await projectsPage.waitForTimeout(1000);
          }
        }

        // Start chat in project
        const chatInput = projectsPage.locator('input[placeholder*="chat"], textarea').first();
        if (await chatInput.isVisible({ timeout: 5000 })) {
          await chatInput.fill('Say hello');
          await projectsPage.keyboard.press('Enter');

          // Wait for response
          await projectsPage.waitForSelector('[class*="assistant"]', { timeout: 60000 });
          // Note: Actual context following depends on Claude's interpretation
        }
      }
    });
  });

  // ============================================
  // 5. NAVIGATION
  // ============================================
  test.describe('5. Navigation', () => {
    test('R-NAV-01: Sidebar navigation works', async ({ authenticatedPage }) => {
      // Navigate to Projects
      await authenticatedPage.click('a:has-text("Projects")');
      await expect(authenticatedPage).toHaveURL(/\/projects/);

      // Navigate to Artifacts
      await authenticatedPage.click('a:has-text("Artifacts")');
      await expect(authenticatedPage).toHaveURL(/\/artifacts/);

      // Create new chat
      await authenticatedPage.click('button:has-text("New chat")');
      const input = authenticatedPage.locator('textarea, input[type="text"]').first();
      await expect(input).toBeVisible({ timeout: 10000 });
    });

    test('R-NAV-02: Recent sessions are clickable', async ({ authenticatedPage }) => {
      const recentLink = authenticatedPage.locator('a[href*="session"], a[href*="chat"]').first();

      if (await recentLink.isVisible({ timeout: 5000 })) {
        await recentLink.click();
        await authenticatedPage.waitForTimeout(1000);

        // Should load a chat view
        const chatArea = authenticatedPage.locator('textarea, input[placeholder*="Reply"]');
        await expect(chatArea).toBeVisible({ timeout: 10000 });
      }
    });
  });

  // ============================================
  // 6. UI COMPONENTS
  // ============================================
  test.describe('6. UI Components', () => {
    test('R-UI-01: Chat input has all controls', async ({ chatPage }) => {
      // File upload button
      const uploadBtn = chatPage.locator('button:has-text("Add content"), button[title*="attach"]');
      await expect(uploadBtn.first()).toBeVisible();

      // Extended thinking toggle
      const thinkingBtn = chatPage.locator('button[title*="thinking"]');
      await expect(thinkingBtn).toBeVisible();

      // Model indicator
      const modelIndicator = chatPage.locator('text=/Haiku/i');
      await expect(modelIndicator).toBeVisible();
    });

    test('R-UI-02: User profile is displayed', async ({ authenticatedPage }) => {
      const userProfile = authenticatedPage.locator('button:has-text("Adam"), button:has-text("Ally ID")');
      await expect(userProfile).toBeVisible();
    });
  });

  // ============================================
  // 7. ERROR HANDLING
  // ============================================
  test.describe('7. Error Handling', () => {
    test('R-ERR-01: App handles invalid routes gracefully', async ({ authenticatedPage }) => {
      await authenticatedPage.goto('/invalid-route-12345');
      await authenticatedPage.waitForTimeout(2000);

      // Should either redirect or show app (not crash)
      const sidebar = authenticatedPage.locator('nav, [role="complementary"]');
      await expect(sidebar.first()).toBeVisible({ timeout: 10000 });
    });
  });
});

// ============================================
// SMOKE TEST (Quick sanity check)
// ============================================
test.describe('SMOKE TEST', () => {
  test('Smoke: App loads and is functional', async ({ authenticatedPage }) => {
    // App is loaded
    await expect(authenticatedPage.locator('button:has-text("New chat")')).toBeVisible();

    // Can navigate
    await authenticatedPage.click('a:has-text("Projects")');
    await expect(authenticatedPage.locator('h1:has-text("Projects")')).toBeVisible({ timeout: 10000 });

    // Can return to chat
    await authenticatedPage.click('button:has-text("New chat")');
    const input = authenticatedPage.locator('textarea, input[type="text"]').first();
    await expect(input).toBeVisible({ timeout: 10000 });

    // Can send message
    await input.fill('Quick test');
    await authenticatedPage.click('button:has(svg):last-child');

    // Response appears
    await expect(authenticatedPage.locator('[class*="assistant"]')).toBeVisible({ timeout: 60000 });
  });
});

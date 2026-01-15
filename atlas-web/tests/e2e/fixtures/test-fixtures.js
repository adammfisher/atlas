/**
 * Atlas Platform - Test Fixtures
 *
 * Shared test fixtures and utilities for Playwright tests
 */

const { test: base, expect } = require('@playwright/test');

/**
 * Test user credentials
 */
const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'TestPassword123!',
};

/**
 * Extended test fixture with authentication
 */
const test = base.extend({
  /**
   * Authenticated page - logs in before each test
   */
  authenticatedPage: async ({ page }, use) => {
    // Navigate to login
    await page.goto('/');

    // Check if already logged in by looking for the sidebar or chat input
    const isLoggedIn = await page.locator('text="New chat"').isVisible({ timeout: 2000 }).catch(() => false);

    if (!isLoggedIn) {
      // Wait for login form
      await page.waitForSelector('input[type="text"]', { timeout: 10000 });

      // Fill login form
      await page.fill('input[type="text"]', TEST_USER.username);
      await page.fill('input[type="password"]', TEST_USER.password);

      // Submit login
      await page.click('button[type="submit"]');

      // Wait for dashboard to load - look for New chat button or chat input
      await page.waitForSelector('button:has-text("New chat"), textarea', { timeout: 30000 });
    }

    await use(page);
  },

  /**
   * Page with a new chat session
   */
  chatPage: async ({ authenticatedPage }, use) => {
    // Click New Chat button (look for the text "New chat")
    const newChatBtn = authenticatedPage.locator('text="New chat"').first();
    if (await newChatBtn.isVisible({ timeout: 5000 })) {
      await newChatBtn.click();
    }

    // Wait for chat input to be ready - match various placeholder patterns
    await authenticatedPage.waitForSelector('textarea', { timeout: 10000 });

    await use(authenticatedPage);
  },

  /**
   * Page with projects view
   */
  projectsPage: async ({ authenticatedPage }, use) => {
    // Navigate to projects - look for Projects link in sidebar
    const projectsLink = authenticatedPage.locator('text="Projects"').first();
    await projectsLink.click();

    // Wait for projects page to load
    await authenticatedPage.waitForSelector('text=/Projects|Create.*project/i', { timeout: 10000 });

    await use(authenticatedPage);
  },
});

/**
 * Helper to send a chat message and wait for response
 */
async function sendMessage(page, message, options = {}) {
  const { waitForResponse = true, timeout = 60000 } = options;

  // Find and fill the textarea input
  const input = page.locator('textarea').first();
  await input.fill(message);

  // Click send button - has title="Send message"
  const sendButton = page.locator('button[title="Send message"]').first();
  await sendButton.click();

  if (waitForResponse) {
    // Wait for assistant response to appear - look for any response content
    await page.waitForSelector('[class*="prose"], [class*="markdown"], [class*="message"]', { timeout });

    // Wait for streaming to complete - look for the textarea being enabled again
    await page.waitForFunction(() => {
      const textarea = document.querySelector('textarea');
      return textarea && !textarea.disabled;
    }, { timeout });

    // Extra wait for response to fully render
    await page.waitForTimeout(500);
  }
}

/**
 * Helper to wait for artifact panel to open
 */
async function waitForArtifactPanel(page, timeout = 30000) {
  await page.waitForSelector('[class*="artifact"], [data-testid="artifacts-panel"]', { timeout });
}

/**
 * Helper to wait for streaming to complete
 */
async function waitForStreamingComplete(page, timeout = 60000) {
  // Wait for the loading indicator to disappear or send button to be enabled
  await page.waitForFunction(() => {
    // Check if there's no loading spinner
    const spinners = document.querySelectorAll('[class*="animate-spin"], [class*="loading"]');
    if (spinners.length > 0) return false;

    // Check if send button is enabled
    const sendBtn = document.querySelector('button[disabled]');
    return !sendBtn;
  }, { timeout });
}

/**
 * Helper to get the last assistant message content
 */
async function getLastAssistantMessage(page) {
  const messages = await page.locator('[class*="assistant"], [data-role="assistant"]').all();
  if (messages.length === 0) return null;

  const lastMessage = messages[messages.length - 1];
  return await lastMessage.textContent();
}

/**
 * Helper to check if artifact is visible in panel
 */
async function isArtifactVisible(page, title) {
  const artifact = page.locator(`text="${title}"`).first();
  return await artifact.isVisible().catch(() => false);
}

/**
 * Helper to create a new project
 */
async function createProject(page, name, description = '') {
  // Click new project button
  await page.click('button:has-text("New project")');

  // Fill project details
  await page.fill('input[placeholder*="name"], input[name="name"]', name);

  if (description) {
    const descInput = page.locator('textarea[placeholder*="description"], input[placeholder*="description"]');
    if (await descInput.isVisible()) {
      await descInput.fill(description);
    }
  }

  // Submit
  await page.click('button:has-text("Create")');

  // Wait for project to appear
  await page.waitForSelector(`text="${name}"`, { timeout: 10000 });
}

/**
 * Helper to delete a project
 */
async function deleteProject(page, name) {
  // Find project card and hover
  const projectCard = page.locator(`text="${name}"`).first();
  await projectCard.hover();

  // Click delete button
  const deleteBtn = page.locator('button[title*="Delete"], button:has-text("Delete")').first();
  await deleteBtn.click();

  // Confirm deletion if dialog appears
  const confirmBtn = page.locator('button:has-text("Confirm"), button:has-text("Delete")').last();
  if (await confirmBtn.isVisible()) {
    await confirmBtn.click();
  }
}

/**
 * Test data generators
 */
const testData = {
  /**
   * Generate a unique session name
   */
  sessionName: () => `Test Session ${Date.now()}`,

  /**
   * Generate a unique project name
   */
  projectName: () => `Test Project ${Date.now()}`,

  /**
   * Simple chat message
   */
  simpleMessage: 'What is 2 + 2?',

  /**
   * Message that triggers artifact creation (HTML)
   */
  htmlArtifactMessage: 'Create a simple HTML artifact with a button that says "Click Me" with blue background.',

  /**
   * Message that triggers artifact creation (Mermaid)
   */
  mermaidArtifactMessage: 'Create a simple mermaid flowchart showing: Start -> Process -> End',

  /**
   * Message that triggers artifact creation (Markdown)
   */
  markdownArtifactMessage: 'Create a markdown artifact with a simple project README including title, description, and installation steps.',

  /**
   * Message that triggers artifact creation (Code)
   */
  codeArtifactMessage: 'Create a Python code artifact with a function that calculates factorial.',

  /**
   * Message for testing extended thinking
   */
  thinkingMessage: 'Solve this step by step: If I have 3 boxes with 4 apples each, and I give away 5 apples, how many do I have left?',

  /**
   * Message for testing project context
   */
  projectContextMessage: 'What project are we working on?',
};

module.exports = {
  test,
  expect,
  TEST_USER,
  sendMessage,
  waitForArtifactPanel,
  waitForStreamingComplete,
  getLastAssistantMessage,
  isArtifactVisible,
  createProject,
  deleteProject,
  testData,
};

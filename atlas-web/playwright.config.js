// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Atlas Platform - Playwright Test Configuration
 *
 * Run tests with: npm run test:e2e
 * Run specific test: npx playwright test tests/e2e/chat.spec.js
 * Run with UI: npx playwright test --ui
 * Debug mode: npx playwright test --debug
 */

module.exports = defineConfig({
  testDir: './tests/e2e',

  /* Global setup - runs before all tests */
  globalSetup: './tests/e2e/global-setup.js',

  /* Run tests in files in parallel */
  fullyParallel: false, // Disable for stateful tests

  /* Fail the build on CI if you accidentally left test.only in the source code */
  forbidOnly: !!process.env.CI,

  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,

  /* Opt out of parallel tests on CI */
  workers: process.env.CI ? 1 : 1, // Single worker for sequential tests

  /* Reporter to use */
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'playwright-report/results.json' }],
    ['list']
  ],

  /* Output folder for test artifacts (screenshots, videos, traces) */
  outputDir: 'test-results',

  /* Shared settings for all the projects below */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.TEST_BASE_URL || 'http://localhost:3000',

    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',

    /* Screenshot on failure */
    screenshot: 'only-on-failure',

    /* Video on failure */
    video: 'on-first-retry',

    /* Timeout for each action */
    actionTimeout: 30000,

    /* Navigation timeout */
    navigationTimeout: 30000,
  },

  /* Global timeout for each test */
  timeout: 120000, // 2 minutes per test (streaming can be slow)

  /* Expect timeout */
  expect: {
    timeout: 10000,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Uncomment to test on other browsers
    // {
    //   name: 'firefox',
    //   use: { ...devices['Desktop Firefox'] },
    // },
    // {
    //   name: 'webkit',
    //   use: { ...devices['Desktop Safari'] },
    // },
  ],

  /* Run your local dev server before starting the tests */
  webServer: [
    {
      command: 'cd frontend && npm run dev',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
    {
      command: 'node local-server.js',
      url: 'http://localhost:8000/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
    },
  ],
});

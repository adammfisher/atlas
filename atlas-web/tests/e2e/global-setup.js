/**
 * Global setup for Playwright tests
 * Registers test user if not exists
 */

const { request } = require('@playwright/test');

const TEST_USER = {
  username: 'testuser',
  email: 'testuser@example.com',
  password: 'TestPassword123!',
};

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:8000';

async function globalSetup() {
  console.log('[Setup] Creating test user if not exists...');

  const context = await request.newContext({
    baseURL: BASE_URL,
  });

  try {
    // Try to register the test user
    const response = await context.post('/api/auth/register', {
      data: TEST_USER,
    });

    if (response.ok()) {
      console.log('[Setup] Test user created successfully');
    } else {
      const body = await response.text();
      // User may already exist, which is fine
      if (body.includes('already exists') || body.includes('duplicate')) {
        console.log('[Setup] Test user already exists');
      } else {
        console.log('[Setup] Registration response:', response.status(), body);
      }
    }
  } catch (error) {
    console.log('[Setup] Registration failed (user may already exist):', error.message);
  }

  // Verify user can login
  try {
    const loginResponse = await context.post('/api/auth/login', {
      data: {
        username: TEST_USER.username,
        password: TEST_USER.password,
      },
    });

    if (loginResponse.ok()) {
      console.log('[Setup] Test user login verified');
    } else {
      console.log('[Setup] Test user login failed:', await loginResponse.text());
    }
  } catch (error) {
    console.log('[Setup] Login verification failed:', error.message);
  }

  await context.dispose();
}

module.exports = globalSetup;

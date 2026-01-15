/**
 * Authentication service
 * Handles login, logout, and session management
 */

const API_BASE = import.meta.env.VITE_API_URL || '';
const AUTH_TOKEN_KEY = 'atlas_auth_token';

/**
 * Store auth token for cross-domain requests (Lambda Function URL)
 * @param {string} token - JWT token
 */
export function setAuthToken(token) {
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
  } else {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }
}

/**
 * Get stored auth token
 * @returns {string|null}
 */
export function getAuthToken() {
  return localStorage.getItem(AUTH_TOKEN_KEY);
}

/**
 * Clear stored auth token
 */
export function clearAuthToken() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
}

/**
 * Login with username and password
 * @param {string} username
 * @param {string} password
 * @returns {Promise<{user: Object}>}
 */
export async function login(username, password) {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ username, password })
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Invalid credentials');
  }

  const data = await res.json();

  // Store token for cross-domain requests to Lambda Function URL
  if (data.token) {
    setAuthToken(data.token);
  }

  return data;
}

/**
 * Logout current user
 */
export async function logout() {
  // Clear stored token
  clearAuthToken();

  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include'
  });
}

/**
 * Get current authenticated user
 * @returns {Promise<Object|null>} User object or null if not authenticated
 */
export async function getCurrentUser() {
  try {
    const res = await fetch(`${API_BASE}/api/auth/me`, {
      credentials: 'include'
    });

    if (!res.ok) {
      return null;
    }

    const data = await res.json();
    return data.user;
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Register a new user (admin only)
 * @param {Object} userData
 * @returns {Promise<{user: Object}>}
 */
export async function registerUser(userData) {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(userData)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to register user');
  }

  return res.json();
}

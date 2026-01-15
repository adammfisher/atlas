/**
 * Authentication middleware for JWT validation
 * Extracts and validates JWT from httpOnly cookie
 */
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;

/**
 * Extract JWT token from request
 * Handles:
 * 1. Authorization: Bearer <token> header (works cross-domain for Lambda Function URL)
 * 2. API Gateway v2 cookies array
 * 3. API Gateway v1 headers.cookie
 * @param {Object} event - Lambda event object
 * @returns {string|null} JWT token or null if not found
 */
function extractToken(event) {
  // First check Authorization header (works cross-domain)
  const authHeader = event.headers?.authorization || event.headers?.Authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return authHeader.substring(7);
  }

  // API Gateway HTTP API v2 puts cookies in an array
  if (event.cookies && Array.isArray(event.cookies)) {
    for (const cookie of event.cookies) {
      if (cookie.startsWith('atlas_session=')) {
        return cookie.substring('atlas_session='.length);
      }
    }
  }

  // API Gateway REST API v1 puts cookies in headers
  const cookies = event.headers?.cookie || event.headers?.Cookie || '';
  const tokenMatch = cookies.match(/atlas_session=([^;]+)/);
  return tokenMatch ? tokenMatch[1] : null;
}

/**
 * Authenticate request by validating JWT from cookie
 * @param {Object} event - Lambda event object
 * @returns {Object} User object with userId, username, role
 * @throws {Error} If authentication fails
 */
function authenticateRequest(event) {
  const token = extractToken(event);

  if (!token) {
    const error = new Error('Authentication required');
    error.statusCode = 401;
    throw error;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    return {
      userId: decoded.sub,
      username: decoded.username,
      role: decoded.role
    };
  } catch (err) {
    const error = new Error('Invalid or expired token');
    error.statusCode = 401;
    throw error;
  }
}

/**
 * Require admin role
 * @param {Object} user - User object from authenticateRequest
 * @throws {Error} If user is not admin
 */
function requireAdmin(user) {
  if (user.role !== 'admin') {
    const error = new Error('Admin access required');
    error.statusCode = 403;
    throw error;
  }
}

/**
 * Create auth error response
 * @param {Error} error - Error object
 * @returns {Object} Lambda response object
 */
function authErrorResponse(error) {
  return {
    statusCode: error.statusCode || 500,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify({ error: error.message })
  };
}

module.exports = {
  authenticateRequest,
  requireAdmin,
  authErrorResponse
};

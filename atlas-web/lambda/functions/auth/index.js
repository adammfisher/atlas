/**
 * Auth Lambda function
 * Handles login, logout, session validation, and user registration
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, PutCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { nanoid } = require('nanoid');

const client = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(client);

const USERS_TABLE = process.env.USERS_TABLE;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRY = '10h'; // 10 hours
const COOKIE_MAX_AGE = 36000; // 10 hours in seconds
const BCRYPT_ROUNDS = 12;

/**
 * Standard JSON response with CORS headers
 */
function jsonResponse(statusCode, body, cookies = null) {
  const response = {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': process.env.CORS_ORIGIN || '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Credentials': 'true'
    },
    body: JSON.stringify(body)
  };

  if (cookies) {
    response.cookies = cookies;
  }

  return response;
}

/**
 * Create JWT token for user
 */
function createToken(user) {
  return jwt.sign(
    {
      sub: user.userId,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRY }
  );
}

/**
 * Create session cookie string
 * For cross-origin (CloudFront -> API Gateway), we need SameSite=None; Secure
 */
function createSessionCookie(token, isProduction = true) {
  if (isProduction) {
    // Cross-origin requires SameSite=None with Secure
    return `atlas_session=${token}; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
  }
  // Local development (same origin)
  return `atlas_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${COOKIE_MAX_AGE}`;
}

/**
 * Create logout cookie (expires immediately)
 */
function createLogoutCookie() {
  return 'atlas_session=; HttpOnly; Secure; SameSite=None; Path=/; Max-Age=0';
}

/**
 * Extract JWT from cookie header
 * Handles both API Gateway v1 (headers.cookie) and v2 (cookies array) formats
 */
function extractTokenFromCookie(event) {
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
 * Verify JWT and return decoded payload
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return null;
  }
}

/**
 * Lookup user by username using GSI
 */
async function getUserByUsername(username) {
  const result = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'username-index',
    KeyConditionExpression: 'username = :username',
    ExpressionAttributeValues: { ':username': username }
  }));
  return result.Items?.[0] || null;
}

/**
 * Lookup user by email using GSI
 */
async function getUserByEmail(email) {
  const result = await docClient.send(new QueryCommand({
    TableName: USERS_TABLE,
    IndexName: 'email-index',
    KeyConditionExpression: 'email = :email',
    ExpressionAttributeValues: { ':email': email }
  }));
  return result.Items?.[0] || null;
}

/**
 * Get user by userId (primary key)
 */
async function getUserById(userId) {
  const result = await docClient.send(new GetCommand({
    TableName: USERS_TABLE,
    Key: { userId }
  }));
  return result.Item || null;
}

/**
 * Parse request body (handling base64 encoding from API Gateway)
 */
function parseBody(event) {
  let body = event.body || '{}';

  console.log('parseBody input:', {
    body: body?.substring?.(0, 100),
    isBase64Encoded: event.isBase64Encoded,
    bodyType: typeof body
  });

  // Handle base64 encoding from API Gateway v2
  if (event.isBase64Encoded && body) {
    body = Buffer.from(body, 'base64').toString('utf8');
    console.log('Decoded base64 body:', body?.substring?.(0, 100));
  }

  try {
    const parsed = JSON.parse(body);
    console.log('Parsed body successfully');
    return parsed;
  } catch (e) {
    console.log('JSON parse error:', e.message, 'body was:', body);
    return null;
  }
}

/**
 * Handle POST /api/auth/login
 */
async function handleLogin(event) {
  const body = parseBody(event);

  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { username, password } = body;

  if (!username || !password) {
    return jsonResponse(400, { error: 'Username and password are required' });
  }

  // Lookup user by username
  const user = await getUserByUsername(username);

  // Always do password comparison even if user not found (timing attack prevention)
  const dummyHash = '$2a$12$dummy.hash.for.timing.attack.prevention';
  const hashToCompare = user?.passwordHash || dummyHash;
  const passwordValid = await bcrypt.compare(password, hashToCompare);

  if (!user || !passwordValid) {
    // Generic error message (don't reveal if user exists)
    return jsonResponse(401, { error: 'Invalid credentials' });
  }

  // Create JWT token
  const token = createToken(user);
  const isProduction = process.env.AWS_EXECUTION_ENV !== undefined;
  const cookie = createSessionCookie(token, isProduction);

  console.log('Login successful for user:', user.username);

  return jsonResponse(200, {
    user: {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    },
    // Include token in response for cross-domain Lambda Function URL auth
    token
  }, [cookie]);
}

/**
 * Handle POST /api/auth/logout
 */
async function handleLogout(event) {
  const cookie = createLogoutCookie();
  return jsonResponse(200, { success: true }, [cookie]);
}

/**
 * Handle GET /api/auth/me
 */
async function handleGetCurrentUser(event) {
  const token = extractTokenFromCookie(event);

  if (!token) {
    return jsonResponse(401, { error: 'Not authenticated' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }

  // Fetch fresh user data from database
  const user = await getUserById(decoded.sub);

  if (!user) {
    return jsonResponse(401, { error: 'User not found' });
  }

  return jsonResponse(200, {
    user: {
      userId: user.userId,
      username: user.username,
      displayName: user.displayName,
      role: user.role
    }
  });
}

/**
 * Handle POST /api/auth/register (admin only)
 */
async function handleRegister(event) {
  // Verify admin access
  const token = extractTokenFromCookie(event);

  if (!token) {
    return jsonResponse(401, { error: 'Authentication required' });
  }

  const decoded = verifyToken(token);

  if (!decoded) {
    return jsonResponse(401, { error: 'Invalid or expired token' });
  }

  if (decoded.role !== 'admin') {
    return jsonResponse(403, { error: 'Admin access required' });
  }

  // Parse request body
  const body = parseBody(event);

  if (!body) {
    return jsonResponse(400, { error: 'Invalid JSON body' });
  }

  const { username, email, password, displayName, role = 'user' } = body;

  // Validate required fields
  if (!username || !email || !password || !displayName) {
    return jsonResponse(400, { error: 'Username, email, password, and displayName are required' });
  }

  // Validate password length
  if (password.length < 8) {
    return jsonResponse(400, { error: 'Password must be at least 8 characters' });
  }

  // Validate role
  if (role !== 'admin' && role !== 'user') {
    return jsonResponse(400, { error: 'Role must be "admin" or "user"' });
  }

  // Check username uniqueness
  const existingByUsername = await getUserByUsername(username);
  if (existingByUsername) {
    return jsonResponse(400, { error: 'Username already exists' });
  }

  // Check email uniqueness
  const existingByEmail = await getUserByEmail(email);
  if (existingByEmail) {
    return jsonResponse(400, { error: 'Email already exists' });
  }

  // Hash password
  const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

  // Generate userId
  const userId = `usr_${nanoid(12)}`;
  const now = Date.now();

  // Create user
  await docClient.send(new PutCommand({
    TableName: USERS_TABLE,
    Item: {
      userId,
      username,
      email,
      passwordHash,
      displayName,
      role,
      createdAt: now,
      updatedAt: now
    }
  }));

  console.log('User created:', { userId, username, role });

  return jsonResponse(201, {
    user: {
      userId,
      username,
      displayName,
      role
    }
  });
}

/**
 * Main handler - routes to appropriate function
 */
exports.handler = async (event, context) => {
  console.log('Auth event:', JSON.stringify({
    method: event.requestContext?.http?.method || event.httpMethod,
    path: event.requestContext?.http?.path || event.path
  }));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;

  // Handle OPTIONS for CORS preflight
  if (method === 'OPTIONS') {
    return jsonResponse(200, {});
  }

  try {
    // Route to appropriate handler
    if (method === 'POST' && path.endsWith('/login')) {
      return handleLogin(event);
    }

    if (method === 'POST' && path.endsWith('/logout')) {
      return handleLogout(event);
    }

    if (method === 'GET' && path.endsWith('/me')) {
      return handleGetCurrentUser(event);
    }

    if (method === 'POST' && path.endsWith('/register')) {
      return handleRegister(event);
    }

    return jsonResponse(404, { error: 'Not found' });
  } catch (error) {
    console.error('Auth error:', error);
    return jsonResponse(500, { error: 'Internal server error' });
  }
};

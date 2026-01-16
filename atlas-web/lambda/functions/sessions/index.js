const { getItem, putItem, updateItem, deleteItem, queryItems, batchDeleteItems } = require('./shared/dynamodb');
const { deleteObject } = require('./shared/s3');
const {
  success,
  created,
  noContent,
  badRequest,
  notFound,
  serverError,
  parseBody,
  getPathParam
} = require('./shared/response');
const { authenticateRequest, authErrorResponse } = require('./shared/authMiddleware');

// Try to load vectors module for memory deletion (optional - may not be available in all deployments)
let vectorsModule = null;
try {
  vectorsModule = require('/opt/nodejs/shared/vectors');
} catch (e) {
  console.log('[Sessions] Vectors module not available - memory cleanup will be skipped');
}

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Sessions event:', JSON.stringify(event));

  // Authenticate request
  let user;
  try {
    user = authenticateRequest(event);
  } catch (error) {
    return authErrorResponse(error);
  }

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const sessionId = getPathParam(event, 'sessionId');

  try {
    // Route based on method and path
    if (method === 'GET' && path.endsWith('/messages')) {
      return getSessionMessages(user.userId, sessionId);
    } else if (method === 'GET' && sessionId) {
      return getSession(user.userId, sessionId);
    } else if (method === 'GET') {
      return listSessions(user.userId);
    } else if (method === 'POST') {
      return createSession(user.userId, event);
    } else if (method === 'PUT' && sessionId) {
      return updateSession(user.userId, sessionId, event);
    } else if (method === 'DELETE' && sessionId) {
      return deleteSession(user.userId, sessionId);
    }

    return badRequest('Invalid route');
  } catch (error) {
    console.error('Sessions error:', error);
    return serverError(error.message);
  }
};

// Special value for sessions not associated with a project (for GSI compatibility)
const GLOBAL_SESSION_MARKER = '__GLOBAL__';

/**
 * List all sessions for user
 */
async function listSessions(userId) {
  const sessions = await queryItems(SESSIONS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  }, {
    indexName: 'userId-updatedAt-index',
    ascending: false
  });

  return success({
    sessions: sessions.map(s => ({
      id: s.sessionId,
      title: s.title,
      starred: s.starred || false,
      // Convert marker back to null for API response
      projectId: s.projectId === GLOBAL_SESSION_MARKER ? null : s.projectId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  });
}

/**
 * Get a single session
 */
async function getSession(userId, sessionId) {
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId });

  if (!session) {
    return notFound('Session not found');
  }

  return success({
    id: session.sessionId,
    title: session.title,
    starred: session.starred || false,
    // Convert marker back to null for API response
    projectId: session.projectId === GLOBAL_SESSION_MARKER ? null : session.projectId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
}

/**
 * Get messages for a session
 */
async function getSessionMessages(userId, sessionId) {
  // Verify session belongs to user
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId });
  if (!session) {
    return notFound('Session not found');
  }
  
  const messages = await queryItems(MESSAGES_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': sessionId }
  });
  
  return success({
    sessionId,
    messages: messages.map(m => ({
      id: m.messageId,
      role: m.role,
      content: m.content,
      thinking: m.thinking || null,
      files: m.files || [],
      timestamp: m.timestamp
    }))
  });
}

/**
 * Create a new session
 */
async function createSession(userId, event) {
  const body = parseBody(event);

  const sessionId = `session_${Date.now()}`;
  const now = Date.now();

  // Use special marker for global sessions (GSI requires non-null string for projectId)
  const projectId = body.projectId || GLOBAL_SESSION_MARKER;

  const session = {
    userId,
    sessionId,
    title: body.title || null,
    starred: false,
    projectId,
    createdAt: now,
    updatedAt: now
  };

  await putItem(SESSIONS_TABLE, session);

  // Return null for projectId if it's a global session (for API consistency)
  return created({
    id: session.sessionId,
    title: session.title,
    starred: session.starred,
    projectId: projectId === GLOBAL_SESSION_MARKER ? null : projectId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
}

/**
 * Update a session
 */
async function updateSession(userId, sessionId, event) {
  const body = parseBody(event);

  // Verify session exists
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId });
  if (!session) {
    return notFound('Session not found');
  }

  // Build updates
  const updates = { updatedAt: Date.now() };

  if (body.title !== undefined) {
    updates.title = body.title;
  }
  if (body.starred !== undefined) {
    updates.starred = body.starred;
  }
  if (body.projectId !== undefined) {
    // Use marker for null projectId
    updates.projectId = body.projectId || GLOBAL_SESSION_MARKER;
  }

  const updated = await updateItem(SESSIONS_TABLE, { userId, sessionId }, updates);

  return success({
    id: updated.sessionId,
    title: updated.title,
    starred: updated.starred,
    // Convert marker back to null for API response
    projectId: updated.projectId === GLOBAL_SESSION_MARKER ? null : updated.projectId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

/**
 * Delete a session and its messages, artifacts (from DynamoDB and S3), and memory vectors
 */
async function deleteSession(userId, sessionId) {
  // Verify session exists
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId });
  if (!session) {
    return notFound('Session not found');
  }

  // Get all messages for this session
  const messages = await queryItems(MESSAGES_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': sessionId }
  });

  // Delete all messages
  if (messages.length > 0) {
    const messageKeys = messages.map(m => ({
      sessionId: m.sessionId,
      messageId: m.messageId
    }));
    await batchDeleteItems(MESSAGES_TABLE, messageKeys);
  }

  // Get all artifacts for this session
  const artifacts = await queryItems(ARTIFACTS_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': sessionId }
  });

  // Delete artifact content from S3 and metadata from DynamoDB
  if (artifacts.length > 0) {
    // Delete from S3 first
    for (const artifact of artifacts) {
      if (artifact.s3Key && ARTIFACTS_BUCKET) {
        try {
          await deleteObject(ARTIFACTS_BUCKET, artifact.s3Key);
          console.log(`Deleted S3 object: ${artifact.s3Key}`);
        } catch (e) {
          console.error(`Failed to delete S3 object ${artifact.s3Key}:`, e);
          // Continue even if S3 delete fails
        }
      }
    }

    // Delete from DynamoDB
    const artifactKeys = artifacts.map(a => ({
      sessionId: a.sessionId,
      artifactId: a.artifactId
    }));
    await batchDeleteItems(ARTIFACTS_TABLE, artifactKeys);
    console.log(`Deleted ${artifacts.length} artifacts from DynamoDB`);
  }

  // Delete memory vectors associated with this session
  if (vectorsModule) {
    try {
      const projectId = session.projectId;
      if (projectId && projectId !== GLOBAL_SESSION_MARKER) {
        // Project session - delete from project indexes
        console.log(`Deleting project memory vectors for session ${sessionId}`);
        await vectorsModule.deleteSessionVectors(userId, projectId, sessionId);
        console.log(`Deleted project memory vectors for session ${sessionId}`);
      } else {
        // Global session - delete from global indexes
        console.log(`Deleting global memory vectors for session ${sessionId}`);
        await vectorsModule.deleteSessionGlobalData(userId, sessionId);
        console.log(`Deleted global memory vectors for session ${sessionId}`);
      }
    } catch (e) {
      console.error(`Failed to delete memory vectors for session ${sessionId}:`, e);
      // Continue even if vector deletion fails - don't block session deletion
    }
  } else {
    console.log(`[Sessions] Skipping memory vector cleanup - vectors module not available`);
  }

  // Delete session
  await deleteItem(SESSIONS_TABLE, { userId, sessionId });
  console.log(`Deleted session: ${sessionId}`);

  return noContent();
}

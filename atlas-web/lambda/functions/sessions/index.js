const { getItem, putItem, updateItem, deleteItem, queryItems, batchDeleteItems } = require('./shared/dynamodb');
const { deleteObject } = require('./shared/s3');
const {
  success,
  created,
  noContent,
  badRequest,
  notFound,
  serverError,
  getUserId,
  parseBody,
  getPathParam
} = require('./shared/response');

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Sessions event:', JSON.stringify(event));
  
  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const sessionId = getPathParam(event, 'sessionId');
  
  try {
    // Route based on method and path
    if (method === 'GET' && path.endsWith('/messages')) {
      return getSessionMessages(event, sessionId);
    } else if (method === 'GET' && sessionId) {
      return getSession(event, sessionId);
    } else if (method === 'GET') {
      return listSessions(event);
    } else if (method === 'POST') {
      return createSession(event);
    } else if (method === 'PUT' && sessionId) {
      return updateSession(event, sessionId);
    } else if (method === 'DELETE' && sessionId) {
      return deleteSession(event, sessionId);
    }
    
    return badRequest('Invalid route');
  } catch (error) {
    console.error('Sessions error:', error);
    return serverError(error.message);
  }
};

/**
 * List all sessions for user
 */
async function listSessions(event) {
  const userId = getUserId(event);
  
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
      projectId: s.projectId,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  });
}

/**
 * Get a single session
 */
async function getSession(event, sessionId) {
  const userId = getUserId(event);
  
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId });
  
  if (!session) {
    return notFound('Session not found');
  }
  
  return success({
    id: session.sessionId,
    title: session.title,
    starred: session.starred || false,
    projectId: session.projectId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
}

/**
 * Get messages for a session
 */
async function getSessionMessages(event, sessionId) {
  const userId = getUserId(event);
  
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
async function createSession(event) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  const sessionId = `session_${Date.now()}`;
  const now = Date.now();
  
  const session = {
    userId,
    sessionId,
    title: body.title || null,
    starred: false,
    projectId: body.projectId || null,
    createdAt: now,
    updatedAt: now
  };
  
  await putItem(SESSIONS_TABLE, session);
  
  return created({
    id: session.sessionId,
    title: session.title,
    starred: session.starred,
    projectId: session.projectId,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt
  });
}

/**
 * Update a session
 */
async function updateSession(event, sessionId) {
  const userId = getUserId(event);
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
    updates.projectId = body.projectId;
  }
  
  const updated = await updateItem(SESSIONS_TABLE, { userId, sessionId }, updates);
  
  return success({
    id: updated.sessionId,
    title: updated.title,
    starred: updated.starred,
    projectId: updated.projectId,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

/**
 * Delete a session and its messages, artifacts (from DynamoDB and S3)
 */
async function deleteSession(event, sessionId) {
  const userId = getUserId(event);

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

  // Delete session
  await deleteItem(SESSIONS_TABLE, { userId, sessionId });
  console.log(`Deleted session: ${sessionId}`);

  return noContent();
}

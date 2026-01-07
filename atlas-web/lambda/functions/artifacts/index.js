const { getItem, putItem, queryItems, deleteItem, updateItem } = require('./shared/dynamodb');
const { getDownloadUrl, getContent, uploadContent, deleteContent } = require('./shared/s3');
const {
  success,
  badRequest,
  notFound,
  serverError,
  getUserId,
  getPathParam,
  getQueryParam,
  parseBody
} = require('./shared/response');

const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

// Artifact type configurations
const ARTIFACT_TYPES = {
  '.md': { category: 'document', contentType: 'text/markdown', renderable: true },
  '.html': { category: 'ui', contentType: 'text/html', renderable: true },
  '.svg': { category: 'diagram', contentType: 'image/svg+xml', renderable: true },
  '.jsx': { category: 'react', contentType: 'text/javascript', renderable: true },
  '.mermaid': { category: 'diagram', contentType: 'text/plain', renderable: true },
  '.json': { category: 'data', contentType: 'application/json', renderable: true },
  '.csv': { category: 'data', contentType: 'text/csv', renderable: true },
  '.py': { category: 'code', contentType: 'text/x-python', renderable: false },
  '.js': { category: 'code', contentType: 'text/javascript', renderable: false },
  '.ts': { category: 'code', contentType: 'text/typescript', renderable: false },
  '.yaml': { category: 'config', contentType: 'text/yaml', renderable: false },
  '.sql': { category: 'code', contentType: 'text/x-sql', renderable: false },
  '.sh': { category: 'code', contentType: 'text/x-shellscript', renderable: false },
  '.txt': { category: 'document', contentType: 'text/plain', renderable: false }
};

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Artifacts event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const userId = getUserId(event);

  try {
    // Route based on path and method
    // POST /api/artifacts - Create artifact
    if (method === 'POST' && path.endsWith('/artifacts')) {
      return createArtifact(event, userId);
    }

    // GET /api/sessions/{sessionId}/artifacts - List session artifacts
    const sessionIdMatch = path.match(/\/sessions\/([^\/]+)\/artifacts$/);
    if (method === 'GET' && sessionIdMatch) {
      return listSessionArtifacts(event, sessionIdMatch[1]);
    }

    // GET /api/artifacts/{artifactId} - Get single artifact
    const artifactIdMatch = path.match(/\/artifacts\/([^\/]+)$/);
    if (method === 'GET' && artifactIdMatch && !path.includes('/sessions/')) {
      return getArtifact(event, artifactIdMatch[1]);
    }

    // GET /api/artifacts/{artifactId}/content - Get artifact content
    if (method === 'GET' && path.endsWith('/content')) {
      const id = path.match(/\/artifacts\/([^\/]+)\/content$/)?.[1];
      if (id) return getArtifactContent(event, id);
    }

    // PATCH /api/artifacts/{artifactId} - Update artifact
    if (method === 'PATCH' && artifactIdMatch) {
      return updateArtifact(event, userId, artifactIdMatch[1]);
    }

    // DELETE /api/artifacts/{artifactId} - Delete artifact
    if (method === 'DELETE' && artifactIdMatch) {
      return deleteArtifact(event, userId, artifactIdMatch[1]);
    }

    // GET /api/artifacts - List all artifacts (with filters)
    if (method === 'GET' && path.endsWith('/artifacts')) {
      return listAllArtifacts(event, userId);
    }

    return badRequest('Invalid route');
  } catch (error) {
    console.error('Artifacts error:', error);
    return serverError(error.message);
  }
};

/**
 * Create a new artifact
 */
async function createArtifact(event, userId) {
  const body = parseBody(event);

  const {
    session_id: sessionId,
    title,
    content,
    file_extension: fileExtension,
    description,
    tags = [],
    visibility = 'private',
    metadata = {}
  } = body;

  if (!sessionId || !title || !content || !fileExtension) {
    return badRequest('session_id, title, content, and file_extension are required');
  }

  // Validate file extension
  const typeConfig = ARTIFACT_TYPES[fileExtension];
  if (!typeConfig) {
    return badRequest(`Unsupported file extension: ${fileExtension}`);
  }

  // Generate artifact ID
  const artifactId = `art_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const s3Key = `${userId}/${sessionId}/${artifactId}${fileExtension}`;

  // Upload content to S3
  await uploadContent(ARTIFACTS_BUCKET, s3Key, content, typeConfig.contentType);

  // Store metadata in DynamoDB
  const artifact = {
    sessionId,
    artifactId,
    userId,
    title,
    name: `${title}${fileExtension}`,
    fileExtension,
    type: typeConfig.category,
    contentType: typeConfig.contentType,
    renderable: typeConfig.renderable,
    s3Key,
    description: description || null,
    tags,
    visibility,
    metadata,
    version: 1,
    size: Buffer.byteLength(content, 'utf8'),
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await putItem(ARTIFACTS_TABLE, artifact);

  // Generate URLs
  const downloadUrl = await getDownloadUrl(ARTIFACTS_BUCKET, s3Key, 3600, artifact.name);

  return success({
    artifact_id: artifactId,
    session_id: sessionId,
    s3_key: s3Key,
    download_url: downloadUrl,
    render_url: `/api/artifacts/${artifactId}/content?sessionId=${sessionId}`,
    version: 1,
    created_at: new Date(artifact.createdAt).toISOString()
  }, 201);
}

/**
 * List all artifacts for a user (with optional filters)
 */
async function listAllArtifacts(event, userId) {
  const sessionId = getQueryParam(event, 'session_id');
  const category = getQueryParam(event, 'type');
  const fileExtension = getQueryParam(event, 'file_extension');
  const limit = parseInt(getQueryParam(event, 'limit', '50'));
  const visibility = getQueryParam(event, 'visibility');

  // If sessionId provided, filter by session
  if (sessionId) {
    return listSessionArtifacts(event, sessionId);
  }

  // For now, require sessionId - in production you'd have a GSI on userId
  return success({
    artifacts: [],
    total: 0,
    message: 'Use session_id query parameter to filter artifacts'
  });
}

/**
 * List artifacts for a session
 */
async function listSessionArtifacts(event, sessionId) {
  const artifacts = await queryItems(ARTIFACTS_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': sessionId }
  });

  // Sort by createdAt descending
  artifacts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  // Generate download URLs for each artifact
  const artifactsWithUrls = await Promise.all(
    artifacts.map(async (artifact) => {
      let downloadUrl = null;
      try {
        downloadUrl = await getDownloadUrl(ARTIFACTS_BUCKET, artifact.s3Key, 3600, artifact.name);
      } catch (e) {
        console.error(`Failed to generate URL for ${artifact.s3Key}:`, e);
      }

      return {
        id: artifact.artifactId,
        session_id: artifact.sessionId,
        title: artifact.title,
        name: artifact.name,
        type: artifact.type,
        file_extension: artifact.fileExtension,
        content_type: artifact.contentType,
        renderable: artifact.renderable,
        description: artifact.description,
        tags: artifact.tags || [],
        version: artifact.version || 1,
        size: artifact.size,
        download_url: downloadUrl,
        render_url: `/api/artifacts/${artifact.artifactId}/content?sessionId=${artifact.sessionId}`,
        created_at: artifact.createdAt ? new Date(artifact.createdAt).toISOString() : null,
        updated_at: artifact.updatedAt ? new Date(artifact.updatedAt).toISOString() : null
      };
    })
  );

  return success({
    session_id: sessionId,
    artifacts: artifactsWithUrls,
    total: artifactsWithUrls.length
  });
}

/**
 * Get a single artifact with metadata and URLs
 */
async function getArtifact(event, artifactId) {
  const sessionId = getQueryParam(event, 'sessionId') || getQueryParam(event, 'session_id');

  if (!sessionId) {
    return badRequest('session_id query parameter is required');
  }

  const artifact = await getItem(ARTIFACTS_TABLE, { sessionId, artifactId });

  if (!artifact) {
    return notFound('Artifact not found');
  }

  // Generate download URL
  let downloadUrl = null;
  try {
    downloadUrl = await getDownloadUrl(ARTIFACTS_BUCKET, artifact.s3Key, 3600, artifact.name);
  } catch (e) {
    console.error(`Failed to generate URL for ${artifact.s3Key}:`, e);
  }

  return success({
    id: artifact.artifactId,
    session_id: artifact.sessionId,
    title: artifact.title,
    name: artifact.name,
    type: artifact.type,
    file_extension: artifact.fileExtension,
    content_type: artifact.contentType,
    renderable: artifact.renderable,
    description: artifact.description,
    tags: artifact.tags || [],
    metadata: artifact.metadata || {},
    version: artifact.version || 1,
    size: artifact.size,
    download_url: downloadUrl,
    render_url: `/api/artifacts/${artifact.artifactId}/content?sessionId=${artifact.sessionId}`,
    created_at: artifact.createdAt ? new Date(artifact.createdAt).toISOString() : null,
    updated_at: artifact.updatedAt ? new Date(artifact.updatedAt).toISOString() : null
  });
}

/**
 * Get artifact content (for rendering)
 */
async function getArtifactContent(event, artifactId) {
  const sessionId = getQueryParam(event, 'sessionId') || getQueryParam(event, 'session_id');

  if (!sessionId) {
    return badRequest('session_id query parameter is required');
  }

  const artifact = await getItem(ARTIFACTS_TABLE, { sessionId, artifactId });

  if (!artifact) {
    return notFound('Artifact not found');
  }

  // Get content from S3
  let content;
  try {
    const result = await getContent(ARTIFACTS_BUCKET, artifact.s3Key);
    content = result.content;
  } catch (e) {
    console.error(`Failed to get content for ${artifact.s3Key}:`, e);
    return serverError('Failed to retrieve artifact content');
  }

  return {
    statusCode: 200,
    headers: {
      'Content-Type': artifact.contentType || 'text/plain',
      'Content-Disposition': `inline; filename="${artifact.name}"`,
      'Cache-Control': 'private, max-age=3600',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type,X-User-Id'
    },
    body: content,
    isBase64Encoded: false
  };
}

/**
 * Update artifact (content and/or metadata)
 */
async function updateArtifact(event, userId, artifactId) {
  const body = parseBody(event);
  const sessionId = body.session_id || getQueryParam(event, 'sessionId');

  if (!sessionId) {
    return badRequest('session_id is required');
  }

  const artifact = await getItem(ARTIFACTS_TABLE, { sessionId, artifactId });

  if (!artifact) {
    return notFound('Artifact not found');
  }

  // Check ownership
  if (artifact.userId !== userId) {
    return badRequest('Not authorized to update this artifact');
  }

  const updates = {};

  // Update content if provided
  if (body.content) {
    const typeConfig = ARTIFACT_TYPES[artifact.fileExtension];
    await uploadContent(ARTIFACTS_BUCKET, artifact.s3Key, body.content, typeConfig?.contentType || 'text/plain');
    updates.size = Buffer.byteLength(body.content, 'utf8');
    updates.version = (artifact.version || 1) + 1;
  }

  // Update metadata fields
  if (body.title) updates.title = body.title;
  if (body.description !== undefined) updates.description = body.description;
  if (body.tags) updates.tags = body.tags;
  if (body.visibility) updates.visibility = body.visibility;
  if (body.metadata) updates.metadata = { ...artifact.metadata, ...body.metadata };

  updates.updatedAt = Date.now();

  await updateItem(ARTIFACTS_TABLE, { sessionId, artifactId }, updates);

  return success({
    artifact_id: artifactId,
    version: updates.version || artifact.version || 1,
    updated_at: new Date(updates.updatedAt).toISOString()
  });
}

/**
 * Delete artifact
 */
async function deleteArtifact(event, userId, artifactId) {
  const sessionId = getQueryParam(event, 'sessionId') || getQueryParam(event, 'session_id');

  if (!sessionId) {
    return badRequest('session_id query parameter is required');
  }

  const artifact = await getItem(ARTIFACTS_TABLE, { sessionId, artifactId });

  if (!artifact) {
    return notFound('Artifact not found');
  }

  // Check ownership
  if (artifact.userId !== userId) {
    return badRequest('Not authorized to delete this artifact');
  }

  // Delete from S3
  try {
    await deleteContent(ARTIFACTS_BUCKET, artifact.s3Key);
  } catch (e) {
    console.error(`Failed to delete S3 object ${artifact.s3Key}:`, e);
  }

  // Delete from DynamoDB
  await deleteItem(ARTIFACTS_TABLE, { sessionId, artifactId });

  return success({ deleted: true });
}

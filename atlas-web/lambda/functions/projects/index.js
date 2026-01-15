const { getItem, putItem, updateItem, deleteItem, queryItems, batchDeleteItems } = require('./shared/dynamodb');
const { getUploadUrl, deleteObject, uploadContent, getContent } = require('./shared/s3');
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
const { extractZip, isZipFile, isSupportedType } = require('./shared/zip');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

// Lazy-load vectors module (may not be available in all environments)
let vectorsModule = null;
function getVectorsModule() {
  if (vectorsModule === null) {
    try {
      vectorsModule = require('/opt/nodejs/shared/vectors');
    } catch (e) {
      console.warn('[Projects] Vectors module not available:', e.message);
      vectorsModule = false;
    }
  }
  return vectorsModule || null;
}

// Bedrock client for memory generation
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
// Using Haiku 4.5 for memory generation (cost-effective + vision support)
const MEMORY_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const PROJECTS_TABLE = process.env.PROJECTS_TABLE;
const PROJECT_FILES_TABLE = process.env.PROJECT_FILES_TABLE;
const PROJECT_MEMORY_TABLE = process.env.PROJECT_MEMORY_TABLE;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const VECTORS_BUCKET = process.env.VECTORS_BUCKET;

// Token estimation constants
const CHARS_PER_TOKEN = 4;
const TOKEN_BUFFER = 1.1; // 10% safety buffer

/**
 * Estimate tokens for text content
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil((text.length / CHARS_PER_TOKEN) * TOKEN_BUFFER);
}

/**
 * Estimate tokens for image based on dimensions
 * Claude charges ~765-8000 tokens per image depending on size
 */
function estimateImageTokens(size) {
  // Rough estimate based on file size (larger files = larger images = more tokens)
  if (size < 50000) return 765;      // Small images
  if (size < 200000) return 1500;    // Medium images
  if (size < 500000) return 4000;    // Large images
  return 8000;                        // Very large images
}

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('Projects event:', JSON.stringify(event));

  // Authenticate request
  let user;
  try {
    user = authenticateRequest(event);
  } catch (error) {
    return authErrorResponse(error);
  }

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const projectId = getPathParam(event, 'projectId');
  const fileId = getPathParam(event, 'fileId');

  try {
    // Route based on method and path
    // Semantic memories routes (S3 Vectors) - must come before legacy memory routes
    if (path.includes('/memories')) {
      const memoryId = getPathParam(event, 'memoryId');
      if (method === 'GET') {
        return listSemanticMemories(user.userId, projectId, event);
      } else if (method === 'PUT' && memoryId) {
        return updateSemanticMemory(user.userId, projectId, memoryId, event);
      } else if (method === 'DELETE' && memoryId) {
        return deleteSemanticMemory(user.userId, projectId, memoryId);
      } else if (method === 'POST') {
        return addSemanticMemory(user.userId, projectId, event);
      }
    }
    // Legacy Memory routes
    else if (path.includes('/memory')) {
      if (method === 'GET') {
        return getProjectMemory(user.userId, projectId);
      } else if (method === 'PUT') {
        return updateProjectMemory(user.userId, projectId, event);
      } else if (method === 'POST' && path.includes('/regenerate')) {
        return regenerateProjectMemory(user.userId, projectId);
      }
    }
    // Chats/sessions routes
    else if (path.includes('/chats') || path.includes('/sessions')) {
      const chatId = getPathParam(event, 'chatId');
      if (method === 'GET') {
        return listProjectChats(user.userId, projectId);
      } else if (method === 'DELETE' && chatId) {
        return deleteProjectChat(user.userId, projectId, chatId);
      }
    }
    // File routes
    else if (path.includes('/files/from-artifact')) {
      if (method === 'POST') {
        return saveArtifactToProject(user.userId, projectId, event);
      }
    } else if (path.includes('/files/upload-zip')) {
      if (method === 'POST') {
        return uploadZipFile(user.userId, projectId, event);
      }
    } else if (path.includes('/files') && fileId && path.includes('/pin')) {
      if (method === 'PUT' || method === 'POST') {
        return toggleFilePin(user.userId, projectId, fileId, event);
      }
    } else if (path.includes('/files')) {
      if (method === 'GET' && !fileId) {
        return listProjectFiles(user.userId, projectId, event);
      } else if (method === 'GET' && fileId) {
        return getProjectFile(user.userId, projectId, fileId, event);
      } else if (method === 'POST') {
        return uploadProjectFile(user.userId, projectId, event);
      } else if (method === 'PUT' && fileId) {
        return updateProjectFile(user.userId, projectId, fileId, event);
      } else if (method === 'DELETE' && fileId) {
        return deleteProjectFile(user.userId, projectId, fileId);
      }
    }
    // Project routes
    else if (method === 'GET' && projectId) {
      return getProject(user.userId, projectId);
    } else if (method === 'GET') {
      return listProjects(user.userId, event);
    } else if (method === 'POST') {
      return createProject(user.userId, event);
    } else if (method === 'PUT' && projectId) {
      return updateProject(user.userId, projectId, event);
    } else if (method === 'DELETE' && projectId) {
      return deleteProject(user.userId, projectId);
    }

    return badRequest('Invalid route');
  } catch (error) {
    console.error('Projects error:', error);
    return serverError(error.message);
  }
};

// =============================================================================
// PROJECT CRUD
// =============================================================================

/**
 * List all projects for user with enhanced metadata
 */
async function listProjects(userId, event) {
  const qs = event.queryStringParameters || {};
  const status = qs.status || 'active'; // active, archived, all

  let projects = await queryItems(PROJECTS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  }, {
    indexName: 'userId-lastActivityAt-index',
    ascending: false
  });

  // Filter by status if not 'all'
  if (status !== 'all') {
    projects = projects.filter(p => (p.status || 'active') === status);
  }

  return success({
    projects: projects.map(p => ({
      id: p.projectId,
      name: p.name,
      description: p.description,
      status: p.status || 'active',
      model: p.model || 'sonnet',
      pinnedTokens: p.pinnedTokens || 0,
      chatCount: p.chatCount || 0,
      fileCount: p.fileCount || 0,
      memoryPreview: p.memoryPreview || null,
      lastActivityAt: p.lastActivityAt || p.updatedAt,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt
    }))
  });
}

/**
 * Get a single project with full details
 */
async function getProject(userId, projectId) {
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });

  if (!project) {
    return notFound('Project not found');
  }

  // Get files with details
  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });

  // Calculate totals
  const pinnedFiles = files.filter(f => f.pinned === 'true');
  const totalPinnedTokens = pinnedFiles.reduce((sum, f) => sum + (f.tokenCount || 0), 0);

  // Get current memory
  let memory = null;
  if (PROJECT_MEMORY_TABLE) {
    try {
      const memories = await queryItems(PROJECT_MEMORY_TABLE, {
        expression: 'projectId = :projectId',
        values: { ':projectId': projectId }
      }, { ascending: false, limit: 1 });
      if (memories.length > 0 && memories[0].current) {
        memory = memories[0];
      }
    } catch (e) {
      console.error('Failed to load memory:', e);
    }
  }

  // Get chat count
  let chatCount = project.chatCount || 0;
  if (SESSIONS_TABLE) {
    try {
      const chats = await queryItems(SESSIONS_TABLE, {
        expression: 'projectId = :projectId',
        values: { ':projectId': projectId }
      }, { indexName: 'projectId-updatedAt-index' });
      chatCount = chats.length;
    } catch (e) {
      // Use cached count if query fails
    }
  }

  return success({
    id: project.projectId,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    status: project.status || 'active',
    model: project.model || 'sonnet',
    pinnedTokens: totalPinnedTokens,
    chatCount,
    fileCount: files.length,
    files: files.map(f => ({
      id: f.fileId,
      name: f.name,
      type: f.type,
      size: f.size,
      pinned: f.pinned === 'true',
      tokenCount: f.tokenCount || 0,
      processingStatus: f.processingStatus || 'complete',
      summary: f.summary || null,
      description: f.description || null,
      createdAt: f.createdAt
    })),
    memory: memory ? {
      sections: memory.sections,
      generatedAt: memory.generatedAt,
      tokenCount: memory.tokenCount
    } : null,
    lastActivityAt: project.lastActivityAt || project.updatedAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  });
}

/**
 * Create a new project with enhanced fields
 */
async function createProject(userId, event) {
  const body = parseBody(event);

  if (!body.name) {
    return badRequest('Project name is required');
  }

  const projectId = `proj_${Date.now()}`;
  const now = Date.now();

  const project = {
    userId,
    projectId,
    name: body.name,
    description: body.description || '',
    instructions: body.instructions || '',
    status: 'active',
    model: body.model || 'sonnet',
    pinnedTokens: 0,
    chatCount: 0,
    fileCount: 0,
    lastActivityAt: now,
    createdAt: now,
    updatedAt: now
  };

  await putItem(PROJECTS_TABLE, project);

  // Initialize vector indexes for semantic memory (async, non-blocking)
  if (VECTORS_BUCKET) {
    const vectors = getVectorsModule();
    if (vectors) {
      vectors.createProjectIndexes(userId, projectId).catch(err => {
        console.error(`[Projects] Failed to create vector indexes for ${projectId}:`, err.message);
      });
    }
  }

  return created({
    id: project.projectId,
    name: project.name,
    description: project.description,
    instructions: project.instructions,
    status: project.status,
    model: project.model,
    pinnedTokens: project.pinnedTokens,
    chatCount: project.chatCount,
    fileCount: project.fileCount,
    lastActivityAt: project.lastActivityAt,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt
  });
}

/**
 * Update a project with enhanced fields
 */
async function updateProject(userId, projectId, event) {
  const body = parseBody(event);

  // Verify project exists
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  // Build updates
  const now = Date.now();
  const updates = { updatedAt: now, lastActivityAt: now };

  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.instructions !== undefined) updates.instructions = body.instructions;
  if (body.status !== undefined) updates.status = body.status;
  if (body.model !== undefined) updates.model = body.model;

  const updated = await updateItem(PROJECTS_TABLE, { userId, projectId }, updates);

  return success({
    id: updated.projectId,
    name: updated.name,
    description: updated.description,
    instructions: updated.instructions,
    status: updated.status || 'active',
    model: updated.model || 'sonnet',
    pinnedTokens: updated.pinnedTokens || 0,
    chatCount: updated.chatCount || 0,
    fileCount: updated.fileCount || 0,
    lastActivityAt: updated.lastActivityAt,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

/**
 * Delete a project and all associated data
 */
async function deleteProject(userId, projectId) {
  // Verify project exists
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  // Delete vector indexes (if available)
  if (VECTORS_BUCKET) {
    const vectors = getVectorsModule();
    if (vectors) {
      try {
        await vectors.deleteProjectIndexes(userId, projectId);
        console.log(`[Projects] Deleted vector indexes for project ${projectId}`);
      } catch (err) {
        console.error(`[Projects] Failed to delete vector indexes for ${projectId}:`, err.message);
        // Continue with deletion even if this fails
      }
    }
  }

  // Get all files for this project
  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });

  // Delete all files from S3 and DynamoDB
  for (const file of files) {
    try {
      await deleteObject(UPLOADS_BUCKET, file.s3Key);
      if (file.thumbnailKey) {
        await deleteObject(UPLOADS_BUCKET, file.thumbnailKey);
      }
    } catch (e) {
      console.error(`Failed to delete S3 object ${file.s3Key}:`, e);
    }
  }

  if (files.length > 0) {
    const fileKeys = files.map(f => ({
      projectId: f.projectId,
      fileId: f.fileId
    }));
    await batchDeleteItems(PROJECT_FILES_TABLE, fileKeys);
  }

  // Delete memory records
  if (PROJECT_MEMORY_TABLE) {
    try {
      const memories = await queryItems(PROJECT_MEMORY_TABLE, {
        expression: 'projectId = :projectId',
        values: { ':projectId': projectId }
      });
      if (memories.length > 0) {
        const memoryKeys = memories.map(m => ({
          projectId: m.projectId,
          version: m.version
        }));
        await batchDeleteItems(PROJECT_MEMORY_TABLE, memoryKeys);
      }
    } catch (e) {
      console.error('Failed to delete memory records:', e);
    }
  }

  // Unlink sessions (don't delete them, just remove project association)
  if (SESSIONS_TABLE) {
    try {
      const sessions = await queryItems(SESSIONS_TABLE, {
        expression: 'projectId = :projectId',
        values: { ':projectId': projectId }
      }, { indexName: 'projectId-updatedAt-index' });

      for (const session of sessions) {
        await updateItem(SESSIONS_TABLE,
          { userId: session.userId, sessionId: session.sessionId },
          { projectId: null }
        );
      }
    } catch (e) {
      console.error('Failed to unlink sessions:', e);
    }
  }

  // Delete project
  await deleteItem(PROJECTS_TABLE, { userId, projectId });

  return noContent();
}

// =============================================================================
// FILE MANAGEMENT
// =============================================================================

/**
 * List files in a project with enhanced metadata
 */
async function listProjectFiles(userId, projectId, event) {
  const qs = event.queryStringParameters || {};
  const pinnedOnly = qs.pinned === 'true';

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  let files;
  if (pinnedOnly) {
    // Use GSI for pinned files
    files = await queryItems(PROJECT_FILES_TABLE, {
      expression: 'projectId = :projectId AND pinned = :pinned',
      values: { ':projectId': projectId, ':pinned': 'true' }
    }, { indexName: 'projectId-pinned-index' });
  } else {
    files = await queryItems(PROJECT_FILES_TABLE, {
      expression: 'projectId = :projectId',
      values: { ':projectId': projectId }
    });
  }

  // Calculate totals
  const pinnedFiles = files.filter(f => f.pinned === 'true');
  const totalPinnedTokens = pinnedFiles.reduce((sum, f) => sum + (f.tokenCount || 0), 0);

  return success({
    projectId,
    totalFiles: files.length,
    pinnedCount: pinnedFiles.length,
    totalPinnedTokens,
    files: files.map(f => ({
      id: f.fileId,
      name: f.name,
      type: f.type,
      size: f.size,
      pinned: f.pinned === 'true',
      tokenCount: f.tokenCount || 0,
      processingStatus: f.processingStatus || 'complete',
      summary: f.summary || null,
      description: f.description || null,
      createdAt: f.createdAt
    }))
  });
}

/**
 * Get a single file with content (for viewing/editing)
 */
async function getProjectFile(userId, projectId, fileId, event) {
  const qs = event.queryStringParameters || {};
  const includeContent = qs.content === 'true';

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const file = await getItem(PROJECT_FILES_TABLE, { projectId, fileId });
  if (!file) {
    return notFound('File not found');
  }

  const response = {
    id: file.fileId,
    name: file.name,
    type: file.type,
    size: file.size,
    pinned: file.pinned === 'true',
    tokenCount: file.tokenCount || 0,
    processingStatus: file.processingStatus || 'complete',
    summary: file.summary || null,
    description: file.description || null,
    createdAt: file.createdAt
  };

  // Include content if requested and file is text-based
  if (includeContent && isTextFile(file.type)) {
    try {
      const contentResult = await getContent(UPLOADS_BUCKET, file.s3Key);
      response.content = contentResult.content;
    } catch (e) {
      console.error('Failed to load file content:', e);
    }
  }

  return success(response);
}

/**
 * Upload a file to a project with enhanced metadata
 */
async function uploadProjectFile(userId, projectId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!body.filename || !body.contentType) {
    return badRequest('filename and contentType are required');
  }

  const fileId = `file_${Date.now()}`;
  const s3Key = `projects/${projectId}/${fileId}-${body.filename}`;
  const now = Date.now();

  // Estimate tokens based on file type and size
  let tokenCount = 0;
  if (isTextFile(body.contentType)) {
    tokenCount = estimateTokens(body.size ? body.size.toString() : '0');
  } else if (body.contentType.startsWith('image/')) {
    tokenCount = estimateImageTokens(body.size || 0);
  } else if (body.contentType === 'application/pdf') {
    // PDF tokens estimated during processing
    tokenCount = 0;
  }

  // Generate presigned upload URL
  const uploadUrl = await getUploadUrl(UPLOADS_BUCKET, s3Key, body.contentType);

  // Save file metadata with enhanced fields
  const file = {
    projectId,
    fileId,
    name: body.filename,
    type: body.contentType,
    size: body.size || 0,
    s3Key,
    pinned: body.pinned === true ? 'true' : 'false',
    tokenCount,
    processingStatus: needsProcessing(body.contentType) ? 'pending' : 'complete',
    summary: null,
    description: body.description || null,
    createdAt: now
  };

  await putItem(PROJECT_FILES_TABLE, file);

  // Update project metadata
  const fileCount = (project.fileCount || 0) + 1;
  const pinnedTokens = file.pinned === 'true'
    ? (project.pinnedTokens || 0) + tokenCount
    : (project.pinnedTokens || 0);

  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    updatedAt: now,
    lastActivityAt: now,
    fileCount,
    pinnedTokens
  });

  return success({
    fileId,
    uploadUrl,
    file: {
      id: file.fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      pinned: file.pinned === 'true',
      tokenCount: file.tokenCount,
      processingStatus: file.processingStatus,
      createdAt: file.createdAt
    }
  });
}

/**
 * Save artifact content directly as a project file
 */
async function saveArtifactToProject(userId, projectId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!body.filename || !body.content) {
    return badRequest('filename and content are required');
  }

  const fileId = `file_${Date.now()}`;
  const filename = body.filename;
  const s3Key = `projects/${projectId}/${fileId}-${filename}`;
  const now = Date.now();

  // Determine content type from file extension
  const ext = filename.split('.').pop()?.toLowerCase();
  const contentTypes = {
    'md': 'text/markdown',
    'html': 'text/html',
    'svg': 'image/svg+xml',
    'json': 'application/json',
    'csv': 'text/csv',
    'js': 'application/javascript',
    'jsx': 'text/javascript',
    'ts': 'application/typescript',
    'tsx': 'text/typescript',
    'py': 'text/x-python',
    'txt': 'text/plain',
    'mermaid': 'text/plain'
  };
  const contentType = contentTypes[ext] || 'text/plain';

  // Upload content directly to S3
  const content = Buffer.from(body.content, 'utf-8');
  await uploadContent(UPLOADS_BUCKET, s3Key, content, contentType);

  // Calculate token count
  const tokenCount = estimateTokens(body.content);

  // Save file metadata
  const file = {
    projectId,
    fileId,
    name: filename,
    type: contentType,
    size: content.length,
    s3Key,
    pinned: body.pinned === true ? 'true' : 'false',
    tokenCount,
    processingStatus: 'complete',
    summary: null,
    description: body.description || `Saved from artifact: ${body.artifactTitle || filename}`,
    sourceType: 'artifact',
    sourceArtifactId: body.artifactId || null,
    createdAt: now
  };

  await putItem(PROJECT_FILES_TABLE, file);

  // Update project metadata
  const fileCount = (project.fileCount || 0) + 1;
  const pinnedTokens = file.pinned === 'true'
    ? (project.pinnedTokens || 0) + tokenCount
    : (project.pinnedTokens || 0);

  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    updatedAt: now,
    lastActivityAt: now,
    fileCount,
    pinnedTokens
  });

  return created({
    fileId,
    file: {
      id: file.fileId,
      name: file.name,
      type: file.type,
      size: file.size,
      pinned: file.pinned === 'true',
      tokenCount: file.tokenCount,
      processingStatus: file.processingStatus,
      description: file.description,
      createdAt: file.createdAt
    }
  });
}

/**
 * Update file metadata (rename, description)
 */
async function updateProjectFile(userId, projectId, fileId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const file = await getItem(PROJECT_FILES_TABLE, { projectId, fileId });
  if (!file) {
    return notFound('File not found');
  }

  const updates = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;

  if (Object.keys(updates).length === 0) {
    return badRequest('No updates provided');
  }

  const updated = await updateItem(PROJECT_FILES_TABLE, { projectId, fileId }, updates);

  // Update project timestamp
  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    updatedAt: Date.now(),
    lastActivityAt: Date.now()
  });

  return success({
    id: updated.fileId,
    name: updated.name,
    type: updated.type,
    size: updated.size,
    pinned: updated.pinned === 'true',
    tokenCount: updated.tokenCount || 0,
    processingStatus: updated.processingStatus || 'complete',
    summary: updated.summary || null,
    description: updated.description || null,
    createdAt: updated.createdAt
  });
}

/**
 * Toggle file pin status
 */
async function toggleFilePin(userId, projectId, fileId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const file = await getItem(PROJECT_FILES_TABLE, { projectId, fileId });
  if (!file) {
    return notFound('File not found');
  }

  // Determine new pin state
  const currentlyPinned = file.pinned === 'true';
  const newPinned = body.pinned !== undefined ? body.pinned : !currentlyPinned;

  // Update file
  await updateItem(PROJECT_FILES_TABLE, { projectId, fileId }, {
    pinned: newPinned ? 'true' : 'false'
  });

  // Update project's pinned token count
  const tokenDelta = file.tokenCount || 0;
  const currentPinnedTokens = project.pinnedTokens || 0;
  const newPinnedTokens = newPinned
    ? currentPinnedTokens + tokenDelta
    : Math.max(0, currentPinnedTokens - tokenDelta);

  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    pinnedTokens: newPinnedTokens,
    updatedAt: Date.now(),
    lastActivityAt: Date.now()
  });

  return success({
    id: file.fileId,
    name: file.name,
    pinned: newPinned,
    tokenCount: file.tokenCount || 0,
    projectPinnedTokens: newPinnedTokens
  });
}

/**
 * Delete a file from a project
 */
async function deleteProjectFile(userId, projectId, fileId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  // Get file
  const file = await getItem(PROJECT_FILES_TABLE, { projectId, fileId });
  if (!file) {
    return notFound('File not found');
  }

  // Delete from S3
  try {
    await deleteObject(UPLOADS_BUCKET, file.s3Key);
    if (file.thumbnailKey) {
      await deleteObject(UPLOADS_BUCKET, file.thumbnailKey);
    }
  } catch (e) {
    console.error(`Failed to delete S3 object ${file.s3Key}:`, e);
  }

  // Delete from DynamoDB
  await deleteItem(PROJECT_FILES_TABLE, { projectId, fileId });

  // Update project metadata
  const fileCount = Math.max(0, (project.fileCount || 1) - 1);
  const pinnedTokens = file.pinned === 'true'
    ? Math.max(0, (project.pinnedTokens || 0) - (file.tokenCount || 0))
    : (project.pinnedTokens || 0);

  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    updatedAt: Date.now(),
    lastActivityAt: Date.now(),
    fileCount,
    pinnedTokens
  });

  return noContent();
}

/**
 * Upload and extract a zip file to a project
 */
async function uploadZipFile(userId, projectId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!body.zipContent) {
    return badRequest('zipContent (base64) is required');
  }

  const zipFilename = body.filename || 'upload.zip';
  const pinAllFiles = body.pinAll === true;

  try {
    // Extract the zip file
    const result = await extractZip(body.zipContent, {
      includeImages: body.includeImages !== false,
      includeCode: body.includeCode !== false,
      includeText: body.includeText !== false,
      maxFiles: body.maxFiles || 50
    });

    if (!result.success) {
      return badRequest('Failed to extract zip file');
    }

    const uploadedFiles = [];
    const now = Date.now();
    let addedTokens = 0;

    // Upload each extracted file to S3 and save metadata
    for (const file of result.files) {
      const fileId = `file_${now}_${Math.random().toString(36).substr(2, 9)}`;
      const s3Key = `projects/${projectId}/${fileId}-${file.name}`;

      // Upload to S3
      const content = Buffer.from(file.base64, 'base64');
      await uploadContent(UPLOADS_BUCKET, s3Key, content, file.type);

      // Estimate tokens
      let tokenCount = 0;
      if (isTextFile(file.type)) {
        tokenCount = estimateTokens(file.size.toString());
      } else if (file.type.startsWith('image/')) {
        tokenCount = estimateImageTokens(file.size);
      }

      // Save file metadata
      const fileRecord = {
        projectId,
        fileId,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        s3Key,
        pinned: pinAllFiles ? 'true' : 'false',
        tokenCount,
        processingStatus: needsProcessing(file.type) ? 'pending' : 'complete',
        fromZip: zipFilename,
        createdAt: now
      };

      await putItem(PROJECT_FILES_TABLE, fileRecord);

      if (pinAllFiles) {
        addedTokens += tokenCount;
      }

      uploadedFiles.push({
        id: fileId,
        name: file.name,
        path: file.path,
        type: file.type,
        size: file.size,
        pinned: pinAllFiles,
        tokenCount,
        createdAt: now
      });
    }

    // Update project metadata
    const fileCount = (project.fileCount || 0) + uploadedFiles.length;
    const pinnedTokens = (project.pinnedTokens || 0) + addedTokens;

    await updateItem(PROJECTS_TABLE, { userId, projectId }, {
      updatedAt: now,
      lastActivityAt: now,
      fileCount,
      pinnedTokens
    });

    return success({
      zipFilename,
      extractedCount: result.extractedCount,
      skippedCount: result.skippedCount,
      summary: result.summary,
      files: uploadedFiles,
      skipped: result.skipped,
      projectFileCount: fileCount,
      projectPinnedTokens: pinnedTokens
    });

  } catch (error) {
    console.error('Zip extraction error:', error);
    return serverError(`Failed to process zip file: ${error.message}`);
  }
}

// =============================================================================
// PROJECT MEMORY
// =============================================================================

/**
 * Get current project memory
 */
async function getProjectMemory(userId, projectId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!PROJECT_MEMORY_TABLE) {
    return success({ memory: null, message: 'Memory feature not configured' });
  }

  // Get latest memory
  const memories = await queryItems(PROJECT_MEMORY_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  }, { ascending: false, limit: 1 });

  if (memories.length === 0) {
    return success({ memory: null });
  }

  const memory = memories[0];
  return success({
    memory: {
      sections: memory.sections,
      processedChatIds: memory.processedChatIds || [],
      generatedAt: memory.generatedAt,
      tokenCount: memory.tokenCount || 0,
      version: memory.version
    }
  });
}

/**
 * Update project memory (manual edit)
 */
async function updateProjectMemory(userId, projectId, event) {
  const body = parseBody(event);

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!PROJECT_MEMORY_TABLE) {
    return badRequest('Memory feature not configured');
  }

  if (!body.sections) {
    return badRequest('sections object is required');
  }

  const now = Date.now();

  // Mark previous version as not current
  const memories = await queryItems(PROJECT_MEMORY_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  }, { ascending: false, limit: 1 });

  if (memories.length > 0) {
    await updateItem(PROJECT_MEMORY_TABLE,
      { projectId, version: memories[0].version },
      { current: false }
    );
  }

  // Calculate token count for new memory
  const memoryText = Object.values(body.sections).join('\n');
  const tokenCount = estimateTokens(memoryText);

  // Create new memory version
  const newMemory = {
    projectId,
    version: now,
    current: true,
    sections: body.sections,
    processedChatIds: body.processedChatIds || memories[0]?.processedChatIds || [],
    generatedAt: now,
    tokenCount,
    editedManually: true
  };

  await putItem(PROJECT_MEMORY_TABLE, newMemory);

  // Update project with memory preview
  const preview = body.sections.purposeContext
    ? body.sections.purposeContext.substring(0, 200)
    : null;

  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    memoryPreview: preview,
    updatedAt: now,
    lastActivityAt: now
  });

  return success({
    memory: {
      sections: newMemory.sections,
      processedChatIds: newMemory.processedChatIds,
      generatedAt: newMemory.generatedAt,
      tokenCount: newMemory.tokenCount,
      version: newMemory.version
    }
  });
}

/**
 * Generate synthesized memory from project conversations using Claude
 */
async function regenerateProjectMemory(userId, projectId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  try {
    // Get all sessions for this project
    const sessions = await queryItems(SESSIONS_TABLE, {
      expression: 'projectId = :projectId',
      values: { ':projectId': projectId }
    }, {
      indexName: 'projectId-updatedAt-index',
      ascending: false
    });

    if (sessions.length === 0) {
      return success({
        message: 'No conversations found for this project',
        projectId,
        memory: null
      });
    }

    // Get messages from each session (limited to avoid context overflow)
    const allMessages = [];
    const processedChatIds = [];
    let totalTokens = 0;
    const MAX_CONTEXT_TOKENS = 50000; // Leave room for prompt and response

    for (const session of sessions) {
      if (totalTokens >= MAX_CONTEXT_TOKENS) break;

      const messages = await queryItems(MESSAGES_TABLE, {
        expression: 'sessionId = :sessionId',
        values: { ':sessionId': session.sessionId }
      });

      // Sort by timestamp
      messages.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

      for (const msg of messages) {
        const msgTokens = estimateTokens(msg.content || '');
        if (totalTokens + msgTokens > MAX_CONTEXT_TOKENS) break;

        allMessages.push({
          sessionTitle: session.title,
          role: msg.role,
          content: msg.content
        });
        totalTokens += msgTokens;
      }

      processedChatIds.push(session.sessionId);
    }

    if (allMessages.length === 0) {
      return success({
        message: 'No messages found in project conversations',
        projectId,
        memory: null
      });
    }

    // Format conversations for Claude
    const conversationText = allMessages
      .map(m => `[${m.sessionTitle || 'Untitled'}] ${m.role}: ${m.content}`)
      .join('\n\n---\n\n');

    // Generate memory using Claude
    const memoryPrompt = `You are analyzing conversations from a project to synthesize persistent memory that will help future AI assistants understand the project context.

Project: ${project.name}
${project.description ? `Description: ${project.description}` : ''}
${project.instructions ? `Custom Instructions: ${project.instructions}` : ''}

Below are conversations from this project. Analyze them and generate a synthesized memory document with the following 6 sections. Each section should be concise but comprehensive. If a section has no relevant information, write "No information available yet."

**SECTIONS TO GENERATE:**

1. **Purpose & Context**: What is this project about? What are the main goals and objectives?

2. **Current State**: What has been accomplished? What is the current status of the work?

3. **On The Horizon**: What are the planned next steps? What tasks or features are coming up?

4. **Key Learnings**: What important decisions were made? What insights or discoveries emerged?

5. **Approach & Patterns**: What coding patterns, architectural decisions, or methodologies are being used?

6. **Tools & Resources**: What technologies, libraries, APIs, or external resources are being used?

**CONVERSATIONS:**

${conversationText}

**YOUR RESPONSE:**

Generate the memory document with clear section headers. Be specific and reference actual details from the conversations. Focus on information that would be valuable for context continuity in future conversations.`;

    const command = new ConverseCommand({
      modelId: MEMORY_MODEL,
      messages: [{
        role: 'user',
        content: [{ text: memoryPrompt }]
      }],
      system: [{ text: 'You are a helpful assistant that synthesizes project context from conversations. Be concise but thorough.' }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.3
      }
    });

    const response = await bedrockClient.send(command);
    const memoryText = response.output.message.content[0].text;

    // Parse the sections from the response
    const sections = parseMemorySections(memoryText);

    // Get current memory version
    const existingMemory = await queryItems(PROJECT_MEMORY_TABLE, {
      expression: 'projectId = :projectId',
      values: { ':projectId': projectId },
      scanIndexForward: false,
      limit: 1
    });

    const newVersion = existingMemory.length > 0 ? existingMemory[0].version + 1 : 1;

    // Mark old memory as not current
    if (existingMemory.length > 0 && existingMemory[0].current) {
      await updateItem(PROJECT_MEMORY_TABLE,
        { projectId, version: existingMemory[0].version },
        { current: false }
      );
    }

    // Save new memory
    const newMemory = {
      projectId,
      version: newVersion,
      sections,
      processedChatIds,
      current: true,
      generatedAt: Date.now(),
      tokenCount: estimateTokens(memoryText)
    };

    await putItem(PROJECT_MEMORY_TABLE, newMemory);

    // Update project with memory status
    await updateItem(PROJECTS_TABLE, { userId, projectId }, {
      memoryVersion: newVersion,
      memoryGeneratedAt: Date.now(),
      lastActivityAt: Date.now()
    });

    console.log(`[Memory] Generated memory v${newVersion} for project ${projectId} from ${processedChatIds.length} conversations`);

    return success({
      message: 'Memory generated successfully',
      projectId,
      version: newVersion,
      processedChats: processedChatIds.length,
      sections: Object.keys(sections).filter(k => sections[k] && sections[k] !== 'No information available yet.')
    });

  } catch (error) {
    console.error('Memory generation error:', error);
    return serverError(`Memory generation failed: ${error.message}`);
  }
}

/**
 * Parse memory sections from Claude's response
 */
function parseMemorySections(text) {
  const sections = {
    purposeContext: '',
    currentState: '',
    onTheHorizon: '',
    keyLearnings: '',
    approachPatterns: '',
    toolsResources: ''
  };

  const sectionMappings = [
    { key: 'purposeContext', patterns: ['purpose & context', 'purpose and context', '1.', '## 1.'] },
    { key: 'currentState', patterns: ['current state', '2.', '## 2.'] },
    { key: 'onTheHorizon', patterns: ['on the horizon', 'horizon', '3.', '## 3.'] },
    { key: 'keyLearnings', patterns: ['key learnings', 'learnings', '4.', '## 4.'] },
    { key: 'approachPatterns', patterns: ['approach & patterns', 'approach and patterns', 'patterns', '5.', '## 5.'] },
    { key: 'toolsResources', patterns: ['tools & resources', 'tools and resources', 'resources', '6.', '## 6.'] }
  ];

  // Split by common section delimiters
  const lines = text.split('\n');
  let currentSection = null;
  let currentContent = [];

  for (const line of lines) {
    const lowerLine = line.toLowerCase().trim();

    // Check if this line starts a new section
    let foundSection = null;
    for (const mapping of sectionMappings) {
      if (mapping.patterns.some(p => lowerLine.includes(p.toLowerCase()) || lowerLine.startsWith(p.toLowerCase()))) {
        foundSection = mapping.key;
        break;
      }
    }

    if (foundSection) {
      // Save previous section
      if (currentSection) {
        sections[currentSection] = currentContent.join('\n').trim();
      }
      currentSection = foundSection;
      currentContent = [];
      // Don't include the header line in content
    } else if (currentSection) {
      currentContent.push(line);
    }
  }

  // Save last section
  if (currentSection) {
    sections[currentSection] = currentContent.join('\n').trim();
  }

  // Clean up sections - remove markdown headers and extra whitespace
  for (const key of Object.keys(sections)) {
    sections[key] = sections[key]
      .replace(/^\*\*[^*]+\*\*:?\s*/gm, '')  // Remove bold headers
      .replace(/^#+\s*/gm, '')               // Remove markdown headers
      .trim();
  }

  return sections;
}

// =============================================================================
// PROJECT CHATS
// =============================================================================

/**
 * List chats in a project
 */
async function listProjectChats(userId, projectId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!SESSIONS_TABLE) {
    return success({ chats: [] });
  }

  const sessions = await queryItems(SESSIONS_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  }, {
    indexName: 'projectId-updatedAt-index',
    ascending: false
  });

  return success({
    projectId,
    chats: sessions.map(s => ({
      id: s.sessionId,
      title: s.title,
      starred: s.starred || false,
      memoryProcessed: s.memoryProcessed || false,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  });
}

/**
 * Delete a chat from a project
 * This deletes the session and all its messages
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} chatId - Session/Chat ID to delete
 */
async function deleteProjectChat(userId, projectId, chatId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  if (!SESSIONS_TABLE) {
    return badRequest('Sessions not configured');
  }

  // Verify the session exists and belongs to this project
  // Sessions table has composite key {userId, sessionId}
  const session = await getItem(SESSIONS_TABLE, { userId, sessionId: chatId });
  if (!session) {
    return notFound('Chat not found');
  }

  // Verify the session belongs to this project
  if (session.projectId !== projectId) {
    return notFound('Chat not found in this project');
  }

  // Delete all messages for this session
  if (MESSAGES_TABLE) {
    try {
      const messages = await queryItems(MESSAGES_TABLE, {
        expression: 'sessionId = :sessionId',
        values: { ':sessionId': chatId }
      });

      if (messages.length > 0) {
        const messageKeys = messages.map(m => ({
          sessionId: m.sessionId,
          messageId: m.messageId
        }));
        await batchDeleteItems(MESSAGES_TABLE, messageKeys);
        console.log(`[Projects] Deleted ${messages.length} messages for chat ${chatId}`);
      }
    } catch (e) {
      console.error(`[Projects] Failed to delete messages for chat ${chatId}:`, e.message);
    }
  }

  // Delete the session
  // Sessions table has composite key {userId, sessionId}
  await deleteItem(SESSIONS_TABLE, { userId, sessionId: chatId });

  // Update project chat count
  const newChatCount = Math.max(0, (project.chatCount || 1) - 1);
  await updateItem(PROJECTS_TABLE, { userId, projectId }, {
    chatCount: newChatCount,
    updatedAt: Date.now(),
    lastActivityAt: Date.now()
  });

  console.log(`[Projects] Deleted chat ${chatId} from project ${projectId}`);

  return noContent();
}

// =============================================================================
// SEMANTIC MEMORY (S3 VECTORS)
// =============================================================================

/**
 * List semantic memories for a project
 */
async function listSemanticMemories(userId, projectId, event) {
  const qs = event.queryStringParameters || {};
  const query = qs.query || null;
  const topK = parseInt(qs.topK) || 20;

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const vectors = getVectorsModule();
  if (!vectors || !VECTORS_BUCKET) {
    return success({ memories: [], conversations: [], message: 'Vectors not configured' });
  }

  try {
    let memories = [];
    let conversations = [];

    if (query) {
      // Search memories based on query
      memories = await vectors.searchMemories(userId, projectId, query, { topK });
      conversations = await vectors.searchConversations(userId, projectId, query, { topK: 5 });
    }

    return success({
      memories,
      conversations,
      projectId
    });
  } catch (error) {
    console.error('[SemanticMemory] List error:', error);
    return serverError(`Failed to list memories: ${error.message}`);
  }
}

/**
 * Add a new semantic memory to a project
 */
async function addSemanticMemory(userId, projectId, event) {
  const body = parseBody(event);
  const { content, category = 'general' } = body;

  if (!content) {
    return badRequest('content is required');
  }

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const vectors = getVectorsModule();
  if (!vectors || !VECTORS_BUCKET) {
    return badRequest('Vectors feature not configured');
  }

  try {
    const factId = `manual_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await vectors.storeMemoryFact(userId, projectId, {
      factId,
      content,
      category,
      confidence: 1.0, // Manual entries have full confidence
      sourceSessionId: 'manual',
      timestamp: Date.now()
    });

    return created({
      factId,
      content,
      category,
      message: 'Memory added successfully'
    });
  } catch (error) {
    console.error('[SemanticMemory] Add error:', error);
    return serverError(`Failed to add memory: ${error.message}`);
  }
}

/**
 * Update a semantic memory (delete and re-add with new content)
 */
async function updateSemanticMemory(userId, projectId, memoryId, event) {
  const body = parseBody(event);
  const { content, category } = body;

  if (!content) {
    return badRequest('content is required');
  }

  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const vectors = getVectorsModule();
  if (!vectors || !VECTORS_BUCKET) {
    return badRequest('Vectors feature not configured');
  }

  try {
    // S3 Vectors doesn't support update in place, so we delete and re-add
    // First, delete the old vector
    await vectors.deleteMemoryFact(userId, projectId, memoryId);

    // Then add the new one with updated content
    await vectors.storeMemoryFact(userId, projectId, {
      factId: memoryId,
      content,
      category: category || 'general',
      confidence: 1.0,
      sourceSessionId: 'manual_edit',
      timestamp: Date.now()
    });

    return success({
      factId: memoryId,
      content,
      category: category || 'general',
      message: 'Memory updated successfully'
    });
  } catch (error) {
    console.error('[SemanticMemory] Update error:', error);
    return serverError(`Failed to update memory: ${error.message}`);
  }
}

/**
 * Delete a semantic memory
 */
async function deleteSemanticMemory(userId, projectId, memoryId) {
  // Verify project belongs to user
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) {
    return notFound('Project not found');
  }

  const vectors = getVectorsModule();
  if (!vectors || !VECTORS_BUCKET) {
    return badRequest('Vectors feature not configured');
  }

  try {
    await vectors.deleteMemoryFact(userId, projectId, memoryId);
    return noContent();
  } catch (error) {
    console.error('[SemanticMemory] Delete error:', error);
    return serverError(`Failed to delete memory: ${error.message}`);
  }
}

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Check if file type is text-based
 */
function isTextFile(type) {
  const textTypes = [
    'text/',
    'application/json',
    'application/javascript',
    'application/typescript',
    'application/xml',
    'application/x-yaml',
    'application/x-python',
  ];
  return textTypes.some(t => type.startsWith(t) || type === t);
}

/**
 * Check if file needs async processing
 */
function needsProcessing(type) {
  return type.startsWith('image/') || type === 'application/pdf';
}

/**
 * S3 Vectors Client for Project Memory Storage
 *
 * Provides functions to create, manage, and query vector indexes
 * for semantic project memory using AWS S3 Vectors.
 */
const {
  S3VectorsClient,
  CreateIndexCommand,
  DeleteIndexCommand,
  ListIndexesCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  DeleteVectorsCommand,
  GetVectorsCommand
} = require('@aws-sdk/client-s3vectors');

const { getEmbedding, EMBEDDING_DIMENSION } = require('./embeddings');

const client = new S3VectorsClient({ region: process.env.AWS_REGION || 'us-east-1' });
const VECTOR_BUCKET = process.env.VECTORS_BUCKET;

// Index naming convention - simplified to stay within 63 char limit
// Format: {projectId}-{type} (lowercase, alphanumeric + hyphen only)
const sanitizeForIndexName = (str) => str.toLowerCase().replace(/[^a-z0-9-]/g, '');
const getConversationsIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-conv`);
const getMemoriesIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-mem`);

/**
 * Create vector indexes for a new project
 * Each project gets two indexes: conversations and memories
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 */
async function createProjectIndexes(userId, projectId) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  const baseConfig = {
    vectorBucketName: VECTOR_BUCKET,
    dimension: EMBEDDING_DIMENSION,
    distanceMetric: 'cosine',
    dataType: 'float32'
  };

  // Conversations index - stores chunked conversation history
  // S3 Vectors does not require metadataConfiguration for basic indexes
  try {
    await client.send(new CreateIndexCommand({
      ...baseConfig,
      indexName: getConversationsIndexName(userId, projectId)
    }));
    console.log(`[Vectors] Created conversations index for project ${projectId}`);
  } catch (err) {
    if (err.name === 'ConflictException' || err.message?.includes('already exists')) {
      console.log(`[Vectors] Conversations index already exists for project ${projectId}`);
    } else {
      throw err;
    }
  }

  // Memories index - stores extracted facts
  try {
    await client.send(new CreateIndexCommand({
      ...baseConfig,
      indexName: getMemoriesIndexName(userId, projectId)
    }));
    console.log(`[Vectors] Created memories index for project ${projectId}`);
  } catch (err) {
    if (err.name === 'ConflictException' || err.message?.includes('already exists')) {
      console.log(`[Vectors] Memories index already exists for project ${projectId}`);
    } else {
      throw err;
    }
  }
}

/**
 * Delete vector indexes when project is deleted
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 */
async function deleteProjectIndexes(userId, projectId) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, skipping index deletion');
    return;
  }

  const indexNames = [
    getConversationsIndexName(userId, projectId),
    getMemoriesIndexName(userId, projectId)
  ];

  for (const indexName of indexNames) {
    try {
      await client.send(new DeleteIndexCommand({
        vectorBucketName: VECTOR_BUCKET,
        indexName
      }));
      console.log(`[Vectors] Deleted index: ${indexName}`);
    } catch (err) {
      if (err.name !== 'ResourceNotFoundException') {
        console.error(`[Vectors] Error deleting index ${indexName}:`, err.message);
      }
    }
  }
}

/**
 * Store a conversation chunk with embedding
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {Object} chunk - Chunk data
 */
async function storeConversationChunk(userId, projectId, chunk) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  const { sessionId, messageId, role, content, timestamp } = chunk;

  const embedding = await getEmbedding(content);

  await client.send(new PutVectorsCommand({
    vectorBucketName: VECTOR_BUCKET,
    indexName: getConversationsIndexName(userId, projectId),
    vectors: [{
      key: `${sessionId}-${messageId}`,
      data: { float32: embedding },
      metadata: {
        sessionId,
        messageId,
        role,
        timestamp: timestamp.toString(),
        projectId,
        userId,
        contentPreview: content.slice(0, 500) // Store preview for retrieval
      }
    }]
  }));
}

/**
 * Store an extracted memory fact with embedding
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {Object} fact - Fact data
 */
async function storeMemoryFact(userId, projectId, fact) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  const { factId, content, category, confidence, sourceSessionId, timestamp } = fact;

  const embedding = await getEmbedding(content);

  await client.send(new PutVectorsCommand({
    vectorBucketName: VECTOR_BUCKET,
    indexName: getMemoriesIndexName(userId, projectId),
    vectors: [{
      key: factId,
      data: { float32: embedding },
      metadata: {
        category,
        confidence: confidence.toString(),
        sourceSessionId,
        timestamp: timestamp.toString(),
        projectId,
        userId,
        content // Store full fact content
      }
    }]
  }));
}

/**
 * Search for relevant memories in a project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Matching memories
 */
async function searchMemories(userId, projectId, query, options = {}) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, returning empty results');
    return [];
  }

  const { topK = 10, minConfidence = 0.5, category = null } = options;

  try {
    const queryEmbedding = await getEmbedding(query);

    // Query without filter for now - S3 Vectors filter syntax TBD
    const response = await client.send(new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName: getMemoriesIndexName(userId, projectId),
      queryVector: { float32: queryEmbedding },
      topK,
      returnMetadata: true
    }));

    return (response.vectors || []).map(v => ({
      factId: v.key,
      content: v.metadata?.content,
      category: v.metadata?.category,
      confidence: parseFloat(v.metadata?.confidence || '0'),
      score: v.score,
      sourceSessionId: v.metadata?.sourceSessionId
    }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`[Vectors] Index not found for project ${projectId}, returning empty results`);
      return [];
    }
    throw err;
  }
}

/**
 * Search for relevant conversation chunks in a project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Matching conversation chunks
 */
async function searchConversations(userId, projectId, query, options = {}) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, returning empty results');
    return [];
  }

  const { topK = 5, sessionId = null, role = null } = options;

  try {
    const queryEmbedding = await getEmbedding(query);

    // Query without filter for now - S3 Vectors filter syntax TBD
    const response = await client.send(new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName: getConversationsIndexName(userId, projectId),
      queryVector: { float32: queryEmbedding },
      topK,
      returnMetadata: true
    }));

    return (response.vectors || []).map(v => ({
      sessionId: v.metadata?.sessionId,
      messageId: v.metadata?.messageId,
      role: v.metadata?.role,
      contentPreview: v.metadata?.contentPreview,
      timestamp: parseInt(v.metadata?.timestamp || '0', 10),
      score: v.score
    }));
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`[Vectors] Index not found for project ${projectId}, returning empty results`);
      return [];
    }
    throw err;
  }
}

/**
 * Delete all vectors for a specific session
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} sessionId - Session ID to delete vectors for
 */
async function deleteSessionVectors(userId, projectId, sessionId) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, skipping deletion');
    return;
  }

  // Note: S3 Vectors may require listing vectors first, then deleting by key
  // This is a simplified implementation - may need to query first
  console.log(`[Vectors] Session ${sessionId} cleanup - vectors will persist (bulk delete not supported)`);
}

/**
 * Delete a specific memory fact by key
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} factId - The fact ID (vector key) to delete
 */
async function deleteMemoryFact(userId, projectId, factId) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  try {
    await client.send(new DeleteVectorsCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName: getMemoriesIndexName(userId, projectId),
      keys: [factId]
    }));
    console.log(`[Vectors] Deleted memory fact: ${factId}`);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`[Vectors] Memory fact ${factId} not found, nothing to delete`);
    } else {
      throw err;
    }
  }
}

/**
 * Check if vector indexes exist for a project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @returns {Promise<boolean>} - Whether indexes exist
 */
async function projectIndexesExist(userId, projectId) {
  if (!VECTOR_BUCKET) {
    return false;
  }

  try {
    const response = await client.send(new ListIndexesCommand({
      vectorBucketName: VECTOR_BUCKET
    }));

    const expectedIndexes = [
      getConversationsIndexName(userId, projectId),
      getMemoriesIndexName(userId, projectId)
    ];

    const existingIndexes = (response.indexes || []).map(i => i.indexName);
    return expectedIndexes.every(idx => existingIndexes.includes(idx));
  } catch (err) {
    console.error('[Vectors] Error checking indexes:', err.message);
    return false;
  }
}

module.exports = {
  createProjectIndexes,
  deleteProjectIndexes,
  storeConversationChunk,
  storeMemoryFact,
  searchMemories,
  searchConversations,
  deleteSessionVectors,
  deleteMemoryFact,
  projectIndexesExist
};

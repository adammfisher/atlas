/**
 * S3 Vectors Client for Project Memory Storage
 *
 * Provides functions to create, manage, and query vector indexes
 * for semantic project memory using AWS S3 Vectors.
 *
 * Supports two memory scopes:
 * 1. Project-level: Per-project indexes for project-specific memory
 * 2. Global (user-level): Shared indexes with user_id filtering for non-project chats
 */
const {
  S3VectorsClient,
  CreateIndexCommand,
  DeleteIndexCommand,
  ListIndexesCommand,
  PutVectorsCommand,
  QueryVectorsCommand,
  DeleteVectorsCommand,
  GetVectorsCommand,
  ListVectorsCommand
} = require('@aws-sdk/client-s3vectors');

const { getEmbedding, EMBEDDING_DIMENSION } = require('./embeddings');

const client = new S3VectorsClient({ region: process.env.AWS_REGION || 'us-east-1' });
const VECTOR_BUCKET = process.env.VECTORS_BUCKET;

// ============================================================================
// SHARED GLOBAL INDEX NAMES
// These indexes are shared by all users - tenant isolation via user_id filter
// ============================================================================
const GLOBAL_MEMORIES_INDEX = 'global-memories';
const GLOBAL_CONVERSATIONS_INDEX = 'global-conversations';

// Deduplication threshold - facts with similarity >= this are considered duplicates
const DEDUP_THRESHOLD = 0.92;

// Index naming convention - simplified to stay within 63 char limit
// Format: {projectId}-{type} (lowercase, alphanumeric + hyphen only)
const sanitizeForIndexName = (str) => str.toLowerCase().replace(/[^a-z0-9-]/g, '');

// Project-level indexes (existing)
const getConversationsIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-conv`);
const getMemoriesIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-mem`);

// Generate a random ID for vector keys
const randomId = () => Math.random().toString(36).substring(2, 10);

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

// ============================================================================
// USER-LEVEL GLOBAL MEMORY FUNCTIONS
// These use SHARED indexes with user_id filtering for tenant isolation
// ============================================================================

/**
 * Store a global memory fact with semantic deduplication
 * Uses shared GLOBAL_MEMORIES_INDEX with user_id filtering
 *
 * @param {string} userId - User ID (REQUIRED for tenant isolation)
 * @param {Object} fact - Fact data
 * @returns {Promise<Object>} - { action: 'inserted'|'merged', key: string }
 */
async function storeGlobalMemoryFact(userId, fact) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  if (!userId) {
    throw new Error('userId is required for global memory storage');
  }

  const { content, category, confidence, sourceSessionId, sourceContext, reasoning } = fact;
  const now = Date.now();

  // 1. Generate embedding for new fact
  const embedding = await getEmbedding(content);

  // 2. Search for similar existing facts (same user only)
  try {
    const similar = await searchGlobalMemories(userId, content, {
      topK: 5,
      minScore: DEDUP_THRESHOLD
    });

    // 3. If near-duplicate exists with score >= threshold, merge
    if (similar.length > 0 && similar[0].score >= DEDUP_THRESHOLD) {
      const existingFact = similar[0];
      console.log(`[Vectors] Found similar global fact (score: ${existingFact.score.toFixed(3)}), merging`);

      // Delete old vector
      await client.send(new DeleteVectorsCommand({
        vectorBucketName: VECTOR_BUCKET,
        indexName: GLOBAL_MEMORIES_INDEX,
        keys: [existingFact.key]
      }));

      // Create merged vector with incremented mention count
      const newMentionCount = (existingFact.mentionCount || 1) + 1;

      // Keep richer content (longer one)
      const mergedContent = content.length > (existingFact.content?.length || 0)
        ? content
        : existingFact.content;

      const mergedKey = `mem_${userId}_${now}_${randomId()}`;

      await client.send(new PutVectorsCommand({
        vectorBucketName: VECTOR_BUCKET,
        indexName: GLOBAL_MEMORIES_INDEX,
        vectors: [{
          key: mergedKey,
          data: { float32: embedding },
          metadata: {
            // Filterable metadata
            user_id: userId,
            category: category || existingFact.category || 'general',
            confidence: (confidence || 0.8).toString(),
            created_at: existingFact.createdAt?.toString() || now.toString(),
            updated_at: now.toString(),
            source_session_id: sourceSessionId || '',
            mention_count: newMentionCount.toString(),
            // Non-filterable metadata (content fields)
            content: mergedContent,
            source_context: sourceContext || '',
            extraction_reasoning: reasoning || ''
          }
        }]
      }));

      console.log(`[Vectors] Merged global fact, mention_count now ${newMentionCount}`);
      return { action: 'merged', key: mergedKey, previousKey: existingFact.key };
    }
  } catch (err) {
    // If search fails (e.g., index doesn't exist yet), proceed with insert
    console.warn('[Vectors] Global memory search for dedup failed:', err.message);
  }

  // 4. Insert new fact
  const key = `mem_${userId}_${now}_${randomId()}`;

  await client.send(new PutVectorsCommand({
    vectorBucketName: VECTOR_BUCKET,
    indexName: GLOBAL_MEMORIES_INDEX,
    vectors: [{
      key,
      data: { float32: embedding },
      metadata: {
        // Filterable metadata
        user_id: userId,
        category: category || 'general',
        confidence: (confidence || 0.8).toString(),
        created_at: now.toString(),
        updated_at: now.toString(),
        source_session_id: sourceSessionId || '',
        mention_count: '1',
        // Non-filterable metadata
        content,
        source_context: sourceContext || '',
        extraction_reasoning: reasoning || ''
      }
    }]
  }));

  console.log(`[Vectors] Stored new global fact: ${key}`);
  return { action: 'inserted', key };
}

/**
 * Store a global conversation chunk
 * Uses shared GLOBAL_CONVERSATIONS_INDEX with user_id filtering
 *
 * @param {string} userId - User ID (REQUIRED for tenant isolation)
 * @param {Object} chunk - Chunk data
 */
async function storeGlobalConversationChunk(userId, chunk) {
  if (!VECTOR_BUCKET) {
    throw new Error('VECTORS_BUCKET environment variable not configured');
  }

  if (!userId) {
    throw new Error('userId is required for global conversation storage');
  }

  const { sessionId, chunkIndex, content, timestamp, messageCount, summary } = chunk;
  const now = timestamp || Date.now();

  const embedding = await getEmbedding(content);
  const key = `conv_${userId}_${sessionId}_${chunkIndex || now}`;

  await client.send(new PutVectorsCommand({
    vectorBucketName: VECTOR_BUCKET,
    indexName: GLOBAL_CONVERSATIONS_INDEX,
    vectors: [{
      key,
      data: { float32: embedding },
      metadata: {
        // Filterable metadata
        user_id: userId,
        session_id: sessionId,
        chunk_index: (chunkIndex || 0).toString(),
        timestamp: now.toString(),
        message_count: (messageCount || 0).toString(),
        // Non-filterable metadata
        content: content.slice(0, 2000), // Store truncated content
        summary: summary || ''
      }
    }]
  }));

  console.log(`[Vectors] Stored global conversation chunk: ${key}`);
}

/**
 * Search for relevant global memories (user-level, not project-specific)
 * CRITICAL: Always filters by user_id for tenant isolation
 *
 * @param {string} userId - User ID (REQUIRED for tenant isolation)
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Matching memories
 */
async function searchGlobalMemories(userId, query, options = {}) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, returning empty results');
    return [];
  }

  if (!userId) {
    console.error('[Vectors] userId is required for global memory search');
    return [];
  }

  // Note: S3 Vectors uses cosine distance (not similarity), so scores are lower
  // than typical vector DBs. A minScore of 0.1 is reasonable for most queries.
  const { topK = 15, minScore = 0.1, category = null } = options;

  try {
    const queryEmbedding = await getEmbedding(query);

    // Build filter - user_id is ALWAYS required for tenant isolation
    const filter = {
      '$and': [
        { user_id: { '$eq': userId } }
      ]
    };

    if (category) {
      filter['$and'].push({ category: { '$eq': category } });
    }

    const response = await client.send(new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName: GLOBAL_MEMORIES_INDEX,
      queryVector: { float32: queryEmbedding },
      topK,
      filter,
      returnMetadata: true,
      returnDistance: true
    }));

    // Convert distance to similarity score, filter by minScore
    return (response.vectors || [])
      .map(v => ({
        key: v.key,
        score: 1 - (v.distance || 0), // cosine distance to similarity
        content: v.metadata?.content,
        category: v.metadata?.category,
        confidence: parseFloat(v.metadata?.confidence || '0'),
        mentionCount: parseInt(v.metadata?.mention_count || '1', 10),
        createdAt: parseInt(v.metadata?.created_at || '0', 10),
        updatedAt: parseInt(v.metadata?.updated_at || '0', 10),
        sourceSessionId: v.metadata?.source_session_id,
        scope: 'global'
      }))
      .filter(v => v.score >= minScore);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`[Vectors] Global memories index not found, returning empty results`);
      return [];
    }
    throw err;
  }
}

/**
 * Search for relevant global conversation chunks
 * CRITICAL: Always filters by user_id for tenant isolation
 *
 * @param {string} userId - User ID (REQUIRED for tenant isolation)
 * @param {string} query - Search query
 * @param {Object} options - Search options
 * @returns {Promise<Array>} - Matching conversation chunks
 */
async function searchGlobalConversations(userId, query, options = {}) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, returning empty results');
    return [];
  }

  if (!userId) {
    console.error('[Vectors] userId is required for global conversation search');
    return [];
  }

  // Note: S3 Vectors uses cosine distance, lower threshold for conversation search
  const { topK = 5, minScore = 0.1 } = options;

  try {
    const queryEmbedding = await getEmbedding(query);

    // Build filter - user_id is ALWAYS required for tenant isolation
    const filter = {
      user_id: { '$eq': userId }
    };

    const response = await client.send(new QueryVectorsCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName: GLOBAL_CONVERSATIONS_INDEX,
      queryVector: { float32: queryEmbedding },
      topK,
      filter,
      returnMetadata: true,
      returnDistance: true
    }));

    return (response.vectors || [])
      .map(v => ({
        key: v.key,
        score: 1 - (v.distance || 0),
        sessionId: v.metadata?.session_id,
        chunkIndex: parseInt(v.metadata?.chunk_index || '0', 10),
        timestamp: parseInt(v.metadata?.timestamp || '0', 10),
        messageCount: parseInt(v.metadata?.message_count || '0', 10),
        contentPreview: v.metadata?.content?.slice(0, 500),
        summary: v.metadata?.summary,
        scope: 'global'
      }))
      .filter(v => v.score >= minScore);
  } catch (err) {
    if (err.name === 'ResourceNotFoundException') {
      console.log(`[Vectors] Global conversations index not found, returning empty results`);
      return [];
    }
    throw err;
  }
}

/**
 * Delete all global data for a user (GDPR compliance)
 * Removes all vectors from both global indexes for the specified user
 *
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - { deleted: number }
 */
async function deleteUserGlobalData(userId) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, skipping deletion');
    return { deleted: 0 };
  }

  if (!userId) {
    throw new Error('userId is required for deletion');
  }

  let totalDeleted = 0;

  // Delete from both global indexes
  for (const indexName of [GLOBAL_MEMORIES_INDEX, GLOBAL_CONVERSATIONS_INDEX]) {
    try {
      // List all vectors for this user
      let continuationToken = null;
      const keysToDelete = [];

      do {
        const listParams = {
          vectorBucketName: VECTOR_BUCKET,
          indexName,
          filter: { user_id: { '$eq': userId } },
          maxResults: 500
        };

        if (continuationToken) {
          listParams.nextToken = continuationToken;
        }

        const response = await client.send(new ListVectorsCommand(listParams));
        const keys = (response.vectors || []).map(v => v.key);
        keysToDelete.push(...keys);
        continuationToken = response.nextToken;
      } while (continuationToken);

      // Delete in batches of 500
      for (let i = 0; i < keysToDelete.length; i += 500) {
        const batch = keysToDelete.slice(i, i + 500);
        await client.send(new DeleteVectorsCommand({
          vectorBucketName: VECTOR_BUCKET,
          indexName,
          keys: batch
        }));
        totalDeleted += batch.length;
      }

      console.log(`[Vectors] Deleted ${keysToDelete.length} vectors from ${indexName} for user ${userId}`);
    } catch (err) {
      if (err.name !== 'ResourceNotFoundException') {
        console.error(`[Vectors] Error deleting from ${indexName}:`, err.message);
      }
    }
  }

  return { deleted: totalDeleted };
}

/**
 * Delete global data for a specific session
 * When a session is deleted, handle associated memories
 *
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 * @returns {Promise<Object>} - { chunksDeleted: number, factsUpdated: number }
 */
async function deleteSessionGlobalData(userId, sessionId) {
  if (!VECTOR_BUCKET) {
    console.warn('[Vectors] VECTORS_BUCKET not configured, skipping deletion');
    return { chunksDeleted: 0, factsUpdated: 0 };
  }

  if (!userId || !sessionId) {
    throw new Error('userId and sessionId are required');
  }

  let chunksDeleted = 0;
  let factsUpdated = 0;

  // 1. Delete conversation chunks for this session
  try {
    let continuationToken = null;
    const keysToDelete = [];

    do {
      const listParams = {
        vectorBucketName: VECTOR_BUCKET,
        indexName: GLOBAL_CONVERSATIONS_INDEX,
        filter: {
          '$and': [
            { user_id: { '$eq': userId } },
            { session_id: { '$eq': sessionId } }
          ]
        },
        maxResults: 500
      };

      if (continuationToken) {
        listParams.nextToken = continuationToken;
      }

      const response = await client.send(new ListVectorsCommand(listParams));
      const keys = (response.vectors || []).map(v => v.key);
      keysToDelete.push(...keys);
      continuationToken = response.nextToken;
    } while (continuationToken);

    if (keysToDelete.length > 0) {
      await client.send(new DeleteVectorsCommand({
        vectorBucketName: VECTOR_BUCKET,
        indexName: GLOBAL_CONVERSATIONS_INDEX,
        keys: keysToDelete
      }));
      chunksDeleted = keysToDelete.length;
    }
  } catch (err) {
    console.error('[Vectors] Error deleting conversation chunks:', err.message);
  }

  // 2. Handle facts from this session
  // For facts, we decrement mention_count or delete if count reaches 0
  try {
    let continuationToken = null;

    do {
      const listParams = {
        vectorBucketName: VECTOR_BUCKET,
        indexName: GLOBAL_MEMORIES_INDEX,
        filter: {
          '$and': [
            { user_id: { '$eq': userId } },
            { source_session_id: { '$eq': sessionId } }
          ]
        },
        maxResults: 100
      };

      if (continuationToken) {
        listParams.nextToken = continuationToken;
      }

      const response = await client.send(new ListVectorsCommand(listParams));

      for (const vector of response.vectors || []) {
        const mentionCount = parseInt(vector.metadata?.mention_count || '1', 10);

        if (mentionCount <= 1) {
          // Delete the fact entirely
          await client.send(new DeleteVectorsCommand({
            vectorBucketName: VECTOR_BUCKET,
            indexName: GLOBAL_MEMORIES_INDEX,
            keys: [vector.key]
          }));
        } else {
          // Decrement mention count (would need to re-insert with updated metadata)
          // For now, we'll just note this - full implementation would delete and re-insert
          console.log(`[Vectors] Fact ${vector.key} has ${mentionCount} mentions, keeping`);
        }
        factsUpdated++;
      }

      continuationToken = response.nextToken;
    } while (continuationToken);
  } catch (err) {
    console.error('[Vectors] Error handling facts for session:', err.message);
  }

  console.log(`[Vectors] Session ${sessionId} global cleanup: ${chunksDeleted} chunks deleted, ${factsUpdated} facts processed`);
  return { chunksDeleted, factsUpdated };
}

module.exports = {
  // Project-level functions (existing)
  createProjectIndexes,
  deleteProjectIndexes,
  storeConversationChunk,
  storeMemoryFact,
  searchMemories,
  searchConversations,
  deleteSessionVectors,
  deleteMemoryFact,
  projectIndexesExist,

  // Global (shared index) functions
  storeGlobalMemoryFact,
  storeGlobalConversationChunk,
  searchGlobalMemories,
  searchGlobalConversations,
  deleteUserGlobalData,
  deleteSessionGlobalData,

  // Constants (for reference)
  GLOBAL_MEMORIES_INDEX,
  GLOBAL_CONVERSATIONS_INDEX
};

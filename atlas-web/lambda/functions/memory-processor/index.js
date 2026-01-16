/**
 * Memory Processor Lambda
 *
 * Processes conversations in the background to extract facts and store embeddings.
 * This function is triggered after chat sessions end or on a schedule.
 */
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, QueryCommand, UpdateCommand, GetCommand } = require('@aws-sdk/lib-dynamodb');

// Import shared modules
const { extractFacts, chunkConversation } = require('/opt/nodejs/shared/memoryExtractor');
const {
  storeConversationChunk,
  storeMemoryFact,
  createProjectIndexes,
  projectIndexesExist,
  // Global memory functions
  storeGlobalConversationChunk,
  storeGlobalMemoryFact
} = require('/opt/nodejs/shared/vectors');

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || 'us-east-1' });
const docClient = DynamoDBDocumentClient.from(dynamoClient);

const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;

/**
 * Main handler - processes memory for a session or project
 * @param {Object} event - Lambda event
 */
exports.handler = async (event) => {
  console.log('[MemoryProcessor] Event:', JSON.stringify(event));

  try {
    // Handle different invocation types
    if (event.action === 'processSession') {
      return await processSession(event.userId, event.projectId, event.sessionId);
    } else if (event.action === 'processProject') {
      return await processProject(event.userId, event.projectId);
    } else if (event.action === 'processGlobalSession') {
      // NEW: Process non-project session for global memory
      return await processGlobalSession(event.userId, event.sessionId);
    } else if (event.action === 'initializeIndexes') {
      return await initializeProjectIndexes(event.userId, event.projectId);
    } else if (event.Records) {
      // DynamoDB Stream trigger
      return await handleStreamRecords(event.Records);
    } else {
      console.warn('[MemoryProcessor] Unknown event type:', event);
      return { statusCode: 400, body: 'Unknown event type' };
    }
  } catch (err) {
    console.error('[MemoryProcessor] Error:', err);
    return { statusCode: 500, body: err.message };
  }
};

/**
 * Initialize vector indexes for a project
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 */
async function initializeProjectIndexes(userId, projectId) {
  console.log(`[MemoryProcessor] Initializing indexes for project ${projectId}`);

  // Check if indexes already exist
  const exists = await projectIndexesExist(userId, projectId);
  if (exists) {
    console.log(`[MemoryProcessor] Indexes already exist for project ${projectId}`);
    return { statusCode: 200, body: 'Indexes already exist' };
  }

  // Create indexes
  await createProjectIndexes(userId, projectId);

  console.log(`[MemoryProcessor] Successfully initialized indexes for project ${projectId}`);
  return { statusCode: 200, body: 'Indexes created successfully' };
}

/**
 * Process a single session - extract facts and store embeddings
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 * @param {string} sessionId - Session ID
 */
async function processSession(userId, projectId, sessionId) {
  console.log(`[MemoryProcessor] Processing session ${sessionId} for project ${projectId}`);

  // Ensure indexes exist
  await initializeProjectIndexes(userId, projectId);

  // Fetch all messages for the session
  const messages = await getSessionMessages(sessionId);
  if (messages.length === 0) {
    console.log(`[MemoryProcessor] No messages found for session ${sessionId}`);
    return { statusCode: 200, body: 'No messages to process' };
  }

  console.log(`[MemoryProcessor] Found ${messages.length} messages to process`);

  // 1. Chunk and embed conversation for retrieval
  const chunks = chunkConversation(messages);
  console.log(`[MemoryProcessor] Created ${chunks.length} conversation chunks`);

  let chunksStored = 0;
  for (const chunk of chunks) {
    try {
      await storeConversationChunk(userId, projectId, {
        sessionId,
        messageId: `chunk_${chunksStored}`,
        role: 'mixed',
        content: chunk.content,
        timestamp: chunk.startTimestamp
      });
      chunksStored++;
    } catch (err) {
      console.error(`[MemoryProcessor] Failed to store chunk:`, err.message);
    }
  }

  // 2. Extract discrete facts using Haiku
  const facts = await extractFacts(messages);
  console.log(`[MemoryProcessor] Extracted ${facts.length} facts`);

  let factsStored = 0;
  for (const fact of facts) {
    try {
      await storeMemoryFact(userId, projectId, {
        ...fact,
        sourceSessionId: sessionId
      });
      factsStored++;
    } catch (err) {
      console.error(`[MemoryProcessor] Failed to store fact:`, err.message);
    }
  }

  // Update session with processing status
  await updateSessionProcessingStatus(sessionId, {
    chunksStored,
    factsExtracted: factsStored,
    processedAt: Date.now()
  });

  console.log(`[MemoryProcessor] Session ${sessionId} processed: ${chunksStored} chunks, ${factsStored} facts`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      sessionId,
      chunksStored,
      factsExtracted: factsStored
    })
  };
}

/**
 * Process all sessions in a project (for migration or reprocessing)
 * @param {string} userId - User ID
 * @param {string} projectId - Project ID
 */
async function processProject(userId, projectId) {
  console.log(`[MemoryProcessor] Processing all sessions for project ${projectId}`);

  // Ensure indexes exist
  await initializeProjectIndexes(userId, projectId);

  // Get all sessions for the project
  const sessions = await getProjectSessions(projectId);
  console.log(`[MemoryProcessor] Found ${sessions.length} sessions to process`);

  let totalChunks = 0;
  let totalFacts = 0;
  let sessionsProcessed = 0;

  for (const session of sessions) {
    try {
      const result = await processSession(userId, projectId, session.sessionId);
      const body = JSON.parse(result.body);
      totalChunks += body.chunksStored || 0;
      totalFacts += body.factsExtracted || 0;
      sessionsProcessed++;
    } catch (err) {
      console.error(`[MemoryProcessor] Failed to process session ${session.sessionId}:`, err.message);
    }
  }

  console.log(`[MemoryProcessor] Project ${projectId} complete: ${sessionsProcessed} sessions, ${totalChunks} chunks, ${totalFacts} facts`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      projectId,
      sessionsProcessed,
      totalChunks,
      totalFacts
    })
  };
}

/**
 * Process a global (non-project) session - store in shared global indexes
 * This is for conversations that are NOT associated with a project
 * @param {string} userId - User ID
 * @param {string} sessionId - Session ID
 */
async function processGlobalSession(userId, sessionId) {
  console.log(`[MemoryProcessor] Processing global session ${sessionId} for user ${userId}`);

  // Fetch all messages for the session
  const messages = await getSessionMessages(sessionId);
  if (messages.length === 0) {
    console.log(`[MemoryProcessor] No messages found for session ${sessionId}`);
    return { statusCode: 200, body: 'No messages to process' };
  }

  console.log(`[MemoryProcessor] Found ${messages.length} messages to process`);

  // 1. Chunk and embed conversation
  const chunks = chunkConversation(messages);
  let chunksStored = 0;

  for (const chunk of chunks) {
    try {
      await storeGlobalConversationChunk(userId, {
        sessionId,
        chunkIndex: chunksStored,
        content: chunk.content,
        timestamp: chunk.startTimestamp,
        messageCount: chunk.messageCount
      });
      chunksStored++;
    } catch (err) {
      console.error(`[MemoryProcessor] Failed to store global chunk:`, err.message);
    }
  }

  // 2. Extract and store facts
  const facts = await extractFacts(messages);
  let factsStored = 0;

  for (const fact of facts) {
    try {
      await storeGlobalMemoryFact(userId, {
        ...fact,
        sourceSessionId: sessionId
      });
      factsStored++;
    } catch (err) {
      console.error(`[MemoryProcessor] Failed to store global fact:`, err.message);
    }
  }

  // Update session processing status
  await updateSessionProcessingStatus(sessionId, {
    chunksStored,
    factsExtracted: factsStored,
    processedAt: Date.now(),
    scope: 'global'
  });

  console.log(`[MemoryProcessor] Global session ${sessionId} processed: ${chunksStored} chunks, ${factsStored} facts`);

  return {
    statusCode: 200,
    body: JSON.stringify({
      sessionId,
      chunksStored,
      factsExtracted: factsStored,
      scope: 'global'
    })
  };
}

/**
 * Handle DynamoDB stream records (for real-time processing)
 * @param {Array} records - Stream records
 */
async function handleStreamRecords(records) {
  console.log(`[MemoryProcessor] Processing ${records.length} stream records`);

  for (const record of records) {
    if (record.eventName !== 'INSERT' && record.eventName !== 'MODIFY') {
      continue;
    }

    // Check if this is a session end event
    const newImage = record.dynamodb?.NewImage;
    if (newImage?.status?.S === 'ended' && newImage?.projectId?.S) {
      const sessionId = newImage.sessionId?.S;
      const projectId = newImage.projectId?.S;
      const userId = newImage.userId?.S;

      if (sessionId && projectId && userId) {
        console.log(`[MemoryProcessor] Session ended, processing: ${sessionId}`);
        await processSession(userId, projectId, sessionId);
      }
    }
  }

  return { statusCode: 200, body: 'Stream records processed' };
}

/**
 * Fetch all messages for a session
 * @param {string} sessionId - Session ID
 * @returns {Promise<Array>} - Array of messages
 */
async function getSessionMessages(sessionId) {
  const messages = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: MESSAGES_TABLE,
      KeyConditionExpression: 'sessionId = :sessionId',
      ExpressionAttributeValues: {
        ':sessionId': sessionId
      },
      ScanIndexForward: true // Chronological order
    };

    // Only add ExclusiveStartKey if we have one from a previous page
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new QueryCommand(params));

    messages.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  // Format for extraction
  return messages.map(m => ({
    role: m.role,
    content: m.content,
    timestamp: m.timestamp
  }));
}

/**
 * Get all sessions for a project
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} - Array of sessions
 */
async function getProjectSessions(projectId) {
  const sessions = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: SESSIONS_TABLE,
      IndexName: 'projectId-updatedAt-index',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    };

    // Only add ExclusiveStartKey if we have one from a previous page
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new QueryCommand(params));

    sessions.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return sessions;
}

/**
 * Update session with memory processing status
 * @param {string} sessionId - Session ID
 * @param {Object} stats - Processing statistics
 */
async function updateSessionProcessingStatus(sessionId, stats) {
  try {
    await docClient.send(new UpdateCommand({
      TableName: SESSIONS_TABLE,
      Key: { sessionId },
      UpdateExpression: 'SET memoryProcessing = :stats',
      ExpressionAttributeValues: {
        ':stats': stats
      }
    }));
  } catch (err) {
    console.error(`[MemoryProcessor] Failed to update session status:`, err.message);
  }
}

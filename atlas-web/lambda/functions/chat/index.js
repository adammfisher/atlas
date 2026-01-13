const {
  buildSystemPrompt,
  buildMessages,
  streamChatWithTools,
  compactConversation
} = require('./shared/bedrock');
const { getItem, putItem, queryItems, updateItem } = require('./shared/dynamodb');
const { getContent, uploadContent, getContentType } = require('./shared/s3');
const {
  success,
  badRequest,
  serverError,
  getUserId,
  parseBody,
  sseHeaders,
  sseEvent
} = require('./shared/response');
const { processFilesWithZipExtraction, isZipFile } = require('./shared/zip');
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');

// Bedrock client for memory generation
const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });
const MEMORY_MODEL = 'us.anthropic.claude-3-5-haiku-20241022-v1:0';

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;
const PROJECT_FILES_TABLE = process.env.PROJECT_FILES_TABLE;
const PROJECT_MEMORY_TABLE = process.env.PROJECT_MEMORY_TABLE;
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE;
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

// Token budget constants for context assembly
const CONTEXT_BUDGET = {
  total: 200000,
  memory: 15000,        // ~15K tokens for synthesized memory
  pinnedFiles: 50000,   // ~50K for pinned file contents
  fileManifest: 2000,   // ~2K for file list/manifest
  systemPrompt: 5000,   // ~5K for system instructions
  conversation: 100000  // Rest for conversation history
};

/**
 * Main handler - routes to appropriate function
 */
exports.handler = async (event, context) => {
  console.log('Chat event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;

  try {
    // Route to appropriate handler
    if (path.endsWith('/stream') || path.includes('/with-files')) {
      return handleStreamingChat(event);
    } else if (method === 'POST' && path.endsWith('/message')) {
      return handleChat(event);
    }

    return badRequest('Invalid route');
  } catch (error) {
    console.error('Chat error:', error);
    return serverError(error.message);
  }
};

/**
 * Streaming handler using Lambda Response Streaming
 * This is the entry point for streaming responses
 * Note: CORS is handled by Lambda Function URL configuration, not in code
 */
exports.streamHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    console.log('Stream handler event:', JSON.stringify(event));

    // Set up the response metadata for streaming
    // Note: Don't add CORS headers here - Lambda Function URL handles them
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    };

    // Create the HTTP response stream
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    try {
      await handleStreamingChatWithStream(event, responseStream);
    } catch (error) {
      console.error('Streaming error:', error);
      responseStream.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
    } finally {
      responseStream.end();
    }
  }
);

/**
 * Handle streaming chat with direct stream writing (for Lambda Response Streaming)
 */
async function handleStreamingChatWithStream(event, responseStream) {
  const userId = getUserId(event);
  const body = parseBody(event);

  const {
    message,
    session_id: sessionId,
    project_id: projectId,
    model = 'sonnet',
    web_search_enabled: webSearchEnabled = true,
    extended_thinking_enabled: extendedThinkingEnabled = false,
    enabled_connectors: enabledConnectors = [],
    files = []
  } = body;

  if (!message && files.length === 0) {
    responseStream.write(`data: ${JSON.stringify({ type: 'error', message: 'Message or files required' })}\n\n`);
    return;
  }

  // Get or create session
  let session = null;
  let activeSessionId = sessionId;

  console.log('Looking up session:', { userId, sessionId, hasSessionId: !!sessionId });

  if (sessionId) {
    session = await getItem(SESSIONS_TABLE, { userId, sessionId });
    console.log('Session lookup result:', session ? 'found' : 'NOT FOUND');
  }

  if (!session) {
    activeSessionId = `session_${Date.now()}`;
    console.log('Creating new session:', activeSessionId);
    session = {
      userId,
      sessionId: activeSessionId,
      projectId: projectId || null,
      title: null,
      starred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await putItem(SESSIONS_TABLE, session);
  } else {
    console.log('Using existing session:', activeSessionId);
  }

  // Get conversation history
  console.log('Querying messages for session:', activeSessionId);
  const history = await queryItems(MESSAGES_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': activeSessionId }
  });

  // Sort by timestamp to ensure correct message order
  history.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  console.log('Found', history.length, 'messages in history');

  console.log('Conversation history:', history.length, 'messages');
  history.forEach((m, i) => {
    console.log(`  [${i}] ${m.role}: ${m.content?.substring(0, 200)}...`);
  });

  // Get project context if in a project
  // Use projectId from request if session doesn't have one (for new sessions)
  const effectiveProjectId = session.projectId || projectId;
  let projectContext = null;
  console.log('[ProjectContext] Checking:', { sessionProjectId: session.projectId, requestProjectId: projectId, effectiveProjectId });
  if (effectiveProjectId) {
    projectContext = await getProjectContext(userId, effectiveProjectId);
    console.log('[ProjectContext] Result:', projectContext ? `Found: ${projectContext.project?.name}` : 'NOT FOUND');
  } else {
    console.log('[ProjectContext] No projectId, skipping');
  }

  // Compact conversation if needed (token-based)
  let compactedContext = null;
  let recentHistory = history;

  const cachedSummary = await getItem(SUMMARIES_TABLE, { sessionId: activeSessionId });
  const compacted = await compactConversation(history, cachedSummary, model);

  if (compacted.compacted) {
    recentHistory = compacted.recentMessages;
    compactedContext = compacted.compactedContext;

    // Cache the summary with token count for validation
    await putItem(SUMMARIES_TABLE, {
      sessionId: activeSessionId,
      tokenCount: compacted.tokenCount,
      messageCount: compacted.messageCount,
      keyPoints: compacted.keyPoints,
      middleSummary: compacted.middleSummary,
      updatedAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 86400 * 7
    });

    // Log compaction stats
    if (compacted.stats) {
      console.log(`[Compaction] Original: ${compacted.stats.originalTokens} tokens, After: ${compacted.stats.recentTokens} tokens, Summarized: ${compacted.stats.summarizedMessages} messages`);
    }
  }

  // Build system prompt and messages
  const systemPrompt = buildSystemPrompt(projectContext, webSearchEnabled);

  // Process files, extracting any zip files
  let processedFiles = files;
  let zipExtractionInfo = null;

  const hasZipFiles = files.some(f => isZipFile(f));
  if (hasZipFiles) {
    responseStream.write(`data: ${JSON.stringify({ type: 'processing', message: 'Extracting zip file contents...' })}\n\n`);
    try {
      const result = await processFilesWithZipExtraction(files);
      processedFiles = result.files;
      zipExtractionInfo = result.zipResults;

      // Log extraction results
      for (const zipResult of result.zipResults) {
        if (zipResult.success) {
          console.log(`Extracted ${zipResult.extractedCount} files from ${zipResult.zipName}`);
          responseStream.write(`data: ${JSON.stringify({
            type: 'processing',
            message: `${zipResult.summary}`
          })}\n\n`);
        } else {
          console.error(`Failed to extract ${zipResult.zipName}: ${zipResult.error}`);
        }
      }
    } catch (error) {
      console.error('Zip extraction error:', error);
      responseStream.write(`data: ${JSON.stringify({ type: 'processing', message: 'Warning: Could not extract some zip contents' })}\n\n`);
    }
  }

  const messageFiles = processedFiles.map(f => ({
    name: f.name,
    mediaType: f.type,
    base64: f.base64
  }));
  const messages = buildMessages(
    recentHistory.map(m => ({ role: m.role, content: m.content })),
    { text: message || '', files: messageFiles },
    projectContext,
    compactedContext
  );

  // Save user message
  const userMessageId = `msg_${Date.now()}_user`;
  await putItem(MESSAGES_TABLE, {
    sessionId: activeSessionId,
    messageId: userMessageId,
    role: 'user',
    content: message,
    timestamp: Date.now()
  });

  // Notify client that we're processing files
  if (messageFiles.length > 0) {
    const fileTypes = messageFiles.map(f => {
      if (f.mediaType.startsWith('image/')) return 'image';
      if (f.mediaType === 'application/pdf') return 'PDF';
      return 'file';
    });
    const uniqueTypes = [...new Set(fileTypes)];
    const processingMsg = uniqueTypes.length === 1 && uniqueTypes[0] === 'image'
      ? `Analyzing ${messageFiles.length === 1 ? 'image' : 'images'}...`
      : `Processing ${messageFiles.length} ${messageFiles.length === 1 ? 'file' : 'files'}...`;
    responseStream.write(`data: ${JSON.stringify({ type: 'processing', message: processingMsg })}\n\n`);
  }

  // Stream response directly to client
  let fullResponse = '';
  let thinkingContent = '';
  const artifacts = [];

  try {
    for await (const chunk of streamChatWithTools({
      messages,
      model,
      systemPrompt,
      extendedThinking: extendedThinkingEnabled,
      webSearch: webSearchEnabled
    })) {
      if (chunk.type === 'text') {
        fullResponse += chunk.content;
        // Write directly to stream
        responseStream.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk.content })}\n\n`);

        // Check for artifact patterns
        const detectedArtifact = detectArtifact(fullResponse);
        if (detectedArtifact && !artifacts.find(a => a.pattern === detectedArtifact.pattern)) {
          artifacts.push(detectedArtifact);
          responseStream.write(`data: ${JSON.stringify({
            type: 'artifact_start',
            artifact: {
              id: detectedArtifact.id,
              name: detectedArtifact.name,
              type: detectedArtifact.type,
              status: 'generating'
            }
          })}\n\n`);
        }
      } else if (chunk.type === 'thinking') {
        thinkingContent += chunk.content;
        responseStream.write(`data: ${JSON.stringify({ type: 'thinking', content: chunk.content })}\n\n`);
      } else if (chunk.type === 'search_start') {
        responseStream.write(`data: ${JSON.stringify({ type: 'search_start', query: chunk.query })}\n\n`);
      } else if (chunk.type === 'search_results') {
        responseStream.write(`data: ${JSON.stringify({ type: 'search_results', query: chunk.query, results: chunk.results })}\n\n`);
      } else if (chunk.type === 'metadata') {
        responseStream.write(`data: ${JSON.stringify({ type: 'metadata', usage: chunk.usage })}\n\n`);
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    responseStream.write(`data: ${JSON.stringify({ type: 'error', message: error.message })}\n\n`);
  }

  // Save assistant message
  const assistantMessageId = `msg_${Date.now()}_assistant`;
  await putItem(MESSAGES_TABLE, {
    sessionId: activeSessionId,
    messageId: assistantMessageId,
    role: 'assistant',
    content: fullResponse,
    thinking: thinkingContent || null,
    timestamp: Date.now()
  });

  // Process and save artifacts
  for (const artifact of artifacts) {
    const extracted = extractArtifactContent(fullResponse, artifact);
    if (extracted) {
      const s3Key = `${activeSessionId}/${artifact.id}-${artifact.name}`;
      await uploadContent(ARTIFACTS_BUCKET, s3Key, extracted.content, getContentType(artifact.name));
      await putItem(ARTIFACTS_TABLE, {
        sessionId: activeSessionId,
        artifactId: artifact.id,
        name: artifact.name,
        type: artifact.type,
        s3Key,
        createdAt: Date.now()
      });
      responseStream.write(`data: ${JSON.stringify({
        type: 'artifact_complete',
        artifact_id: artifact.id,
        name: artifact.name,
        type: artifact.type
      })}\n\n`);
    }
  }

  // Update session
  await updateItem(SESSIONS_TABLE,
    { userId, sessionId: activeSessionId },
    {
      updatedAt: Date.now(),
      title: session.title || generateTitle(message)
    }
  );

  // Update project memory (non-blocking)
  if (effectiveProjectId && fullResponse) {
    updateProjectMemoryIncremental(userId, effectiveProjectId, message, fullResponse)
      .catch(err => console.error('[Memory] Background update failed:', err.message));
  }

  // Send completion event
  responseStream.write(`data: ${JSON.stringify({
    type: 'done',
    message_id: assistantMessageId,
    session_id: activeSessionId
  })}\n\n`);
}

/**
 * Handle streaming chat (buffered response for API Gateway)
 */
async function handleStreamingChat(event) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  const {
    message,
    session_id: sessionId,
    project_id: projectId,
    model = 'sonnet',
    web_search_enabled: webSearchEnabled = true,
    extended_thinking_enabled: extendedThinkingEnabled = false,
    enabled_connectors: enabledConnectors = [],
    files = []
  } = body;

  if (!message && files.length === 0) {
    return badRequest('Message or files required');
  }

  // Get or create session
  let session = null;
  let activeSessionId = sessionId;
  
  if (sessionId) {
    session = await getItem(SESSIONS_TABLE, { userId, sessionId });
  }
  
  if (!session) {
    activeSessionId = `session_${Date.now()}`;
    session = {
      userId,
      sessionId: activeSessionId,
      projectId: projectId || null,
      title: null,
      starred: false,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    await putItem(SESSIONS_TABLE, session);
  }

  // Get conversation history
  const history = await queryItems(MESSAGES_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': activeSessionId }
  });

  // Sort by timestamp to ensure correct message order
  history.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  console.log('Conversation history (API Gateway):', history.length, 'messages');
  history.forEach((m, i) => {
    console.log(`  [${i}] ${m.role}: ${m.content?.substring(0, 200)}...`);
  });

  // Get project context if in a project
  // Use projectId from request if session doesn't have one (for new sessions)
  const effectiveProjectId = session.projectId || projectId;
  let projectContext = null;
  console.log('[ProjectContext API GW] Checking:', { sessionProjectId: session.projectId, requestProjectId: projectId, effectiveProjectId });
  if (effectiveProjectId) {
    projectContext = await getProjectContext(userId, effectiveProjectId);
    console.log('[ProjectContext API GW] Result:', projectContext ? `Found: ${projectContext.project?.name}` : 'NOT FOUND');
  } else {
    console.log('[ProjectContext API GW] No projectId, skipping');
  }

  // Compact conversation if needed (token-based)
  let compactedContext = null;
  let recentHistory = history;

  const cachedSummary = await getItem(SUMMARIES_TABLE, { sessionId: activeSessionId });
  const compacted = await compactConversation(history, cachedSummary, model);

  if (compacted.compacted) {
    recentHistory = compacted.recentMessages;
    compactedContext = compacted.compactedContext;

    // Cache the summary with token count for validation
    await putItem(SUMMARIES_TABLE, {
      sessionId: activeSessionId,
      tokenCount: compacted.tokenCount,
      messageCount: compacted.messageCount,
      keyPoints: compacted.keyPoints,
      middleSummary: compacted.middleSummary,
      updatedAt: Date.now(),
      ttl: Math.floor(Date.now() / 1000) + 86400 * 7 // 7 days
    });

    // Log compaction stats
    if (compacted.stats) {
      console.log(`[Compaction] Original: ${compacted.stats.originalTokens} tokens, After: ${compacted.stats.recentTokens} tokens, Summarized: ${compacted.stats.summarizedMessages} messages`);
    }
  }

  // Build system prompt
  const systemPrompt = buildSystemPrompt(projectContext, webSearchEnabled);

  // Process files, extracting any zip files
  let processedFiles = files;
  let zipExtractionInfo = null;

  const hasZipFiles = files.some(f => isZipFile(f));
  if (hasZipFiles) {
    try {
      const result = await processFilesWithZipExtraction(files);
      processedFiles = result.files;
      zipExtractionInfo = result.zipResults;
      console.log('Zip extraction completed:', zipExtractionInfo);
    } catch (error) {
      console.error('Zip extraction error:', error);
    }
  }

  // Prepare files for buildMessages (convert to format expected by Bedrock)
  const messageFiles = processedFiles.map(f => ({
    name: f.name,
    mediaType: f.type,
    base64: f.base64
  }));

  // Build messages
  const messages = buildMessages(
    recentHistory.map(m => ({ role: m.role, content: m.content })),
    { text: message || '', files: messageFiles },
    projectContext,
    compactedContext
  );

  // Save user message
  const userMessageId = `msg_${Date.now()}_user`;
  await putItem(MESSAGES_TABLE, {
    sessionId: activeSessionId,
    messageId: userMessageId,
    role: 'user',
    content: message,
    timestamp: Date.now()
  });

  // Stream response
  let fullResponse = '';
  let thinkingContent = '';
  const artifacts = [];

  // Collect SSE events
  const events = [];

  // Add zip extraction info to events if applicable
  if (zipExtractionInfo && zipExtractionInfo.length > 0) {
    for (const zipResult of zipExtractionInfo) {
      if (zipResult.success) {
        events.push(sseEvent({ type: 'processing', message: zipResult.summary }));
      }
    }
  }
  
  try {
    for await (const chunk of streamChatWithTools({
      messages,
      model,
      systemPrompt,
      extendedThinking: extendedThinkingEnabled,
      webSearch: webSearchEnabled
    })) {
      if (chunk.type === 'text') {
        fullResponse += chunk.content;
        events.push(sseEvent({ type: 'chunk', content: chunk.content }));

        // Check for artifact patterns
        const detectedArtifact = detectArtifact(fullResponse);
        if (detectedArtifact && !artifacts.find(a => a.pattern === detectedArtifact.pattern)) {
          artifacts.push(detectedArtifact);
          events.push(sseEvent({
            type: 'artifact_start',
            artifact: {
              id: detectedArtifact.id,
              name: detectedArtifact.name,
              type: detectedArtifact.type,
              status: 'generating'
            }
          }));
        }
      } else if (chunk.type === 'thinking') {
        thinkingContent += chunk.content;
        events.push(sseEvent({ type: 'thinking', content: chunk.content }));
      } else if (chunk.type === 'search_start') {
        events.push(sseEvent({ type: 'search_start', query: chunk.query }));
      } else if (chunk.type === 'search_results') {
        events.push(sseEvent({ type: 'search_results', query: chunk.query, results: chunk.results }));
      } else if (chunk.type === 'metadata') {
        events.push(sseEvent({ type: 'metadata', usage: chunk.usage }));
      }
    }
  } catch (error) {
    console.error('Streaming error:', error);
    events.push(sseEvent({ type: 'error', message: error.message }));
  }

  // Save assistant message
  const assistantMessageId = `msg_${Date.now()}_assistant`;
  await putItem(MESSAGES_TABLE, {
    sessionId: activeSessionId,
    messageId: assistantMessageId,
    role: 'assistant',
    content: fullResponse,
    thinking: thinkingContent || null,
    timestamp: Date.now()
  });

  // Process and save artifacts
  for (const artifact of artifacts) {
    const extracted = extractArtifactContent(fullResponse, artifact);
    if (extracted) {
      const s3Key = `${activeSessionId}/${artifact.id}-${artifact.name}`;
      await uploadContent(
        ARTIFACTS_BUCKET,
        s3Key,
        extracted.content,
        getContentType(artifact.name)
      );
      
      await putItem(ARTIFACTS_TABLE, {
        sessionId: activeSessionId,
        artifactId: artifact.id,
        name: artifact.name,
        type: artifact.type,
        s3Key,
        createdAt: Date.now()
      });
      
      events.push(sseEvent({
        type: 'artifact_complete',
        artifact_id: artifact.id,
        name: artifact.name,
        type: artifact.type
      }));
    }
  }

  // Update session
  await updateItem(SESSIONS_TABLE,
    { userId, sessionId: activeSessionId },
    {
      updatedAt: Date.now(),
      title: session.title || generateTitle(message)
    }
  );

  // Update project memory (non-blocking)
  if (effectiveProjectId && fullResponse) {
    updateProjectMemoryIncremental(userId, effectiveProjectId, message, fullResponse)
      .catch(err => console.error('[Memory] Background update failed:', err.message));
  }

  // Send completion event
  events.push(sseEvent({
    type: 'done',
    message_id: assistantMessageId,
    session_id: activeSessionId
  }));

  // Return as streaming response
  return {
    statusCode: 200,
    headers: sseHeaders(),
    body: events.join(''),
    isBase64Encoded: false
  };
}

/**
 * Handle non-streaming chat
 */
async function handleChat(event) {
  // Similar to streaming but returns JSON
  const userId = getUserId(event);
  const body = parseBody(event);
  
  // ... implementation similar to streaming but collects full response
  
  return success({ 
    message: 'Non-streaming chat not yet implemented',
    hint: 'Use /message/stream endpoint'
  });
}

/**
 * Estimate tokens for text (~4 chars per token with 10% buffer)
 */
function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil((text.length / 4) * 1.1);
}

/**
 * Get project context with memory, pinned files, and file manifest
 * Assembled within token budget constraints
 */
async function getProjectContext(userId, projectId) {
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) return null;

  // Get all project files
  const allFiles = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });

  // Get current project memory (latest version)
  let memory = null;
  try {
    const memoryItems = await queryItems(PROJECT_MEMORY_TABLE, {
      expression: 'projectId = :projectId',
      values: { ':projectId': projectId },
      scanIndexForward: false, // Descending order by version
      limit: 1
    });
    if (memoryItems.length > 0 && memoryItems[0].current) {
      memory = memoryItems[0];
    }
  } catch (e) {
    console.error('Failed to load project memory:', e);
  }

  // Separate pinned vs available files
  const pinnedFiles = allFiles.filter(f => f.pinned === 'true');
  const availableFiles = allFiles.filter(f => f.pinned !== 'true');

  // Build file manifest (all files, for context about what's available)
  const fileManifest = allFiles.map(f => ({
    name: f.name,
    type: f.type || 'unknown',
    pinned: f.pinned === 'true',
    tokenCount: f.tokenCount || 0,
    status: f.status || 'ready'
  }));

  // Load pinned file contents within budget
  let pinnedTokensUsed = 0;
  const pinnedFileContents = [];

  // Sort pinned files by token count (smallest first to fit more)
  const sortedPinned = [...pinnedFiles].sort((a, b) => (a.tokenCount || 0) - (b.tokenCount || 0));

  for (const file of sortedPinned) {
    const fileTokens = file.tokenCount || 0;
    if (pinnedTokensUsed + fileTokens <= CONTEXT_BUDGET.pinnedFiles) {
      try {
        const content = await getContent(UPLOADS_BUCKET, file.s3Key);
        pinnedFileContents.push({
          name: file.name,
          content: content.content,
          tokenCount: fileTokens
        });
        pinnedTokensUsed += fileTokens;
      } catch (e) {
        console.error(`Failed to load pinned file ${file.name}:`, e);
      }
    } else {
      console.log(`Skipping pinned file ${file.name} - would exceed budget (${pinnedTokensUsed + fileTokens} > ${CONTEXT_BUDGET.pinnedFiles})`);
    }
  }

  // Format memory sections for context
  let formattedMemory = null;
  if (memory && memory.sections) {
    const sections = memory.sections;
    const memoryParts = [];

    if (sections.purposeContext) {
      memoryParts.push(`## Purpose & Context\n${sections.purposeContext}`);
    }
    if (sections.currentState) {
      memoryParts.push(`## Current State\n${sections.currentState}`);
    }
    if (sections.onTheHorizon) {
      memoryParts.push(`## On The Horizon\n${sections.onTheHorizon}`);
    }
    if (sections.keyLearnings) {
      memoryParts.push(`## Key Learnings\n${sections.keyLearnings}`);
    }
    if (sections.approachPatterns) {
      memoryParts.push(`## Approach & Patterns\n${sections.approachPatterns}`);
    }
    if (sections.toolsResources) {
      memoryParts.push(`## Tools & Resources\n${sections.toolsResources}`);
    }

    if (memoryParts.length > 0) {
      formattedMemory = memoryParts.join('\n\n');
    }
  }

  console.log(`[ProjectContext] Project: ${project.name}, Memory: ${formattedMemory ? 'yes' : 'no'}, Pinned files: ${pinnedFileContents.length}/${pinnedFiles.length}, Total files: ${allFiles.length}`);

  return {
    project: {
      id: projectId,
      name: project.name,
      description: project.description
    },
    instructions: project.instructions,
    memory: formattedMemory,
    memoryVersion: memory?.version || null,
    fileManifest,
    pinnedFiles: pinnedFileContents,
    stats: {
      totalFiles: allFiles.length,
      pinnedCount: pinnedFiles.length,
      pinnedTokensUsed,
      memoryTokens: formattedMemory ? estimateTokens(formattedMemory) : 0
    }
  };
}

/**
 * Generate title from first message
 */
function generateTitle(message) {
  let title = message.trim();
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  return title || 'New conversation';
}

/**
 * Detect artifact in response
 */
function detectArtifact(text) {
  const patterns = [
    { regex: /```svg\n/i, type: 'svg', ext: 'svg' },
    { regex: /```markdown\n/i, type: 'markdown', ext: 'md' },
    { regex: /```html\n/i, type: 'html', ext: 'html' },
    { regex: /```jsx\n/i, type: 'react', ext: 'jsx' },
    { regex: /```javascript\n/i, type: 'javascript', ext: 'js' },
    { regex: /```python\n/i, type: 'python', ext: 'py' },
    { regex: /```json\n/i, type: 'json', ext: 'json' },
    { regex: /```mermaid\n/i, type: 'mermaid', ext: 'mermaid' },
    { regex: /```css\n/i, type: 'css', ext: 'css' },
    { regex: /```typescript\n/i, type: 'typescript', ext: 'ts' }
  ];

  for (const pattern of patterns) {
    if (pattern.regex.test(text)) {
      return {
        id: `art_${Date.now()}`,
        name: `artifact.${pattern.ext}`,
        type: pattern.type,
        pattern: pattern.regex.source
      };
    }
  }
  return null;
}

/**
 * Extract artifact content from response
 */
function extractArtifactContent(text, artifact) {
  const regex = new RegExp(`\`\`\`${artifact.type}\\n([\\s\\S]*?)\`\`\``, 'i');
  const match = text.match(regex);
  if (match) {
    return { content: match[1] };
  }
  return null;
}

/**
 * Estimate tokens for text content
 */
function estimateTokensForMemory(text) {
  if (!text) return 0;
  return Math.ceil((text.length / 4) * 1.1);
}

/**
 * Update project memory incrementally after a conversation
 * This is called after each assistant response to keep memory fresh
 */
async function updateProjectMemoryIncremental(userId, projectId, userMessage, assistantResponse) {
  if (!PROJECT_MEMORY_TABLE || !projectId) {
    console.log('[Memory] Skipping - no project or memory table');
    return;
  }

  try {
    console.log(`[Memory] Updating memory for project ${projectId}`);

    // Get current memory
    const memories = await queryItems(PROJECT_MEMORY_TABLE, {
      expression: 'projectId = :projectId',
      values: { ':projectId': projectId }
    });

    // Find current memory
    const currentMemory = memories.find(m => m.current) || memories[0];
    const existingSections = currentMemory?.sections || {
      purposeContext: '',
      currentState: '',
      onTheHorizon: '',
      keyLearnings: '',
      approachPatterns: '',
      toolsResources: ''
    };

    // Get project info
    const project = await getItem(PROJECTS_TABLE, { userId, projectId });
    if (!project) {
      console.log('[Memory] Project not found');
      return;
    }

    // Build incremental update prompt
    const updatePrompt = `You are updating a project memory document based on a new conversation exchange. Your job is to integrate any new information into the existing memory sections.

PROJECT: ${project.name}
${project.description ? `Description: ${project.description}` : ''}

CURRENT MEMORY:
1. Purpose & Context: ${existingSections.purposeContext || 'Not yet documented'}
2. Current State: ${existingSections.currentState || 'Not yet documented'}
3. On The Horizon: ${existingSections.onTheHorizon || 'Not yet documented'}
4. Key Learnings: ${existingSections.keyLearnings || 'Not yet documented'}
5. Approach & Patterns: ${existingSections.approachPatterns || 'Not yet documented'}
6. Tools & Resources: ${existingSections.toolsResources || 'Not yet documented'}

NEW CONVERSATION:
User: ${userMessage}
Assistant: ${assistantResponse.substring(0, 3000)}${assistantResponse.length > 3000 ? '...' : ''}

INSTRUCTIONS:
Analyze the new conversation and update ONLY the sections that have new relevant information. Return the updated memory in this exact JSON format:
{
  "purposeContext": "...",
  "currentState": "...",
  "onTheHorizon": "...",
  "keyLearnings": "...",
  "approachPatterns": "...",
  "toolsResources": "..."
}

Rules:
- Keep existing information that is still relevant
- Add new information from the conversation
- Keep each section concise (2-4 sentences max)
- If no updates needed for a section, keep it as-is
- Return ONLY valid JSON, no other text`;

    const command = new ConverseCommand({
      modelId: MEMORY_MODEL,
      messages: [{
        role: 'user',
        content: [{ text: updatePrompt }]
      }],
      system: [{ text: 'You are a memory synthesis assistant. Return only valid JSON with the 6 memory sections. No markdown, no explanations.' }],
      inferenceConfig: {
        maxTokens: 2048,
        temperature: 0.3
      }
    });

    const response = await bedrockClient.send(command);
    const responseText = response.output.message.content[0].text;

    // Parse the JSON response
    let updatedSections;
    try {
      // Try to extract JSON from the response
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        updatedSections = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('[Memory] Failed to parse response:', parseError.message);
      console.log('[Memory] Raw response:', responseText.substring(0, 500));
      return;
    }

    // Validate sections
    const validSections = {
      purposeContext: updatedSections.purposeContext || existingSections.purposeContext,
      currentState: updatedSections.currentState || existingSections.currentState,
      onTheHorizon: updatedSections.onTheHorizon || existingSections.onTheHorizon,
      keyLearnings: updatedSections.keyLearnings || existingSections.keyLearnings,
      approachPatterns: updatedSections.approachPatterns || existingSections.approachPatterns,
      toolsResources: updatedSections.toolsResources || existingSections.toolsResources
    };

    const now = Date.now();
    const newVersion = (currentMemory?.version || 0) + 1;

    // Mark old memory as not current
    if (currentMemory) {
      await updateItem(PROJECT_MEMORY_TABLE,
        { projectId, version: currentMemory.version },
        { current: false }
      );
    }

    // Save new memory
    const memoryText = Object.values(validSections).join('\n');
    const newMemory = {
      projectId,
      version: newVersion,
      current: true,
      sections: validSections,
      generatedAt: now,
      tokenCount: estimateTokensForMemory(memoryText),
      autoGenerated: true
    };

    await putItem(PROJECT_MEMORY_TABLE, newMemory);

    console.log(`[Memory] Updated memory to v${newVersion} for project ${projectId}`);

  } catch (error) {
    // Don't fail the main request if memory update fails
    console.error('[Memory] Update failed:', error.message);
  }
}

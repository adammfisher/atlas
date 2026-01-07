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

const SESSIONS_TABLE = process.env.SESSIONS_TABLE;
const MESSAGES_TABLE = process.env.MESSAGES_TABLE;
const PROJECTS_TABLE = process.env.PROJECTS_TABLE;
const PROJECT_FILES_TABLE = process.env.PROJECT_FILES_TABLE;
const ARTIFACTS_TABLE = process.env.ARTIFACTS_TABLE;
const SUMMARIES_TABLE = process.env.SUMMARIES_TABLE;
const UPLOADS_BUCKET = process.env.UPLOADS_BUCKET;
const ARTIFACTS_BUCKET = process.env.ARTIFACTS_BUCKET;

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
  let projectContext = null;
  if (session.projectId) {
    projectContext = await getProjectContext(userId, session.projectId);
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
  const systemPrompt = buildSystemPrompt(projectContext?.instructions, webSearchEnabled);

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
  let projectContext = null;
  if (session.projectId) {
    projectContext = await getProjectContext(userId, session.projectId);
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
  const systemPrompt = buildSystemPrompt(projectContext?.instructions, webSearchEnabled);

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
 * Get project context (instructions + files)
 */
async function getProjectContext(userId, projectId) {
  const project = await getItem(PROJECTS_TABLE, { userId, projectId });
  if (!project) return null;

  const files = await queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  });

  const fileContents = [];
  for (const file of files) {
    try {
      const content = await getContent(UPLOADS_BUCKET, file.s3Key);
      fileContents.push({
        name: file.name,
        content: content.content
      });
    } catch (e) {
      console.error(`Failed to load file ${file.name}:`, e);
    }
  }

  return {
    instructions: project.instructions,
    files: fileContents
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

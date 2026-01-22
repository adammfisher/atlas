/**
 * Local Chat Server for Demo
 *
 * Connects frontend to Claude via AWS Bedrock while also querying
 * the local MCP Knowledge Core server.
 */

const express = require('express');
const cors = require('cors');
const neo4j = require('neo4j-driver');
const fs = require('fs');
const path = require('path');

const app = express();
// Configure CORS to allow credentials (cookies) from frontend
// Allow multiple ports for development flexibility
const allowedOrigins = ['http://localhost:3000', 'http://localhost:3001', 'http://localhost:5173'];
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    return callback(null, false);
  },
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));

// =============================================================================
// REQUEST LOGGING - Logs all requests to a file for analysis
// =============================================================================
const LOG_DIR = path.join(__dirname, 'logs');
const LOG_FILE = path.join(LOG_DIR, 'requests.log');

// Ensure logs directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// Request logging middleware
app.use((req, res, next) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    method: req.method,
    url: req.url,
    path: req.path,
    headers: {
      'content-type': req.headers['content-type'],
      'x-user-id': req.headers['x-user-id'],
      'user-agent': req.headers['user-agent']
    },
    query: req.query,
    body: req.body
  };

  // For large bodies (like file uploads), truncate content
  if (logEntry.body?.files) {
    logEntry.body = {
      ...logEntry.body,
      files: logEntry.body.files.map(f => ({
        name: f.name,
        type: f.type,
        size: f.data?.length || f.content?.length || 'unknown'
      }))
    };
  }

  // Truncate very long message content for readability
  if (logEntry.body?.message && logEntry.body.message.length > 1000) {
    logEntry.body = {
      ...logEntry.body,
      message: logEntry.body.message.substring(0, 1000) + '... [TRUNCATED]'
    };
  }
  if (logEntry.body?.knowledge_context && logEntry.body.knowledge_context.length > 500) {
    logEntry.body = {
      ...logEntry.body,
      knowledge_context: logEntry.body.knowledge_context.substring(0, 500) + '... [TRUNCATED]'
    };
  }

  const logLine = JSON.stringify(logEntry, null, 2) + '\n---\n';

  // Append to log file
  fs.appendFileSync(LOG_FILE, logLine);

  console.log(`[LOG] ${req.method} ${req.path} -> ${LOG_FILE}`);

  next();
});

// Local MCP Knowledge Core server URL
const MCP_URL = 'http://localhost:3001';

// Neo4j direct connection (for when MCP server isn't running)
const NEO4J_URI = 'bolt://localhost:7687';
const NEO4J_USER = 'neo4j';
const NEO4J_PASSWORD = 'allyfinancial';
let neo4jDriver = null;

// Initialize Neo4j driver
function getNeou4jDriver() {
  if (!neo4jDriver) {
    try {
      neo4jDriver = neo4j.driver(NEO4J_URI, neo4j.auth.basic(NEO4J_USER, NEO4J_PASSWORD));
      console.log('[Neo4j] Driver initialized');
    } catch (error) {
      console.error('[Neo4j] Failed to initialize driver:', error.message);
    }
  }
  return neo4jDriver;
}

// Helper function to write artifact directly to Neo4j
async function writeArtifactToNeo4j(artifact) {
  const driver = getNeou4jDriver();
  if (!driver) {
    throw new Error('Neo4j driver not available');
  }

  const session = driver.session();
  try {
    const result = await session.run(
      `CREATE (a:Artifact {
        id: $id,
        title: $title,
        type: $type,
        content: $content,
        content_summary: $content_summary,
        state: 'published',
        author_id: $author_id,
        author_name: $author_name,
        author_email: $author_email,
        author_team: $author_team,
        created_at: datetime()
      }) RETURN a`,
      {
        id: artifact.id,
        title: artifact.title,
        type: artifact.type || 'analysis',
        content: artifact.content || '',
        content_summary: artifact.content_summary || '',
        author_id: artifact.author?.id || 'adam-fisher',
        author_name: artifact.author?.name || 'Adam Fisher',
        author_email: artifact.author?.email || 'adam.fisher@ally.com',
        author_team: artifact.author?.team || 'Platform Engineering'
      }
    );
    console.log('[Neo4j] Artifact created:', artifact.title);
    return result.records[0]?.get('a').properties;
  } finally {
    await session.close();
  }
}

// Helper function to delete artifact from Neo4j
async function deleteArtifactFromNeo4j(artifactId) {
  const driver = getNeou4jDriver();
  if (!driver) {
    throw new Error('Neo4j driver not available');
  }

  const session = driver.session();
  try {
    const result = await session.run(
      'MATCH (a:Artifact {id: $id}) DELETE a RETURN count(a) as deleted',
      { id: artifactId }
    );
    const deleted = result.records[0]?.get('deleted').toNumber() || 0;
    console.log('[Neo4j] Artifact deleted:', artifactId, '- count:', deleted);
    return deleted > 0;
  } finally {
    await session.close();
  }
}

// Helper function to search artifacts in Neo4j using text matching
async function searchArtifactsInNeo4j(query) {
  const driver = getNeou4jDriver();
  if (!driver) {
    throw new Error('Neo4j driver not available');
  }

  const session = driver.session();
  try {
    // Split query into meaningful keywords (filter out common stop words and short words)
    const stopWords = new Set(['the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'had', 'her', 'was', 'one', 'our', 'out', 'has', 'have', 'been', 'were', 'they', 'will', 'with', 'what', 'this', 'that', 'from', 'about', 'tell', 'how', 'when', 'where', 'which', 'who', 'why']);
    const searchTerms = query.toLowerCase()
      .split(/\s+/)
      .filter(t => t.length > 2 && !stopWords.has(t));

    console.log(`[Neo4j] Search terms extracted: ${searchTerms.join(', ')}`);

    if (searchTerms.length === 0) {
      console.log('[Neo4j] No valid search terms after filtering');
      return [];
    }

    // Build a Cypher query that searches for ANY of the keywords
    // This is more flexible than requiring the entire query string to match
    const result = await session.run(
      `MATCH (a:Artifact)
       WHERE ANY(term IN $searchTerms WHERE
         toLower(a.title) CONTAINS term
         OR toLower(a.content) CONTAINS term
         OR toLower(a.content_summary) CONTAINS term
       )
       RETURN a
       LIMIT 10`,
      { searchTerms }
    );

    const artifacts = result.records.map(record => {
      const node = record.get('a');
      const props = node.properties;
      return {
        id: props.id,
        title: props.title,
        content: props.content || '',
        summary: props.content_summary || '',
        type: props.type,
        author: {
          id: props.author_id,
          name: props.author_name,
          email: props.author_email,
          team: props.author_team
        }
      };
    });

    console.log(`[Neo4j] Search for "${query}" found ${artifacts.length} artifacts`);
    return artifacts;
  } finally {
    await session.close();
  }
}

// AWS Backend URL for session/project data (API Gateway)
const AWS_API_URL = 'https://famlht6lp2.execute-api.us-east-1.amazonaws.com';

// Lambda Function URL for streaming chat (supports true SSE streaming)
const STREAM_URL = 'https://vminx32zctbv4pqdwqyjllacwi0bjidt.lambda-url.us-east-1.on.aws/';

// All chat requests are proxied to AWS Lambda for consistency
const USE_LOCAL_CHAT = false;

/**
 * Extract JWT token from cookie header
 * Looks for 'atlas_session' cookie
 */
function extractTokenFromCookie(cookieHeader) {
  if (!cookieHeader) return null;
  const match = cookieHeader.match(/atlas_session=([^;]+)/);
  return match ? match[1] : null;
}

// Store pending insights (in-memory for now) - declared early so all endpoints can access
let pendingInsights = [];

/**
 * Main streaming chat endpoint
 * When USE_LOCAL_CHAT is true, handles chat locally using bedrock.js
 * When false, proxies to AWS Lambda
 */
app.post('/api/chat/message/stream', async (req, res) => {
  const { message, knowledge_context, files, session_id, project_id, model = 'haiku', web_search_enabled = true } = req.body;

  console.log(`\n[Chat] ${USE_LOCAL_CHAT ? 'LOCAL' : 'AWS'}: "${message?.substring(0, 50) || '(no message)'}..."`);
  if (knowledge_context) {
    console.log(`[Chat] With knowledge context (${knowledge_context.length} chars)`);
  }
  if (files && files.length > 0) {
    console.log(`[Chat] With ${files.length} file(s):`);
    files.forEach((f, i) => console.log(`  - File ${i + 1}: ${f.name} (${f.type})`));
  }

  // Set up SSE headers - disable any buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');  // Disable nginx buffering if present
  res.flushHeaders();  // Send headers immediately

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  // =========================================================================
  // LOCAL CHAT HANDLER - Uses local bedrock.js code
  // =========================================================================
  if (USE_LOCAL_CHAT) {
    try {
      console.log('[Chat-Local] Processing locally with bedrock.js');

      // Build message for Claude: prepend knowledge context if present
      const messageForClaude = knowledge_context
        ? `${knowledge_context}\n\n${message}`
        : message;

      // Prepare files for Bedrock format
      const messageFiles = (files || []).map(f => ({
        name: f.name,
        mediaType: f.type,
        base64: f.base64
      }));

      // Build system prompt (no project context for local mode)
      const systemPrompt = buildSystemPrompt(null, web_search_enabled, []);

      // Build messages array
      const messages = buildMessages(
        [], // No history for local mode
        { text: messageForClaude || '', files: messageFiles },
        null, // No project context
        null  // No compacted context
      );

      console.log('[Chat-Local] Messages built:', messages.length);
      messages.forEach((m, i) => {
        const contentTypes = m.content.map(c => Object.keys(c)[0]).join(', ');
        console.log(`  [${i}] ${m.role}: ${contentTypes} (${m.content.length} blocks)`);
      });

      // Notify client we're processing files
      if (messageFiles.length > 0) {
        sendEvent({ type: 'processing', message: `Processing ${messageFiles.length} file(s)...` });
      }

      // Stream response from Bedrock
      let fullResponse = '';
      for await (const chunk of streamChatWithTools({
        messages,
        model,
        systemPrompt,
        webSearch: web_search_enabled
      })) {
        if (chunk.type === 'text') {
          fullResponse += chunk.content;
          sendEvent({ type: 'chunk', content: chunk.content });
        } else if (chunk.type === 'thinking') {
          sendEvent({ type: 'thinking', content: chunk.content });
        } else if (chunk.type === 'search_start') {
          sendEvent({ type: 'search_start', query: chunk.query });
        } else if (chunk.type === 'search_results') {
          sendEvent({ type: 'search_results', query: chunk.query, results: chunk.results });
        }
      }

      // Send done event
      sendEvent({
        type: 'done',
        message_id: `msg_${Date.now()}_assistant`,
        session_id: session_id || `session_${Date.now()}`
      });

    } catch (error) {
      console.error('[Chat-Local] Error:', error);
      sendEvent({ type: 'error', message: error.message });
      sendEvent({
        type: 'done',
        message_id: `msg_${Date.now()}_assistant`,
        session_id: session_id || `session_${Date.now()}`
      });
    }

    res.end();
    return;
  }

  // =========================================================================
  // AWS PROXY HANDLER - Forwards to Lambda Function URL
  // =========================================================================
  try {
    // Build message for Claude: prepend knowledge context if present
    // AWS will store the clean `message` for title/history, but use `message_for_claude` for the actual request
    const messageForClaude = knowledge_context
      ? `${knowledge_context}\n\n${message}`
      : message;

    // Build request body - include files if present
    const requestBody = {
      message: messageForClaude,  // Full message with context for Claude
      message_display: message,   // Clean message for display/title if needed
      session_id,
      project_id,
      model,
      web_search_enabled
    };

    // Add files to request if present
    if (files && files.length > 0) {
      requestBody.files = files;
    }

    // Proxy to Lambda Function URL for streaming chat (true SSE streaming)
    // IMPORTANT: Lambda uses 'message' field directly for Claude, so we send the full context here
    // We also send 'message_display' for the clean version if Lambda wants to store it separately
    console.log(`[Chat] Streaming via Lambda Function URL: ${STREAM_URL}`);
    console.log(`[Chat] Message for Claude (${messageForClaude?.length || 0} chars)`);
    console.log(`[Chat] Cookie header present:`, !!req.headers.cookie);

    // Extract JWT from cookie and send as Authorization header for Lambda Function URL
    console.log(`[Chat] Cookie header value:`, req.headers.cookie);
    const token = extractTokenFromCookie(req.headers.cookie);
    console.log(`[Chat] JWT token present:`, !!token);
    if (token) console.log(`[Chat] Token (first 50 chars):`, token.substring(0, 50) + '...');

    const awsResponse = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(requestBody)
    });

    if (!awsResponse.ok) {
      throw new Error(`AWS API error: ${awsResponse.status}`);
    }

    // Stream the response from AWS back to the client
    // Parse chunks to detect artifact starts and emit artifact_start events
    let buffer = '';
    let inArtifact = false;
    let currentArtifact = null;
    let artifactContent = '';
    let artifactFormat = null;  // 'xml' or 'codeblock'
    let pendingContent = '';  // Accumulates content to detect artifact tags across chunks
    let artifactStartSent = false;

    for await (const chunk of awsResponse.body) {
      // Convert chunk to string properly - it might be a Uint8Array from fetch
      const text = typeof chunk === 'string' ? chunk : Buffer.from(chunk).toString('utf-8');
      buffer += text;

      // Process complete SSE events from buffer
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep incomplete line in buffer

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const dataStr = line.slice(6);

          // Skip [DONE] marker
          if (dataStr === '[DONE]') {
            res.write(line + '\n');
            continue;
          }

          try {
            const data = JSON.parse(dataStr);

            // Check for content chunks that might contain artifact tags or code blocks
            if ((data.type === 'content' || data.type === 'chunk') && data.content) {
              const content = data.content;
              pendingContent += content;

              // Check for <artifact> tag start - need complete tag
              if (!inArtifact && pendingContent.includes('<artifact')) {
                // Check if we have the complete opening tag (ends with >)
                const fullTagMatch = pendingContent.match(/<artifact\s+type=["']([^"']+)["'](?:\s+title=["']([^"']*)["'])?[^>]*>/);
                if (fullTagMatch) {
                  inArtifact = true;
                  artifactFormat = 'xml';
                  currentArtifact = {
                    id: `artifact_${Date.now()}`,
                    type: fullTagMatch[1],
                    title: fullTagMatch[2] || `${fullTagMatch[1]} Document`,
                    name: fullTagMatch[2] || `artifact_${Date.now()}`
                  };
                  artifactContent = '';
                  artifactStartSent = false;
                  console.log('[Artifact] Started (xml):', currentArtifact.title);
                  sendEvent({ type: 'artifact_start', artifact: currentArtifact });
                  artifactStartSent = true;

                  // Extract content after the opening tag
                  const afterTag = pendingContent.split(fullTagMatch[0])[1] || '';
                  if (afterTag && !afterTag.includes('</artifact>')) {
                    artifactContent = afterTag;
                    sendEvent({ type: 'artifact_delta', artifact: { ...currentArtifact, content: artifactContent } });
                  }
                  pendingContent = '';
                }
              }
              // If we're in an artifact, accumulate and send deltas
              else if (inArtifact && artifactStartSent) {
                // Check for closing tag
                if (pendingContent.includes('</artifact>')) {
                  // Get content before the closing tag - don't add current content again
                  // since we already accumulated it via pendingContent
                  const fullContent = artifactContent + content;
                  const cleanContent = fullContent.split('</artifact>')[0];
                  console.log('[Artifact] Completed:', currentArtifact.title, '- Length:', cleanContent.length);
                  sendEvent({ type: 'artifact_complete', artifact: { ...currentArtifact, content: cleanContent } });
                  inArtifact = false;
                  currentArtifact = null;
                  artifactContent = '';
                  artifactFormat = null;
                  pendingContent = '';
                  artifactStartSent = false;
                } else {
                  // Just accumulate content
                  artifactContent += content;
                  sendEvent({ type: 'artifact_delta', artifact: { ...currentArtifact, content: artifactContent } });
                  pendingContent = '';
                }
              }
            }
          } catch (e) {
            // Not valid JSON, just pass through
          }
        }

        // Always pass through the original line
        res.write(line + '\n');
      }
    }

    // Write any remaining buffer
    if (buffer) {
      res.write(buffer);
    }

  } catch (error) {
    console.error('[Chat] Error:', error);
    sendEvent({ type: 'error', message: error.message });
    sendEvent({ type: 'done', session_id: session_id || `session_${Date.now()}` });
  }

  res.end();
});

/**
 * Streaming chat endpoint with file attachments - proxies to AWS Lambda
 * Files are already base64 encoded from the frontend
 */
app.post('/api/chat/message/with-files/stream', async (req, res) => {
  const { message, files, session_id, project_id, model = 'haiku', web_search_enabled = true } = req.body;

  console.log(`\n[Chat+Files] Proxying to AWS: "${message?.substring(0, 50) || '(no message)'}..."`);
  console.log(`[Chat+Files] With ${files?.length || 0} files`);
  if (files && files.length > 0) {
    files.forEach((f, i) => console.log(`  - File ${i + 1}: ${f.name} (${f.type})`));
  }

  // Set up SSE headers - disable any buffering
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const sendEvent = (data) => {
    res.write(`data: ${JSON.stringify(data)}\n\n`);
  };

  try {
    console.log(`[Chat+Files] Streaming via Lambda Function URL: ${STREAM_URL}`);
    console.log(`[Chat+Files] Cookie header present:`, !!req.headers.cookie);

    // Extract JWT from cookie and send as Authorization header for Lambda Function URL
    const token = extractTokenFromCookie(req.headers.cookie);
    console.log(`[Chat+Files] JWT token present:`, !!token);

    const awsResponse = await fetch(STREAM_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify({
        message,
        files,
        session_id,
        project_id,
        model,
        web_search_enabled
      })
    });

    if (!awsResponse.ok) {
      throw new Error(`AWS API error: ${awsResponse.status}`);
    }

    // Stream the response from AWS back to the client
    for await (const chunk of awsResponse.body) {
      res.write(chunk);
    }

  } catch (error) {
    console.error('[Chat+Files] Error:', error);
    sendEvent({ type: 'error', message: error.message });
    sendEvent({ type: 'done', session_id: session_id || `session_${Date.now()}` });
  }

  res.end();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'atlas-web-local' });
});

// =============================================================================
// AUTH ENDPOINTS - Proxy to AWS for authentication
// =============================================================================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    console.log('[Auth] Login attempt for:', req.body.username);
    const response = await fetch(`${AWS_API_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();

    // Forward set-cookie headers from AWS, adjusting for localhost
    const setCookie = response.headers.get('set-cookie');
    console.log('[Auth] AWS Set-Cookie header:', setCookie);
    if (setCookie) {
      // For localhost, we need to:
      // 1. Remove Secure flag (not needed for HTTP)
      // 2. Change SameSite=None to SameSite=Lax (None requires Secure)
      // 3. Remove any Domain attribute that might conflict
      let localCookie = setCookie
        .replace(/;\s*Secure/gi, '')
        .replace(/SameSite=None/gi, 'SameSite=Lax')
        .replace(/;\s*Domain=[^;]*/gi, '');
      console.log('[Auth] Modified cookie for localhost:', localCookie);
      res.setHeader('Set-Cookie', localCookie);
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Auth] Login error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Logout
app.post('/api/auth/logout', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/auth/logout`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      }
    });

    const data = await response.json();

    // Forward set-cookie headers from AWS (clears the cookie)
    const setCookie = response.headers.get('set-cookie');
    if (setCookie) {
      const localCookie = setCookie.replace(/;\s*Secure/gi, '');
      res.setHeader('Set-Cookie', localCookie);
    }

    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Auth] Logout error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get current user
app.get('/api/auth/me', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/auth/me`, {
      headers: {
        'Cookie': req.headers.cookie || ''
      }
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Auth] Get me error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Register (admin only)
app.post('/api/auth/register', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || ''
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Auth] Register error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy sessions to AWS backend
app.get('/api/sessions', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/sessions`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Sessions error:', error.message);
    res.json({ sessions: [] });
  }
});

// Create session - proxy to AWS backend
app.post('/api/sessions', async (req, res) => {
  try {
    console.log('[Proxy] Creating session with data:', req.body);
    const response = await fetch(`${AWS_API_URL}/api/sessions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    console.log('[Proxy] Session created:', data);
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Create session error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete session - proxy to AWS backend
app.delete('/api/sessions/:sessionId', async (req, res) => {
  const { sessionId } = req.params;
  console.log('[Proxy] Deleting session:', sessionId);

  try {
    const response = await fetch(`${AWS_API_URL}/api/sessions/${sessionId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });

    if (!response.ok) {
      console.error('[Proxy] AWS delete failed:', response.status);
      // Return success anyway if it's 404 (already deleted)
      if (response.status === 404) {
        return res.json({ success: true, message: 'Session already deleted' });
      }
      throw new Error(`AWS API error: ${response.status}`);
    }

    console.log('[Proxy] Session deleted:', sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error('[Proxy] Delete session error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Proxy session messages to AWS backend
app.get('/api/sessions/:sessionId/messages', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/sessions/${req.params.sessionId}/messages`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Messages error:', error.message);
    res.json({ messages: [] });
  }
});

// Proxy projects to AWS backend
app.get('/api/projects', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Projects error:', error.message);
    res.json({ projects: [] });
  }
});

// Create project
app.post('/api/projects', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Create project error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get single project
app.get('/api/projects/:projectId', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Get project error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Update project
app.put('/api/projects/:projectId', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Update project error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete project
app.delete('/api/projects/:projectId', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });

    // Handle empty response body (DELETE often returns 204 No Content)
    const text = await response.text();
    if (text) {
      try {
        const data = JSON.parse(text);
        res.status(response.status).json(data);
      } catch {
        res.status(response.status).json({ success: response.ok });
      }
    } else {
      res.status(response.ok ? 200 : response.status).json({ success: response.ok });
    }
  } catch (error) {
    console.error('[Proxy] Delete project error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Project files
app.get('/api/projects/:projectId/files', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Get project files error:', error.message);
    res.json({ files: [] });
  }
});

// Upload file to project
app.post('/api/projects/:projectId/files', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Upload file error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get single file (with optional content)
app.get('/api/projects/:projectId/files/:fileId', async (req, res) => {
  try {
    // Pass query params (e.g., ?content=true)
    const queryString = Object.keys(req.query).length > 0
      ? '?' + new URLSearchParams(req.query).toString()
      : '';
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files/${req.params.fileId}${queryString}`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Get file error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Toggle file pin
app.put('/api/projects/:projectId/files/:fileId/pin', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files/${req.params.fileId}/pin`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Toggle pin error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete file from project
app.delete('/api/projects/:projectId/files/:fileId', async (req, res) => {
  try {
    console.log('[Proxy] Deleting file:', req.params.fileId, 'from project:', req.params.projectId);
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files/${req.params.fileId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    // DELETE typically returns 204 No Content
    if (response.status === 204 || response.ok) {
      console.log('[Proxy] File deleted successfully');
      return res.status(204).send();
    }
    // If there's an error, try to get JSON body
    const data = await response.json().catch(() => ({ error: 'Delete failed' }));
    console.error('[Proxy] Delete file error:', response.status, data);
    res.status(response.status).json(data);
  } catch (error) {
    console.error('[Proxy] Delete file error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Save artifact as project file (add to product knowledge)
app.post('/api/projects/:projectId/files/from-artifact', async (req, res) => {
  try {
    console.log('[Proxy] Saving artifact to project:', req.params.projectId, req.body.filename);
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/files/from-artifact`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    if (!response.ok) {
      console.error('[Proxy] Save artifact error:', response.status, data);
      return res.status(response.status).json(data);
    }
    console.log('[Proxy] Artifact saved successfully:', data.file?.filename || data.filename);
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Save artifact error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Project memory
app.get('/api/projects/:projectId/memory', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/memory`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Get memory error:', error.message);
    res.json(null);
  }
});

// Update project memory
app.put('/api/projects/:projectId/memory', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/memory`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      },
      body: JSON.stringify(req.body)
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Update memory error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Regenerate project memory
app.post('/api/projects/:projectId/memory/regenerate', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/memory/regenerate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Regenerate memory error:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Project chats
app.get('/api/projects/:projectId/chats', async (req, res) => {
  try {
    const response = await fetch(`${AWS_API_URL}/api/projects/${req.params.projectId}/chats`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Proxy] Get project chats error:', error.message);
    res.json({ chats: [] });
  }
});

// Settings endpoint - returns default model settings
// Currently only Haiku is enabled for cost control
app.get('/api/settings/model', (req, res) => {
  res.json({ model: 'haiku', available: ['haiku'] });
});

// Mock mode setting - disabled by default
app.get('/api/settings/mock-mode', (req, res) => {
  res.json({ enabled: false });
});

// Insights endpoint moved below with full implementation (see INSIGHTS ENDPOINTS section)

// Artifacts endpoint for sessions - returns empty for now
app.get('/api/sessions/:sessionId/artifacts', (req, res) => {
  res.json({ artifacts: [] });
});

// List all artifacts for user - proxy to AWS API (supports ?project_id filter)
app.get('/api/artifacts', async (req, res) => {
  try {
    const queryString = Object.keys(req.query).length > 0
      ? '?' + new URLSearchParams(req.query).toString()
      : '';
    const response = await fetch(`${AWS_API_URL}/api/artifacts${queryString}`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Artifacts] Error listing artifacts:', error.message);
    res.json({ artifacts: [] });
  }
});

// Get artifact content - proxy to AWS API
app.get('/api/artifacts/:artifactId/content', async (req, res) => {
  try {
    const queryString = Object.keys(req.query).length > 0
      ? '?' + new URLSearchParams(req.query).toString()
      : '';
    const response = await fetch(`${AWS_API_URL}/api/artifacts/${req.params.artifactId}/content${queryString}`, {
      headers: {
        'Cookie': req.headers.cookie || '',
        'X-User-Id': req.headers['x-user-id'] || 'demo-user'
      }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[Artifacts] Error getting artifact content:', error.message);
    res.status(500).json({ error: 'Failed to get artifact content' });
  }
});

// =============================================================================
// MCP PROXY ENDPOINTS - These allow the frontend to query Knowledge Core directly
// =============================================================================

// Proxy MCP execute to local Knowledge Core server
// For search_artifacts, try Neo4j directly first (MCP server may not be running)
app.post('/api/mcp/execute', async (req, res) => {
  const { tool, arguments: args, server_id } = req.body;
  console.log(`[MCP] Execute tool: ${tool}`);

  // Handle search_artifacts directly from Neo4j (bypasses MCP server)
  if (tool === 'search_artifacts') {
    try {
      const query = args?.query || '';
      console.log(`[MCP] Searching artifacts in Neo4j for: "${query}"`);

      const artifacts = await searchArtifactsInNeo4j(query);
      console.log(`[MCP] Neo4j search found ${artifacts.length} artifacts`);

      res.json({
        result: {
          artifacts,
          message: `Found ${artifacts.length} relevant artifacts`
        }
      });
      return;
    } catch (neo4jError) {
      console.error(`[MCP] Neo4j search failed:`, neo4jError.message);
      // Fall through to MCP server as backup
    }
  }

  // Handle search_adrs - return empty for now (ADRs stored differently)
  if (tool === 'search_adrs') {
    console.log(`[MCP] search_adrs - returning empty (ADRs not in Neo4j Artifact nodes)`);
    res.json({ result: { adrs: [] } });
    return;
  }

  // For other tools, try MCP server
  try {
    const response = await fetch(`${MCP_URL}/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args })
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }

    const data = await response.json();
    console.log(`[MCP] Tool ${tool} completed`);
    res.json(data);
  } catch (error) {
    console.error(`[MCP] Error executing ${tool}:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get available MCP tools
app.get('/api/mcp/tools', async (req, res) => {
  try {
    const response = await fetch(`${MCP_URL}/mcp/tools`);
    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('[MCP] Error getting tools:', error.message);
    res.json({ tools: [] });
  }
});

// List MCP servers (just return the local Knowledge Core for now)
app.get('/api/mcp/servers', (req, res) => {
  res.json({
    servers: [{
      id: 'knowledge-core',
      name: 'Knowledge Core',
      url: MCP_URL,
      status: 'active'
    }]
  });
});

// =============================================================================
// KNOWLEDGE CORE ARTIFACT ENDPOINTS - For Insights to add/remove artifacts
// =============================================================================

// Ingest artifact to Knowledge Core
app.post('/api/knowledge-core/artifacts', async (req, res) => {
  console.log('[KC] Ingesting artifact:', req.body.title);

  try {
    const response = await fetch(`${MCP_URL}/artifacts/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req.body)
    });

    if (!response.ok) {
      throw new Error(`MCP server error: ${response.status}`);
    }

    const data = await response.json();
    console.log('[KC] Artifact ingested:', data);
    res.json(data);
  } catch (error) {
    console.error('[KC] Error ingesting artifact:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Delete artifact from Knowledge Core
app.delete('/api/knowledge-core/artifacts/:id', async (req, res) => {
  const { id } = req.params;
  console.log('[KC] Deleting artifact:', id);

  // Helper to remove insight from in-memory store
  const removeInsightByKcId = (kcArtifactId) => {
    const index = pendingInsights.findIndex(i => i.kcArtifactId === kcArtifactId);
    if (index !== -1) {
      const removed = pendingInsights.splice(index, 1);
      console.log('[KC] Removed insight from memory:', removed[0]?.id);
      return true;
    }
    return false;
  };

  // Try to delete directly from Neo4j first
  try {
    const deleted = await deleteArtifactFromNeo4j(id);
    console.log('[KC] Deleted from Neo4j:', deleted ? 'yes' : 'not found');
  } catch (neo4jError) {
    console.log('[KC] Neo4j delete failed:', neo4jError.message);

    // Fallback to MCP server
    try {
      const response = await fetch(`${MCP_URL}/artifacts/${id}`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' }
      });

      if (response.ok) {
        console.log('[KC] Deleted via MCP server');
      } else if (response.status === 404) {
        console.log('[KC] Artifact already deleted');
      }
    } catch (mcpError) {
      console.log('[KC] MCP also not available:', mcpError.message);
    }
  }

  // Always remove from in-memory store and succeed
  const removed = removeInsightByKcId(id);
  console.log('[KC] Removed from memory:', removed ? 'yes' : 'not found (already removed)');
  res.json({ success: true, message: 'Artifact removed' });
});

// =============================================================================
// INSIGHTS ENDPOINTS - Detect shareable artifacts and manage sharing
// =============================================================================

// Note: pendingInsights is declared at the top of the file

// Get insights - returns artifacts that could be shared to Knowledge Core
app.get('/api/insights', async (req, res) => {
  res.json({ insights: pendingInsights });
});

// Track seen artifacts to prevent race conditions with concurrent requests
const seenArtifactKeys = new Set();

// Add a new insight (called when artifact is detected in chat)
app.post('/api/insights', (req, res) => {
  const { artifact, sessionId, messageId } = req.body;
  console.log('[Insights] New artifact detected:', artifact?.title);

  // Filter out generic/useless artifact titles - don't create insights for these
  const genericTitles = ['Markdown Document', 'HTML Document', 'JSON Data', 'Code', 'Document', 'Untitled'];
  const title = artifact?.title || artifact?.name || '';
  if (genericTitles.includes(title) || !title) {
    console.log('[Insights] Skipping generic artifact:', title || '(no title)');
    return res.json({ success: true, insight: null, skipped: true, reason: 'generic_title' });
  }

  // Create a unique key for deduplication (title + sessionId)
  const dedupeKey = `${artifact?.title || 'untitled'}_${sessionId || 'no-session'}`;

  // Check Set first for race condition protection
  if (seenArtifactKeys.has(dedupeKey)) {
    console.log('[Insights] Duplicate artifact (from Set), skipping:', artifact?.title);
    const existingInsight = pendingInsights.find(i =>
      i.artifact?.title === artifact?.title && i.sessionId === sessionId
    );
    return res.json({ success: true, insight: existingInsight, duplicate: true });
  }

  // Also check array for existing insights
  const existingInsight = pendingInsights.find(i =>
    i.artifact?.id === artifact?.id ||
    (i.artifact?.title === artifact?.title && i.sessionId === sessionId)
  );

  if (existingInsight) {
    console.log('[Insights] Duplicate artifact (from array), skipping:', artifact?.title);
    seenArtifactKeys.add(dedupeKey); // Add to Set for future checks
    return res.json({ success: true, insight: existingInsight, duplicate: true });
  }

  // Mark as seen BEFORE creating insight (prevents race conditions)
  seenArtifactKeys.add(dedupeKey);

  const insight = {
    id: `insight_${Date.now()}`,
    type: 'artifact',
    status: 'pending',
    artifact: artifact,
    sessionId,
    messageId,
    detectedAt: new Date().toISOString()
  };

  pendingInsights.push(insight);
  console.log('[Insights] Total pending:', pendingInsights.length);
  res.json({ success: true, insight });
});

// Helper to extract title from markdown/document content
function extractTitleFromContent(content, type, fallbackName) {
  if (!content) return fallbackName;

  // For markdown, look for ADR-specific patterns first, then fall back to # heading
  if (type === 'markdown' || type === 'md') {
    // Check for ADR/document-specific title patterns
    // Match **Title:** PII Handling in AI Services
    const titleFieldMatch = content.match(/\*\*Title:\*\*\s*(.+?)(?:\n|$)/i);
    if (titleFieldMatch) {
      return titleFieldMatch[1].trim();
    }

    // Match ## Title: PII Handling...
    const titleHeadingMatch = content.match(/^##?\s*Title:\s*(.+)$/mi);
    if (titleHeadingMatch) {
      return titleHeadingMatch[1].trim();
    }

    // Match **Decision:** as alternative for ADRs
    const decisionMatch = content.match(/\*\*Decision:\*\*\s*(.+?)(?:\n|$)/i);
    if (decisionMatch) {
      return decisionMatch[1].trim();
    }

    // Match **Subject:** pattern
    const subjectMatch = content.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|$)/i);
    if (subjectMatch) {
      return subjectMatch[1].trim();
    }

    // Fall back to first # heading
    const headingMatch = content.match(/^#\s+(.+)$/m);
    if (headingMatch) {
      return headingMatch[1].trim();
    }
  }

  // For HTML, look for <title> or first <h1>
  if (type === 'html') {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i);
    if (titleMatch) return titleMatch[1].trim();
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i);
    if (h1Match) return h1Match[1].trim();
  }

  // For JSON, try to extract a name/title field
  if (type === 'json') {
    try {
      const parsed = JSON.parse(content);
      if (parsed.title) return parsed.title;
      if (parsed.name) return parsed.name;
    } catch (e) {}
  }

  return fallbackName;
}

// Share insight to Knowledge Core
app.post('/api/insights/:id/share', async (req, res) => {
  const { id } = req.params;
  const insight = pendingInsights.find(i => i.id === id);

  if (!insight) {
    return res.status(404).json({ error: 'Insight not found' });
  }

  console.log('[Insights] Sharing insight to KC:', insight.artifact?.title);

  // Ingest to Knowledge Core
  const artifact = insight.artifact;

  // Extract title from content if the artifact title is generic
  let title = artifact.title || artifact.name;
  const genericTitles = ['Markdown Document', 'HTML Document', 'JSON Data', 'Code', 'Document'];
  if (!title || genericTitles.includes(title)) {
    const extractedTitle = extractTitleFromContent(artifact.content, artifact.type, title);
    if (extractedTitle && extractedTitle !== title) {
      console.log('[Insights] Extracted title from content:', extractedTitle);
      title = extractedTitle;
    }
  }

  const kcArtifact = {
    id: `kc_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    title: title,
    type: artifact.type || 'analysis',
    content: artifact.content,
    content_summary: artifact.content?.substring(0, 500),
    author: {
      id: 'demo-user',
      name: 'Demo User',
      email: 'demo@ally.com',
      team: 'Platform Engineering'
    }
  };

  // Write directly to Neo4j (bypassing MCP server)
  let neo4jSuccess = false;
  try {
    await writeArtifactToNeo4j(kcArtifact);
    neo4jSuccess = true;
    console.log('[Insights] Written directly to Neo4j');
  } catch (neo4jError) {
    console.log('[Insights] Neo4j write failed:', neo4jError.message);

    // Fallback: try MCP server if available
    try {
      const response = await fetch(`${MCP_URL}/artifacts/ingest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(kcArtifact)
      });

      if (response.ok) {
        console.log('[Insights] Ingested via MCP server');
        neo4jSuccess = true;
      }
    } catch (mcpError) {
      console.log('[Insights] MCP also not available:', mcpError.message);
    }
  }

  // Update insight status
  insight.status = 'shared';
  insight.sharedAt = new Date().toISOString();
  insight.kcArtifactId = kcArtifact.id;
  insight.persistedToNeo4j = neo4jSuccess;

  console.log('[Insights] Shared with ID:', kcArtifact.id, '- Neo4j:', neo4jSuccess);
  res.json({ success: true, kcArtifactId: kcArtifact.id, persistedToNeo4j: neo4jSuccess });
});

// Dismiss insight
app.post('/api/insights/:id/dismiss', (req, res) => {
  const { id } = req.params;
  const index = pendingInsights.findIndex(i => i.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Insight not found' });
  }

  pendingInsights[index].status = 'dismissed';
  console.log('[Insights] Dismissed insight:', id);
  res.json({ success: true });
});

// Get pending insights count
app.get('/api/insights/pending/count', (req, res) => {
  const count = pendingInsights.filter(i => i.status === 'pending').length;
  res.json({ count });
});

const PORT = 8000;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ATLAS WEB LOCAL SERVER                                   ║
║  ─────────────────────────────────────────────────────    ║
║  Port: ${PORT}                                              ║
║  Knowledge Core: ${MCP_URL}                          ║
║                                                           ║
║  This server connects to:                                 ║
║  - Local MCP Knowledge Core (Neo4j artifacts)             ║
║  - AWS Bedrock (Claude)                                   ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

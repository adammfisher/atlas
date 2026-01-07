/**
 * Mock API Server for Atlas Platform Frontend Development
 * Run with: node mock-server.js
 */

import http from 'http';

const PORT = 8000;

// In-memory storage
const sessions = {};
const projects = {};
let mockModeEnabled = true;

// Mock insights data
const mockInsights = [
  {
    id: 'insight_1',
    type: 'decision',
    content: 'The team decided to use React Query for server state management instead of Redux, citing simpler caching and better developer experience.',
    keywords: ['react-query', 'state-management', 'architecture'],
    status: 'pending',
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 'insight_2',
    type: 'pattern',
    content: 'Noticed a recurring pattern where API errors are being silently caught without user notification. Should implement a global error boundary.',
    keywords: ['error-handling', 'ux', 'best-practice'],
    status: 'pending',
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 'insight_3',
    type: 'solution',
    content: 'Resolved the N+1 query problem in the user dashboard by implementing DataLoader pattern for batching database requests.',
    keywords: ['performance', 'database', 'optimization'],
    status: 'pending',
    createdAt: new Date(Date.now() - 10800000).toISOString()
  },
  {
    id: 'insight_4',
    type: 'finding',
    content: 'The authentication token refresh logic has a race condition when multiple API calls happen simultaneously. Need to implement a token refresh queue.',
    keywords: ['auth', 'security', 'bug'],
    status: 'shared',
    sharedAt: new Date(Date.now() - 86400000).toISOString(),
    createdAt: new Date(Date.now() - 172800000).toISOString()
  },
  {
    id: 'insight_5',
    type: 'decision',
    content: 'Moving forward with Server-Sent Events (SSE) for real-time updates instead of WebSockets due to simpler infrastructure requirements.',
    keywords: ['real-time', 'architecture', 'infrastructure'],
    status: 'shared',
    sharedAt: new Date(Date.now() - 43200000).toISOString(),
    createdAt: new Date(Date.now() - 259200000).toISOString()
  }
];

// Helper to parse JSON body
const parseBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try {
      resolve(body ? JSON.parse(body) : {});
    } catch {
      resolve({});
    }
  });
});

// Helper to send JSON response
const sendJSON = (res, data, status = 200) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
  });
  res.end(JSON.stringify(data));
};

// Helper to send SSE stream
const sendSSE = (res, events) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });

  let i = 0;
  const sendNext = () => {
    if (i < events.length) {
      res.write(`data: ${JSON.stringify(events[i])}\n\n`);
      i++;
      setTimeout(sendNext, 50);
    } else {
      res.end();
    }
  };
  sendNext();
};

// Mock AI responses
const generateMockResponse = (message) => {
  const responses = [
    `Thanks for your message! You said: "${message}"\n\nThis is a mock response from the local development server. The real backend will use Claude to generate intelligent responses.`,
    `I received your message: "${message}"\n\nIn production, this would connect to Amazon Bedrock with Claude. For now, you're seeing this mock response to test the UI.`,
    `Got it! Your input was: "${message}"\n\nThis mock server simulates the Atlas API. Features like streaming, thinking steps, and web search will work with the real backend.`,
  ];
  return responses[Math.floor(Math.random() * responses.length)];
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const path = url.pathname;
  const method = req.method;

  // Handle CORS preflight
  if (method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    });
    return res.end();
  }

  console.log(`${method} ${path}`);

  // Routes
  try {
    // Chat streaming endpoint
    if (path === '/api/chat/message/stream' && method === 'POST') {
      const body = await parseBody(req);
      const { message, session_id } = body;

      // Create session if needed
      if (session_id && !sessions[session_id]) {
        sessions[session_id] = {
          id: session_id,
          title: message.slice(0, 30) + (message.length > 30 ? '...' : ''),
          created_at: new Date().toISOString(),
          messages: []
        };
      }

      const response = generateMockResponse(message);
      const chunks = response.match(/.{1,20}/g) || [response];

      const events = [
        ...chunks.map(chunk => ({ type: 'chunk', content: chunk })),
        { type: 'done', session_id, message_id: `msg_${Date.now()}` }
      ];

      return sendSSE(res, events);
    }

    // Chat with files streaming
    if (path === '/api/chat/message/with-files/stream' && method === 'POST') {
      const response = "I received your files. This is a mock response - file processing would happen with the real backend.";
      const chunks = response.match(/.{1,20}/g) || [response];

      const events = [
        ...chunks.map(chunk => ({ type: 'chunk', content: chunk })),
        { type: 'done', session_id: `session_${Date.now()}`, message_id: `msg_${Date.now()}` }
      ];

      return sendSSE(res, events);
    }

    // Sessions
    if (path === '/api/sessions' && method === 'GET') {
      return sendJSON(res, { sessions: Object.values(sessions) });
    }

    if (path.match(/^\/api\/sessions\/[^/]+$/) && method === 'GET') {
      const sessionId = path.split('/')[3];
      return sendJSON(res, sessions[sessionId] || { id: sessionId, messages: [] });
    }

    if (path.match(/^\/api\/sessions\/[^/]+\/messages$/) && method === 'GET') {
      const sessionId = path.split('/')[3];
      return sendJSON(res, { messages: sessions[sessionId]?.messages || [] });
    }

    if (path.match(/^\/api\/sessions\/[^/]+$/) && method === 'PUT') {
      const sessionId = path.split('/')[3];
      const body = await parseBody(req);
      sessions[sessionId] = { ...sessions[sessionId], ...body };
      return sendJSON(res, sessions[sessionId]);
    }

    if (path.match(/^\/api\/sessions\/[^/]+$/) && method === 'DELETE') {
      const sessionId = path.split('/')[3];
      delete sessions[sessionId];
      return sendJSON(res, { success: true });
    }

    // Projects
    if (path === '/api/projects' && method === 'GET') {
      return sendJSON(res, { projects: Object.values(projects) });
    }

    if (path === '/api/projects' && method === 'POST') {
      const body = await parseBody(req);
      const id = `proj_${Date.now()}`;
      projects[id] = { id, ...body, created_at: new Date().toISOString() };
      return sendJSON(res, projects[id]);
    }

    // Insights - return array directly as expected by frontend
    if (path === '/api/insights/' && method === 'GET') {
      return sendJSON(res, mockModeEnabled ? mockInsights : []);
    }

    if (path === '/api/insights/pending/count' && method === 'GET') {
      const pendingCount = mockModeEnabled
        ? mockInsights.filter(i => i.status === 'pending').length
        : 0;
      return sendJSON(res, { count: pendingCount });
    }

    // Share insights
    if (path === '/api/insights/share' && method === 'POST') {
      const body = await parseBody(req);
      const { insight_ids } = body;
      if (insight_ids && Array.isArray(insight_ids)) {
        insight_ids.forEach(id => {
          const insight = mockInsights.find(i => i.id === id);
          if (insight) {
            insight.status = 'shared';
            insight.sharedAt = new Date().toISOString();
          }
        });
      }
      return sendJSON(res, { success: true, shared_count: insight_ids?.length || 0 });
    }

    // Connectors
    if (path === '/api/connectors/available' && method === 'GET') {
      return sendJSON(res, { connectors: [] });
    }

    // Settings/Mock mode
    if (path === '/api/settings/mock-mode' && method === 'GET') {
      return sendJSON(res, { mock_mode: mockModeEnabled });
    }

    if (path === '/api/settings/mock-mode' && method === 'POST') {
      const body = await parseBody(req);
      mockModeEnabled = body.enabled !== undefined ? body.enabled : !mockModeEnabled;
      console.log(`Mock mode set to: ${mockModeEnabled}`);
      return sendJSON(res, { mock_mode: mockModeEnabled });
    }

    // MCP Servers
    if (path === '/api/mcp/servers' && method === 'GET') {
      return sendJSON(res, { servers: [] });
    }

    // Artifacts
    if (path.match(/^\/api\/sessions\/[^/]+\/artifacts$/) && method === 'GET') {
      return sendJSON(res, { artifacts: [] });
    }

    // 404 for unhandled routes
    sendJSON(res, { error: 'Not found', path }, 404);

  } catch (error) {
    console.error('Error:', error);
    sendJSON(res, { error: error.message }, 500);
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Mock API Server running at http://localhost:${PORT}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  POST /api/chat/message/stream - Chat with streaming response`);
  console.log(`  GET  /api/sessions - List sessions`);
  console.log(`  GET  /api/projects - List projects`);
  console.log(`  GET  /api/insights/ - Get insights`);
  console.log(`\nUpdate your .env file:`);
  console.log(`  VITE_API_URL=http://localhost:8000\n`);
});

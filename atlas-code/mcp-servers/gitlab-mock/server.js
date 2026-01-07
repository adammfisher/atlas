/**
 * Ally AI Platform - GitLab Mock MCP Server
 * 
 * Simulates GitLab/GitHub operations for demos.
 * Provides code search, PR operations, and webhook simulation.
 */

const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');

const app = express();

// Enable CORS for all origins (needed for browser-based testing)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

const WORKSPACE = process.env.WORKSPACE || '/workspace';

// Store mock PRs
const mockPRs = new Map();
let prCounter = 1;

// ===========================================
// MCP Tool Definitions
// ===========================================

const TOOLS = {
  search_code: {
    name: 'search_code',
    description: 'Search for code patterns across the repository',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query (regex supported)' },
        file_pattern: { type: 'string', description: 'File pattern to search (e.g., *.js)' }
      },
      required: ['query']
    }
  },
  get_file_content: {
    name: 'get_file_content',
    description: 'Get the content of a file',
    inputSchema: {
      type: 'object',
      properties: {
        file_path: { type: 'string', description: 'Path to the file' }
      },
      required: ['file_path']
    }
  },
  create_merge_request: {
    name: 'create_merge_request',
    description: 'Create a new merge request',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'MR title' },
        description: { type: 'string', description: 'MR description' },
        source_branch: { type: 'string', description: 'Source branch' },
        target_branch: { type: 'string', description: 'Target branch' }
      },
      required: ['title', 'source_branch']
    }
  },
  post_mr_comment: {
    name: 'post_mr_comment',
    description: 'Post a comment on a merge request',
    inputSchema: {
      type: 'object',
      properties: {
        mr_id: { type: 'number', description: 'Merge request ID' },
        comment: { type: 'string', description: 'Comment text' },
        file_path: { type: 'string', description: 'Optional file path for inline comment' },
        line_number: { type: 'number', description: 'Optional line number for inline comment' }
      },
      required: ['mr_id', 'comment']
    }
  },
  get_mr_diff: {
    name: 'get_mr_diff',
    description: 'Get the diff for a merge request',
    inputSchema: {
      type: 'object',
      properties: {
        mr_id: { type: 'number', description: 'Merge request ID' }
      },
      required: ['mr_id']
    }
  },
  list_merge_requests: {
    name: 'list_merge_requests',
    description: 'List open merge requests',
    inputSchema: {
      type: 'object',
      properties: {
        state: { type: 'string', description: 'Filter by state (open, merged, closed)' }
      }
    }
  }
};

// ===========================================
// Tool Implementations
// ===========================================

async function searchCode(query, filePattern = '*') {
  try {
    const grepCmd = `grep -r -n "${query}" ${WORKSPACE} --include="${filePattern}" 2>/dev/null || true`;
    const result = execSync(grepCmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    
    const matches = result.split('\n').filter(Boolean).slice(0, 20).map(line => {
      const [filePath, lineNum, ...content] = line.split(':');
      return {
        file: filePath.replace(WORKSPACE, ''),
        line: parseInt(lineNum),
        content: content.join(':').trim()
      };
    });

    return { matches, total: matches.length };
  } catch (error) {
    return { matches: [], error: error.message };
  }
}

async function getFileContent(filePath) {
  try {
    const fullPath = path.join(WORKSPACE, filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return { 
      path: filePath, 
      content,
      lines: content.split('\n').length
    };
  } catch (error) {
    return { error: `File not found: ${filePath}` };
  }
}

function createMergeRequest(title, description, sourceBranch, targetBranch = 'main') {
  const mr = {
    id: prCounter++,
    title,
    description: description || '',
    source_branch: sourceBranch,
    target_branch: targetBranch,
    state: 'open',
    created_at: new Date().toISOString(),
    comments: [],
    diff: generateMockDiff(sourceBranch)
  };
  
  mockPRs.set(mr.id, mr);
  console.log(`[GitLab Mock] Created MR #${mr.id}: ${title}`);
  
  return {
    id: mr.id,
    web_url: `http://localhost:3002/mr/${mr.id}`,
    title: mr.title,
    state: mr.state
  };
}

function postMRComment(mrId, comment, filePath, lineNumber) {
  const mr = mockPRs.get(mrId);
  if (!mr) {
    return { error: `MR #${mrId} not found` };
  }

  const commentObj = {
    id: mr.comments.length + 1,
    body: comment,
    file_path: filePath || null,
    line_number: lineNumber || null,
    created_at: new Date().toISOString(),
    author: 'AI Review Agent'
  };

  mr.comments.push(commentObj);
  console.log(`[GitLab Mock] Comment added to MR #${mrId}:`, comment.substring(0, 100));

  return {
    id: commentObj.id,
    mr_id: mrId,
    posted: true
  };
}

function getMRDiff(mrId) {
  const mr = mockPRs.get(mrId);
  if (!mr) {
    return { error: `MR #${mrId} not found` };
  }

  return {
    id: mrId,
    title: mr.title,
    diff: mr.diff,
    files_changed: 3,
    additions: 45,
    deletions: 12
  };
}

function listMergeRequests(state = 'open') {
  const mrs = Array.from(mockPRs.values())
    .filter(mr => state === 'all' || mr.state === state)
    .map(mr => ({
      id: mr.id,
      title: mr.title,
      state: mr.state,
      source_branch: mr.source_branch,
      target_branch: mr.target_branch,
      comments_count: mr.comments.length
    }));

  return { merge_requests: mrs };
}

function generateMockDiff(branch) {
  return `
diff --git a/src/services/loan-service.js b/src/services/loan-service.js
index 1234567..abcdefg 100644
--- a/src/services/loan-service.js
+++ b/src/services/loan-service.js
@@ -45,6 +45,15 @@ class LoanService {
   async processApplication(application) {
     const validated = this.validateApplication(application);
+    
+    // New: Add credit check integration
+    const creditScore = await this.creditService.checkScore(application.ssn);
+    if (creditScore < 620) {
+      throw new LowCreditScoreError(creditScore);
+    }
+    
+    application.creditScore = creditScore;
+    
     return this.submitToUnderwriting(validated);
   }
 }
`;
}

// ===========================================
// MCP Protocol Endpoints
// ===========================================

app.get('/mcp/tools', (req, res) => {
  console.log('[MCP] GitLab tools list requested');
  res.json({ tools: Object.values(TOOLS) });
});

app.post('/mcp/execute', async (req, res) => {
  const { tool, arguments: args } = req.body;
  console.log(`[MCP] Executing GitLab tool: ${tool}`, args);

  try {
    let result;
    switch (tool) {
      case 'search_code':
        result = await searchCode(args.query, args.file_pattern);
        break;
      case 'get_file_content':
        result = await getFileContent(args.file_path);
        break;
      case 'create_merge_request':
        result = createMergeRequest(args.title, args.description, args.source_branch, args.target_branch);
        break;
      case 'post_mr_comment':
        result = postMRComment(args.mr_id, args.comment, args.file_path, args.line_number);
        break;
      case 'get_mr_diff':
        result = getMRDiff(args.mr_id);
        break;
      case 'list_merge_requests':
        result = listMergeRequests(args.state);
        break;
      default:
        result = { error: `Unknown tool: ${tool}` };
    }

    res.json({ result });
  } catch (error) {
    console.error(`[MCP] Error:`, error);
    res.status(500).json({ error: error.message });
  }
});

// ===========================================
// Webhook Simulation Endpoint
// ===========================================

app.post('/webhook/simulate', (req, res) => {
  const { event, data } = req.body;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`[WEBHOOK] Simulating ${event} event`);
  console.log(`${'='.repeat(60)}\n`);

  // Create a mock MR for PR events
  if (event === 'merge_request' && data.action === 'open') {
    const mr = createMergeRequest(
      data.title || 'Feature: Add credit check integration',
      data.description || 'Implements credit score validation before loan processing',
      data.source_branch || 'feature/credit-check',
      'main'
    );
    
    res.json({ 
      webhook_received: true,
      event,
      mr_created: mr
    });
  } else {
    res.json({ webhook_received: true, event });
  }
});

// View MR in browser (for demo)
app.get('/mr/:id', (req, res) => {
  const mr = mockPRs.get(parseInt(req.params.id));
  if (!mr) {
    return res.status(404).send('MR not found');
  }

  res.send(`
    <html>
    <head><title>MR #${mr.id}: ${mr.title}</title>
    <style>
      body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; max-width: 900px; margin: 50px auto; padding: 20px; }
      .header { border-bottom: 1px solid #ddd; padding-bottom: 20px; }
      .badge { background: #28a745; color: white; padding: 4px 8px; border-radius: 4px; font-size: 12px; }
      .diff { background: #f6f8fa; padding: 20px; border-radius: 8px; font-family: monospace; white-space: pre; overflow-x: auto; }
      .comment { background: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 15px 0; border-radius: 4px; }
      .comment-author { font-weight: bold; color: #6f42c1; }
    </style>
    </head>
    <body>
      <div class="header">
        <h1>MR #${mr.id}: ${mr.title}</h1>
        <span class="badge">${mr.state}</span>
        <p>${mr.source_branch} → ${mr.target_branch}</p>
      </div>
      
      <h2>Changes</h2>
      <div class="diff">${mr.diff}</div>
      
      <h2>Comments (${mr.comments.length})</h2>
      ${mr.comments.map(c => `
        <div class="comment">
          <div class="comment-author">${c.author}</div>
          <div>${c.body}</div>
          ${c.file_path ? `<small>📄 ${c.file_path}:${c.line_number}</small>` : ''}
        </div>
      `).join('')}
    </body>
    </html>
  `);
});

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'gitlab-mock-mcp' });
});

// ===========================================
// Start Server
// ===========================================

const PORT = process.env.PORT || 3002;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ALLY GITLAB MOCK MCP SERVER                              ║
║  ─────────────────────────────────────────────────────    ║
║  Port: ${PORT}                                              ║
║  Workspace: ${WORKSPACE}                                   
║  MR Browser: http://localhost:${PORT}/mr/:id                ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

#!/usr/bin/env node
/**
 * Test Script: Dual-Scope Memory System
 *
 * This script tests the global (user-level) memory functionality.
 * Run this after deploying the vector_memory branch changes.
 *
 * Prerequisites:
 * 1. Run `node scripts/ensure-global-indexes.js` to create the shared indexes
 * 2. Have the local server running: `node local-server.js`
 * 3. Have valid AWS credentials configured
 *
 * Usage: node scripts/test-global-memory.js
 */

require('dotenv').config();

const https = require('https');
const http = require('http');

// Configuration - Use AWS API Gateway and Lambda Function URL
const API_BASE = process.env.API_BASE || 'https://famlht6lp2.execute-api.us-east-1.amazonaws.com';
const STREAM_URL = process.env.STREAM_URL || 'https://vminx32zctbv4pqdwqyjllacwi0bjidt.lambda-url.us-east-1.on.aws/';
const TEST_USER_ID = process.env.TEST_USER_ID || 'test-user-' + Date.now();
// Auth token - generate via: node -e "require('jsonwebtoken').sign({sub:'USER_ID',username:'USERNAME',role:'admin'},'JWT_SECRET',{expiresIn:'24h'})"
const AUTH_TOKEN = process.env.AUTH_TOKEN || '';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step, description) {
  console.log(`\n${colors.bright}${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.bright}${colors.cyan}STEP ${step}: ${description}${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════════════════════════${colors.reset}\n`);
}

function logSuccess(message) {
  console.log(`${colors.green}✓ ${message}${colors.reset}`);
}

function logWarning(message) {
  console.log(`${colors.yellow}⚠ ${message}${colors.reset}`);
}

function logError(message) {
  console.log(`${colors.red}✗ ${message}${colors.reset}`);
}

async function makeRequest(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, API_BASE);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
      ...headers
    };

    // Add auth token as Bearer header (works cross-domain)
    if (AUTH_TOKEN) {
      requestHeaders['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method,
      headers: requestHeaders
    };

    const req = lib.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, data: JSON.parse(data), headers: res.headers });
        } catch (e) {
          resolve({ status: res.statusCode, data, headers: res.headers });
        }
      });
    });

    req.on('error', reject);

    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function streamChat(sessionId, message, projectId = null) {
  return new Promise((resolve, reject) => {
    // Use Lambda Function URL for streaming
    const url = new URL(STREAM_URL);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;

    const body = JSON.stringify({
      session_id: sessionId,
      message,
      project_id: projectId,
      model: 'haiku'
    });

    const requestHeaders = {
      'Content-Type': 'application/json',
      'x-user-id': TEST_USER_ID,
      'Accept': 'text/event-stream'
    };

    // Add auth token as Bearer header (works cross-domain)
    if (AUTH_TOKEN) {
      requestHeaders['Authorization'] = `Bearer ${AUTH_TOKEN}`;
    }

    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: requestHeaders
    };

    const req = lib.request(options, (res) => {
      let fullResponse = '';
      let memoryContext = null;
      let events = [];

      res.on('data', chunk => {
        const text = chunk.toString();
        const lines = text.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const event = JSON.parse(line.slice(6));
              events.push(event);

              if (event.type === 'chunk') {
                fullResponse += event.content || '';
              } else if (event.type === 'memory_context') {
                memoryContext = event;
              }
            } catch (e) {
              // Ignore parse errors for partial data
            }
          }
        }
      });

      res.on('end', () => {
        resolve({
          status: res.statusCode,
          response: fullResponse,
          memoryContext,
          events
        });
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║     DUAL-SCOPE MEMORY SYSTEM TEST SUITE                   ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  log(`API Base: ${API_BASE}`, 'yellow');
  log(`Test User ID: ${TEST_USER_ID}`, 'yellow');

  let globalSessionId = null;
  let projectSessionId = null;

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 1: Create a global (non-project) session
  // ═══════════════════════════════════════════════════════════════════════════
  logStep(1, 'Create a Global (Non-Project) Session');

  try {
    const sessionRes = await makeRequest('POST', '/api/sessions', {
      title: 'Global Memory Test Session'
      // NOTE: No projectId - this is a global session
    });

    if (sessionRes.status === 200 || sessionRes.status === 201) {
      globalSessionId = sessionRes.data.sessionId || sessionRes.data.session?.sessionId;
      logSuccess(`Created global session: ${globalSessionId}`);
    } else {
      logError(`Failed to create session: ${JSON.stringify(sessionRes.data)}`);
      return;
    }
  } catch (err) {
    logError(`Error creating session: ${err.message}`);
    return;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 2: Send messages with facts that should be remembered
  // ═══════════════════════════════════════════════════════════════════════════
  logStep(2, 'Send Messages with Facts to Remember');

  const factsToRemember = [
    "My name is Alex and I work as a software architect at TechCorp.",
    "I prefer TypeScript over JavaScript and always use strict mode.",
    "I'm currently working on a microservices migration project using Kubernetes."
  ];

  for (let i = 0; i < factsToRemember.length; i++) {
    const fact = factsToRemember[i];
    log(`\nSending message ${i + 1}/${factsToRemember.length}: "${fact.substring(0, 50)}..."`, 'cyan');

    try {
      const chatRes = await streamChat(globalSessionId, fact, null);

      if (chatRes.status === 200) {
        logSuccess(`Message sent successfully`);

        if (chatRes.memoryContext) {
          log(`  Memory context received: scope=${chatRes.memoryContext.scope}`, 'yellow');
          if (chatRes.memoryContext.scope === 'global') {
            log(`  Global memories: ${chatRes.memoryContext.globalMemoryCount || 0}`, 'yellow');
            log(`  Global conversations: ${chatRes.memoryContext.globalConversationsCount || 0}`, 'yellow');
          }
        }

        // Show a snippet of the response
        const responseSnippet = chatRes.response?.substring(0, 150) || '[No response]';
        log(`  Response: ${responseSnippet}...`, 'bright');
      } else {
        logWarning(`Unexpected status: ${chatRes.status}`);
      }
    } catch (err) {
      logError(`Error sending message: ${err.message}`);
    }

    // Wait a bit between messages to allow memory processing
    await sleep(2000);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 3: Wait for memory processing
  // ═══════════════════════════════════════════════════════════════════════════
  logStep(3, 'Wait for Memory Processing');

  log('Waiting 5 seconds for memories to be processed...', 'yellow');
  await sleep(5000);
  logSuccess('Memory processing time elapsed');

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 4: Start a NEW session and test memory retrieval
  // ═══════════════════════════════════════════════════════════════════════════
  logStep(4, 'Create NEW Session and Test Memory Retrieval');

  try {
    const newSessionRes = await makeRequest('POST', '/api/sessions', {
      title: 'Memory Retrieval Test'
    });

    if (newSessionRes.status === 200 || newSessionRes.status === 201) {
      const newSessionId = newSessionRes.data.sessionId || newSessionRes.data.session?.sessionId;
      logSuccess(`Created new session: ${newSessionId}`);

      // Ask something that should trigger memory retrieval
      log('\nAsking: "What programming language do I prefer?"', 'cyan');

      const testRes = await streamChat(newSessionId, "What programming language do I prefer?", null);

      if (testRes.status === 200) {
        logSuccess('Query successful');

        // Check for memory context
        if (testRes.memoryContext) {
          log(`\nMemory Context Received:`, 'green');
          log(`  Scope: ${testRes.memoryContext.scope}`, 'yellow');

          if (testRes.memoryContext.scope === 'global') {
            log(`  Global Memories: ${testRes.memoryContext.globalMemoryCount || 0}`, 'yellow');
            log(`  Global Conversations: ${testRes.memoryContext.globalConversationsCount || 0}`, 'yellow');

            if (testRes.memoryContext.memories && testRes.memoryContext.memories.length > 0) {
              log(`\n  Retrieved Memories:`, 'green');
              testRes.memoryContext.memories.forEach((mem, idx) => {
                log(`    ${idx + 1}. [${mem.category}] ${mem.content?.substring(0, 80)}...`, 'bright');
              });
            }
          }
        } else {
          logWarning('No memory context in response (memories may not have been stored yet)');
        }

        // Show the AI's response
        log(`\nAI Response:`, 'green');
        log(`  ${testRes.response?.substring(0, 300)}...`, 'bright');

        // Check if the response mentions TypeScript
        if (testRes.response?.toLowerCase().includes('typescript')) {
          logSuccess('AI correctly recalled TypeScript preference from memory!');
        } else {
          logWarning('AI response may not have used memory context');
        }
      }
    }
  } catch (err) {
    logError(`Error in memory retrieval test: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // STEP 5: Test Project Context Isolation
  // ═══════════════════════════════════════════════════════════════════════════
  logStep(5, 'Test Project Context Isolation (Optional)');

  log('This step requires an existing project. Skipping if no projects exist.', 'yellow');

  try {
    const projectsRes = await makeRequest('GET', '/api/projects');

    if (projectsRes.status === 200 && projectsRes.data.projects?.length > 0) {
      const testProject = projectsRes.data.projects[0];
      log(`Found project: ${testProject.name} (${testProject.projectId})`, 'cyan');

      // Create a project session
      const projectSessionRes = await makeRequest('POST', '/api/sessions', {
        title: 'Project Memory Test',
        projectId: testProject.projectId
      });

      if (projectSessionRes.status === 200 || projectSessionRes.status === 201) {
        projectSessionId = projectSessionRes.data.sessionId || projectSessionRes.data.session?.sessionId;
        logSuccess(`Created project session: ${projectSessionId}`);

        // Send a message in project context
        log('\nAsking same question in PROJECT context...', 'cyan');

        const projectChatRes = await streamChat(
          projectSessionId,
          "What programming language do I prefer?",
          testProject.projectId
        );

        if (projectChatRes.memoryContext) {
          log(`\nMemory Context:`, 'green');
          log(`  Scope: ${projectChatRes.memoryContext.scope}`, 'yellow');

          if (projectChatRes.memoryContext.scope === 'project') {
            logSuccess('Correctly using PROJECT memory scope (not global)');
            log(`  Project: ${projectChatRes.memoryContext.projectName}`, 'yellow');
            log(`  Semantic Memories: ${projectChatRes.memoryContext.semanticMemoryCount || 0}`, 'yellow');
          } else if (projectChatRes.memoryContext.scope === 'global') {
            logWarning('Using global memory in project context - check routing logic');
          }
        }
      }
    } else {
      log('No projects found - skipping project isolation test', 'yellow');
    }
  } catch (err) {
    logWarning(`Project test skipped: ${err.message}`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  console.log(`\n${colors.bright}${colors.cyan}`);
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    TEST SUMMARY                           ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');
  console.log(colors.reset);

  log('Tests completed. Check the output above for results.', 'green');
  log('\nWhat to verify:', 'yellow');
  log('  1. Global sessions should show scope: "global" in memory_context events', 'bright');
  log('  2. Project sessions should show scope: "project" in memory_context events', 'bright');
  log('  3. Facts from earlier messages should be retrieved in new sessions', 'bright');
  log('  4. Memory context should include category-grouped facts', 'bright');

  log('\nManual verification:', 'yellow');
  log('  - Check CloudWatch/console logs for "[GlobalContext]" and "[Memory]" entries', 'bright');
  log('  - Check S3 Vectors console for vectors in global-memories index', 'bright');
  log(`  - Test user ID used: ${TEST_USER_ID}`, 'bright');
}

// Run the tests
runTests().catch(err => {
  logError(`Test suite failed: ${err.message}`);
  console.error(err);
  process.exit(1);
});

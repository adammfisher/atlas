/**
 * Ally AI Platform - Webhook Receiver
 *
 * Receives webhook events and triggers automated agents.
 * In production, this would spin up Claude Agent SDK containers.
 * For demo, it logs events and simulates agent responses.
 */

const express = require('express');
const app = express();
app.use(express.json());

// Store webhook events for demo visibility
const events = [];

app.post('/webhook/pr', async (req, res) => {
  const event = {
    type: 'pull_request',
    action: req.body.action || 'opened',
    pr: req.body.pull_request || { title: 'Feature: Add credit check integration', number: 1 },
    timestamp: new Date().toISOString()
  };

  events.push(event);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🔔 WEBHOOK RECEIVED: Pull Request                        ║
╠═══════════════════════════════════════════════════════════╣
║  Action: ${event.action.padEnd(47)}║
║  PR: #${String(event.pr.number).padEnd(50)}║
║  Title: ${event.pr.title.substring(0, 45).padEnd(47)}║
╠═══════════════════════════════════════════════════════════╣
║  🤖 TRIGGERING: PR Review Agent (Claude Agent SDK)        ║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Create MR in GitLab mock
  try {
    const mrResponse = await fetch('http://mcp-gitlab:3002/webhook/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event: 'merge_request',
        data: {
          action: 'open',
          title: event.pr.title,
          source_branch: 'feature/credit-check'
        }
      })
    });
    const mrData = await mrResponse.json();
    console.log(`  📝 Created MR #${mrData.mr_created?.id} in GitLab`);

    // Simulate agent posting review comment
    setTimeout(async () => {
      await fetch('http://mcp-gitlab:3002/mcp/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tool: 'post_mr_comment',
          arguments: {
            mr_id: mrData.mr_created?.id || 1,
            comment: `## AI Code Review\n\n### Summary\nAdds credit score validation before loan processing.\n\n### Compliance ✅\n- PII masking present for SSN\n- Audit logging included\n\n### Patterns ✅\n- Follows Circuit Breaker pattern per ADR-042\n- Credit check integration matches existing patterns\n\n### Security ⚠️\n- Consider adding rate limiting for credit check endpoint\n\n### Verdict\n✅ **Approved** - No blocking issues found`
          }
        })
      });

      console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ PR REVIEW AGENT COMPLETED                             ║
║  ─────────────────────────────────────────────────────    ║
║  • Analyzed 3 files, 45 additions, 12 deletions           ║
║  • Queried Knowledge Core for patterns                    ║
║  • Posted 1 review comment                                ║
║  • Approved: No blocking issues found                     ║
║                                                           ║
║  📄 View MR: http://localhost:3002/mr/${mrData.mr_created?.id || 1}                 ║
╚═══════════════════════════════════════════════════════════╝
      `);
    }, 3000);

    res.json({ received: true, agent_triggered: 'pr-review', mr_id: mrData.mr_created?.id });
  } catch (error) {
    console.error('Failed to create MR:', error.message);
    res.json({ received: true, agent_triggered: 'pr-review', error: error.message });
  }
});

app.post('/webhook/merge', async (req, res) => {
  const event = {
    type: 'merge',
    branch: req.body.ref || 'main',
    commits: req.body.commits || [],
    timestamp: new Date().toISOString()
  };

  events.push(event);

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🔔 WEBHOOK RECEIVED: Merge to ${event.branch.padEnd(27)}║
╠═══════════════════════════════════════════════════════════╣
║  🤖 TRIGGERING: Code Archaeologist Agent                  ║
║                                                           ║
║  This agent will:                                         ║
║  • Analyze merged code for patterns                       ║
║  • Extract architecture decisions                         ║
║  • Update Knowledge Core graph                            ║
╚═══════════════════════════════════════════════════════════╝
  `);

  setTimeout(() => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ✅ CODE ARCHAEOLOGIST COMPLETED                          ║
║  ─────────────────────────────────────────────────────    ║
║  • Identified pattern: credit-check-integration           ║
║  • Updated service dependency graph                       ║
║  • Linked to ADR-042: Credit Service Integration          ║
║  • Knowledge Core updated with 3 new relationships        ║
╚═══════════════════════════════════════════════════════════╝
    `);
  }, 4000);

  res.json({ received: true, agent_triggered: 'code-archaeologist' });
});

app.post('/webhook/build', async (req, res) => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  🔔 WEBHOOK RECEIVED: Build Complete                      ║
╠═══════════════════════════════════════════════════════════╣
║  🤖 TRIGGERING: Test Generator Agent                      ║
╚═══════════════════════════════════════════════════════════╝
  `);

  res.json({ received: true, agent_triggered: 'test-generator' });
});

// View recent events
app.get('/events', (req, res) => {
  res.json({ events: events.slice(-20) });
});

// Demo trigger page
app.get('/', (req, res) => {
  res.send(`
    <html>
    <head>
      <title>Ally AI Platform - Webhook Demo</title>
      <style>
        body { font-family: -apple-system, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
        button { padding: 15px 30px; font-size: 16px; margin: 10px; cursor: pointer; border-radius: 8px; border: none; }
        .pr { background: #28a745; color: white; }
        .merge { background: #007bff; color: white; }
        .build { background: #ffc107; color: black; }
        .output { background: #1e1e1e; color: #0f0; padding: 20px; border-radius: 8px; font-family: monospace; white-space: pre; margin-top: 20px; min-height: 200px; }
        h1 { color: #1e3a5f; }
      </style>
    </head>
    <body>
      <h1>🤖 Ally AI Platform - Webhook Simulator</h1>
      <p>Click buttons to simulate GitLab/GitHub webhook events that trigger automated agents.</p>
      
      <button class="pr" onclick="triggerWebhook('pr')">🔀 Simulate PR Opened</button>
      <button class="merge" onclick="triggerWebhook('merge')">✅ Simulate Merge to Main</button>
      <button class="build" onclick="triggerWebhook('build')">🔧 Simulate Build Complete</button>
      
      <h2>Agent Output</h2>
      <div class="output" id="output">Waiting for webhook events...\n\nClick a button above to trigger an automated agent.</div>
      
      <script>
        async function triggerWebhook(type) {
          const output = document.getElementById('output');
          output.textContent = 'Triggering ' + type + ' webhook...\\n';
          
          const response = await fetch('/webhook/' + type, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'opened',
              pull_request: { title: 'Feature: Add credit check integration', number: 42 },
              ref: 'main'
            })
          });
          
          const result = await response.json();
          output.textContent += '\\n✅ Webhook received!\\n';
          output.textContent += '🤖 Agent triggered: ' + result.agent_triggered + '\\n';
          output.textContent += '\\n(Check docker logs for agent output)';
        }
      </script>
    </body>
    </html>
  `);
});

// ===========================================
// Artifact Sync from Atlas Research
// ===========================================

app.post('/sync/artifact', async (req, res) => {
  const artifact = req.body;

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  📥 ARTIFACT SYNC RECEIVED                                ║
╠═══════════════════════════════════════════════════════════╣
║  Title: ${(artifact.title || 'Unknown').substring(0, 45).padEnd(45)}║
║  Type: ${(artifact.type || 'analysis').padEnd(48)}║
║  Author: ${(artifact.author?.name || 'Unknown').padEnd(46)}║
║  Services: ${(artifact.entities?.filter(e => e.type === 'service').map(e => e.name).join(', ') || 'none').substring(0, 43).padEnd(43)}║
╚═══════════════════════════════════════════════════════════╝
  `);

  // Forward to Knowledge Core MCP for ingestion
  try {
    const response = await fetch('http://mcp-knowledge-core:3001/artifacts/ingest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(artifact)
    });

    const result = await response.json();

    if (result.success) {
      console.log(`✅ Artifact synced to Knowledge Core: ${artifact.id}`);

      // Broadcast to any listening Claude Code sessions
      broadcastToSessions({
        type: 'artifact_available',
        artifact: {
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          author: artifact.author?.name
        }
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Artifact sync failed:', error.message);
    res.status(500).json({ error: error.message });
  }
});

// Broadcast to active sessions (for real-time notification)
function broadcastToSessions(message) {
  // In production, this would use WebSocket or SSE
  console.log('Broadcasting to sessions:', JSON.stringify(message));
}

const PORT = 3003;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ALLY WEBHOOK RECEIVER                                    ║
║  ─────────────────────────────────────────────────────    ║
║  Demo UI: http://localhost:${PORT}                          ║
║  PR Webhook: POST http://localhost:${PORT}/webhook/pr       ║
║  Merge Webhook: POST http://localhost:${PORT}/webhook/merge ║
║  Artifact Sync: POST http://localhost:${PORT}/sync/artifact ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
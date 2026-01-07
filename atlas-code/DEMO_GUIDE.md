# Ally AI Platform Demo Guide

## Pre-Demo Setup (5 minutes)

### 1. Start the Platform
```bash
cd ally-ai-platform-demo
docker-compose up -d
```

### 2. Verify Services Are Running
```bash
docker-compose ps
```

All services should show "Up":
- ally-code-server (port 8080)
- ally-neo4j (ports 7474, 7687)
- ally-opensearch (port 9200)
- ally-redis (port 6379)
- ally-mcp-knowledge-core (port 3001)
- ally-mcp-gitlab (port 3002)
- ally-webhook-receiver (port 3003)

### 3. Load Knowledge Core Data
```bash
# Wait for Neo4j to be ready, then load sample data
docker exec -i ally-neo4j cypher-shell -u neo4j -p allyfinancial < data/neo4j-init.cypher
```

### 4. Open Browser Tabs
- **VS Code**: http://localhost:8080 (password: demo123)
- **Neo4j Browser**: http://localhost:7474 (login: neo4j / allyfinancial)
- **Webhook Simulator**: http://localhost:3003

---

## Demo Script

### PART 1: Introduction (2 minutes)

**Talking Points:**
> "Today I'm going to show you Ally's centralized AI coding platform. This is what we're building to give every developer AI-assisted coding with enterprise context.
>
> The platform has two paths:
> 1. **Interactive** - Developer works with Claude Code in a browser-based VS Code
> 2. **Automated** - Background agents handle routine tasks like PR reviews
>
> Both paths share the same Knowledge Core - a graph of our services, teams, patterns, and compliance requirements."

---

### PART 2: The Developer Experience (5 minutes)

#### Step 1: Open VS Code
- Navigate to http://localhost:8080
- Enter password: `demo123`

**Say:**
> "This is the developer's view. It's VS Code running in the browser, connected to Claude Code. Everything runs in an isolated VM - one per developer session."

#### Step 2: Authenticate with Claude
- Open terminal in VS Code
- Run: `claude`
- Follow browser authentication

**Say:**
> "The developer logs in with their existing Anthropic or company credentials. No API keys to manage."

#### Step 3: Show the Agents Folder
- Navigate to `.claude/agents/` in the file explorer
- Open `explore.md`

**Say:**
> "These are our sub-agents - 29 of them. They're not code, they're prompt libraries that tell Claude HOW to work for Ally. They're loaded from a central S3 bucket, so when we update one, every developer gets it."

---

### PART 3: Knowledge Core Integration (5 minutes)

#### Step 4: Explore a Service
In the Claude chat:
```
/explore loan-service
```

**Say:**
> "Watch what happens. The Explore agent queries our Knowledge Core before looking at any code."

**Point out:**
- Service ownership (Consumer Lending Team)
- Patterns in use (Event Sourcing, CQRS, Saga)
- Compliance requirements (PCI-DSS, SOC2, GLBA)
- Dependencies (credit-service, customer-service)

#### Step 5: Show Neo4j Graph
- Switch to Neo4j browser tab (http://localhost:7474)
- Run query:
```cypher
MATCH (s:Service {name: 'loan-service'})-[r]->(n)
RETURN s, r, n
```

**Say:**
> "This is what Claude just queried. The Knowledge Core is a graph database that knows which team owns what service, what patterns they use, what compliance rules apply. Every agent has access to this context."

#### Step 6: Query for Patterns
- Run in Neo4j:
```cypher
MATCH (s:Service)-[:USES_PATTERN]->(p:Pattern)
RETURN s.name, collect(p.name)
```

**Say:**
> "When a developer asks Claude to write code, the Code agent checks which patterns this service uses BEFORE writing anything. No more inconsistent implementations."

---

### PART 4: Automated Agents (5 minutes)

#### Step 7: Open Webhook Simulator
- Navigate to http://localhost:3003

**Say:**
> "Now let's look at the automated side. These agents run without a developer watching - triggered by webhooks from GitLab."

#### Step 8: Trigger PR Review
- Click "Simulate PR Opened" button
- Watch the docker logs:
```bash
docker-compose logs -f webhook-receiver
```

**Say:**
> "When someone opens a PR, GitLab fires a webhook. That triggers our PR Review agent - built with Claude Agent SDK, running in a container. It reviews the code, checks it against Knowledge Core patterns, and posts comments back to the PR. Developer comes back, review is already done."

**Point out the logs:**
- Webhook received
- Agent triggered
- Files analyzed
- Knowledge Core queried
- Comments posted

#### Step 9: Trigger Merge Event
- Click "Simulate Merge to Main"

**Say:**
> "When code merges, the Code Archaeologist agent analyzes it. It extracts patterns, identifies architecture decisions, and updates the Knowledge Core. The system learns from every merge."

---

### PART 5: Show Agent Output (3 minutes)

#### Step 10: View Mock PR
- Open http://localhost:3002/mr/1 (or the MR number shown in logs)

**Say:**
> "Here's what the PR looks like after the automated review. Comments are posted inline, just like a human reviewer would do."

#### Step 11: Show MCP Server Logs
```bash
docker-compose logs mcp-knowledge-core
```

**Say:**
> "These are the actual calls Claude made to Knowledge Core during the review. It's asking: what patterns does this service use? What compliance rules apply? Then it reviews the code against those standards."

---

### PART 6: Interactive Coding (5 minutes)

#### Step 12: Ask Claude to Write Code
Back in VS Code chat:
```
Add input validation to the loan-service processApplication method. Follow team standards.
```

**Say:**
> "Watch Claude check the patterns and standards before writing code."

**Point out:**
- Claude queries team standards first
- Code follows established patterns
- PII masking is applied automatically
- Audit logging is included

#### Step 13: Ask an Architecture Question
```
/architect Should we add caching to the credit-service integration?
```

**Say:**
> "The Architect agent checks our ADRs and existing patterns before making recommendations."

**Point out:**
- References ADR-042 (Credit Service Integration)
- Suggests 24-hour cache TTL per existing decision
- Notes compliance implications

---

### PART 7: Key Takeaways (2 minutes)

**Talking Points:**
> "What you've seen:
>
> 1. **Interactive path**: Developers get Claude Code in a browser, with full enterprise context from Knowledge Core
>
> 2. **Automated path**: Background agents handle PR reviews, pattern extraction, compliance checks - no babysitting required
>
> 3. **Shared infrastructure**: Same Knowledge Core, same agent definitions, same governance - whether interactive or automated
>
> 4. **Enterprise-ready**: Every query is logged, PII is protected, patterns are enforced
>
> The platform gives developers AI superpowers while maintaining the governance we need in financial services."

---

## Cleanup

```bash
docker-compose down -v
```

---

## Troubleshooting

### Neo4j won't start
```bash
docker-compose logs neo4j
# Usually needs more memory - check Docker settings
```

### Claude Code auth fails
```bash
# Make sure you can reach Anthropic from the container
docker exec ally-code-server curl -I https://api.anthropic.com
```

### MCP servers not responding
```bash
# Check health endpoints
curl http://localhost:3001/health
curl http://localhost:3002/health
```

### Knowledge Core queries return empty
```bash
# Reload the data
docker exec -i ally-neo4j cypher-shell -u neo4j -p allyfinancial < data/neo4j-init.cypher
```

---

## Demo Customization

### Add Your Own Services
Edit `data/neo4j-init.cypher` to add real Ally services.

### Add More Agents
Add `.md` files to the `agents/` directory.

### Connect Real GitLab
Replace `mcp-gitlab-mock` with a real GitLab MCP server pointing to your instance.

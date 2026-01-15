# Atlas Web - Knowledge Core Integration Context

## Current Status: ✅ FULLY IMPLEMENTED

The OpenSearch + Neo4j optimization has been **fully implemented and tested**. The system now uses fast semantic search via OpenSearch (~79ms) instead of multiple slow Neo4j queries (~500-1000ms).

---

## What We Built

A demo showing **Cross-Platform Knowledge Flow** where Atlas Research queries the Knowledge Core before Claude responds. The Knowledge Core provides enterprise context to augment Claude's responses.

**Key Principle**: Knowledge Core is SUPPLEMENTARY context. Claude is the brain that does ALL the work. If Knowledge Core has nothing relevant, Claude still responds normally.

---

## Architecture (CURRENT - WITH OPENSEARCH)

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Atlas Frontend │────▶│  Local Server    │────▶│  AWS Bedrock    │
│  (React/Vite)   │     │  (Node/Express)  │     │  (Claude)       │
│  Port 3000/3004 │     │  Port 8000       │     │                 │
└─────────────────┘     └────────┬─────────┘     └─────────────────┘
                                 │
                                 ▼
                        ┌──────────────────┐
                        │  MCP Knowledge   │
                        │  Core Server     │
                        │  Port 3001       │
                        └────────┬─────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
           ┌──────────────────┐      ┌──────────────────┐
           │  OpenSearch      │      │  Neo4j Database  │
           │  Port 9200       │      │  Port 7474/7687  │
           │  (FAST search)   │      │  (Full content)  │
           └──────────────────┘      └──────────────────┘
```

---

## How the Optimized Flow Works

```
User Query: "What are PCI-DSS requirements?"
                    │
                    ▼
    ┌───────────────────────────────┐
    │  1. OpenSearch Semantic Search │  ← FAST: ~79ms
    │     - Searches title, content  │
    │     - Returns scored matches   │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │  2. Enrich Top 5 from Neo4j   │  ← Only for high-scoring matches
    │     - Fetch full content      │
    │     - Get author info         │
    └───────────────┬───────────────┘
                    │
                    ▼
    ┌───────────────────────────────┐
    │  3. Send to Claude via Bedrock │
    │     - Context in system prompt │
    │     - Stream response back     │
    └───────────────────────────────┘
```

### Performance Comparison

| Old Approach | New Approach |
|-------------|--------------|
| 9+ Neo4j queries per request (3 terms × 3 searches) | 1 OpenSearch call + selective Neo4j enrichment |
| ~500-1000ms total | ~79ms for search |
| Always hits graph DB | Only hits Neo4j for top matches |
| Complex term extraction | Direct semantic search |

---

## Key Files (UPDATED)

### `/atlas-code/mcp-servers/knowledge-core/server.js`
The MCP Knowledge Core server with all tools:

**Tools Available:**
- `semantic_search` - **NEW** Fast OpenSearch-based semantic search
- `search_artifacts` - Search artifacts in Neo4j
- `search_patterns` - Search patterns in Neo4j
- `search_adrs` - Search ADRs in Neo4j
- `get_artifact` - Get full artifact content
- `get_service_info` - Get service details
- `get_dependencies` - Get service dependencies

**Key Functions:**
```javascript
// Lines 610-725: semanticSearch function
async function semanticSearch(query, types = null, limit = 10) {
  // 1. Query OpenSearch with multi_match on title^3, content, summary^2
  // 2. Enrich top 5 results from Neo4j (full content, author)
  // 3. Return results with scores and highlights
}
```

### `/atlas-code/mcp-servers/knowledge-core/sync-opensearch.js`
Script to sync Neo4j data to OpenSearch index:

```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code/mcp-servers/knowledge-core
node sync-opensearch.js
```

**What it syncs:**
- 3 Artifacts (PCI-DSS Compliance, Event Sourcing Guide, Loan Service Architecture)
- 5 Patterns (Event Sourcing, CQRS, Circuit Breaker, Saga, etc.)
- 4 ADRs (Architecture Decision Records)
- 6 Services (loan-service, credit-service, etc.)
- **Total: 18 documents**

### `/atlas-web/local-server.js`
The bridge between frontend, Knowledge Core, and Claude:

**Key Function (Lines 28-138):**
```javascript
async function queryKnowledgeCore(query) {
  // Single semantic_search call to MCP
  // Groups results by type (artifacts, patterns, adrs, services)
  // Returns empty context on error - Claude still responds
}
```

**Endpoints:**
- `POST /api/chat/message/stream` - Main chat endpoint (SSE streaming)
- `GET /api/sessions` - Proxies to AWS backend
- `GET /api/sessions/:id/messages` - Proxies to AWS backend
- `GET /api/projects` - Proxies to AWS backend
- `GET /health` - Health check

### `/atlas-web/frontend/src/components/Chat/ChatView.jsx`
- Handles message sending/receiving via SSE
- Manages thinking steps per message
- Renders Knowledge Core context in ThinkingSteps component
- Stores thinking steps in message object for persistence

### `/atlas-web/frontend/src/hooks/useChatStore.js`
- Zustand store with localStorage persistence
- `updateLastMessageThinkingSteps` for persisting thinking steps per message

---

## How to Run Everything

### Option 1: Quick Start (All at Once)

```bash
# 1. Start Docker Desktop (required for Neo4j, OpenSearch, Redis)
open -a Docker

# 2. Start all containers
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code
docker-compose up -d

# 3. Wait for OpenSearch to be ready (~15 seconds)
sleep 15
curl -s http://localhost:9200/_cluster/health | jq .

# 4. Sync Neo4j data to OpenSearch
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code/mcp-servers/knowledge-core
node sync-opensearch.js

# 5. Start MCP Knowledge Core Server
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code/mcp-servers/knowledge-core
node server.js &

# 6. Start Local Bridge Server
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-web
node local-server.js &

# 7. Start Frontend
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-web/frontend
npm run dev

# 8. Open browser
open http://localhost:3000
```

### Option 2: Individual Terminals

**Terminal 1: Docker Containers**
```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code
docker-compose up -d
docker-compose logs -f  # Optional: watch logs
```

**Terminal 2: MCP Knowledge Core Server**
```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code/mcp-servers/knowledge-core
node server.js
```

**Terminal 3: Local Bridge Server**
```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-web
node local-server.js
```

**Terminal 4: Frontend**
```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-web/frontend
npm run dev
```

---

## Service URLs

| Service | URL | Purpose |
|---------|-----|---------|
| Frontend | http://localhost:3000 or :3004 | React app |
| Local Server | http://localhost:8000 | Bridge to MCP + Bedrock |
| MCP Server | http://localhost:3001 | Knowledge Core API |
| OpenSearch | http://localhost:9200 | Fast semantic search |
| Neo4j Browser | http://localhost:7474 | Graph database UI |
| Neo4j Bolt | bolt://localhost:7687 | Database connection |

---

## Testing the System

### Test 1: Semantic Search Direct (MCP)
```bash
curl -s -X POST http://localhost:3001/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "semantic_search", "arguments": {"query": "payment", "limit": 5}}' | jq .
```

Expected: Returns PCI-DSS artifact with full content in ~79ms

### Test 2: Health Checks
```bash
curl -s http://localhost:8000/health  # Local server
curl -s http://localhost:3001/health  # MCP server
curl -s http://localhost:9200/_cluster/health | jq .status  # OpenSearch
```

### Test 3: Chat Flow
1. Open http://localhost:3000
2. Type: "What are the PCI-DSS requirements?"
3. Should see:
   - ThinkingSteps panel showing found artifacts
   - Claude response using the PCI-DSS content

### Test 4: No Context Flow
1. Type: "Write me a short poem about clouds"
2. Should see:
   - No ThinkingSteps (or empty results)
   - Claude responds with poem anyway

---

## Data in the Knowledge Core

### Artifacts (3)
| ID | Title | Author |
|----|-------|--------|
| artifact-001 | Event Sourcing Implementation Guide | David Park |
| artifact-002 | PCI-DSS Compliance Checklist for Payment Services | Sarah Wilson |
| artifact-003 | Loan Service Architecture Overview | Jennifer Martinez |

### Patterns (5)
- Event Sourcing
- CQRS (Command Query Responsibility Segregation)
- Circuit Breaker
- Saga Orchestration
- API Gateway

### ADRs (4)
| ID | Title | Status |
|----|-------|--------|
| ADR-001 | Use Event Sourcing for Financial Transactions | Accepted |
| ADR-002 | Adopt CQRS Pattern for Loan Service | Accepted |
| ADR-003 | Implement Circuit Breaker for External Services | Accepted |
| ADR-004 | Use Saga Pattern for Multi-Service Transactions | Proposed |

### Services (6)
- loan-service
- credit-service
- customer-service
- notification-service
- document-service
- payment-service

---

## Environment Configuration

### Frontend `.env.local`
```
VITE_API_URL=http://localhost:8000
VITE_STREAM_URL=http://localhost:8000/api/chat/message/stream
```

### Local Server Constants (local-server.js)
```javascript
const MCP_URL = 'http://localhost:3001';
const AWS_API_URL = 'https://famlht6lp2.execute-api.us-east-1.amazonaws.com';
const MODELS = {
  haiku: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  sonnet: 'us.anthropic.claude-sonnet-4-5-20250929-v1:0',
  opus: 'us.anthropic.claude-opus-4-5-20251101-v1:0'
};
```

### MCP Server Environment (server.js)
```javascript
NEO4J_URI = process.env.NEO4J_URI || 'bolt://localhost:7687'
NEO4J_USER = process.env.NEO4J_USER || 'neo4j'
NEO4J_PASSWORD = process.env.NEO4J_PASSWORD || 'allyfinancial'
OPENSEARCH_URL = process.env.OPENSEARCH_URL || 'http://localhost:9200'
REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379'
```

---

## Troubleshooting

### OpenSearch Connection Error
```
[MCP] Semantic search error: Connection Error
```
**Fix:** Make sure Docker is running and containers are up:
```bash
docker-compose up -d
sleep 15
curl -s http://localhost:9200/_cluster/health
```

### No Search Results
**Fix:** Run the sync script:
```bash
cd /Users/adamfisher/DEVELOP/AGENTS/ATLAS/atlas-code/mcp-servers/knowledge-core
node sync-opensearch.js
```

### Port Already in Use
```
Error: listen EADDRINUSE: address already in use :::3001
```
**Fix:** Kill existing process:
```bash
lsof -i :3001 | grep LISTEN | awk '{print $2}' | xargs kill -9
```

### Redis Connection Errors (Can be ignored)
```
[ioredis] Unhandled error event: AggregateError [ECONNREFUSED]
```
This is fine - Redis is optional and used for caching. The system works without it.

---

## Recent Changes Made

1. **OpenSearch Integration** - Added fast semantic search via OpenSearch
2. **sync-opensearch.js** - Script to index Neo4j data into OpenSearch
3. **semantic_search tool** - New MCP tool for fast searching
4. **queryKnowledgeCore refactor** - Single semantic search call instead of 9+ Neo4j queries
5. **Thinking steps per message** - Each message stores its own thinkingSteps array
6. **Sessions from AWS** - Local server proxies to AWS backend
7. **Artifact instructions in system prompt** - Claude knows how to create SVG, Mermaid, markdown

---

## What's Next (Future Improvements)

1. **Vector Embeddings** - Use Bedrock Titan embeddings for true semantic search
2. **Real-time Sync** - Auto-sync Neo4j changes to OpenSearch
3. **Caching** - Use Redis for frequently accessed artifacts
4. **Conversation History** - Send previous messages to Claude for context
5. **Artifact Creation** - Allow users to save Claude's outputs back to Knowledge Core

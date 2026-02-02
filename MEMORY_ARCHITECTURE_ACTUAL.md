# Atlas Web: Actual Memory/Semantic Search Architecture

**Document Date:** January 27, 2026
**Status:** Current Implementation Documentation
**Purpose:** Document the ACTUAL implementation of semantic memory and vector search in Atlas Web codebase

---

## Executive Summary

Atlas Web implements a **production-grade semantic memory system** using AWS S3 Vectors for storing and querying embedding vectors. The system has two parallel memory architectures:

1. **Project-Level Memory** - Per-project isolated vector indexes for conversation and fact storage
2. **Global Memory** - Shared indexes with user_id-based tenant isolation for non-project chats

The system is **live and operational** as of December 2025 (when S3 Vectors became GA and Terraform support was added in v6.24.0).

---

## 1. INFRASTRUCTURE LAYER

### S3 Vectors Setup (Terraform)

**File:** `atlas-web/terraform/s3-vectors.tf`

```terraform
# Native AWS S3 Vectors bucket resource (GA December 2025)
resource "aws_s3vectors_vector_bucket" "memory_vectors" {
  vector_bucket_name = "${var.project_name}-memory-vectors"  # e.g., atlas-dev-memory-vectors
}

# Exported outputs passed to Lambda
output "vectors_bucket_name" { ... }
output "vectors_bucket_arn" { ... }
```

**Key Points:**
- Uses native Terraform resource `aws_s3vectors_vector_bucket` (requires aws provider v6.24.0+)
- Single shared bucket stores ALL vector indexes (project-level and global)
- Indexes are created programmatically by Lambda on first use
- Sub-second query performance (GA service level)

---

## 2. EMBEDDING GENERATION

### Amazon Titan Embeddings V2

**File:** `atlas-web/lambda/shared/embeddings.js`

```javascript
const MODEL_ID = 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSION = 1024;  // Fixed dimension
const MAX_INPUT_CHARS = 32000;     // ~8192 tokens
```

**API Pattern:**
```javascript
const response = await client.send(new InvokeModelCommand({
  modelId: 'amazon.titan-embed-text-v2:0',
  contentType: 'application/json',
  body: JSON.stringify({
    inputText: text,          // Input text (auto-truncated to 32K chars)
    dimensions: 1024,         // Output dimension
    normalize: true           // L2 normalization for cosine similarity
  })
}));

// Returns: { embedding: number[] }  // 1024-dimensional vector
```

**Concurrency Pattern:**
```javascript
async function batchEmbeddings(texts, concurrency = 5) {
  // Process in batches to control concurrency
  // No native batching - parallelizes individual requests
  // Returns array of embeddings
}
```

**Key Design Decisions:**
- Uses **Titan V2** (not OpenAI or other models)
- L2 normalized embeddings for **cosine similarity** searches
- Supports multiple dimensions (256, 512, 1024) - currently fixed at 1024
- Auto-truncates text exceeding 8192 tokens (no errors)

---

## 3. VECTOR INDEX ARCHITECTURE

### Index Naming Convention

**Project-Level Indexes:**
```javascript
const getConversationsIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-conv`);  // e.g., "proj-abc123-conv"

const getMemoriesIndexName = (userId, projectId) =>
  sanitizeForIndexName(`${projectId}-mem`);   // e.g., "proj-abc123-mem"
```

**Global Indexes (Shared, User-Isolated):**
```javascript
const GLOBAL_MEMORIES_INDEX = 'global-memories';           // All users share
const GLOBAL_CONVERSATIONS_INDEX = 'global-conversations'; // All users share
// Tenant isolation via user_id metadata filter
```

**Sanitization Rules:**
```javascript
const sanitizeForIndexName = (str) =>
  str.toLowerCase().replace(/[^a-z0-9-]/g, '');
// Result: Max 63 chars, lowercase alphanumeric + hyphen only
```

### Index Configuration

```javascript
{
  vectorBucketName: process.env.VECTORS_BUCKET,
  dimension: 1024,           // Titan V2 embeddings
  distanceMetric: 'cosine',  // Cosine similarity for retrieval
  dataType: 'float32'        // 32-bit floating point storage
}
```

### Metadata Schema

#### Project-Level Conversation Chunks
```javascript
{
  key: `${sessionId}-${messageId}`,
  data: { float32: embedding },  // 1024-dimensional vector
  metadata: {
    // Filterable
    sessionId,
    messageId,
    role,
    timestamp: timestamp.toString(),
    projectId,
    userId,
    // Content (searchable but non-filterable)
    contentPreview: content.slice(0, 500)
  }
}
```

#### Project-Level Memory Facts
```javascript
{
  key: factId,  // e.g., "fact_abc123"
  data: { float32: embedding },
  metadata: {
    // Filterable
    category,                // decision | preference | technical | personal | goal | blocker | learning | context
    confidence: confidence.toString(),  // 0.0-1.0
    sourceSessionId,
    timestamp: timestamp.toString(),
    projectId,
    userId,
    // Content
    content  // Full fact text
  }
}
```

#### Global Memories (User-Isolated)
```javascript
{
  key: `mem_${userId}_${timestamp}_${randomId}`,
  data: { float32: embedding },
  metadata: {
    // Filterable (CRITICAL for tenant isolation)
    user_id: userId,           // ALWAYS filtered
    category,
    confidence: confidence.toString(),
    created_at,
    updated_at,
    source_session_id,
    mention_count,             // Track mentions for deduplication
    // Content (truncated to fit 2048 byte metadata limit)
    content,                   // Stored as metadata field
    source_context,
    extraction_reasoning
  }
}
```

**S3 Vectors Metadata Limits:**
- Max total metadata per vector: 2048 bytes
- Content fields truncated to fit (~1500 bytes for content + 200 for summary)

---

## 4. DATA INGESTION PIPELINE

### Trigger Points

**Project Conversations:**
1. Chat session ends → DynamoDB Stream → Memory Processor Lambda
2. Explicit API call: `POST /projects/{projectId}/memories` (manual)
3. Scheduled processing (optional)

**Non-Project (Global) Conversations:**
1. Session ends → DynamoDB Stream → Memory Processor Lambda (with `action: processGlobalSession`)

### Processing Flow

**File:** `atlas-web/lambda/functions/memory-processor/index.js`

```
Session Ends
    ↓
Memory Processor Lambda Triggered
    ↓
1. Initialize Indexes (if needed)
   └─ CreateIndexCommand({projectId}-conv, {projectId}-mem)
    ↓
2. Fetch Session Messages from DynamoDB
   └─ QueryCommand(MESSAGES_TABLE, sessionId)
    ↓
3. Chunk Conversation (2000 char target)
   ├─ chunkConversation(messages, 2000)
   ├─ Respects message boundaries
   ├─ Intelligently splits large messages
   └─ Returns: Array of chunks with metadata
    ↓
4. Generate Embeddings for Each Chunk
   ├─ getEmbedding(chunk.content) per chunk
   ├─ Parallelized with concurrency control
   └─ Returns: 1024-dimensional vectors
    ↓
5. Store Conversation Chunks
   ├─ storeConversationChunk(userId, projectId, chunk)
   ├─ PutVectorsCommand to {projectId}-conv index
   └─ Metadata includes sessionId, messageId, role, timestamp
    ↓
6. Extract Memory Facts (Claude Haiku)
   ├─ extractFacts(messages)
   ├─ Model: us.anthropic.claude-haiku-4-5-20251001-v1:0
   ├─ Returns: Array of {fact, category, confidence}
   └─ Temperature: 0.3 (consistent extraction)
    ↓
7. Generate Embeddings for Facts
   ├─ getEmbedding(fact.content) per fact
   └─ Returns: 1024-dimensional vectors
    ↓
8. Store Memory Facts
   ├─ storeMemoryFact(userId, projectId, fact)
   ├─ PutVectorsCommand to {projectId}-mem index
   └─ Metadata includes category, confidence, sourceSessionId
    ↓
9. Update Processing Status
   └─ UpdateCommand(SESSIONS_TABLE, {memoryProcessing: {status, chunks, facts}})
```

### Fact Extraction Model and Prompt

**Model:** `us.anthropic.claude-haiku-4-5-20251001-v1:0` (Claude Haiku 4.5)

**Categories:**
- `decision` - Business/technical decisions made
- `preference` - User preferences and requirements
- `technical` - APIs, libraries, patterns, technical details
- `personal` - Personal context about user
- `goal` - Project goals and milestones
- `blocker` - Issues and resolutions
- `learning` - Key insights and learnings
- `context` - Important project context

**Extraction Prompt:**
```
You are a memory extraction system. Analyze the conversation and extract
discrete, searchable facts that would be useful to recall later.

For each fact, provide:
- fact: A clear, standalone statement
- category: One of [decision, preference, technical, personal, goal, blocker, learning, context]
- confidence: 0.0-1.0 based on certainty/importance

Focus on: Decisions, preferences, technical details, goals, blockers, learnings, context

Do NOT extract: Generic filler, uncertain statements, context-only info, greetings

Return JSON array of facts. If no meaningful facts, return [].
```

**Inference Config:**
```javascript
{
  maxTokens: 4096,
  temperature: 0.3  // Low for consistent extraction
}
```

**Example Output:**
```json
[
  {"fact": "User prefers React with TypeScript for frontend", "category": "preference", "confidence": 0.9},
  {"fact": "Authentication uses JWT with 10-hour expiration", "category": "technical", "confidence": 1.0},
  {"fact": "Next milestone: complete payment integration by Q1 end", "category": "goal", "confidence": 0.8}
]
```

### Chunking Strategy

**File:** `atlas-web/lambda/shared/memoryExtractor.js`

```javascript
function chunkConversation(messages, chunkSize = 2000) {
  // Algorithm:
  // 1. Iterate through messages
  // 2. Accumulate messages in current chunk
  // 3. When adding next message would exceed chunkSize:
  //    - Save current chunk
  //    - Start new chunk
  // 4. For messages > chunkSize:
  //    - Split by paragraphs (\n\n)
  //    - Create multiple chunks from parts
  // 5. Never break within a message if possible

  // Returns: Array of {
  //   messages: message[],
  //   content: string,
  //   startTimestamp,
  //   endTimestamp,
  //   messageCount
  // }
}
```

### Deduplication (Global Memory)

**File:** `atlas-web/lambda/shared/vectors.js` (lines 431-537)

```javascript
async function storeGlobalMemoryFact(userId, fact) {
  // 1. Generate embedding for new fact
  const embedding = await getEmbedding(content);

  // 2. Search for similar facts (same user)
  const similar = await searchGlobalMemories(userId, content, {
    topK: 5,
    minScore: DEDUP_THRESHOLD  // 0.92
  });

  // 3. If similar fact exists with score >= 0.92:
  if (similar.length > 0 && similar[0].score >= 0.92) {
    // DELETE old vector
    // CREATE new vector with MERGED content
    // INCREMENT mention_count
    // Returns: { action: 'merged', key, previousKey }
  }

  // 4. Else: INSERT new fact
  // Returns: { action: 'inserted', key }
}
```

**Key Deduplication Logic:**
- **Threshold:** 0.92 cosine similarity
- **Merge Strategy:** Keep longer/richer content
- **Tracking:** Increment `mention_count` with each mention
- **Scope:** Per-user only (filters by user_id)

---

## 5. QUERY/RETRIEVAL PIPELINE

### At Chat Time

**File:** `atlas-web/lambda/functions/chat/index.js`

```javascript
// 1. User sends query to chat
// 2. Chat Lambda handles request
// 3. Search semantic memory (before calling Claude)

// Project scope:
const projectMemories = await searchMemories(
  userId, projectId, query,
  { topK: 10, minConfidence: 0.5 }
);

const projectConversations = await searchConversations(
  userId, projectId, query,
  { topK: 5 }
);

// Global scope (if non-project):
const globalMemories = await searchGlobalMemories(
  userId, query,
  { topK: 20, minScore: 0.01 }
);

const globalConversations = await searchGlobalConversations(
  userId, query,
  { topK: 10, minScore: 0.01 }
);

// 4. Format results for system prompt
// 5. Call Claude with enriched context
```

### Search Implementation

**File:** `atlas-web/lambda/shared/vectors.js`

```javascript
async function searchMemories(userId, projectId, query, options = {}) {
  const { topK = 10, minConfidence = 0.5, category = null } = options;

  // 1. Generate query embedding
  const queryEmbedding = await getEmbedding(query);

  // 2. Query vector index
  const response = await client.send(new QueryVectorsCommand({
    vectorBucketName: VECTOR_BUCKET,
    indexName: getMemoriesIndexName(userId, projectId),
    queryVector: { float32: queryEmbedding },
    topK,
    returnMetadata: true
  }));

  // 3. Post-process results
  return (response.vectors || []).map(v => ({
    factId: v.key,
    content: v.metadata?.content,
    category: v.metadata?.category,
    confidence: parseFloat(v.metadata?.confidence || '0'),
    score: v.score,  // Cosine similarity score
    sourceSessionId: v.metadata?.sourceSessionId
  }));
}
```

### Search Response Format

```javascript
{
  factId: "fact_abc123",
  content: "User prefers React with TypeScript",
  category: "preference",
  confidence: 0.9,
  score: 0.87,              // Cosine similarity (0.0 - 1.0)
  sourceSessionId: "sess_xyz"
}
```

### Token Budget Allocation

**File:** `atlas-web/lambda/shared/bedrock.js` (lines 79-87)

```javascript
const CONTEXT_BUDGET = {
  total: 200000,              // Total available tokens
  memory: 15000,              // Legacy DynamoDB synthesized memory
  semanticMemory: 10000,      // Vector-retrieved facts (~50-100 facts)
  pinnedFiles: 50000,         // Pinned file contents
  fileManifest: 2000,         // File list/manifest
  systemPrompt: 5000,         // System instructions
  conversation: 100000        // Recent conversation history
};
```

**Semantic Memory Allocation:**
- ~10,000 tokens for vector-retrieved memories
- Typically ~50-100 facts (depends on fact length)
- Facts ranked by relevance score, top-K selected

---

## 6. SYSTEM PROMPT INTEGRATION

### Context Section Order

**File:** `atlas-web/lambda/shared/bedrock.js` (lines 193-435)

The system prompt is assembled in this order:

```
1. System Instructions
   ├─ Critical behavior rules
   └─ Artifact format specifications

2. Artifact Context (if any exist)
   ├─ List of existing artifacts
   └─ Full content of each artifact

3. User Memory (Global/Non-Project only)
   ├─ Global facts about user
   └─ From global-memories index

4. Relevant Past Conversations (Global only)
   ├─ Conversation snippets
   └─ From global-conversations index

5. Project Context (if project-scoped chat)
   ├─ Project name and description
   ├─ Project instructions
   └─ Project metadata

6. Project Memory (if project-scoped)
   ├─ Synthesized memory (legacy DynamoDB)
   └─ High-priority project context

7. Semantic Memory (if project-scoped)
   ├─ Vector-retrieved facts
   ├─ Relevant to current query
   └─ Ranked by similarity score

8. Relevant Past Conversations (if project-scoped)
   ├─ Vector-retrieved conversation chunks
   └─ Ranked by similarity score

9. Available Files
   ├─ File manifest (names, tokens, status)
   ├─ Pinned file contents
   └─ Available for reference

10. Tools/MCP Definitions
    └─ Function definitions for Claude
```

### Semantic Memory Section Format

```xml
<semantic_memory>
These are relevant facts retrieved from previous conversations that may be
helpful for the current query:

- Fact 1 (from session X, confidence 0.95)
- Fact 2 (from session Y, confidence 0.87)
- Fact 3 (from session Z, confidence 0.92)
</semantic_memory>
```

### Code Reference

```javascript
if (projectContext.semanticMemory) {
  base += `\n\n<semantic_memory>
These are relevant facts retrieved from previous conversations that may be
helpful for the current query:

${projectContext.semanticMemory}
</semantic_memory>`;
}
```

---

## 7. LAMBDA FUNCTIONS

### Memory Processor Lambda

**File:** `atlas-web/lambda/functions/memory-processor/index.js`

| Property | Value |
|----------|-------|
| **Timeout** | 300 seconds (5 minutes) |
| **Memory** | 1024 MB |
| **Layers** | `/opt/nodejs/shared/` |
| **Triggers** | DynamoDB Stream (sessions), Manual invocation |
| **Max Concurrent** | Configurable (throttle on high volume) |

**Supported Actions:**
```javascript
// Single session (project)
{ action: 'processSession', userId, projectId, sessionId }

// All sessions in project
{ action: 'processProject', userId, projectId }

// Single global session (non-project)
{ action: 'processGlobalSession', userId, sessionId }

// Initialize indexes for project
{ action: 'initializeIndexes', userId, projectId }

// DynamoDB Stream records
{ Records: [ { eventSource: 'aws:dynamodb', ... } ] }
```

**Error Handling:**
- Logs errors per chunk/fact, continues processing others
- Returns partial results (what succeeded)
- Does NOT fail entire session for individual failures

### Chat Lambda

**File:** `atlas-web/lambda/functions/chat/index.js`

| Property | Value |
|----------|-------|
| **Timeout** | 300 seconds (5 minutes) |
| **Memory** | 1024 MB |
| **Layers** | `/opt/nodejs/shared/` |
| **Triggers** | API Gateway (Function URL) |
| **Max Concurrent** | Auto-scaled by API Gateway |

**Vector Integration:**

```javascript
// Lazy-loaded fallback pattern
let vectorsModule = null;
function getVectorsModule() {
  if (!vectorsModule) {
    try {
      vectorsModule = require('./shared/vectors');
    } catch (err) {
      console.warn('[Vectors] Module not available:', err.message);
      vectorsModule = {
        // Fallback functions returning empty results
        searchMemories: async () => [],
        searchConversations: async () => [],
        searchGlobalMemories: async () => [],
        searchGlobalConversations: async () => [],
        storeMemoryFact: async () => {},
        storeConversationChunk: async () => {},
        storeGlobalMemoryFact: async () => ({ action: 'skipped' }),
        storeGlobalConversationChunk: async () => {}
      };
    }
  }
  return vectorsModule;
}
```

**Purpose:** If vectors module is unavailable, chat still works with empty memory context.

### Projects Lambda

**File:** `atlas-web/lambda/functions/projects/index.js`

**Semantic Memory Endpoints:**

```
GET  /projects/{projectId}/memories
     ├─ List all semantic memories for project
     ├─ Query vector index: {projectId}-mem
     └─ Returns: Array of memories with metadata

POST /projects/{projectId}/memories
     ├─ Add new semantic memory manually
     ├─ PutVectorsCommand with embedding
     └─ Returns: Stored memory object

PUT  /projects/{projectId}/memories/{memoryId}
     ├─ Update existing memory
     ├─ Delete old + store updated
     └─ Returns: Updated memory

DELETE /projects/{projectId}/memories/{memoryId}
       ├─ Delete memory fact
       ├─ DeleteVectorsCommand
       └─ Returns: Deletion confirmation
```

**Legacy Memory Endpoints:**

```
GET  /projects/{projectId}/memory
     └─ Get synthesized memory (DynamoDB)

PUT  /projects/{projectId}/memory
     └─ Update synthesized memory

POST /projects/{projectId}/memory/regenerate
     └─ Regenerate via Claude Haiku
```

---

## 8. ENVIRONMENT VARIABLES

### Lambda Configuration

```bash
# Vector storage
VECTORS_BUCKET=atlas-dev-memory-vectors

# DynamoDB tables
SESSIONS_TABLE=atlas-sessions
MESSAGES_TABLE=atlas-messages
PROJECTS_TABLE=atlas-projects
PROJECT_MEMORY_TABLE=atlas-project-memory
ARTIFACTS_TABLE=atlas-artifacts
SUMMARIES_TABLE=atlas-summaries

# S3 buckets
UPLOADS_BUCKET=atlas-uploads
ARTIFACTS_BUCKET=atlas-artifacts
VECTORS_BUCKET=atlas-memory-vectors  # (also used for endpoints)

# Model endpoints
BEDROCK_REGION=us-east-1
```

### Terraform Variables

```terraform
variable "project_name" {
  description = "Project name (used for resource naming)"
  default     = "atlas-dev"
}

locals {
  vectors_bucket_name = "${var.project_name}-memory-vectors"
}
```

---

## 9. GRACEFUL DEGRADATION

### Lazy Loading Pattern

Both vectors and memory extraction modules are **lazy-loaded** to support graceful degradation:

```javascript
// When module fails to load:
// ✓ Chat still functions with empty memory context
// ✓ No null reference errors
// ✓ Users don't see degraded experience
// ✓ Error logged for investigation
```

### Vector Store Unavailability

If S3 Vectors service is down or bucket is misconfigured:
- Searches return empty arrays
- Chats proceed without semantic context
- System continues normal operation
- Errors logged with context

### Embedding Service Failure

If Bedrock is down:
- Fact extraction fails gracefully
- Fact embeddings not generated
- Previous facts still available
- New chats work without incremental memory

---

## 10. TENANT ISOLATION & SECURITY

### Project-Level Memory
- Each project gets dedicated indexes: `{projectId}-conv`, `{projectId}-mem`
- Index names sanitized to lowercase alphanumeric + hyphen (max 63 chars)
- Only users with project access can query indexes
- Isolation enforced at Lambda layer (before querying)

### Global Memory
- Shared indexes: `global-memories`, `global-conversations`
- **CRITICAL:** All queries filtered by `user_id` metadata
- Query filters always include: `{ user_id: { '$eq': userId } }`
- Prevents cross-user data leakage
- GDPR compliance: `deleteUserGlobalData()` removes all user vectors

### Access Control
```javascript
// User authenticated at API Gateway level
// UserId extracted from JWT token
// All vector operations include userId for isolation
// No cross-project or cross-user access possible

async function searchMemories(userId, projectId, query, options) {
  // userId and projectId validated before querying
  // Index name: sanitizeForIndexName(`${projectId}-mem`)
  // Search limited to that index only
}
```

---

## 11. COST OPTIMIZATION

### Embedding Costs

| Operation | Cost Estimate |
|-----------|---------------|
| Embedding text | ~$0.02 per 1M tokens (Titan V2) |
| Query (search) | No cost - included in S3 Vectors |
| Vector storage | ~$0.01 per GB-month (S3 Vectors) |

### Volume Estimates

**Per Project Per Month:**
- 100 chat sessions
- 10 chunks per session = 1,000 chunks stored
- 2-3 facts per chunk = 2,000-3,000 facts
- **Embedding cost:** ~$0.02-0.03
- **Storage cost:** < $0.01

**Global Memory Per User Per Month:**
- 50 chat sessions
- ~50-100 global facts
- **Embedding cost:** ~$0.01
- **Storage cost:** < $0.001

### Optimization Strategies

1. **Batch Embedding** - Parallelize with concurrency control
2. **Deduplication** - Merge similar facts to reduce storage
3. **Mention Tracking** - Increment count instead of storing duplicate
4. **Chunking** - Optimal chunk size (2000 chars) balances coverage vs. cost
5. **Selective Indexing** - Only project conversations indexed (not global chats by default in legacy system)

---

## 12. KEY DIFFERENCES: ACTUAL vs DESIGN

### What's Implemented

| Feature | Status | Details |
|---------|--------|---------|
| S3 Vectors integration | ✓ Live | Full AWS SDK integration |
| Titan V2 embeddings | ✓ Live | 1024-dim, L2 normalized |
| Project-level indexes | ✓ Live | Per-project isolation |
| Global memory | ✓ Live | User-isolated shared indexes |
| Fact extraction | ✓ Live | Claude Haiku 4.5 |
| Semantic search | ✓ Live | Query integration at chat time |
| Chunking strategy | ✓ Live | 2000 char target chunks |
| Deduplication | ✓ Live | 0.92 similarity threshold |
| Tenant isolation | ✓ Live | user_id filters enforced |
| Token budget | ✓ Live | 10K tokens for semantic memory |
| Graceful fallback | ✓ Live | Lazy loading with empty returns |

### Advanced Features Implemented

| Feature | Status |
|---------|--------|
| Mention count tracking | ✓ Tracks repetitions |
| Confidence scoring | ✓ 0.0-1.0 per fact |
| Category classification | ✓ 8 categories |
| GDPR deletion | ✓ User data removal |
| Session cleanup | ✓ Delete session vectors |
| Metadata filtering | ✓ Future-proofed |

### Known Limitations

| Item | Impact | Workaround |
|------|--------|-----------|
| Metadata size limit | 2048 bytes total | Truncate content fields |
| No native filtering | Manual post-processing | Filter results in Lambda |
| Bulk delete complex | Requires list + delete | Paging with continuation tokens |
| Single mention_count | Can't track per-session | Store separately if needed |
| No update in-place | Delete + re-insert | Regenerate embeddings |

---

## 13. OPERATIONAL CONSIDERATIONS

### Monitoring & Observability

**CloudWatch Logs:**
```
[Vectors] Created conversations index for project {projectId}
[MemoryProcessor] Extracted {N} facts from {M} messages
[Vectors] Found similar global fact (score: 0.95), merging
[MemoryExtractor] Extraction failed: {error message}
```

**Metrics to Track:**
- Facts extracted per session
- Deduplication rate (merged vs inserted)
- Search latency (should be < 500ms)
- Embedding API latency (should be < 2s per batch)
- Storage growth (should be ~0.01 GB per 1000 facts)

### Maintenance Tasks

**Periodic:**
1. Monitor S3 Vectors bucket size
2. Review deduplication merge rate
3. Check for extraction failures
4. Validate search relevance

**On-Demand:**
1. Reprocess project sessions: `{ action: 'processProject', userId, projectId }`
2. Delete project indexes: `deleteProjectIndexes(userId, projectId)`
3. Clean user data: `deleteUserGlobalData(userId)` (GDPR)

### Performance Tuning

**Chunk Size:** Currently 2000 chars
- Larger = fewer embeddings, less cost
- Smaller = better relevance, more storage

**Top-K Values:**
- Project memories: 10
- Project conversations: 5
- Global memories: 20
- Global conversations: 10

**Concurrency Control:**
- Embedding batch concurrency: 5 (default)
- Adjustable per workload

---

## 14. MCP SERVER INTEGRATION

### Knowledge Core MCP Server

**File:** `atlas-code/mcp-servers/knowledge-core/server.js`

**Database Backends:**
- Neo4j (enterprise knowledge graph)
- OpenSearch (semantic search)
- Redis (caching)

**Semantic Search Capabilities:**
```javascript
semantic_search(query, filters)
  ├─ Uses OpenSearch for full-text + semantic
  ├─ Returns artifacts with relevance scores
  └─ Min threshold: 3.0 (relevance)
```

**Artifact Management:**
- Ingestion from Atlas Research
- Storage in Neo4j + OpenSearch
- Deletion with cleanup

**Enterprise Context:**
- Service dependencies
- Architecture Decision Records (ADRs)
- Coding standards
- Compliance requirements

**Note:** This is SEPARATE from the project-level vector memory (different technology stack and scope).

---

## 15. FILE STRUCTURE

```
atlas-web/
├── lambda/
│   ├── shared/
│   │   ├── vectors.js                    # S3 Vectors client (914 lines)
│   │   ├── embeddings.js                 # Titan V2 embeddings (100 lines)
│   │   ├── memoryExtractor.js            # Haiku fact extraction (264 lines)
│   │   └── bedrock.js                    # System prompt builder
│   └── functions/
│       ├── memory-processor/
│       │   └── index.js                  # Background processing
│       ├── chat/
│       │   └── index.js                  # Chat handler with memory search
│       └── projects/
│           └── index.js                  # Project + memory endpoints
│
└── terraform/
    ├── s3-vectors.tf                     # S3 Vectors bucket (36 lines)
    ├── lambda.tf                         # Lambda function definitions
    └── iam.tf                            # IAM policies for vectors access
```

---

## 16. EXAMPLE FLOW: END-TO-END

### Scenario: User Chats in a Project

```
1. User sends query: "What was the decision on authentication?"

2. Chat Lambda (chat/index.js)
   ├─ Authenticate user
   ├─ Load vectors module
   └─ Search semantic memory

3. Search Memory (vectors.js:searchMemories)
   ├─ Generate embedding for query
   │  └─ Call Bedrock: "What was the decision on authentication?"
   │  └─ Receive 1024-dim vector
   ├─ Query index: "{projectId}-mem"
   │  └─ S3 Vectors QueryVectorsCommand
   │  └─ topK: 10
   ├─ Post-process results
   │  └─ Map to readable format
   └─ Return top memories:
      ├─ Memory 1: "Decision: Use JWT auth with 10h expiration" (score: 0.92)
      ├─ Memory 2: "Database: PostgreSQL for user storage" (score: 0.78)
      └─ Memory 3: "Session timeout: Implements refresh tokens" (score: 0.76)

4. Build System Prompt (bedrock.js:buildSystemPrompt)
   ├─ Add semantic memory section with results
   ├─ Include other context (files, instructions, etc.)
   └─ Assemble into full prompt

5. Call Claude Opus 4.5
   ├─ Send enriched system prompt
   ├─ Send user message: "What was the decision on authentication?"
   └─ Receive response with context awareness

6. Stream Response to User
   └─ Response includes information from semantic memory

7. Session Ends
   ├─ DynamoDB Stream triggers
   ├─ Memory Processor Lambda invoked
   ├─ Extract facts from conversation
   ├─ Store embeddings for future queries
   └─ Facts now available for next session
```

---

## 17. FUTURE CONSIDERATIONS

### Potential Enhancements

1. **Filtering by Category**
   - Currently: Post-process results
   - Future: Use S3 Vectors filter syntax

2. **Multi-Index Search**
   - Simultaneously search project + global memory
   - Merge and rank results

3. **Fact Graph**
   - Store relationships between facts
   - Use Neo4j for graph queries

4. **Confidence-Based Ranking**
   - Weight results by extraction confidence + similarity
   - Custom ranking formula

5. **Time-Decay**
   - Newer facts ranked higher
   - Configurable decay function

6. **Conversation Summaries**
   - Automatic summary generation per session
   - Stored separately for efficient retrieval

7. **Active Learning**
   - User feedback on fact relevance
   - Improve extraction over time

---

## 18. TROUBLESHOOTING GUIDE

### Memory Not Appearing in Chat

**Check:**
1. Is `VECTORS_BUCKET` env var set?
2. Does S3 Vectors bucket exist?
3. Were indexes created for project? (Check logs for "Created * index")
4. Did memory processor Lambda run after session ended?
5. Are search results empty? (Check "Index not found" logs)

**Debug:**
```bash
# Check memory processor logs
aws logs tail /aws/lambda/memory-processor --follow

# List indexes in S3 Vectors
aws s3vectors list-indexes --vector-bucket-name atlas-dev-memory-vectors
```

### Slow Search Performance

**Check:**
1. Index size (might be too large)
2. Query latency (should be < 500ms)
3. Embedding generation time (might be bottleneck)
4. Network latency

**Optimize:**
1. Reduce topK parameter
2. Increase concurrency for embeddings
3. Archive old indexes

### High Costs

**Check:**
1. Number of embeddings generated per day
2. Deduplication rate (are facts being merged?)
3. Chunk size (affects embedding count)

**Optimize:**
1. Increase chunk size (fewer embeddings)
2. Improve deduplication threshold
3. Process sessions less frequently
4. Use smaller embedding dimension (if acceptable)

---

## 19. SECURITY & COMPLIANCE

### Data Protection

- **Encryption:** S3 Vectors uses AWS-managed keys (AES-256)
- **Encryption in transit:** TLS 1.2+ for all API calls
- **Access Control:** IAM policies restrict vector access

### GDPR Compliance

```javascript
// Delete all user data
await deleteUserGlobalData(userId);
// Removes all vectors from both global indexes

// Delete session-specific data
await deleteSessionGlobalData(userId, sessionId);
// Removes vectors from sessions being deleted
```

### Audit Logging

- CloudWatch Logs capture all operations
- Vector operations logged with timestamps
- User context (userId) included in logs

---

## 20. REFERENCES

### Key Files with Line Numbers

| File | Purpose | Key Lines |
|------|---------|-----------|
| `vectors.js` | S3 Vectors client | 1-50 (setup), 57-99 (create), 208-243 (search) |
| `embeddings.js` | Titan V2 embeddings | 21-42 (single), 51-71 (batch) |
| `memoryExtractor.js` | Fact extraction | 58-106 (extract), 140-177 (chunk) |
| `bedrock.js` | System prompt | 193-435 (buildSystemPrompt) |
| `memory-processor/index.js` | Background processing | 33-200 (main handlers) |
| `chat/index.js` | Chat handler | 22-44 (lazy load), 78-87 (token budget) |
| `s3-vectors.tf` | Infrastructure | All (36 lines) |

---

## Appendix: Code Snippets

### Creating Indexes

```javascript
await client.send(new CreateIndexCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: getMemoriesIndexName(userId, projectId),
  dimension: 1024,
  distanceMetric: 'cosine',
  dataType: 'float32'
}));
```

### Storing a Fact

```javascript
await client.send(new PutVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: getMemoriesIndexName(userId, projectId),
  vectors: [{
    key: factId,
    data: { float32: embedding },
    metadata: {
      category: 'decision',
      confidence: '0.95',
      sourceSessionId: sessionId,
      content: 'User prefers React with TypeScript'
    }
  }]
}));
```

### Searching

```javascript
const response = await client.send(new QueryVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: getMemoriesIndexName(userId, projectId),
  queryVector: { float32: queryEmbedding },
  topK: 10,
  returnMetadata: true
}));
```

---

**Document Version:** 1.0
**Last Updated:** January 27, 2026
**Status:** CURRENT IMPLEMENTATION

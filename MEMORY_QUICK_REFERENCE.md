# Atlas Web Memory System - Quick Reference Card

---

## 30-Second Overview

**What:** Semantic memory system that learns from conversations and provides relevant context
**How:** Embeds conversations, extracts facts, stores in S3 Vectors, retrieves at query time
**Why:** Enables Claude to remember and reference previous work
**Cost:** ~$0.04/project/month

---

## Key Numbers

| Metric | Value |
|--------|-------|
| Embedding Dimension | 1024 |
| Chunk Size Target | 2000 characters |
| Dedup Threshold | 0.92 similarity |
| Search TopK (facts) | 10 |
| Search TopK (conversations) | 5 |
| Token Budget (semantic) | 10,000 / 200,000 |
| Extraction Model | Claude Haiku 4.5 |
| Embedding Model | Amazon Titan V2 |
| Index Types Per Project | 2 ({projectId}-conv, {projectId}-mem) |
| Global Indexes | 2 (global-memories, global-conversations) |

---

## Files You Need to Know

```
vectors.js (939 lines)
├─ Search: searchMemories(), searchConversations()
├─ Store: storeMemoryFact(), storeConversationChunk()
├─ Global: searchGlobalMemories(), storeGlobalMemoryFact()
├─ Delete: deleteMemoryFact(), deleteUserGlobalData()
└─ Manage: createProjectIndexes(), projectIndexesExist()

embeddings.js (100 lines)
├─ getEmbedding(text) → 1024-dim vector
└─ batchEmbeddings(texts, concurrency=5)

memoryExtractor.js (264 lines)
├─ extractFacts(messages) → [{fact, category, confidence}]
├─ chunkConversation(messages) → [{content, timestamp...}]
└─ Categories: decision, preference, technical, personal, goal, blocker, learning, context

bedrock.js (~1000 lines)
├─ buildSystemPrompt(projectContext, ...) → adds <semantic_memory> section
└─ Ordering: instructions → artifacts → user_memory → project → semantic_memory

memory-processor/index.js (300+ lines)
├─ Triggered: DynamoDB Stream or manual invocation
├─ Actions: processSession, processProject, processGlobalSession
└─ Steps: chunk → embed → store → extract → deduplicate

chat/index.js (500+ lines)
├─ Lazy-loads vectors module
├─ Searches semantic memory at query time
└─ Includes in system prompt

s3-vectors.tf (36 lines)
└─ Infrastructure: aws_s3vectors_vector_bucket resource
```

---

## Lambda Invocation

### Memory Processor

```javascript
// Process single session (project)
await lambda.invoke({
  FunctionName: 'memory-processor',
  Payload: {
    action: 'processSession',
    userId: 'user_abc',
    projectId: 'proj_xyz',
    sessionId: 'sess_123'
  }
});

// Process all sessions in project
await lambda.invoke({
  Payload: {
    action: 'processProject',
    userId: 'user_abc',
    projectId: 'proj_xyz'
  }
});

// Process global session
await lambda.invoke({
  Payload: {
    action: 'processGlobalSession',
    userId: 'user_abc',
    sessionId: 'sess_456'
  }
});

// Initialize indexes
await lambda.invoke({
  Payload: {
    action: 'initializeIndexes',
    userId: 'user_abc',
    projectId: 'proj_xyz'
  }
});
```

---

## Environment Variables

```bash
# Required by Lambdas
VECTORS_BUCKET=atlas-dev-memory-vectors
SESSIONS_TABLE=atlas-sessions
MESSAGES_TABLE=atlas-messages
PROJECTS_TABLE=atlas-projects
PROJECT_MEMORY_TABLE=atlas-project-memory
AWS_REGION=us-east-1

# Bedrock models (hardcoded in code)
# Embeddings: amazon.titan-embed-text-v2:0
# Extraction: us.anthropic.claude-haiku-4-5-20251001-v1:0
# Chat: us.anthropic.claude-opus-4-5-20251101-v1:0
```

---

## API Endpoints (Projects Lambda)

```
GET  /projects/{projectId}/memories
     └─ List semantic memories for project

POST /projects/{projectId}/memories
     ├─ Body: { fact, category, confidence }
     └─ Create memory manually

PUT  /projects/{projectId}/memories/{memoryId}
     └─ Update memory

DELETE /projects/{projectId}/memories/{memoryId}
       └─ Delete memory

# Legacy (DynamoDB-based)
GET  /projects/{projectId}/memory
PUT  /projects/{projectId}/memory
POST /projects/{projectId}/memory/regenerate
```

---

## Search Response Format

```javascript
// searchMemories() response
[
  {
    factId: "fact_abc123",
    content: "User prefers React with TypeScript",
    category: "preference",
    confidence: 0.9,
    score: 0.87,  // Cosine similarity
    sourceSessionId: "sess_xyz"
  },
  // ... more facts ranked by score
]

// searchConversations() response
[
  {
    sessionId: "sess_abc123",
    messageId: "chunk_0",
    role: "mixed",
    contentPreview: "User: Here's my...",
    timestamp: 1706302800000,
    score: 0.85
  },
  // ... more chunks ranked by score
]
```

---

## Metadata Schemas

### Conversation Chunk
```javascript
metadata: {
  sessionId, messageId, role, timestamp,
  projectId, userId,
  contentPreview: content.slice(0, 500)
}
```

### Memory Fact (Project)
```javascript
metadata: {
  category, confidence, sourceSessionId,
  timestamp, projectId, userId,
  content
}
```

### Memory Fact (Global)
```javascript
metadata: {
  // Tenant isolation (CRITICAL)
  user_id,
  // Tracking
  category, confidence, created_at, updated_at,
  source_session_id, mention_count,
  // Content
  content, source_context, extraction_reasoning
}
```

---

## Index Names

```
Project-Level:
  Conversations: {projectId}-conv    (lowercase, alphanumeric + hyphen, max 63 chars)
  Memories:      {projectId}-mem

Global (Shared):
  Memories:       global-memories
  Conversations:  global-conversations

Sanitization:
  str.toLowerCase().replace(/[^a-z0-9-]/g, '')
```

---

## Vector Operations

```javascript
// Create Index
new CreateIndexCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: 'proj_abc-mem',
  dimension: 1024,
  distanceMetric: 'cosine',
  dataType: 'float32'
})

// Store Vectors
new PutVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: 'proj_abc-mem',
  vectors: [{
    key: 'fact_123',
    data: { float32: embedding },
    metadata: { ... }
  }]
})

// Search Vectors
new QueryVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: 'proj_abc-mem',
  queryVector: { float32: queryEmbedding },
  topK: 10,
  returnMetadata: true,
  filter: { user_id: { '$eq': userId } }  // For global searches
})

// Delete Vectors
new DeleteVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: 'proj_abc-mem',
  keys: ['fact_123', 'fact_456']
})

// List Vectors
new ListVectorsCommand({
  vectorBucketName: VECTOR_BUCKET,
  indexName: 'proj_abc-mem',
  filter: { user_id: { '$eq': userId } },
  maxResults: 500
})
```

---

## Error Handling

```javascript
try {
  // Vector operation
} catch (err) {
  if (err.name === 'ConflictException') {
    // Index already exists - OK
  } else if (err.name === 'ResourceNotFoundException') {
    // Index doesn't exist - return []
  } else {
    // Other error - log and handle
    throw err;
  }
}

// Graceful fallback (chat still works)
let vectorsModule = null;
try {
  vectorsModule = require('./shared/vectors');
} catch (err) {
  console.warn('[Vectors] Module not available');
  vectorsModule = {
    searchMemories: async () => [],
    storeMemoryFact: async () => {}
    // ... fallbacks returning empty
  };
}
```

---

## Token Budget

```
Total: 200,000 tokens

100,000 (50%)  → Conversation history
50,000 (25%)   → Pinned files
15,000 (7.5%)  → Project memory (legacy)
10,000 (5%)    → Semantic memory (VECTORS) ◄─── HERE
5,000 (2.5%)   → System instructions
2,000 (1%)     → File manifest
18,000 (9%)    → Buffer/overhead
```

---

## System Prompt Integration

```xml
<semantic_memory>
These are relevant facts retrieved from previous conversations:

- Decision: Use JWT with 10-hour expiration (confidence 0.95)
- Technical: Database uses PostgreSQL 15 with PgBouncer (confidence 0.92)
- Goal: Complete payment integration by Q1 end (confidence 0.88)
</semantic_memory>
```

---

## Fact Categories

| Category | Examples |
|----------|----------|
| `decision` | "Use JWT auth", "Deploy to AWS" |
| `preference` | "Prefers React", "Uses TypeScript" |
| `technical` | "API uses OpenAPI 3.0", "DB: PostgreSQL" |
| `personal` | "Located in NYC", "Timezone: EST" |
| `goal` | "Ship by Q1", "Add search feature" |
| `blocker` | "Need approval from legal", "DB performance issue" |
| `learning` | "JWT tokens expire after 10h", "Insights" |
| `context` | "Project for financial services", "GDPR compliance required" |

---

## Deduplication Logic

```javascript
// 1. Search for similar facts
similar = searchGlobalMemories(userId, content, { topK: 5, minScore: 0.92 });

// 2. If found and score >= 0.92
if (similar[0].score >= 0.92) {
  // Delete old vector
  DeleteVectorsCommand(similar[0].key);

  // Merge content (keep longer)
  mergedContent = longer(content, similar[0].content);

  // Increment mention count
  newMentionCount = similar[0].mentionCount + 1;

  // Re-insert
  PutVectorsCommand(mergedVector);

  return { action: 'merged', key: newKey };
} else {
  // Insert new fact
  PutVectorsCommand(newVector);
  return { action: 'inserted', key: newKey };
}
```

---

## Monitoring Logs

```
✓ Index Creation
  [Vectors] Created conversations index for project proj_abc
  [Vectors] Created memories index for project proj_abc

✓ Processing
  [MemoryProcessor] Found 25 messages to process
  [MemoryProcessor] Created 5 conversation chunks
  [MemoryProcessor] Extracted 8 facts

✓ Deduplication
  [Vectors] Found similar global fact (score: 0.95), merging
  [Vectors] Merged global fact, mention_count now 3

✗ Errors
  [MemoryExtractor] Extraction failed: {error}
  [Vectors] Module not available: {error}
  [MemoryProcessor] Failed to store chunk: {error}
```

---

## Troubleshooting Flowchart

```
Memory not showing in chat?
├─ VECTORS_BUCKET set?
│  └─ No? Set environment variable
├─ Index exists?
│  └─ Check logs: "Created * index"
├─ Memory processor ran?
│  └─ Check CloudWatch logs
├─ Search returning results?
│  └─ Manual test: searchMemories(userId, projectId, "test")
└─ Still broken? Check error logs
```

---

## Cost Breakdown

### Per 1000 Facts Stored

- Embedding generation: $0.02 (1000 embeddings × $0.02/1M tokens)
- Storage: ~$0.0001 (S3 Vectors minimal)
- Searches: $0 (included in service)
- **Total: ~$0.02**

### Per 10,000 Queries

- Query latency cost: $0 (sub-second search)
- Embedding for queries: $0.02 (10K embeddings × $0.02/1M)
- **Total: ~$0.02 for queries**

### Annual (1 project, 1 year)

- 12 months × ~100 sessions = 1200 sessions
- ~3000 facts × $0.02/1000 = $0.06
- ~500 searches × 100 per search = 50K searches ≈ $0.02
- **Total: ~$0.08/year per project**

---

## Quick Checks

```bash
# Environment
echo $VECTORS_BUCKET

# CloudWatch Logs
aws logs tail /aws/lambda/memory-processor --follow

# List Indexes
aws s3vectors list-indexes --vector-bucket-name $VECTORS_BUCKET

# Invoke Memory Processor
aws lambda invoke --function-name memory-processor \
  --payload '{"action":"processSession","userId":"test","projectId":"proj","sessionId":"sess"}' \
  response.json

# Check Response
cat response.json | jq .
```

---

## Key Constraints

| Limit | Value | Note |
|-------|-------|------|
| Metadata per vector | 2048 bytes | Truncate if needed |
| Index name length | 63 chars | Sanitize projectId |
| Chunk size | 2000 chars | Target, flexible |
| Embedding dimension | 1024 | Fixed, non-configurable |
| Query timeout | 30 seconds | S3 Vectors limit |
| Lambda timeout | 300 seconds | Memory processor |
| Batch delete | 500 vectors | S3 Vectors max |

---

## One-Line Summaries

- **vectors.js:** S3 Vectors client for storing and searching embeddings
- **embeddings.js:** Amazon Titan V2 wrapper for generating 1024-dim vectors
- **memoryExtractor.js:** Claude Haiku wrapper for extracting facts + chunking
- **memory-processor:** Background Lambda that creates memory from conversations
- **chat:** Query-time memory search + context assembly
- **projects:** CRUD endpoints for managing memories

---

**Last Updated:** January 27, 2026
**Version:** 1.0
**Use As:** Desk reference for developers

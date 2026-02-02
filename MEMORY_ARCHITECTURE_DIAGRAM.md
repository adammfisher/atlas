# Atlas Web Memory Architecture - Visual Diagrams

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ATLAS WEB MEMORY SYSTEM                              │
└─────────────────────────────────────────────────────────────────────────────┘

                              ┌──────────────────┐
                              │   User Client    │
                              │  (Web/Desktop)   │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┼──────────────────┐
                    │                  │                  │
                    ▼                  ▼                  ▼
            ┌──────────────┐   ┌──────────────┐   ┌──────────────┐
            │ Chat Message │   │  New Project │   │ Delete Data  │
            └──────┬───────┘   └──────┬───────┘   └──────┬───────┘
                   │                  │                  │
                   │                  │                  │
        ┌──────────┼──────────────────┼──────────────────┼──────────┐
        │          │                  │                  │          │
        ▼          ▼                  ▼                  ▼          ▼
   ┌─────────┬──────────┐      ┌──────────────┐   ┌─────────────────┐
   │  Chat   │Projects  │      │  Lambdas     │   │  DynamoDB       │
   │ Lambda  │  Lambda  │      │  (Serverless)│   │  Streams        │
   └────┬────┴────┬─────┘      └──────────────┘   └────────┬────────┘
        │         │                                        │
        │         │                                        │
        ▼         ▼                                        ▼
   ┌────────────────────────────────────────────────────────────────┐
   │                   Memory Processor Lambda                       │
   │  (Triggered by DynamoDB Stream or manual invocation)            │
   │                                                                 │
   │  1. Initialize indexes ({projectId}-conv, {projectId}-mem)     │
   │  2. Fetch session messages                                      │
   │  3. Chunk conversation (2000 char target)                       │
   │  4. Generate embeddings for chunks (Titan V2)                   │
   │  5. Store conversation chunks in vector index                   │
   │  6. Extract facts (Claude Haiku 4.5)                            │
   │  7. Generate embeddings for facts (Titan V2)                    │
   │  8. Store memory facts with deduplication                       │
   │  9. Update processing status                                    │
   └────────────────────────┬──────────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────────────────────┐
        │         AWS S3 VECTORS (Vector Store)                │
        │                                                        │
        │  ┌────────────────────────────────────────────────┐  │
        │  │  Project-Level Indexes (Per Project)           │  │
        │  │  ├─ {projectId}-conv (conversation chunks)     │  │
        │  │  └─ {projectId}-mem (extracted facts)          │  │
        │  │     • 1024-dimensional embeddings              │  │
        │  │     • Cosine similarity for search              │  │
        │  │     • Metadata: sessionId, messageId, role,     │  │
        │  │              category, confidence, userId      │  │
        │  └────────────────────────────────────────────────┘  │
        │                                                        │
        │  ┌────────────────────────────────────────────────┐  │
        │  │  Global Indexes (Shared, User-Isolated)        │  │
        │  │  ├─ global-memories (facts + dedup)            │  │
        │  │  └─ global-conversations (context chunks)      │  │
        │  │     • All queries filtered by user_id           │  │
        │  │     • Mention count tracking                     │  │
        │  │     • Semantic dedup (0.92 threshold)           │  │
        │  │     • GDPR deletion support                      │  │
        │  └────────────────────────────────────────────────┘  │
        │                                                        │
        └───────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┴────────────────┐
        │                                    │
        ▼                                    ▼
   ┌──────────────────────┐        ┌─────────────────────┐
   │ AWS Bedrock Runtime  │        │ AWS Bedrock Runtime │
   │                      │        │                     │
   │ • Amazon Titan V2    │        │ • Claude Haiku 4.5  │
   │   Embeddings         │        │   Fact Extraction   │
   │   (1024-dim)         │        │   (Cost-optimized)  │
   │ • Inference: <2s     │        │ • Inference: ~5s    │
   │ • Cost: $0.02/1M     │        │ • Temperature: 0.3  │
   │   tokens             │        │                     │
   └──────────────────────┘        └─────────────────────┘
```

---

## Chat Query Flow

```
                    ┌─────────────────────┐
                    │   User Sends Chat   │
                    │   Message & Query   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Chat Lambda        │
                    │  (chat/index.js)    │
                    └──────────┬──────────┘
                               │
              ┌────────────────┼────────────────┐
              │                │                │
              ▼                ▼                ▼
         ┌─────────┐   ┌──────────────┐   ┌──────────────┐
         │Authenticate│ Build Context │ Load Vectors   │
         │  User     │ Assembly       │ Module         │
         └────┬─────┘ └──────┬───────┘ └────┬──────────┘
              │               │             │
              └───────────────┼─────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  Search Semantic     │
                   │  Memory at Query     │
                   │  Time (Dual Scope)   │
                   └──────────┬───────────┘
                              │
        ┌─────────────────────┴─────────────────────┐
        │                                           │
        ▼                                           ▼
   ┌─────────────────────────┐          ┌─────────────────────────┐
   │ PROJECT-LEVEL SEARCH    │          │ GLOBAL SEARCH (if no    │
   │                         │          │ project scope)          │
   │ 1. Generate Query       │          │                         │
   │    Embedding            │          │ 1. Generate Query       │
   │    (Titan V2)           │          │    Embedding            │
   │    └─ 1024-dim vector   │          │                         │
   │                         │          │ 2. Query global-mem     │
   │ 2. Query Index          │          │    index with user_id   │
   │    {projectId}-mem      │          │    filter               │
   │    └─ topK: 10          │          │    └─ topK: 20          │
   │                         │          │                         │
   │ 3. Query Index          │          │ 3. Query global-conv    │
   │    {projectId}-conv     │          │    index with user_id   │
   │    └─ topK: 5           │          │    filter               │
   │                         │          │    └─ topK: 10          │
   │ 4. Post-process         │          │                         │
   │    Results              │          │ 4. Post-process Results │
   │                         │          │                         │
   └────────┬────────────────┘          └────────┬────────────────┘
            │                                    │
            └────────────────┬───────────────────┘
                             │
                             ▼
                ┌────────────────────────────────┐
                │  Format Results for System     │
                │  Prompt:                       │
                │  • Semantic memory facts       │
                │  • Relevant conversations      │
                │  • Deduped, ranked by score    │
                │  • Truncated to 10K tokens     │
                └────────────────┬───────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Build System Prompt    │
                    │  with Context Sections: │
                    │                         │
                    │  1. Instructions        │
                    │  2. Artifacts           │
                    │  3. User Memory         │
                    │  4. Project Context     │
                    │  5. Semantic Memory ◄───┤─ VECTOR RESULTS
                    │  6. Conversations  ◄───┤─ VECTOR RESULTS
                    │  7. Files               │
                    │  8. Tools               │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Call Claude Opus 4.5   │
                    │  via AWS Bedrock        │
                    │  with Enriched Context  │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Stream Response to     │
                    │  User (Response         │
                    │  Streaming)             │
                    └────────────┬────────────┘
                                 │
                                 ▼
                    ┌─────────────────────────┐
                    │  Session Ends           │
                    │  DynamoDB Stream        │
                    │  Triggered              │
                    └─────────────────────────┘
```

---

## Memory Ingestion Pipeline

```
                        ┌─────────────────────┐
                        │  Chat Session Ends  │
                        │  (or manual trigger)│
                        └──────────┬──────────┘
                                   │
                                   ▼
                    ┌──────────────────────────────┐
                    │ Memory Processor Lambda      │
                    │ (5 min timeout, 1GB RAM)     │
                    └──────────┬───────────────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌─────────────────────────┐   ┌──────────────────┐
    │ Initialize Indexes      │   │ Fetch Messages   │
    │ if not exist            │   │ from DynamoDB    │
    │                         │   │ MESSAGES_TABLE   │
    │ CreateIndexCommand:     │   │                  │
    │ • {projectId}-conv      │   │ Returns:         │
    │ • {projectId}-mem       │   │ [{role, content, │
    │ • dimension: 1024       │   │   timestamp}]    │
    │ • metric: cosine        │   │                  │
    │ • dataType: float32     │   │                  │
    └─────────────┬───────────┘   └────────┬─────────┘
                  │                        │
                  └────────────────┬───────┘
                                   │
                                   ▼
                    ┌──────────────────────────┐
                    │ Chunk Conversation       │
                    │ chunkConversation()      │
                    │                          │
                    │ Algorithm:               │
                    │ • Target: 2000 chars     │
                    │ • Respect message       │
                    │   boundaries             │
                    │ • Split large messages   │
                    │   by paragraphs          │
                    │ • Never break within msg │
                    │                          │
                    │ Output: [{content,       │
                    │   startTimestamp,        │
                    │   endTimestamp,          │
                    │   messageCount}]         │
                    └──────────┬───────────────┘
                               │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
   ┌─────────────┐   ┌──────────────────┐   ┌────────────────┐
   │ Generate    │   │ Store Chunks in  │   │ Extract Facts  │
   │ Embeddings  │   │ Vector Index     │   │                │
   │ for Chunks  │   │                  │   │ Model: Claude  │
   │             │   │ PutVectorsCommand│   │ Haiku 4.5      │
   │ Titan V2:   │   │                  │   │                │
   │ getEmbedding│   │ key: {sessionId- │   │ Returns: [{    │
   │(text)       │   │ chunkId}         │   │  fact,         │
   │             │   │ data: float32[]  │   │  category,     │
   │ Returns:    │   │ metadata: {      │   │  confidence}]  │
   │ 1024-dim    │   │   sessionId,     │   │                │
   │ vector      │   │   messageId,     │   │ Categories:    │
   │             │   │   role,          │   │ • decision     │
   │ Parallel:   │   │   timestamp,     │   │ • preference   │
   │ concurrency │   │   projectId,     │   │ • technical    │
   │ = 5         │   │   userId,        │   │ • personal     │
   │             │   │   contentPreview │   │ • goal         │
   └─────────────┘   │ }                │   │ • blocker      │
        │            │ index: {projId}- │   │ • learning     │
        │            │ conv             │   │ • context      │
        │            └────────┬─────────┘   │                │
        │                     │             │ Confidence:    │
        │                     │             │ 0.0-1.0        │
        │                     │             └────────┬───────┘
        │                     │                      │
        ▼                     │                      ▼
   ┌─────────────┐            │         ┌──────────────────┐
   │ Store Chunk │            │         │ Generate         │
   │ Embeddings  │            │         │ Embeddings       │
   │ (async, in  │            │         │ for Facts        │
   │  parallel)  │            │         │                  │
   │             │            │         │ Titan V2:        │
   │             │            │         │ Per fact call    │
   │             │            │         │                  │
   │             │            │         │ Returns:         │
   │             │            │         │ 1024-dim vectors │
   │             │            │         │                  │
   └──────┬──────┘            │         └────────┬─────────┘
          │                   │                  │
          └───────────────────┼──────────────────┘
                              │
                              ▼
                    ┌──────────────────────┐
                    │ Store Memory Facts   │
                    │ in Vector Index      │
                    │                      │
                    │ Deduplication:       │
                    │ • Search for similar │
                    │ • If score >= 0.92:  │
                    │   - Delete old       │
                    │   - Merge content    │
                    │   - Increment count  │
                    │ • Else: Insert new   │
                    │                      │
                    │ PutVectorsCommand    │
                    │ key: {mem_userid_..} │
                    │ data: float32[]      │
                    │ metadata: {          │
                    │   category,          │
                    │   confidence,        │
                    │   sourceSessionId,   │
                    │   content,           │
                    │   mention_count      │
                    │ }                    │
                    │ index: {projectId}-  │
                    │ mem                  │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Update Processing    │
                    │ Status               │
                    │                      │
                    │ UpdateCommand        │
                    │ SESSIONS_TABLE       │
                    │ {                    │
                    │   memoryProcessing: {│
                    │     status: 'done',  │
                    │     chunks,          │
                    │     facts,           │
                    │     processedAt      │
                    │   }                  │
                    │ }                    │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │ Logging Summary      │
                    │                      │
                    │ [MemoryProcessor]    │
                    │ Session X processed: │
                    │ • 5 chunks stored    │
                    │ • 12 facts extracted │
                    │ • 2 facts merged     │
                    │ • Duration: 8.5s     │
                    └──────────────────────┘
```

---

## Metadata Schema

### Project-Level Conversation Chunk

```json
{
  "key": "sess_abc123-chunk_0",
  "data": {
    "float32": [0.123, -0.456, 0.789, ...]  // 1024 dimensions
  },
  "metadata": {
    // Searchable fields
    "sessionId": "sess_abc123",
    "messageId": "chunk_0",
    "role": "mixed",
    "timestamp": "1706302800000",
    "projectId": "proj_xyz789",
    "userId": "user_abc",
    // Content preview (truncated)
    "contentPreview": "User: Here's my question... Assistant: I can help with..."
  }
}
```

### Project-Level Memory Fact

```json
{
  "key": "fact_def456",
  "data": {
    "float32": [0.234, -0.567, 0.890, ...]  // 1024 dimensions
  },
  "metadata": {
    // Category & confidence
    "category": "technical",
    "confidence": "0.92",
    // Source & timing
    "sourceSessionId": "sess_abc123",
    "timestamp": "1706302800000",
    "projectId": "proj_xyz789",
    "userId": "user_abc",
    // Fact content
    "content": "Database uses PostgreSQL 15 with connection pooling via PgBouncer"
  }
}
```

### Global Memory Fact (Shared, User-Isolated)

```json
{
  "key": "mem_user_abc_1706302800_xyz789",
  "data": {
    "float32": [0.345, -0.678, 0.901, ...]  // 1024 dimensions
  },
  "metadata": {
    // Tenant isolation (CRITICAL)
    "user_id": "user_abc",
    // Categorization
    "category": "preference",
    "confidence": "0.88",
    // Timing
    "created_at": "1706302800000",
    "updated_at": "1706302800000",
    // Tracking
    "source_session_id": "sess_global_123",
    "mention_count": "3",
    // Content (truncated to 1500 bytes)
    "content": "User prefers React with TypeScript for frontend projects",
    "source_context": "Mentioned in 3 different sessions",
    "extraction_reasoning": "Consistent preference across conversations"
  }
}
```

---

## Token Budget Allocation

```
┌─────────────────────────────────────────────────────────────────┐
│                  Context Window: 200,000 tokens                 │
│                       (Claude Opus 4.5)                         │
└─────────────────────────────────────────────────────────────────┘

    100,000 tokens (50%)
    ├─ Conversation History (recent messages)
    └─ Most recent exchange gets priority

    50,000 tokens (25%)
    ├─ Pinned File Contents
    └─ User's selected reference documents

    15,000 tokens (7.5%)
    ├─ Project Memory (Legacy DynamoDB)
    └─ Synthesized summary of project knowledge

    10,000 tokens (5%) ◄──── SEMANTIC MEMORY FROM VECTORS
    ├─ Top-10 facts from {projectId}-mem
    ├─ Top-5 conversation snippets from {projectId}-conv
    ├─ OR Top-20 facts from global-memories (non-project)
    └─ Ranked by cosine similarity score

    5,000 tokens (2.5%)
    ├─ System Instructions & Prompt Format
    └─ Tool definitions and behaviors

    2,000 tokens (1%)
    ├─ File Manifest (list of available files)
    └─ Names, sizes, status

    18,000 tokens (9%) - Buffer/Overflow
    ├─ Used by Bedrock for overhead
    └─ Reserve for large responses
```

---

## Index Naming Convention

```
PROJECT-LEVEL INDEXES
├─ Conversations Index: {projectId}-conv
│  ├─ Format: lowercase, alphanumeric + hyphen
│  ├─ Max 63 characters (AWS limit)
│  ├─ Example: "proj-acme-2024-conv"
│  └─ Stores: Chunked conversation history (~100-1000 vectors)
│
└─ Memories Index: {projectId}-mem
   ├─ Format: lowercase, alphanumeric + hyphen
   ├─ Max 63 characters (AWS limit)
   ├─ Example: "proj-acme-2024-mem"
   └─ Stores: Extracted facts (~50-500 vectors)

GLOBAL INDEXES (SHARED)
├─ Memories Index: global-memories
│  ├─ Single shared index for all users
│  ├─ Tenant isolation via user_id filter
│  ├─ Deduplication enabled (0.92 threshold)
│  └─ Mention count tracking

└─ Conversations Index: global-conversations
   ├─ Single shared index for all users
   ├─ Tenant isolation via user_id filter
   └─ Conversation context for non-project chats

SANITIZATION LOGIC
str.toLowerCase().replace(/[^a-z0-9-]/g, '')
└─ Example: "My Project-2024!" → "my-project-2024"
```

---

## Deduplication Flow

```
NEW FACT ARRIVES
    │
    ├─ Generate Embedding (Titan V2)
    │
    ├─ Search Similar Facts
    │  └─ searchGlobalMemories(userId, content)
    │     └─ Query: global-memories
    │     └─ Filter: user_id = userId
    │     └─ TopK: 5
    │     └─ MinScore: 0.92
    │
    ├─ Check Results
    │
    ├─ IF similar found (score >= 0.92)
    │  │
    │  ├─ DELETE old vector
    │  │  └─ DeleteVectorsCommand(oldKey)
    │  │
    │  ├─ MERGE content
    │  │  └─ Keep longer/richer version
    │  │
    │  ├─ INCREMENT mention_count
    │  │  └─ oldCount + 1
    │  │
    │  ├─ RE-INSERT with new key
    │  │  └─ PutVectorsCommand(mergedVector)
    │  │
    │  └─ RETURN: { action: 'merged', key, previousKey }
    │
    ├─ ELSE (no similar fact)
    │  │
    │  ├─ INSERT new vector
    │  │  └─ PutVectorsCommand(newVector)
    │  │
    │  └─ RETURN: { action: 'inserted', key }
    │
    └─ Result stored in S3 Vectors
```

---

## Error Handling Architecture

```
OPERATION
│
├─ Try Block
│  │
│  ├─ CreateIndexCommand
│  │  │
│  │  ├─ Success
│  │  │  └─ Log: "Created index"
│  │  │
│  │  └─ ConflictException
│  │     └─ Log: "Index already exists" (OK)
│  │
│  ├─ PutVectorsCommand
│  │  │
│  │  ├─ Success
│  │  │  └─ Continue
│  │  │
│  │  └─ ValidationError
│  │     └─ Log: "Failed to store" (continue others)
│  │
│  └─ QueryVectorsCommand
│     │
│     ├─ Success
│     │  └─ Return results
│     │
│     └─ ResourceNotFoundException
│        └─ Return empty array (graceful)
│
├─ Catch Block
│  │
│  ├─ Log full error with context
│  │
│  ├─ Determine severity
│  │  ├─ Critical: Stop processing
│  │  ├─ Recoverable: Continue with partial results
│  │  └─ Info: Log and continue
│  │
│  └─ Return status with context
│     └─ { statusCode, error, processed }
│
└─ Always Block
   ├─ Update processing status
   ├─ Log summary
   └─ Return result
```

---

## Graceful Degradation Pattern

```
CHAT LAMBDA STARTUP
│
├─ Initialize Vectors Module (lazy-load)
│  │
│  ├─ Try: require('./shared/vectors')
│  │  │
│  │  ├─ Success
│  │  │  └─ vectorsModule = actual module
│  │  │
│  │  └─ Failure (SDK missing, network, etc.)
│  │     └─ Log: "[Vectors] Module not available"
│  │
│  └─ Assign fallback functions
│     ├─ searchMemories: async () => []
│     ├─ searchConversations: async () => []
│     ├─ searchGlobalMemories: async () => []
│     ├─ searchGlobalConversations: async () => []
│     └─ store functions: async () => {}
│
├─ Initialize Memory Extractor (lazy-load)
│  └─ Same pattern as Vectors
│
├─ User Sends Chat
│  │
│  ├─ Get vectors module (cached)
│  │
│  ├─ Call searchMemories()
│  │  ├─ Real: Returns actual results
│  │  └─ Fallback: Returns [] (empty)
│  │
│  ├─ Continue with empty context
│  │  └─ Chat still works normally
│  │
│  └─ Response sent to user
│     └─ No degraded experience visible
│
└─ Logging
   ├─ Actual: Full debug logs
   └─ Fallback: Warning log once, then silent
```

---

## Security & Isolation

```
REQUEST FLOW
│
├─ API Gateway
│  └─ Extract JWT token
│
├─ Authenticate
│  └─ Decode token → userId
│
├─ Lambda Function
│  │
│  ├─ Project Scope
│  │  └─ Verify user has access to project
│  │
│  └─ Vector Query
│     │
│     ├─ Project Memory
│     │  └─ Query {projectId}-mem index (project-isolated)
│     │
│     └─ Global Memory (if non-project)
│        └─ Query global-memories with filter:
│           { user_id: { '$eq': userId } }  ◄─── CRITICAL
│
├─ Results Returned
│  └─ Only vectors matching userId filter
│
└─ Data Deletion (GDPR)
   │
   ├─ User Requests Deletion
   │  └─ userId in request
   │
   ├─ Delete From Global Indexes
   │  ├─ List vectors where user_id = userId
   │  ├─ Delete in batches of 500
   │  └─ Count total deleted
   │
   └─ Compliance Confirmed
      └─ All user data removed
```

---

**Diagram Version:** 1.0
**Last Updated:** January 27, 2026
**Format:** Markdown Text Diagrams (ASCII Art)

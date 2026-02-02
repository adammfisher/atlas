# Atlas Web Memory System - Executive Summary

**Date:** January 27, 2026
**Status:** Current Implementation Analysis
**Scope:** Semantic search and vector memory architecture

---

## What You Have

Atlas Web has implemented a **production-grade semantic memory system** that enables:

1. **Long-term memory** - Conversations are automatically processed and stored as searchable facts
2. **Intelligent retrieval** - Query-time semantic search finds relevant context
3. **Dual scoping** - Project-specific AND global (cross-project) memory
4. **Cost optimization** - Strategic model selection (Haiku for extraction, Titan for embeddings)
5. **Tenant isolation** - Secure multi-user architecture with user_id filtering
6. **Graceful degradation** - System works even if vector service is down

---

## Key Technology Stack

| Component | Choice | Why |
|-----------|--------|-----|
| Vector Store | AWS S3 Vectors | GA Dec 2025, sub-second search, serverless |
| Embeddings | Amazon Titan V2 | 1024-dim, L2 normalized, $0.02/1M tokens |
| Fact Extraction | Claude Haiku 4.5 | Cost-effective, supports vision, good quality |
| Vector DB | S3 Vectors (native) | AWS-native, integrated, no extra infrastructure |
| Isolation | user_id metadata filters | Shared indexes with filtering for multi-tenancy |

---

## How It Works

### Memory Ingestion (After Chat)

```
Chat Session Ends
    ↓
Memory Processor Lambda (Background)
    ├─ Chunk conversation (2000 chars)
    ├─ Embed chunks (Titan V2)
    ├─ Store chunks in vector index
    ├─ Extract facts (Haiku)
    ├─ Embed facts (Titan V2)
    ├─ Store facts with deduplication
    └─ Update processing status
```

**Result:** Conversation becomes searchable facts and context chunks

### Memory Retrieval (During Chat)

```
User Sends Query
    ↓
Chat Lambda (Request-time)
    ├─ Generate query embedding (Titan V2)
    ├─ Search project memory index (topK=10)
    ├─ Search project conversations index (topK=5)
    ├─ Format results into system prompt
    └─ Call Claude with enriched context
```

**Result:** Claude responds with relevant context from previous conversations

### Deduplication (Global Memory)

```
New Fact Learned
    ↓
Search similar facts (0.92 threshold)
    ├─ IF similar: Merge + increment mention_count
    ├─ ELSE: Insert new
    └─ Update timestamp
```

**Result:** Reduces storage, improves fact signal

---

## Index Architecture

### Project-Level (Isolated Per Project)

Two indexes per project:

1. **{projectId}-conv** - Chunked conversation history
   - ~100-1000 vectors per project
   - Quick context retrieval
   - Metadata: sessionId, messageId, role, timestamp

2. **{projectId}-mem** - Extracted facts
   - ~50-500 vectors per project
   - High-value memory facts
   - Metadata: category, confidence, sourceSessionId

### Global Shared (User-Isolated)

Two indexes shared across all users:

1. **global-memories** - Cross-project facts
   - Deduplication enabled (0.92 threshold)
   - Mention count tracking
   - CRITICAL: All queries filtered by user_id

2. **global-conversations** - Cross-project context
   - Conversation snippets for non-project chats
   - CRITICAL: All queries filtered by user_id

---

## Cost Model

### Per-Project Per Month (100 sessions)

- **Embedding generation:** ~$0.03
  - 1000 chunks × $0.02/1M tokens
  - 2000 facts × $0.02/1M tokens
- **Vector storage:** < $0.01
  - ~3000 vectors × small size
- **Searches:** $0
  - S3 Vectors queries included in service

**Total per project:** ~$0.04/month

### Global Memory Per User Per Month

- **Embedding generation:** ~$0.01
- **Vector storage:** < $0.001
- **Searches:** $0

**Total per user:** ~$0.01/month

---

## What Gets Stored & Searched

### Conversation Chunks (Project)

Automatically created, stored in `{projectId}-conv`:
- Raw conversation text (2000 char chunks)
- Preserves context for retrieval
- Metadata: speaker role, timestamp, session

**Usage:** "What did we discuss about authentication last week?"

### Extracted Facts (Project)

Automatically extracted by Claude Haiku, stored in `{projectId}-mem`:

```json
{
  "fact": "Authentication uses JWT with 10-hour expiration",
  "category": "technical",
  "confidence": 0.95,
  "sourceSessionId": "sess_abc123"
}
```

**Categories:**
- `decision` - Business/technical decisions
- `preference` - User preferences
- `technical` - APIs, libraries, patterns
- `personal` - About the user
- `goal` - Project goals
- `blocker` - Issues
- `learning` - Insights
- `context` - Background info

**Usage:** "What technical decisions have we made?"

### Global Memory (User-Level)

Same structure but:
- Shared across all projects for that user
- Deduplication merges similar facts
- Mention count tracks repetitions
- User-isolated via metadata filter

**Usage:** "What does Claude know about my preferences?"

---

## Token Budget

10,000 tokens allocated for semantic memory per query:

- ~50-100 facts retrieved (avg 100 tokens each)
- Ranked by cosine similarity score
- Included in `<semantic_memory>` section of system prompt

Other context sections use remaining ~190K tokens:
- Conversation history: 100K
- Pinned files: 50K
- System instructions: 5K
- etc.

---

## Implementation Details

### Key Files

| File | Lines | Purpose |
|------|-------|---------|
| `vectors.js` | 939 | S3 Vectors client (create, store, query, delete) |
| `embeddings.js` | 100 | Titan V2 embedding generation |
| `memoryExtractor.js` | 264 | Fact extraction + chunking |
| `bedrock.js` | ~1000 | System prompt assembly (includes semantic memory) |
| `memory-processor/index.js` | ~300 | Background processing Lambda |
| `chat/index.js` | ~500 | Chat handler with vector search |
| `projects/index.js` | ~400 | CRUD endpoints for memories |
| `s3-vectors.tf` | 36 | Terraform infrastructure |

### Lambdas

1. **Memory Processor** (Background)
   - Triggered by DynamoDB stream after chat ends
   - Processes in parallel: chunk, embed, extract, store
   - Supports manual triggering for reprocessing
   - Timeout: 5 minutes, RAM: 1GB

2. **Chat** (Request-time)
   - Searches semantic memory before calling Claude
   - Lazy-loads vectors module (graceful fallback)
   - Includes results in system prompt
   - Streaming response

3. **Projects** (On-demand)
   - CRUD endpoints for memories
   - Manual memory creation
   - List/search existing memories
   - Delete operations

### Data Flow

```
Chat Ends → DynamoDB Stream
    ↓
Memory Processor Lambda
    ├─ Chunk (2000 char)
    ├─ Embed chunks (Titan)
    ├─ Store {projectId}-conv
    ├─ Extract facts (Haiku)
    ├─ Embed facts (Titan)
    ├─ Store {projectId}-mem (with dedup)
    └─ Store global-memories (with user_id filter)
    ↓
S3 Vectors (Query Service)
    ↓
Next Chat Query
    ├─ Search {projectId}-mem
    ├─ Search {projectId}-conv
    ├─ Include in system prompt
    ↓
Claude Response (with context)
```

---

## Security & Compliance

### Tenant Isolation

- **Project scope:** Separate indexes per project (isolation at index level)
- **Global scope:** Shared indexes with user_id metadata filter (isolation at query level)
- **Access control:** JWT token → userId → memory queries limited to user's data
- **No cross-user leakage:** Filter always applied: `{ user_id: { '$eq': userId } }`

### GDPR Compliance

- **Deletion:** `deleteUserGlobalData(userId)` removes all user vectors
- **Session cleanup:** `deleteSessionGlobalData(userId, sessionId)` removes session vectors
- **Mention tracking:** Decrement fact mention count when session deleted
- **Logging:** All operations logged with timestamps for audit

---

## Monitoring & Operations

### Key Metrics

- **Embedding latency:** Should be < 2 seconds per batch
- **Search latency:** Should be < 500 ms per query
- **Extraction success rate:** % of sessions successfully processed
- **Deduplication rate:** % of facts merged vs inserted
- **Storage growth:** Bytes per 1000 facts (~1MB per 1000 facts)

### Logs to Monitor

```
[Vectors] Created conversations index for project {projectId}
[MemoryProcessor] Extracted {N} facts from {M} messages
[Vectors] Found similar global fact (score: 0.95), merging
[MemoryExtractor] Extraction failed: {error message}
[Vectors] Module not available: {error}  ← graceful fallback
```

### Troubleshooting

1. **Memory not appearing in chat**
   - Check VECTORS_BUCKET env var
   - Verify memory processor ran (CloudWatch logs)
   - Check index creation logs

2. **Slow search**
   - Check embedding latency (Bedrock)
   - Check S3 Vectors query latency
   - Consider reducing topK or chunking size

3. **High costs**
   - Review embedding counts (might be over-chunking)
   - Check deduplication rate (should be > 20%)
   - Consider larger chunk sizes

---

## Advanced Features

### Already Implemented

✓ Semantic deduplication (merge similar facts)
✓ Mention count tracking (frequency of facts)
✓ Confidence scoring (0.0-1.0 per fact)
✓ Category classification (8 categories)
✓ Global memory isolation (user_id filtering)
✓ GDPR deletion (full user data removal)
✓ Graceful degradation (lazy loading, fallbacks)
✓ Token budgeting (10K for semantic memory)

### Potential Enhancements

- Filtering by category in searches
- Multi-index searching (project + global merged)
- Fact graph relationships (Neo4j integration)
- Time-decay ranking (newer facts ranked higher)
- Active learning from user feedback
- Automatic conversation summaries

---

## How This Actually Works in Practice

### Example 1: First Chat in Project

```
User: "I want to build an authentication system"
```

1. Chat Lambda searches memory (index doesn't exist yet)
2. Returns empty results (graceful handling)
3. Claude responds without context
4. Session ends
5. Memory Processor creates indexes: `proj_abc-conv`, `proj_abc-mem`
6. Processes conversation
   - Chunks: ["User: I want...", "Assistant: We could..."]
   - Facts: ["goal: Build auth system (0.9)", "tech: Planning phase (0.7)"]
7. Stores embeddings in S3 Vectors

### Example 2: Related Query Later

```
User: "What authentication approach did we decide on?"
```

1. Chat Lambda searches memory
2. Query embedding generated for user message
3. Searches `proj_abc-mem` (facts)
   - Returns: ["Decision: Use JWT with 10h expiration (0.87 score)"]
4. Searches `proj_abc-conv` (context)
   - Returns: ["We discussed JWT vs session tokens..."]
5. Includes in system prompt: `<semantic_memory>...</semantic_memory>`
6. Claude response references the facts naturally
7. User doesn't see "memory lookup" - just gets relevant context

### Example 3: Global Memory Deduplication

```
Session 1: "I prefer React for frontend"
→ Fact stored: user_id=user_abc, content="React frontend", score=0.9

Session 2: "Should we use React?" → User says "Yes, I prefer React"
→ Search finds similar fact (0.95 score >= 0.92 threshold)
→ OLD fact deleted
→ NEW fact merged: mention_count=2, content kept (same length)
→ Result: 1 fact instead of 2
```

---

## Key Takeaways

### What Works Well

1. **Automatic memory creation** - No manual annotation needed
2. **Cost-effective** - ~$0.04 per project per month
3. **Sub-second search** - S3 Vectors delivers speed
4. **Graceful fallback** - System doesn't break if vectors unavailable
5. **Secure isolation** - Multi-tenant with proper filtering
6. **Scalable** - Serverless architecture
7. **Deduplication** - Smart merging reduces noise

### What to Watch

1. **Extraction quality** - Haiku works well but not perfect
2. **Chunk size impact** - Affects coverage vs. storage tradeoff
3. **Token budget competition** - Memory takes 10K of 200K tokens
4. **Index bloat** - Old projects accumulate vectors over time
5. **Filtering limitations** - S3 Vectors filter syntax evolving

### What's Missing

1. **Conversational feedback** - Can't tune extraction from user feedback
2. **Fact graph** - No relationships between facts stored
3. **Time decay** - Old facts weighted same as recent
4. **Multi-project synthesis** - Can't create facts from global memory
5. **Real-time indexing** - Indexes built after session ends (delay)

---

## Documentation Files Created

1. **MEMORY_ARCHITECTURE_ACTUAL.md** (20 sections, 1000+ lines)
   - Complete technical documentation
   - Code references with line numbers
   - Implementation details
   - Operational considerations

2. **MEMORY_DESIGN_VS_ACTUAL.md** (20 comparisons)
   - Shows gaps between design and implementation
   - Highlights advancements
   - Identifies what's new beyond design spec

3. **MEMORY_ARCHITECTURE_DIAGRAM.md** (10+ diagrams)
   - System architecture
   - Query flow
   - Ingestion pipeline
   - Metadata schemas
   - Error handling

4. **This file: MEMORY_SYSTEM_SUMMARY.md**
   - Executive summary
   - Quick reference
   - Practical examples

---

## Next Steps

### Immediate (This Week)

1. Review these docs with the team
2. Identify gaps from your design spec
3. Schedule technical deep-dive if needed

### Short-term (Next Sprint)

1. Document operational runbook
2. Set up monitoring/alerts
3. Define on-call procedures

### Medium-term (Next Month)

1. Consider feedback-based improvement system
2. Plan archive strategy for old vectors
3. Design graph relationships for facts

### Long-term (Roadmap)

1. Global memory synthesis (facts from across projects)
2. Time-decay ranking
3. Active learning from user feedback
4. Fact relationship graph

---

## Questions to Discuss

1. **Token allocation:** Is 10K tokens for semantic memory enough, or need more?
2. **Chunk size:** Is 2000 chars optimal, or should we experiment?
3. **Dedup threshold:** Is 0.92 similarity right for your use case?
4. **Extraction categories:** Are the 8 categories covering your needs?
5. **Global memory:** Should it be opt-in or automatic?
6. **Archive policy:** When/how should old vectors be archived?
7. **Monitoring:** What additional metrics would be useful?

---

## Conclusion

Atlas Web has a **sophisticated, production-ready semantic memory system** that:

- ✓ Automatically learns from conversations
- ✓ Makes relevant context available at query time
- ✓ Optimizes for cost and performance
- ✓ Scales to multi-tenant architecture
- ✓ Handles failure gracefully

The implementation is **more advanced than the design specification**, with features like deduplication, mention tracking, and graceful degradation that go beyond initial requirements.

---

**Document Date:** January 27, 2026
**Status:** Complete Analysis
**Confidence:** High (based on code inspection)
**Recommendation:** Use as reference documentation for team

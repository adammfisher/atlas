# Memory Architecture: Design vs Actual Implementation

**Date:** January 27, 2026
**Purpose:** Identify gaps between design documentation and actual implementation

---

## Summary

The **actual implementation is MORE sophisticated than the design specification**. Here are the key differences:

---

## 1. VECTOR STORE CHOICE

### Design
- Discussed multiple options: Pinecone, DynamoDB, local solutions
- Unclear on final decision

### Actual
- **AWS S3 Vectors** (selected)
- GA December 2025, Terraform support v6.24.0
- Integrated via `@aws-sdk/client-s3vectors`
- Sub-second query performance

**Delta:** Design was uncertain; actual is production-grade with AWS service integration

---

## 2. EMBEDDING MODEL

### Design
- Mentioned: "Bedrock Titan, OpenAI, etc."
- No specific model locked in

### Actual
- **Amazon Titan Embeddings V2** (selected)
- Model ID: `amazon.titan-embed-text-v2:0`
- Dimension: 1024 (fixed)
- L2 normalized for cosine similarity
- Cost: ~$0.02 per 1M tokens

**Delta:** Design was exploratory; actual has specific model with optimization choices (L2 norm, dimensions, cost model)

---

## 3. MEMORY SCOPING

### Design
- Project-level memory only
- Some mention of global context

### Actual
- **Dual-scope architecture implemented:**
  1. **Project-level** - Per-project indexes: `{projectId}-conv`, `{projectId}-mem`
  2. **Global** - Shared indexes with user_id filtering: `global-memories`, `global-conversations`
- Global memory uses semantic deduplication (0.92 threshold)
- Mention count tracking for deduplication

**Delta:** Design didn't specify dual-scope; actual has sophisticated tenant isolation model

---

## 4. FACT EXTRACTION MODEL

### Design
- "Claude to extract facts"
- Model unspecified

### Actual
- **Claude Haiku 4.5** (selected for cost)
- Model ID: `us.anthropic.claude-haiku-4-5-20251001-v1:0`
- Temperature: 0.3 (consistent extraction)
- 8 fact categories: decision, preference, technical, personal, goal, blocker, learning, context
- Confidence scoring: 0.0-1.0 per fact

**Delta:** Design was vague; actual has specific model selection with inference tuning

---

## 5. CHUNKING STRATEGY

### Design
- Mentioned need for chunking
- No specific strategy

### Actual
- **2000 character target chunks**
- Respects message boundaries
- Intelligent paragraph-based splitting for large messages
- Never breaks within a message if possible
- Maintains startTimestamp and endTimestamp metadata

**Delta:** Design didn't specify algorithm; actual has sophisticated, tested implementation

---

## 6. DEDUPLICATION

### Design
- Not explicitly mentioned

### Actual
- **Implemented for global memory:**
- Threshold: 0.92 cosine similarity
- Strategy: Merge similar facts, keep longer content
- Mention count increment on duplicates
- Per-user filtering for isolation

**Delta:** Design didn't mention; actual has production-grade deduplication

---

## 7. INDEX INITIALIZATION

### Design
- Assumed static indexes

### Actual
- **Dynamic index creation:**
- On-demand: `initializeProjectIndexes()` creates {projectId}-conv and {projectId}-mem
- Lazy loading: Global indexes created on first use
- Check if exists before creating (handles concurrent calls)
- Graceful error handling for ConflictException

**Delta:** Design didn't address initialization; actual has robust creation pattern

---

## 8. SEARCH INTEGRATION

### Design
- "Include semantic memory in context"
- Vague on execution

### Actual
- **Query-time semantic search:**
  1. User sends message
  2. Lambda generates embedding for user message
  3. Queries both project-mem and project-conv indexes
  4. Returns top-K results with metadata
  5. Formats results into system prompt
  6. Includes in `<semantic_memory>` section
- Token budget: 10,000 tokens for semantic memory

**Delta:** Design didn't specify query flow; actual has complete retrieval pipeline

---

## 9. SYSTEM PROMPT STRUCTURE

### Design
- "Include semantic memory in context"
- Order unspecified

### Actual
- **Defined section order in system prompt:**
  1. System instructions
  2. Existing artifacts (with full content)
  3. User memory (global)
  4. Relevant past conversations (global)
  5. Project context
  6. Project memory (legacy DynamoDB)
  7. **Semantic memory (vector-retrieved)**
  8. **Relevant past conversations (vector-retrieved)**
  9. Available files
  10. Tools/MCP definitions

**Delta:** Design didn't specify structure; actual has carefully ordered context assembly

---

## 10. TOKEN BUDGETING

### Design
- Not mentioned

### Actual
- **Defined budget allocation:**
  - Total: 200,000 tokens
  - Semantic memory: 10,000 tokens
  - Legacy memory: 15,000 tokens
  - Pinned files: 50,000 tokens
  - System prompt: 5,000 tokens
  - Conversation: 100,000 tokens
  - File manifest: 2,000 tokens

**Delta:** Design didn't address; actual has explicit budget management

---

## 11. GRACEFUL DEGRADATION

### Design
- Not mentioned

### Actual
- **Lazy-loading fallback pattern:**
  - If vectors module unavailable: return empty arrays
  - If embeddings fail: skip embedding, use empty fallback
  - Chat continues without semantic memory
  - Errors logged but don't crash Lambda
  - Designed for service resilience

**Delta:** Design didn't address; actual has production robustness

---

## 12. GLOBAL MEMORY ISOLATION

### Design
- "Global user memory" mentioned vaguely

### Actual
- **Sophisticated tenant isolation:**
  - Shared indexes: `global-memories`, `global-conversations`
  - All queries filtered by `user_id` metadata
  - Filter syntax: `{ user_id: { '$eq': userId } }`
  - GDPR deletion: `deleteUserGlobalData(userId)`
  - Session cleanup: `deleteSessionGlobalData(userId, sessionId)`
  - Prevents cross-user data leakage

**Delta:** Design didn't address isolation; actual has GDPR-compliant implementation

---

## 13. METADATA SCHEMA

### Design
- "Store metadata with vectors" (generic)

### Actual
- **Detailed schemas:**
  - Conversation chunks: sessionId, messageId, role, timestamp, contentPreview
  - Memory facts: category, confidence, sourceSessionId, content
  - Global memories: user_id, mention_count, created_at, updated_at, source_context
  - 2048 byte total metadata limit with truncation strategy

**Delta:** Design was abstract; actual has concrete, optimized schemas

---

## 14. PROCESSING PIPELINE

### Design
- "Background processing after chat"
- Vague implementation

### Actual
- **Specific 9-step pipeline:**
  1. Initialize indexes (if needed)
  2. Fetch session messages
  3. Chunk conversation
  4. Generate chunk embeddings
  5. Store conversation chunks
  6. Extract facts via Haiku
  7. Generate fact embeddings
  8. Store memory facts
  9. Update processing status
- Error handling per step
- Partial success support

**Delta:** Design didn't specify flow; actual has detailed, tested implementation

---

## 15. LAMBDA FUNCTIONS

### Design
- "Memory processing Lambda"
- Single function assumed

### Actual
- **Three Lambda functions with clear responsibilities:**
  1. **Memory Processor** - Background processing (5 min timeout, 1GB)
  2. **Chat** - Query-time search integration
  3. **Projects** - CRUD operations for memories
- Lazy-loading for resilience
- Multi-action support (processSession, processProject, processGlobalSession)
- DynamoDB Stream triggers for automation

**Delta:** Design didn't specify architecture; actual has modular design

---

## 16. TERRAFORM INFRASTRUCTURE

### Design
- Not mentioned

### Actual
- **Native Terraform resource:**
  ```terraform
  resource "aws_s3vectors_vector_bucket" "memory_vectors" {
    vector_bucket_name = "${var.project_name}-memory-vectors"
  }
  ```
- Environment variables passed to Lambda
- IAM policies for vector access
- Integrated with existing terraform stack

**Delta:** Design didn't address IaC; actual has proper infrastructure-as-code

---

## 17. ERROR HANDLING

### Design
- Not mentioned

### Actual
- **Comprehensive error handling:**
  - ConflictException for duplicate index creation
  - ResourceNotFoundException for missing indexes
  - JSON parse failures in fact extraction
  - Metadata size limit handling (2048 bytes)
  - Partial success: continue on individual failures
  - Detailed logging for debugging

**Delta:** Design assumed happy path; actual has production error handling

---

## 18. COST OPTIMIZATION

### Design
- Not mentioned

### Actual
- **Specific optimizations:**
  - Titan V2 selected for cost ($0.02 per 1M tokens)
  - Haiku selected for fact extraction (cheaper than Opus)
  - Batch embeddings with concurrency control
  - Deduplication reduces storage
  - Mention count tracking reduces storage
  - Chunking strategy balances cost vs. relevance

**Delta:** Design didn't address; actual has cost-conscious choices

---

## 19. MONITORING & DEBUGGING

### Design
- Not mentioned

### Actual
- **Detailed logging throughout:**
  - Index creation: "[Vectors] Created * index"
  - Processing: "[MemoryProcessor] Extracted N facts"
  - Deduplication: "[Vectors] Found similar global fact (score: X), merging"
  - Errors: "[MemoryExtractor] Extraction failed: {error}"
  - Graceful fallback: "[Vectors] Module not available"
- Structured logs with context

**Delta:** Design didn't address; actual has production observability

---

## 20. ADVANCED FEATURES

### Implemented Beyond Design

1. **Semantic Deduplication**
   - Merge similar facts (0.92 threshold)
   - Track mentions

2. **Confidence Scoring**
   - Extract confidence 0.0-1.0 per fact
   - Use for ranking

3. **Fact Categorization**
   - 8 categories for organization
   - Support future filtering

4. **Global Memory Isolation**
   - User-level filtering
   - GDPR compliance

5. **Mention Tracking**
   - Count how many times fact appears
   - Improve ranking

6. **Session Cleanup**
   - Delete vectors when session deleted
   - Decrement fact mention counts

7. **Lazy Loading**
   - Graceful fallback if vectors unavailable
   - Production resilience

---

## Summary Table

| Aspect | Design | Actual | Delta |
|--------|--------|--------|-------|
| Vector Store | Uncertain | S3 Vectors | Specific choice |
| Embedding Model | Generic | Titan V2 (specific) | Specific tuning |
| Memory Scoping | Project only | Project + Global | Dual architecture |
| Fact Extraction | "Claude" | Haiku 4.5 (specific) | Model selection |
| Chunking | Mentioned | 2000 char algorithm | Detailed algorithm |
| Deduplication | Not mentioned | 0.92 threshold | New feature |
| Index Init | Static | Dynamic on-demand | Robust initialization |
| Search Flow | Vague | Complete pipeline | Specific flow |
| System Prompt | Generic | Detailed structure | Section ordering |
| Token Budget | Not mentioned | 10K for semantic | Explicit budgeting |
| Degradation | Not mentioned | Graceful fallback | Resilience |
| Global Isolation | Vague | User_id filtering | GDPR-compliant |
| Error Handling | Not mentioned | Comprehensive | Production-ready |
| Cost Model | Not mentioned | Specific | Cost-optimized |
| IaC | Not mentioned | Terraform | Infrastructure-as-code |
| Monitoring | Not mentioned | Detailed logging | Observability |

---

## Conclusion

The **actual implementation is significantly more mature and production-ready** than the design specification. Key advancements:

✓ **Specific technology choices** (S3 Vectors, Titan V2, Haiku 4.5)
✓ **Dual-scope memory architecture** (project + global)
✓ **Sophisticated isolation** (user_id filtering, GDPR compliance)
✓ **Advanced features** (deduplication, mention tracking, confidence scoring)
✓ **Production patterns** (graceful degradation, error handling, logging)
✓ **Infrastructure-as-code** (Terraform integration)
✓ **Cost optimization** (model selection, batch processing)
✓ **Token budgeting** (explicit allocation)

### Recommended Actions

1. **Update design documentation** with actual implementation details
2. **Document the dual-scope architecture** as the design pattern
3. **Formalize the error handling strategy** as best practice
4. **Document the chunking algorithm** for reference
5. **Create operational runbook** for monitoring and troubleshooting
6. **Record cost model** for forecasting

---

**Review Status:** Ready for design update
**Reviewer:** [System Analysis]
**Date:** January 27, 2026

# ADR-003: S3 Vectors for Semantic Memory

## Status

Accepted

## Date

2026-01-15

## Context

ATLAS needs semantic memory capabilities to:
1. Store and retrieve relevant facts from past conversations
2. Find similar conversation contexts for better responses
3. Support both project-scoped and global (user-level) memory
4. Scale cost-effectively without managing vector database infrastructure
5. Integrate with the existing serverless architecture

Options considered:
- Amazon S3 Vectors (new preview feature)
- Amazon OpenSearch with vector search
- Pinecone (managed vector database)
- pgvector on RDS PostgreSQL
- Self-hosted Milvus/Weaviate

## Decision

We will use **Amazon S3 Vectors** for semantic memory storage with the following design:

### Vector Index Structure

```
s3://{bucket}/vectors/
├── {userId}/
│   ├── global/
│   │   ├── memories/    # User-level facts (preferences, patterns)
│   │   └── conversations/  # Conversation chunks across all chats
│   └── projects/
│       └── {projectId}/
│           ├── memories/    # Project-specific facts
│           └── conversations/  # Project conversation chunks
```

### Implementation Details

| Aspect | Decision |
|--------|----------|
| Embedding model | Amazon Titan Embeddings (1536 dimensions) |
| Similarity metric | Cosine distance |
| Chunk size | ~500 tokens for conversations |
| Retrieval limit | Top 15-20 for memories, Top 5 for conversations |
| Min confidence | 0.01 (low threshold, let LLM filter) |

### Memory Types

1. **Memory Facts**: Extracted knowledge (preferences, decisions, patterns)
   - Stored with category, confidence, source session
   - Deduplicated on content similarity

2. **Conversation Chunks**: Contextual conversation history
   - User + Assistant exchange pairs
   - Timestamp and session reference

## Consequences

### Positive

- **Zero infrastructure**: No vector DB cluster to manage
- **Pay-per-query**: Cost scales with actual usage
- **Native AWS integration**: Same IAM, same billing, same SDK
- **Automatic durability**: S3's 11 9s durability
- **Simple backup**: Standard S3 versioning and replication

### Negative

- **Preview feature**: May have undocumented limitations
- **Query latency**: Higher than dedicated vector DBs (~100-500ms vs ~10-50ms)
- **Feature limitations**: Less advanced than Pinecone (no metadata filtering in v1)
- **Cold start**: First query may be slower

### Compliance Impact

- **SOC2**: S3 encryption at rest; IAM access control; CloudTrail logging
- **PCI-DSS**: Server-side encryption; VPC endpoints available
- **GLBA**: User data isolated by prefix; lifecycle policies for retention
- **Audit**: S3 access logging captures all vector operations

## Alternatives Considered

### Alternative 1: Amazon OpenSearch with k-NN

OpenSearch cluster with vector search capabilities.

**Rejected because:**
- Significant infrastructure to manage
- Always-on cost even when idle
- Overkill for our scale (OpenSearch is a full search engine)
- Complex cluster sizing and management

### Alternative 2: Pinecone

Managed vector database as a service.

**Rejected because:**
- External service adds latency and complexity
- Additional vendor relationship to manage
- Cost scales less predictably
- Data residency concerns (non-AWS)

### Alternative 3: pgvector on RDS

Vector extension for PostgreSQL.

**Rejected because:**
- Requires RDS instance (ongoing cost)
- Lambda connection pooling complexity
- Not purpose-built for vector operations
- Would add second database to maintain

### Alternative 4: DynamoDB with Vector Attributes

Store embeddings in DynamoDB with application-side similarity.

**Rejected because:**
- No native vector search (must scan and compute)
- Extremely inefficient for large memory stores
- High read costs for similarity queries
- Not scalable beyond small datasets

## References

- [Amazon S3 Vectors Documentation](https://docs.aws.amazon.com/AmazonS3/latest/userguide/s3-vectors.html)
- [Amazon Titan Embeddings](https://docs.aws.amazon.com/bedrock/latest/userguide/titan-embedding-models.html)
- [vectors.js implementation](/atlas-web/lambda/functions/chat/shared/vectors.js)

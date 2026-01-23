# ADR-002: DynamoDB as Primary Database

## Status

Accepted

## Date

2025-12-01

## Context

ATLAS needs a database that can:
1. Store user sessions, messages, projects, and artifacts
2. Provide low-latency access patterns for real-time chat
3. Scale automatically with user growth
4. Support user-level data isolation for security
5. Integrate seamlessly with Lambda functions
6. Handle flexible schema evolution as features are added

Options considered:
- Amazon DynamoDB (NoSQL)
- Amazon RDS PostgreSQL (Relational)
- Amazon DocumentDB (MongoDB-compatible)
- Amazon Aurora Serverless (Relational, auto-scaling)

## Decision

We will use **Amazon DynamoDB** with the following table design:

### Tables and Access Patterns

| Table | Partition Key | Sort Key | GSIs | Purpose |
|-------|---------------|----------|------|---------|
| sessions | userId | sessionId | userId-updatedAt, projectId-updatedAt | Conversation metadata |
| messages | sessionId | messageId | - | Chat messages |
| projects | userId | projectId | userId-lastActivityAt | Project metadata |
| project-files | projectId | fileId | projectId-pinned | Project file references |
| project-memory | projectId | version | - | Synthesized project memory |
| artifacts | sessionId | artifactId | userId-createdAt | Generated artifacts |
| summaries | sessionId | - | - | Conversation compaction cache |
| users | userId | - | username-index, email-index | User accounts |
| mcp-configs | userId | serverId | - | MCP server configs |

### Key Design Decisions

1. **User isolation via partition key**: `userId` as partition key ensures users can only access their own data
2. **Session-scoped messages**: Messages partitioned by `sessionId` for efficient conversation loading
3. **Version-tracked memory**: `version` as sort key enables memory history and rollback
4. **GSIs for alternate access**: Secondary indexes support listing by date, project, etc.

## Consequences

### Positive

- **Automatic scaling**: No capacity planning required with on-demand billing
- **Single-digit millisecond latency**: Fast access for real-time chat
- **User isolation by design**: Partition key enforces data boundaries
- **Schema flexibility**: Easy to add attributes without migrations
- **Lambda integration**: SDK built into Lambda runtime
- **Cost effective**: Pay only for reads/writes consumed

### Negative

- **No JOINs**: Denormalization required; some data duplication
- **Query limitations**: Can only query on partition key + sort key (or GSI)
- **Transaction limits**: 100 items max per transaction
- **Hot partition risk**: High-volume users could cause throttling (mitigated by user-based partitioning)

### Compliance Impact

- **SOC2**: DynamoDB encrypts data at rest by default; IAM controls access
- **PCI-DSS**: Server-side encryption with AWS-managed keys; VPC endpoints available
- **GLBA**: User data isolated by partition key; TTL available for data retention
- **Audit**: CloudTrail logs all DynamoDB API calls

## Alternatives Considered

### Alternative 1: Amazon RDS PostgreSQL

Traditional relational database on managed RDS.

**Rejected because:**
- Fixed capacity requires upfront sizing decisions
- Schema migrations needed for changes
- Higher baseline cost (always-running instance)
- Connection pooling complexity with Lambda

### Alternative 2: Amazon Aurora Serverless v2

Auto-scaling relational database.

**Rejected because:**
- Minimum ACU cost even when idle
- Cold start latency for scale-to-zero
- Schema migrations still required
- Overkill for our access patterns

### Alternative 3: Amazon DocumentDB

MongoDB-compatible document database.

**Rejected because:**
- No true serverless option
- VPC-only deployment complexity
- Higher cost than DynamoDB
- Connection management with Lambda

## References

- [DynamoDB Best Practices](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/best-practices.html)
- [Single-Table Design](https://www.alexdebrie.com/posts/dynamodb-single-table/)
- [Data Model Documentation](/docs/DATA_MODEL.md)

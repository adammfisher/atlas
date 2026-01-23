# ATLAS Platform - Data Model Documentation

**Version:** 1.0
**Last Updated:** January 2026

---

## Overview

ATLAS uses Amazon DynamoDB as its primary database with a multi-table design optimized for the application's access patterns. This document describes all tables, their schemas, indexes, and relationships.

---

## Table of Contents

1. [Design Principles](#1-design-principles)
2. [Tables Overview](#2-tables-overview)
3. [Users Table](#3-users-table)
4. [Sessions Table](#4-sessions-table)
5. [Messages Table](#5-messages-table)
6. [Projects Table](#6-projects-table)
7. [Project Files Table](#7-project-files-table)
8. [Project Memory Table](#8-project-memory-table)
9. [Artifacts Table](#9-artifacts-table)
10. [Summaries Table](#10-summaries-table)
11. [MCP Configs Table](#11-mcp-configs-table)
12. [S3 Storage Structure](#12-s3-storage-structure)
13. [S3 Vectors Structure](#13-s3-vectors-structure)
14. [Entity Relationships](#14-entity-relationships)

---

## 1. Design Principles

### 1.1 Key Decisions

| Decision | Rationale |
|----------|-----------|
| Multi-table design | Clear separation of concerns; simpler queries |
| userId as partition key | User isolation; even data distribution |
| Composite sort keys | Efficient range queries within partition |
| GSIs for alternate access | Support listing by date, project, etc. |
| PAY_PER_REQUEST billing | Variable workload; no capacity planning |

### 1.2 Naming Conventions

| Element | Convention | Example |
|---------|------------|---------|
| Table names | `{project}-{entity}` | `atlas-sessions` |
| Partition keys | `{entity}Id` or `userId` | `userId`, `sessionId` |
| Sort keys | `{entity}Id` or timestamp | `messageId`, `version` |
| GSI names | `{pk}-{sk}-index` | `userId-updatedAt-index` |
| ID formats | `{prefix}_{identifier}` | `usr_abc123`, `session_170600` |

### 1.3 Common Patterns

**User Isolation:**
```javascript
// Every query includes userId filter
const sessions = await queryItems(SESSIONS_TABLE, {
  expression: 'userId = :userId',
  values: { ':userId': userId }
});
```

**Timestamp-based IDs:**
```javascript
// Session IDs include timestamp for natural ordering
const sessionId = `session_${Date.now()}`;  // session_1706000000000

// Message IDs include timestamp and role
const messageId = `msg_${Date.now()}_user`;  // msg_1706000000000_user
```

---

## 2. Tables Overview

| Table | Partition Key | Sort Key | GSIs | Purpose |
|-------|---------------|----------|------|---------|
| users | userId | - | username-index, email-index | User accounts |
| sessions | userId | sessionId | userId-updatedAt, projectId-updatedAt | Chat sessions |
| messages | sessionId | messageId | - | Chat messages |
| projects | userId | projectId | userId-lastActivityAt | Project metadata |
| project-files | projectId | fileId | projectId-pinned | File references |
| project-memory | projectId | version | - | Synthesized memory |
| artifacts | sessionId | artifactId | userId-createdAt | Generated artifacts |
| summaries | sessionId | - | - | Compaction cache |
| mcp-configs | userId | serverId | - | MCP server configs |

---

## 3. Users Table

Stores user account information.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **userId** (PK) | String | Unique identifier: `usr_` + nanoid(12) |
| username | String | Login name (unique) |
| email | String | Email address (unique) |
| passwordHash | String | bcrypt hash (cost 12) |
| displayName | String | Display name in UI |
| role | String | `user` or `admin` |
| createdAt | Number | Unix timestamp (ms) |
| updatedAt | Number | Unix timestamp (ms) |

### Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|---------------|----------|------------|
| username-index | username | - | ALL |
| email-index | email | - | ALL |

### Access Patterns

| Pattern | Query |
|---------|-------|
| Login by username | Query username-index |
| Get user by ID | GetItem(userId) |
| Check email exists | Query email-index |

### Example Item

```json
{
  "userId": "usr_abc123def456",
  "username": "jsmith",
  "email": "jsmith@ally.com",
  "passwordHash": "$2b$12$LQv3c1yqBWV...",
  "displayName": "John Smith",
  "role": "user",
  "createdAt": 1706000000000,
  "updatedAt": 1706000000000
}
```

---

## 4. Sessions Table

Stores chat session metadata.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **userId** (PK) | String | User ID |
| **sessionId** (SK) | String | Session ID: `session_` + timestamp |
| title | String | Session title (from first message) |
| projectId | String | Associated project (optional) |
| starred | Boolean | User starred this session |
| createdAt | Number | Unix timestamp (ms) |
| updatedAt | Number | Unix timestamp (ms) |
| ttl | Number | TTL timestamp (disabled) |

### Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|---------------|----------|------------|
| userId-updatedAt-index | userId | updatedAt | ALL |
| projectId-updatedAt-index | projectId | updatedAt | ALL |

### Access Patterns

| Pattern | Query |
|---------|-------|
| List user sessions (recent first) | Query userId-updatedAt-index (DESC) |
| List project sessions | Query projectId-updatedAt-index |
| Get session | GetItem(userId, sessionId) |
| Update session | UpdateItem(userId, sessionId) |

### Example Item

```json
{
  "userId": "usr_abc123def456",
  "sessionId": "session_1706000000000",
  "title": "Refactoring the loan service",
  "projectId": "proj_xyz789",
  "starred": false,
  "createdAt": 1706000000000,
  "updatedAt": 1706100000000
}
```

---

## 5. Messages Table

Stores individual chat messages.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **sessionId** (PK) | String | Session ID |
| **messageId** (SK) | String | Message ID: `msg_` + timestamp + `_` + role |
| role | String | `user` or `assistant` |
| content | String | Message text |
| thinking | String | Extended thinking content (assistant only) |
| timestamp | Number | Unix timestamp (ms) |

### Access Patterns

| Pattern | Query |
|---------|-------|
| Get all messages in session | Query sessionId |
| Get specific message | GetItem(sessionId, messageId) |

### Example Items

```json
// User message
{
  "sessionId": "session_1706000000000",
  "messageId": "msg_1706000001000_user",
  "role": "user",
  "content": "Explain the loan service architecture",
  "timestamp": 1706000001000
}

// Assistant message
{
  "sessionId": "session_1706000000000",
  "messageId": "msg_1706000002000_assistant",
  "role": "assistant",
  "content": "The loan service uses event sourcing...",
  "thinking": "Let me analyze the architecture requirements...",
  "timestamp": 1706000002000
}
```

---

## 6. Projects Table

Stores project metadata.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **userId** (PK) | String | User ID |
| **projectId** (SK) | String | Project ID: `proj_` + nanoid |
| name | String | Project name |
| description | String | Project description |
| instructions | String | Custom AI instructions |
| lastActivityAt | Number | Last activity timestamp |
| createdAt | Number | Creation timestamp |

### Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|---------------|----------|------------|
| userId-lastActivityAt-index | userId | lastActivityAt | ALL |

### Access Patterns

| Pattern | Query |
|---------|-------|
| List user projects (recent first) | Query userId-lastActivityAt-index (DESC) |
| Get project | GetItem(userId, projectId) |
| Update project | UpdateItem(userId, projectId) |

### Example Item

```json
{
  "userId": "usr_abc123def456",
  "projectId": "proj_xyz789abc",
  "name": "Loan Service Modernization",
  "description": "Refactoring loan-service to event sourcing",
  "instructions": "Always follow CQRS patterns. Use saga orchestration for multi-service workflows.",
  "lastActivityAt": 1706100000000,
  "createdAt": 1706000000000
}
```

---

## 7. Project Files Table

Stores file references for projects.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **projectId** (PK) | String | Project ID |
| **fileId** (SK) | String | File ID: `file_` + nanoid |
| name | String | Filename |
| type | String | MIME type |
| size | Number | File size in bytes |
| tokenCount | Number | Estimated token count |
| pinned | String | `"true"` or `"false"` (string for GSI) |
| status | String | `pending`, `processing`, `ready`, `error` |
| s3Key | String | S3 object key |
| createdAt | Number | Creation timestamp |

### Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|---------------|----------|------------|
| projectId-pinned-index | projectId | pinned | ALL |

### Access Patterns

| Pattern | Query |
|---------|-------|
| List all project files | Query projectId |
| List pinned files | Query projectId-pinned-index where pinned = "true" |
| Get file | GetItem(projectId, fileId) |
| Update pin status | UpdateItem(projectId, fileId) |

### Example Item

```json
{
  "projectId": "proj_xyz789abc",
  "fileId": "file_def456ghi",
  "name": "architecture.md",
  "type": "text/markdown",
  "size": 4096,
  "tokenCount": 1024,
  "pinned": "true",
  "status": "ready",
  "s3Key": "usr_abc123/proj_xyz789/file_def456.md",
  "createdAt": 1706000000000
}
```

---

## 8. Project Memory Table

Stores synthesized project memory with versioning.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **projectId** (PK) | String | Project ID |
| **version** (SK) | Number | Version number (auto-increment) |
| current | Boolean | Is this the active version |
| sections | Map | Memory sections object |
| sections.purposeContext | String | Project purpose and goals |
| sections.currentState | String | Current implementation state |
| sections.onTheHorizon | String | Upcoming work |
| sections.keyLearnings | String | Important discoveries |
| sections.approachPatterns | String | Design patterns in use |
| sections.toolsResources | String | Tools and resources |
| processedChatIds | List | Session IDs included in this memory |
| tokenCount | Number | Estimated token count |
| generatedAt | Number | Generation timestamp |
| autoGenerated | Boolean | True if auto-generated |

### Access Patterns

| Pattern | Query |
|---------|-------|
| Get current memory | Query projectId, filter current=true |
| Get latest memory | Query projectId (DESC), limit 1 |
| Get memory version | GetItem(projectId, version) |
| List memory history | Query projectId |

### Example Item

```json
{
  "projectId": "proj_xyz789abc",
  "version": 5,
  "current": true,
  "sections": {
    "purposeContext": "This project modernizes the loan-service to use event sourcing for better auditability and compliance.",
    "currentState": "Implemented event store and basic commands. Working on read model projections.",
    "onTheHorizon": "Need to implement saga orchestration for multi-service workflows.",
    "keyLearnings": "Event versioning is critical for long-term maintenance. Use upcasting for schema evolution.",
    "approachPatterns": "Using CQRS with separate read/write models. Commands are immutable. Events stored in append-only log.",
    "toolsResources": "Spring Boot, Axon Framework, PostgreSQL for event store, Redis for read model cache."
  },
  "processedChatIds": ["session_1706000000", "session_1706050000"],
  "tokenCount": 512,
  "generatedAt": 1706100000000,
  "autoGenerated": true
}
```

---

## 9. Artifacts Table

Stores generated artifact metadata.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **sessionId** (PK) | String | Session ID |
| **artifactId** (SK) | String | Artifact ID: `art_` + hash(title+type) |
| userId | String | User ID (for GSI) |
| projectId | String | Project ID (optional) |
| title | String | Artifact title |
| name | String | Filename |
| type | String | Artifact type (svg, html, md, etc.) |
| fileExtension | String | File extension (.svg, .md, etc.) |
| contentType | String | MIME type |
| renderable | Boolean | Can preview inline |
| s3Key | String | S3 object key |
| size | Number | Content size in bytes |
| version | Number | Version number (incremented on updates) |
| createdAt | Number | Creation timestamp |
| updatedAt | Number | Last update timestamp |

### Indexes

| Index | Partition Key | Sort Key | Projection |
|-------|---------------|----------|------------|
| userId-createdAt-index | userId | createdAt | ALL |

### Access Patterns

| Pattern | Query |
|---------|-------|
| List session artifacts | Query sessionId |
| List user artifacts | Query userId-createdAt-index (DESC) |
| Get artifact | GetItem(sessionId, artifactId) |
| Update artifact | UpdateItem(sessionId, artifactId) |

### Example Item

```json
{
  "sessionId": "session_1706000000000",
  "artifactId": "art_xyz789",
  "userId": "usr_abc123def456",
  "projectId": "proj_xyz789abc",
  "title": "Architecture Diagram",
  "name": "Architecture-Diagram.mermaid",
  "type": "mermaid",
  "fileExtension": ".mermaid",
  "contentType": "text/plain",
  "renderable": true,
  "s3Key": "usr_abc123/session_1706000000/art_xyz789.mermaid",
  "size": 512,
  "version": 2,
  "createdAt": 1706000000000,
  "updatedAt": 1706050000000
}
```

---

## 10. Summaries Table

Caches conversation compaction summaries.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **sessionId** (PK) | String | Session ID |
| tokenCount | Number | Estimated tokens in summary |
| messageCount | Number | Messages summarized |
| keyPoints | List | Key points extracted |
| middleSummary | String | Summary of middle messages |
| updatedAt | Number | Last update timestamp |
| ttl | Number | TTL timestamp (7 days) |

### Access Patterns

| Pattern | Query |
|---------|-------|
| Get cached summary | GetItem(sessionId) |
| Update summary | PutItem(sessionId, ...) |

### Example Item

```json
{
  "sessionId": "session_1706000000000",
  "tokenCount": 15000,
  "messageCount": 45,
  "keyPoints": [
    "Project uses event sourcing",
    "Implementing CQRS pattern",
    "Need saga orchestration"
  ],
  "middleSummary": "Discussed event store implementation, command handling, and read model projections. Resolved issues with event versioning.",
  "updatedAt": 1706100000000,
  "ttl": 1706704800
}
```

---

## 11. MCP Configs Table

Stores user MCP server configurations.

### Schema

| Attribute | Type | Description |
|-----------|------|-------------|
| **userId** (PK) | String | User ID |
| **serverId** (SK) | String | Server ID: `srv_` + nanoid |
| name | String | Server name |
| description | String | Server description |
| enabled | Boolean | Is server enabled |
| config | Map | Server configuration |
| createdAt | Number | Creation timestamp |
| updatedAt | Number | Last update timestamp |

### Access Patterns

| Pattern | Query |
|---------|-------|
| List user's MCP servers | Query userId |
| Get server config | GetItem(userId, serverId) |
| Update server | UpdateItem(userId, serverId) |

### Example Item

```json
{
  "userId": "usr_abc123def456",
  "serverId": "srv_custom123",
  "name": "Custom Knowledge Base",
  "description": "Internal wiki search",
  "enabled": true,
  "config": {
    "url": "http://wiki-mcp.internal:3000",
    "apiKey": "encrypted-key"
  },
  "createdAt": 1706000000000,
  "updatedAt": 1706000000000
}
```

---

## 12. S3 Storage Structure

### Buckets

| Bucket | Purpose |
|--------|---------|
| atlas-uploads | User-uploaded project files |
| atlas-artifacts | Generated artifacts |
| atlas-frontend | Static frontend assets |
| atlas-vectors | S3 Vectors indexes |

### Key Structure

```
atlas-uploads/
├── {userId}/
│   └── {projectId}/
│       └── {fileId}.{ext}

atlas-artifacts/
├── {userId}/
│   └── {sessionId}/
│       └── {artifactId}.{ext}

atlas-frontend/
├── index.html
├── assets/
│   ├── index-{hash}.js
│   └── index-{hash}.css
└── favicon.ico
```

### Lifecycle Policies

| Bucket | Policy |
|--------|--------|
| atlas-uploads | Versioning enabled; no expiration |
| atlas-artifacts | Versioning enabled; no expiration |
| atlas-frontend | Versioning enabled; no expiration |

---

## 13. S3 Vectors Structure

### Index Structure

```
atlas-vectors/
├── vectors/
│   └── {userId}/
│       ├── global/
│       │   ├── memories/          # User-level facts
│       │   │   └── {memoryId}.json
│       │   └── conversations/     # User-level conversation chunks
│       │       └── {chunkId}.json
│       └── projects/
│           └── {projectId}/
│               ├── memories/      # Project-specific facts
│               │   └── {memoryId}.json
│               └── conversations/ # Project conversation chunks
│                   └── {chunkId}.json
```

### Memory Fact Schema

```json
{
  "id": "mem_abc123",
  "content": "User prefers TypeScript over JavaScript",
  "embedding": [0.1, 0.2, ...],  // 1536 dimensions (Titan)
  "category": "preference",
  "confidence": 0.95,
  "sourceSessionId": "session_1706000000",
  "createdAt": 1706000000000
}
```

### Conversation Chunk Schema

```json
{
  "id": "chunk_xyz789",
  "content": "User: How do I implement...\n\nAssistant: You can use...",
  "embedding": [0.1, 0.2, ...],
  "sessionId": "session_1706000000",
  "timestamp": 1706000000000,
  "messageCount": 2
}
```

---

## 14. Entity Relationships

```
┌──────────────────────────────────────────────────────────────┐
│                    Entity Relationships                       │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  User (1) ────────┬────────► (N) Session                    │
│    │              │              │                           │
│    │              │              ├────► (N) Message          │
│    │              │              │                           │
│    │              │              └────► (N) Artifact         │
│    │              │                                          │
│    │              └────────► (N) Project                    │
│    │                             │                           │
│    │                             ├────► (N) Project File     │
│    │                             │                           │
│    │                             ├────► (N) Project Memory   │
│    │                             │      (versions)           │
│    │                             │                           │
│    │                             └────► (N) Session          │
│    │                                    (projectId ref)      │
│    │                                                         │
│    └───────────────────────► (N) MCP Config                 │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

### Relationship Details

| Relationship | Type | Foreign Key |
|--------------|------|-------------|
| User → Session | 1:N | sessions.userId |
| User → Project | 1:N | projects.userId |
| User → MCP Config | 1:N | mcp_configs.userId |
| Session → Message | 1:N | messages.sessionId |
| Session → Artifact | 1:N | artifacts.sessionId |
| Session → Summary | 1:1 | summaries.sessionId |
| Project → Session | 1:N | sessions.projectId |
| Project → Project File | 1:N | project_files.projectId |
| Project → Project Memory | 1:N | project_memory.projectId |

---

## Appendix A: Common Queries

### List Recent Sessions

```javascript
const sessions = await queryItems(SESSIONS_TABLE, {
  indexName: 'userId-updatedAt-index',
  expression: 'userId = :userId',
  values: { ':userId': userId },
  scanIndexForward: false,
  limit: 50
});
```

### Get Session with Messages

```javascript
const [session, messages] = await Promise.all([
  getItem(SESSIONS_TABLE, { userId, sessionId }),
  queryItems(MESSAGES_TABLE, {
    expression: 'sessionId = :sessionId',
    values: { ':sessionId': sessionId }
  })
]);
messages.sort((a, b) => a.timestamp - b.timestamp);
```

### Get Project with Context

```javascript
const [project, files, memory] = await Promise.all([
  getItem(PROJECTS_TABLE, { userId, projectId }),
  queryItems(PROJECT_FILES_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId }
  }),
  queryItems(PROJECT_MEMORY_TABLE, {
    expression: 'projectId = :projectId',
    values: { ':projectId': projectId },
    scanIndexForward: false,
    limit: 1
  })
]);
```

---

## Appendix B: Migration Scripts

### Add New Attribute to All Sessions

```javascript
const sessions = await scanTable(SESSIONS_TABLE);
for (const session of sessions) {
  await updateItem(SESSIONS_TABLE,
    { userId: session.userId, sessionId: session.sessionId },
    { newAttribute: 'defaultValue' }
  );
}
```

### Backfill Project Files Token Counts

```javascript
const files = await scanTable(PROJECT_FILES_TABLE);
for (const file of files) {
  const content = await getContent(UPLOADS_BUCKET, file.s3Key);
  const tokenCount = Math.ceil(content.length / 4);
  await updateItem(PROJECT_FILES_TABLE,
    { projectId: file.projectId, fileId: file.fileId },
    { tokenCount }
  );
}
```

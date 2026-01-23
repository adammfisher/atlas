# ADR-007: Artifact Generation and Versioning

## Status

Accepted

## Date

2026-01-10

## Context

ATLAS generates various artifacts during conversations:
1. Code files (JavaScript, Python, etc.)
2. Documents (Markdown, HTML)
3. Diagrams (SVG, Mermaid)
4. Data files (JSON, CSV)
5. React components (JSX)

Requirements:
- Stream artifact generation progress to user
- Support artifact updates (same title = same artifact)
- Render artifacts inline (Markdown, diagrams, code)
- Download/copy artifact content
- Track artifact versions
- Save artifacts to projects

Options considered:
- Inline-only (no persistence)
- S3 with DynamoDB metadata
- Single DynamoDB table with content
- Git-backed storage

## Decision

We will use **S3 for content storage** with **DynamoDB for metadata** and **hash-based deduplication**:

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Artifact Flow                       │
├─────────────────────────────────────────────────────┤
│                                                     │
│  LLM Response                                       │
│       │                                             │
│       ▼                                             │
│  detectArtifact()  ←── <artifact type="x" title="y">│
│       │                                             │
│       ▼                                             │
│  artifact_start event ───► Frontend shows panel     │
│       │                                             │
│       ▼                                             │
│  artifact_delta events ──► Live content preview     │
│       │                                             │
│       ▼                                             │
│  extractArtifactContent()                           │
│       │                                             │
│       ├──► S3: Upload content                       │
│       │    Bucket: {artifacts-bucket}               │
│       │    Key: {userId}/{sessionId}/{artifactId}   │
│       │                                             │
│       └──► DynamoDB: Save metadata                  │
│            Table: artifacts                         │
│            Version incremented if exists            │
│       │                                             │
│       ▼                                             │
│  artifact_complete event ──► Frontend updates       │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### Artifact ID Generation

**Hash-based ID** ensures same title + type always produces same ID:

```javascript
function generateArtifactHash(title, type) {
  const normalized = `${title.toLowerCase().trim()}_${type}`.replace(/\s+/g, '_');
  let hash = 0;
  for (let i = 0; i < normalized.length; i++) {
    const char = normalized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `art_${Math.abs(hash).toString(36)}`;
}
```

This allows:
- "Update the React component" → updates existing artifact
- No duplicate artifacts with same title
- Consistent IDs between frontend and backend

### DynamoDB Schema

```javascript
{
  sessionId: "session_123",     // Partition key
  artifactId: "art_xyz789",     // Sort key (hash-based)
  userId: "usr_abc",            // For GSI queries
  projectId: "proj_def",        // Optional project association
  title: "Login Component",     // Display title
  name: "Login-Component.jsx",  // Filename
  type: "react",                // Artifact type
  fileExtension: ".jsx",        // Derived extension
  contentType: "text/jsx",      // MIME type
  renderable: true,             // Can preview inline
  s3Key: "usr_abc/session_123/art_xyz789.jsx",
  size: 2048,                   // Content size in bytes
  version: 3,                   // Incremented on updates
  createdAt: 1706000000,
  updatedAt: 1706100000
}
```

### Supported Artifact Types

| Type | Extension | Renderable | Preview |
|------|-----------|------------|---------|
| svg | .svg | Yes | Inline SVG |
| html | .html | Yes | Sandboxed iframe |
| markdown/md | .md | Yes | Rendered markdown |
| react/jsx | .jsx | Yes | Code with highlighting |
| mermaid | .mermaid | Yes | Mermaid diagram |
| json | .json | Yes | Formatted JSON |
| javascript/js | .js | No | Code block |
| python | .py | No | Code block |
| css | .css | No | Code block |
| typescript | .ts | No | Code block |

## Consequences

### Positive

- **Version tracking**: Full history of artifact changes
- **Deduplication**: Same title updates rather than duplicates
- **Streaming preview**: User sees artifact building in real-time
- **Separation of concerns**: Metadata queries fast (DynamoDB), content storage scalable (S3)
- **Project integration**: Artifacts can be saved to project files
- **Inline rendering**: Rich preview for supported types

### Negative

- **Two storage systems**: Coordination between DynamoDB and S3 required
- **Eventual consistency**: Brief window where metadata exists but content doesn't
- **Hash collisions**: Theoretical risk (extremely low with Java string hash)
- **Cleanup complexity**: Orphaned S3 objects if DynamoDB delete fails

### Compliance Impact

- **SOC2**: Artifact access logged; version history maintained
- **PCI-DSS**: No PII in artifact titles; content encrypted at rest (S3 SSE)
- **GLBA**: User isolation via userId prefix in S3 keys
- **Audit**: Artifact creation/update events tracked with timestamps

## Alternatives Considered

### Alternative 1: Inline-Only (No Persistence)

Keep artifacts only in chat message content.

**Rejected because:**
- No versioning capability
- Cannot save to projects
- Lost on page refresh during generation
- No artifact list/history

### Alternative 2: DynamoDB with Content

Store content directly in DynamoDB item.

**Rejected because:**
- 400KB item size limit
- Large items expensive to query
- No streaming for large content
- Would need to split large artifacts

### Alternative 3: Git-Backed Storage

Store artifacts in Git repository per user.

**Rejected because:**
- Complex Git operations from Lambda
- Overkill for artifact versioning
- Performance concerns with Git operations
- User doesn't need full Git capabilities

### Alternative 4: Timestamp-Based IDs

Generate unique ID per artifact instance.

**Rejected because:**
- Every update creates new artifact
- Cluttered artifact list
- No update/versioning semantic
- Frontend/backend ID mismatch

## References

- [Artifact Detection Code](/atlas-web/lambda/functions/chat/index.js#L1584-L1647)
- [Frontend InlineArtifact.jsx](/atlas-web/frontend/src/components/InlineArtifact.jsx)
- [S3 Best Practices](https://docs.aws.amazon.com/AmazonS3/latest/userguide/optimizing-performance.html)

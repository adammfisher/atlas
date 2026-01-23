# Atlas Web - Technical Product Manual

## Executive Summary

Atlas is an enterprise AI research assistant platform that provides conversational AI capabilities powered by AWS Bedrock (Claude). The architecture follows a **thin client** pattern where the React frontend serves purely as a presentation layer, while all business logic, AI processing, and data management occurs server-side in AWS Lambda functions.

**Key Architectural Principle**: The frontend is intentionally lightweight. All AI interactions, context assembly, memory management, and data persistence happen behind the AWS API Gateway/Lambda proxy. This design eliminates client-side compute constraints and enables unlimited context processing.

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Frontend Architecture](#2-frontend-architecture)
3. [Backend Architecture](#3-backend-architecture)
4. [Data Flow Deep Dives](#4-data-flow-deep-dives)
5. [Infrastructure & Deployment](#5-infrastructure--deployment)
6. [Authentication & Security](#6-authentication--security)
7. [Feature Implementation Details](#7-feature-implementation-details)
8. [API Reference](#8-api-reference)
9. [Local Development](#9-local-development)
10. [Troubleshooting Guide](#10-troubleshooting-guide)

---

## 1. System Overview

### 1.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              THIN CLIENT                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     React Frontend (Vite)                            │   │
│  │  • Message display & input          • Artifact rendering             │   │
│  │  • Session/project navigation       • File upload UI                 │   │
│  │  • Settings management              • Real-time streaming display    │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                          HTTPS (CloudFront)                                 │
└────────────────────────────────────┼────────────────────────────────────────┘
                                     │
┌────────────────────────────────────┼────────────────────────────────────────┐
│                              AWS CLOUD                                       │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                        API Gateway (HTTP)                            │   │
│  │              CORS • JWT Validation • Request Routing                 │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │    Chat     │          │  Sessions   │          │  Projects   │         │
│  │   Lambda    │          │   Lambda    │          │   Lambda    │         │
│  │  (Stream)   │          │   (CRUD)    │          │(Files/Mem)  │         │
│  └──────┬──────┘          └──────┬──────┘          └──────┬──────┘         │
│         │                        │                        │                 │
│         ▼                        ▼                        ▼                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Shared Layer                                 │   │
│  │  bedrock.js • dynamodb.js • s3.js • vectors.js • authMiddleware.js  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│         ┌──────────────────────────┼──────────────────────────┐             │
│         ▼                          ▼                          ▼             │
│  ┌─────────────┐          ┌─────────────┐          ┌─────────────┐         │
│  │   Bedrock   │          │  DynamoDB   │          │     S3      │         │
│  │   Claude    │          │   Tables    │          │   Buckets   │         │
│  │    API      │          │  (9 tables) │          │ (4 buckets) │         │
│  └─────────────┘          └─────────────┘          └─────────────┘         │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

### 1.2 Core Components

| Component | Technology | Purpose |
|-----------|------------|---------|
| Frontend | React 18 + Vite | Thin presentation layer |
| State Management | Zustand | Client-side UI state only |
| Backend | AWS Lambda (Node.js 20) | All business logic |
| AI Engine | AWS Bedrock (Claude Haiku 4.5) | Chat, analysis, artifact generation |
| Database | DynamoDB | Sessions, messages, projects, users |
| File Storage | S3 | Uploads, artifacts, vector indexes |
| CDN | CloudFront | Static assets, API proxy |
| API | API Gateway HTTP | REST endpoints with CORS |

### 1.3 Design Principles

1. **Server-Side Everything**: All AI processing, context assembly, and memory management happens in Lambda. The client never processes AI responses - it only displays them.

2. **Streaming First**: Chat responses stream via Server-Sent Events (SSE) directly from Lambda to browser, providing real-time feedback.

3. **Token Budget Management**: Complex context assembly algorithms run server-side to optimize Claude's 200K token window.

4. **Stateless Lambda**: Each request is independently authenticated and processed. State lives in DynamoDB/S3.

5. **User Isolation**: All data queries are filtered by `userId` at the database level.

---

## 2. Frontend Architecture

### 2.1 Project Structure

```
frontend/src/
├── components/
│   ├── Artifacts/           # Artifact viewing and rendering
│   │   ├── ArtifactsPanel.jsx      # Resizable side panel
│   │   ├── ArtifactViewer.jsx      # Main display component
│   │   ├── InlineArtifact.jsx      # Detection & inline rendering
│   │   ├── MarkdownRenderer.jsx    # GFM markdown
│   │   ├── CodeRenderer.jsx        # Syntax highlighting
│   │   ├── HTMLRenderer.jsx        # Sandboxed HTML
│   │   ├── SVGRenderer.jsx         # SVG diagrams
│   │   ├── MermaidRenderer.jsx     # Mermaid charts
│   │   ├── JSONRenderer.jsx        # Tree viewer
│   │   └── CSVRenderer.jsx         # Table display
│   │
│   ├── Chat/                # Chat interface
│   │   ├── ChatView.jsx            # Main chat container
│   │   ├── ChatInput.jsx           # Message input + file upload
│   │   ├── ChatTitleBar.jsx        # Session controls
│   │   ├── StreamingIndicator.jsx  # Real-time status
│   │   ├── ThinkingSteps.jsx       # Extended thinking display
│   │   └── MessageFileCard.jsx     # File previews in messages
│   │
│   ├── Project/             # Project management
│   │   ├── ProjectDetailView.jsx   # Project overview
│   │   ├── ProjectsListPage.jsx    # All projects
│   │   ├── MemoryPanel.jsx         # Memory editor
│   │   ├── FilesList.jsx           # File management
│   │   ├── FileCard.jsx            # File preview card
│   │   └── FileViewerModal.jsx     # File content viewer
│   │
│   ├── ProjectSidebar/      # Navigation
│   │   └── Sidebar.jsx             # Sessions/projects nav
│   │
│   ├── Auth/                # Authentication
│   │   └── LoginPage.jsx           # Login form
│   │
│   ├── Settings/            # Configuration
│   │   ├── SettingsModal.jsx       # User preferences
│   │   └── MCPSettingsModal.jsx    # MCP server config
│   │
│   └── InsightsBubble/      # Knowledge Core
│       └── InsightsBubble.jsx      # Artifact sharing widget
│
├── hooks/
│   ├── useChatStore.js      # Zustand store (UI state)
│   └── useInsightsStore.js  # Insights state
│
├── services/
│   ├── chatService.js       # Chat/sessions/projects/artifacts API
│   ├── authService.js       # Authentication API
│   └── insightsService.js   # Knowledge Core API
│
├── context/
│   └── AuthContext.jsx      # React auth context
│
├── App.jsx                  # Router setup
└── main.jsx                 # Entry point
```

### 2.2 State Management

The frontend uses **Zustand** for UI state management with localStorage persistence:

```javascript
// useChatStore.js - Primary store structure
{
  // Session tracking (UI only - data comes from backend)
  currentSessionId: string | null,
  sessions: Session[],
  messagesBySession: { [sessionId]: Message[] },

  // Project tracking
  projects: Project[],
  projectMemoryContext: { [projectId]: MemoryContext },

  // UI preferences
  selectedModel: 'haiku' | 'sonnet' | 'opus',
  webSearchEnabled: boolean,
  knowledgeCoreEnabled: boolean,
  colorMode: 'light' | 'dark' | 'auto',
  chatFont: 'default' | 'poppins' | 'lato' | 'sans',

  // Pending actions
  pendingFiles: File[],

  // Actions
  createSession: (title?, projectId?) => sessionId,
  addMessage: (message, sessionId?) => void,
  updateLastMessage: (content) => void,
  clearUserData: () => void,  // Called on logout
}
```

**Important**: The store is for UI state only. All authoritative data lives on the backend. The frontend fetches from backend on mount and syncs updates.

### 2.3 Services Layer

All API communication goes through service modules:

```javascript
// chatService.js exports
export const chatService = {
  streamMessage(message, sessionId, projectId, options, callbacks),
  streamMessageWithFiles(message, files, sessionId, projectId, options, callbacks),
  queryKnowledgeCore(query),
}

export const sessionsService = {
  list(), create(data), getMessages(sessionId), update(sessionId, updates), delete(sessionId)
}

export const projectsService = {
  list(), get(projectId), create(project), update(projectId, updates), delete(projectId),
  listFiles(projectId), uploadFile(projectId, file, pinned), deleteFile(projectId, fileId),
  getMemory(projectId), updateMemory(projectId, sections), regenerateMemory(projectId),
  listSemanticMemories(projectId, query), addSemanticMemory(projectId, content, category),
}

export const artifactsService = {
  listForSession(sessionId), listForProject(projectId), listAll(), getContent(sessionId, artifactId)
}

export const mcpService = {
  list(), create(server), update(serverId, updates), delete(serverId), executeTool(tool, args)
}
```

### 2.4 Routing

```javascript
// App.jsx routes
<Routes>
  <Route path="/" element={<ChatPage />} />                    // New chat
  <Route path="/chat/:sessionId" element={<ChatPage />} />     // Resume chat
  <Route path="/projects" element={<ProjectsListPage />} />    // Project list
  <Route path="/artifacts" element={<ArtifactsListPage />} />  // All artifacts
  <Route path="/project/:projectId" element={<ProjectDetailView />} />
  <Route path="/project/:projectId/chat/:sessionId" element={<ChatPage />} />
  <Route path="/project/:projectId/settings" element={<ProjectSettings />} />
</Routes>
```

---

## 3. Backend Architecture

### 3.1 Lambda Functions

| Function | Path | Purpose | Timeout | Memory |
|----------|------|---------|---------|--------|
| `chat` | `/api/chat/*` | AI chat + streaming | 300s | 1024MB |
| `sessions` | `/api/sessions/*` | Session CRUD | 30s | 256MB |
| `projects` | `/api/projects/*` | Projects, files, memory | 60s | 512MB |
| `artifacts` | `/api/artifacts/*` | Artifact CRUD + storage | 30s | 256MB |
| `auth` | `/api/auth/*` | JWT authentication | 30s | 256MB |
| `files` | `/api/files/*` | Presigned URLs | 30s | 256MB |
| `memory-processor` | (async) | Memory extraction | 300s | 512MB |

### 3.2 Shared Modules

Located in `/lambda/shared/`:

#### bedrock.js - AI Integration Core

```javascript
// Primary functions
buildSystemPrompt(projectContext, webSearch, existingArtifacts, globalContext)
  // Assembles Claude's system instructions with context

buildMessages(messages, knowledgeContext, projectContext)
  // Formats conversation history for Bedrock API

streamChatWithTools(systemPrompt, messages, model, callbacks)
  // Streams response from Bedrock with tool use support
  // Handles: web_search tool, artifact detection, thinking steps

compactConversation(messages, targetTokens)
  // Summarizes old conversation to fit token budget

performWebSearch(query)
  // Google News RSS search for current events

// Token budget constants
CONTEXT_BUDGET = {
  total: 200000,
  memory: 15000,
  semanticMemory: 10000,
  pinnedFiles: 50000,
  fileManifest: 2000,
  systemPrompt: 5000,
  conversation: 100000
}
```

#### dynamodb.js - Database Operations

```javascript
getItem(tableName, key)
putItem(tableName, item)
updateItem(tableName, key, updates)
deleteItem(tableName, key)
queryItems(tableName, keyCondition, options)  // Supports GSI
batchDeleteItems(tableName, keys)
```

#### s3.js - File Operations

```javascript
getUploadUrl(bucket, key, contentType, expiresIn)
getDownloadUrl(bucket, key, expiresIn, filename)
uploadContent(bucket, key, content, contentType)
getContent(bucket, key)
deleteObject(bucket, key)
```

#### vectors.js - Semantic Memory (S3 Vectors)

```javascript
createProjectIndexes(userId, projectId)
searchMemories(userId, projectId, query)
searchConversations(userId, projectId, query)
storeMemoryFact(userId, projectId, fact)
storeConversationChunk(userId, projectId, chunk)
deleteSessionVectors(userId, projectId, sessionId)
```

#### authMiddleware.js - Request Authentication

```javascript
authenticateRequest(event)
  // Extracts JWT from cookie or Authorization header
  // Returns: { userId, username, role }
  // Throws: 401 if invalid

requireAdmin(user)
  // Throws: 403 if not admin role

authErrorResponse(error)
  // Formats error response with CORS headers
```

### 3.3 Chat Lambda Deep Dive

The chat Lambda (`/lambda/functions/chat/index.js`) is the most complex function:

```javascript
// Entry point for streaming
exports.streamHandler = awslambda.streamifyResponse(async (event, responseStream) => {
  // 1. Authenticate request
  const user = authenticateRequest(event)

  // 2. Parse request body
  const { message, session_id, project_id, model, web_search_enabled, files } = parseBody(event)

  // 3. Create/retrieve session
  let sessionId = session_id
  if (!sessionId) {
    sessionId = await createSession(user.userId, project_id)
  }

  // 4. Load context (THIS IS WHERE THE MAGIC HAPPENS)
  const context = await assembleContext(user.userId, project_id, sessionId)
  // - Fetch pinned files from S3
  // - Query semantic memory vectors
  // - Load project memory from DynamoDB
  // - Get recent conversation history
  // - Apply token budget prioritization

  // 5. Build system prompt
  const systemPrompt = buildSystemPrompt(context, web_search_enabled, existingArtifacts)

  // 6. Build message array
  const messages = buildMessages(conversationHistory, knowledgeContext, context)

  // 7. Stream to Bedrock
  await streamChatWithTools(systemPrompt, messages, model, {
    onChunk: (content) => sendSSE(responseStream, 'chunk', { content }),
    onThinking: (content) => sendSSE(responseStream, 'thinking', { content }),
    onArtifact: (event) => sendSSE(responseStream, event.type, { artifact: event.data }),
    onSearchStart: (query) => sendSSE(responseStream, 'search_start', { query }),
    onSearchResults: (query, results) => sendSSE(responseStream, 'search_results', { query, results }),
  })

  // 8. Store message and artifacts
  await storeMessage(sessionId, 'assistant', fullResponse)
  await storeArtifacts(sessionId, detectedArtifacts)

  // 9. Trigger async memory extraction
  await triggerMemoryExtraction(sessionId, project_id)

  // 10. Send completion
  sendSSE(responseStream, 'done', { session_id: sessionId })
})
```

---

## 4. Data Flow Deep Dives

### 4.1 Chat Message Flow

```
USER                    FRONTEND                    AWS                      BEDROCK
  │                        │                         │                          │
  │ Types message          │                         │                          │
  │───────────────────────>│                         │                          │
  │                        │                         │                          │
  │                        │ 1. Query Knowledge Core │                          │
  │                        │ (if enabled)            │                          │
  │                        │────────────────────────>│                          │
  │                        │<────────────────────────│                          │
  │                        │    artifacts, ADRs      │                          │
  │                        │                         │                          │
  │                        │ 2. POST /chat/stream    │                          │
  │                        │ {message, session_id,   │                          │
  │                        │  knowledge_context}     │                          │
  │                        │────────────────────────>│                          │
  │                        │                         │                          │
  │                        │                         │ 3. Assemble context      │
  │                        │                         │ - Load session history   │
  │                        │                         │ - Fetch pinned files     │
  │                        │                         │ - Query semantic memory  │
  │                        │                         │ - Apply token budget     │
  │                        │                         │                          │
  │                        │                         │ 4. Call Bedrock          │
  │                        │                         │─────────────────────────>│
  │                        │                         │                          │
  │                        │                         │ 5. Stream response       │
  │                        │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│
  │                        │   SSE: chunk events     │   Token stream           │
  │                        │                         │                          │
  │ Display chunks         │                         │                          │
  │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                         │                          │
  │                        │                         │                          │
  │                        │   SSE: artifact events  │                          │
  │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│                          │
  │ Render artifacts       │                         │                          │
  │                        │                         │                          │
  │                        │   SSE: done             │                          │
  │<─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─│<────────────────────────│                          │
  │                        │                         │                          │
  │                        │                         │ 6. Store in DynamoDB     │
  │                        │                         │ 7. Store artifacts in S3 │
  │                        │                         │ 8. Trigger memory extract│
```

### 4.2 Artifact Creation Flow

```
BEDROCK RESPONSE              LAMBDA                    FRONTEND
       │                         │                          │
       │ "<artifact type=md>"    │                          │
       │────────────────────────>│                          │
       │                         │ Parse artifact markers   │
       │                         │                          │
       │                         │ SSE: artifact_start      │
       │                         │─────────────────────────>│
       │                         │                          │ Create artifact card
       │                         │                          │ (loading state)
       │ Content chunks          │                          │
       │────────────────────────>│                          │
       │                         │ SSE: artifact_delta      │
       │                         │─────────────────────────>│
       │                         │                          │ Update content preview
       │                         │                          │
       │ "</artifact>"           │                          │
       │────────────────────────>│                          │
       │                         │ Store in S3              │
       │                         │ Store metadata in DDB    │
       │                         │                          │
       │                         │ SSE: artifact_complete   │
       │                         │─────────────────────────>│
       │                         │                          │ Full render
       │                         │                          │ Add to artifacts panel
```

### 4.3 Project Memory Flow

```
PROJECT DETAIL PAGE          LAMBDA                    STORAGE
       │                         │                          │
       │ GET /projects/X/memory  │                          │
       │────────────────────────>│                          │
       │                         │ Query DynamoDB           │
       │                         │─────────────────────────>│
       │                         │<─────────────────────────│
       │<────────────────────────│   Memory object          │
       │                         │                          │
       │ Display memory sections │                          │
       │                         │                          │
═══════════════════════════════════════════════════════════════
       │                         │                          │
       │ POST /memory/regenerate │                          │
       │────────────────────────>│                          │
       │                         │ 1. Fetch all project     │
       │                         │    chats from DynamoDB   │
       │                         │─────────────────────────>│
       │                         │<─────────────────────────│
       │                         │                          │
       │                         │ 2. Call Claude to        │
       │                         │    synthesize memory     │
       │                         │                          │
       │                         │ 3. Extract facts via     │
       │                         │    memoryExtractor       │
       │                         │                          │
       │                         │ 4. Store in S3 Vectors   │
       │                         │─────────────────────────>│
       │                         │                          │
       │                         │ 5. Store new version     │
       │                         │    in DynamoDB           │
       │                         │─────────────────────────>│
       │                         │                          │
       │<────────────────────────│   New memory returned    │
```

### 4.4 File Upload Flow

```
USER                    FRONTEND                    LAMBDA                    S3
  │                        │                           │                        │
  │ Select file            │                           │                        │
  │───────────────────────>│                           │                        │
  │                        │                           │                        │
  │                        │ POST /projects/X/files    │                        │
  │                        │ {filename, size, type}    │                        │
  │                        │──────────────────────────>│                        │
  │                        │                           │                        │
  │                        │                           │ Generate presigned URL │
  │                        │                           │───────────────────────>│
  │                        │                           │<───────────────────────│
  │                        │                           │                        │
  │                        │                           │ Store file metadata    │
  │                        │                           │ in DynamoDB            │
  │                        │                           │                        │
  │                        │<──────────────────────────│                        │
  │                        │   {uploadUrl, fileId}     │                        │
  │                        │                           │                        │
  │                        │ PUT to presigned URL      │                        │
  │                        │ (direct to S3)            │                        │
  │                        │───────────────────────────────────────────────────>│
  │                        │<───────────────────────────────────────────────────│
  │                        │   200 OK                  │                        │
  │                        │                           │                        │
  │ File appears in list   │                           │                        │
  │<───────────────────────│                           │                        │
```

---

## 5. Infrastructure & Deployment

### 5.1 DynamoDB Tables

| Table | Hash Key | Range Key | GSI | Purpose |
|-------|----------|-----------|-----|---------|
| `atlas-sessions` | userId | sessionId | userId-updatedAt-index | Chat session metadata |
| `atlas-messages` | sessionId | messageId | - | Individual messages |
| `atlas-projects` | userId | projectId | userId-lastActivityAt-index | Project metadata |
| `atlas-project-files` | projectId | fileId | projectId-pinned-index | File references |
| `atlas-project-memory` | projectId | version | - | Synthesized memory (versioned) |
| `atlas-artifacts` | sessionId | artifactId | userId-createdAt-index | Artifact metadata |
| `atlas-summaries` | sessionId | - | - | Compacted conversation cache |
| `atlas-mcp-configs` | userId | serverId | - | MCP server configurations |
| `atlas-users` | userId | - | username-index, email-index | User accounts |

**Billing**: PAY_PER_REQUEST (auto-scaling, no capacity planning)

### 5.2 S3 Buckets

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `atlas-uploads-*` | Session file uploads, project files | 30-day expiration for temp uploads |
| `atlas-artifacts-*` | Generated artifact content | Glacier transition after 365 days |
| `atlas-lambda-*` | Lambda deployment packages | Versioning enabled |
| `atlas-vectors-*` | S3 Vectors semantic memory indexes | N/A |

### 5.3 API Gateway

**Type**: HTTP API (v2)
**Endpoint**: `https://{api-id}.execute-api.us-east-1.amazonaws.com`

**CORS Configuration**:
```javascript
{
  allowOrigins: ['https://d2e9zue1tj9oj5.cloudfront.net', 'http://localhost:3000'],
  allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-User-Id', 'Cookie'],
  allowCredentials: true,
  maxAge: 3600
}
```

### 5.4 Lambda Function URL

For true streaming (SSE), the chat Lambda uses a Function URL:

**URL**: `https://{function-url}.lambda-url.us-east-1.on.aws`
**Invoke Mode**: `RESPONSE_STREAM`
**Auth**: None (JWT validated in code)

### 5.5 CloudFront Distribution

**Domain**: `d2e9zue1tj9oj5.cloudfront.net`
**Origin**: S3 bucket (static frontend)
**Behaviors**:
- `/api/*` → API Gateway origin (no caching)
- `/*` → S3 origin (cache 30 min)

### 5.6 Terraform Structure

```
terraform/
├── main.tf           # Provider, tags
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── dynamodb.tf       # All DynamoDB tables
├── s3.tf             # S3 buckets
├── s3-vectors.tf     # S3 Vectors config
├── lambda.tf         # Lambda functions
├── api-gateway.tf    # API Gateway routes
├── iam.tf            # IAM roles/policies
├── cloudfront.tf     # CloudFront distribution
└── ssm.tf            # Parameter Store
```

---

## 6. Authentication & Security

### 6.1 JWT Authentication

**Token Structure**:
```javascript
{
  sub: 'usr_xxxxxxxxxxxx',    // User ID
  username: 'johndoe',        // Username
  role: 'user' | 'admin',     // Role
  iat: 1234567890,            // Issued at
  exp: 1234603890             // Expires (10 hours)
}
```

**Storage**:
- **Cookie**: `atlas_session` (HttpOnly, Secure, SameSite=None)
- **localStorage**: `atlas_auth_token` (fallback for Lambda Function URL)

### 6.2 Authentication Flow

```
1. User submits login form
   POST /api/auth/login { username, password }

2. Lambda validates credentials
   - Query DynamoDB users table by username
   - Compare bcrypt hash (12 rounds)
   - Generate JWT (10-hour expiry)

3. Response includes:
   - Set-Cookie header (httpOnly)
   - Token in response body (for localStorage)

4. Subsequent requests:
   - API Gateway: Cookie automatically sent
   - Lambda URL: Bearer token in Authorization header

5. Session expiry:
   - Frontend detects 401 response
   - Clears localStorage and state
   - Redirects to login page
```

### 6.3 User Isolation

**Every database query is filtered by userId**:

```javascript
// Sessions query
await queryItems(SESSIONS_TABLE, {
  expression: 'userId = :userId',
  values: { ':userId': user.userId }  // From JWT
}, { indexName: 'userId-updatedAt-index' })

// Projects query
await queryItems(PROJECTS_TABLE, {
  expression: 'userId = :userId',
  values: { ':userId': user.userId }
})

// Artifacts query
await queryItems(ARTIFACTS_TABLE, {
  expression: 'userId = :userId',
  values: { ':userId': user.userId }
}, { indexName: 'userId-createdAt-index' })
```

---

## 7. Feature Implementation Details

### 7.1 Streaming Chat

**Technology**: Lambda Response Streaming with Server-Sent Events

**SSE Event Types**:
```javascript
// Text content
data: {"type":"chunk","content":"Hello, "}

// Extended thinking
data: {"type":"thinking","content":"Let me analyze..."}

// Artifact lifecycle
data: {"type":"artifact_start","artifact":{"id":"abc","type":"markdown","title":"Doc"}}
data: {"type":"artifact_delta","artifact":{"id":"abc","content":"# Header"}}
data: {"type":"artifact_complete","artifact":{"id":"abc","content":"# Header\n\nBody"}}

// Web search
data: {"type":"search_start","query":"latest news"}
data: {"type":"search_results","query":"latest news","results":[...]}

// Memory context (for UI display)
data: {"type":"memory_context","data":{"memoriesUsed":5,"conversationsSearched":3}}

// Completion
data: {"type":"done","session_id":"session_1234567890"}
```

### 7.2 Token Budget Management

The backend allocates Claude's 200K context window:

```javascript
const CONTEXT_BUDGET = {
  total: 200000,          // Claude's context limit
  memory: 15000,          // Project memory sections
  semanticMemory: 10000,  // Vector-searched facts
  pinnedFiles: 50000,     // Priority project files
  fileManifest: 2000,     // List of available files
  systemPrompt: 5000,     // Instructions
  conversation: 100000    // Chat history
}
```

**Assembly Priority**:
1. System prompt (always included)
2. Pinned files (up to budget)
3. Project memory (synthesized)
4. Semantic memories (most relevant)
5. File manifest (for reference)
6. Conversation (newest first, compact older)

### 7.3 Artifact Detection

**Backend Detection** (in Bedrock response):
```javascript
// Claude marks artifacts with special tags
<artifact type="markdown" id="unique-id" title="Document Title">
# Content here
</artifact>
```

**Frontend Detection** (for inline rendering):
```javascript
// parseMessageForArtifacts() in InlineArtifact.jsx
// Scans message content for embedded artifacts
// Creates stable IDs via hash(title + type)
// Extracts type from content patterns
```

### 7.4 Memory System

**Three Tiers**:

1. **DynamoDB Memory** (manual/synthesized)
   - Sections: purposeContext, currentState, onTheHorizon, keyLearnings, approachPatterns, toolsResources
   - Versioned for rollback
   - User-editable

2. **Semantic Memories** (S3 Vectors)
   - Auto-extracted facts from conversations
   - Categories: decision, preference, technical, personal, goal, blocker, learning, context
   - Queried via semantic search

3. **Conversation Chunks** (S3 Vectors)
   - Chunked conversation history
   - Enables retrieval of past context
   - Complements fact extraction

### 7.5 Web Search

**Implementation**: Google News RSS (no API key required)

```javascript
// In bedrock.js
async function performWebSearch(query) {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`
  const response = await fetch(url)
  const xml = await response.text()
  // Parse RSS XML, extract title, link, pubDate
  return results.slice(0, 5)
}
```

**Tool Definition** (for Bedrock):
```javascript
{
  name: 'web_search',
  description: 'Search for current information and news',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' }
    },
    required: ['query']
  }
}
```

---

## 8. API Reference

### 8.1 Authentication

```
POST /api/auth/login
Body: { username, password }
Response: { user: { userId, username, displayName, role }, token }

POST /api/auth/logout
Response: { success: true }

GET /api/auth/me
Response: { user: { userId, username, displayName, role } }

POST /api/auth/register (admin only)
Body: { username, email, password, displayName, role }
Response: { user: { userId, username, displayName, role } }
```

### 8.2 Chat

```
POST /api/chat/message/stream
Body: {
  message: string,
  session_id?: string,
  project_id?: string,
  model: 'haiku' | 'sonnet' | 'opus',
  web_search_enabled: boolean,
  knowledge_context?: string,
  existing_artifacts?: Artifact[],
  files?: { name, type, base64 }[]
}
Response: SSE stream

POST /api/chat/message/with-files/stream
(Same as above with file support)
```

### 8.3 Sessions

```
GET /api/sessions
Response: { sessions: Session[] }

POST /api/sessions
Body: { title?, projectId? }
Response: Session

GET /api/sessions/:sessionId
Response: Session

GET /api/sessions/:sessionId/messages
Response: { messages: Message[] }

PUT /api/sessions/:sessionId
Body: { title?, starred?, projectId? }
Response: Session

DELETE /api/sessions/:sessionId
Response: 204 No Content
```

### 8.4 Projects

```
GET /api/projects?status=active
Response: { projects: Project[] }

POST /api/projects
Body: { name, description? }
Response: Project

GET /api/projects/:projectId
Response: Project

PUT /api/projects/:projectId
Body: { name?, description?, status? }
Response: Project

DELETE /api/projects/:projectId
Response: 204 No Content

GET /api/projects/:projectId/files
Response: { files: ProjectFile[] }

POST /api/projects/:projectId/files
Body: { filename, contentType, size, pinned }
Response: { uploadUrl, file: ProjectFile }

PUT /api/projects/:projectId/files/:fileId/pin
Body: { pinned: boolean }
Response: ProjectFile

DELETE /api/projects/:projectId/files/:fileId
Response: 204 No Content

GET /api/projects/:projectId/memory
Response: ProjectMemory

PUT /api/projects/:projectId/memory
Body: { sections: MemorySections }
Response: ProjectMemory

POST /api/projects/:projectId/memory/regenerate
Response: ProjectMemory

GET /api/projects/:projectId/memories?query=
Response: { memories: SemanticMemory[] }

POST /api/projects/:projectId/memories
Body: { content, category }
Response: SemanticMemory
```

### 8.5 Artifacts

```
GET /api/sessions/:sessionId/artifacts
Response: { artifacts: Artifact[] }

GET /api/artifacts?project_id=
Response: { artifacts: Artifact[] }

GET /api/artifacts/:artifactId/content?sessionId=
Response: string (raw content)

POST /api/artifacts
Body: { sessionId, type, title, content }
Response: Artifact

DELETE /api/artifacts/:artifactId
Response: 204 No Content
```

---

## 9. Local Development

### 9.1 Setup

```bash
# Clone and install
git clone <repo>
cd atlas-web

# Frontend
cd frontend
npm install
cp .env.example .env  # Configure VITE_API_URL=http://localhost:8000

# Backend (for local-server)
cd ..
npm install
cp .env.example .env  # Configure JWT_SECRET, AWS credentials
```

### 9.2 Running Locally

```bash
# Terminal 1: Frontend dev server
cd frontend
npm run dev  # Starts on http://localhost:5173

# Terminal 2: Local proxy server
node local-server.js  # Starts on http://localhost:8000
```

### 9.3 Environment Variables

**Frontend (.env)**:
```
VITE_API_URL=http://localhost:8000
VITE_STREAM_URL=  # Empty for local
VITE_INSIGHTS_API_URL=http://localhost:8001
```

**Backend (.env)**:
```
JWT_SECRET=your-development-secret
AWS_REGION=us-east-1
AWS_PROFILE=default
ALLOW_DEV_AUTH=true
NEO4J_URL=bolt://localhost:7687
```

### 9.4 Local Server Features

The `local-server.js` Express proxy provides:
- Request logging to `logs/requests.log`
- CORS for browser requests
- Neo4j connection fallback
- Proxying to AWS Lambda functions
- 50MB body limit for file uploads

---

## 10. Troubleshooting Guide

### 10.1 Common Issues

**"Session expired" on every request**
- Check JWT_SECRET matches between Lambda and local-server
- Verify cookie is being sent (check browser DevTools)
- Check token hasn't expired (10-hour limit)

**Streaming not working**
- Ensure VITE_STREAM_URL is set correctly (or empty for API Gateway)
- Check Lambda Function URL CORS settings
- Verify Bearer token is in Authorization header

**Files not uploading**
- Check S3 bucket CORS configuration
- Verify presigned URL hasn't expired (15 min default)
- Check file size limits (30MB default)

**Memory not updating**
- Verify S3 Vectors indexes exist
- Check memory-processor Lambda logs
- Ensure project has associated chats

### 10.2 Debugging

**Enable Lambda Logging**:
```javascript
// In any Lambda
console.log('[FunctionName] Debug info:', JSON.stringify(data))
// View in CloudWatch Logs
```

**Enable Frontend Logging**:
```javascript
// Already present in services
console.log('[Service] Action:', data)
// View in browser DevTools Console
```

**Local Request Logging**:
```bash
# View local-server logs
tail -f logs/requests.log
```

### 10.3 Performance Optimization

**Reduce Cold Starts**:
- Use provisioned concurrency for chat Lambda
- Keep Lambda warm with scheduled pings

**Improve Context Assembly**:
- Pin only essential files
- Keep conversation history reasonable
- Use semantic search over full history load

**Frontend Performance**:
- Lazy load artifact renderers
- Virtualize long message lists
- Debounce frequent state updates

---

## Appendix A: Type Definitions

```typescript
interface Session {
  id: string
  userId: string
  title: string | null
  projectId: string | null
  starred: boolean
  createdAt: number
  updatedAt: number
}

interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant'
  content: string
  files?: FileAttachment[]
  thinking?: string
  timestamp: number
}

interface Project {
  id: string
  userId: string
  name: string
  description?: string
  status: 'active' | 'archived'
  lastActivityAt: number
  createdAt: number
}

interface ProjectFile {
  fileId: string
  projectId: string
  filename: string
  size: number
  contentType: string
  pinned: boolean
  s3Key: string
  uploadedAt: number
}

interface Artifact {
  artifactId: string
  sessionId: string
  userId: string
  type: string
  title: string
  s3Key: string
  createdAt: number
  updatedAt: number
}

interface ProjectMemory {
  projectId: string
  version: number
  sections: {
    purposeContext?: string
    currentState?: string
    onTheHorizon?: string
    keyLearnings?: string
    approachPatterns?: string
    toolsResources?: string
  }
  generatedAt: number
  tokenCount: number
}

interface User {
  userId: string
  username: string
  email: string
  passwordHash: string
  displayName: string
  role: 'admin' | 'user'
  createdAt: number
  updatedAt: number
}
```

---

*Document Version: 1.0*
*Last Updated: January 2026*

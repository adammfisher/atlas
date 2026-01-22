# Atlas Web - Claude Code Context Document

This document provides Claude Code with comprehensive context about the Atlas Web project to enable effective assistance with development tasks.

## Project Overview

**Atlas Web** is an enterprise AI research assistant platform that enables users to interact with Claude AI through a sophisticated chat interface with persistent memory, project organization, and artifact management.

### Core Architecture: Thin Client Design

The frontend is a **presentation-only thin client**. All AI processing, context assembly, memory management, and business logic happens server-side in AWS Lambda functions. This design eliminates browser constraints on data size and processing.

```
Browser (Thin Client)          AWS Cloud (All Processing)
┌─────────────────────┐        ┌─────────────────────────────────────┐
│ React + Vite        │        │ Lambda Functions                    │
│ Zustand (UI state)  │◄──────►│ • Context assembly (200K tokens)    │
│ Display only        │  SSE   │ • Token budget management           │
│ No AI processing    │        │ • AI orchestration via Bedrock      │
│                     │        │ • Memory/artifact storage           │
└─────────────────────┘        └─────────────────────────────────────┘
```

## Directory Structure

```
atlas-web/
├── frontend/                    # React + Vite thin client
│   ├── src/
│   │   ├── components/          # React components
│   │   │   ├── Chat/            # ChatView, ChatInput, MessageList, etc.
│   │   │   ├── Project/         # ProjectDetailView, ProjectSettings
│   │   │   ├── ProjectSidebar/  # Sidebar navigation
│   │   │   ├── InsightsBubble/  # AI-extracted insights display
│   │   │   └── modals/          # AddToProjectModal, FileUploadModal
│   │   ├── context/             # React contexts
│   │   │   └── AuthContext.jsx  # Authentication state
│   │   ├── hooks/               # Custom hooks
│   │   │   └── useChatStore.js  # Zustand store (UI state only)
│   │   ├── services/            # API service layer
│   │   │   ├── chatService.js   # Sessions, messages, streaming
│   │   │   ├── authService.js   # Login, logout, token management
│   │   │   ├── projectService.js
│   │   │   ├── artifactsService.js
│   │   │   └── insightsService.js
│   │   └── App.jsx              # Root component with routing
│   └── package.json             # Dependencies: react@19, zustand, etc.
│
├── lambda/                      # AWS Lambda functions (Node.js 20)
│   ├── functions/
│   │   ├── auth/                # JWT authentication
│   │   ├── chat/                # AI orchestration (main logic)
│   │   ├── sessions/            # Session CRUD
│   │   ├── projects/            # Project + memory management
│   │   ├── artifacts/           # File storage
│   │   └── insights/            # AI fact extraction
│   └── shared/
│       ├── bedrock.js           # AWS Bedrock API wrapper
│       ├── db.js                # DynamoDB operations
│       ├── s3.js                # S3 operations
│       └── auth.js              # JWT utilities
│
├── terraform/                   # Infrastructure as Code
│   ├── main.tf                  # Core AWS resources
│   ├── lambda.tf                # Lambda configurations
│   ├── dynamodb.tf              # Database tables
│   └── s3.tf                    # Storage buckets
│
├── local-server.js              # Development proxy server
└── artifacts/                   # Documentation
    ├── TECHNICAL_WALKTHROUGH.md
    ├── PRODUCT_REQUIREMENTS.md
    ├── architecture.svg
    └── CLAUDE.md (this file)
```

## Key Files for Common Tasks

### Authentication
- `frontend/src/context/AuthContext.jsx` - Auth state provider
- `frontend/src/services/authService.js` - Login/logout API calls
- `lambda/functions/auth/index.js` - JWT generation, user validation

### Chat/AI
- `frontend/src/components/Chat/ChatView.jsx` - Main chat interface
- `frontend/src/components/Chat/ChatInput.jsx` - Message input with file upload
- `frontend/src/services/chatService.js` - Message sending, streaming
- `lambda/functions/chat/index.js` - **Core AI orchestration** (context assembly, Bedrock calls)
- `lambda/shared/bedrock.js` - AWS Bedrock API wrapper

### State Management
- `frontend/src/hooks/useChatStore.js` - Zustand store for UI state
- Note: This is UI state only, NOT the source of truth (server is)

### Projects
- `frontend/src/components/Project/ProjectDetailView.jsx` - Project view
- `frontend/src/components/Project/ProjectSettings.jsx` - Settings panel
- `lambda/functions/projects/index.js` - CRUD + memory management

### Artifacts
- `frontend/src/components/Chat/ArtifactsPanel.jsx` - Artifact viewer
- `lambda/functions/artifacts/index.js` - Storage/retrieval

## Critical Technical Concepts

### 1. Token Budget Management (200K Context Window)

The chat Lambda allocates tokens across components:
```javascript
const TOKEN_BUDGET = {
  systemPrompt: 5000,
  pinnedFiles: 50000,
  projectMemory: 15000,
  semanticMemory: 10000,
  fileManifest: 2000,
  conversation: 100000,
  reserve: 18000
};
```

When context exceeds budget, older messages are trimmed first. System prompt is always preserved.

### 2. Streaming Architecture

Messages stream from Bedrock through Lambda to the client via Server-Sent Events (SSE):
```
Bedrock → Lambda (parse chunks) → SSE → Client (display)
```

The frontend uses `EventSource` to receive chunks and updates UI in real-time.

### 3. Artifact Detection

The chat Lambda detects code blocks in AI responses and auto-creates artifacts:
```javascript
// Pattern: ```language\n...code...\n```
// Results in artifact creation with appropriate type
```

### 4. User Data Isolation

**Every database query filters by userId**. S3 paths include userId. This is critical for multi-tenant security.

```javascript
// DynamoDB example
const params = {
  TableName: 'atlas-sessions',
  KeyConditionExpression: 'userId = :uid',
  ExpressionAttributeValues: { ':uid': userId }
};

// S3 path example
const key = `${userId}/${sessionId}/${artifactId}.json`;
```

### 5. Authentication Flow

1. User submits credentials to `/api/auth/login`
2. Lambda validates against DynamoDB (bcrypt comparison)
3. JWT generated with 10-hour expiry
4. Token stored in both HttpOnly cookie AND localStorage
   - Cookie: For same-origin requests
   - localStorage: For Lambda Function URL CORS requests
5. All subsequent requests include `Authorization: Bearer <token>`

## Common Development Tasks

### Adding a New API Endpoint

1. Create handler in `lambda/functions/<name>/index.js`
2. Add route in Lambda's main handler switch
3. Update Terraform in `terraform/lambda.tf`
4. Add service method in `frontend/src/services/<name>Service.js`
5. Remember to include auth check: `checkResponse(res, 'operation name')`

### Adding a New UI Component

1. Create component in `frontend/src/components/<Category>/`
2. Import and use in parent component
3. If needs global state, add to `useChatStore.js`
4. If needs auth, wrap with `useAuth()` from AuthContext

### Modifying AI Behavior

1. System prompt is in `lambda/functions/chat/index.js`
2. Token budgets are configurable in the same file
3. Context assembly order affects AI responses
4. Test with different conversation lengths

### Adding a New Database Table

1. Define table in `terraform/dynamodb.tf`
2. Add operations in `lambda/shared/db.js`
3. Create Lambda handler for CRUD
4. Build frontend service layer

## AWS Resources

| Resource | Name | Purpose |
|----------|------|---------|
| DynamoDB | atlas-users | User credentials, roles |
| DynamoDB | atlas-sessions | Chat sessions, messages |
| DynamoDB | atlas-projects | Project definitions |
| DynamoDB | atlas-artifacts | Artifact metadata |
| S3 | atlas-frontend-* | Static frontend hosting |
| S3 | atlas-artifacts-* | Artifact file storage |
| S3 | atlas-project-files-* | Pinned files |
| S3 | atlas-vectors-* | Semantic memory |
| Lambda | atlas-auth | Authentication |
| Lambda | atlas-chat | AI orchestration |
| Lambda | atlas-sessions | Session CRUD |
| Lambda | atlas-projects | Project management |
| Lambda | atlas-artifacts | Artifact storage |
| Lambda | atlas-insights | Fact extraction |
| CloudFront | - | CDN for frontend |

## Development Commands

```bash
# Frontend development
cd frontend
npm install
npm run dev              # Start dev server (port 5173)
npm run build            # Production build
npm run preview          # Preview production build

# Local development with Lambda proxy
cd atlas-web
node local-server.js     # Proxies to real Lambda (port 3001)

# Terraform
cd terraform
terraform init
terraform plan
terraform apply

# Deploy frontend to S3
aws s3 sync frontend/dist/ s3://atlas-frontend-<account-id>/ --delete
aws cloudfront create-invalidation --distribution-id <id> --paths "/*"
```

## Environment Configuration

### Frontend (.env)
```
VITE_API_URL=http://localhost:3001  # Local development
# Production: Uses relative /api paths via CloudFront
```

### Lambda Environment Variables
```
USERS_TABLE=atlas-users
SESSIONS_TABLE=atlas-sessions
PROJECTS_TABLE=atlas-projects
ARTIFACTS_TABLE=atlas-artifacts
ARTIFACTS_BUCKET=atlas-artifacts-<account>
PROJECT_FILES_BUCKET=atlas-project-files-<account>
VECTORS_BUCKET=atlas-vectors-<account>
JWT_SECRET=<secret>
AWS_REGION=us-west-2
```

## Code Conventions

### Frontend
- Functional components with hooks
- Zustand for global UI state
- Services return promises, handle errors
- CSS uses CSS variables for theming
- Component files: PascalCase (e.g., `ChatView.jsx`)

### Backend
- Lambda handlers export single `handler` function
- Shared utilities in `lambda/shared/`
- All DB queries include userId filter
- Errors return proper HTTP status codes
- Consistent response format: `{ success: boolean, data?: any, error?: string }`

### Security
- Never log sensitive data (passwords, tokens)
- Always validate JWT on every request
- Sanitize user input before DB storage
- Use parameterized queries (DynamoDB handles this)

## Recent Changes (as of Jan 2026)

1. **User isolation fix**: Removed hardcoded user info from useChatStore, added clearUserData() method
2. **Auth expiration handling**: Global auth error handler redirects to login on 401/403
3. **Project badge in title bar**: Shows project badge when chat belongs to project
4. **Markdown rendering**: Fixed bold text and streaming buffer issues

## Troubleshooting

### "Session expired" errors
- Check JWT expiry (10 hours)
- Verify token is being sent in Authorization header
- Check Lambda logs for auth validation

### User seeing other users' data
- Verify all DB queries filter by userId
- Check S3 paths include userId
- Confirm useChatStore clears on login/logout

### Streaming not working
- Check SSE headers in Lambda response
- Verify EventSource connection in browser
- Look for CORS issues in Network tab

### Artifacts not appearing
- Check artifact detection regex in chat Lambda
- Verify S3 bucket permissions
- Confirm artifact metadata saved to DynamoDB

## Quick Reference

### API Endpoints
```
POST   /api/auth/login      - Login
POST   /api/auth/logout     - Logout
GET    /api/auth/me         - Get current user

GET    /api/sessions        - List sessions
POST   /api/sessions        - Create session
GET    /api/sessions/:id    - Get session with messages
DELETE /api/sessions/:id    - Delete session

POST   /api/chat            - Send message (streaming)

GET    /api/projects        - List projects
POST   /api/projects        - Create project
GET    /api/projects/:id    - Get project
PUT    /api/projects/:id    - Update project
DELETE /api/projects/:id    - Delete project

GET    /api/artifacts       - List artifacts
POST   /api/artifacts       - Create artifact
GET    /api/artifacts/:id   - Get artifact
DELETE /api/artifacts/:id   - Delete artifact
```

### Zustand Store Shape
```javascript
{
  user: null | { name, initials, plan },
  sessions: [],
  projects: [],
  currentSessionId: null,
  messagesBySession: {},
  projectMemoryContext: {},
  pendingFiles: [],
  sidebarCollapsed: false,
  showArtifacts: false
}
```

### JWT Payload
```javascript
{
  userId: "uuid",
  username: "string",
  role: "user" | "admin",
  iat: timestamp,
  exp: timestamp  // 10 hours from iat
}
```

## Files to Read First

When starting work on this codebase, read these files in order:

1. `frontend/src/App.jsx` - Understand routing structure
2. `frontend/src/hooks/useChatStore.js` - Understand UI state
3. `frontend/src/services/chatService.js` - Understand API layer
4. `lambda/functions/chat/index.js` - Understand core AI logic
5. `lambda/shared/bedrock.js` - Understand Bedrock integration

This will give you a complete picture of the request flow from UI to AI and back.

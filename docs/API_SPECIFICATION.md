# ATLAS API Specification

**Version:** 1.0.0
**Base URL:** `https://{api-gateway-id}.execute-api.us-east-1.amazonaws.com`
**Streaming URL:** `https://{lambda-function-url}.lambda-url.us-east-1.on.aws`

---

## Overview

The ATLAS API provides RESTful endpoints for the AI development platform. All endpoints require JWT authentication unless otherwise noted.

### Authentication

All requests must include authentication via one of:

1. **HTTP-Only Cookie** (preferred for browser):
   ```
   Cookie: token=eyJhbGciOiJIUzI1NiIs...
   ```

2. **Authorization Header**:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIs...
   ```

### Common Response Codes

| Code | Description |
|------|-------------|
| 200 | Success |
| 201 | Created |
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Invalid or missing token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found |
| 500 | Internal Server Error |

### Error Response Format

```json
{
  "error": "Error message description",
  "code": "ERROR_CODE"
}
```

---

## Authentication Endpoints

### POST /api/auth/register

Create a new user account.

**Request Body:**
```json
{
  "username": "jsmith",
  "email": "jsmith@ally.com",
  "password": "SecurePassword123!",
  "displayName": "John Smith"
}
```

**Response:** `201 Created`
```json
{
  "success": true,
  "user": {
    "userId": "usr_abc123def456",
    "username": "jsmith",
    "email": "jsmith@ally.com",
    "displayName": "John Smith",
    "role": "user"
  }
}
```

**Errors:**
- `400` - Username or email already exists
- `400` - Invalid password format

---

### POST /api/auth/login

Authenticate and receive JWT token.

**Request Body:**
```json
{
  "username": "jsmith",
  "password": "SecurePassword123!"
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "user": {
    "userId": "usr_abc123def456",
    "username": "jsmith",
    "displayName": "John Smith",
    "role": "user"
  }
}
```

**Headers Set:**
```
Set-Cookie: token=eyJhbGci...; HttpOnly; Secure; SameSite=Lax; Max-Age=86400
```

**Errors:**
- `401` - Invalid username or password

---

### POST /api/auth/logout

Clear authentication cookie.

**Response:** `200 OK`
```json
{
  "success": true
}
```

**Headers Set:**
```
Set-Cookie: token=; HttpOnly; Secure; SameSite=Lax; Max-Age=0
```

---

### GET /api/auth/me

Get current authenticated user.

**Response:** `200 OK`
```json
{
  "userId": "usr_abc123def456",
  "username": "jsmith",
  "displayName": "John Smith",
  "email": "jsmith@ally.com",
  "role": "user"
}
```

**Errors:**
- `401` - Not authenticated

---

## Chat Endpoints

### POST /api/chat/message/stream

Send a message and receive streaming response via Lambda Function URL.

**Note:** This endpoint uses Server-Sent Events (SSE) for streaming.

**Request Body:**
```json
{
  "message": "Explain the loan service architecture",
  "session_id": "session_1706000000",
  "project_id": "proj_abc123",
  "model": "haiku",
  "web_search_enabled": true,
  "extended_thinking_enabled": false,
  "existing_artifacts": [
    {
      "id": "art_xyz789",
      "title": "Architecture Diagram",
      "type": "mermaid"
    }
  ],
  "files": [
    {
      "name": "requirements.pdf",
      "type": "application/pdf",
      "base64": "JVBERi0xLjQK..."
    }
  ]
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| message | string | Yes* | User message (*or files required) |
| session_id | string | No | Existing session ID (creates new if omitted) |
| project_id | string | No | Project context ID |
| model | string | No | Model: "haiku", "sonnet", "opus" (default: haiku) |
| web_search_enabled | boolean | No | Enable web search (default: true) |
| extended_thinking_enabled | boolean | No | Enable extended thinking (default: false) |
| existing_artifacts | array | No | Artifacts from current session for context |
| files | array | No | File attachments (max 4.5MB each) |

**Response:** `200 OK` (SSE Stream)

```
data: {"type":"memory_context","scope":"project","semanticMemoryCount":5,"relevantConversationsCount":2}

data: {"type":"chunk","content":"The loan service "}

data: {"type":"chunk","content":"uses event sourcing..."}

data: {"type":"artifact_start","artifact":{"id":"art_abc123","title":"Architecture","type":"mermaid","status":"generating"}}

data: {"type":"artifact_delta","artifact":{"id":"art_abc123","content":"graph TD\n  A[Client]"}}

data: {"type":"artifact_complete","artifact_id":"art_abc123","artifact":{"id":"art_abc123","title":"Architecture","type":"mermaid","content":"graph TD\n  A[Client] --> B[API]"}}

data: {"type":"metadata","usage":{"inputTokens":1500,"outputTokens":500}}

data: {"type":"done","message_id":"msg_1706000001_assistant","session_id":"session_1706000000"}
```

**SSE Event Types:**

| Type | Description |
|------|-------------|
| `chunk` | Text content fragment |
| `thinking` | Extended thinking content |
| `artifact_start` | New artifact detected |
| `artifact_delta` | Artifact content update |
| `artifact_complete` | Artifact finished |
| `search_start` | Web search initiated |
| `search_results` | Web search completed |
| `memory_context` | Semantic memories retrieved |
| `compaction` | Conversation history compacted |
| `processing` | File processing status |
| `metadata` | Token usage statistics |
| `done` | Stream complete |
| `error` | Error occurred |

---

## Session Endpoints

### GET /api/sessions

List all sessions for authenticated user.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| project_id | string | Filter by project |
| limit | number | Max results (default: 50) |

**Response:** `200 OK`
```json
{
  "sessions": [
    {
      "sessionId": "session_1706000000",
      "userId": "usr_abc123",
      "title": "Loan service refactoring",
      "projectId": "proj_abc123",
      "starred": false,
      "createdAt": 1706000000,
      "updatedAt": 1706100000
    }
  ]
}
```

---

### GET /api/sessions/{sessionId}

Get session details.

**Response:** `200 OK`
```json
{
  "sessionId": "session_1706000000",
  "userId": "usr_abc123",
  "title": "Loan service refactoring",
  "projectId": "proj_abc123",
  "starred": false,
  "createdAt": 1706000000,
  "updatedAt": 1706100000
}
```

---

### POST /api/sessions

Create a new session.

**Request Body:**
```json
{
  "title": "New conversation",
  "project_id": "proj_abc123"
}
```

**Response:** `201 Created`
```json
{
  "sessionId": "session_1706000000",
  "userId": "usr_abc123",
  "title": "New conversation",
  "projectId": "proj_abc123",
  "starred": false,
  "createdAt": 1706000000,
  "updatedAt": 1706000000
}
```

---

### PUT /api/sessions/{sessionId}

Update session.

**Request Body:**
```json
{
  "title": "Updated title",
  "starred": true
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### DELETE /api/sessions/{sessionId}

Delete session and all messages.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### GET /api/sessions/{sessionId}/messages

Get all messages in a session.

**Response:** `200 OK`
```json
{
  "messages": [
    {
      "messageId": "msg_1706000000_user",
      "sessionId": "session_1706000000",
      "role": "user",
      "content": "Explain the architecture",
      "timestamp": 1706000000
    },
    {
      "messageId": "msg_1706000001_assistant",
      "sessionId": "session_1706000000",
      "role": "assistant",
      "content": "The architecture consists of...",
      "thinking": "Let me analyze the requirements...",
      "timestamp": 1706000001
    }
  ]
}
```

---

## Project Endpoints

### GET /api/projects

List all projects.

**Response:** `200 OK`
```json
{
  "projects": [
    {
      "projectId": "proj_abc123",
      "userId": "usr_abc123",
      "name": "Loan Service Modernization",
      "description": "Refactoring the loan service to microservices",
      "instructions": "Always use event sourcing patterns",
      "lastActivityAt": 1706100000,
      "createdAt": 1706000000
    }
  ]
}
```

---

### GET /api/projects/{projectId}

Get project details.

**Response:** `200 OK`
```json
{
  "projectId": "proj_abc123",
  "userId": "usr_abc123",
  "name": "Loan Service Modernization",
  "description": "Refactoring the loan service to microservices",
  "instructions": "Always use event sourcing patterns",
  "lastActivityAt": 1706100000,
  "createdAt": 1706000000
}
```

---

### POST /api/projects

Create new project.

**Request Body:**
```json
{
  "name": "New Project",
  "description": "Project description",
  "instructions": "Custom instructions for AI"
}
```

**Response:** `201 Created`
```json
{
  "projectId": "proj_def456",
  "userId": "usr_abc123",
  "name": "New Project",
  "description": "Project description",
  "instructions": "Custom instructions for AI",
  "lastActivityAt": 1706000000,
  "createdAt": 1706000000
}
```

---

### PUT /api/projects/{projectId}

Update project.

**Request Body:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "instructions": "Updated instructions"
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### DELETE /api/projects/{projectId}

Delete project and all associated data.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Project Files Endpoints

### GET /api/projects/{projectId}/files

List project files.

**Response:** `200 OK`
```json
{
  "files": [
    {
      "fileId": "file_abc123",
      "projectId": "proj_abc123",
      "name": "requirements.md",
      "type": "text/markdown",
      "size": 2048,
      "tokenCount": 512,
      "pinned": "true",
      "status": "ready",
      "s3Key": "usr_abc123/proj_abc123/file_abc123.md",
      "createdAt": 1706000000
    }
  ]
}
```

---

### POST /api/projects/{projectId}/files

Upload file to project.

**Request Body:**
```json
{
  "name": "design.md",
  "content": "# Design Document\n\nThis document describes...",
  "type": "text/markdown"
}
```

**Response:** `201 Created`
```json
{
  "fileId": "file_def456",
  "projectId": "proj_abc123",
  "name": "design.md",
  "type": "text/markdown",
  "size": 1024,
  "tokenCount": 256,
  "pinned": "false",
  "status": "ready",
  "s3Key": "usr_abc123/proj_abc123/file_def456.md",
  "createdAt": 1706000000
}
```

---

### GET /api/projects/{projectId}/files/{fileId}

Get file content.

**Response:** `200 OK`
```json
{
  "fileId": "file_abc123",
  "name": "requirements.md",
  "content": "# Requirements\n\n...",
  "type": "text/markdown"
}
```

---

### PUT /api/projects/{projectId}/files/{fileId}

Update file.

**Request Body:**
```json
{
  "content": "Updated content..."
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### PUT /api/projects/{projectId}/files/{fileId}/pin

Toggle file pin status.

**Request Body:**
```json
{
  "pinned": true
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "pinned": true
}
```

---

### DELETE /api/projects/{projectId}/files/{fileId}

Delete file.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## Project Memory Endpoints

### GET /api/projects/{projectId}/memory

Get project memory.

**Response:** `200 OK`
```json
{
  "projectId": "proj_abc123",
  "version": 5,
  "current": true,
  "sections": {
    "purposeContext": "This project modernizes the loan service...",
    "currentState": "Currently implementing event sourcing...",
    "onTheHorizon": "Next: Add CQRS pattern...",
    "keyLearnings": "Event sourcing requires careful event design...",
    "approachPatterns": "Using saga orchestration for workflows...",
    "toolsResources": "Using Spring Boot, Kafka, PostgreSQL..."
  },
  "tokenCount": 512,
  "generatedAt": 1706100000
}
```

---

### PUT /api/projects/{projectId}/memory

Update project memory manually.

**Request Body:**
```json
{
  "sections": {
    "purposeContext": "Updated purpose...",
    "currentState": "Updated state..."
  }
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "version": 6
}
```

---

### POST /api/projects/{projectId}/memory/regenerate

Regenerate memory from conversation history.

**Response:** `200 OK`
```json
{
  "success": true,
  "version": 7,
  "sections": {
    "purposeContext": "Regenerated purpose...",
    "currentState": "Regenerated state..."
  }
}
```

---

## Artifact Endpoints

### GET /api/artifacts

List all artifacts for user.

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| session_id | string | Filter by session |
| limit | number | Max results (default: 50) |

**Response:** `200 OK`
```json
{
  "artifacts": [
    {
      "artifactId": "art_abc123",
      "sessionId": "session_1706000000",
      "userId": "usr_abc123",
      "title": "Architecture Diagram",
      "name": "Architecture-Diagram.mermaid",
      "type": "mermaid",
      "fileExtension": ".mermaid",
      "contentType": "text/plain",
      "renderable": true,
      "size": 512,
      "version": 2,
      "createdAt": 1706000000,
      "updatedAt": 1706100000
    }
  ]
}
```

---

### GET /api/sessions/{sessionId}/artifacts

List artifacts for a session.

**Response:** `200 OK`
```json
{
  "artifacts": [...]
}
```

---

### GET /api/artifacts/{artifactId}

Get artifact metadata.

**Response:** `200 OK`
```json
{
  "artifactId": "art_abc123",
  "sessionId": "session_1706000000",
  "title": "Architecture Diagram",
  "type": "mermaid",
  "version": 2,
  "size": 512,
  "createdAt": 1706000000,
  "updatedAt": 1706100000
}
```

---

### GET /api/artifacts/{artifactId}/content

Get artifact content.

**Response:** `200 OK`
```
Content-Type: text/plain

graph TD
  A[Client] --> B[API Gateway]
  B --> C[Loan Service]
  C --> D[Database]
```

---

### POST /api/artifacts

Create artifact manually.

**Request Body:**
```json
{
  "session_id": "session_1706000000",
  "title": "Manual Artifact",
  "type": "markdown",
  "content": "# Manual Content\n\nCreated manually..."
}
```

**Response:** `201 Created`
```json
{
  "artifactId": "art_def456",
  "sessionId": "session_1706000000",
  "title": "Manual Artifact",
  "type": "markdown",
  "version": 1
}
```

---

### PATCH /api/artifacts/{artifactId}

Update artifact.

**Request Body:**
```json
{
  "title": "Updated Title",
  "content": "Updated content..."
}
```

**Response:** `200 OK`
```json
{
  "success": true,
  "version": 3
}
```

---

### DELETE /api/artifacts/{artifactId}

Delete artifact.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

## File Endpoints

### POST /api/files/presign

Get presigned URL for direct S3 upload.

**Request Body:**
```json
{
  "filename": "large-document.pdf",
  "contentType": "application/pdf"
}
```

**Response:** `200 OK`
```json
{
  "uploadUrl": "https://s3.amazonaws.com/...",
  "fileKey": "uploads/usr_abc123/large-document.pdf",
  "expiresIn": 3600
}
```

---

### GET /api/files/{fileKey+}

Download file content.

**Response:** `200 OK` with file content

---

## MCP Configuration Endpoints

### GET /api/mcp/servers

List configured MCP servers.

**Response:** `200 OK`
```json
{
  "servers": [
    {
      "serverId": "knowledge-core",
      "name": "Knowledge Core",
      "description": "Enterprise context and patterns",
      "enabled": true,
      "config": {
        "url": "http://localhost:3001"
      }
    }
  ]
}
```

---

### POST /api/mcp/servers

Add MCP server configuration.

**Request Body:**
```json
{
  "name": "Custom MCP",
  "description": "Custom tool server",
  "config": {
    "url": "http://custom-mcp:3000"
  }
}
```

**Response:** `201 Created`
```json
{
  "serverId": "srv_abc123",
  "name": "Custom MCP",
  "enabled": true
}
```

---

### PUT /api/mcp/servers/{serverId}

Update MCP server configuration.

**Request Body:**
```json
{
  "enabled": false
}
```

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### DELETE /api/mcp/servers/{serverId}

Remove MCP server configuration.

**Response:** `200 OK`
```json
{
  "success": true
}
```

---

### GET /api/mcp/tools

List available tools from all enabled MCP servers.

**Response:** `200 OK`
```json
{
  "tools": [
    {
      "server": "knowledge-core",
      "name": "get_service_info",
      "description": "Get service metadata, patterns, and compliance requirements",
      "parameters": {
        "type": "object",
        "properties": {
          "service_name": {
            "type": "string",
            "description": "Name of the service"
          }
        },
        "required": ["service_name"]
      }
    }
  ]
}
```

---

### POST /api/mcp/execute

Execute an MCP tool.

**Request Body:**
```json
{
  "server": "knowledge-core",
  "tool": "get_service_info",
  "parameters": {
    "service_name": "loan-service"
  }
}
```

**Response:** `200 OK`
```json
{
  "result": {
    "name": "loan-service",
    "owner": "Consumer Lending Team",
    "patterns": ["event-sourcing", "cqrs"],
    "compliance": ["PCI-DSS", "SOC2", "GLBA"]
  }
}
```

---

## Rate Limits

| Endpoint | Rate Limit |
|----------|------------|
| /api/auth/* | 10 requests/minute |
| /api/chat/* | 60 requests/minute |
| /api/sessions/* | 100 requests/minute |
| /api/projects/* | 100 requests/minute |
| /api/artifacts/* | 100 requests/minute |
| /api/files/* | 50 requests/minute |

---

## Changelog

### v1.0.0 (2026-01)
- Initial API specification
- Authentication, Chat, Sessions, Projects, Artifacts, Files, MCP endpoints

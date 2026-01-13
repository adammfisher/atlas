# ATLAS Backend Architecture

A simple guide to how the ATLAS chat platform maintains context and memory.

---

## The Big Picture

```
User → CloudFront → API Gateway → Lambda → Bedrock (Claude)
                                    ↓
                              DynamoDB (state)
                              S3 (files)
```

ATLAS is a **serverless chat application** that:
1. Stores conversation history in DynamoDB
2. Stores uploaded files in S3
3. Sends everything to Claude via AWS Bedrock

**There is no vector database.** Context is managed through text summaries, not embeddings.

---

## AWS Services Used

| Service | Purpose |
|---------|---------|
| **CloudFront** | CDN for frontend (React app) |
| **S3** | Frontend hosting + file storage |
| **API Gateway** | Routes API requests (or Lambda Function URLs) |
| **Lambda** | Backend logic (3 functions) |
| **DynamoDB** | State storage (sessions, messages, projects) |
| **Bedrock** | Claude AI models (Haiku, Sonnet, Opus) |

---

## Lambda Functions

### 1. Chat Handler (`lambda/functions/chat/index.js`)
- Receives user messages
- Loads conversation history
- Builds context for Claude
- Streams responses back
- Saves messages

### 2. Sessions Handler (`lambda/functions/sessions/index.js`)
- Create/read/update/delete sessions
- List user's chat history
- Star/unstar conversations

### 3. Projects Handler (`lambda/functions/projects/index.js`)
- Manage projects
- Upload/manage files
- Generate project memory

---

## How Context is Maintained

### Step-by-Step Message Flow

```
1. User sends "What did we discuss yesterday?"
                    ↓
2. Lambda receives message + session_id
                    ↓
3. Load ALL previous messages from DynamoDB
   (sorted by timestamp)
                    ↓
4. If conversation > 160K tokens:
   → Summarize old messages (compaction)
                    ↓
5. If in a project:
   → Load project memory (6-section summary)
   → Load pinned files from S3
                    ↓
6. Assemble everything into one context:
   [Compacted history] + [Project memory] + [Files] + [Recent messages] + [Current message]
                    ↓
7. Send to Claude via Bedrock
                    ↓
8. Stream response back to user
                    ↓
9. Save both messages to DynamoDB
```

### Token Budget (200K Total)

Claude has a 200K token context window. Here's how it's allocated:

| Component | Budget | Description |
|-----------|--------|-------------|
| System Prompt | 5,000 | Instructions for Claude |
| Project Memory | 15,000 | Synthesized project knowledge |
| Pinned Files | 50,000 | Files user marked as important |
| Conversation | 100,000 | Chat history |
| Reserve | 30,000 | Buffer space |

---

## Conversation Compaction

**Problem:** Long conversations exceed Claude's context window.

**Solution:** When history exceeds 160K tokens (80%), compress it:

```
BEFORE COMPACTION:
├── Message 1: "Let's build a todo app"
├── Message 2: "Sure, I'll use React..."
├── Message 3: "Can you add dark mode?"
├── ... (hundreds of messages)
└── Message 500: "How do I deploy?"

AFTER COMPACTION:
├── KEY POINTS (from oldest 50%):
│   "Building React todo app with dark mode,
│    authentication, and PostgreSQL backend"
│
├── SUMMARY (from middle 25%):
│   "Implemented user auth with JWT, added
│    CRUD operations, fixed timezone bugs"
│
└── RECENT MESSAGES (newest 25% - kept in full):
    ├── Message 375: "The tests are passing now"
    ├── Message 376: "Great! Let's add..."
    └── ... (kept exactly as-is)
```

Compaction is done by Claude Haiku (fast, cheap) and cached for 7 days.

---

## Project Memory

Projects have a special "memory" feature - a 6-section summary that persists across all chats in that project.

### The 6 Sections

1. **Purpose & Context** - What is this project about?
2. **Current State** - What's been accomplished?
3. **On The Horizon** - What's planned next?
4. **Key Learnings** - Important decisions and insights
5. **Approach & Patterns** - Architecture and coding patterns
6. **Tools & Resources** - Technologies being used

### How It's Generated

```
1. Gather all conversations in the project
                    ↓
2. Send to Claude Haiku with prompt:
   "Analyze these conversations and generate 6 sections..."
                    ↓
3. Parse response into sections
                    ↓
4. Store in PROJECT_MEMORY table (versioned)
```

### How It's Used

When you chat in a project, the memory is included in the system prompt:

```
<project_memory>
## Purpose & Context
Building an e-commerce platform for selling handmade crafts...

## Current State
Completed: Product catalog, shopping cart, user authentication...

## On The Horizon
Next: Payment integration with Stripe, order notifications...
</project_memory>
```

This gives Claude persistent knowledge about your project without needing the full conversation history.

---

## File Storage (S3)

### Two Buckets

**UPLOADS_BUCKET** - User uploaded files
```
projects/
  proj_abc123/
    file_001-requirements.pdf
    file_002-schema.sql
    file_003-mockup.png
```

**ARTIFACTS_BUCKET** - Claude-generated content
```
session_xyz789/
  art_001-analysis.md
  art_002-diagram.svg
  art_003-component.jsx
```

### How Files Work in Context

1. User uploads file to project
2. Metadata stored in PROJECT_FILES table (name, size, s3Key, tokenCount)
3. User can "pin" important files
4. When chatting, pinned files are loaded from S3 and included in context
5. Token budget: 50K tokens for pinned files

**Important:** Files are loaded as raw text, not as vector embeddings. There's no semantic search.

---

## DynamoDB Tables

### SESSIONS
```
PK: userId
SK: sessionId
─────────────
title, starred, projectId, createdAt, updatedAt
```

### MESSAGES
```
PK: sessionId
SK: messageId
─────────────
role (user/assistant), content, thinking, timestamp, files
```

### PROJECTS
```
PK: userId
SK: projectId
─────────────
name, description, instructions, createdAt
```

### PROJECT_MEMORY
```
PK: projectId
SK: version (number)
─────────────
sections (6 text fields), current (boolean), tokenCount, generatedAt
```

### PROJECT_FILES
```
PK: projectId
SK: fileId
─────────────
name, type, size, s3Key, pinned, tokenCount, processingStatus
```

### SUMMARIES (Cache)
```
PK: sessionId
─────────────
summary, keyPoints, tokenCount, TTL (7 days)
```

---

## Key Design Decisions

### Why No Vector Database?

1. **Simplicity** - Text summaries are easier to understand and debug
2. **Cost** - No need for vector DB hosting (Pinecone, Weaviate, etc.)
3. **Claude's Context** - 200K tokens is usually enough with good compaction
4. **Determinism** - Same input always produces same context

### Why Haiku for Compaction?

1. **Speed** - Compaction shouldn't slow down the conversation
2. **Cost** - Haiku is 60x cheaper than Opus
3. **Quality** - Summarization doesn't need the smartest model

### Why Version Project Memory?

1. **History** - Can see how project evolved
2. **Rollback** - Can restore previous version if needed
3. **Audit** - Track when memory was regenerated

---

## Example: Full Request Flow

```
User: "What's the status of the payment integration?"
Project: proj_ecommerce_123

1. API Gateway receives POST /api/chat/message/stream

2. Chat Lambda starts:
   a. Get session (or create new one)
   b. Query MESSAGES table → 45 messages (50K tokens)
   c. Check compaction: 50K < 160K → not needed
   d. Query PROJECT_MEMORY → load current version
   e. Query PROJECT_FILES (pinned=true) → 3 files
   f. Load files from S3: requirements.pdf, schema.sql, api-spec.md

3. Build context:
   ┌─────────────────────────────────────────┐
   │ System Prompt (5K tokens)               │
   │ - Base instructions                     │
   │ - Project memory (6 sections)           │
   │ - File manifest                         │
   │ - Pinned file contents                  │
   ├─────────────────────────────────────────┤
   │ Conversation History (50K tokens)       │
   │ - 45 messages in chronological order    │
   ├─────────────────────────────────────────┤
   │ Current Message                         │
   │ - "What's the status of payment..."     │
   └─────────────────────────────────────────┘
   Total: ~70K tokens (well under 200K limit)

4. Call Bedrock ConverseStreamCommand:
   - Model: claude-sonnet
   - Stream: true

5. As response streams:
   - Send chunks to frontend via SSE
   - Detect any artifacts (code blocks, diagrams)

6. When complete:
   - Save user message to MESSAGES
   - Save assistant message to MESSAGES
   - Save any artifacts to S3

7. Frontend displays response with any artifacts
```

---

## Summary

- **No vectors** - Pure text-based context management
- **DynamoDB** - All state (sessions, messages, projects, memory)
- **S3** - Raw file storage (uploads and artifacts)
- **Compaction** - Summarize long conversations to fit context window
- **Project Memory** - 6-section summary persists across chats
- **Token Budget** - Carefully allocated 200K tokens across components

The system prioritizes simplicity and cost-effectiveness over fancy ML techniques. Claude's large context window makes this approach viable.

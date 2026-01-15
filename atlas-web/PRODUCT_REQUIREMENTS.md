# Atlas Platform - Product Requirements Document

**Version:** 1.0
**Last Updated:** January 15, 2026
**Status:** Active Development

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Product Vision & Goals](#2-product-vision--goals)
3. [User Personas](#3-user-personas)
4. [Core Features](#4-core-features)
5. [Technical Architecture](#5-technical-architecture)
6. [Data Models](#6-data-models)
7. [API Specification](#7-api-specification)
8. [User Interface Specifications](#8-user-interface-specifications)
9. [Security Requirements](#9-security-requirements)
10. [Performance Requirements](#10-performance-requirements)
11. [Deployment & Infrastructure](#11-deployment--infrastructure)
12. [Known Limitations & Future Roadmap](#12-known-limitations--future-roadmap)

---

## 1. Executive Summary

### 1.1 Product Overview

**Atlas** is an enterprise AI research platform providing a serverless, scalable interface for AI-powered conversation, artifact generation, and knowledge management. The platform leverages AWS Lambda, DynamoDB, S3, and Claude AI models via AWS Bedrock to deliver streaming chat, project management, semantic search, and extensible integration capabilities.

### 1.2 Technology Stack

| Layer | Technology |
|-------|------------|
| **Frontend** | React 18, Zustand (state management), Vite (build), TailwindCSS |
| **Backend** | AWS Lambda (Node.js 20.x), API Gateway HTTP API v2 |
| **Database** | Amazon DynamoDB (on-demand) |
| **Storage** | Amazon S3 |
| **AI Engine** | Claude 4.5 models via AWS Bedrock (Haiku, Sonnet, Opus) |
| **Infrastructure** | Terraform IaC |
| **Authentication** | JWT tokens with bcrypt password hashing |

### 1.3 Key Capabilities

- **Real-time Streaming Chat** - Server-Sent Events with native Lambda Response Streaming
- **Multi-Model Support** - Claude Haiku, Sonnet, and Opus with easy switching
- **Artifact Generation** - Code, documents, diagrams, and visualizations
- **Project Management** - Organize work with persistent context and files
- **Knowledge Core** - Enterprise knowledge repository integration (optional)
- **Extended Thinking** - Claude's deliberation mode for complex reasoning
- **Web Search Integration** - Ground responses in current information

---

## 2. Product Vision & Goals

### 2.1 Vision Statement

Atlas empowers researchers, developers, and knowledge workers to collaborate with AI in a persistent, context-aware environment that grows smarter with each interaction.

### 2.2 Product Goals

| Goal | Description | Success Metric |
|------|-------------|----------------|
| **Contextual Intelligence** | Maintain project context across sessions | 90% context retention accuracy |
| **Artifact Quality** | Generate production-ready code and documents | <5% manual corrections needed |
| **Performance** | Real-time streaming with minimal latency | First token <3s, no dropped streams |
| **Cost Efficiency** | Optimize token usage and API costs | <$0.10 per conversation average |
| **User Experience** | Intuitive interface requiring minimal training | <5 minutes to first meaningful output |

### 2.3 Non-Goals

- Real-time multi-user collaboration (future consideration)
- Mobile native applications
- Offline functionality
- Voice/audio input

---

## 3. User Personas

### 3.1 Primary Persona: Product Owner

**Name:** Sarah
**Role:** Product Owner / Product Manager
**Goals:**
- Research and understand complex product domains quickly
- Document product requirements and user stories with AI assistance
- Map out product features and dependencies for engineering teams
- Maintain persistent context across product discovery sessions
- Generate artifacts (flowcharts, diagrams, specifications) for stakeholder communication

**Pain Points:**
- Losing research context when switching between product areas
- Time-consuming documentation of product specifications
- Difficulty translating business requirements into technical specifications
- Scattered information across multiple tools and conversations
- Repetitive explanations of product context to different stakeholders

**Key Use Cases:**
- Product discovery and market research
- User story and acceptance criteria generation
- Feature mapping and dependency documentation
- Competitive analysis synthesis
- Stakeholder presentation materials

### 3.2 Primary Persona: Technical Architect

**Name:** Marcus
**Role:** Solutions Architect / Principal Engineer
**Goals:**
- Research and evaluate technology solutions and patterns
- Document architecture decisions (ADRs) with full context
- Map system dependencies and integration points
- Create technical diagrams and visualizations for engineering teams
- Build organizational knowledge base of architectural patterns

**Pain Points:**
- Complex system landscapes requiring extensive documentation
- Maintaining consistency across architectural decisions
- Communicating technical concepts to non-technical stakeholders
- Keeping architecture documentation current and accessible
- Onboarding new team members to existing system context

**Key Use Cases:**
- Architecture decision record (ADR) generation
- System integration mapping and documentation
- Technology evaluation and comparison
- Technical specification authoring
- Diagram generation (sequence, component, deployment)

### 3.3 Primary Persona: Business Leader

**Name:** Diana
**Role:** Director / VP of Product or Technology
**Goals:**
- Quickly synthesize information across multiple domains
- Generate executive summaries and strategic documents
- Understand technical implications of business decisions
- Create presentations and artifacts for board/stakeholder communication
- Maintain strategic context across initiatives

**Pain Points:**
- Information overload from multiple sources and teams
- Time constraints limiting deep research capabilities
- Translating technical details into business impact
- Maintaining continuity across long-running strategic initiatives
- Difficulty getting consistent, contextual answers to complex questions

**Key Use Cases:**
- Strategic initiative research and synthesis
- Executive presentation generation
- Cross-functional initiative documentation
- Risk assessment and mitigation planning
- Vendor/partner evaluation research

### 3.4 Secondary Persona: Research Analyst

**Name:** Jordan
**Role:** Business Analyst / Technical Writer / Researcher
**Goals:**
- Conduct deep research on products, services, and technologies
- Map out systems and processes for engineering consumption
- Generate comprehensive documentation and reports
- Build and maintain organizational knowledge repositories
- Create visual artifacts (diagrams, flowcharts) to explain complex concepts

**Pain Points:**
- Research context lost between sessions
- Manual effort to transform research into engineering-ready formats
- Difficulty maintaining documentation accuracy over time
- Repetitive research tasks across similar domains
- Information scattered across tools and conversations

**Key Use Cases:**
- Product and service mapping documentation
- Process flow documentation
- API and integration research
- Competitive intelligence gathering
- Knowledge base article creation

### 3.5 Persona Summary Matrix

| Persona | Primary Need | Key Artifact Types | Context Importance |
|---------|--------------|-------------------|-------------------|
| **Product Owner** | Product discovery & requirements | User stories, flowcharts, specs | High - multi-sprint continuity |
| **Technical Architect** | System design & decisions | ADRs, diagrams, technical specs | Critical - long-term reference |
| **Business Leader** | Strategic synthesis | Executive summaries, presentations | Medium - initiative-based |
| **Research Analyst** | Deep research & documentation | Reports, process maps, knowledge base | High - cross-project reference |

---

## 4. Core Features

### 4.1 Streaming Chat Interface

#### 4.1.1 Description
Real-time conversation with Claude AI models featuring streaming response display, file uploads, and artifact generation.

#### 4.1.2 Functional Requirements

| ID | Requirement                                                                                                                               | Priority |
|----|-------------------------------------------------------------------------------------------------------------------------------------------|----------|
| CHAT-001 | System SHALL stream responses in real-time using Server-Sent Events                                                                       | P0 |
| CHAT-002 | System SHALL support file uploads (images, PDFs, documents, zip archives)                                                                 | P0 |
| CHAT-003 | System SHALL detect and render artifacts in the artifact pane as well as a "creating document" bubble in the main window during streaming | P0 |
| CHAT-004 | System SHALL persist conversation history to DynamoDB                                                                                     | P0 |
| CHAT-005 | System SHALL support model switching (Haiku, Sonnet, Opus)                                                                                | P1 |
| CHAT-006 | System SHALL support extended thinking mode                                                                                               | P1 |
| CHAT-007 | System SHALL support web search integration                                                                                               | P1 |
| CHAT-008 | System SHALL auto-generate session titles from first message                                                                              | P2 |
| CHAT-009 | System SHALL support session starring for favorites                                                                                       | P2 |

#### 4.1.3 Streaming Events

The chat streaming endpoint SHALL emit the following event types:

```
Event Type          | Description                              | Payload
--------------------|------------------------------------------|---------------------------
chunk               | Text content to display                  | { content: string }
thinking            | Extended thinking content                | { content: string }
search_start        | Web search query initiated               | { query: string }
search_results      | Web search results received              | { results: array, count: number }
processing          | File processing status                   | { status: string, file: string }
compaction          | Conversation memory being optimized      | { message, originalTokens, newTokens, summarizedMessages }
artifact_start      | Artifact generation started              | { id, title, type }
artifact_delta      | Artifact content update                  | { id, content: string }
artifact_complete   | Artifact generation complete             | { id, title, type, content }
memory_context      | Semantic memories retrieved              | { memories: array }
knowledge_context   | Knowledge Core results                   | { artifacts: array, adrs: array }
done                | Stream complete                          | { message_id, session_id }
error               | Error occurred                           | { message: string }
```

#### 4.1.4 File Upload Specifications

| File Type | Max Size | Supported Extensions |
|-----------|----------|---------------------|
| Images | 20 MB | .jpg, .jpeg, .png, .gif, .webp |
| Documents | 50 MB | .pdf, .doc, .docx, .txt, .md |
| Code | 10 MB | .js, .ts, .py, .java, .go, .rs, etc. |
| Archives | 100 MB | .zip (auto-extracted) |

#### 4.1.5 Token Budget Allocation

Total context window: **200,000 tokens**

| Component | Budget | Notes |
|-----------|--------|-------|
| System Prompt | 5,000 | Base instructions |
| Project Memory | 15,000 | 6-section synthesized context |
| Semantic Memory | 10,000 | Vector-retrieved facts |
| Pinned Files | 50,000 | User-selected important files |
| File Manifest | 2,000 | List of available files |
| Conversation History | 100,000 | Messages (compacted if needed) |
| Reserve Buffer | 18,000 | Safety margin |

---

### 4.2 Projects Feature

#### 4.2.1 Description
Organize conversations around specific initiatives with persistent context, shared files, and automatic memory synthesis.

#### 4.2.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| PROJ-001 | System SHALL support CRUD operations on projects | P0 |
| PROJ-002 | System SHALL associate sessions with projects | P0 |
| PROJ-003 | System SHALL support file uploads per project | P0 |
| PROJ-004 | System SHALL support file pinning (context inclusion) | P0 |
| PROJ-005 | System SHALL generate and maintain project memory | P0 |
| PROJ-006 | System SHALL support custom project instructions | P1 |
| PROJ-007 | System SHALL track project activity timestamps | P1 |
| PROJ-008 | System SHALL support project archival | P2 |
| PROJ-009 | System SHALL support semantic memory search | P2 |

#### 4.2.3 Project Memory Sections

The project memory SHALL be automatically synthesized into 6 sections:

| Section | Purpose | Example Content |
|---------|---------|-----------------|
| **Purpose & Context** | Project goals and scope | "Building a customer portal with React and Node.js" |
| **Current State** | Completed work and achievements | "Authentication complete, API endpoints deployed" |
| **On The Horizon** | Planned future work | "Payment integration, admin dashboard" |
| **Key Learnings** | Important insights and decisions | "Chose JWT over sessions for stateless auth" |
| **Approach & Patterns** | Architecture and design patterns | "Repository pattern, event-driven architecture" |
| **Tools & Resources** | Technology stack being used | "React 18, Express, PostgreSQL, Docker" |

#### 4.2.4 Memory Generation Process

1. After each assistant message in project context:
   - Extract conversation to memory processor
   - Send to Claude Haiku for incremental update
   - Parse structured JSON response
   - Merge with existing sections
   - Store new version (old marked inactive)
   - Cache token counts

2. Memory update SHALL be non-blocking (async)
3. Memory update SHALL use Claude Haiku for cost efficiency
4. Memory SHALL be versioned (rollback capability)

---

### 4.3 Artifacts System

#### 4.3.1 Description
Generate, store, display, and manage Claude-generated content including code, documents, and diagrams.

#### 4.3.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| ART-001 | System SHALL detect artifacts during streaming | P0 |
| ART-002 | System SHALL support multiple artifact types | P0 |
| ART-003 | System SHALL render artifacts with type-specific viewers | P0 |
| ART-004 | System SHALL persist artifacts to S3 | P0 |
| ART-005 | System SHALL support artifact versioning | P0 |
| ART-006 | System SHALL support artifact download | P1 |
| ART-007 | System SHALL support copy to clipboard | P1 |
| ART-008 | System SHALL support save to project files | P1 |
| ART-009 | System SHALL display artifacts in side panel | P1 |
| ART-010 | System SHALL support source/preview toggle | P2 |
| ART-011 | System SHALL support fullscreen view | P2 |

#### 4.3.3 Supported Artifact Types

| Type | Extension | Renderer | MIME Type |
|------|-----------|----------|-----------|
| **Markdown** | .md | ReactMarkdown | text/markdown |
| **HTML** | .html | Sandboxed iframe | text/html |
| **SVG** | .svg | Inline SVG | image/svg+xml |
| **Mermaid** | .mermaid | Mermaid.js | text/x-mermaid |
| **React/JSX** | .jsx | Live preview | text/jsx |
| **JavaScript** | .js | Syntax highlight | text/javascript |
| **TypeScript** | .ts | Syntax highlight | text/typescript |
| **Python** | .py | Syntax highlight | text/x-python |
| **JSON** | .json | JSON viewer | application/json |
| **CSV** | .csv | Table view | text/csv |
| **CSS** | .css | Syntax highlight | text/css |
| **SQL** | .sql | Syntax highlight | text/x-sql |
| **YAML** | .yaml | Syntax highlight | text/yaml |
| **Shell** | .sh | Syntax highlight | text/x-sh |

#### 4.3.4 Artifact Detection

The system SHALL detect artifacts in two formats:

**Native Format (Preferred):**
```xml
<artifact type="code" title="My Component" language="jsx">
  // artifact content here
</artifact>
```

**Legacy Code Fence Format:**
```markdown
```jsx:MyComponent.jsx
// artifact content here
```​
```

#### 4.3.5 Artifact ID Generation

Artifact IDs SHALL be stable across updates:
```
artifactId = "art_" + hash(title + type).substring(0, 8)
```

This ensures:
- Same title + type = same artifact (enables updates)
- Version increment on content changes
- No duplicate artifacts for revisions

---

### 4.4 Authentication & Authorization

#### 4.4.1 Description
Secure user access with JWT-based authentication supporting registration, login, and session management.

#### 4.4.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| AUTH-001 | System SHALL support user registration | P0 |
| AUTH-002 | System SHALL support login with username/email + password | P0 |
| AUTH-003 | System SHALL issue JWT tokens on successful login | P0 |
| AUTH-004 | System SHALL validate JWT on every API request | P0 |
| AUTH-005 | System SHALL store tokens in HttpOnly cookies | P0 |
| AUTH-006 | System SHALL hash passwords with bcrypt (12 rounds) | P0 |
| AUTH-007 | System SHALL support logout (cookie clearing) | P1 |
| AUTH-008 | System SHALL support token refresh | P2 |
| AUTH-009 | System SHALL support role-based access (user, admin) | P2 |

#### 4.4.3 JWT Token Specification

| Field | Value |
|-------|-------|
| **Algorithm** | HS256 |
| **Expiry** | 10 hours |
| **Payload** | { userId, username, email, role, iat, exp } |
| **Secret** | Environment variable (JWT_SECRET) |

#### 4.4.4 Cookie Configuration

| Environment | SameSite | Secure | HttpOnly |
|-------------|----------|--------|----------|
| Development | Lax | false | true |
| Production | None | true | true |

---

### 4.5 Knowledge Core (Optional - Toggle Enabled)

#### 4.5.1 Description
Enterprise knowledge repository for semantic search across organizational artifacts and architecture decision records (ADRs). **Knowledge Core is an optional feature that must be explicitly enabled by the user via a toggle in the chat interface.**

#### 4.5.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| KC-001 | System SHALL provide a Knowledge Core toggle button in chat input | P0 |
| KC-002 | System SHALL only query Knowledge Core when toggle is enabled | P0 |
| KC-003 | System SHALL query Knowledge Core before generating response (when enabled) | P1 |
| KC-004 | System SHALL display Knowledge Core results in thinking panel | P1 |
| KC-005 | System SHALL include relevant context in system prompt | P1 |
| KC-006 | System SHALL support artifact sharing to Knowledge Core | P2 |
| KC-007 | System SHALL gracefully degrade if Knowledge Core unavailable | P0 |
| KC-008 | System SHALL persist Knowledge Core toggle state per session | P2 |

#### 4.5.3 Toggle Behavior

- **Default State:** Enabled (can be configured per deployment)
- **UI Location:** Chat input toolbar, alongside extended thinking and file upload buttons
- **Visual Indicator:** Icon changes color/state when enabled vs disabled
- **Tooltip:** "Knowledge Core enabled - click to disable" / "Knowledge Core disabled - click to enable"

#### 4.5.4 Integration Architecture

```
User Message → [Check KC Toggle] → If Enabled → Query Knowledge Core → Retrieve Context → Include in System Prompt → Claude Response
                                  ↓
                            If Disabled → Skip KC Query → Generate Response Directly

When Enabled:
              Neo4j/OpenSearch
                     ↓
              Return artifacts, ADRs
```

#### 4.5.5 Query Flow (When Enabled)

1. User sends message with Knowledge Core toggle ON
2. System extracts key terms from user message
3. Query Knowledge Core (Neo4j/OpenSearch) for relevant artifacts and ADRs
4. Return results in `knowledge_context` streaming event
5. Include relevant context in Claude's system prompt
6. Display search results in thinking/steps panel (optional)

---

### 4.6 Insights & Curation System

#### 4.6.1 Description
Automatically collect valuable artifacts for organizational knowledge sharing with manual curation controls.

#### 4.6.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| INS-001 | System SHALL auto-capture artifacts with content > 50 chars | P1 |
| INS-002 | System SHALL display pending insights in floating bubble | P1 |
| INS-003 | System SHALL support sharing insights to Knowledge Core | P1 |
| INS-004 | System SHALL support dismissing insights | P1 |
| INS-005 | System SHALL skip artifacts already from Knowledge Core | P2 |

---

### 4.7 Conversation Compaction

#### 4.7.1 Description
Automatic conversation summarization when token budget is exceeded, maintaining context while reducing token count. The system intelligently compresses older conversation history while preserving recent context, ensuring users can have extended conversations without losing important information.

#### 4.7.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| COMP-001 | System SHALL trigger compaction at 80% token threshold (160K tokens) | P0 |
| COMP-002 | System SHALL use Claude Haiku for compaction (cost-effective) | P0 |
| COMP-003 | System SHALL preserve newest messages as-is (target 50% of context) | P0 |
| COMP-004 | System SHALL summarize middle tier messages into concise summary | P0 |
| COMP-005 | System SHALL extract key points from oldest messages | P0 |
| COMP-006 | System SHALL cache compacted context in DynamoDB (7-day TTL) | P1 |
| COMP-007 | System SHALL notify user when compaction is triggered via streaming event | P0 |
| COMP-008 | System SHALL display compaction notification in chat UI | P0 |
| COMP-009 | System SHALL reuse cached summaries when token count matches | P1 |
| COMP-010 | System SHALL log compaction statistics for monitoring | P2 |

#### 4.7.3 Compaction Trigger Logic

```javascript
// Constants
CONTEXT_LIMIT = 200,000 tokens (Claude model limit)
COMPACTION_THRESHOLD = 80% (160,000 tokens)
COMPACTION_TARGET = 50% (100,000 tokens)

// Trigger condition
if (totalConversationTokens >= COMPACTION_THRESHOLD) {
  triggerCompaction()
}
```

#### 4.7.4 Compaction Strategy

The compaction algorithm divides messages into three tiers based on recency:

```
Messages (oldest → newest):
┌─────────────────────┬─────────────────────┬─────────────────────┐
│     OLDEST TIER     │    MIDDLE TIER      │    RECENT TIER      │
│     (~50% old)      │    (~25% middle)    │    (~25% newest)    │
├─────────────────────┼─────────────────────┼─────────────────────┤
│   → Key Points      │   → Summary         │   → Preserved       │
│   Extracted facts   │   Concise overview  │   Full messages     │
│   and decisions     │   of discussions    │   kept as-is        │
└─────────────────────┴─────────────────────┴─────────────────────┘
```

**Tier Processing:**

1. **Recent Tier (Preserved):**
   - Messages kept in full, unmodified
   - Sized to fit within target token budget
   - Maintains full context for ongoing discussion

2. **Middle Tier (Summarized):**
   - Compressed into concise summary paragraph
   - Captures main discussion points and decisions
   - Injected as `<recent_conversation_summary>` context

3. **Oldest Tier (Key Points):**
   - Extracted into bullet-point key facts
   - Focuses on decisions, preferences, technical details
   - Injected as `<conversation_history_key_points>` context

#### 4.7.5 User Notification

When compaction is triggered, the system SHALL notify the user:

**Streaming Event:**
```json
{
  "type": "compaction",
  "data": {
    "message": "Optimizing conversation memory...",
    "originalTokens": 165000,
    "newTokens": 95000,
    "summarizedMessages": 42
  }
}
```

**UI Display:**
- Display a subtle notification banner in the chat: "Conversation memory optimized - older messages have been summarized to maintain context"
- Optionally show statistics: "42 messages summarized, context reduced from 165K to 95K tokens"
- Notification should be dismissible and non-blocking

#### 4.7.6 Context Injection Format

After compaction, context is injected into the conversation as synthetic message pairs:

```
[User]: <conversation_history_key_points>
- User prefers TypeScript for all new code
- Authentication uses JWT with 10-hour expiration
- Database choice: PostgreSQL with Prisma ORM
- Deployment target: AWS Lambda + API Gateway
</conversation_history_key_points>

[Assistant]: I understand the context from earlier in our conversation.

[User]: <recent_conversation_summary>
We discussed implementing the user profile API endpoints. You created
CRUD operations for /api/users with proper validation. We also set up
error handling middleware and added rate limiting.
</recent_conversation_summary>

[Assistant]: Got it, I have the context from our recent discussion.

[... Recent messages preserved in full ...]
```

#### 4.7.7 Caching Strategy

- Compacted summaries cached in `SUMMARIES_TABLE` (DynamoDB)
- Cache key: `sessionId`
- Cache includes: `keyPoints`, `middleSummary`, `tokenCount`, `messageCount`
- TTL: 7 days (automatic expiry)
- Cache validation: Token count must match to reuse (prevents stale summaries)
- Cache reuse saves ~$0.01-0.05 per compaction (Haiku API cost)

#### 4.7.8 Implementation Notes

**Backend (Lambda):**
1. Before building messages, call `compactConversation(history, cachedSummary, model)`
2. If `compacted === true`:
   - Send `compaction` event to frontend via SSE stream
   - Use `recentMessages` instead of full history
   - Include `compactedContext` in message building
   - Cache new summary to DynamoDB
3. Log compaction statistics for monitoring

**Frontend (React):**
1. Listen for `compaction` event type in SSE handler
2. Display notification toast/banner when received
3. Optionally store compaction history for debugging

---

### 4.8 Extended Thinking Mode

#### 4.8.1 Description
Enable Claude's deliberation mode for complex reasoning tasks with visible thinking process.

#### 4.8.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| THINK-001 | System SHALL support extended thinking toggle | P1 |
| THINK-002 | System SHALL stream thinking content in real-time | P1 |
| THINK-003 | System SHALL display thinking in collapsible panel | P1 |
| THINK-004 | System SHALL persist thinking content with message | P2 |

---

### 4.9 Web Search Integration

#### 4.9.1 Description
Ground Claude responses in current information by enabling real-time web search.

#### 4.9.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| SEARCH-001 | System SHALL support web search toggle | P1 |
| SEARCH-002 | System SHALL stream search queries and results | P1 |
| SEARCH-003 | System SHALL display search results in thinking panel | P1 |

---

### 4.10 Appearance & Customization

#### 4.10.1 Description
Personalize user experience with theme and typography options.

#### 4.10.2 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| THEME-001 | System SHALL support light, dark, and auto color modes | P2 |
| THEME-002 | System SHALL support multiple font families | P2 |
| THEME-003 | System SHALL persist preferences to local storage | P2 |

#### 4.10.3 Theme Options

**Color Modes:**
- Light - Light backgrounds, dark text
- Dark - Dark backgrounds, light text
- Auto - Follow system preference

**Font Families:**
- Default (Merriweather) - Serif for readability
- Poppins - Modern sans-serif
- Lato - Clean sans-serif
- System UI - Native system font

---

## 5. Technical Architecture

### 5.1 System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                           FRONTEND                                   │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   React     │  │   Zustand   │  │   Services  │  │   Vite     │ │
│  │ Components  │  │   Store     │  │   Layer     │  │   Build    │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                │ HTTPS
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         API LAYER                                    │
│  ┌─────────────────────────┐     ┌─────────────────────────────┐   │
│  │    API Gateway v2       │     │   Lambda Function URLs      │   │
│  │    (REST endpoints)     │     │   (Streaming endpoints)     │   │
│  └─────────────────────────┘     └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      LAMBDA FUNCTIONS                                │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐│
│  │  Auth  │ │Sessions│ │Projects│ │ Files  │ │Artifacts│ │  Chat  ││
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘ └────────┘│
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────────┐   │
│  │  MCP Config    │  │ Memory Processor│  │   Common Layer     │   │
│  └────────────────┘  └────────────────┘  └────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                ▼               ▼               ▼
        ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
        │  DynamoDB   │ │     S3      │ │  Bedrock    │
        │  (Data)     │ │  (Files)    │ │  (Claude)   │
        └─────────────┘ └─────────────┘ └─────────────┘
```

### 5.2 Component Architecture

```
Frontend Components
├── App.jsx                    # Root component with routing
├── components/
│   ├── Auth/
│   │   └── LoginPage.jsx      # Login/register form
│   ├── Chat/
│   │   ├── ChatView.jsx       # Main chat interface
│   │   ├── ChatInput.jsx      # Message composition
│   │   ├── MessageBubble.jsx  # Individual message display
│   │   └── ThinkingSteps.jsx  # Extended thinking display
│   ├── Artifacts/
│   │   ├── ArtifactsPanel.jsx # Side panel for artifacts
│   │   ├── ArtifactViewer.jsx # Type-specific rendering
│   │   └── InlineArtifact.jsx # Inline artifact preview
│   ├── Project/
│   │   ├── ProjectDetailView.jsx  # Project workspace
│   │   └── ProjectsListPage.jsx   # Project listing
│   ├── ProjectSidebar/
│   │   └── Sidebar.jsx        # Navigation sidebar
│   └── InsightsBubble/
│       └── InsightsBubble.jsx # Knowledge curation widget
├── hooks/
│   ├── useChatStore.js        # Zustand store
│   └── useInsightsStore.js    # Insights state
├── services/
│   ├── chatService.js         # Chat API calls
│   ├── sessionsService.js     # Sessions API calls
│   ├── projectsService.js     # Projects API calls
│   ├── authService.js         # Auth API calls
│   └── insightsService.js     # Insights API calls
└── context/
    └── AuthContext.jsx        # Auth state provider
```

### 5.3 Lambda Function Structure

```
lambda/
├── functions/
│   ├── auth/
│   │   └── index.js           # Authentication handlers
│   ├── chat/
│   │   └── index.js           # Chat streaming handlers
│   ├── sessions/
│   │   └── index.js           # Session CRUD
│   ├── projects/
│   │   └── index.js           # Project & file management
│   ├── files/
│   │   └── index.js           # Presigned URL generation
│   ├── artifacts/
│   │   └── index.js           # Artifact CRUD
│   ├── mcp-config/
│   │   └── index.js           # MCP server configuration
│   └── memory-processor/
│       └── index.js           # Background memory updates
├── shared/
│   ├── bedrock.js             # Claude API wrapper
│   ├── s3.js                  # S3 operations
│   ├── authMiddleware.js      # JWT validation
│   ├── memoryExtractor.js     # Fact extraction
│   ├── embeddings.js          # Vector embeddings
│   └── vectors.js             # Vector search
└── layers/
    └── common/
        └── package.json       # Shared dependencies
```

---

## 6. Data Models

### 6.1 DynamoDB Tables

#### 6.1.1 USERS Table

```
Primary Key: userId (S)
GSI: username-index (username → userId)
GSI: email-index (email → userId)

{
  "userId": "string (nanoid)",
  "username": "string (unique)",
  "email": "string (unique)",
  "passwordHash": "string (bcrypt)",
  "role": "user | admin",
  "createdAt": "number (timestamp)",
  "updatedAt": "number (timestamp)"
}
```

#### 6.1.2 SESSIONS Table

```
Primary Key: userId (S), sessionId (S)
GSI: userId-updatedAt-index (for listing by recency)
GSI: projectId-updatedAt-index (for project scoping)

{
  "userId": "string",
  "sessionId": "string (session_<timestamp>)",
  "title": "string (auto-generated)",
  "starred": "boolean",
  "projectId": "string (optional)",
  "createdAt": "number (timestamp)",
  "updatedAt": "number (timestamp)"
}
```

#### 6.1.3 MESSAGES Table

```
Primary Key: sessionId (S), messageId (S)

{
  "sessionId": "string",
  "messageId": "string (msg_<nanoid>)",
  "role": "user | assistant",
  "content": "string",
  "thinking": "string (optional)",
  "files": [
    {
      "name": "string",
      "type": "string (mime)",
      "size": "number",
      "s3Key": "string"
    }
  ],
  "timestamp": "number"
}
```

#### 6.1.4 PROJECTS Table

```
Primary Key: userId (S), projectId (S)
GSI: userId-lastActivityAt-index

{
  "userId": "string",
  "projectId": "string (proj_<timestamp>)",
  "name": "string",
  "description": "string",
  "instructions": "string (system prompt)",
  "status": "active | archived",
  "model": "haiku | sonnet | opus",
  "pinnedTokens": "number",
  "chatCount": "number",
  "fileCount": "number",
  "lastActivityAt": "number (timestamp)",
  "createdAt": "number (timestamp)",
  "updatedAt": "number (timestamp)"
}
```

#### 6.1.5 PROJECT_FILES Table

```
Primary Key: projectId (S), fileId (S)
GSI: projectId-pinned-index

{
  "projectId": "string",
  "fileId": "string (file_<nanoid>)",
  "name": "string",
  "type": "string (mime type)",
  "size": "number (bytes)",
  "s3Key": "string",
  "pinned": "boolean",
  "tokenCount": "number",
  "processingStatus": "complete | processing | error",
  "summary": "string (optional)",
  "description": "string (optional)",
  "createdAt": "number (timestamp)"
}
```

#### 6.1.6 PROJECT_MEMORY Table

```
Primary Key: projectId (S), version (N)

{
  "projectId": "string",
  "version": "number (auto-increment)",
  "current": "boolean",
  "sections": {
    "purposeContext": "string",
    "currentState": "string",
    "onTheHorizon": "string",
    "keyLearnings": "string",
    "approachPatterns": "string",
    "toolsResources": "string"
  },
  "generatedAt": "number (timestamp)",
  "tokenCount": "number",
  "autoGenerated": "boolean"
}
```

#### 6.1.7 ARTIFACTS Table

```
Primary Key: sessionId (S), artifactId (S)
GSI: userId-createdAt-index

{
  "sessionId": "string",
  "artifactId": "string (art_<hash>)",
  "userId": "string",
  "title": "string",
  "name": "string (with extension)",
  "type": "document | ui | diagram | react | data | code | config",
  "fileExtension": ".md | .html | .jsx | etc",
  "contentType": "text/markdown | text/html | etc",
  "renderable": "boolean",
  "s3Key": "string",
  "description": "string (optional)",
  "tags": ["string"],
  "visibility": "private | shared",
  "version": "number",
  "size": "number (bytes)",
  "createdAt": "number (timestamp)",
  "updatedAt": "number (timestamp)"
}
```

#### 6.1.8 SUMMARIES Table (Cache)

```
Primary Key: sessionId (S)
TTL: 7 days

{
  "sessionId": "string",
  "summary": "string",
  "keyPoints": "string",
  "tokenCount": "number",
  "updatedAt": "number (timestamp)",
  "ttl": "number (epoch + 604800)"
}
```

#### 6.1.9 MCP_CONFIGS Table

```
Primary Key: userId (S), serverId (S)

{
  "userId": "string",
  "serverId": "string (mcp_<nanoid>)",
  "name": "string",
  "url": "string",
  "icon": "string (emoji)",
  "description": "string",
  "type": "url | process",
  "enabled": "boolean",
  "createdAt": "number (timestamp)",
  "updatedAt": "number (timestamp)"
}
```

### 6.2 S3 Bucket Structure

#### 6.2.1 UPLOADS_BUCKET

```
projects/
  {projectId}/
    {fileId}.{ext}           # Project files

sessions/
  {sessionId}/
    {timestamp}-{filename}   # Chat file uploads
```

#### 6.2.2 ARTIFACTS_BUCKET

```
{userId}/
  {sessionId}/
    {artifactId}.{ext}       # Generated artifacts
```

#### 6.2.3 VECTORS_BUCKET (Optional)

```
projects/
  {projectId}/
    memories/
      {memoryId}.json        # Memory embeddings
    conversations/
      {sessionId}.json       # Conversation embeddings
```

---

## 7. API Specification

### 7.1 Authentication Endpoints

#### POST /api/auth/register
Create a new user account.

**Request:**
```json
{
  "username": "string (3-50 chars, alphanumeric)",
  "email": "string (valid email)",
  "password": "string (min 8 chars)"
}
```

**Response (201):**
```json
{
  "user": {
    "userId": "string",
    "username": "string",
    "email": "string",
    "role": "user"
  },
  "token": "string (JWT)"
}
```

#### POST /api/auth/login
Authenticate user and issue JWT.

**Request:**
```json
{
  "username": "string (or email)",
  "password": "string"
}
```

**Response (200):**
```json
{
  "user": {
    "userId": "string",
    "username": "string",
    "email": "string",
    "role": "string"
  },
  "token": "string (JWT)"
}
```

**Cookies Set:**
- `atlas_token` - JWT token (HttpOnly, Secure in production)

#### POST /api/auth/logout
Clear authentication session.

**Response (200):**
```json
{
  "message": "Logged out successfully"
}
```

#### POST /api/auth/verify
Verify JWT token validity.

**Headers:**
- `Authorization: Bearer <token>` OR
- Cookie: `atlas_token=<token>`

**Response (200):**
```json
{
  "valid": true,
  "user": {
    "userId": "string",
    "username": "string",
    "email": "string",
    "role": "string"
  }
}
```

#### GET /api/auth/me
Get current user profile.

**Response (200):**
```json
{
  "userId": "string",
  "username": "string",
  "email": "string",
  "role": "string",
  "createdAt": "number"
}
```

---

### 7.2 Chat Endpoints

#### POST /api/chat/message/stream
Stream a chat message (Lambda Response Streaming).

**Request:**
```json
{
  "message": "string",
  "session_id": "string (optional - creates new if omitted)",
  "project_id": "string (optional)",
  "model": "haiku | sonnet | opus",
  "web_search_enabled": "boolean",
  "extended_thinking_enabled": "boolean",
  "knowledge_core_enabled": "boolean",
  "enabled_connectors": ["confluence", "jira", "gitlab"],
  "existing_artifacts": [
    { "id": "string", "title": "string", "type": "string" }
  ],
  "files": [
    {
      "name": "string",
      "type": "string (mime)",
      "base64": "string (base64 encoded)"
    }
  ]
}
```

**Response:** Server-Sent Events stream (see Section 4.1.3)

---

### 7.3 Sessions Endpoints

#### GET /api/sessions
List user's chat sessions.

**Query Parameters:**
- `limit` - Max results (default: 50)
- `projectId` - Filter by project
- `starred` - Filter starred only

**Response (200):**
```json
{
  "sessions": [
    {
      "sessionId": "string",
      "title": "string",
      "starred": "boolean",
      "projectId": "string | null",
      "createdAt": "number",
      "updatedAt": "number"
    }
  ]
}
```

#### GET /api/sessions/:sessionId
Get session details.

**Response (200):**
```json
{
  "sessionId": "string",
  "title": "string",
  "starred": "boolean",
  "projectId": "string | null",
  "createdAt": "number",
  "updatedAt": "number"
}
```

#### GET /api/sessions/:sessionId/messages
Get session messages.

**Response (200):**
```json
{
  "messages": [
    {
      "messageId": "string",
      "role": "user | assistant",
      "content": "string",
      "thinking": "string | null",
      "files": [],
      "timestamp": "number"
    }
  ]
}
```

#### POST /api/sessions
Create new session.

**Request:**
```json
{
  "title": "string (optional)",
  "projectId": "string (optional)"
}
```

**Response (201):**
```json
{
  "sessionId": "string",
  "title": "string",
  "createdAt": "number"
}
```

#### PUT /api/sessions/:sessionId
Update session.

**Request:**
```json
{
  "title": "string (optional)",
  "starred": "boolean (optional)",
  "projectId": "string (optional)"
}
```

**Response (200):**
```json
{
  "sessionId": "string",
  "title": "string",
  "starred": "boolean",
  "projectId": "string | null",
  "updatedAt": "number"
}
```

#### DELETE /api/sessions/:sessionId
Delete session and all messages.

**Response (200):**
```json
{
  "message": "Session deleted"
}
```

---

### 7.4 Projects Endpoints

#### GET /api/projects
List user's projects.

**Query Parameters:**
- `status` - Filter by status (active, archived)
- `sort` - Sort field (lastActivityAt, createdAt, name)

**Response (200):**
```json
{
  "projects": [
    {
      "projectId": "string",
      "name": "string",
      "description": "string",
      "status": "active | archived",
      "chatCount": "number",
      "fileCount": "number",
      "lastActivityAt": "number",
      "createdAt": "number"
    }
  ]
}
```

#### POST /api/projects
Create new project.

**Request:**
```json
{
  "name": "string",
  "description": "string (optional)",
  "instructions": "string (optional)"
}
```

**Response (201):**
```json
{
  "projectId": "string",
  "name": "string",
  "createdAt": "number"
}
```

#### GET /api/projects/:projectId
Get project details.

**Response (200):**
```json
{
  "projectId": "string",
  "name": "string",
  "description": "string",
  "instructions": "string",
  "status": "string",
  "model": "string",
  "pinnedTokens": "number",
  "chatCount": "number",
  "fileCount": "number",
  "lastActivityAt": "number",
  "createdAt": "number",
  "updatedAt": "number"
}
```

#### PUT /api/projects/:projectId
Update project.

**Request:**
```json
{
  "name": "string (optional)",
  "description": "string (optional)",
  "instructions": "string (optional)",
  "status": "active | archived (optional)",
  "model": "haiku | sonnet | opus (optional)"
}
```

#### DELETE /api/projects/:projectId
Delete project and all associated data.

**Response (200):**
```json
{
  "message": "Project deleted"
}
```

#### GET /api/projects/:projectId/files
List project files.

**Response (200):**
```json
{
  "files": [
    {
      "fileId": "string",
      "name": "string",
      "type": "string",
      "size": "number",
      "pinned": "boolean",
      "tokenCount": "number",
      "createdAt": "number"
    }
  ]
}
```

#### POST /api/projects/:projectId/files
Upload file to project.

**Request (multipart/form-data):**
- `file` - File binary

**Response (201):**
```json
{
  "fileId": "string",
  "name": "string",
  "size": "number"
}
```

#### PUT /api/projects/:projectId/files/:fileId/pin
Toggle file pin status.

**Request:**
```json
{
  "pinned": "boolean"
}
```

#### DELETE /api/projects/:projectId/files/:fileId
Delete file from project.

#### GET /api/projects/:projectId/memory
Get current project memory.

**Response (200):**
```json
{
  "version": "number",
  "sections": {
    "purposeContext": "string",
    "currentState": "string",
    "onTheHorizon": "string",
    "keyLearnings": "string",
    "approachPatterns": "string",
    "toolsResources": "string"
  },
  "tokenCount": "number",
  "generatedAt": "number"
}
```

#### PUT /api/projects/:projectId/memory
Update project memory sections.

**Request:**
```json
{
  "sections": {
    "purposeContext": "string (optional)",
    "currentState": "string (optional)",
    "onTheHorizon": "string (optional)",
    "keyLearnings": "string (optional)",
    "approachPatterns": "string (optional)",
    "toolsResources": "string (optional)"
  }
}
```

#### GET /api/projects/:projectId/chats
List project chat sessions.

**Response (200):**
```json
{
  "chats": [
    {
      "sessionId": "string",
      "title": "string",
      "createdAt": "number",
      "updatedAt": "number"
    }
  ]
}
```

---

### 7.5 Artifacts Endpoints

#### GET /api/artifacts
List all user artifacts.

**Query Parameters:**
- `sessionId` - Filter by session
- `type` - Filter by artifact type
- `limit` - Max results

**Response (200):**
```json
{
  "artifacts": [
    {
      "artifactId": "string",
      "sessionId": "string",
      "title": "string",
      "type": "string",
      "version": "number",
      "createdAt": "number"
    }
  ]
}
```

#### GET /api/artifacts/:artifactId
Get artifact metadata.

**Response (200):**
```json
{
  "artifactId": "string",
  "title": "string",
  "type": "string",
  "fileExtension": "string",
  "version": "number",
  "size": "number",
  "createdAt": "number"
}
```

#### GET /api/artifacts/:artifactId/content
Get artifact content.

**Response (200):**
```
<artifact content as text>
```

#### GET /api/sessions/:sessionId/artifacts
List artifacts for a session.

**Response (200):**
```json
{
  "artifacts": [
    {
      "artifactId": "string",
      "title": "string",
      "type": "string",
      "version": "number"
    }
  ]
}
```

---

### 7.6 Files Endpoints

#### POST /api/files/presign
Get presigned URL for file upload.

**Request:**
```json
{
  "filename": "string",
  "contentType": "string (mime type)",
  "sessionId": "string (optional)",
  "purpose": "upload | artifact"
}
```

**Response (200):**
```json
{
  "uploadUrl": "string (presigned S3 URL)",
  "key": "string (S3 object key)",
  "bucket": "string",
  "expiresIn": 3600
}
```

#### GET /api/files/download/:fileKey
Get presigned download URL.

**Response (200):**
```json
{
  "downloadUrl": "string (presigned S3 URL)",
  "expiresIn": 3600
}
```

---

## 8. User Interface Specifications

### 8.1 Layout Structure

```
┌────────────────────────────────────────────────────────────────────┐
│                              HEADER                                 │
│  ┌──────────────────────────────────────────────────────────────┐ │
│  │ [Logo] [Project Name]           [Session Title] [Settings ▾] │ │
│  └──────────────────────────────────────────────────────────────┘ │
├────────────┬───────────────────────────────────┬───────────────────┤
│            │                                   │                   │
│  SIDEBAR   │         MAIN CONTENT              │  ARTIFACTS PANEL  │
│            │                                   │   (collapsible)   │
│  - New Chat│  ┌─────────────────────────────┐ │                   │
│  - Projects│  │                             │ │  ┌─────────────┐ │
│  - Artifacts│ │      MESSAGE BUBBLES        │ │  │   VIEWER    │ │
│  - Recents │  │                             │ │  │             │ │
│            │  │                             │ │  │  [Preview]  │ │
│  [Session  │  │                             │ │  │  [Source]   │ │
│   List]    │  └─────────────────────────────┘ │  │             │ │
│            │  ┌─────────────────────────────┐ │  └─────────────┘ │
│            │  │        CHAT INPUT           │ │  [Artifact List] │
│            │  │ [Attach] [Model] [Send]     │ │                   │
│            │  └─────────────────────────────┘ │                   │
├────────────┴───────────────────────────────────┴───────────────────┤
│                         [Insights Bubble]                          │
└────────────────────────────────────────────────────────────────────┘
```

### 8.2 Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|------------|-------|----------------|
| Mobile | < 768px | Sidebar collapsed, full-width chat, artifacts as modal |
| Tablet | 768-1024px | Narrow sidebar, chat expands, artifacts as overlay |
| Desktop | > 1024px | Full sidebar, chat with artifacts panel side-by-side |

### 8.3 Color Palette

#### Dark Mode (Default)
```css
--bg-primary: #1a1a2e;
--bg-secondary: #16213e;
--bg-tertiary: #0f3460;
--text-primary: #e8e8e8;
--text-secondary: #b8b8b8;
--text-muted: #888888;
--border-color: rgba(255, 255, 255, 0.1);
--accent-primary: #4a90d9;
--accent-secondary: #64b5f6;
--bg-user-bubble: #2d4a3e;
```

#### Light Mode
```css
--bg-primary: #ffffff;
--bg-secondary: #f5f5f5;
--bg-tertiary: #e8e8e8;
--text-primary: #1a1a1a;
--text-secondary: #4a4a4a;
--text-muted: #888888;
--border-color: rgba(0, 0, 0, 0.1);
--accent-primary: #1976d2;
--accent-secondary: #42a5f5;
--bg-user-bubble: #e3f2fd;
```

### 8.4 Key UI Components

#### 8.4.1 Message Bubble
- User messages: Right-aligned, accent background
- Assistant messages: Left-aligned, secondary background
- Timestamps on hover
- Copy button on hover
- File attachments shown as chips
- Inline artifacts with preview

#### 8.4.2 Chat Input
- Multi-line text area (auto-expand)
- File attachment button (opens file picker)
- Model selector dropdown
- Extended thinking toggle
- Web search toggle
- Knowledge Core toggle
- Send button (disabled when empty)
- Character/token count indicator

#### 8.4.3 Artifacts Panel
- Tab bar for multiple artifacts
- Type badge (HTML, Markdown, etc.)
- Preview/Source toggle
- Copy button
- Download button
- Fullscreen button
- Close button
- Version indicator

#### 8.4.4 Sidebar
- Collapsible (hamburger button)
- New Chat button (prominent)
- Projects section with count
- Artifacts section
- Recent sessions list
- Search/filter input
- User profile at bottom

---

## 9. Security Requirements

### 9.1 Authentication Security

| Requirement | Implementation |
|-------------|----------------|
| Password Storage | bcrypt with 12 rounds |
| Token Algorithm | HS256 |
| Token Expiry | 10 hours |
| Token Storage | HttpOnly cookies |
| CSRF Protection | SameSite cookie attribute |

### 9.2 Data Protection

| Requirement | Implementation |
|-------------|----------------|
| Encryption at Rest | S3 SSE-S3, DynamoDB encryption |
| Encryption in Transit | TLS 1.2+ (HTTPS only) |
| Data Isolation | userId partition key on all tables |
| File Access | Presigned URLs (1-hour expiry) |

### 9.3 API Security

| Requirement | Implementation |
|-------------|----------------|
| Authentication | JWT Bearer token or cookie |
| Authorization | User can only access own data |
| Input Validation | Schema validation on all inputs |
| Rate Limiting | API Gateway throttling |
| CORS | Explicit origin whitelist |

### 9.4 Sensitive Data Handling

- Passwords: Never logged, never returned in API responses
- Tokens: HttpOnly cookies, not accessible via JavaScript
- File contents: Streamed directly from S3, not stored in Lambda memory
- API keys: Environment variables, not in code

---

## 10. Performance Requirements

### 10.1 Latency Targets

| Operation | Target | Maximum |
|-----------|--------|---------|
| Lambda cold start | < 2s | 5s |
| Chat first token | < 3s | 8s |
| Chat streaming | Continuous | No gaps > 1s |
| Page load (cached) | < 1s | 2s |
| API response | < 500ms | 2s |

### 10.2 Throughput Targets

| Metric | Target |
|--------|--------|
| Concurrent users | 100+ |
| Messages per second | 50+ |
| File uploads | 10 concurrent |
| Artifact renders | 5 simultaneous |

### 10.3 Resource Limits

| Resource | Limit |
|----------|-------|
| File upload size | 100 MB (zip), 50 MB (other) |
| Message length | 100,000 characters |
| Session messages | 1,000 per session |
| Project files | 100 per project |
| Artifacts per session | 50 |

### 10.4 Caching Strategy

| Cache | TTL | Purpose |
|-------|-----|---------|
| Conversation summaries | 7 days | Reduce compaction cost |
| Project memory | Until updated | Avoid regeneration |
| Static assets | 1 year | CDN performance |
| API responses | None | Real-time data |

---

## 11. Deployment & Infrastructure

### 11.1 AWS Services Used

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Lambda | Compute | Node.js 20.x, 256-1024 MB |
| API Gateway | REST API | HTTP API v2 |
| DynamoDB | Database | On-demand billing |
| S3 | File storage | Standard tier |
| CloudFront | CDN | Frontend distribution |
| Bedrock | AI | Claude models |
| IAM | Security | Least-privilege roles |

### 11.2 Environment Variables

```bash
# Required
AWS_REGION=us-east-1
JWT_SECRET=<random-32-char-string>
CORS_ORIGIN=https://your-domain.com

# DynamoDB Tables
SESSIONS_TABLE=atlas-sessions
MESSAGES_TABLE=atlas-messages
PROJECTS_TABLE=atlas-projects
PROJECT_FILES_TABLE=atlas-project-files
PROJECT_MEMORY_TABLE=atlas-project-memory
ARTIFACTS_TABLE=atlas-artifacts
SUMMARIES_TABLE=atlas-summaries
MCP_CONFIGS_TABLE=atlas-mcp-configs
USERS_TABLE=atlas-users

# S3 Buckets
UPLOADS_BUCKET=atlas-uploads
ARTIFACTS_BUCKET=atlas-artifacts

# Optional
NEO4J_URL=bolt://localhost:7687
OPENSEARCH_URL=http://localhost:9200
KNOWLEDGE_CORE_ENABLED=false
```

### 11.3 Terraform Resources

```hcl
# main.tf - Provider and locals
# variables.tf - Input variables
# dynamodb.tf - Table definitions
# s3.tf - Bucket configurations
# lambda.tf - Function definitions
# api-gateway.tf - API Gateway setup
# iam.tf - IAM roles and policies
# outputs.tf - Output values
```

### 11.4 Deployment Steps

1. **Prerequisites:**
   ```bash
   # Install dependencies
   npm install

   # Configure AWS credentials
   aws configure
   ```

2. **Build Lambda packages:**
   ```bash
   cd lambda
   chmod +x build-lambdas.sh
   ./build-lambdas.sh
   ```

3. **Deploy infrastructure:**
   ```bash
   cd terraform
   terraform init
   terraform plan -out=tfplan
   terraform apply tfplan
   ```

4. **Deploy frontend:**
   ```bash
   cd frontend
   npm run build
   aws s3 sync dist/ s3://your-frontend-bucket
   ```

### 11.5 Cost Estimation

| Service | Monthly (Low Usage) | Monthly (High Usage) |
|---------|---------------------|----------------------|
| Lambda | $0 (free tier) | $5 |
| API Gateway | $0 (free tier) | $3.50 |
| DynamoDB | $0 (free tier) | $10 |
| S3 | $0.50 | $5 |
| CloudFront | $0 (free tier) | $10 |
| Bedrock (Claude) | $5 | $100+ |
| **Total** | **~$5** | **~$130+** |

---

## 12. Known Limitations & Future Roadmap

### 12.1 Current Limitations

| Limitation | Impact | Workaround |
|------------|--------|------------|
| Single-user sessions | No real-time collaboration | Export/share artifacts |
| No offline mode | Requires internet | N/A |
| Lambda cold starts | Initial latency | Provisioned concurrency |
| 200K token limit | Long conversations truncated | Compaction |
| No mobile app | Desktop-only | Responsive web |

### 12.2 Known Issues

| Issue | Status | Notes |
|-------|--------|-------|
| Mermaid render errors with corrupted content | Backend fix pending deployment | Frontend safeguards applied |
| Insights API CORS errors | Not deployed | Knowledge Core optional |
| Duplicate content during streaming | Frontend fix applied | Backend fix pending |

### 12.3 Future Roadmap

#### Phase 1: Stability (Current)
- [x] Core chat functionality
- [x] Artifact generation and rendering
- [x] Project management
- [x] Authentication
- [ ] Deploy backend fixes
- [ ] Complete Knowledge Core integration

#### Phase 2: Enhancement
- [ ] Vector database integration (full semantic search)
- [ ] Improved artifact renderers
- [ ] Export to PDF/markdown
- [ ] Usage analytics dashboard
- [ ] Model fine-tuning support

#### Phase 3: Collaboration
- [ ] Multi-user projects
- [ ] Real-time collaborative editing
- [ ] Comments and annotations
- [ ] Team workspaces
- [ ] SSO integration (SAML/OIDC)

#### Phase 4: Enterprise
- [ ] On-premise deployment option
- [ ] Advanced security controls
- [ ] Audit logging
- [ ] Custom model deployment
- [ ] Plugin/extension architecture

---

## Appendix A: Glossary

| Term | Definition |
|------|------------|
| **Artifact** | Claude-generated content (code, documents, diagrams) |
| **Compaction** | Process of summarizing conversation to reduce tokens |
| **Knowledge Core** | Enterprise knowledge repository for artifacts |
| **MCP** | Model Context Protocol - extensible integration framework |
| **Project Memory** | Synthesized knowledge base for a project |
| **Session** | A single conversation thread |
| **Token** | Unit of text for LLM processing (~4 characters) |

---

## Appendix B: API Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| AUTH_REQUIRED | 401 | No valid authentication token |
| AUTH_INVALID | 401 | Token expired or invalid |
| FORBIDDEN | 403 | User lacks permission |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid request payload |
| RATE_LIMITED | 429 | Too many requests |
| SERVER_ERROR | 500 | Internal server error |
| BEDROCK_ERROR | 502 | AI model error |

---

## Appendix C: Model Specifications

| Model | ID | Strengths | Cost (per 1M tokens) |
|-------|-----|-----------|---------------------|
| Haiku | claude-haiku-4-5 | Fast, cost-effective | $0.80 |
| Sonnet | claude-sonnet-4-5 | Balanced performance | $3.00 |
| Opus | claude-opus-4-5 | Maximum capability | $15.00 |

---

## Document History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | 2026-01-15 | Atlas Team | Initial PRD |

---

*This document is maintained as part of the Atlas Platform repository.*

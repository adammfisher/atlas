# Atlas Web - Product Requirements Document (PRD)

## Document Information

| Field | Value |
|-------|-------|
| Product Name | Atlas Web |
| Version | 1.0 |
| Last Updated | January 2026 |
| Status | In Production |
| Owner | Adam Fisher |

---

## 1. Executive Summary

### 1.1 Product Vision

Atlas is an enterprise AI research assistant platform that provides developers and knowledge workers with a powerful, context-aware conversational AI interface. Unlike consumer AI chat products, Atlas is designed for **persistent, project-based work** where context accumulates over time and artifacts are generated, refined, and reused.

### 1.2 Problem Statement

Knowledge workers face several challenges with existing AI assistants:

1. **Context Loss**: Consumer AI chats lose context between sessions, requiring users to re-explain their projects repeatedly.

2. **Artifact Management**: Generated code, documents, and diagrams are lost in chat history, making them difficult to find and reuse.

3. **Project Isolation**: Work on different projects gets mixed together, creating confusion and reducing AI effectiveness.

4. **Enterprise Integration**: Consumer tools lack integration with enterprise knowledge bases, documentation, and security requirements.

5. **Memory Limitations**: AI assistants don't remember user preferences, past decisions, or project-specific patterns.

### 1.3 Solution Overview

Atlas addresses these challenges through:

- **Project-Based Organization**: Persistent workspaces with dedicated files, memory, and conversation history
- **Semantic Memory System**: AI that remembers facts, decisions, and preferences across sessions
- **Artifact Generation & Management**: First-class support for creating, viewing, and managing generated content
- **Enterprise Knowledge Core Integration**: Connection to organizational knowledge graphs and documentation
- **Thin Client Architecture**: All processing happens server-side, enabling unlimited context assembly

---

## 2. Target Users

### 2.1 Primary Personas

#### Software Developer
- **Role**: Individual contributor writing code
- **Needs**: Code generation, debugging help, architecture discussions, documentation
- **Pain Points**: Losing context when switching between projects, re-explaining codebase structure
- **Usage Pattern**: Daily, multiple sessions, long-running projects

#### Technical Lead / Architect
- **Role**: Designs systems, reviews code, makes technical decisions
- **Needs**: Architecture diagrams, ADR creation, code review assistance, pattern documentation
- **Pain Points**: Documenting decisions, sharing context with team members
- **Usage Pattern**: Weekly strategic sessions, quick reference lookups

#### Product Manager
- **Role**: Defines requirements, writes specifications
- **Needs**: PRD generation, feature analysis, competitive research
- **Pain Points**: Maintaining consistency across documents, tracking decisions
- **Usage Pattern**: Burst usage during planning cycles

### 2.2 Secondary Personas

#### Data Analyst
- **Needs**: Query generation, data interpretation, visualization creation
- **Usage**: Ad-hoc analysis sessions

#### Technical Writer
- **Needs**: Documentation generation, content editing, diagram creation
- **Usage**: Document creation and refinement workflows

---

## 3. Feature Requirements

### 3.1 Core Chat Experience

#### 3.1.1 Conversational AI (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-CHAT-001 | Users can send text messages and receive AI responses | Implemented |
| REQ-CHAT-002 | Responses stream in real-time with visible progress | Implemented |
| REQ-CHAT-003 | Users can attach files (images, code, documents) to messages | Implemented |
| REQ-CHAT-004 | File content is processed and understood by AI | Implemented |
| REQ-CHAT-005 | Conversation history persists across browser sessions | Implemented |
| REQ-CHAT-006 | Users can stop generation mid-stream | Implemented |
| REQ-CHAT-007 | Web search is available for current information | Implemented |

#### 3.1.2 Session Management (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-SESSION-001 | Users can create new chat sessions | Implemented |
| REQ-SESSION-002 | Sessions have auto-generated titles from first message | Implemented |
| REQ-SESSION-003 | Users can rename sessions | Implemented |
| REQ-SESSION-004 | Users can star/favorite sessions | Implemented |
| REQ-SESSION-005 | Users can delete sessions | Implemented |
| REQ-SESSION-006 | Recent sessions appear in sidebar | Implemented |
| REQ-SESSION-007 | Sessions can be associated with projects | Implemented |

### 3.2 Project System

#### 3.2.1 Project Management (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-PROJ-001 | Users can create named projects | Implemented |
| REQ-PROJ-002 | Projects have descriptions | Implemented |
| REQ-PROJ-003 | Users can archive/delete projects | Implemented |
| REQ-PROJ-004 | Projects appear in sidebar navigation | Implemented |
| REQ-PROJ-005 | Clicking project opens project detail view | Implemented |
| REQ-PROJ-006 | Projects show last activity timestamp | Implemented |

#### 3.2.2 Project Files (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-FILE-001 | Users can upload files to projects | Implemented |
| REQ-FILE-002 | Supported formats: text, code, images, PDF, DOCX | Implemented |
| REQ-FILE-003 | ZIP files are automatically extracted | Implemented |
| REQ-FILE-004 | Users can pin important files | Implemented |
| REQ-FILE-005 | Pinned files are included in chat context | Implemented |
| REQ-FILE-006 | Users can preview file contents | Implemented |
| REQ-FILE-007 | Users can delete files | Implemented |
| REQ-FILE-008 | File list shows size, type, upload date | Implemented |

#### 3.2.3 Project Memory (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-MEM-001 | Projects have synthesized memory sections | Implemented |
| REQ-MEM-002 | Memory includes: purpose, current state, horizon, learnings, patterns, tools | Implemented |
| REQ-MEM-003 | Memory can be manually edited | Implemented |
| REQ-MEM-004 | Memory can be auto-regenerated from conversations | Implemented |
| REQ-MEM-005 | Memory is versioned for rollback | Implemented |
| REQ-MEM-006 | Memory is automatically included in chat context | Implemented |

#### 3.2.4 Semantic Memory (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-SEM-001 | Facts are auto-extracted from conversations | Implemented |
| REQ-SEM-002 | Facts are categorized (decision, preference, technical, etc.) | Implemented |
| REQ-SEM-003 | Semantic search retrieves relevant facts | Implemented |
| REQ-SEM-004 | Users can manually add memories | Implemented |
| REQ-SEM-005 | Users can edit/delete memories | Implemented |
| REQ-SEM-006 | Global memories work for non-project chats | Implemented |

### 3.3 Artifact System

#### 3.3.1 Artifact Generation (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-ART-001 | AI can generate artifacts (code, docs, diagrams) | Implemented |
| REQ-ART-002 | Artifacts appear inline during streaming | Implemented |
| REQ-ART-003 | Artifact panel shows full content | Implemented |
| REQ-ART-004 | Users can copy artifact content | Implemented |
| REQ-ART-005 | Users can download artifacts | Implemented |
| REQ-ART-006 | Artifacts persist with session | Implemented |

#### 3.3.2 Artifact Types (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-TYPE-001 | Markdown with full GFM support | Implemented |
| REQ-TYPE-002 | Code with syntax highlighting | Implemented |
| REQ-TYPE-003 | HTML with sandboxed preview | Implemented |
| REQ-TYPE-004 | SVG diagrams | Implemented |
| REQ-TYPE-005 | Mermaid diagrams (auto-rendered) | Implemented |
| REQ-TYPE-006 | JSON with tree viewer | Implemented |
| REQ-TYPE-007 | CSV with table display | Implemented |
| REQ-TYPE-008 | React/JSX components | Implemented |

#### 3.3.3 Artifact Management (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-ARTMGMT-001 | All artifacts page lists all user artifacts | Implemented |
| REQ-ARTMGMT-002 | Artifacts searchable by title | Planned |
| REQ-ARTMGMT-003 | Artifacts filterable by type | Planned |
| REQ-ARTMGMT-004 | Save artifact to project files | Implemented |
| REQ-ARTMGMT-005 | Share artifact to Knowledge Core | Implemented |

### 3.4 Authentication & Users

#### 3.4.1 Authentication (P0 - Critical)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-AUTH-001 | Username/password login | Implemented |
| REQ-AUTH-002 | JWT-based session management | Implemented |
| REQ-AUTH-003 | 10-hour session duration | Implemented |
| REQ-AUTH-004 | Automatic redirect to login on expiry | Implemented |
| REQ-AUTH-005 | Secure password hashing (bcrypt) | Implemented |
| REQ-AUTH-006 | Data isolation between users | Implemented |

#### 3.4.2 User Management (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-USER-001 | Admin can create new users | Implemented |
| REQ-USER-002 | Users have display names | Implemented |
| REQ-USER-003 | Role-based access (admin/user) | Implemented |
| REQ-USER-004 | User profile in sidebar | Implemented |

### 3.5 Settings & Preferences

#### 3.5.1 Appearance (P2 - Nice to Have)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-UI-001 | Dark/light/auto color mode | Implemented |
| REQ-UI-002 | Font selection for chat | Implemented |
| REQ-UI-003 | Resizable artifact panel | Implemented |

#### 3.5.2 AI Settings (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-AI-001 | Toggle web search on/off | Implemented |
| REQ-AI-002 | Toggle Knowledge Core on/off | Implemented |
| REQ-AI-003 | Model selection (when multiple available) | Implemented |

#### 3.5.3 MCP Integration (P2 - Nice to Have)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-MCP-001 | Configure external MCP servers | Implemented |
| REQ-MCP-002 | List available MCP tools | Implemented |
| REQ-MCP-003 | Enable/disable servers per user | Implemented |

### 3.6 Knowledge Core Integration

#### 3.6.1 Knowledge Retrieval (P1 - Important)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-KC-001 | Query artifacts from Knowledge Core | Implemented |
| REQ-KC-002 | Query ADRs from Knowledge Core | Implemented |
| REQ-KC-003 | Context is visible before Claude sees it | Implemented |
| REQ-KC-004 | Toggle Knowledge Core per message | Implemented |

#### 3.6.2 Knowledge Sharing (P2 - Nice to Have)

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-SHARE-001 | Share artifacts to Knowledge Core | Implemented |
| REQ-SHARE-002 | Track shared vs local artifacts | Implemented |
| REQ-SHARE-003 | Insights bubble shows shareable content | Implemented |

---

## 4. Non-Functional Requirements

### 4.1 Performance

| Requirement | Target | Status |
|-------------|--------|--------|
| NFR-PERF-001 | Chat response starts within 2 seconds | Met |
| NFR-PERF-002 | Page load under 3 seconds | Met |
| NFR-PERF-003 | Artifact render under 500ms | Met |
| NFR-PERF-004 | Session switch under 1 second | Met |
| NFR-PERF-005 | File upload starts within 1 second | Met |

### 4.2 Scalability

| Requirement | Target | Status |
|-------------|--------|--------|
| NFR-SCALE-001 | Support 100 concurrent users | Met |
| NFR-SCALE-002 | 1000+ messages per session | Met |
| NFR-SCALE-003 | 100+ files per project | Met |
| NFR-SCALE-004 | No degradation with large contexts | Met |

### 4.3 Reliability

| Requirement | Target | Status |
|-------------|--------|--------|
| NFR-REL-001 | 99.9% API availability | Target |
| NFR-REL-002 | No data loss on errors | Met |
| NFR-REL-003 | Graceful degradation on service failure | Met |
| NFR-REL-004 | Automatic session recovery | Met |

### 4.4 Security

| Requirement | Target | Status |
|-------------|--------|--------|
| NFR-SEC-001 | All data encrypted in transit (HTTPS) | Met |
| NFR-SEC-002 | Passwords hashed with bcrypt (12 rounds) | Met |
| NFR-SEC-003 | JWT tokens with 10-hour expiry | Met |
| NFR-SEC-004 | User data isolation at query level | Met |
| NFR-SEC-005 | No PII in logs | Met |
| NFR-SEC-006 | Secure file upload (presigned URLs) | Met |

### 4.5 Usability

| Requirement | Target | Status |
|-------------|--------|--------|
| NFR-UX-001 | Mobile-responsive layout | Partial |
| NFR-UX-002 | Keyboard shortcuts | Planned |
| NFR-UX-003 | Accessible (WCAG 2.1 AA) | Partial |
| NFR-UX-004 | Intuitive navigation | Met |

---

## 5. Technical Constraints

### 5.1 Architecture Constraints

| Constraint | Rationale |
|------------|-----------|
| Thin client architecture | Enables unlimited context assembly server-side |
| AWS-only infrastructure | Leverages Bedrock, minimizes operational complexity |
| Single-region deployment (us-east-1) | Bedrock availability, cost optimization |
| Serverless-first | Pay-per-use, automatic scaling |

### 5.2 Technology Constraints

| Area | Constraint | Rationale |
|------|------------|-----------|
| Frontend | React 18 + Vite | Modern tooling, fast builds |
| Backend | Node.js 20 on Lambda | Bedrock SDK support, team expertise |
| Database | DynamoDB | Serverless, scales automatically |
| AI Model | Claude via Bedrock | Enterprise support, compliance |
| State | Zustand (not Redux) | Simpler, sufficient for needs |

### 5.3 Integration Constraints

| Integration | Constraint |
|-------------|------------|
| Identity | Internal JWT (no SSO yet) |
| Knowledge Core | Neo4j via MCP or direct |
| Search | Google News RSS (no API key) |
| File Processing | Client-side for images, server for documents |

---

## 6. User Stories

### 6.1 Chat & Sessions

**US-001: As a developer, I want to start a new conversation so that I can ask questions without prior context.**
- Acceptance: Click "New chat" creates empty session
- Acceptance: First message becomes session title

**US-002: As a developer, I want to resume previous conversations so that I can continue my work.**
- Acceptance: Sessions listed in sidebar
- Acceptance: Clicking session loads full history
- Acceptance: Can continue conversation

**US-003: As a user, I want to attach files to my message so that the AI can analyze them.**
- Acceptance: Drag-drop or click to upload
- Acceptance: Preview shows before sending
- Acceptance: AI references file content in response

**US-004: As a user, I want real-time streaming responses so that I don't wait for complete generation.**
- Acceptance: Text appears as generated
- Acceptance: Can see AI "thinking" indicator
- Acceptance: Can stop generation early

### 6.2 Projects

**US-010: As a developer, I want to create projects so that I can organize related work.**
- Acceptance: Create project with name and description
- Acceptance: Project appears in sidebar
- Acceptance: Can have multiple projects

**US-011: As a developer, I want to upload files to projects so that the AI remembers my codebase.**
- Acceptance: Upload multiple files at once
- Acceptance: ZIP extraction supported
- Acceptance: Files persist across sessions

**US-012: As a developer, I want to pin important files so that they're always in context.**
- Acceptance: Pin toggle on file card
- Acceptance: Pinned files show indicator
- Acceptance: AI mentions having access to pinned files

**US-013: As a user, I want project memory so that the AI remembers what we've discussed.**
- Acceptance: Memory sections visible in project view
- Acceptance: Can edit memory manually
- Acceptance: Memory reflected in AI responses

### 6.3 Artifacts

**US-020: As a developer, I want the AI to generate code artifacts so that I can easily copy and use them.**
- Acceptance: Code appears in artifact panel
- Acceptance: Syntax highlighting applied
- Acceptance: One-click copy

**US-021: As a developer, I want to see diagrams rendered so that I can visualize architecture.**
- Acceptance: Mermaid code renders as diagram
- Acceptance: SVG displays correctly
- Acceptance: Can download diagram

**US-022: As a user, I want to save artifacts to my project so that I can reference them later.**
- Acceptance: "Add to Project" button
- Acceptance: Choose filename
- Acceptance: Appears in project files

### 6.4 Authentication

**US-030: As a user, I want to log in securely so that my data is protected.**
- Acceptance: Username/password form
- Acceptance: Error message for invalid credentials
- Acceptance: Redirect to app on success

**US-031: As a user, I want to be logged out automatically when my session expires so that my account is secure.**
- Acceptance: Automatic redirect to login
- Acceptance: Clear message about session expiry
- Acceptance: Previous work saved before redirect

---

## 7. Roadmap

### 7.1 Completed (v1.0)

- Core chat with streaming
- Session management
- Project system with files
- Artifact generation and rendering
- Memory system (DynamoDB + S3 Vectors)
- Authentication
- Knowledge Core integration
- Web search

### 7.2 Near-Term (v1.1)

- [ ] Artifact search and filtering
- [ ] Keyboard shortcuts
- [ ] Conversation export
- [ ] Improved mobile experience
- [ ] Extended thinking toggle

### 7.3 Medium-Term (v1.2)

- [ ] Team/organization features
- [ ] SSO integration
- [ ] API access for external tools
- [ ] Custom model selection
- [ ] Usage analytics dashboard

### 7.4 Long-Term (v2.0)

- [ ] Multi-modal inputs (voice, screen)
- [ ] Agent-based workflows
- [ ] Integration marketplace (MCP ecosystem)
- [ ] Self-hosted deployment option
- [ ] Fine-tuned model support

---

## 8. Success Metrics

### 8.1 Usage Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Daily Active Users | 50+ | TBD |
| Messages per User per Day | 30+ | TBD |
| Sessions per User per Week | 10+ | TBD |
| Projects per User | 3+ | TBD |
| Artifacts Generated per Week | 20+ | TBD |

### 8.2 Quality Metrics

| Metric | Target | Current |
|--------|--------|---------|
| Session Continuation Rate | 60%+ | TBD |
| Artifact Reuse Rate | 30%+ | TBD |
| Memory Utilization | 70%+ | TBD |
| Error Rate | <1% | TBD |

### 8.3 Satisfaction Metrics

| Metric | Target | Current |
|--------|--------|---------|
| User Satisfaction (NPS) | 40+ | TBD |
| Feature Adoption Rate | 50%+ | TBD |
| Support Ticket Volume | <5/week | TBD |

---

## 9. Glossary

| Term | Definition |
|------|------------|
| **Artifact** | Generated content (code, document, diagram) that can be viewed, copied, and saved |
| **Context** | Information provided to Claude including conversation history, files, and memory |
| **Knowledge Core** | Enterprise knowledge graph containing shared artifacts, ADRs, and patterns |
| **Memory** | Synthesized facts and context that persist across conversations |
| **MCP** | Model Context Protocol - standard for AI tool integration |
| **Pinned File** | Project file marked for automatic inclusion in chat context |
| **Semantic Memory** | AI-extracted facts stored as vectors for semantic search |
| **Session** | A single conversation thread with its message history |
| **Streaming** | Real-time delivery of AI response as it's generated |
| **Thin Client** | Architecture where frontend is presentation-only; all logic server-side |
| **Token Budget** | Allocation of Claude's context window across different content types |

---

## 10. Appendix

### 10.1 Supported File Types

**Text/Code:**
- `.txt`, `.md`, `.json`, `.yaml`, `.yml`
- `.py`, `.js`, `.jsx`, `.ts`, `.tsx`
- `.java`, `.cpp`, `.c`, `.h`, `.hpp`
- `.cs`, `.go`, `.rb`, `.php`, `.swift`
- `.kt`, `.rs`, `.scala`, `.sql`
- `.sh`, `.bash`, `.zsh`, `.ps1`, `.bat`
- `.html`, `.htm`, `.css`, `.scss`, `.sass`
- `.xml`, `.csv`, `.tsv`

**Documents:**
- `.pdf` (text extraction)
- `.docx` (text extraction)

**Images:**
- `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`

**Archives:**
- `.zip` (auto-extraction)

### 10.2 Artifact Type Mapping

| Extension | Renderer | Features |
|-----------|----------|----------|
| `.md` | MarkdownRenderer | GFM, tables, code blocks |
| `.html` | HTMLRenderer | Sandboxed iframe |
| `.svg` | SVGRenderer | Direct render |
| `.json` | JSONRenderer | Tree view, expand/collapse |
| `.csv` | CSVRenderer | Table with headers |
| `.mermaid` | MermaidRenderer | Auto-render diagrams |
| `.jsx` | CodeRenderer | Syntax highlight (no execute) |
| `.*` (code) | CodeRenderer | Language-specific highlighting |

### 10.3 Token Budget Allocation

| Category | Tokens | Priority |
|----------|--------|----------|
| System Prompt | 5,000 | 1 (always) |
| Pinned Files | 50,000 | 2 (high) |
| Project Memory | 15,000 | 3 (high) |
| Semantic Memory | 10,000 | 4 (medium) |
| File Manifest | 2,000 | 5 (medium) |
| Conversation | 100,000 | 6 (fill remaining) |
| **Total** | **182,000** | (of 200K limit) |

---

*Document Version: 1.0*
*Last Updated: January 2026*

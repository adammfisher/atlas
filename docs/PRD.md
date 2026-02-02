# ATLAS Platform - Product Requirements Document

**Version:** 1.0
**Last Updated:** January 2026
**Status:** Draft
**Owner:** Adam M (Director of Software Engineering)

---

## 1. Executive Summary

ATLAS (AI Technology Language Assistance System) is an enterprise AI development platform that provides developers with AI-assisted coding capabilities powered by Claude. The platform combines interactive coding assistance with automated background agents, all unified through a Knowledge Core that understands enterprise architecture, team patterns, compliance requirements, and service dependencies.

### 1.1 Vision Statement

Enable every developer to write better, more compliant code faster by providing AI assistance that understands enterprise context, team standards, and regulatory requirements.

### 1.2 Key Value Propositions

| Stakeholder | Value |
|-------------|-------|
| **Developers** | 40-60% reduction in coding time for common tasks; instant access to enterprise patterns and standards |
| **Engineering Managers** | Consistent code quality across teams; reduced onboarding time for new developers |
| **Compliance/Risk** | Automated compliance checking; audit trail of AI interactions; PII protection |
| **Enterprise Architecture** | Pattern adoption tracking; architecture decision visibility; dependency mapping |

---

## 2. Problem Statement

### 2.1 Current Challenges

1. **Tribal Knowledge Loss**: Enterprise patterns, compliance requirements, and team standards exist in scattered documentation, leading to inconsistent implementations.

2. **Compliance Overhead**: Developers spend significant time ensuring code meets PCI-DSS, SOC2, GLBA, and FFIEC requirements, often discovering violations late in the review process.

3. **Onboarding Friction**: New developers require months to understand enterprise architecture, service dependencies, and team conventions.

4. **Code Review Bottlenecks**: Senior developers spend excessive time on routine reviews catching compliance and pattern violations.

5. **Tool Fragmentation**: Developers use multiple disconnected AI tools without enterprise context, leading to code that doesn't fit the organization's architecture.

### 2.2 Target Outcomes

| Metric | Current State | Target | Timeline |
|--------|---------------|--------|----------|
| Time to first PR (new dev) | 2-3 weeks | 3-5 days | Q2 2026 |
| Compliance violations in PR | 15-20% | <5% | Q2 2026 |
| Code review iterations | 3-4 average | 1-2 average | Q3 2026 |
| Pattern adoption rate | ~40% | >80% | Q4 2026 |

---

## 3. User Personas

### 3.1 Primary: Enterprise Developer

**Name:** Sarah, Senior Software Engineer
**Team:** Consumer Lending Engineering
**Experience:** 5 years at company, 10 years total

**Goals:**
- Write compliant code without memorizing regulations
- Quickly understand unfamiliar services before modifying them
- Follow team patterns without hunting through documentation

**Pain Points:**
- Compliance requirements change and documentation is outdated
- Different teams use different patterns for similar problems
- Context switching between codebases is cognitively expensive

**ATLAS Usage:**
- `/explore loan-service` before making changes
- `/code` for implementation with pattern guidance
- `/review` before submitting PRs

### 3.2 Secondary: New Developer

**Name:** Marcus, Junior Developer
**Team:** Platform Engineering
**Experience:** 6 months at company, 2 years total

**Goals:**
- Understand the organization's architecture quickly
- Contribute meaningful code without constant hand-holding
- Learn team conventions by example

**Pain Points:**
- Documentation is overwhelming and hard to navigate
- Afraid of breaking compliance rules
- Doesn't know who to ask about what

**ATLAS Usage:**
- `/explore` to understand any service
- `/architect` for design questions
- Continuous context from Knowledge Core

### 3.3 Tertiary: Engineering Manager

**Name:** Priya, Engineering Manager
**Team:** Credit Services
**Experience:** 8 years at company

**Goals:**
- Ensure team output is consistent and compliant
- Reduce time spent on routine code reviews
- Track pattern adoption across the team

**Pain Points:**
- Inconsistent quality across team members
- Compliance findings late in the cycle
- No visibility into AI tool usage

**ATLAS Usage:**
- Review automated agent outputs
- Track team metrics dashboard
- Configure team-specific agents

---

## 4. Feature Requirements

### 4.1 Interactive Path (Claude Code Extension)

#### 4.1.1 Knowledge-Aware Chat

**Priority:** P0 (Must Have)
**Status:** Implemented

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-INT-001 | System queries Knowledge Core before responding | Knowledge Core queries visible in response |
| REQ-INT-002 | Responses include team standards | Standards cited with source |
| REQ-INT-003 | Compliance requirements surfaced proactively | Relevant regulations shown for service context |
| REQ-INT-004 | Service dependencies explained | Upstream/downstream services listed |

#### 4.1.2 Sub-Agent System

**Priority:** P0 (Must Have)
**Status:** Implemented

| Agent | Command | Requirements |
|-------|---------|--------------|
| Explore | `/explore` | Query Knowledge Core, show patterns, dependencies, ADRs |
| Plan | `/plan` | Break tasks into Jira-aligned work items |
| Code | `/code` | Follow team patterns, include audit logging, mask PII |
| Review | `/review` | Check compliance, patterns, security |
| Architect | `/architect` | Design with C4 diagrams, reference ADRs |

#### 4.1.3 Project Context

**Priority:** P0 (Must Have)
**Status:** Implemented

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-PRJ-001 | Project memory persists across sessions | Memory synthesized from conversations |
| REQ-PRJ-002 | Pinned files included in context | Token-budgeted file loading |
| REQ-PRJ-003 | Semantic memory search | Vector-based relevant context retrieval |
| REQ-PRJ-004 | Instructions per project | Custom instructions respected |

### 4.2 Automated Path (Agent SDK)

#### 4.2.1 Webhook-Triggered Agents

**Priority:** P1 (Should Have)
**Status:** Designed

| Agent | Trigger | Output |
|-------|---------|--------|
| PR Review | PR Opened | Review comments on GitLab MR |
| Code Archaeologist | Merge to Main | Pattern extraction to Knowledge Core |
| Test Generator | Build Success | Test file PR |
| Compliance Scanner | Daily Schedule | Compliance report |

#### 4.2.2 Agent SDK Containers

**Priority:** P1 (Should Have)
**Status:** Designed

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-AUTO-001 | Headless execution | No UI required |
| REQ-AUTO-002 | Same Knowledge Core access | Identical MCP tools available |
| REQ-AUTO-003 | Output to GitLab | Comments, PRs, reports |
| REQ-AUTO-004 | Container lifecycle | Start → Execute → Terminate |

### 4.3 Knowledge Core

#### 4.3.1 Graph Database

**Priority:** P0 (Must Have)
**Status:** Implemented (Neo4j local, Neptune prod)

| Entity | Relationships | Data |
|--------|--------------|------|
| Service | DEPENDS_ON, OWNED_BY | Name, tech stack, compliance |
| Team | OWNS, FOLLOWS | Name, Slack channel, standards |
| Pattern | USED_BY, PART_OF | Name, description, when to use |
| ADR | APPLIES_TO, SUPERSEDES | Title, status, decision |
| Compliance | REQUIRED_FOR | Regulation, requirements |

#### 4.3.2 MCP Server APIs

**Priority:** P0 (Must Have)
**Status:** Implemented

```
get_service_info(service_name)
get_team_standards(team_name)
search_patterns(query)
get_dependencies(service_name)
search_adrs(query)
get_compliance_requirements(domain)
```

### 4.4 Web Platform

#### 4.4.1 Chat Interface

**Priority:** P0 (Must Have)
**Status:** Implemented

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-WEB-001 | Streaming responses | SSE-based real-time streaming |
| REQ-WEB-002 | File attachments | PDF, images, code files |
| REQ-WEB-003 | Artifact generation | Code, diagrams, documents |
| REQ-WEB-004 | Web search | Optional real-time search |
| REQ-WEB-005 | Extended thinking | Optional deep reasoning mode |

#### 4.4.2 Project Management

**Priority:** P0 (Must Have)
**Status:** Implemented

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-PRJ-005 | Create/edit projects | Name, description, instructions |
| REQ-PRJ-006 | File management | Upload, pin, delete files |
| REQ-PRJ-007 | Memory management | View, edit, regenerate memory |
| REQ-PRJ-008 | Chat history per project | Filter sessions by project |

#### 4.4.3 Artifacts

**Priority:** P0 (Must Have)
**Status:** Implemented

| Requirement | Description | Acceptance Criteria |
|-------------|-------------|---------------------|
| REQ-ART-001 | Artifact rendering | Markdown, HTML, SVG, Mermaid |
| REQ-ART-002 | Artifact versioning | Track updates, show version |
| REQ-ART-003 | Download/copy | Export artifact content |
| REQ-ART-004 | Save to project | Add artifact as project file |

---

## 5. Non-Functional Requirements

### 5.1 Performance

| Requirement | Target | Measurement |
|-------------|--------|-------------|
| Chat response start | <2 seconds | Time to first token |
| Knowledge Core query | <500ms | P95 latency |
| File upload | <5 seconds for 4.5MB | End-to-end time |
| Concurrent users | 100+ | Without degradation |

### 5.2 Security

| Requirement | Description |
|-------------|-------------|
| SEC-001 | JWT-based authentication with expiration |
| SEC-002 | User data isolation (userId partition key) |
| SEC-003 | PII never logged in plaintext |
| SEC-004 | Secrets in AWS SSM Parameter Store |
| SEC-005 | CORS restricted to known origins |
| SEC-006 | bcrypt password hashing (cost 12) |

### 5.3 Compliance

| Regulation | Requirements |
|------------|--------------|
| PCI-DSS | Cardholder data encrypted; access logged |
| SOC2 | Audit logging; change management |
| GLBA | PII protected; consent tracked |
| FFIEC | Third-party risk management |

### 5.4 Availability

| Requirement | Target |
|-------------|--------|
| Uptime | 99.5% |
| RTO | 4 hours |
| RPO | 1 hour |

---

## 6. User Stories

### 6.1 Epic: Knowledge-Aware Development

```
US-001: As a developer, I want to explore a service before modifying it, so that I understand its patterns and compliance requirements.

Acceptance Criteria:
- /explore shows service owner and Slack channel
- /explore lists patterns in use with links to documentation
- /explore shows compliance requirements (PCI-DSS, SOC2, GLBA)
- /explore displays upstream and downstream dependencies
- Knowledge Core queries are visible in the response
```

```
US-002: As a developer, I want AI-generated code to follow my team's standards, so that code reviews are faster.

Acceptance Criteria:
- AI queries team standards before generating code
- Generated code uses team's preferred patterns
- Audit logging included when required
- PII masking applied automatically
```

```
US-003: As a developer, I want to review code against compliance requirements before submitting, so that I catch issues early.

Acceptance Criteria:
- /review checks for hardcoded secrets
- /review verifies PII masking in logs
- /review checks for required audit logging
- /review references relevant ADRs
```

### 6.2 Epic: Project Context

```
US-010: As a developer, I want my conversations to build project memory, so that context persists across sessions.

Acceptance Criteria:
- Memory automatically updates after conversations
- Memory sections: Purpose, State, Horizon, Learnings, Patterns, Tools
- Memory can be manually edited
- Memory version history available
```

```
US-011: As a developer, I want to pin important files to my project, so that they're always included in context.

Acceptance Criteria:
- Pinned files loaded within token budget
- Smallest files prioritized if budget exceeded
- File manifest shows pinned status
- Pinned files searchable semantically
```

### 6.3 Epic: Automated Agents

```
US-020: As an engineering manager, I want PRs automatically reviewed against standards, so that senior developers spend less time on routine reviews.

Acceptance Criteria:
- PR Review agent triggered on PR open
- Comments posted to GitLab MR
- Compliance, patterns, and security checked
- Verdict (approve/request changes) provided
```

---

## 7. Release Plan

### 7.1 Phase 1: Foundation (Completed)

- [x] Web chat interface with streaming
- [x] Project and session management
- [x] Artifact generation and rendering
- [x] File upload and management
- [x] User authentication
- [x] DynamoDB + S3 storage
- [x] Lambda + API Gateway deployment

### 7.2 Phase 2a: Centralization (Q1 2026)

- [ ] Agent repository with S3 distribution
- [ ] MCP server deployment
- [ ] Knowledge Core (Neptune) integration
- [ ] Team standards ingestion

### 7.3 Phase 2b: Knowledge Core (Q1 2026)

- [ ] Service dependency mapping
- [ ] Pattern extraction pipeline
- [ ] ADR indexing
- [ ] Compliance requirement mapping

### 7.4 Phase 2c: Automation (Q2 2026)

- [ ] Agent SDK container framework
- [ ] Webhook receiver
- [ ] PR Review agent
- [ ] Code Archaeologist agent

### 7.5 Phase 3: Enterprise Scale (Q2 2026)

- [ ] MicroVM migration (Firecracker)
- [ ] Full Neptune Knowledge Core
- [ ] All 29 sub-agents
- [ ] Enterprise monitoring

---

## 8. Success Metrics

### 8.1 Adoption Metrics

| Metric | Q1 Target | Q2 Target | Q4 Target |
|--------|-----------|-----------|-----------|
| Active developers | 50 | 200 | 500 |
| Daily sessions | 100 | 500 | 2000 |
| Projects created | 100 | 500 | 2000 |

### 8.2 Quality Metrics

| Metric | Baseline | Q2 Target | Measurement |
|--------|----------|-----------|-------------|
| Compliance violations in PR | 15-20% | <5% | GitLab MR data |
| Code review iterations | 3-4 | 1-2 | GitLab MR data |
| Pattern adoption | 40% | 60% | Knowledge Core queries |

### 8.3 Efficiency Metrics

| Metric | Baseline | Target | Measurement |
|--------|----------|--------|-------------|
| Time to first PR (new dev) | 2-3 weeks | 3-5 days | Onboarding surveys |
| Code review time | 2 hours | 30 mins | Time tracking |
| Context switching time | 30 mins | 5 mins | Developer surveys |

---

## 9. Risks and Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| Knowledge Core data staleness | High | Medium | Automated ingestion pipelines; freshness metrics |
| Developer adoption resistance | High | Medium | Gradual rollout; champion program; clear value demos |
| Compliance of AI outputs | High | Low | Guardrails; audit logging; human review required |
| Cost overruns | Medium | Medium | Usage monitoring; model tier selection; caching |
| LLM quality degradation | Medium | Low | Model version pinning; quality benchmarks |

---

## 10. Stakeholders

| Role | Name | Responsibility |
|------|------|----------------|
| Program Sponsor | Adam M | Strategic direction, funding |
| Platform Lead | Andy | Technical architecture |
| Risk/Compliance | Kyle (IPRM) | Compliance requirements |
| PoC Leads | Chris, Venkata, Mason | Team-specific pilots |
| Implementation | AIPD Lightspeed | Development |
| Enterprise Data | EDA | Knowledge Core data |
| Architecture | ARCH (ACT) | Standards, patterns |
| Cloud Platform | PCE | Infrastructure |

---

## 11. Appendices

### 11.1 Detailed Web Platform Requirements

#### 11.1.1 Core Chat Experience

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-CHAT-001 | Users can send text messages and receive AI responses | Implemented |
| REQ-CHAT-002 | Responses stream in real-time with visible progress | Implemented |
| REQ-CHAT-003 | Users can attach files (images, code, documents) to messages | Implemented |
| REQ-CHAT-004 | File content is processed and understood by AI | Implemented |
| REQ-CHAT-005 | Conversation history persists across browser sessions | Implemented |
| REQ-CHAT-006 | Users can stop generation mid-stream | Implemented |
| REQ-CHAT-007 | Web search is available for current information | Implemented |

#### 11.1.2 Session Management

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-SESSION-001 | Users can create new chat sessions | Implemented |
| REQ-SESSION-002 | Sessions have auto-generated titles from first message | Implemented |
| REQ-SESSION-003 | Users can rename sessions | Implemented |
| REQ-SESSION-004 | Users can star/favorite sessions | Implemented |
| REQ-SESSION-005 | Users can delete sessions | Implemented |
| REQ-SESSION-006 | Recent sessions appear in sidebar | Implemented |
| REQ-SESSION-007 | Sessions can be associated with projects | Implemented |

#### 11.1.3 Project Files

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

#### 11.1.4 Project Memory

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-MEM-001 | Projects have synthesized memory sections | Implemented |
| REQ-MEM-002 | Memory includes: purpose, current state, horizon, learnings, patterns, tools | Implemented |
| REQ-MEM-003 | Memory can be manually edited | Implemented |
| REQ-MEM-004 | Memory can be auto-regenerated from conversations | Implemented |
| REQ-MEM-005 | Memory is versioned for rollback | Implemented |
| REQ-MEM-006 | Memory is automatically included in chat context | Implemented |

#### 11.1.5 Semantic Memory

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-SEM-001 | Facts are auto-extracted from conversations | Implemented |
| REQ-SEM-002 | Facts are categorized (decision, preference, technical, etc.) | Implemented |
| REQ-SEM-003 | Semantic search retrieves relevant facts | Implemented |
| REQ-SEM-004 | Users can manually add memories | Implemented |
| REQ-SEM-005 | Users can edit/delete memories | Implemented |
| REQ-SEM-006 | Global memories work for non-project chats | Implemented |

#### 11.1.6 Artifact Generation

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-ART-001 | AI can generate artifacts (code, docs, diagrams) | Implemented |
| REQ-ART-002 | Artifacts appear inline during streaming | Implemented |
| REQ-ART-003 | Artifact panel shows full content | Implemented |
| REQ-ART-004 | Users can copy artifact content | Implemented |
| REQ-ART-005 | Users can download artifacts | Implemented |
| REQ-ART-006 | Artifacts persist with session | Implemented |

#### 11.1.7 Artifact Types

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

#### 11.1.8 Authentication

| Requirement | Description | Status |
|-------------|-------------|--------|
| REQ-AUTH-001 | Username/password login | Implemented |
| REQ-AUTH-002 | JWT-based session management | Implemented |
| REQ-AUTH-003 | Session expiration (24 hours) | Implemented |
| REQ-AUTH-004 | Automatic redirect to login on expiry | Implemented |
| REQ-AUTH-005 | Secure password hashing (bcrypt) | Implemented |
| REQ-AUTH-006 | Data isolation between users | Implemented |

### 11.2 Additional User Stories

#### Chat & Sessions

**US-101**: As a developer, I want to start a new conversation so that I can ask questions without prior context.
- Acceptance: Click "New chat" creates empty session
- Acceptance: First message becomes session title

**US-102**: As a developer, I want to resume previous conversations so that I can continue my work.
- Acceptance: Sessions listed in sidebar
- Acceptance: Clicking session loads full history
- Acceptance: Can continue conversation

**US-103**: As a user, I want to attach files to my message so that the AI can analyze them.
- Acceptance: Drag-drop or click to upload
- Acceptance: Preview shows before sending
- Acceptance: AI references file content in response

**US-104**: As a user, I want real-time streaming responses so that I don't wait for complete generation.
- Acceptance: Text appears as generated
- Acceptance: Can see AI "thinking" indicator
- Acceptance: Can stop generation early

#### Projects

**US-110**: As a developer, I want to create projects so that I can organize related work.
- Acceptance: Create project with name and description
- Acceptance: Project appears in sidebar
- Acceptance: Can have multiple projects

**US-111**: As a developer, I want to upload files to projects so that the AI remembers my codebase.
- Acceptance: Upload multiple files at once
- Acceptance: ZIP extraction supported
- Acceptance: Files persist across sessions

**US-112**: As a developer, I want to pin important files so that they're always in context.
- Acceptance: Pin toggle on file card
- Acceptance: Pinned files show indicator
- Acceptance: AI mentions having access to pinned files

**US-113**: As a user, I want project memory so that the AI remembers what we've discussed.
- Acceptance: Memory sections visible in project view
- Acceptance: Can edit memory manually
- Acceptance: Memory reflected in AI responses

#### Artifacts

**US-120**: As a developer, I want the AI to generate code artifacts so that I can easily copy and use them.
- Acceptance: Code appears in artifact panel
- Acceptance: Syntax highlighting applied
- Acceptance: One-click copy

**US-121**: As a developer, I want to see diagrams rendered so that I can visualize architecture.
- Acceptance: Mermaid code renders as diagram
- Acceptance: SVG displays correctly
- Acceptance: Can download diagram

**US-122**: As a user, I want to save artifacts to my project so that I can reference them later.
- Acceptance: "Add to Project" button
- Acceptance: Choose filename
- Acceptance: Appears in project files

### 11.3 Supported File Types

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

### 11.4 Artifact Type Mapping

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

### 11.5 Token Budget Allocation

| Category | Tokens | Priority |
|----------|--------|----------|
| System Prompt | 5,000 | 1 (always) |
| Pinned Files | 50,000 | 2 (high) |
| Project Memory | 15,000 | 3 (high) |
| Semantic Memory | 10,000 | 4 (medium) |
| File Manifest | 2,000 | 5 (medium) |
| Conversation | 100,000 | 6 (fill remaining) |
| **Total** | **182,000** | (of 200K limit) |

### 11.6 Glossary

| Term | Definition |
|------|------------|
| **ATLAS** | AI Technology Language Assistance System |
| **Knowledge Core** | Graph database of enterprise context |
| **MCP** | Model Context Protocol - standard for AI tool integration |
| **Sub-agent** | Specialized AI behavior loaded via system prompt |
| **Artifact** | Generated content (code, diagrams, documents) |
| **Context** | Information provided to Claude including conversation history, files, and memory |
| **Pinned File** | Project file marked for automatic inclusion in chat context |
| **Semantic Memory** | AI-extracted facts stored as vectors for semantic search |
| **Session** | A single conversation thread with its message history |
| **Streaming** | Real-time delivery of AI response as it's generated |
| **Thin Client** | Architecture where frontend is presentation-only; all logic server-side |
| **Token Budget** | Allocation of Claude's context window across different content types |

### 11.7 References

- [CLAUDE.md](/atlas-code/CLAUDE.md) - Technical architecture document
- [DEMO_GUIDE.md](/atlas-code/DEMO_GUIDE.md) - Platform demonstration walkthrough
- [Agent Specifications](/atlas-code/agents/) - Sub-agent definitions
- [API Specification](/docs/API_SPECIFICATION.md) - REST API documentation
- [Data Model](/docs/DATA_MODEL.md) - Database schema documentation

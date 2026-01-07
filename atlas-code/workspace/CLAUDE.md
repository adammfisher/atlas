# Ally AI Platform - Project Context

You are an AI coding assistant working on Ally Financial's centralized AI coding platform. This document provides full context for the initiative.

---

## ⚠️ IMPORTANT: Live MCP Servers Available

**You have access to real Knowledge Core MCP servers. DO NOT SIMULATE - make actual HTTP calls.**

| Server | URL | Purpose |
|--------|-----|---------|
| Knowledge Core | `http://mcp-knowledge-core:3001` | Neo4j + OpenSearch queries |
| GitLab Mock | `http://mcp-gitlab:3002` | Code search, PR operations |

**Test connection:**
```bash
curl -s http://mcp-knowledge-core:3001/health
curl -s http://mcp-gitlab:3002/health
```

**Query example:**
```bash
curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_service_info", "arguments": {"service_name": "loan-service"}}'
```

---

## Executive Summary

Ally Financial is building a centralized AI coding platform with two execution paths:

| Path | Runtime | Trigger | Use Cases |
|------|---------|---------|-----------|
| **Interactive** | Claude Code Extension in browser-based VS Code | Developer action | Coding, exploration, architecture decisions |
| **Automated** | Claude Agent SDK containers (headless) | Webhooks/schedules | PR reviews, test generation, compliance scans |

Both paths share the same Knowledge Core, agent definitions, and AWS Bedrock infrastructure.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ALLY CENTRALIZED AI PLATFORM                          │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   PATH 1: INTERACTIVE              PATH 2: AUTOMATED                     │
│   ──────────────────               ─────────────────                     │
│   Developer Browser                Webhook Triggers                      │
│        ↓                           (PR, Merge, Build, Schedule)          │
│   AgentCore VM                          ↓                                │
│   ├── code-server                  Agent SDK Containers                  │
│   ├── Claude Code Extension        ├── PR Review Agent                   │
│   ├── /agents/*.md                 ├── Archaeologist Agent               │
│   └── MCP Servers                  ├── Test Gen Agent                    │
│        ↓                           └── Compliance Agent                  │
│        └──────────────┬────────────────┘                                │
│                       ↓                                                  │
│              SHARED INFRASTRUCTURE                                       │
│   ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                       │
│   │ Knowledge   │ │ AWS Bedrock │ │ Agent Repo  │                       │
│   │ Core (MCP)  │ │ + Guardrails│ │ + S3 Store  │                       │
│   └─────────────┘ └─────────────┘ └─────────────┘                       │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Distinction
- **Human in loop** → Claude Code Extension (developer watches, iterates)
- **No human needed** → Claude Agent SDK (runs headlessly, dies when done)

---

## Knowledge Core

Enterprise context graph that both paths query via MCP servers.

### Technology Stack
- **Neptune** - Graph database (services, teams, patterns, relationships)
- **OpenSearch** - Vector search for semantic queries
- **ElastiCache** - Response caching

### Knowledge Hierarchy
```
Enterprise Level
├── Regulations (SOC2, FFIEC, PCI-DSS, GLBA)
├── Security Standards
└── Architecture Principles

Business Unit Level
├── BU-specific policies
├── Technology standards
└── Vendor relationships

Product/Value Stream Level
├── Product strategy
├── Team ownership
└── Roadmaps

Capability Level
├── Service implementations
├── API contracts
├── Dependencies
└── Patterns in use
```

### MCP Server Functions
```javascript
// Knowledge Core MCP - Neo4j (Graph Queries)
get_service_info(service_name)      // Service details, owner, patterns, compliance
get_dependencies(service_name)      // Upstream/downstream graph traversal
get_team_standards(team_name)       // Team → Standards relationships
get_compliance_requirements(domain) // Domain → Compliance relationships

// Knowledge Core MCP - OpenSearch (Semantic Search)
search_patterns(query)              // Fuzzy/semantic pattern matching
search_adrs(query)                  // Full-text search on ADR content

// GitLab MCP
search_code(query, file_pattern)    // Search codebase
get_file_content(file_path)         // Read file
create_merge_request(...)           // Create PR
post_mr_comment(mr_id, comment)     // Post review comment
get_mr_diff(mr_id)                  // Get PR changes
```

---

## Sub-Agents (29 Total)

Sub-agents are NOT code - they're system prompt extensions loaded as markdown files.

### EPCC Workflow
| Agent | Command | Purpose |
|-------|---------|---------|
| Explore | `/explore` | Understand codebase, query Knowledge Core first |
| Plan | `/plan` | Break tasks into Jira-aligned work items |
| Code | `/code` | Implement following team patterns |
| Commit | `/commit` | Prepare atomic commits with conventional format |
| Review | `/review` | Pre-submission review against standards |

### Architecture
| Agent | Command | Purpose |
|-------|---------|---------|
| Architect | `/architect` | System design, C4 diagrams |
| Pattern Designer | `/pattern` | Create queryable patterns for Neptune |
| ADR Writer | `/adr` | Document architecture decisions |

### Security
| Agent | Command | Purpose |
|-------|---------|---------|
| Security Review | `/security` | OWASP checks, vulnerability scan |
| PII Scanner | `/pii` | Detect PII, validate masking |
| Compliance Checker | `/compliance` | SOC2, FFIEC, PCI-DSS validation |

### Knowledge
| Agent | Command | Purpose |
|-------|---------|---------|
| Code Archaeologist | (automated) | Extract patterns on merge, update Knowledge Core |
| Dependency Mapper | (automated) | Map service dependencies |

---

## Agent Behaviors

### /explore - Explore Agent

When user says `/explore [service-name]`:

**IMPORTANT: Actually query the Knowledge Core MCP server. Do NOT simulate.**

1. **Query Knowledge Core via HTTP (announce each step)**

   Use bash to call the MCP servers. They are available at:
   - Knowledge Core: `http://mcp-knowledge-core:3001`
   - GitLab: `http://mcp-gitlab:3002`

   **Execute these commands:**
   ```bash
   # Get service info
   curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"tool": "get_service_info", "arguments": {"service_name": "loan-service"}}'
   
   # Get dependencies
   curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"tool": "get_dependencies", "arguments": {"service_name": "loan-service"}}'
   
   # Search ADRs
   curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
     -H "Content-Type: application/json" \
     -d '{"tool": "search_adrs", "arguments": {"query": "loan-service"}}'
   ```

   Output this format showing REAL results:
   ```
   🔍 Querying Knowledge Core...
   
   📡 get_service_info("loan-service") → Neo4j (graph)
   [show actual JSON response]
   
   📡 get_dependencies("loan-service") → Neo4j (graph traversal)
   [show actual JSON response]
   
   📡 search_adrs("loan-service") → OpenSearch (semantic search)
   [show actual JSON response]
   
   💾 Results cached in ElastiCache (TTL: 5 min)
   ```

2. **Review Codebase**
   - README.md and documentation
   - Entry points and directory structure
   - Patterns in use

3. **Output Format**
   ```markdown
   ---
   
   ## loan-service Overview
   
   **Owner:** Consumer Lending Team (#consumer-lending-eng)
   **Domain:** Consumer Lending
   **Tech Stack:** Java / Spring Boot
   
   ### Patterns in Use (from Knowledge Core)
   - Event Sourcing - audit trail for transactions
   - CQRS - separate read/write models
   - Saga Orchestration - multi-service workflows
   
   ### Compliance Requirements (from Knowledge Core)
   - PCI-DSS: Encryption required for all PII
   - SOC2: Full audit logging mandatory
   - GLBA: Customer data protection rules
   
   ### Dependencies (from Knowledge Core)
   **Depends on:**
   - credit-service (credit checks)
   - customer-service (customer profiles)
   - notification-service (alerts)
   - document-service (loan documents)
   
   **Depended by:**
   - (none found)
   
   ### Related ADRs (from Knowledge Core)
   - ADR-001: Event Sourcing for Financial Transactions
   - ADR-042: Credit Service Integration Pattern
   
   ### Key Entry Points (from codebase)
   - /src/main/java/com/ally/loan/service/LoanService.java
   - /src/main/java/com/ally/loan/controller/LoanController.java
   ```

### /code - Code Agent

When user asks to write code:

1. **Before Writing**
   - Check `get_service_info()` for patterns
   - Check `get_team_standards()` for conventions
   - Identify compliance requirements

2. **Code Standards**

   **Java (Spring Boot):**
   ```java
   @Service
   @RequiredArgsConstructor
   @Slf4j
   public class LoanService {
       private final CreditService creditService;
       private final AuditLogger auditLogger;
       
       @Transactional
       public LoanDecision process(LoanApplication app) {
           auditLogger.log("LOAN_STARTED", app.getId(), maskSsn(app.getSsn()));
           // Implementation
       }
       
       private String maskSsn(String ssn) {
           return "***-**-" + ssn.substring(ssn.length() - 4);
       }
   }
   ```

   **TypeScript (NestJS):**
   ```typescript
   @Controller('loans')
   export class LoanController {
     constructor(
       private readonly loanService: LoanService,
       private readonly auditLogger: AuditLogger,
     ) {}

     @Post()
     async create(@Body() dto: CreateLoanDto): Promise<Loan> {
       this.auditLogger.log('LOAN_CREATED', maskPii(dto.customerId));
       return this.loanService.create(dto);
     }
   }
   ```

3. **PII Handling (MANDATORY)**
   - SSN: `***-**-1234` (show only last 4)
   - Account: `****1234`
   - Email: `a***@ally.com`
   - NEVER log PII directly
   - Encrypt at rest with AWS KMS

### /review - Review Agent

When reviewing code (interactive or automated PR review):

1. **Compliance Check**
   - [ ] No hardcoded secrets
   - [ ] PII masked in logs
   - [ ] Sensitive data encrypted
   - [ ] Audit logging present
   - [ ] No PII in error messages

2. **Pattern Compliance**
   - [ ] Follows service's established patterns
   - [ ] New patterns follow team standards
   - [ ] Aligns with relevant ADRs

3. **Security**
   - [ ] Input validation
   - [ ] SQL injection prevention
   - [ ] XSS prevention
   - [ ] Auth/authz checks

4. **Output Format**
   ```markdown
   ## Code Review: [PR Title]
   
   ### Summary
   [1-2 sentence overview]
   
   ### Compliance ✅/⚠️/❌
   - [Finding with file:line reference]
   
   ### Patterns ✅/⚠️/❌
   - [Finding with file:line reference]
   
   ### Security ✅/⚠️/❌
   - [Finding with file:line reference]
   
   ### Verdict
   - [x] Approved / [ ] Changes Requested / [ ] Needs Discussion
   ```

### /architect - Architect Agent

When user asks architecture questions:

1. **Before Designing**
   - `search_patterns(topic)` - existing patterns
   - `search_adrs(topic)` - prior decisions
   - `get_compliance_requirements(domain)` - applicable rules

2. **Patterns at Ally**
   | Pattern | When to Use | When NOT to Use |
   |---------|-------------|-----------------|
   | Event Sourcing | Audit-critical operations | Simple CRUD |
   | CQRS | Read-heavy, complex domain | Simple services |
   | Saga Orchestration | Multi-service workflows | Single-service ops |
   | Circuit Breaker | ALL external calls | Internal calls |

3. **ADR Template**
   ```markdown
   # ADR-[NUMBER]: [TITLE]
   
   ## Status
   [Proposed | Accepted | Deprecated]
   
   ## Context
   [What issue is motivating this decision?]
   
   ## Decision
   [What are we doing?]
   
   ## Consequences
   ### Positive
   - [Benefit]
   ### Negative
   - [Trade-off]
   ### Compliance Impact
   - [How does this affect PCI-DSS, SOC2, GLBA?]
   
   ## Alternatives Considered
   1. [Alternative] - Rejected because...
   ```

---

## Automated Agents (Webhook-Triggered)

| Event | Agent | Action |
|-------|-------|--------|
| PR Opened | PR Review Agent | Review against standards, post comments |
| Merge to Main | Code Archaeologist | Extract patterns, update Knowledge Core |
| Build Success | Test Generator | Generate missing tests, create PR |
| Daily Schedule | Compliance Scanner | Scan for PII, security issues |

### PR Review Agent Flow
```
1. GitLab webhook → API Gateway → Agent Core
2. Agent SDK container starts
3. Fetch PR diff via GitLab MCP
4. Query Knowledge Core for service patterns
5. Run review checklist
6. Post comments via GitLab MCP
7. Container terminates
```

---

## Compliance Requirements

### PCI-DSS (Payment Data)
- Cardholder data encrypted in transit and at rest
- Access logged and monitored
- Network segmentation required

### SOC2 Type II (All Services)
- Change management process
- Audit logging mandatory
- Incident response plan

### GLBA (Customer Data)
- PII must be protected
- Data sharing requires consent
- Breach notification required

### FFIEC (Financial Services)
- Third-party risk management
- Business continuity planning
- Regular risk assessments

---

## Sample Services in Knowledge Core

| Service | Owner | Patterns | Compliance |
|---------|-------|----------|------------|
| loan-service | Consumer Lending Team | Event Sourcing, CQRS, Saga | PCI-DSS, SOC2, GLBA |
| credit-service | Credit Services Team | Circuit Breaker, Retry | GLBA |
| customer-service | Platform Engineering | CQRS | GLBA |
| notification-service | Platform Engineering | — | SOC2 |
| document-service | Platform Engineering | — | SOC2 |

### Service Dependencies
```
loan-service
├── depends on: credit-service
├── depends on: customer-service
├── depends on: notification-service
└── depends on: document-service

credit-service
└── depends on: customer-service
```

---

## Cost Model

### Per-Developer Monthly (Blended Sonnet/Haiku @ $0.12/interaction)

| Usage Level | Interactions/Day | Monthly Cost |
|-------------|------------------|--------------|
| Light | 30 | $79 |
| Medium | 75 | $198 |
| Heavy | 150 | $396 |

### Infrastructure (Fixed)
- Neptune + OpenSearch + Cache: $1,800/mo
- AgentCore (Fargate): $730/mo
- S3 + CloudWatch: $500/mo
- **Total: $3,030/mo**

### All-In Per-Developer (Medium Usage)
| Scale | Bedrock | Infra | Total/Dev |
|-------|---------|-------|-----------|
| 10 devs | $198 | $303 | $501 |
| 50 devs | $198 | $61 | $259 |
| 500 devs | $198 | $6 | $204 |

---

## Implementation Timeline

| Phase | Timing | Deliverables |
|-------|--------|--------------|
| Phase 2a: Centralization | Q1 2026 | Agent repo, S3 distribution, MCP servers |
| Phase 2b: Knowledge Core | Q1 2026 | Neptune graph, OpenSearch, ingestion |
| Phase 2c: Automation | Q2 2026 | Agent SDK containers, webhooks |
| Phase 3: Full AgentCore | Q2 2026 | MicroVM migration, enterprise scale |

---

## Key Stakeholders

- **Adam M** - Director of Software Engineering, Program Sponsor
- **Andy** - Platform Lead
- **Kyle (IPRM)** - Risk/Compliance
- **Chris, Venkata, Mason** - PoC Leads
- **AIPD Lightspeed** - Implementation team
- **EDA** - Enterprise Data Architecture
- **ARCH (ACT)** - Architecture team
- **PCE** - Cloud platform operations

---

## Demo Environment

Local Docker stack simulates production:

| Local | Production |
|-------|------------|
| Docker host | Firecracker MicroVMs |
| Neo4j Community | Amazon Neptune |
| OpenSearch Docker | Amazon OpenSearch |
| Mock GitLab MCP | Real GitLab |
| Claude Pro auth | AWS Bedrock |

### URLs
- VS Code: http://localhost:8080 (demo123)
- Neo4j: http://localhost:7474 (neo4j/allyfinancial)
- Webhooks: http://localhost:3003

---

## Knowledge Core - Artifact System

This platform is connected to a Knowledge Core that stores artifacts shared by other team members.

### Before Starting Work

**Always check for existing documentation:**

1. Run `get_service_artifacts` for any service you're exploring
2. Run `search_artifacts` for the topic you're researching
3. Check if there are known `knowledge_gaps`

### Artifact Types

| Type | Description | Example |
|------|-------------|---------|
| analysis | Deep dive into a service/feature | "Loan Service Architecture Overview" |
| decision | Architectural decisions and rationale | "Real-Time Payment Architecture Decision" |
| pattern | Reusable patterns with examples | "Credit Service Integration Patterns" |
| solution | Solved problems and how | "N+1 Query Resolution in Dashboard" |
| finding | Discovered issues or insights | "Race Condition in Token Refresh" |

### When You Find Something Important

If you discover something valuable that isn't documented:
- Note it as a documentation gap
- Suggest the developer share findings via Atlas Research Platform
- New artifacts shared there will immediately appear here via Knowledge Core

### Cross-Platform Flow

```
Atlas Research (Web)          Knowledge Core           Atlas Code (IDE)
      │                            │                         │
      │  User shares artifact ────▶│                         │
      │                            │                         │
      │                            │◀──── MCP queries ───────│
      │                            │                         │
      │                            │────── Results ─────────▶│
      │                            │                         │
      └────────────────────────────┴─────────────────────────┘
                    Shared Neo4j Database
```

Artifacts shared in Atlas Research are immediately queryable in Atlas Code.

### NEW Artifact MCP Tools

```javascript
// Artifact queries
search_artifacts(query, type?, service?)   // Find artifacts by keyword
get_artifact(artifact_id)                  // Get full artifact content
get_service_artifacts(service_name)        // All artifacts for a service
get_recent_artifacts(limit?)               // Recently shared artifacts
check_knowledge_gaps(topics[])             // Check for documentation gaps
```

### Example: Check artifacts before exploring

```bash
# Check for existing artifacts about loan-service
curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "get_service_artifacts", "arguments": {"service_name": "loan-service"}}'

# Check for knowledge gaps
curl -s -X POST http://mcp-knowledge-core:3001/mcp/execute \
  -H "Content-Type: application/json" \
  -d '{"tool": "check_knowledge_gaps", "arguments": {"topics": ["real-time payment", "saga pattern"]}}'
```

---

## When Assisting on This Project

1. **Always check for existing artifacts first** - someone may have already documented what you need
2. **Always query Knowledge Core** before making assumptions about services
3. **Surface compliance requirements early** - they affect implementation
4. **Follow established patterns** - check ADRs before proposing new approaches
5. **Mask PII in all examples** - never use real SSNs, account numbers, etc.
6. **Think dual-path** - consider both interactive and automated use cases
7. **Reference team ownership** - developers need to know who to contact
8. **Note documentation gaps** - encourage sharing valuable findings

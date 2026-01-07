# Ally AI Sub-Agents - Quick Reference

These slash commands are available in Claude Code within the VS Code container.

## Core EPCC Agents

### /explore
**Purpose:** Understand codebases and services before coding

**Usage:**
```
/explore loan-service
/explore
```

**What it does:**
- Queries Knowledge Core for service info, patterns, compliance requirements
- Reviews codebase structure and key entry points
- Identifies team ownership and dependencies
- Surfaces relevant ADRs

### /code
**Purpose:** Write code following Ally patterns and compliance standards

**Usage:**
```
/code Add input validation to the processApplication method
/code Implement credit check with circuit breaker
```

**What it does:**
- Checks Knowledge Core for service patterns and team standards
- Verifies compliance requirements (PII masking, audit logging)
- Writes code following established conventions
- Includes error handling and security best practices

### /review
**Purpose:** Review code changes against standards and compliance

**Usage:**
```
/review
/review PR-123
```

**What it does:**
- Checks compliance (secrets, PII masking, encryption, audit logging)
- Verifies pattern adherence from Knowledge Core
- Reviews security (input validation, SQL injection, XSS, auth)
- Provides specific file:line references
- Rates as ✅/⚠️/❌

### /architect
**Purpose:** Make architecture decisions with compliance context

**Usage:**
```
/architect Should we add caching to credit-service?
/architect Design a new payment processing service
```

**What it does:**
- Searches existing patterns and ADRs
- Identifies compliance implications
- Recommends patterns (Event Sourcing, CQRS, Circuit Breaker, Saga)
- Creates ADRs with trade-offs documented
- Links decisions to Knowledge Core

## Bonus Agents (Also Available)

### /plan
Break down tasks into Jira-aligned work items with compliance requirements

### /commit
Create conventional commits with proper formatting and compliance notes

### /pattern
Design reusable architecture patterns for Knowledge Core

### /adr
Write Architecture Decision Records with compliance impact

## Demo Flow

1. **Explore a service:**
   ```
   /explore loan-service
   ```

2. **Ask for code:**
   ```
   /code Add rate limiting to the loan application endpoint
   ```

3. **Review the changes:**
   ```
   /review
   ```

4. **Get architecture guidance:**
   ```
   /architect Should we cache credit scores?
   ```

## Knowledge Core Integration

All agents automatically query:
- `get_service_info` - Patterns, ownership, compliance
- `get_team_standards` - Coding conventions
- `search_adrs` - Architecture decisions
- `get_dependencies` - Service relationships
- `search_patterns` - Established patterns

## Compliance Focus

Every agent enforces:
- **PII Masking**: SSN as `***-**-1234`, Account as `****1234`
- **Audit Logging**: All data access logged
- **Encryption**: Sensitive data encrypted at rest (KMS)
- **Standards**: PCI-DSS, SOC2, GLBA, FFIEC

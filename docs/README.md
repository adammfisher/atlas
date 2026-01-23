# ATLAS Platform Documentation

Welcome to the ATLAS platform documentation. This directory contains all documentation needed for product handoff and ongoing development.

---

## Quick Links

| Document | Description | Audience |
|----------|-------------|----------|
| [PRD.md](./PRD.md) | Product Requirements Document | Product, Dev, Stakeholders |
| [API_SPECIFICATION.md](./API_SPECIFICATION.md) | REST API Reference | Dev, QA |
| [DATA_MODEL.md](./DATA_MODEL.md) | DynamoDB Schema & S3 Structure | Dev |
| [SECURITY.md](./SECURITY.md) | Security Architecture | Security, DevOps |
| [RUNBOOK.md](./RUNBOOK.md) | Production Operations | SRE, DevOps |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Developer Guide | Dev |
| [TEST_PLAN.md](./TEST_PLAN.md) | Testing Strategy | QA, Dev |
| [ADR/](./ADR/) | Architecture Decision Records | Architects, Dev |

---

## Documentation Overview

### For Product Teams

Start with the **Product Requirements Document (PRD)** for:
- Executive summary and vision
- User personas and stories
- Feature requirements and roadmap
- Success metrics and KPIs

### For Development Teams

Key documents:
1. **API Specification** - All REST endpoints with request/response examples
2. **Data Model** - DynamoDB tables, S3 structure, relationships
3. **Contributing Guide** - Setup, coding standards, PR process
4. **ADRs** - Why key architectural decisions were made

### For Operations/SRE

Essential reading:
1. **Runbook** - Monitoring, alerts, incident response, DR
2. **Security** - Authentication, authorization, compliance
3. **CI/CD Pipeline** (`.github/workflows/`) - Deployment process

### For QA Teams

Reference:
1. **Test Plan** - Strategy, test cases, automation framework
2. **API Specification** - Endpoint contracts for API testing

---

## Architecture Decision Records (ADRs)

| ADR | Title | Status |
|-----|-------|--------|
| [ADR-001](./ADR/ADR-001-serverless-architecture.md) | Serverless Architecture with Lambda | Accepted |
| [ADR-002](./ADR/ADR-002-dynamodb-data-model.md) | DynamoDB as Primary Database | Accepted |
| [ADR-003](./ADR/ADR-003-s3-vectors-for-memory.md) | S3 Vectors for Semantic Memory | Accepted |
| [ADR-004](./ADR/ADR-004-lambda-response-streaming.md) | Lambda Response Streaming for Chat | Accepted |
| [ADR-005](./ADR/ADR-005-mcp-protocol-adoption.md) | Model Context Protocol for Tools | Accepted |
| [ADR-006](./ADR/ADR-006-jwt-authentication.md) | JWT-Based Authentication | Accepted |
| [ADR-007](./ADR/ADR-007-artifact-system.md) | Artifact Generation and Versioning | Accepted |

---

## Related Resources

### In This Repository

| Location | Contents |
|----------|----------|
| `/atlas-code/CLAUDE.md` | Technical architecture overview |
| `/atlas-code/DEMO_GUIDE.md` | Demo walkthrough |
| `/atlas-code/agents/` | Sub-agent definitions |
| `/atlas-web/terraform/` | Infrastructure as Code |
| `/atlas-web/tests/e2e/` | Playwright E2E tests |
| `/.github/workflows/` | CI/CD pipeline |

### External

| Resource | Description |
|----------|-------------|
| [AWS Bedrock](https://docs.aws.amazon.com/bedrock/) | LLM provider documentation |
| [Model Context Protocol](https://modelcontextprotocol.io/) | MCP specification |
| [Playwright](https://playwright.dev/) | E2E testing framework |
| [Terraform AWS](https://registry.terraform.io/providers/hashicorp/aws) | Infrastructure provider |

---

## Document Maintenance

| Task | Frequency | Owner |
|------|-----------|-------|
| PRD updates | Per release | Product |
| API spec updates | Per endpoint change | Dev |
| Runbook review | Monthly | SRE |
| Security review | Quarterly | Security |
| ADR additions | As needed | Architecture |

---

## Getting Help

- **Slack**: #atlas-dev
- **Email**: atlas-team@ally.com
- **Issues**: [GitHub Issues](https://github.com/ally/atlas/issues)

---

*Last updated: January 2026*

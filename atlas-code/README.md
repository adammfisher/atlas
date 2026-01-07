# Ally AI Platform - Local Demo

A fully functional local prototype of Ally's centralized AI coding platform.

## What's Included

```
ally-ai-platform-demo/
├── docker-compose.yml          # All services orchestrated
├── DEMO_GUIDE.md               # Step-by-step demo script
├── docker/
│   ├── Dockerfile.code-server  # VS Code in browser + Claude Code
│   ├── Dockerfile.webhook      # Webhook receiver for automated agents
│   └── mcp-config.json         # MCP server configuration
├── mcp-servers/
│   ├── knowledge-core/         # Queries Neo4j/OpenSearch
│   └── gitlab-mock/            # Simulates GitLab for demos
├── agents/
│   ├── epcc/                   # Explore, Plan, Code, Commit, Review
│   ├── architecture/           # Architect, Pattern Designer
│   └── security/               # Security Review, Compliance
├── data/
│   └── neo4j-init.cypher       # Sample Knowledge Core data
└── workspace/
    └── loan-service/           # Sample code to explore
```

## Prerequisites

- Docker Desktop (with at least 8GB RAM allocated)
- Anthropic account (Claude Pro or API access)

## Quick Start

### 1. Clone and Start

```bash
cd ally-ai-platform-demo
docker-compose up -d
```

### 2. Load Knowledge Core Data

```bash
# Wait ~30 seconds for Neo4j to be ready
docker exec -i ally-neo4j cypher-shell -u neo4j -p allyfinancial < data/neo4j-init.cypher
```

### 3. Access Services

| Service | URL | Credentials |
|---------|-----|-------------|
| VS Code (Claude Code) | http://localhost:8080 | password: `demo123` |
| Neo4j Browser | http://localhost:7474 | neo4j / `allyfinancial` |
| Webhook Simulator | http://localhost:3003 | — |
| Knowledge Core MCP | http://localhost:3001/health | — |
| GitLab Mock MCP | http://localhost:3002/health | — |

### 4. Authenticate Claude Code

1. Open http://localhost:8080
2. Open terminal in VS Code
3. Run `claude`
4. Follow browser authentication with your Anthropic account

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     LOCAL DEMO STACK                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│   Browser ──▶ code-server:8080 ──▶ Claude Code CLI         │
│                                        │                    │
│                                        ▼                    │
│                              ┌─────────────────┐           │
│                              │   MCP Servers   │           │
│                              ├────────┬────────┤           │
│                              │ K-Core │ GitLab │           │
│                              │ :3001  │ :3002  │           │
│                              └───┬────┴────┬───┘           │
│                                  │         │               │
│                                  ▼         ▼               │
│                          ┌──────────┐  ┌──────────┐       │
│                          │  Neo4j   │  │ Workspace│       │
│                          │  :7474   │  │  Files   │       │
│                          └──────────┘  └──────────┘       │
│                                                             │
│   Webhook Simulator:3003 ──▶ Triggers automated agents     │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Demo Scenarios

### Interactive: Explore a Service
```
/explore loan-service
```
Claude queries Knowledge Core for service context, ownership, patterns, compliance.

### Interactive: Write Code
```
Add validation to the LoanService processApplication method
```
Claude checks team standards and patterns before writing code.

### Interactive: Architecture Question
```
/architect Should we cache credit bureau responses?
```
Claude references ADRs and existing patterns to make recommendations.

### Automated: PR Review
1. Open http://localhost:3003
2. Click "Simulate PR Opened"
3. Watch logs: `docker-compose logs -f webhook-receiver`

### Automated: Code Archaeologist
1. Click "Simulate Merge to Main"
2. Agent extracts patterns and updates Knowledge Core

## What This Proves

| Capability | Demonstrated |
|------------|--------------|
| Browser-based VS Code | ✅ code-server working |
| Claude Code integration | ✅ Full CLI available |
| Knowledge Core queries | ✅ Neo4j + MCP working |
| Sub-agent loading | ✅ Agents from /agents directory |
| Automated webhook triggers | ✅ Webhook simulator working |
| Enterprise context injection | ✅ Services, teams, patterns queryable |

## What's Different from Production

| Local Demo | Production (AWS) |
|------------|------------------|
| Single Docker host | Firecracker MicroVMs (AgentCore) |
| Neo4j Community | Amazon Neptune |
| OpenSearch Docker | Amazon OpenSearch Managed |
| Mock GitLab MCP | Real GitLab integration |
| Claude Pro account | AWS Bedrock |
| Simulated webhooks | Real GitLab/GitHub webhooks |

## Cleanup

```bash
docker-compose down -v
```

## Troubleshooting

### Services won't start
```bash
# Check Docker has enough resources (8GB+ RAM)
docker system info
```

### Neo4j connection refused
```bash
# Wait for it to be ready
docker-compose logs neo4j | tail -20
```

### Claude Code won't authenticate
```bash
# Check network connectivity from container
docker exec ally-code-server curl -I https://api.anthropic.com
```

## Next Steps

1. Run through `DEMO_GUIDE.md` for the full walkthrough
2. Customize `data/neo4j-init.cypher` with your own services
3. Add more agents to `agents/` directory
4. Connect real GitLab for true webhook testing

## Cost

**$0 for local infrastructure** - only Claude usage charges apply (~$2-10 for a demo session depending on usage).

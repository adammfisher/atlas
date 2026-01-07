# Atlas Platform

Enterprise AI research interface with AWS Lambda + Bedrock backend.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     ATLAS PLATFORM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  React Frontend (Thin Client)                                    │
│       │                                                          │
│       ▼ HTTPS                                                    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              AWS (Serverless - Scale to Zero)            │    │
│  │                                                          │    │
│  │   API Gateway → Lambda Functions → Bedrock (Claude 4.5) │    │
│  │                     │                                    │    │
│  │                     ▼                                    │    │
│  │              DynamoDB + S3                               │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Optional: Local Neo4j + OpenSearch containers                   │
└─────────────────────────────────────────────────────────────────┘
```

## Features

- **Streaming chat** with Claude 4.5 (Haiku, Sonnet, Opus)
- **Extended thinking** support
- **Web search** integration
- **File uploads** (images, PDFs, documents)
- **Artifact generation** (.md, .svg, .html, code files)
- **Projects** with persistent context files
- **MCP server management** via UI
- **Conversation compaction** with caching
- **Prompt caching** for cost optimization

## Cost (POC - Single User)

| Component | Monthly |
|-----------|---------|
| Lambda | ~$0 (free tier) |
| API Gateway | ~$0 (free tier) |
| DynamoDB | ~$0 (free tier) |
| S3 | ~$0.50 |
| Bedrock Claude | ~$5-20 |
| **Total** | **~$5-25** |

## Prerequisites

- AWS CLI configured with credentials
- Terraform >= 1.0
- Node.js >= 18
- npm

## Deployment

### 1. Package Lambda Functions

```bash
chmod +x scripts/deploy.sh
./scripts/deploy.sh
```

### 2. Deploy Infrastructure

```bash
cd terraform
terraform init
terraform plan
terraform apply
```

Note the `api_endpoint` output.

### 3. Start Frontend

```bash
cd frontend
cp .env.example .env.local
# Edit .env.local with your API endpoint
npm install
npm run dev
```

## Project Structure

```
atlas-platform/
├── terraform/           # AWS infrastructure
│   ├── main.tf
│   ├── variables.tf
│   ├── dynamodb.tf
│   ├── s3.tf
│   ├── lambda.tf
│   ├── api-gateway.tf
│   ├── iam.tf
│   └── outputs.tf
├── lambda/
│   ├── shared/          # Shared utilities
│   │   ├── bedrock.js   # Bedrock client + compaction
│   │   ├── dynamodb.js
│   │   ├── s3.js
│   │   └── response.js
│   ├── functions/       # Lambda handlers
│   │   ├── chat/
│   │   ├── sessions/
│   │   ├── projects/
│   │   ├── files/
│   │   ├── mcp-config/
│   │   └── artifacts/
│   └── layers/          # Dependencies layer
├── frontend/            # React app
│   ├── src/
│   │   ├── components/
│   │   ├── hooks/
│   │   └── services/
│   └── package.json
└── scripts/
    └── deploy.sh
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/chat/message/stream` | POST | Streaming chat |
| `/api/sessions` | GET/POST | List/create sessions |
| `/api/sessions/{id}` | GET/PUT/DELETE | Session CRUD |
| `/api/sessions/{id}/messages` | GET | Get messages |
| `/api/sessions/{id}/artifacts` | GET | List artifacts |
| `/api/projects` | GET/POST | List/create projects |
| `/api/projects/{id}` | GET/PUT/DELETE | Project CRUD |
| `/api/projects/{id}/files` | GET/POST | List/upload files |
| `/api/mcp/servers` | GET/POST | List/create MCP configs |
| `/api/connectors/available` | GET | Available connectors |

## Claude 4.5 Models

| Model | Inference Profile |
|-------|-------------------|
| Haiku | `global.anthropic.claude-haiku-4-5-20251001-v1:0` |
| Sonnet | `global.anthropic.claude-sonnet-4-5-20250929-v1:0` |
| Opus | `global.anthropic.claude-opus-4-5-20251101-v1:0` |

## Future: Knowledge Core Integration

The Lambda functions support optional connections to local Neo4j and OpenSearch containers for enterprise knowledge integration. Set these environment variables:

```
NEO4J_URL=bolt://localhost:7687
OPENSEARCH_URL=http://localhost:9200
```

## License

Internal use only.

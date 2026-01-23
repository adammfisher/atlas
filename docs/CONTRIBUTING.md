# Contributing to ATLAS

Welcome to the ATLAS platform! This guide will help you set up your development environment and contribute effectively.

---

## Table of Contents

1. [Getting Started](#1-getting-started)
2. [Development Environment](#2-development-environment)
3. [Project Structure](#3-project-structure)
4. [Development Workflow](#4-development-workflow)
5. [Coding Standards](#5-coding-standards)
6. [Adding Features](#6-adding-features)
7. [Testing](#7-testing)
8. [Documentation](#8-documentation)
9. [Pull Request Process](#9-pull-request-process)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Getting Started

### 1.1 Prerequisites

| Requirement | Version | Purpose |
|-------------|---------|---------|
| Node.js | 18+ | Runtime for Lambda and frontend |
| npm | 9+ | Package management |
| Docker | 24+ | Local development containers |
| AWS CLI | 2.x | AWS service interaction |
| Terraform | 1.6+ | Infrastructure deployment |
| Git | 2.x | Version control |

### 1.2 Clone the Repository

```bash
git clone https://github.com/ally/atlas.git
cd atlas
```

### 1.3 Quick Start

```bash
# Start the full platform locally
./start.sh

# Access points:
# - Frontend: http://localhost:3000
# - Backend API: http://localhost:8000
# - VS Code (demo): http://localhost:8080 (password: demo123)
# - Neo4j Browser: http://localhost:7474 (neo4j/allyfinancial)
```

### 1.4 Stop Development Environment

```bash
./stop.sh
```

---

## 2. Development Environment

### 2.1 Environment Setup

**1. Install dependencies:**

```bash
# Root dependencies
cd atlas-web
npm install

# Frontend dependencies
cd frontend
npm install
```

**2. Configure environment:**

```bash
# Copy example environment file
cp frontend/.env.example frontend/.env.local

# Edit with your settings
# VITE_API_URL=http://localhost:8000/api
# VITE_STREAM_URL=http://localhost:8000
```

**3. Start services:**

```bash
# Option A: Full platform with Docker
./start.sh

# Option B: Just backend (for frontend development)
cd atlas-web
npm run dev

# Option C: Just frontend (assuming backend running)
cd atlas-web/frontend
npm run dev
```

### 2.2 Docker Services

| Service | Port | Purpose |
|---------|------|---------|
| code-server | 8080 | VS Code in browser |
| neo4j | 7474, 7687 | Knowledge Core graph |
| opensearch | 9200 | Vector search |
| redis | 6379 | Caching |
| knowledge-core-mcp | 3001 | Knowledge MCP server |
| gitlab-mock-mcp | 3002 | GitLab MCP server |
| webhook | 3003 | Webhook simulator |

### 2.3 AWS Local Development

For testing AWS services locally:

```bash
# Configure AWS credentials
aws configure --profile atlas-dev

# Use LocalStack for DynamoDB/S3 testing
docker-compose -f docker-compose.localstack.yml up -d
```

---

## 3. Project Structure

```
atlas/
├── atlas-code/                 # Local demo platform
│   ├── agents/                 # Sub-agent definitions
│   │   ├── epcc/              # EPCC workflow agents
│   │   └── architecture/      # Architecture agents
│   ├── docker/                # Docker configurations
│   ├── mcp-servers/           # MCP server implementations
│   │   ├── knowledge-core/    # Knowledge Core MCP
│   │   └── gitlab-mock/       # Mock GitLab MCP
│   ├── data/                  # Sample data
│   └── workspace/             # Sample project
│
├── atlas-web/                  # Web platform
│   ├── frontend/              # React frontend
│   │   ├── src/
│   │   │   ├── components/    # React components
│   │   │   ├── context/       # React context providers
│   │   │   ├── hooks/         # Custom hooks
│   │   │   └── services/      # API services
│   │   ├── public/            # Static assets
│   │   └── package.json
│   │
│   ├── lambda/                # Lambda functions
│   │   ├── functions/         # Individual functions
│   │   │   ├── auth/
│   │   │   ├── chat/
│   │   │   ├── sessions/
│   │   │   ├── projects/
│   │   │   ├── files/
│   │   │   ├── artifacts/
│   │   │   └── mcp-config/
│   │   ├── shared/            # Shared utilities
│   │   └── layers/            # Lambda layers
│   │
│   ├── terraform/             # Infrastructure as code
│   │   ├── main.tf
│   │   ├── lambda.tf
│   │   ├── api-gateway.tf
│   │   ├── dynamodb.tf
│   │   └── variables.tf
│   │
│   ├── tests/                 # Test suites
│   │   └── e2e/              # Playwright E2E tests
│   │
│   └── scripts/               # Utility scripts
│
├── docs/                       # Documentation
│   ├── ADR/                   # Architecture Decision Records
│   ├── PRD.md                 # Product Requirements
│   ├── API_SPECIFICATION.md   # API documentation
│   ├── RUNBOOK.md             # Operations runbook
│   ├── SECURITY.md            # Security architecture
│   ├── DATA_MODEL.md          # Data model docs
│   └── CONTRIBUTING.md        # This file
│
├── .github/
│   └── workflows/             # CI/CD pipelines
│
├── start.sh                   # Start development
└── stop.sh                    # Stop development
```

---

## 4. Development Workflow

### 4.1 Branch Strategy

```
main                    # Production-ready code
├── develop             # Integration branch (if used)
├── feature/xxx         # New features
├── bugfix/xxx          # Bug fixes
└── hotfix/xxx          # Production hotfixes
```

### 4.2 Branch Naming

| Type | Format | Example |
|------|--------|---------|
| Feature | `feature/short-description` | `feature/add-artifact-export` |
| Bug fix | `bugfix/issue-number` | `bugfix/issue-123` |
| Hotfix | `hotfix/description` | `hotfix/auth-timeout` |
| Docs | `docs/description` | `docs/update-api-spec` |

### 4.3 Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Adding tests
- `chore`: Maintenance

**Examples:**
```bash
feat(chat): add artifact streaming support
fix(auth): handle expired JWT gracefully
docs(api): update session endpoints
refactor(lambda): extract shared auth middleware
```

---

## 5. Coding Standards

### 5.1 JavaScript/Node.js

**Style:**
- Use ES modules (`import`/`export`) in frontend
- Use CommonJS (`require`/`module.exports`) in Lambda
- 2-space indentation
- Single quotes for strings
- Semicolons required

**Naming:**
```javascript
// Variables and functions: camelCase
const sessionId = 'session_123';
function getSessionById(id) { }

// Constants: UPPER_SNAKE_CASE
const MAX_FILE_SIZE = 4.5 * 1024 * 1024;

// Classes: PascalCase
class ChatHandler { }

// Files: kebab-case.js
// auth-middleware.js, session-service.js
```

**Error Handling:**
```javascript
// Always use try-catch with specific error handling
try {
  const result = await riskyOperation();
  return success(result);
} catch (error) {
  console.error('Operation failed:', error.message);
  return serverError('Operation failed');
}
```

### 5.2 React/Frontend

**Component Structure:**
```jsx
// Functional components with hooks
import { useState, useEffect } from 'react';

export function SessionList({ userId }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, [userId]);

  return (
    <div className="session-list">
      {sessions.map(session => (
        <SessionItem key={session.id} session={session} />
      ))}
    </div>
  );
}
```

**File Organization:**
```
components/
├── Chat/
│   ├── Chat.jsx           # Main component
│   ├── Chat.css           # Styles
│   ├── ChatMessage.jsx    # Sub-component
│   └── index.js           # Export barrel
```

### 5.3 Terraform

**Style:**
```hcl
# Use descriptive resource names
resource "aws_lambda_function" "chat" {
  function_name = "${var.project_name}-chat"

  # Group related attributes
  runtime     = "nodejs20.x"
  handler     = "index.handler"
  memory_size = 1024
  timeout     = 300

  # Environment variables last
  environment {
    variables = {
      SESSIONS_TABLE = aws_dynamodb_table.sessions.name
    }
  }
}
```

---

## 6. Adding Features

### 6.1 Adding a New API Endpoint

**1. Create Lambda handler:**

```javascript
// lambda/functions/my-feature/index.js
const { success, badRequest, serverError } = require('../shared/response');
const { authenticateRequest } = require('../shared/authMiddleware');

exports.handler = async (event) => {
  // Authenticate
  const user = authenticateRequest(event);

  // Route by method/path
  const method = event.requestContext?.http?.method;

  if (method === 'GET') {
    return handleGet(user.userId, event);
  }

  return badRequest('Invalid route');
};

async function handleGet(userId, event) {
  // Implementation
  return success({ data: 'result' });
}
```

**2. Add Terraform resources:**

```hcl
# terraform/lambda.tf
resource "aws_lambda_function" "my_feature" {
  filename      = "${path.module}/../lambda/functions/my-feature.zip"
  function_name = "${var.project_name}-my-feature"
  # ...
}

# terraform/api-gateway.tf
resource "aws_apigatewayv2_route" "my_feature_get" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "GET /api/my-feature"
  target    = "integrations/${aws_apigatewayv2_integration.my_feature.id}"
}
```

**3. Add frontend service:**

```javascript
// frontend/src/services/myFeature.js
export async function getMyFeature() {
  const response = await fetch('/api/my-feature', {
    credentials: 'include'
  });
  return response.json();
}
```

### 6.2 Adding a New Sub-Agent

**1. Create agent markdown file:**

```markdown
<!-- agents/epcc/my-agent.md -->
# My Agent

## Purpose
Describe what this agent does.

## Trigger
Activated when user types `/my-command`.

## Behavior
1. Step one
2. Step two

## Output Format
```
Expected output format
```
```

**2. Register in MCP config (if needed):**

```json
// docker/mcp-config.json
{
  "agents": {
    "my-agent": {
      "file": "./agents/epcc/my-agent.md",
      "command": "/my-command"
    }
  }
}
```

### 6.3 Adding a New MCP Server

**1. Create server implementation:**

```javascript
// mcp-servers/my-server/index.js
const express = require('express');
const app = express();

app.post('/tools/my-tool', async (req, res) => {
  const { parameters } = req.body;
  // Implementation
  res.json({ result: 'data' });
});

app.listen(3004, () => {
  console.log('My MCP server running on :3004');
});
```

**2. Add to docker-compose:**

```yaml
# docker-compose.yml
my-mcp-server:
  build:
    context: ./mcp-servers/my-server
  ports:
    - "3004:3004"
```

---

## 7. Testing

### 7.1 Running Tests

```bash
# All tests
cd atlas-web
npm test

# E2E tests only
npm run test:e2e

# Specific test file
npm run test:e2e -- --grep "chat"

# Debug mode (headed browser)
npm run test:debug
```

### 7.2 Writing E2E Tests

```javascript
// tests/e2e/my-feature.spec.js
const { test, expect } = require('@playwright/test');

test.describe('My Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Login if needed
  });

  test('should do something', async ({ page }) => {
    await page.click('[data-testid="my-button"]');
    await expect(page.locator('.result')).toHaveText('expected');
  });
});
```

### 7.3 Test Data

```javascript
// tests/fixtures/test-data.js
export const testUser = {
  username: 'testuser',
  password: 'TestPass123!'
};

export const testProject = {
  name: 'Test Project',
  description: 'For testing'
};
```

---

## 8. Documentation

### 8.1 Code Comments

```javascript
/**
 * Extracts artifact content from LLM response.
 * Supports both <artifact> tags and code fence formats.
 *
 * @param {string} text - Full response text
 * @param {Object} artifact - Artifact metadata
 * @param {string} artifact.id - Artifact identifier
 * @param {string} artifact.format - 'tag' or 'fence'
 * @returns {Object|null} - {content: string} or null if not found
 */
function extractArtifactContent(text, artifact) {
  // Implementation
}
```

### 8.2 README Updates

When adding features, update relevant READMEs:
- Root README for major features
- Component READMEs for implementation details
- API_SPECIFICATION.md for endpoint changes

### 8.3 ADR Process

For significant architectural decisions:

1. Copy `docs/ADR/ADR-TEMPLATE.md`
2. Number sequentially (ADR-008, etc.)
3. Fill in all sections
4. Get review from tech lead
5. Update `docs/ADR/README.md` index

---

## 9. Pull Request Process

### 9.1 Before Submitting

- [ ] Code follows style guidelines
- [ ] Tests pass locally
- [ ] Documentation updated
- [ ] No console.log statements (use proper logging)
- [ ] No hardcoded secrets
- [ ] Self-review completed

### 9.2 PR Template

```markdown
## Summary
Brief description of changes.

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
How was this tested?

## Checklist
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] No breaking changes (or documented)

## Screenshots (if applicable)
```

### 9.3 Review Process

1. Create PR against `main` (or `develop`)
2. Automated checks run (lint, test, build)
3. Request review from team member
4. Address feedback
5. Squash and merge when approved

### 9.4 Merge Requirements

- All CI checks passing
- At least 1 approval
- No unresolved conversations
- Branch up to date with base

---

## 10. Troubleshooting

### 10.1 Common Issues

**Docker containers won't start:**
```bash
# Check Docker daemon
docker info

# Reset Docker resources
docker system prune -a
docker-compose down -v
docker-compose up -d
```

**Neo4j connection refused:**
```bash
# Wait for Neo4j to fully start
docker logs ally-neo4j --tail 50

# Reinitialize data
docker exec -i ally-neo4j cypher-shell -u neo4j -p allyfinancial < data/neo4j-init.cypher
```

**Frontend build fails:**
```bash
# Clear cache
rm -rf node_modules/.vite
npm run build
```

**Lambda deployment fails:**
```bash
# Check zip file size
ls -la lambda/*.zip

# Rebuild packages
cd lambda/functions/chat
rm -rf node_modules
npm install --production
```

### 10.2 Getting Help

1. Check existing documentation in `/docs`
2. Search closed issues/PRs
3. Ask in #atlas-dev Slack channel
4. Create GitHub issue with reproduction steps

### 10.3 Useful Commands

```bash
# View real-time logs
docker-compose logs -f

# Check Lambda logs (local)
tail -f logs/backend.log

# Check Lambda logs (AWS)
aws logs tail /aws/lambda/atlas-chat --follow

# Terraform state
cd terraform && terraform state list

# Database queries (Neo4j)
docker exec -it ally-neo4j cypher-shell -u neo4j -p allyfinancial
```

---

## Questions?

- **Slack:** #atlas-dev
- **Email:** atlas-team@ally.com
- **Wiki:** [Internal Wiki Link]

Thank you for contributing to ATLAS!

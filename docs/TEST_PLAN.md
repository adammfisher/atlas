# ATLAS Platform - Test Plan

**Version:** 1.0
**Last Updated:** January 2026
**Owner:** QA Engineering

---

## Table of Contents

1. [Overview](#1-overview)
2. [Test Strategy](#2-test-strategy)
3. [Test Environments](#3-test-environments)
4. [Test Categories](#4-test-categories)
5. [Test Cases](#5-test-cases)
6. [Automation Framework](#6-automation-framework)
7. [Performance Testing](#7-performance-testing)
8. [Security Testing](#8-security-testing)
9. [Test Data Management](#9-test-data-management)
10. [Reporting](#10-reporting)

---

## 1. Overview

### 1.1 Purpose

This document defines the testing strategy, test cases, and quality standards for the ATLAS platform. It ensures comprehensive coverage of functional, performance, security, and user experience requirements.

### 1.2 Scope

| In Scope | Out of Scope |
|----------|--------------|
| Web application (frontend) | AWS Bedrock service testing |
| Lambda functions (backend) | Third-party MCP servers |
| API endpoints | Mobile applications |
| Authentication/authorization | Browser compatibility (limited) |
| Data persistence | Load testing beyond 500 users |
| E2E user workflows | |

### 1.3 Quality Goals

| Metric | Target |
|--------|--------|
| Code coverage (unit) | >80% |
| E2E test pass rate | >95% |
| Critical bug escape rate | 0 |
| Test automation rate | >70% |

---

## 2. Test Strategy

### 2.1 Test Pyramid

```
                    ┌─────────────┐
                    │    E2E      │  10%
                    │   Tests     │
                    ├─────────────┤
                    │ Integration │  20%
                    │    Tests    │
                    ├─────────────┤
                    │    Unit     │  70%
                    │   Tests     │
                    └─────────────┘
```

### 2.2 Test Types

| Type | Purpose | Tools | Frequency |
|------|---------|-------|-----------|
| Unit | Individual functions | Jest | Every commit |
| Integration | API endpoints | Supertest | Every commit |
| E2E | User workflows | Playwright | Every PR |
| Performance | Load/stress | k6 | Weekly |
| Security | Vulnerability scan | OWASP ZAP | Weekly |
| Accessibility | WCAG compliance | Axe | Monthly |

### 2.3 Risk-Based Testing

| Feature | Risk Level | Testing Depth |
|---------|------------|---------------|
| Authentication | Critical | Exhaustive |
| Chat/Streaming | High | Comprehensive |
| Data persistence | High | Comprehensive |
| File upload | Medium | Standard |
| UI components | Low | Smoke tests |

---

## 3. Test Environments

### 3.1 Environment Matrix

| Environment | Purpose | Data | URL |
|-------------|---------|------|-----|
| Local | Development | Mock/seed | localhost:3000 |
| CI | Automated tests | Ephemeral | CI containers |
| Staging | Pre-production | Sanitized prod | staging.atlas.ally.com |
| Production | Live | Real | atlas.ally.com |

### 3.2 Environment Setup

**Local:**
```bash
./start.sh
# Seeds test data automatically
```

**CI (GitHub Actions):**
```yaml
services:
  dynamodb-local:
    image: amazon/dynamodb-local
  localstack:
    image: localstack/localstack
```

**Staging:**
- Deployed via CI/CD on merge to main
- Data refreshed weekly from sanitized production

---

## 4. Test Categories

### 4.1 Functional Testing

| Category | Coverage |
|----------|----------|
| Authentication | Login, logout, session management |
| Chat | Messages, streaming, models |
| Projects | CRUD, files, memory |
| Artifacts | Generation, rendering, versioning |
| Sessions | CRUD, history, starring |

### 4.2 Non-Functional Testing

| Category | Coverage |
|----------|----------|
| Performance | Response time, throughput, scalability |
| Security | Auth bypass, injection, XSS |
| Usability | Navigation, accessibility |
| Reliability | Error handling, recovery |
| Compatibility | Chrome, Firefox, Safari, Edge |

---

## 5. Test Cases

### 5.1 Authentication Tests

#### TC-AUTH-001: Successful Login
```
Precondition: Valid user exists
Steps:
1. Navigate to login page
2. Enter valid username
3. Enter valid password
4. Click login button
Expected: User redirected to dashboard, session created
```

#### TC-AUTH-002: Invalid Password
```
Precondition: Valid user exists
Steps:
1. Navigate to login page
2. Enter valid username
3. Enter invalid password
4. Click login button
Expected: Error message "Invalid credentials", no session created
```

#### TC-AUTH-003: Session Expiration
```
Precondition: User logged in
Steps:
1. Wait for token to expire (24h or mock)
2. Attempt API request
Expected: 401 response, redirect to login
```

#### TC-AUTH-004: Logout
```
Precondition: User logged in
Steps:
1. Click logout button
2. Attempt to access protected route
Expected: Cookie cleared, redirect to login
```

#### TC-AUTH-005: Registration
```
Precondition: Username not taken
Steps:
1. Navigate to registration
2. Enter unique username, email, password
3. Submit form
Expected: Account created, redirect to login
```

### 5.2 Chat Tests

#### TC-CHAT-001: Send Message (No Project)
```
Precondition: User logged in
Steps:
1. Navigate to chat
2. Type message
3. Press send
Expected: Message sent, streaming response received
```

#### TC-CHAT-002: Send Message (With Project)
```
Precondition: User in project context
Steps:
1. Open project
2. Start new chat
3. Send message
Expected: Project context included, response references project
```

#### TC-CHAT-003: Model Selection
```
Precondition: User logged in
Steps:
1. Select "Sonnet" model
2. Send message
Expected: Response generated with Sonnet model
```

#### TC-CHAT-004: File Upload
```
Precondition: User logged in
Steps:
1. Attach PDF file (<4.5MB)
2. Send message about file
Expected: File processed, response references content
```

#### TC-CHAT-005: Large File Rejection
```
Precondition: User logged in
Steps:
1. Attempt to attach >4.5MB file
Expected: Error message about size limit
```

#### TC-CHAT-006: Extended Thinking
```
Precondition: User logged in
Steps:
1. Enable extended thinking toggle
2. Send complex question
Expected: Thinking content shown, then response
```

#### TC-CHAT-007: Web Search
```
Precondition: User logged in, web search enabled
Steps:
1. Ask current events question
2. Observe response
Expected: Search indicator, sources cited
```

#### TC-CHAT-008: Streaming Interruption
```
Precondition: Message being streamed
Steps:
1. Start message
2. Navigate away mid-stream
3. Return to chat
Expected: Partial response saved, can continue
```

### 5.3 Project Tests

#### TC-PROJ-001: Create Project
```
Precondition: User logged in
Steps:
1. Click new project
2. Enter name, description
3. Save
Expected: Project created, appears in list
```

#### TC-PROJ-002: Upload File
```
Precondition: Project exists
Steps:
1. Open project
2. Upload markdown file
3. Verify in file list
Expected: File uploaded, token count shown
```

#### TC-PROJ-003: Pin File
```
Precondition: Project with files
Steps:
1. Click pin icon on file
2. Start new chat in project
Expected: Pinned file included in context
```

#### TC-PROJ-004: Project Memory
```
Precondition: Project with chat history
Steps:
1. Open project memory
2. View sections
Expected: Memory shows purpose, state, learnings
```

#### TC-PROJ-005: Edit Memory
```
Precondition: Project memory exists
Steps:
1. Edit memory section
2. Save changes
Expected: Memory updated, version incremented
```

#### TC-PROJ-006: Delete Project
```
Precondition: Project exists with data
Steps:
1. Click delete project
2. Confirm deletion
Expected: Project, files, memory deleted
```

### 5.4 Artifact Tests

#### TC-ART-001: Generate Artifact
```
Precondition: User in chat
Steps:
1. Ask to create a diagram
2. Observe artifact panel
Expected: Artifact generated, streaming preview shown
```

#### TC-ART-002: Render Mermaid
```
Precondition: Mermaid artifact exists
Steps:
1. Click artifact
2. View preview
Expected: Mermaid diagram rendered correctly
```

#### TC-ART-003: Update Artifact
```
Precondition: Artifact exists
Steps:
1. Ask to modify the artifact
2. Observe artifact panel
Expected: Same artifact updated, version incremented
```

#### TC-ART-004: Download Artifact
```
Precondition: Artifact exists
Steps:
1. Click download button
Expected: File downloaded with correct extension
```

#### TC-ART-005: Copy Artifact
```
Precondition: Artifact exists
Steps:
1. Click copy button
Expected: Content copied to clipboard
```

### 5.5 Session Tests

#### TC-SESS-001: Create Session
```
Precondition: User logged in
Steps:
1. Click new chat
2. Send first message
Expected: Session created with auto-title
```

#### TC-SESS-002: List Sessions
```
Precondition: Multiple sessions exist
Steps:
1. Open session list
Expected: Sessions shown, sorted by recent
```

#### TC-SESS-003: Star Session
```
Precondition: Session exists
Steps:
1. Click star icon
Expected: Session starred, appears in starred filter
```

#### TC-SESS-004: Delete Session
```
Precondition: Session with messages
Steps:
1. Click delete session
2. Confirm deletion
Expected: Session and messages deleted
```

#### TC-SESS-005: Resume Session
```
Precondition: Session with history
Steps:
1. Select previous session
2. Send new message
Expected: Context from history preserved
```

### 5.6 Error Handling Tests

#### TC-ERR-001: Network Failure
```
Precondition: User in chat
Steps:
1. Disable network
2. Send message
Expected: Clear error message, retry option
```

#### TC-ERR-002: Server Error
```
Precondition: Simulate 500 error
Steps:
1. Trigger error condition
Expected: User-friendly error, no sensitive info
```

#### TC-ERR-003: Rate Limit
```
Precondition: User logged in
Steps:
1. Send many requests rapidly
Expected: Rate limit message, backoff guidance
```

---

## 6. Automation Framework

### 6.1 Playwright Configuration

```javascript
// playwright.config.js
module.exports = {
  testDir: './tests/e2e',
  timeout: 60000,
  retries: 2,
  workers: 4,
  reporter: [
    ['html', { outputFolder: 'test-results/html-report' }],
    ['junit', { outputFile: 'test-results/junit.xml' }]
  ],
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure'
  },
  projects: [
    { name: 'chromium', use: { browserName: 'chromium' } },
    { name: 'firefox', use: { browserName: 'firefox' } }
  ]
};
```

### 6.2 Test Structure

```javascript
// tests/e2e/chat.spec.js
const { test, expect } = require('@playwright/test');
const { login } = require('./helpers/auth');

test.describe('Chat Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await login(page);
  });

  test('should send message and receive response', async ({ page }) => {
    // Arrange
    await page.goto('/');

    // Act
    await page.fill('[data-testid="chat-input"]', 'Hello');
    await page.click('[data-testid="send-button"]');

    // Assert
    await expect(page.locator('.message.assistant')).toBeVisible();
  });
});
```

### 6.3 CI Integration

```yaml
# .github/workflows/test.yml
test:
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx playwright install --with-deps
    - run: npm run test:e2e
    - uses: actions/upload-artifact@v4
      with:
        name: test-results
        path: test-results/
```

---

## 7. Performance Testing

### 7.1 Performance Requirements

| Metric | Target | Critical |
|--------|--------|----------|
| Page load | <3s | <5s |
| API response (P95) | <2s | <5s |
| Chat first token | <3s | <5s |
| Concurrent users | 100 | 50 |

### 7.2 k6 Load Test

```javascript
// tests/performance/chat-load.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Steady state
    { duration: '2m', target: 100 },  // Peak
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.01'],
  },
};

export default function () {
  const res = http.post(
    `${__ENV.BASE_URL}/api/chat/message`,
    JSON.stringify({ message: 'Hello', model: 'haiku' }),
    { headers: { 'Content-Type': 'application/json' } }
  );

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 2000,
  });

  sleep(1);
}
```

### 7.3 Performance Test Schedule

| Test | Frequency | Environment |
|------|-----------|-------------|
| Smoke (10 users) | Daily | Staging |
| Load (50 users) | Weekly | Staging |
| Stress (100 users) | Monthly | Staging |
| Soak (8 hours) | Quarterly | Staging |

---

## 8. Security Testing

### 8.1 Security Test Cases

#### TC-SEC-001: SQL/NoSQL Injection
```
Steps:
1. Enter malicious input in all text fields
2. Include DynamoDB expression syntax
Expected: Input sanitized, no data leakage
```

#### TC-SEC-002: XSS
```
Steps:
1. Enter <script> tags in chat
2. Observe rendering
Expected: Script not executed, content escaped
```

#### TC-SEC-003: Authentication Bypass
```
Steps:
1. Access protected endpoints without token
2. Use expired/invalid tokens
Expected: 401 response, no data access
```

#### TC-SEC-004: Authorization
```
Steps:
1. Attempt to access other user's data
2. Modify userId in requests
Expected: 403 response, data isolated
```

#### TC-SEC-005: Sensitive Data Exposure
```
Steps:
1. Review all API responses
2. Check error messages
Expected: No passwords, keys, or internal info
```

### 8.2 OWASP ZAP Scan

```bash
# Automated security scan
docker run -t owasp/zap2docker-stable zap-baseline.py \
  -t https://staging.atlas.ally.com \
  -r zap-report.html
```

### 8.3 Security Test Schedule

| Test | Frequency |
|------|-----------|
| OWASP ZAP baseline | Weekly |
| Dependency audit | Daily (CI) |
| Penetration test | Quarterly |
| Security review | Per release |

---

## 9. Test Data Management

### 9.1 Test Users

| User | Role | Purpose |
|------|------|---------|
| testuser1 | user | General testing |
| testuser2 | user | Multi-user scenarios |
| testadmin | admin | Admin functionality |
| loadtest | user | Performance tests |

### 9.2 Test Data Fixtures

```javascript
// tests/fixtures/data.js
export const testProject = {
  name: 'Test Project',
  description: 'For automated testing',
  instructions: 'Follow test patterns'
};

export const testSession = {
  title: 'Test Chat',
  messages: [
    { role: 'user', content: 'Hello' },
    { role: 'assistant', content: 'Hi there!' }
  ]
};
```

### 9.3 Data Cleanup

```javascript
// tests/helpers/cleanup.js
async function cleanupTestData(userId) {
  // Delete test sessions
  const sessions = await listSessions(userId);
  for (const session of sessions) {
    if (session.title.startsWith('Test')) {
      await deleteSession(session.id);
    }
  }

  // Delete test projects
  const projects = await listProjects(userId);
  for (const project of projects) {
    if (project.name.startsWith('Test')) {
      await deleteProject(project.id);
    }
  }
}
```

---

## 10. Reporting

### 10.1 Test Reports

| Report | Audience | Frequency |
|--------|----------|-----------|
| CI test results | Dev team | Per commit |
| E2E summary | QA/Dev | Daily |
| Performance report | Platform team | Weekly |
| Security report | Security team | Weekly |
| Quality dashboard | Leadership | Monthly |

### 10.2 Defect Tracking

| Severity | Response Time | Resolution Time |
|----------|---------------|-----------------|
| Critical | Immediate | 24 hours |
| High | 4 hours | 3 days |
| Medium | 1 day | 1 week |
| Low | 1 week | 1 sprint |

### 10.3 Quality Metrics Dashboard

```
┌────────────────────────────────────────────────────────┐
│                  ATLAS Quality Dashboard                │
├────────────────────────────────────────────────────────┤
│                                                        │
│  Test Results (Last 7 Days)                           │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ████████████████████████████░░░░░ 92% Pass      │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Code Coverage                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │ ██████████████████████████████░░░░ 85%          │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  Open Bugs: 12 (2 Critical, 4 High, 6 Medium)         │
│                                                        │
│  Performance (P95):                                    │
│  - API: 1.2s ✓                                        │
│  - Chat: 2.8s ✓                                       │
│  - Page Load: 2.1s ✓                                  │
│                                                        │
└────────────────────────────────────────────────────────┘
```

---

## Appendix A: Test Commands

```bash
# Unit tests
npm test

# E2E tests (all)
npm run test:e2e

# E2E tests (specific)
npm run test:e2e -- --grep "auth"
npm run test:chat
npm run test:projects

# Debug mode
npm run test:debug

# Generate report
npm run test:report

# Performance tests
k6 run tests/performance/chat-load.js

# Security scan
npm run security:scan
```

## Appendix B: Test Environment Variables

```bash
# .env.test
BASE_URL=http://localhost:3000
API_URL=http://localhost:8000/api
TEST_USER=testuser1
TEST_PASSWORD=TestPass123!
HEADLESS=true
SLOW_MO=0
```

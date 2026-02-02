# ATLAS Platform - Security Architecture Document

**Version:** 1.0
**Last Updated:** January 2026
**Classification:** Internal
**Owner:** Platform Security Team

---

## Table of Contents

1. [Security Overview](#1-security-overview)
2. [Authentication & Authorization](#2-authentication--authorization)
3. [Data Protection](#3-data-protection)
4. [Network Security](#4-network-security)
5. [Application Security](#5-application-security)
6. [Compliance Mapping](#6-compliance-mapping)
7. [Threat Model](#7-threat-model)
8. [Security Controls](#8-security-controls)
9. [Incident Response](#9-incident-response)
10. [Security Checklist](#10-security-checklist)

---

## 1. Security Overview

### 1.1 Security Principles

| Principle | Implementation |
|-----------|----------------|
| **Defense in Depth** | Multiple security layers (network, application, data) |
| **Least Privilege** | IAM roles scoped to minimum required permissions |
| **Zero Trust** | All requests authenticated; no implicit trust |
| **Data Minimization** | Collect only necessary data; enforce retention |
| **Audit Everything** | Comprehensive logging of security events |

### 1.2 Security Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                    ATLAS Security Architecture                       │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Internet                                                           │
│     │                                                               │
│     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              CloudFront (WAF, TLS 1.2+)                 │       │
│  │              - DDoS protection (Shield)                  │       │
│  │              - Geographic restrictions                   │       │
│  │              - Request rate limiting                     │       │
│  └─────────────────────────────────────────────────────────┘       │
│     │                                                               │
│     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              API Gateway (HTTP API)                      │       │
│  │              - CORS enforcement                          │       │
│  │              - Request validation                        │       │
│  │              - Access logging                            │       │
│  └─────────────────────────────────────────────────────────┘       │
│     │                                                               │
│     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              Lambda Functions                            │       │
│  │              - JWT validation (every request)            │       │
│  │              - User isolation (userId partition)         │       │
│  │              - Input sanitization                        │       │
│  │              - IAM execution roles                       │       │
│  └─────────────────────────────────────────────────────────┘       │
│     │                                                               │
│     ▼                                                               │
│  ┌─────────────────────────────────────────────────────────┐       │
│  │              Data Layer                                  │       │
│  │  ┌───────────────┐  ┌───────────────┐  ┌─────────────┐  │       │
│  │  │   DynamoDB    │  │      S3       │  │   SSM       │  │       │
│  │  │ - Encryption  │  │ - Encryption  │  │ - Secrets   │  │       │
│  │  │   at rest     │  │   at rest     │  │   (KMS)     │  │       │
│  │  │ - VPC access  │  │ - VPC access  │  │             │  │       │
│  │  └───────────────┘  └───────────────┘  └─────────────┘  │       │
│  └─────────────────────────────────────────────────────────┘       │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

### 1.3 Trust Boundaries

| Boundary | Description | Controls |
|----------|-------------|----------|
| Internet → CloudFront | External users | WAF, TLS, DDoS protection |
| CloudFront → API Gateway | CDN to API | Origin authentication |
| API Gateway → Lambda | API to compute | IAM roles, VPC |
| Lambda → Data stores | Compute to data | IAM roles, encryption |
| Lambda → Bedrock | Compute to AI | IAM roles, guardrails |

---

## 2. Authentication & Authorization

### 2.1 Authentication Flow

```
┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐
│  Client  │────►│  Login   │────►│  Verify  │────►│  Issue   │
│          │     │  Request │     │ Password │     │   JWT    │
└──────────┘     └──────────┘     └──────────┘     └──────────┘
     │                                                   │
     │           ┌──────────────────────────────────────┘
     │           │
     ▼           ▼
┌──────────┐     ┌──────────┐
│  Store   │◄────│   JWT    │
│  Cookie  │     │  Token   │
│ (HttpOnly│     │          │
│  Secure) │     │          │
└──────────┘     └──────────┘
```

### 2.2 JWT Token Structure

```javascript
// Header
{
  "alg": "HS256",
  "typ": "JWT"
}

// Payload
{
  "userId": "usr_abc123def456",    // User identifier
  "username": "jsmith",            // Login name
  "displayName": "John Smith",     // Display name
  "role": "user",                  // Role (user/admin)
  "iat": 1706000000,              // Issued at
  "exp": 1706086400               // Expires (24h)
}

// Signature
HMACSHA256(
  base64UrlEncode(header) + "." + base64UrlEncode(payload),
  secret
)
```

### 2.3 Password Security

| Aspect | Implementation |
|--------|----------------|
| Hashing | bcrypt with cost factor 12 |
| Minimum length | 8 characters |
| Complexity | Recommended but not enforced (MVP) |
| Storage | DynamoDB (passwordHash field) |
| Comparison | Constant-time via bcrypt.compare() |

### 2.4 Session Security

| Control | Implementation |
|---------|----------------|
| Token delivery | HTTP-only, Secure, SameSite=Lax cookie |
| Token lifetime | 24 hours |
| Token refresh | Not implemented (re-login required) |
| Logout | Cookie cleared with Max-Age=0 |
| Concurrent sessions | Allowed (no limit) |

### 2.5 Authorization Model

```
User ──► Token ──► Lambda ──► Check userId ──► Access Data
                      │
                      ├── userId in partition key (DynamoDB)
                      └── userId prefix in S3 keys
```

**User Isolation Rules:**
- DynamoDB: All tables use `userId` as partition key or filter
- S3: All objects prefixed with `{userId}/`
- GSI queries: Always include `userId` filter

### 2.6 Role-Based Access

| Role | Capabilities |
|------|-------------|
| `user` | Full access to own data |
| `admin` | User capabilities + admin endpoints (future) |

---

## 3. Data Protection

### 3.1 Data Classification

| Classification | Description | Examples |
|----------------|-------------|----------|
| **Confidential** | User credentials | Passwords, JWT secrets |
| **Private** | User-generated content | Chat messages, artifacts |
| **Internal** | System data | Session metadata, logs |
| **Public** | Non-sensitive | Static frontend assets |

### 3.2 Encryption at Rest

| Service | Encryption | Key Management |
|---------|------------|----------------|
| DynamoDB | AES-256 (default) | AWS managed keys |
| S3 | AES-256 (SSE-S3) | AWS managed keys |
| SSM Parameters | AES-256 | AWS KMS (SecureString) |
| CloudWatch Logs | AES-256 | AWS managed keys |

### 3.3 Encryption in Transit

| Connection | Protocol | Minimum Version |
|------------|----------|-----------------|
| Client → CloudFront | HTTPS | TLS 1.2 |
| CloudFront → API Gateway | HTTPS | TLS 1.2 |
| Lambda → DynamoDB | HTTPS | TLS 1.2 |
| Lambda → S3 | HTTPS | TLS 1.2 |
| Lambda → Bedrock | HTTPS | TLS 1.2 |

### 3.4 Sensitive Data Handling

**PII Detection & Masking:**
```javascript
// Patterns to detect (logged, not stored raw)
- SSN: /\d{3}-\d{2}-\d{4}/
- Credit Card: /\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}/
- Email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/

// Masking in logs
SSN: ***-**-1234
Card: ****-****-****-1234
Email: j***@example.com
```

**Secret Management:**
| Secret | Storage | Access |
|--------|---------|--------|
| JWT signing key | SSM Parameter Store (SecureString) | Lambda IAM role |
| Database credentials | N/A (IAM auth) | Lambda IAM role |
| API keys | SSM Parameter Store | Lambda IAM role |

### 3.5 Data Retention

| Data Type | Retention | Deletion Method |
|-----------|-----------|-----------------|
| Chat messages | Indefinite | User-initiated |
| Session metadata | Indefinite | User-initiated |
| Artifacts | Indefinite | User-initiated |
| CloudWatch Logs | 14-30 days | Automatic |
| Conversation summaries | 7 days | TTL |

---

## 4. Network Security

### 4.1 Network Architecture

```
                        ┌─────────────────────────┐
                        │        Internet         │
                        └───────────┬─────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │         AWS Shield            │
                    │       (DDoS Protection)       │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │       AWS WAF (Optional)      │
                    │    - SQL injection rules      │
                    │    - XSS rules               │
                    │    - Rate limiting           │
                    └───────────────┬───────────────┘
                                    │
                    ┌───────────────┴───────────────┐
                    │         CloudFront            │
                    │    - TLS termination         │
                    │    - Origin shield           │
                    │    - Geo restrictions        │
                    └───────────────┬───────────────┘
                                    │
        ┌───────────────────────────┼───────────────────────────┐
        │                           │                           │
        ▼                           ▼                           ▼
┌───────────────┐         ┌───────────────┐         ┌───────────────┐
│      S3       │         │  API Gateway  │         │ Lambda URL    │
│  (Frontend)   │         │   (HTTP API)  │         │  (Streaming)  │
└───────────────┘         └───────┬───────┘         └───────┬───────┘
                                  │                         │
                          ┌───────┴───────┐         ┌───────┴───────┐
                          │    Lambda     │         │    Lambda     │
                          │  Functions    │         │   (Stream)    │
                          └───────────────┘         └───────────────┘
```

### 4.2 CORS Configuration

```javascript
// API Gateway CORS
{
  allow_origins: ["https://atlas.example.com", "http://localhost:3000"],
  allow_methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allow_headers: ["Content-Type", "Authorization", "X-User-Id", "Cookie"],
  allow_credentials: true,
  max_age: 3600
}

// Lambda Function URL CORS
{
  allow_origins: ["https://atlas.example.com", "http://localhost:3000"],
  allow_methods: ["*"],
  allow_headers: ["content-type", "authorization", "x-user-id"],
  allow_credentials: true,
  max_age: 86400
}
```

### 4.3 Rate Limiting

| Endpoint | Limit | Window |
|----------|-------|--------|
| /api/auth/* | 10 requests | 1 minute |
| /api/chat/* | 60 requests | 1 minute |
| /api/* (default) | 100 requests | 1 minute |

### 4.4 IP Restrictions (Future)

```javascript
// WAF IP Set (when implemented)
{
  "Name": "AllowedIPs",
  "Scope": "CLOUDFRONT",
  "IPAddressVersion": "IPV4",
  "Addresses": [
    "10.0.0.0/8",      // Internal network
    "172.16.0.0/12"    // VPN network
  ]
}
```

---

## 5. Application Security

### 5.1 Input Validation

**Request Body Validation:**
```javascript
// Chat message validation
const MAX_MESSAGE_LENGTH = 100000;  // ~25K tokens
const MAX_FILE_SIZE_MB = 4.5;

if (!message && files.length === 0) {
  return badRequest('Message or files required');
}

if (message && message.length > MAX_MESSAGE_LENGTH) {
  return badRequest('Message too long');
}

for (const file of files) {
  const fileSizeBytes = (file.base64.length * 3) / 4;
  if (fileSizeBytes > MAX_FILE_SIZE_MB * 1024 * 1024) {
    return badRequest(`File too large: ${file.name}`);
  }
}
```

### 5.2 Output Encoding

**Artifact Content:**
- HTML artifacts rendered in sandboxed iframe
- SVG sanitized before inline rendering
- Markdown rendered with XSS-safe library
- Code displayed with syntax highlighting (no execution)

### 5.3 Injection Prevention

| Vector | Prevention |
|--------|------------|
| SQL Injection | No SQL database (DynamoDB) |
| NoSQL Injection | SDK parameterization |
| Command Injection | No shell execution |
| XSS | React auto-escaping, CSP headers |
| SSRF | No user-controlled URLs to internal services |

### 5.4 Dependency Security

```bash
# Regular dependency audits
npm audit

# Automated via CI/CD
- Dependabot alerts enabled
- npm audit in build pipeline
- Snyk scanning (recommended)
```

### 5.5 Error Handling

```javascript
// Sanitized error responses
function serverError(message) {
  // Never expose stack traces or internal details
  console.error('Internal error:', message);
  return {
    statusCode: 500,
    body: JSON.stringify({ error: 'Internal server error' })
  };
}

// Auth errors don't leak user existence
function authError() {
  return {
    statusCode: 401,
    body: JSON.stringify({ error: 'Invalid credentials' })
  };
}
```

---

## 6. Compliance Mapping

### 6.1 PCI-DSS

| Requirement | ATLAS Implementation |
|-------------|---------------------|
| 3.4 Render PAN unreadable | No cardholder data stored |
| 4.1 Encrypt transmission | TLS 1.2+ everywhere |
| 6.5 Secure coding | Input validation, OWASP controls |
| 8.2 Unique IDs | userId per user, sessionId per session |
| 10.2 Audit trails | CloudWatch, CloudTrail logging |

### 6.2 SOC2

| Trust Service Criteria | ATLAS Implementation |
|------------------------|---------------------|
| CC6.1 Logical access | JWT auth, user isolation |
| CC6.6 System boundaries | CloudFront WAF, CORS |
| CC7.2 Monitoring | CloudWatch alerts, logging |
| CC8.1 Change management | CI/CD pipeline, Terraform |
| PI1.1 Privacy notice | Terms of service (to be added) |

### 6.3 GLBA

| Requirement | ATLAS Implementation |
|-------------|---------------------|
| Data protection | Encryption at rest and in transit |
| Access controls | Authentication required |
| Safeguards | User data isolation |
| Disposal | Retention policies, user deletion |

### 6.4 FFIEC

| Requirement | ATLAS Implementation |
|-------------|---------------------|
| Risk assessment | Threat model documented |
| Authentication | Multi-factor (planned) |
| Access management | Role-based access |
| Audit | Comprehensive logging |

---

## 7. Threat Model

### 7.1 STRIDE Analysis

| Threat | Asset | Mitigation |
|--------|-------|------------|
| **Spoofing** | User identity | JWT validation, secure cookies |
| **Tampering** | Chat data | DynamoDB consistency, S3 versioning |
| **Repudiation** | User actions | CloudWatch logs, CloudTrail |
| **Info Disclosure** | User data | Encryption, access control |
| **DoS** | Platform availability | CloudFront, rate limiting |
| **Elevation** | Admin access | Role enforcement |

### 7.2 Attack Surface

| Surface | Exposure | Mitigations |
|---------|----------|-------------|
| CloudFront (Public) | High | WAF, TLS, DDoS protection |
| API Gateway (Public) | High | CORS, rate limiting |
| Lambda URLs (Public) | Medium | Auth validation |
| S3 (Private) | Low | No public access |
| DynamoDB (Private) | Low | VPC endpoints, IAM |

### 7.3 Data Flow Threats

```
User Input → Chat Lambda → Bedrock
     │            │
     │            └─── Threat: Prompt injection
     │                 Mitigation: System prompt separation
     │
     └─── Threat: Malicious file upload
          Mitigation: File size limits, type validation
```

### 7.4 Top Risks

| Risk | Likelihood | Impact | Mitigation Status |
|------|------------|--------|-------------------|
| Credential theft | Medium | High | Implemented (JWT, bcrypt) |
| Data exfiltration | Low | Critical | Implemented (isolation) |
| Prompt injection | Medium | Medium | Partial (guardrails planned) |
| DDoS | Medium | High | Implemented (CloudFront) |
| Insider threat | Low | High | Partial (audit logging) |

---

## 8. Security Controls

### 8.1 IAM Policies

**Lambda Execution Role:**
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": [
        "arn:aws:dynamodb:*:*:table/atlas-*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:PutObject",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::atlas-uploads/*",
        "arn:aws:s3:::atlas-artifacts/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "bedrock:InvokeModel",
        "bedrock:InvokeModelWithResponseStream"
      ],
      "Resource": [
        "arn:aws:bedrock:*:*:foundation-model/anthropic.*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "ssm:GetParameter"
      ],
      "Resource": [
        "arn:aws:ssm:*:*:parameter/atlas/*"
      ]
    }
  ]
}
```

### 8.2 S3 Bucket Policies

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "DenyPublicAccess",
      "Effect": "Deny",
      "Principal": "*",
      "Action": "s3:*",
      "Resource": [
        "arn:aws:s3:::atlas-uploads/*",
        "arn:aws:s3:::atlas-artifacts/*"
      ],
      "Condition": {
        "Bool": {
          "aws:SecureTransport": "false"
        }
      }
    }
  ]
}
```

### 8.3 CloudWatch Alarms

| Alarm | Condition | Action |
|-------|-----------|--------|
| High Error Rate | >10 5xx in 5 min | PagerDuty alert |
| Auth Failures | >50 401s in 5 min | PagerDuty alert |
| Unusual API Traffic | >3σ from baseline | Slack notification |
| DynamoDB Throttle | Any throttle | Slack notification |

### 8.4 Security Logging

```javascript
// Security events logged
- Login success/failure (with masked IP)
- Token validation failure
- Permission denied (userId mismatch)
- Rate limit exceeded
- Invalid input rejected
- Unusual request patterns
```

---

## 9. Incident Response

### 9.1 Security Incident Classification

| Severity | Description | Response Time |
|----------|-------------|---------------|
| Critical | Data breach, system compromise | Immediate |
| High | Auth bypass, privilege escalation | 1 hour |
| Medium | Suspicious activity, failed attacks | 4 hours |
| Low | Policy violations, minor issues | 24 hours |

### 9.2 Incident Response Steps

1. **Detect**: Automated alerts or user reports
2. **Contain**: Isolate affected systems
3. **Eradicate**: Remove threat actor access
4. **Recover**: Restore normal operations
5. **Learn**: Post-incident review

### 9.3 Security Contacts

| Role | Contact |
|------|---------|
| Security Lead | security@example.com |
| On-Call | PagerDuty: ATLAS-Security |
| AWS Support | AWS Support Console |

### 9.4 Evidence Preservation

```bash
# Preserve CloudWatch Logs
aws logs create-export-task \
  --log-group-name /aws/lambda/atlas-chat \
  --from $(date -d '24 hours ago' +%s000) \
  --to $(date +%s000) \
  --destination atlas-security-exports \
  --destination-prefix incident-$(date +%Y%m%d)

# Preserve CloudTrail
aws cloudtrail lookup-events \
  --start-time $(date -d '24 hours ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --output json > incident-cloudtrail.json
```

---

## 10. Security Checklist

### 10.1 Development Checklist

- [ ] Input validation on all endpoints
- [ ] Output encoding for user data
- [ ] JWT validation on every request
- [ ] userId isolation in all queries
- [ ] No secrets in code or logs
- [ ] Error messages don't leak info
- [ ] Dependencies audited

### 10.2 Deployment Checklist

- [ ] HTTPS enforced (no HTTP)
- [ ] CORS configured correctly
- [ ] IAM roles follow least privilege
- [ ] S3 buckets not public
- [ ] CloudWatch logging enabled
- [ ] CloudTrail enabled
- [ ] Secrets in SSM/KMS

### 10.3 Operational Checklist

- [ ] Security alerts configured
- [ ] Log retention configured
- [ ] Backup encryption verified
- [ ] Access reviews scheduled
- [ ] Penetration testing scheduled
- [ ] Incident response plan tested

---

## Appendix A: Security Headers

```javascript
// Recommended security headers (CloudFront)
{
  "Content-Security-Policy": "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY",
  "X-XSS-Protection": "1; mode=block",
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
  "Referrer-Policy": "strict-origin-when-cross-origin"
}
```

## Appendix B: Security Testing

```bash
# OWASP ZAP scan
docker run -t owasp/zap2docker-stable zap-baseline.py -t https://atlas.example.com

# SSL/TLS check
testssl.sh https://atlas.example.com

# Security headers check
curl -I https://atlas.example.com | grep -E '^(X-|Content-Security|Strict)'
```

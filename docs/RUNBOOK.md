# ATLAS Platform - Production Runbook

**Version:** 1.0
**Last Updated:** January 2026
**On-Call Team:** Platform Engineering

---

## Table of Contents

1. [Service Overview](#1-service-overview)
2. [Architecture Diagram](#2-architecture-diagram)
3. [Monitoring & Alerts](#3-monitoring--alerts)
4. [Common Issues & Resolutions](#4-common-issues--resolutions)
5. [Deployment Procedures](#5-deployment-procedures)
6. [Rollback Procedures](#6-rollback-procedures)
7. [Disaster Recovery](#7-disaster-recovery)
8. [Escalation Paths](#8-escalation-paths)
9. [Maintenance Windows](#9-maintenance-windows)
10. [Runbook Checklist](#10-runbook-checklist)

---

## 1. Service Overview

### 1.1 What is ATLAS?

ATLAS is an enterprise AI development platform providing Claude-powered coding assistance with enterprise context. It consists of:

- **Web Application**: React frontend served via CloudFront
- **API Layer**: Lambda functions behind API Gateway
- **Data Layer**: DynamoDB tables, S3 buckets
- **AI Layer**: AWS Bedrock (Claude models)
- **Memory Layer**: S3 Vectors for semantic search

### 1.2 Service Endpoints

| Service | URL | Health Check |
|---------|-----|--------------|
| Frontend | https://atlas.example.com | GET / (200) |
| API | https://api.atlas.example.com | GET /health (200) |
| Streaming | https://stream.atlas.example.com | N/A (Lambda URL) |

### 1.3 Dependencies

| Dependency | Impact if Down | Fallback |
|------------|----------------|----------|
| AWS Bedrock | Chat non-functional | None (critical) |
| DynamoDB | All operations fail | None (critical) |
| S3 | Files/artifacts unavailable | Degraded mode |
| CloudFront | Frontend unavailable | Direct S3 (manual) |
| SSM Parameter Store | Auth fails on cold start | Cached in Lambda |

### 1.4 SLAs

| Metric | Target | Measurement |
|--------|--------|-------------|
| Availability | 99.5% | CloudWatch synthetic monitoring |
| API Latency (P95) | <2s | API Gateway metrics |
| Chat First Token | <3s | Custom metric |
| Error Rate | <1% | Lambda error metrics |

---

## 2. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│                         ATLAS Production                            │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│  Users ──► CloudFront ──► S3 (Frontend)                            │
│              │                                                      │
│              ▼                                                      │
│         API Gateway ──► Lambda Functions                            │
│              │            ├── chat (+ chat-stream via URL)         │
│              │            ├── auth                                  │
│              │            ├── sessions                              │
│              │            ├── projects                              │
│              │            ├── files                                 │
│              │            ├── artifacts                             │
│              │            └── mcp-config                            │
│              │                    │                                 │
│              │                    ▼                                 │
│              │         ┌─────────────────────┐                      │
│              │         │    AWS Bedrock      │                      │
│              │         │ (Claude Haiku/      │                      │
│              │         │  Sonnet/Opus)       │                      │
│              │         └─────────────────────┘                      │
│              │                                                      │
│              ▼                                                      │
│  ┌──────────────────────────────────────────────────────┐          │
│  │                   Data Layer                          │          │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐   │          │
│  │  │  DynamoDB   │  │     S3      │  │ S3 Vectors  │   │          │
│  │  │  - sessions │  │  - uploads  │  │ - memories  │   │          │
│  │  │  - messages │  │  - artifacts│  │ - convos    │   │          │
│  │  │  - projects │  │             │  │             │   │          │
│  │  │  - users    │  │             │  │             │   │          │
│  │  └─────────────┘  └─────────────┘  └─────────────┘   │          │
│  └──────────────────────────────────────────────────────┘          │
│                                                                     │
│  ┌──────────────────────────────────────────────────────┐          │
│  │                 Observability                         │          │
│  │  CloudWatch Logs │ CloudWatch Metrics │ X-Ray Traces │          │
│  └──────────────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 3. Monitoring & Alerts

### 3.1 CloudWatch Dashboards

| Dashboard | Purpose | URL |
|-----------|---------|-----|
| ATLAS-Overview | High-level health | [Link] |
| ATLAS-API | API Gateway metrics | [Link] |
| ATLAS-Lambda | Lambda function metrics | [Link] |
| ATLAS-Bedrock | AI model usage | [Link] |

### 3.2 Key Metrics

| Metric | Alarm Threshold | Action |
|--------|-----------------|--------|
| API 5xx Errors | >10 in 5 min | Page on-call |
| Lambda Duration | >4 min (chat) | Investigate |
| DynamoDB Throttles | >0 | Increase capacity |
| Bedrock Throttles | >10 in 5 min | Check quotas |
| CloudFront 5xx | >1% | Check origin |

### 3.3 Log Groups

| Log Group | Retention | Contents |
|-----------|-----------|----------|
| /aws/lambda/atlas-chat | 14 days | Chat function logs |
| /aws/lambda/atlas-auth | 14 days | Auth events |
| /aws/apigateway/atlas-api | 14 days | API access logs |
| /atlas/application | 30 days | Application errors |

### 3.4 Log Query Examples

**Find errors in chat function:**
```
fields @timestamp, @message
| filter @logStream like /atlas-chat/
| filter @message like /ERROR/
| sort @timestamp desc
| limit 100
```

**Find slow requests:**
```
fields @timestamp, @requestId, @duration
| filter @duration > 10000
| sort @duration desc
| limit 50
```

**Find auth failures:**
```
fields @timestamp, @message
| filter @message like /401/ or @message like /Invalid/
| sort @timestamp desc
| limit 100
```

---

## 4. Common Issues & Resolutions

### 4.1 Chat Not Responding

**Symptoms:**
- Users report chat hangs
- No streaming response
- Timeout errors

**Diagnosis:**
```bash
# Check Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-chat-stream \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)

# Check Bedrock throttling
aws cloudwatch get-metric-statistics \
  --namespace AWS/Bedrock \
  --metric-name ThrottledRequests \
  --dimensions Name=ModelId,Value=anthropic.claude-3-haiku-20240307-v1:0 \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 300 \
  --statistics Sum
```

**Resolution:**
1. If Bedrock throttling: Request quota increase or switch to fallback model
2. If Lambda timeout: Check conversation history size, consider compaction
3. If network: Verify VPC endpoints, security groups

### 4.2 Authentication Failures

**Symptoms:**
- Users can't login
- 401 errors on all requests
- "Invalid token" errors

**Diagnosis:**
```bash
# Check auth Lambda errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-auth \
  --filter-pattern "ERROR" \
  --start-time $(date -d '30 minutes ago' +%s000)

# Verify JWT secret in SSM
aws ssm get-parameter \
  --name /atlas/jwt-secret \
  --with-decryption \
  --query 'Parameter.Version'
```

**Resolution:**
1. If JWT secret rotated: Update SSM parameter, redeploy Lambdas
2. If DynamoDB issue: Check users table, verify GSI status
3. If bcrypt issue: Check Lambda memory (bcrypt is CPU intensive)

### 4.3 High Latency

**Symptoms:**
- Chat responses slow
- API calls timing out
- Users complaining about speed

**Diagnosis:**
```bash
# Check Lambda cold starts
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-chat \
  --filter-pattern "INIT_START" \
  --start-time $(date -d '1 hour ago' +%s000)

# Check DynamoDB latency
aws cloudwatch get-metric-statistics \
  --namespace AWS/DynamoDB \
  --metric-name SuccessfulRequestLatency \
  --dimensions Name=TableName,Value=atlas-sessions Name=Operation,Value=Query \
  --start-time $(date -d '1 hour ago' -Iseconds) \
  --end-time $(date -Iseconds) \
  --period 60 \
  --statistics Average
```

**Resolution:**
1. Cold starts: Enable provisioned concurrency during peak hours
2. DynamoDB: Check for hot partitions, consider DAX cache
3. Large contexts: Review conversation compaction thresholds

### 4.4 Artifact Generation Failing

**Symptoms:**
- Artifacts not appearing
- "artifact_complete" events missing
- S3 upload errors

**Diagnosis:**
```bash
# Check S3 errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-chat \
  --filter-pattern "S3" \
  --start-time $(date -d '1 hour ago' +%s000)

# Verify S3 bucket permissions
aws s3api head-bucket --bucket atlas-artifacts-prod
```

**Resolution:**
1. S3 permissions: Verify Lambda execution role has s3:PutObject
2. Bucket policy: Check CORS configuration
3. Large artifacts: Verify size limits (4.5MB max)

### 4.5 Memory/Vector Search Issues

**Symptoms:**
- "No memories found" when should have context
- Semantic search returning irrelevant results
- Memory not persisting

**Diagnosis:**
```bash
# Check vectors bucket
aws s3 ls s3://atlas-vectors-prod/vectors/ --recursive | head -20

# Check memory processor Lambda
aws logs filter-log-events \
  --log-group-name /aws/lambda/atlas-memory-processor \
  --filter-pattern "ERROR" \
  --start-time $(date -d '1 hour ago' +%s000)
```

**Resolution:**
1. Empty vectors: Run memory regeneration for affected projects
2. S3 Vectors issue: Check service status, may need index rebuild
3. Embedding failures: Verify Titan Embeddings model access

---

## 5. Deployment Procedures

### 5.1 Standard Deployment (CI/CD)

1. **Merge to main** triggers automatic staging deployment
2. **Verify staging** at https://staging.atlas.example.com
3. **Run E2E tests** (automatic)
4. **Manual approval** for production
5. **Trigger production** via GitHub Actions workflow_dispatch

### 5.2 Manual Deployment

```bash
# 1. Build Lambda packages
cd atlas-web/lambda
./build.sh

# 2. Deploy via Terraform
cd ../terraform
terraform plan -var-file=production.tfvars -out=tfplan
terraform apply tfplan

# 3. Deploy frontend
cd ../frontend
npm run build
aws s3 sync dist/ s3://atlas-frontend-prod/ --delete

# 4. Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXXXXX \
  --paths "/*"

# 5. Verify deployment
curl -f https://atlas.example.com/health
```

### 5.3 Lambda-Only Deployment

```bash
# Update single function
aws lambda update-function-code \
  --function-name atlas-chat \
  --zip-file fileb://chat.zip

# Wait for update
aws lambda wait function-updated --function-name atlas-chat

# Verify
aws lambda invoke --function-name atlas-chat \
  --payload '{"test": true}' response.json
```

---

## 6. Rollback Procedures

### 6.1 Frontend Rollback

```bash
# List previous versions
aws s3api list-object-versions \
  --bucket atlas-frontend-prod \
  --prefix index.html

# Restore previous version
aws s3api copy-object \
  --bucket atlas-frontend-prod \
  --copy-source atlas-frontend-prod/index.html?versionId=PREV_VERSION \
  --key index.html

# Invalidate cache
aws cloudfront create-invalidation \
  --distribution-id XXXXXXXXXXXXX \
  --paths "/*"
```

### 6.2 Lambda Rollback

```bash
# List versions
aws lambda list-versions-by-function --function-name atlas-chat

# Update alias to previous version
aws lambda update-alias \
  --function-name atlas-chat \
  --name prod \
  --function-version 42

# Or restore from previous zip in S3
aws lambda update-function-code \
  --function-name atlas-chat \
  --s3-bucket atlas-deployments \
  --s3-key lambda/chat-v1.2.3.zip
```

### 6.3 Terraform Rollback

```bash
# View state history
terraform state list

# Restore previous state (if using S3 backend with versioning)
aws s3api list-object-versions \
  --bucket atlas-terraform-state \
  --prefix atlas/terraform.tfstate

# Apply specific version
terraform apply -target=aws_lambda_function.chat -var "version=previous"
```

### 6.4 Database Rollback

**DynamoDB Point-in-Time Recovery:**
```bash
# Restore table to point in time
aws dynamodb restore-table-to-point-in-time \
  --source-table-name atlas-sessions \
  --target-table-name atlas-sessions-restored \
  --restore-date-time 2026-01-23T10:00:00Z

# Verify data
aws dynamodb scan --table-name atlas-sessions-restored --limit 10

# Swap tables (requires application update or alias)
```

---

## 7. Disaster Recovery

### 7.1 Recovery Objectives

| Metric | Target |
|--------|--------|
| RTO (Recovery Time Objective) | 4 hours |
| RPO (Recovery Point Objective) | 1 hour |

### 7.2 Backup Strategy

| Component | Backup Method | Frequency | Retention |
|-----------|---------------|-----------|-----------|
| DynamoDB | Point-in-time recovery | Continuous | 35 days |
| S3 | Cross-region replication | Real-time | Indefinite |
| Lambda code | S3 versioning | Per deploy | 30 versions |
| Terraform state | S3 versioning | Per apply | 90 days |

### 7.3 DR Procedures

**Complete Region Failure:**

1. **Activate DR region** (us-west-2)
   ```bash
   cd terraform/dr
   terraform apply -var="active=true"
   ```

2. **Update DNS** to DR endpoints
   ```bash
   aws route53 change-resource-record-sets \
     --hosted-zone-id XXXXX \
     --change-batch file://dr-dns-change.json
   ```

3. **Verify services** in DR region
   ```bash
   curl -f https://dr.atlas.example.com/health
   ```

4. **Notify stakeholders** via PagerDuty

### 7.4 Data Recovery

**Restore DynamoDB table:**
```bash
aws dynamodb restore-table-to-point-in-time \
  --source-table-name atlas-sessions \
  --target-table-name atlas-sessions-recovered \
  --restore-date-time "2026-01-23T10:00:00Z"
```

**Restore S3 objects:**
```bash
# List deleted objects
aws s3api list-object-versions \
  --bucket atlas-artifacts-prod \
  --prefix "usr_abc123/" \
  --query 'DeleteMarkers[?IsLatest==`true`]'

# Restore by removing delete marker
aws s3api delete-object \
  --bucket atlas-artifacts-prod \
  --key "path/to/object" \
  --version-id "delete-marker-version-id"
```

---

## 8. Escalation Paths

### 8.1 Escalation Matrix

| Severity | Response Time | Escalation |
|----------|---------------|------------|
| P1 (Critical) | 15 min | Platform Lead → Director → VP |
| P2 (High) | 1 hour | Platform Lead → Director |
| P3 (Medium) | 4 hours | Platform Engineer |
| P4 (Low) | Next business day | Team queue |

### 8.2 Severity Definitions

| Severity | Definition | Example |
|----------|------------|---------|
| P1 | Service completely down | API returning 5xx for all users |
| P2 | Major feature broken | Chat not working, auth failing |
| P3 | Minor feature degraded | Slow performance, partial failures |
| P4 | Cosmetic/minor issues | UI glitch, non-blocking bug |

### 8.3 Contacts

| Role | Name | Contact |
|------|------|---------|
| Platform Lead | Andy | Slack: @andy, PagerDuty |
| Director | Adam M | Slack: @adam.m, PagerDuty |
| AWS Support | - | AWS Support Console |
| Anthropic Support | - | support@anthropic.com |

### 8.4 Communication Templates

**P1 Incident Start:**
```
🚨 P1 INCIDENT: ATLAS [Brief Description]

Impact: [Who is affected, what's broken]
Start Time: [HH:MM UTC]
Status: Investigating

Updates will follow every 15 minutes.
```

**P1 Incident Resolution:**
```
✅ RESOLVED: ATLAS [Brief Description]

Resolution: [What fixed it]
Duration: [X hours Y minutes]
Root Cause: [Brief explanation]

Post-mortem will be scheduled within 48 hours.
```

---

## 9. Maintenance Windows

### 9.1 Scheduled Maintenance

| Window | Time (ET) | Use Case |
|--------|-----------|----------|
| Weekly | Sunday 2-4 AM | Non-critical updates |
| Monthly | First Sunday 12-4 AM | Major updates, migrations |
| Quarterly | Scheduled | Infrastructure upgrades |

### 9.2 Maintenance Procedure

1. **48 hours before**: Notify users via in-app banner
2. **24 hours before**: Send email notification
3. **Start of window**: Enable maintenance mode
4. **During**: Perform updates
5. **End of window**: Disable maintenance mode, verify
6. **After**: Send completion notification

### 9.3 Maintenance Mode

```bash
# Enable maintenance mode
aws ssm put-parameter \
  --name /atlas/maintenance-mode \
  --value "true" \
  --overwrite

# Disable maintenance mode
aws ssm put-parameter \
  --name /atlas/maintenance-mode \
  --value "false" \
  --overwrite
```

---

## 10. Runbook Checklist

### 10.1 Daily Checks

- [ ] Review CloudWatch dashboard for anomalies
- [ ] Check error rates in Lambda functions
- [ ] Verify Bedrock quota usage
- [ ] Review any overnight alerts

### 10.2 Weekly Checks

- [ ] Review CloudWatch Logs Insights for patterns
- [ ] Check DynamoDB capacity utilization
- [ ] Review S3 storage growth
- [ ] Validate backup completeness
- [ ] Review security findings

### 10.3 Monthly Checks

- [ ] Review and rotate credentials
- [ ] Audit IAM permissions
- [ ] Review cost trends
- [ ] Update runbook if needed
- [ ] Conduct tabletop DR exercise

### 10.4 Quarterly Checks

- [ ] Full DR drill
- [ ] Security audit
- [ ] Performance baseline review
- [ ] Dependency updates
- [ ] Documentation review

---

## Appendix A: Useful Commands

```bash
# Get Lambda function status
aws lambda get-function --function-name atlas-chat

# List recent Lambda invocations
aws logs tail /aws/lambda/atlas-chat --since 1h

# Check DynamoDB table status
aws dynamodb describe-table --table-name atlas-sessions

# List API Gateway deployments
aws apigatewayv2 get-deployments --api-id XXXXX

# Check CloudFront distribution status
aws cloudfront get-distribution --id XXXXX

# Get Bedrock model access
aws bedrock list-foundation-models --query 'modelSummaries[?modelId==`anthropic.claude-3-haiku-20240307-v1:0`]'
```

---

## Appendix B: Related Documentation

- [Architecture Decision Records](/docs/ADR/)
- [API Specification](/docs/API_SPECIFICATION.md)
- [Security Architecture](/docs/SECURITY.md)
- [Data Model](/docs/DATA_MODEL.md)

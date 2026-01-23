# ADR-001: Serverless Architecture with Lambda

## Status

Accepted

## Date

2025-12-01

## Context

ATLAS requires a backend architecture that can:
1. Scale with variable developer usage patterns (high during work hours, low otherwise)
2. Handle long-running LLM streaming responses (up to 5 minutes)
3. Minimize infrastructure management overhead
4. Provide cost-effective operation for a platform that may have bursty usage
5. Integrate well with AWS Bedrock for LLM capabilities

Traditional options include:
- Containerized services (ECS/EKS)
- EC2 instances with auto-scaling
- Serverless Lambda functions

## Decision

We will use **AWS Lambda** as the primary compute platform for all backend APIs, with the following configuration:

| Function | Purpose | Timeout | Memory |
|----------|---------|---------|--------|
| chat | Non-streaming chat | 5 min | 1024 MB |
| chat-stream | Streaming chat (Lambda URL) | 5 min | 1024 MB |
| sessions | Session CRUD | 30 sec | 256 MB |
| projects | Project management | 2 min | 512 MB |
| files | File operations | 1 min | 512 MB |
| artifacts | Artifact management | 1 min | 512 MB |
| auth | Authentication | 30 sec | 256 MB |
| mcp-config | MCP server config | 30 sec | 256 MB |
| memory-processor | Background memory | 5 min | 1024 MB |

API Gateway (HTTP API) routes requests to Lambda functions, with Lambda Function URLs used for streaming responses.

## Consequences

### Positive

- **Zero infrastructure management**: No servers to patch, scale, or monitor at the OS level
- **Pay-per-use**: Cost directly correlates with usage; idle time costs nothing
- **Auto-scaling**: Handles traffic spikes without configuration
- **AWS integration**: Native integration with Bedrock, DynamoDB, S3, CloudWatch
- **Fast deployment**: Individual function updates in seconds

### Negative

- **Cold starts**: First request after idle period has 1-3 second latency (mitigated by provisioned concurrency if needed)
- **15-minute timeout limit**: Long-running tasks must be broken up (not an issue for our 5-min chat timeout)
- **Stateless by design**: Session state must be stored externally (DynamoDB)
- **Debugging complexity**: Distributed tracing required for request flows

### Compliance Impact

- **SOC2**: CloudWatch logging provides audit trail; IAM roles provide least-privilege access
- **PCI-DSS**: Lambda environment variables encrypted by default; KMS integration available
- **Audit**: All invocations logged with requestId correlation

## Alternatives Considered

### Alternative 1: ECS Fargate Containers

Run containerized Node.js services on ECS Fargate.

**Rejected because:**
- Higher baseline cost (always-running containers)
- More infrastructure to manage (task definitions, services, load balancers)
- Overkill for current scale
- Would reconsider at 500+ concurrent users

### Alternative 2: EC2 with Auto Scaling Groups

Traditional EC2 instances behind an ALB.

**Rejected because:**
- Significant operational overhead (AMI management, patching, scaling policies)
- Cost inefficient for variable workloads
- Slower scaling response time
- Not aligned with team's serverless expertise

### Alternative 3: AWS App Runner

Managed container service with auto-scaling.

**Rejected because:**
- Less mature than Lambda
- Streaming support limitations
- Minimum cost even when idle
- Fewer integration options with other AWS services

## References

- [AWS Lambda documentation](https://docs.aws.amazon.com/lambda/)
- [Lambda Response Streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [ADR-004](./ADR-004-lambda-response-streaming.md) - Lambda Response Streaming for Chat

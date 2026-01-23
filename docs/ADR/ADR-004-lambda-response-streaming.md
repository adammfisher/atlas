# ADR-004: Lambda Response Streaming for Chat

## Status

Accepted

## Date

2025-12-01

## Context

ATLAS chat functionality requires streaming responses because:
1. LLM responses can take 30-120 seconds to complete
2. Users expect to see text appear progressively (like ChatGPT)
3. Buffering entire responses creates poor UX and timeout risks
4. Artifact generation should show real-time progress
5. Extended thinking and web search status need live updates

Options considered:
- Lambda Response Streaming (Lambda Function URLs)
- API Gateway WebSocket API
- AppSync subscriptions
- Polling with API Gateway

## Decision

We will use **Lambda Response Streaming** via Lambda Function URLs for chat interactions:

### Architecture

```
Frontend (React)
    │
    ▼ SSE Request
Lambda Function URL (chat-stream)
    │ invoke_mode: RESPONSE_STREAM
    ▼
awslambda.streamifyResponse()
    │
    ▼ Bedrock ConverseStream
AWS Bedrock Claude
    │
    ▼ Token-by-token
responseStream.write()
    │
    ▼ SSE Events
Frontend EventSource
```

### Event Types

| Event | Purpose | Example |
|-------|---------|---------|
| `chunk` | Text content | `{"type":"chunk","content":"Hello"}` |
| `thinking` | Extended thinking | `{"type":"thinking","content":"..."}` |
| `artifact_start` | Begin artifact | `{"type":"artifact_start","artifact":{...}}` |
| `artifact_delta` | Artifact progress | `{"type":"artifact_delta","artifact":{...}}` |
| `artifact_complete` | Finish artifact | `{"type":"artifact_complete",...}` |
| `search_start` | Web search begin | `{"type":"search_start","query":"..."}` |
| `search_results` | Search complete | `{"type":"search_results",...}` |
| `memory_context` | Memory retrieved | `{"type":"memory_context",...}` |
| `compaction` | History compacted | `{"type":"compaction","stats":{...}}` |
| `done` | Stream complete | `{"type":"done","session_id":"..."}` |
| `error` | Error occurred | `{"type":"error","message":"..."}` |

### Implementation

```javascript
exports.streamHandler = awslambda.streamifyResponse(
  async (event, responseStream, context) => {
    const metadata = {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache'
      }
    };
    responseStream = awslambda.HttpResponseStream.from(responseStream, metadata);

    for await (const chunk of bedrockStream) {
      responseStream.write(`data: ${JSON.stringify(chunk)}\n\n`);
    }

    responseStream.end();
  }
);
```

## Consequences

### Positive

- **True streaming**: Tokens appear immediately, not batched
- **Simple frontend**: Standard SSE/EventSource API
- **Long timeout**: 15-minute streaming duration supported
- **Bedrock native**: ConverseStream API maps directly to response stream
- **Error handling**: Errors can be streamed mid-response

### Negative

- **No API Gateway**: Lambda URLs bypass API Gateway (separate CORS config)
- **Auth complexity**: Must validate JWT in Lambda code (not authorizer)
- **No request transformation**: Raw event handling required
- **Monitoring gaps**: CloudWatch metrics less detailed than API Gateway

### Compliance Impact

- **SOC2**: Response streaming logged in CloudWatch; no sensitive data in URLs
- **PCI-DSS**: HTTPS enforced by Lambda URLs; no query string data
- **Audit**: Each streaming session generates request ID for correlation

## Alternatives Considered

### Alternative 1: API Gateway WebSocket API

Bidirectional WebSocket connections via API Gateway.

**Rejected because:**
- Complex connection management (connect/disconnect/message handlers)
- Overkill for unidirectional streaming
- Higher latency for initial connection
- More complex client implementation

### Alternative 2: AppSync GraphQL Subscriptions

Real-time updates via GraphQL subscriptions.

**Rejected because:**
- Requires GraphQL schema (we use REST)
- Additional infrastructure (AppSync API)
- More complex than SSE for our use case
- Subscription quotas and limits

### Alternative 3: Polling with API Gateway

Client polls for updates every N seconds.

**Rejected because:**
- Poor UX (delayed updates)
- Inefficient (many wasted requests)
- Complex state management (store partial responses)
- Higher cost (more Lambda invocations)

### Alternative 4: API Gateway with Chunked Encoding

Use Transfer-Encoding: chunked through API Gateway.

**Rejected because:**
- API Gateway has 29-second integration timeout
- Cannot stream for 2+ minute responses
- Would require breaking into multiple requests

## References

- [Lambda Response Streaming](https://docs.aws.amazon.com/lambda/latest/dg/configuration-response-streaming.html)
- [Bedrock ConverseStream](https://docs.aws.amazon.com/bedrock/latest/APIReference/API_runtime_ConverseStream.html)
- [Server-Sent Events (SSE)](https://developer.mozilla.org/en-US/docs/Web/API/Server-sent_events)

# ADR-005: Model Context Protocol for Tool Integration

## Status

Accepted

## Date

2025-12-01

## Context

ATLAS needs to integrate with enterprise systems to provide contextual AI assistance:
1. Knowledge Core (Neptune/Neo4j) for enterprise patterns and standards
2. GitLab for code search and PR operations
3. Future: Jira, Confluence, ServiceNow, internal APIs

Requirements:
- Standardized interface for AI to call external tools
- Support for both Claude Code Extension and Agent SDK
- Hot-swappable tool providers
- Enterprise authentication integration
- Consistent error handling and retries

Options considered:
- Custom REST API wrappers
- LangChain tools
- Model Context Protocol (MCP)
- OpenAI function calling format

## Decision

We will adopt **Model Context Protocol (MCP)** as the standard for tool integration:

### Architecture

```
┌─────────────────────────────────────────────────────┐
│                    ATLAS Platform                    │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Claude Code Extension ──┬──► MCP Client           │
│                          │                         │
│  Agent SDK Containers ───┘                         │
│                                                     │
│         ▼                    ▼                     │
│  ┌─────────────┐      ┌─────────────┐             │
│  │ Knowledge   │      │ GitLab      │             │
│  │ Core MCP    │      │ Mock MCP    │             │
│  │ (port 3001) │      │ (port 3002) │             │
│  └──────┬──────┘      └──────┬──────┘             │
│         │                    │                     │
│         ▼                    ▼                     │
│  ┌─────────────┐      ┌─────────────┐             │
│  │ Neo4j/      │      │ GitLab      │             │
│  │ Neptune     │      │ API         │             │
│  └─────────────┘      └─────────────┘             │
└─────────────────────────────────────────────────────┘
```

### MCP Server Definitions

**Knowledge Core MCP** (`/mcp-servers/knowledge-core/`)
```javascript
// Tool definitions
get_service_info(service_name)      // Service metadata, patterns, compliance
get_team_standards(team_name)       // Team coding standards
search_patterns(query)              // Architecture pattern search
get_dependencies(service_name)      // Service dependency graph
search_adrs(query)                  // Architecture Decision Records
get_compliance_requirements(domain) // Regulatory requirements
```

**GitLab MCP** (`/mcp-servers/gitlab-mock/`)
```javascript
// Tool definitions
search_code(query, file_pattern)    // Code search across repos
get_file_content(file_path)         // Retrieve file content
create_merge_request(...)           // Create PR
post_mr_comment(mr_id, comment)     // Post review comment
get_mr_diff(mr_id)                  // Get PR changes
```

### Configuration

MCP servers configured via `/docker/mcp-config.json`:
```json
{
  "mcpServers": {
    "knowledge-core": {
      "command": "node",
      "args": ["./mcp-servers/knowledge-core/index.js"],
      "env": {
        "NEO4J_URL": "bolt://neo4j:7687",
        "OPENSEARCH_URL": "http://opensearch:9200"
      }
    },
    "gitlab": {
      "command": "node",
      "args": ["./mcp-servers/gitlab-mock/index.js"]
    }
  }
}
```

## Consequences

### Positive

- **Anthropic standard**: Native support in Claude Code and Agent SDK
- **Hot-swappable**: Servers can be updated without changing AI code
- **Consistent interface**: All tools follow same request/response format
- **Shared across paths**: Same tools work in interactive and automated modes
- **Testable**: Mock servers for development and testing
- **Ecosystem**: Growing library of community MCP servers

### Negative

- **New protocol**: Team must learn MCP specification
- **Server maintenance**: Each integration requires separate server process
- **Debugging**: Tool calls add complexity to debugging
- **Version coordination**: MCP spec updates may require server changes

### Compliance Impact

- **SOC2**: MCP servers log all tool invocations; audit trail maintained
- **PCI-DSS**: Sensitive data handled within MCP server (not exposed to AI raw)
- **GLBA**: User context passed via MCP (data filtered by user permissions)
- **Audit**: Every tool call logged with timestamp, user, parameters, response

## Alternatives Considered

### Alternative 1: Custom REST API Wrappers

Direct REST calls from Lambda to enterprise systems.

**Rejected because:**
- No standard interface (each integration different)
- Not compatible with Claude Code Extension
- Would require custom tool definitions per integration
- Harder to test and mock

### Alternative 2: LangChain Tools

Use LangChain's tool abstraction layer.

**Rejected because:**
- Python-centric (our stack is Node.js)
- Not native to Claude/Anthropic
- Additional dependency and abstraction layer
- Less enterprise adoption than MCP

### Alternative 3: OpenAI Function Calling Format

Adopt OpenAI's function calling schema for tools.

**Rejected because:**
- Not supported by Claude Code Extension
- Would require translation layer for Anthropic APIs
- Less rich capability model than MCP
- No server concept (just schema)

## References

- [Model Context Protocol Specification](https://modelcontextprotocol.io/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/docs/sdk)
- [Claude Code MCP Support](https://docs.anthropic.com/claude/docs/claude-code-mcp)
- [Knowledge Core MCP Implementation](/atlas-code/mcp-servers/knowledge-core/)

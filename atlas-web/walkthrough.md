# Atlas Platform Demo Walkthrough

## Overview

This walkthrough demonstrates the **complete Atlas knowledge flow** across three components:

1. **Atlas Web** - Create artifacts through AI research conversations
2. **Neo4j (Knowledge Core)** - View the stored content and its graph relationships
3. **Atlas-Code** - Use the shared knowledge when writing code with Claude

By the end of this demo, you'll see how knowledge created in one tool becomes immediately available to developers in another - creating an enterprise knowledge flywheel.

---

## Prerequisites

Ensure these services are running:

| Service | Port | Purpose |
|---------|------|---------|
| Knowledge Core MCP | 3001 | Neo4j queries via MCP protocol |
| Local Server | 8000 | Atlas Web backend proxy |
| Frontend | 3004 | Atlas Web React UI |
| Neo4j | 7474/7687 | Graph database (browser + bolt) |
| Code Server | 8080 | Atlas-Code VS Code in browser |

**Quick Start:**
```bash
# Terminal 1 - Start atlas-code stack (Neo4j, code-server, MCP)
cd atlas-code && docker-compose up -d

# Terminal 2 - Local Server (atlas-web backend)
cd atlas-web && node local-server.js

# Terminal 3 - Frontend (atlas-web UI)
cd atlas-web/frontend && npm run dev
```

**URLs for the Demo:**
- Atlas Web: http://localhost:3004
- Neo4j Browser: http://localhost:7474 (neo4j / allyfinancial)
- Atlas-Code: http://localhost:8080 (password: demo123)

---

## Demo Flow

### Part 1: The Chat Interaction

1. **Open Atlas Web**
   - Navigate to http://localhost:3004
   - You'll see the chat interface with the sidebar on the left

2. **Ask Claude to Create an ADR**

   Enter this prompt:
   ```
   Create an Architecture Decision Record (ADR) for how we should handle
   PII data in AI services at Ally Financial. Consider GLBA, PCI-DSS,
   and SOC2 requirements.
   ```

3. **Watch the Response**
   - Claude will generate an ADR artifact
   - The **Artifacts Panel** on the right will open automatically
   - You'll see the ADR content streaming in real-time

---

### Part 2: The Insights Bubble

4. **Notice the Insights Bubble**
   - Look at the bottom-right corner of the screen
   - A pink bubble appears with "Insights" and a **yellow badge showing "1"**
   - This indicates an artifact has been detected and is ready to share

5. **Click the Insights Bubble**
   - The Insights panel opens upward
   - You'll see **"Ready to Share (1)"** section
   - The ADR artifact card shows:
     - Pink "artifact" type badge
     - Title: "PII Handling in AI Services" (or similar)
     - Content preview

---

### Part 3: Share to Knowledge Core

6. **Select the Artifact**
   - Click on the artifact card
   - A pink checkbox appears, indicating selection
   - The **"Share 1 Insight"** button appears at the bottom

7. **Share to Knowledge Core**
   - Click the pink **"Share 1 Insight"** button
   - Brief loading state shows "Sharing..."
   - The artifact moves from "Ready to Share" to **"In Knowledge Core (1)"**
   - A green checkmark badge indicates it's been shared

8. **Verify in Neo4j**
   - Open Neo4j Browser: http://localhost:7474
   - Login: `neo4j` / `allyfinancial`
   - Run query:
     ```cypher
     MATCH (a:Artifact) WHERE a.title CONTAINS "PII" RETURN a
     ```
   - The artifact is now in the enterprise knowledge graph!

---

### Part 4: Exploring the Content in Neo4j

9. **View the Graph Structure**
   - In Neo4j Browser, run:
     ```cypher
     MATCH (a:Artifact)-[r]->(n)
     WHERE a.title CONTAINS "PII"
     RETURN a, r, n
     ```
   - Notice the artifact is automatically linked to:
     - **Services** it analyzes (detected from content)
     - **Patterns** it references
     - **Compliance requirements** it's subject to
     - **Author** who created it

10. **See How It Connects to Services**
    - Run this query to see all artifacts for a service:
      ```cypher
      MATCH (a:Artifact)-[:ANALYZES]->(s:Service {name: 'loan-service'})
      RETURN a.title, a.type, a.created_at
      ORDER BY a.created_at DESC
      ```

11. **Explore the Knowledge Graph**
    - View the full context around a service:
      ```cypher
      MATCH (s:Service {name: 'loan-service'})-[r]->(n)
      RETURN s, r, n
      ```
    - This shows services, patterns, compliance, teams, and now your artifact!

---

### Part 5: Using the Content in Atlas-Code

Now let's see how developers in atlas-code can leverage the artifact you just shared.

12. **Open Atlas-Code (VS Code in Browser)**
    - Navigate to http://localhost:8080
    - Enter password: `demo123`
    - Open the terminal and run: `claude`

13. **Explore with Knowledge Core Context**
    - In the Claude chat, type:
      ```
      /explore loan-service
      ```
    - **Watch what happens:**
      ```
      🔍 Querying Knowledge Core...

      📡 get_service_info("loan-service")
      ✅ Found: Owner, patterns, compliance requirements

      📡 search_artifacts("loan-service")
      ✅ Found: ADR for PII Handling in AI Services  ← YOUR ARTIFACT!
      ```
    - The artifact you shared from Atlas Web is now available to Claude!

14. **Query the Artifact Directly**
    - Ask Claude:
      ```
      What are the PII handling requirements for AI services?
      ```
    - Claude will query the Knowledge Core and find your ADR
    - The response references the artifact you just created

15. **Use the Knowledge When Coding**
    - Ask Claude:
      ```
      /code Add a method to mask customer SSN following our standards
      ```
    - Claude will:
      1. Query `get_team_standards()` for coding conventions
      2. Find your PII ADR via `search_artifacts()`
      3. Generate code that follows both the team standards AND the PII requirements you documented

**Example output:**
```java
/**
 * Masks SSN per ADR: PII Handling in AI Services
 * Compliance: GLBA, PCI-DSS (see Knowledge Core artifact_xxx)
 */
public String maskSsn(String ssn) {
    if (ssn == null || ssn.length() < 4) {
        return "***-**-****";
    }
    return "***-**-" + ssn.substring(ssn.length() - 4);
}
```

---

### Part 6: The Full Circle

16. **Create More Knowledge from Code**
    - Ask Claude in atlas-code:
      ```
      /architect Should we add caching to credit score lookups?
      ```
    - Claude generates an ADR recommending a caching strategy
    - Copy this ADR to Atlas Web and share it back to Knowledge Core
    - The next developer benefits from this decision!

**This is the knowledge flywheel:**
```
Atlas Web (Research)     Atlas-Code (Development)
     │                          │
     │  Share ADR ────────────▶ │  Use ADR for coding
     │                          │
     │  ◀──── Generate ADR ──── │  Architecture decision
     │                          │
     └──────── Neo4j ───────────┘
              (Knowledge Core)
```

---

### Part 7: Remove from Knowledge Core (Optional)

17. **Remove if Needed**
    - In the Atlas Web Insights panel, shared artifacts show a **"Remove from KC"** button
    - Click it to delete from Knowledge Core
    - The artifact disappears from both the panel and Neo4j
    - Atlas-code will no longer find it in queries

---

## Key Points to Highlight

### For Demo Audience

1. **Automatic Detection**
   > "Notice how the system automatically detected this ADR as a shareable insight. No manual tagging required."

2. **Graph Relationships**
   > "The Knowledge Core doesn't just store text - it creates relationships. This ADR is now linked to services, compliance requirements, and patterns - all automatically detected from the content."

3. **Enterprise Context in Coding**
   > "When a developer in atlas-code asks Claude to write code, Claude queries the Knowledge Core and finds your artifact. The AI's output reflects decisions made across the organization."

4. **The Knowledge Flywheel**
   > "Research in Atlas Web → Share to Knowledge Core → Used by developers in atlas-code → New decisions shared back. The system gets smarter with every interaction."

5. **Author Attribution**
   > "Your name is attributed to shared insights - building your reputation as a knowledge contributor."

---

## Architecture Diagram

```
                        ATLAS PLATFORM - KNOWLEDGE FLOW

┌───────────────────────────────────────────────────────────────────────┐
│                         ATLAS WEB (Research)                          │
│  ┌─────────────────┐     ┌──────────────────┐                        │
│  │   Chat View     │────▶│  Insights Bubble │───────────┐            │
│  │   (Artifacts)   │     │  (Detection)     │           │            │
│  └─────────────────┘     └──────────────────┘           │            │
└─────────────────────────────────────────────────────────│────────────┘
                                                          │ Share
                                                          ▼
                              ┌───────────────────────────────────┐
                              │        KNOWLEDGE CORE (Neo4j)     │
                              │                                   │
                              │  ┌─────────┐   ┌─────────────┐   │
                              │  │Artifacts│──▶│  Services   │   │
                              │  └─────────┘   └─────────────┘   │
                              │       │              │           │
                              │       ▼              ▼           │
                              │  ┌─────────┐   ┌─────────────┐   │
                              │  │Patterns │   │ Compliance  │   │
                              │  └─────────┘   └─────────────┘   │
                              └───────────────────────────────────┘
                                                          │
                                                          │ Query
                                                          ▼
┌───────────────────────────────────────────────────────────────────────┐
│                       ATLAS-CODE (Development)                        │
│  ┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐  │
│  │   VS Code       │────▶│   Claude Code    │────▶│  MCP Server  │  │
│  │   (Browser)     │     │   (/explore,     │     │  (Queries)   │  │
│  │                 │     │    /code, etc)   │     │              │  │
│  └─────────────────┘     └──────────────────┘     └──────────────┘  │
└───────────────────────────────────────────────────────────────────────┘
```

---

## Data Flow

### Phase 1: Artifact Creation (Atlas Web)

1. **Artifact Detection**
   - `ChatView` detects `<artifact>` tags in Claude's response
   - Calls `insightsService.addArtifactInsight()` via POST `/api/insights`
   - Insight stored in local-server memory

2. **Share to KC**
   - User selects artifact in Insights panel
   - POST `/api/insights/:id/share`
   - Local server calls KC MCP: POST `localhost:3001/artifacts/ingest`
   - Neo4j stores the artifact node with auto-detected relationships

### Phase 2: Neo4j Storage

3. **Graph Relationships Created**
   - Knowledge Core MCP analyzes artifact content
   - Auto-detects: services mentioned, patterns referenced, compliance requirements
   - Creates relationship edges: `ANALYZES`, `USES_PATTERN`, `SUBJECT_TO`

### Phase 3: Usage in Atlas-Code

4. **Developer Queries Knowledge Core**
   - Claude Code invokes `/explore service-name` or asks a question
   - MCP server receives query via `search_artifacts()` or `get_service_artifacts()`
   - Neo4j returns matching artifacts with full context

5. **Claude Uses the Knowledge**
   - Artifact content is included in Claude's context
   - Code generation follows documented standards
   - References to ADRs appear in generated comments

### Phase 4: Cleanup (Optional)

6. **Remove from KC**
   - User clicks "Remove from KC" in Atlas Web
   - DELETE `/api/knowledge-core/artifacts/:id`
   - KC MCP deletes from Neo4j
   - Atlas-code queries no longer return the artifact

---

## Troubleshooting

### Atlas Web Issues

**Insights Bubble Shows 0**
- Check local-server logs for `/api/insights` calls
- Verify artifact content is >50 characters (small artifacts are filtered)

**Share Fails**
- Check KC MCP is running on port 3001
- Check Neo4j is accessible on port 7687
- Look at local-server console for error messages

**Artifact Not in Neo4j**
- Verify the share was successful in Insights panel
- Check the artifact moved to "In Knowledge Core" section
- Run: `MATCH (a:Artifact) RETURN a LIMIT 10`

### Atlas-Code Issues

**Claude Doesn't Find Your Artifact**
- Verify the artifact was shared (green checkmark in Atlas Web)
- Check MCP server is running: `curl http://localhost:3001/health`
- Test the query directly:
  ```bash
  curl -X POST http://localhost:3001/mcp/execute \
    -H "Content-Type: application/json" \
    -d '{"tool": "search_artifacts", "input": {"query": "PII"}}'
  ```

**Code Doesn't Reference the ADR**
- The artifact may not have been linked to the service
- Check relationships in Neo4j:
  ```cypher
  MATCH (a:Artifact)-[r]->(n) RETURN a.title, type(r), n.name
  ```

**VS Code Won't Connect to MCP**
- Restart the code-server container
- Check MCP configuration in `.claude/settings.json`

---

## Reset for Fresh Demo

```bash
# Clear all artifacts from Neo4j
curl -X POST http://localhost:7474/db/neo4j/tx/commit \
  -H "Content-Type: application/json" \
  -u neo4j:allyfinancial \
  -d '{"statements": [{"statement": "MATCH (a:Artifact) DETACH DELETE a"}]}'

# Restart local-server to clear in-memory insights
# Ctrl+C then: node local-server.js

# Refresh browser to clear frontend state
```

---

## Files Reference

### Atlas Web (Research Platform)

| File | Purpose |
|------|---------|
| `frontend/src/components/InsightsBubble/InsightsBubble.jsx` | Insights UI component |
| `frontend/src/hooks/useInsightsStore.js` | Zustand store for insights state |
| `frontend/src/services/insightsService.js` | API calls for insights |
| `local-server.js` | Express server with Insights + KC proxy endpoints |

### Knowledge Core (Neo4j Integration)

| File | Purpose |
|------|---------|
| `atlas-code/mcp-servers/knowledge-core/server.js` | MCP server for Neo4j operations |
| `atlas-code/data/neo4j-init.cypher` | Initial schema and sample data |

### Atlas-Code (Development Platform)

| File | Purpose |
|------|---------|
| `atlas-code/agents/epcc/explore.md` | Explore agent prompt (queries KC) |
| `atlas-code/agents/epcc/code.md` | Code agent prompt (uses patterns) |
| `atlas-code/.claude/commands/explore.md` | `/explore` slash command |
| `atlas-code/.claude/commands/code.md` | `/code` slash command |
| `atlas-code/docker-compose.yml` | Local development stack |

# Implementation Plan: Dual-Scope Memory System (User + Project Level)

## Overview

Implement a comprehensive memory system that provides:
1. **Project-level memory** - Memories scoped to a specific project (already implemented)
2. **User-level (global) memory** - Memories across all non-project chats

When a user is **in a project**, the AI retrieves memories from that project's indexes.
When a user is **NOT in a project** (general chat), the AI retrieves memories from the user's global indexes.

---

## Current State

### Already Implemented
- `vectors.js` - Contains both project-level AND user-level global functions:
  - Project: `createProjectIndexes`, `storeMemoryFact`, `searchMemories`, etc.
  - Global (new): `createUserGlobalIndexes`, `storeGlobalMemoryFact`, `searchGlobalMemories`, etc.
- `embeddings.js` - Amazon Titan Embeddings V2 (1024-dimensional)
- `memory-processor/index.js` - Background processing for project sessions
- `chat/index.js` - Has `getProjectContext()` for project-level memory retrieval

### Not Yet Implemented
- Integration of global memory functions into chat flow
- Global memory index creation (on user signup/first login)
- Global memory processing for non-project sessions
- System prompt inclusion of global memories

---

## Implementation Steps

### Step 1: Update Chat Lambda - Add Global Context Function

**File:** `atlas-web/lambda/functions/chat/index.js`

Add a `getGlobalContext()` function (similar to `getProjectContext()`):

```javascript
async function getGlobalContext(userId, query = null) {
  // Search for relevant global memories if query provided
  let globalMemories = [];
  let globalConversations = [];

  if (query && VECTORS_BUCKET) {
    try {
      const vectors = getVectorsModule();

      // Search for relevant facts/memories
      globalMemories = await vectors.searchGlobalMemories(userId, query, {
        topK: 15,
        minConfidence: 0.5
      });

      // Search for relevant conversation history
      globalConversations = await vectors.searchGlobalConversations(userId, query, {
        topK: 5
      });
    } catch (err) {
      console.warn('[Vectors] Global semantic search failed:', err.message);
    }
  }

  // Format memories for context
  let formattedGlobalMemory = null;
  if (globalMemories.length > 0) {
    const factsByCategory = {};
    for (const mem of globalMemories) {
      const cat = mem.category || 'general';
      if (!factsByCategory[cat]) factsByCategory[cat] = [];
      factsByCategory[cat].push(`- ${mem.content}`);
    }
    const memoryParts = [];
    for (const [category, facts] of Object.entries(factsByCategory)) {
      memoryParts.push(`### ${category}\n${facts.join('\n')}`);
    }
    formattedGlobalMemory = memoryParts.join('\n\n');
  }

  // Format conversations
  let formattedConversations = null;
  if (globalConversations.length > 0) {
    formattedConversations = globalConversations
      .map(c => `[${new Date(c.timestamp).toLocaleDateString()}] ${c.contentPreview || '...'}`)
      .join('\n\n');
  }

  return {
    globalMemory: formattedGlobalMemory,
    globalConversations: formattedConversations,
    rawGlobalMemories: globalMemories,
    rawGlobalConversations: globalConversations,
    stats: {
      globalMemoryCount: globalMemories.length,
      globalConversationsCount: globalConversations.length
    }
  };
}
```

### Step 2: Update Chat Handler - Route to Appropriate Memory

**File:** `atlas-web/lambda/functions/chat/index.js`

In `handleStreamingChatWithStream()` and `handleStreamingChat()`, update the context retrieval:

```javascript
// Get context based on whether we're in a project or not
let projectContext = null;
let globalContext = null;

if (effectiveProjectId) {
  // In a project - use project memory
  projectContext = await getProjectContext(userId, effectiveProjectId, message);
  // ... existing memory_context event code ...
} else {
  // Not in a project - use global memory
  globalContext = await getGlobalContext(userId, message);

  // Send memory context event for global memories
  if (globalContext && globalContext.stats) {
    const { globalMemoryCount, globalConversationsCount } = globalContext.stats;
    if (globalMemoryCount > 0 || globalConversationsCount > 0) {
      responseStream.write(`data: ${JSON.stringify({
        type: 'memory_context',
        scope: 'global',
        globalMemoryCount,
        globalConversationsCount,
        memories: globalContext.rawGlobalMemories || [],
        conversations: globalContext.rawGlobalConversations || []
      })}\n\n`);
    }
  }
}

// Build system prompt with appropriate context
const systemPrompt = buildSystemPrompt(
  projectContext,     // null if not in project
  webSearchEnabled,
  existingArtifacts,
  globalContext       // null if in project (new parameter)
);
```

### Step 3: Update System Prompt Builder

**File:** `atlas-web/lambda/shared/bedrock.js`

Update `buildSystemPrompt()` to accept global context:

```javascript
function buildSystemPrompt(projectContext = null, webSearch = false, existingArtifacts = [], globalContext = null) {
  let base = `You are a helpful AI assistant...`;

  // ... existing code for projectContext ...

  // Add global memory context when NOT in a project
  if (!projectContext && globalContext) {
    if (globalContext.globalMemory) {
      base += `\n\n<user_memory>
These are facts I've learned about you from our previous conversations:

${globalContext.globalMemory}
</user_memory>`;
    }

    if (globalContext.globalConversations) {
      base += `\n\n<relevant_past_conversations>
These excerpts from previous conversations may provide helpful context:

${globalContext.globalConversations}
</relevant_past_conversations>`;
    }
  }

  return base;
}
```

### Step 4: Update getVectorsModule Fallback

**File:** `atlas-web/lambda/functions/chat/index.js`

Update the fallback to include global functions:

```javascript
function getVectorsModule() {
  if (!vectorsModule) {
    try {
      vectorsModule = require('./shared/vectors');
    } catch (err) {
      console.warn('[Vectors] Module not available:', err.message);
      vectorsModule = {
        // Project-level fallbacks (existing)
        searchMemories: async () => [],
        searchConversations: async () => [],
        // Global-level fallbacks (new)
        searchGlobalMemories: async () => [],
        searchGlobalConversations: async () => [],
        createUserGlobalIndexes: async () => {},
        userGlobalIndexesExist: async () => false
      };
    }
  }
  return vectorsModule;
}
```

### Step 5: Create Global Indexes on User Registration/First Login

**File:** `atlas-web/lambda/functions/auth/index.js`

In `handleRegister()`, after creating the user, initialize their global indexes:

```javascript
// After creating user in DynamoDB...
// Initialize global memory indexes (non-blocking)
try {
  const vectors = require('./shared/vectors');
  await vectors.createUserGlobalIndexes(userId);
  console.log('[Auth] Created global memory indexes for user:', userId);
} catch (err) {
  console.warn('[Auth] Failed to create global indexes:', err.message);
  // Non-fatal - indexes can be created lazily on first use
}
```

Also add lazy initialization on login for existing users without indexes:

```javascript
// In handleLogin(), after successful authentication:
// Lazily create global indexes if they don't exist
try {
  const vectors = require('./shared/vectors');
  const exists = await vectors.userGlobalIndexesExist(user.userId);
  if (!exists) {
    await vectors.createUserGlobalIndexes(user.userId);
    console.log('[Auth] Lazily created global indexes for existing user:', user.userId);
  }
} catch (err) {
  console.warn('[Auth] Failed to check/create global indexes:', err.message);
}
```

### Step 6: Update Memory Processor for Global Sessions

**File:** `atlas-web/lambda/functions/memory-processor/index.js`

Add support for processing global (non-project) sessions:

```javascript
// Add import
const {
  storeConversationChunk,
  storeMemoryFact,
  createProjectIndexes,
  projectIndexesExist,
  // New global functions
  storeGlobalConversationChunk,
  storeGlobalMemoryFact,
  createUserGlobalIndexes,
  userGlobalIndexesExist
} = require('/opt/nodejs/shared/vectors');

// Add new handler action
if (event.action === 'processGlobalSession') {
  return await processGlobalSession(event.userId, event.sessionId);
}

// New function for global sessions
async function processGlobalSession(userId, sessionId) {
  console.log(`[MemoryProcessor] Processing global session ${sessionId} for user ${userId}`);

  // Ensure global indexes exist
  const exists = await userGlobalIndexesExist(userId);
  if (!exists) {
    await createUserGlobalIndexes(userId);
  }

  // Fetch messages
  const messages = await getSessionMessages(sessionId);
  if (messages.length === 0) {
    return { statusCode: 200, body: 'No messages to process' };
  }

  // Chunk and embed conversation
  const chunks = chunkConversation(messages);
  let chunksStored = 0;
  for (const chunk of chunks) {
    try {
      await storeGlobalConversationChunk(userId, {
        sessionId,
        messageId: `chunk_${chunksStored}`,
        role: 'mixed',
        content: chunk.content,
        timestamp: chunk.startTimestamp
      });
      chunksStored++;
    } catch (err) {
      console.error('[MemoryProcessor] Failed to store global chunk:', err.message);
    }
  }

  // Extract and store facts
  const facts = await extractFacts(messages);
  let factsStored = 0;
  for (const fact of facts) {
    try {
      await storeGlobalMemoryFact(userId, {
        ...fact,
        sourceSessionId: sessionId
      });
      factsStored++;
    } catch (err) {
      console.error('[MemoryProcessor] Failed to store global fact:', err.message);
    }
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ sessionId, chunksStored, factsExtracted: factsStored })
  };
}
```

### Step 7: Trigger Global Memory Processing After Chat

**File:** `atlas-web/lambda/functions/chat/index.js`

Update the memory processing trigger at the end of chat handlers:

```javascript
// After streaming completes, update memory (non-blocking)
if (effectiveProjectId && fullResponse) {
  // Project memory (existing)
  updateProjectMemoryIncremental(userId, effectiveProjectId, message, fullResponse)
    .catch(err => console.error('[Memory] Background project update failed:', err.message));
} else if (!effectiveProjectId && fullResponse) {
  // Global memory (new) - trigger async processing
  updateGlobalMemoryIncremental(userId, activeSessionId, message, fullResponse)
    .catch(err => console.error('[Memory] Background global update failed:', err.message));
}

// New function for global memory
async function updateGlobalMemoryIncremental(userId, sessionId, userMessage, assistantResponse) {
  // Similar to updateProjectMemoryIncremental but stores to global indexes
  // Or invoke memory-processor Lambda with action: 'processGlobalSession'

  // Option A: Inline processing (simpler)
  try {
    const vectors = getVectorsModule();

    // Store conversation chunk
    await vectors.storeGlobalConversationChunk(userId, {
      sessionId,
      messageId: `msg_${Date.now()}`,
      role: 'mixed',
      content: `User: ${userMessage}\n\nAssistant: ${assistantResponse.substring(0, 2000)}`,
      timestamp: Date.now()
    });

    // Extract facts using same pattern as project memory
    // ... (reuse extractFacts logic)
  } catch (err) {
    console.error('[Memory] Global memory update failed:', err.message);
  }
}
```

---

## S3 Vectors Cost Analysis

### Index Structure
- **Per Project:** 2 indexes (`{projectId}-mem`, `{projectId}-conv`)
- **Per User (Global):** 2 indexes (`{userId}-global-mem`, `{userId}-global-conv`)

### Estimated Costs (based on AWS S3 Vectors pricing)

| Component | Cost |
|-----------|------|
| Index Storage | ~$0.25/GB/month |
| Vector Storage | ~$0.10/million vectors/month |
| Query Operations | ~$0.01/1000 queries |
| Write Operations | ~$0.02/1000 writes |

### Example Cost Scenario
For a platform with:
- 100 users
- 20 projects average per user
- 5,000 memories per project
- 1,000 global memories per user

**Monthly estimate:**
- Indexes: 100 users × (2 global + 20 projects × 2) = 4,200 indexes
- Storage: ~10GB total = ~$2.50/month
- Queries: 50,000 queries/month = ~$0.50/month
- Writes: 10,000 writes/month = ~$0.20/month

**Total: ~$3-5/month** for a 100-user deployment

---

## Migration Notes

1. **Existing Users:** Global indexes will be created lazily on next login
2. **Existing Sessions:** Can run migration script to process historical non-project sessions
3. **No Breaking Changes:** Project memory continues to work unchanged

---

## Files to Modify

| File | Changes |
|------|---------|
| `lambda/functions/chat/index.js` | Add `getGlobalContext()`, update handlers, add `updateGlobalMemoryIncremental()` |
| `lambda/shared/bedrock.js` | Update `buildSystemPrompt()` signature to accept `globalContext` |
| `lambda/functions/auth/index.js` | Initialize global indexes on register/login |
| `lambda/functions/memory-processor/index.js` | Add `processGlobalSession()` handler |
| `lambda/shared/vectors.js` | Already complete (global functions exist) |

---

## Testing Plan

1. **Create new user** - Verify global indexes are created
2. **Chat without project** - Verify global memory is searched and included in prompt
3. **Chat within project** - Verify project memory (not global) is used
4. **Switch between contexts** - Verify correct memory scope is used
5. **Global memory persistence** - Verify facts are stored and retrieved across sessions

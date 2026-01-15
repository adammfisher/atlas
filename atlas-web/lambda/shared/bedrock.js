const { BedrockRuntimeClient, ConverseStreamCommand, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const https = require('https');

const bedrockClient = new BedrockRuntimeClient({ region: 'us-east-1' });

/**
 * Perform a web search using Google News RSS feed (no API key needed)
 * Falls back to providing helpful guidance if search fails
 */
async function performWebSearch(query) {
  return new Promise((resolve) => {
    const encodedQuery = encodeURIComponent(query);
    // Use Google News RSS which doesn't require authentication
    const url = `https://news.google.com/rss/search?q=${encodedQuery}&hl=en-US&gl=US&ceid=US:en`;

    const options = {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    };

    https.get(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const results = [];

          // Parse RSS items
          const itemRegex = /<item>[\s\S]*?<title>(?:<!\[CDATA\[)?([^\]<]+)(?:\]\]>)?<\/title>[\s\S]*?<link>([^<]+)<\/link>[\s\S]*?<pubDate>([^<]+)<\/pubDate>[\s\S]*?<\/item>/gi;
          let match;
          let count = 0;

          while ((match = itemRegex.exec(data)) !== null && count < 5) {
            const title = match[1].replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;/g, "'").replace(/&quot;/g, '"').trim();
            const link = match[2].trim();
            const pubDate = match[3].trim();

            // Parse the date
            let dateStr = '';
            try {
              const date = new Date(pubDate);
              dateStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
            } catch (e) {
              dateStr = pubDate;
            }

            results.push({
              title: title,
              url: link,
              snippet: `Published: ${dateStr}`
            });
            count++;
          }

          if (results.length === 0) {
            // Fallback message
            resolve({
              query,
              results: [{
                title: 'Search completed',
                url: '',
                snippet: `No specific news results found for "${query}". This may be due to the search terms. Try more specific keywords or check major news sites directly.`
              }],
              timestamp: new Date().toISOString(),
              source: 'google_news_rss'
            });
          } else {
            resolve({
              query,
              results,
              timestamp: new Date().toISOString(),
              source: 'google_news_rss'
            });
          }
        } catch (e) {
          resolve({
            query,
            results: [{
              title: 'Search processing error',
              url: '',
              snippet: `Could not process search results: ${e.message}`
            }],
            timestamp: new Date().toISOString()
          });
        }
      });
    }).on('error', (e) => {
      resolve({
        query,
        results: [{
          title: 'Search connection error',
          url: '',
          snippet: `Could not connect to search service: ${e.message}`
        }],
        timestamp: new Date().toISOString()
      });
    });
  });
}

/**
 * Execute a tool and return the result
 */
async function executeTool(toolName, toolInput) {
  if (toolName === 'web_search') {
    const searchResults = await performWebSearch(toolInput.query);
    return JSON.stringify(searchResults, null, 2);
  }
  return JSON.stringify({ error: `Unknown tool: ${toolName}` });
}

// Claude inference profiles (us. prefix for cross-region inference)
// NOTE: Using Haiku 4.5 which supports both text and image input
const MODELS = {
  haiku: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  // sonnet and opus disabled for now - redirect to haiku
  sonnet: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
  opus: 'us.anthropic.claude-haiku-4-5-20251001-v1:0'
};

// Default model for all requests
const DEFAULT_MODEL = 'haiku';

// Context window limits (in tokens) - leave headroom for response
const CONTEXT_LIMITS = {
  haiku: 200000,
  sonnet: 200000,
  opus: 200000
};

// Compaction threshold - trigger compaction at 80% of context window
const COMPACTION_THRESHOLD = 0.8;

// Target size after compaction - aim for 50% to leave room for growth
const COMPACTION_TARGET = 0.5;

/**
 * Estimate token count for a string
 * Uses ~4 characters per token as a reasonable approximation for Claude
 * This is conservative - actual token count may be lower
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Average ~4 chars per token for English text
  // Add 10% buffer for safety
  return Math.ceil((text.length / 4) * 1.1);
}

/**
 * Estimate tokens for a message (including role overhead)
 */
function estimateMessageTokens(message) {
  let tokens = 4; // Role overhead (user/assistant)

  if (typeof message.content === 'string') {
    tokens += estimateTokens(message.content);
  } else if (message.content) {
    tokens += estimateTokens(message.content);
  }

  // Add overhead for files (rough estimate - images/docs use more tokens)
  if (message.files && message.files.length > 0) {
    for (const file of message.files) {
      if (file.mediaType?.startsWith('image/')) {
        // Images use ~1000-2000 tokens depending on size
        tokens += 1500;
      } else if (file.base64) {
        // Documents - estimate based on decoded size
        const decodedSize = (file.base64.length * 3) / 4;
        tokens += Math.ceil(decodedSize / 4);
      }
    }
  }

  return tokens;
}

/**
 * Calculate total tokens for conversation history
 */
function calculateHistoryTokens(messages) {
  return messages.reduce((total, msg) => total + estimateMessageTokens(msg), 0);
}

/**
 * Build system prompt with optional project context
 * @param {Object|string} projectContext - Enhanced project context object or legacy instructions string
 * @param {boolean} webSearch - Whether web search is enabled
 * @param {Array} existingArtifacts - Array of existing artifacts in the conversation
 */
function buildSystemPrompt(projectContext = null, webSearch = false, existingArtifacts = []) {
  let base = `You are a helpful AI research assistant for enterprise users. You help with:
- Analyzing documents and data
- Answering questions about business processes
- Helping with research and discovery
- Generating documents, diagrams, and analysis`;

  // Add web search capability notice
  if (webSearch) {
    base += `

Tools available:
- web_search: You have access to a web search tool. When the user asks you to search the web, look up current information, or when you need up-to-date data, USE the web_search tool. Do not say you cannot search the web - you CAN and SHOULD use the web_search tool when appropriate.`;
  }

  base += `

Formatting guidelines:
- Simple tables, lists, and formatted text should be written directly in markdown (NOT in code blocks) so they render inline in the conversation.

ARTIFACT FORMAT (CRITICAL - ALWAYS FOLLOW THIS EXACTLY):
When creating any artifact, document, diagram, or downloadable content, you MUST wrap it in <artifact> tags with proper attributes:

<artifact type="TYPE" title="TITLE">
CONTENT HERE
</artifact>

Supported types:
- type="markdown" - For documents, ADRs, reports, essays, notes
- type="html" - For interactive web pages, forms, HTML-specific features
- type="svg" - For vector graphics, diagrams, illustrations
- type="mermaid" - For flowcharts, sequence diagrams, architecture diagrams
- type="json" - For structured data exports
- type="css" - For stylesheets
- type="javascript" or type="js" - For JavaScript code
- type="python" - For Python code
- type="react" or type="jsx" - For React components

IMPORTANT RULES:
1. ALWAYS use <artifact> tags for any substantial content (documents, code, diagrams)
2. ALWAYS include both type and title attributes
3. ALWAYS close the artifact with </artifact>
4. The title should be descriptive and specific
5. Do NOT use code blocks (\`\`\`) inside artifacts - put the raw content directly

CRITICAL - ARTIFACT UPDATES:
6. When the user asks to update, modify, revise, change, add to, or expand an existing artifact, you MUST:
   - Look at the <existing_artifacts> section below to see what artifacts exist
   - Use the EXACT SAME title as the original artifact (copy it character-for-character)
   - This is REQUIRED for the versioning system to work
   - If you use a different title, it creates a duplicate instead of updating

   WRONG: User has "AI Tools Ranking" → You create "Top 30 AI Tools Ranking" ❌
   RIGHT: User has "AI Tools Ranking" → You create "AI Tools Ranking" with updated content ✓

   The user's request to "show top 30" or "add more items" means UPDATE the existing artifact, not create a new one.

Examples:

For a Mermaid diagram:
<artifact type="mermaid" title="User Authentication Flow">
graph TD
    A[User] --> B[Login Page]
    B --> C{Valid Credentials?}
    C -->|Yes| D[Dashboard]
    C -->|No| E[Error Message]
</artifact>

For a Markdown document/ADR:
<artifact type="markdown" title="PII Handling in AI Services">
# Architecture Decision Record (ADR)

**Title:** PII Handling in AI Services
**Status:** Proposed
**Date:** January 2026

## Context
...content...

## Decision
...content...
</artifact>

For HTML:
<artifact type="html" title="Interactive Dashboard">
<!DOCTYPE html>
<html>
<head><title>Dashboard</title></head>
<body>...content...</body>
</html>
</artifact>

Be concise but thorough. Use clear formatting when helpful.`;

  // Add existing artifacts context so Claude knows what artifacts exist and can update them
  if (existingArtifacts && existingArtifacts.length > 0) {
    base += `\n\n<existing_artifacts>
⚠️ CRITICAL: These artifacts ALREADY EXIST. When updating ANY of these, you MUST copy the title EXACTLY (character-for-character) or a duplicate will be created.

${existingArtifacts.map(a => `EXISTING: "${a.title}" (type: ${a.type})`).join('\n')}

RULES FOR UPDATES:
- If user says "update", "modify", "expand", "add to", "change", or similar → Use EXACT title from above
- Do NOT paraphrase or improve the title
- Do NOT add prefixes like "Updated:" or "V2:"
- Copy the title string EXACTLY as shown above

Example: User says "add more items to the diagram"
✓ CORRECT: <artifact type="mermaid" title="${existingArtifacts[0]?.title || 'AWS Multi-Tier Web Application Architecture'}">
✗ WRONG: <artifact type="mermaid" title="Updated AWS Architecture"> or any other variation
</existing_artifacts>`;
  }

  // Handle enhanced project context (object) or legacy instructions (string)
  if (projectContext) {
    if (typeof projectContext === 'string') {
      // Legacy: just instructions string
      base += `\n\n<project_instructions>\n${projectContext}\n</project_instructions>`;
    } else if (typeof projectContext === 'object') {
      // Enhanced project context
      if (projectContext.project) {
        base += `\n\n<project name="${projectContext.project.name}">`;
        if (projectContext.project.description) {
          base += `\n<description>${projectContext.project.description}</description>`;
        }
      }

      // Add project instructions
      if (projectContext.instructions) {
        base += `\n\n<project_instructions>\n${projectContext.instructions}\n</project_instructions>`;
      }

      // Add synthesized memory (high-priority context) - legacy DynamoDB format
      if (projectContext.memory) {
        base += `\n\n<project_memory>
This is synthesized knowledge from previous conversations about this project. Use this context to maintain continuity.

${projectContext.memory}
</project_memory>`;
      }

      // Add semantic memory facts retrieved via vector search (most relevant to current query)
      if (projectContext.semanticMemory) {
        base += `\n\n<semantic_memory>
These are relevant facts retrieved from previous conversations that may be helpful for the current query:

${projectContext.semanticMemory}
</semantic_memory>`;
      }

      // Add relevant conversation snippets from vector search
      if (projectContext.relevantConversations) {
        base += `\n\n<relevant_past_conversations>
These excerpts from previous conversations may provide helpful context:

${projectContext.relevantConversations}
</relevant_past_conversations>`;
      }

      // Add file manifest (awareness of available files)
      if (projectContext.fileManifest && projectContext.fileManifest.length > 0) {
        const manifestText = projectContext.fileManifest
          .map(f => `- ${f.name} (${f.pinned ? 'PINNED' : 'available'}, ${f.tokenCount} tokens, ${f.status})`)
          .join('\n');
        base += `\n\n<available_files>
The following files are available in this project. Pinned files are included in context below. Other files can be referenced but their contents are not currently loaded.

${manifestText}
</available_files>`;
      }

      if (projectContext.project) {
        base += `\n</project>`;
      }
    }
  }

  return base;
}

/**
 * Build messages array for Bedrock Converse API
 * @param {Array} history - Conversation history
 * @param {Object} currentMessage - Current user message with text and files
 * @param {Object|null} projectContext - Enhanced project context (with pinnedFiles) or legacy format
 * @param {Object|null} compactedContext - Compacted conversation context from summarization
 */
function buildMessages(history, currentMessage, projectContext = null, compactedContext = null) {
  const messages = [];

  // Add compacted context first (if any)
  if (compactedContext) {
    if (compactedContext.keyPoints) {
      messages.push({
        role: 'user',
        content: [{
          text: `<conversation_history_key_points>\n${compactedContext.keyPoints}\n</conversation_history_key_points>`,
        }]
      });
      messages.push({
        role: 'assistant',
        content: [{ text: 'I understand the context from earlier in our conversation.' }]
      });
    }
    if (compactedContext.summary) {
      messages.push({
        role: 'user',
        content: [{
          text: `<recent_conversation_summary>\n${compactedContext.summary}\n</recent_conversation_summary>`,
        }]
      });
      messages.push({
        role: 'assistant',
        content: [{ text: 'Got it, I have the context from our recent discussion.' }]
      });
    }
  }

  // Add project context (if any)
  if (projectContext) {
    // Handle enhanced project context with pinnedFiles
    if (projectContext.pinnedFiles && projectContext.pinnedFiles.length > 0) {
      const filesContent = projectContext.pinnedFiles
        .map(f => `<file name="${f.name}" tokens="${f.tokenCount || 'unknown'}">\n${f.content}\n</file>`)
        .join('\n');

      messages.push({
        role: 'user',
        content: [{
          text: `<pinned_project_files>
These files are pinned to this project and should be used as primary context for all responses.

${filesContent}
</pinned_project_files>`,
        }]
      });
      messages.push({
        role: 'assistant',
        content: [{ text: 'I have loaded the pinned project files and will use them as context for our conversation.' }]
      });
    }
    // Handle legacy format with files array
    else if (projectContext.files && projectContext.files.length > 0) {
      const filesContent = projectContext.files
        .map(f => `<file name="${f.name}">\n${f.content}\n</file>`)
        .join('\n');

      messages.push({
        role: 'user',
        content: [{
          text: `<project_files>\n${filesContent}\n</project_files>`,
        }]
      });
      messages.push({
        role: 'assistant',
        content: [{ text: 'I have loaded the project files and context.' }]
      });
    }
  }

  // Add conversation history
  for (const msg of history) {
    const content = [];

    // Add text content
    if (msg.content) {
      content.push({ text: msg.content });
    }

    // Add file attachments if present
    if (msg.files && msg.files.length > 0) {
      for (const file of msg.files) {
        if (file.base64 && file.mediaType) {
          if (file.mediaType.startsWith('image/')) {
            content.push({
              image: {
                format: file.mediaType.split('/')[1],
                source: { bytes: Buffer.from(file.base64, 'base64') }
              }
            });
          } else {
            content.push({
              document: {
                format: getDocumentFormat(file.mediaType),
                name: sanitizeDocumentName(file.name),
                source: { bytes: Buffer.from(file.base64, 'base64') }
              }
            });
          }
        }
      }
    }

    // Ensure user messages always have content (Bedrock requires non-empty content)
    // For empty user messages (e.g., file-only), add a placeholder to maintain structure
    if (content.length === 0 && msg.role === 'user') {
      content.push({ text: '[File uploaded]' });
    }

    // Only add message if it has content
    if (content.length > 0) {
      messages.push({
        role: msg.role,
        content
      });
    }
  }

  // Add current message
  const currentContent = [];

  // Add files first
  if (currentMessage.files && currentMessage.files.length > 0) {
    for (const file of currentMessage.files) {
      if (file.base64 && file.mediaType) {
        if (file.mediaType.startsWith('image/')) {
          // Map common image formats to Bedrock-supported formats
          let format = file.mediaType.split('/')[1];
          if (format === 'jpg') format = 'jpeg';
          currentContent.push({
            image: {
              format: format,
              source: { bytes: Buffer.from(file.base64, 'base64') }
            }
          });
        } else {
          currentContent.push({
            document: {
              format: getDocumentFormat(file.mediaType),
              name: sanitizeDocumentName(file.name),
              source: { bytes: Buffer.from(file.base64, 'base64') }
            }
          });
        }
      }
    }
  }

  // Add text content - if no text provided but files exist, add a default prompt
  if (currentMessage.text) {
    currentContent.push({ text: currentMessage.text });
  } else if (currentContent.length > 0) {
    // Files were added but no text - add a default prompt
    currentContent.push({ text: 'Please analyze this document and provide a summary of its key contents.' });
  }

  // Ensure we have content before adding the message
  if (currentContent.length > 0) {
    messages.push({
      role: 'user',
      content: currentContent
    });
  }

  return messages;
}

/**
 * Get document format for Bedrock
 */
function getDocumentFormat(mediaType) {
  const formats = {
    'application/pdf': 'pdf',
    'text/plain': 'txt',
    'text/html': 'html',
    'text/csv': 'csv',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'xlsx',
    'text/markdown': 'md'
  };
  return formats[mediaType] || 'txt';
}

/**
 * Sanitize document name for Bedrock Converse API
 * Bedrock only allows: alphanumeric, whitespace, hyphens, parentheses, square brackets
 * No consecutive whitespace, no leading/trailing whitespace
 * IMPORTANT: The 'name' field must NOT include file extension - extension is in 'format' field
 */
function sanitizeDocumentName(name) {
  if (!name) return 'document';

  // Remove extension - Bedrock's 'name' field doesn't allow dots
  // The format is specified separately in the 'format' field
  const lastDot = name.lastIndexOf('.');
  let baseName = lastDot > 0 ? name.substring(0, lastDot) : name;

  // Replace invalid characters with hyphens (keep alphanumeric, spaces, hyphens, (), [])
  baseName = baseName.replace(/[^a-zA-Z0-9\s\-\(\)\[\]]/g, '-');

  // Replace multiple consecutive whitespace with single space
  baseName = baseName.replace(/\s+/g, ' ');

  // Replace multiple consecutive hyphens with single hyphen
  baseName = baseName.replace(/-+/g, '-');

  // Trim whitespace and hyphens from start/end
  baseName = baseName.replace(/^[\s-]+|[\s-]+$/g, '');

  // Ensure we have a valid name
  if (!baseName) baseName = 'document';

  // Limit length (Bedrock has a limit of 200, being conservative with 100)
  if (baseName.length > 100) {
    baseName = baseName.substring(0, 100).replace(/[\s-]+$/, '');
  }

  return baseName;
}

/**
 * Stream chat completion with extended thinking support
 */
async function* streamChat(options) {
  const {
    messages,
    model = 'haiku',
    systemPrompt,
    maxTokens = 16384,
    extendedThinking = false,
    thinkingBudget = 10000,
    webSearch = false,
    mcpServers = []
  } = options;

  const modelId = MODELS[model] || MODELS.haiku;

  const commandParams = {
    modelId,
    messages,
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens,
      temperature: 1
    }
  };

  // Add extended thinking if enabled
  if (extendedThinking) {
    commandParams.additionalModelRequestFields = {
      thinking: {
        type: 'enabled',
        budget_tokens: thinkingBudget
      }
    };
  }

  // Add tools if web search or MCP is enabled
  const tools = [];
  if (webSearch) {
    tools.push({
      toolSpec: {
        name: 'web_search',
        description: 'Search the web for current information',
        inputSchema: {
          json: {
            type: 'object',
            properties: {
              query: { type: 'string', description: 'Search query' }
            },
            required: ['query']
          }
        }
      }
    });
  }

  if (tools.length > 0) {
    commandParams.toolConfig = { tools };
  }

  const command = new ConverseStreamCommand(commandParams);
  const response = await bedrockClient.send(command);

  for await (const event of response.stream) {
    if (event.contentBlockStart) {
      yield { type: 'content_block_start', index: event.contentBlockStart.contentBlockIndex };
    }
    
    if (event.contentBlockDelta) {
      const delta = event.contentBlockDelta.delta;
      if (delta.text) {
        yield { type: 'text', content: delta.text };
      }
      if (delta.thinking) {
        yield { type: 'thinking', content: delta.thinking };
      }
      if (delta.toolUse) {
        yield { type: 'tool_use', toolUse: delta.toolUse };
      }
    }

    if (event.contentBlockStop) {
      yield { type: 'content_block_stop', index: event.contentBlockStop.contentBlockIndex };
    }

    if (event.messageStop) {
      yield { type: 'message_stop', stopReason: event.messageStop.stopReason };
    }

    if (event.metadata) {
      yield { 
        type: 'metadata', 
        usage: event.metadata.usage,
        metrics: event.metadata.metrics
      };
    }
  }
}

/**
 * Non-streaming chat (for summarization, etc.)
 */
async function chat(options) {
  const {
    messages,
    model = 'haiku',
    systemPrompt = 'You are a helpful assistant.',
    maxTokens = 2048
  } = options;

  const modelId = MODELS[model] || MODELS.haiku;

  const command = new ConverseCommand({
    modelId,
    messages,
    system: [{ text: systemPrompt }],
    inferenceConfig: {
      maxTokens,
      temperature: 0.7
    }
  });

  const response = await bedrockClient.send(command);
  return response.output.message.content[0].text;
}

/**
 * Summarize messages for compaction
 */
async function summarizeMessages(messages) {
  const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  return chat({
    model: 'haiku',
    messages: [{
      role: 'user',
      content: [{ text: `Summarize this conversation segment concisely, preserving key decisions, questions asked, and information shared:\n\n${text}` }]
    }],
    maxTokens: 500
  });
}

/**
 * Extract key points from old messages
 */
async function extractKeyPoints(messages) {
  const text = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  
  return chat({
    model: 'haiku',
    messages: [{
      role: 'user',
      content: [{ text: `Extract only the most important key points from this old conversation history (bullet points, max 5):\n\n${text}` }]
    }],
    maxTokens: 300
  });
}

/**
 * Compact conversation history based on token count
 *
 * @param {Array} messages - Full conversation history
 * @param {Object} cachedSummary - Previously cached summary (if any)
 * @param {string} model - Model being used (for context limits)
 * @returns {Object} Compaction result with recent messages and summarized context
 */
async function compactConversation(messages, cachedSummary = null, model = 'haiku') {
  const contextLimit = CONTEXT_LIMITS[model] || CONTEXT_LIMITS.haiku;
  const thresholdTokens = contextLimit * COMPACTION_THRESHOLD;
  const targetTokens = contextLimit * COMPACTION_TARGET;

  // Calculate current token usage
  const totalTokens = calculateHistoryTokens(messages);

  console.log(`[Compaction] Total tokens: ${totalTokens}, Threshold: ${thresholdTokens}, Target: ${targetTokens}`);

  // No compaction needed if under threshold
  if (totalTokens < thresholdTokens) {
    return { messages, compacted: false, totalTokens };
  }

  console.log(`[Compaction] Triggering compaction - ${totalTokens} tokens exceeds ${thresholdTokens} threshold`);

  // Find the split point: keep recent messages that fit in target, summarize the rest
  // Work backwards from the end to find how many messages fit in target
  let recentTokens = 0;
  let splitIndex = messages.length;

  for (let i = messages.length - 1; i >= 0; i--) {
    const msgTokens = estimateMessageTokens(messages[i]);
    if (recentTokens + msgTokens > targetTokens) {
      splitIndex = i + 1;
      break;
    }
    recentTokens += msgTokens;
    if (i === 0) splitIndex = 0;
  }

  // Ensure we keep at least the last 5 messages for context continuity
  const minRecentMessages = 5;
  if (messages.length - splitIndex < minRecentMessages) {
    splitIndex = Math.max(0, messages.length - minRecentMessages);
  }

  const recentMessages = messages.slice(splitIndex);
  const oldMessages = messages.slice(0, splitIndex);

  console.log(`[Compaction] Keeping ${recentMessages.length} recent messages (~${recentTokens} tokens), summarizing ${oldMessages.length} old messages`);

  if (oldMessages.length === 0) {
    return { messages, compacted: false, totalTokens };
  }

  // Further split old messages into "old" (key points) and "middle" (summary)
  // Middle = more recent half of old messages, Old = older half
  const midPoint = Math.floor(oldMessages.length / 2);
  const tiers = {
    recent: recentMessages,
    middle: oldMessages.slice(midPoint),
    old: oldMessages.slice(0, midPoint)
  };

  let keyPoints = null;
  let middleSummary = null;

  // Calculate token hash for cache validation (more accurate than message count)
  const oldTokenCount = calculateHistoryTokens(oldMessages);

  // Check if we can use cached summary (validate by token count, not message count)
  if (cachedSummary && cachedSummary.tokenCount === oldTokenCount) {
    console.log('[Compaction] Using cached summary');
    keyPoints = cachedSummary.keyPoints;
    middleSummary = cachedSummary.middleSummary;
  } else {
    console.log('[Compaction] Generating new summaries');
    // Generate new summaries in parallel
    const [middleResult, oldResult] = await Promise.all([
      tiers.middle.length > 0 ? summarizeMessages(tiers.middle) : null,
      tiers.old.length > 0 ? extractKeyPoints(tiers.old) : null
    ]);
    middleSummary = middleResult;
    keyPoints = oldResult;
  }

  return {
    recentMessages: tiers.recent,
    compactedContext: { keyPoints, summary: middleSummary },
    compacted: true,
    tokenCount: oldTokenCount, // For cache validation
    messageCount: oldMessages.length, // Keep for backwards compat
    keyPoints,
    middleSummary,
    stats: {
      originalTokens: totalTokens,
      recentTokens: calculateHistoryTokens(recentMessages),
      summarizedMessages: oldMessages.length
    }
  };
}

/**
 * Stream chat with tool use support (agentic loop)
 * This handles tool calls by executing them and continuing the conversation
 */
async function* streamChatWithTools(options) {
  const {
    messages: initialMessages,
    model = 'haiku',
    systemPrompt,
    maxTokens = 16384,
    extendedThinking = false,
    thinkingBudget = 10000,
    webSearch = false,
    onSearchStart = null,
    onSearchResults = null
  } = options;

  const modelId = MODELS[model] || MODELS.haiku;
  let messages = [...initialMessages];
  let continueLoop = true;
  let loopCount = 0;
  const maxLoops = 5; // Allow up to 5 iterations (Lambda timeout is 300s)

  while (continueLoop && loopCount < maxLoops) {
    loopCount++;
    continueLoop = false;

    console.log(`[streamChatWithTools] Loop ${loopCount}, messages:`, messages.length);
    // Debug: log message structure
    messages.forEach((m, i) => {
      console.log(`  [${i}] role=${m.role}, content types:`, m.content.map(c => Object.keys(c)[0]).join(', '));
    });

    const commandParams = {
      modelId,
      messages,
      system: [{ text: systemPrompt }],
      inferenceConfig: {
        maxTokens,
        temperature: 1
      }
    };

    // Add extended thinking if enabled
    if (extendedThinking) {
      commandParams.additionalModelRequestFields = {
        thinking: {
          type: 'enabled',
          budget_tokens: thinkingBudget
        }
      };
    }

    // Add tools if web search is enabled
    if (webSearch) {
      commandParams.toolConfig = {
        tools: [{
          toolSpec: {
            name: 'web_search',
            description: 'Search the web for current information. Use this when you need up-to-date information about current events, news, or any topic that may have changed recently.',
            inputSchema: {
              json: {
                type: 'object',
                properties: {
                  query: { type: 'string', description: 'The search query' }
                },
                required: ['query']
              }
            }
          }
        }]
      };
    }

    const command = new ConverseStreamCommand(commandParams);
    let response;
    try {
      response = await bedrockClient.send(command);
    } catch (error) {
      console.error('[streamChatWithTools] Bedrock error:', error.message);
      console.error('[streamChatWithTools] Messages structure:', JSON.stringify(messages, null, 2));
      throw error;
    }

    let currentToolUse = null;
    let toolUseId = null;
    let toolInput = '';
    let assistantContent = [];
    let hasText = false;
    let pendingToolUses = []; // Collect all tool uses before executing

    for await (const event of response.stream) {
      if (event.contentBlockStart) {
        const start = event.contentBlockStart.start;
        if (start && start.toolUse) {
          currentToolUse = start.toolUse.name;
          toolUseId = start.toolUse.toolUseId;
          toolInput = '';
        }
      }

      if (event.contentBlockDelta) {
        const delta = event.contentBlockDelta.delta;

        if (delta.text) {
          hasText = true;
          yield { type: 'text', content: delta.text };
          // Accumulate text for assistant message
          if (!assistantContent.length || assistantContent[assistantContent.length - 1].toolUse) {
            assistantContent.push({ text: delta.text });
          } else {
            assistantContent[assistantContent.length - 1].text += delta.text;
          }
        }

        if (delta.thinking) {
          yield { type: 'thinking', content: delta.thinking };
        }

        if (delta.toolUse) {
          toolInput += delta.toolUse.input || '';
        }
      }

      if (event.contentBlockStop) {
        if (currentToolUse && toolUseId) {
          // Parse the tool input
          let parsedInput;
          try {
            parsedInput = JSON.parse(toolInput);
          } catch (e) {
            parsedInput = { query: toolInput };
          }

          // Add tool use to assistant content
          assistantContent.push({
            toolUse: {
              toolUseId,
              name: currentToolUse,
              input: parsedInput
            }
          });

          // Add to pending tool uses - we'll execute them after messageStop
          pendingToolUses.push({
            toolUseId,
            name: currentToolUse,
            input: parsedInput
          });

          // Notify about search start
          if (currentToolUse === 'web_search' && onSearchStart) {
            onSearchStart(parsedInput.query);
          }
          yield { type: 'search_start', query: parsedInput.query };

          currentToolUse = null;
          toolUseId = null;
        }
      }

      if (event.messageStop) {
        const stopReason = event.messageStop.stopReason;

        // Execute all pending tool uses after the message is complete
        if (stopReason === 'tool_use' && pendingToolUses.length > 0) {
          // Add assistant message with all tool uses
          messages.push({
            role: 'assistant',
            content: assistantContent
          });

          // Execute all tools and collect results
          const toolResults = [];
          for (const tool of pendingToolUses) {
            const toolResult = await executeTool(tool.name, tool.input);

            // Notify about search results
            if (tool.name === 'web_search' && onSearchResults) {
              try {
                const results = JSON.parse(toolResult);
                onSearchResults(tool.input.query, results);
              } catch (e) {}
            }
            yield { type: 'search_results', query: tool.input.query, results: toolResult };

            toolResults.push({
              toolResult: {
                toolUseId: tool.toolUseId,
                content: [{ text: toolResult }]
              }
            });
          }

          // Add all tool results in a single user message
          messages.push({
            role: 'user',
            content: toolResults
          });

          pendingToolUses = [];
          continueLoop = true; // Continue the loop to get Claude's response to the tool results
        } else {
          continueLoop = false;
        }
        yield { type: 'message_stop', stopReason };
      }

      if (event.metadata) {
        yield {
          type: 'metadata',
          usage: event.metadata.usage,
          metrics: event.metadata.metrics
        };
      }
    }

    // If no tool was used but we have content, add it to messages for context
    if (!continueLoop && hasText && assistantContent.length > 0) {
      // Final response, don't need to add to messages
    }
  }
}

module.exports = {
  MODELS,
  CONTEXT_LIMITS,
  COMPACTION_THRESHOLD,
  COMPACTION_TARGET,
  estimateTokens,
  estimateMessageTokens,
  calculateHistoryTokens,
  buildSystemPrompt,
  buildMessages,
  streamChat,
  streamChatWithTools,
  chat,
  summarizeMessages,
  extractKeyPoints,
  compactConversation,
  executeTool,
  performWebSearch
};

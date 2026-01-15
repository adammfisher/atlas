/**
 * Memory Extractor
 *
 * Uses Claude Haiku to extract discrete, searchable facts from conversations.
 * These facts are stored as vectors for semantic retrieval.
 */
const { BedrockRuntimeClient, ConverseCommand } = require('@aws-sdk/client-bedrock-runtime');
const { nanoid } = require('nanoid');

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Use Haiku 4.5 for cost-effective extraction (+ vision support)
const EXTRACTION_MODEL = 'us.anthropic.claude-haiku-4-5-20251001-v1:0';

const EXTRACTION_PROMPT = `You are a memory extraction system. Analyze the conversation and extract discrete, searchable facts that would be useful to recall later.

For each fact, provide:
- fact: A clear, standalone statement (should make sense without context)
- category: One of [decision, preference, technical, personal, goal, blocker, learning, context]
- confidence: 0.0-1.0 based on how certain/important this fact is

Focus on:
- Decisions made
- User preferences and requirements
- Technical details (APIs, libraries, patterns used)
- Project goals and milestones
- Blockers and how they were resolved
- Key learnings and insights
- Important context about the project

Do NOT extract:
- Generic conversation filler
- Uncertain or speculative statements
- Information that's only relevant in immediate context
- Greetings or pleasantries

Return a JSON array of facts. If no meaningful facts, return empty array [].

Example output:
[
  {"fact": "User prefers React with TypeScript for frontend projects", "category": "preference", "confidence": 0.9},
  {"fact": "Authentication is implemented using JWT with 10-hour expiration", "category": "technical", "confidence": 1.0},
  {"fact": "Next milestone is to complete payment integration by end of Q1", "category": "goal", "confidence": 0.8}
]

Conversation to analyze:
<conversation>
{{CONVERSATION}}
</conversation>

Return ONLY the JSON array, no other text.`;

/**
 * Extract memory facts from a conversation using Claude Haiku
 * @param {Array} messages - Array of {role, content} message objects
 * @returns {Promise<Array>} - Array of extracted facts with IDs
 */
async function extractFacts(messages) {
  if (!messages || messages.length === 0) {
    return [];
  }

  // Format conversation for the prompt
  const conversationText = messages.map(m =>
    `${m.role.toUpperCase()}: ${m.content}`
  ).join('\n\n');

  // Truncate if too long (keep context under 50K tokens)
  const truncatedConversation = conversationText.slice(0, 150000);

  const prompt = EXTRACTION_PROMPT.replace('{{CONVERSATION}}', truncatedConversation);

  try {
    const response = await client.send(new ConverseCommand({
      modelId: EXTRACTION_MODEL,
      messages: [{
        role: 'user',
        content: [{ text: prompt }]
      }],
      system: [{
        text: 'You are a memory extraction assistant. Return only valid JSON arrays with extracted facts. No markdown, no explanations.'
      }],
      inferenceConfig: {
        maxTokens: 4096,
        temperature: 0.3
      }
    }));

    const content = response.output.message.content[0].text;

    // Parse the JSON response
    const facts = parseFactsResponse(content);

    // Add IDs and timestamps to each fact
    return facts.map(fact => ({
      factId: `fact_${nanoid(12)}`,
      content: fact.fact,
      category: fact.category,
      confidence: fact.confidence,
      timestamp: Date.now()
    }));
  } catch (err) {
    console.error('[MemoryExtractor] Extraction failed:', err.message);
    return [];
  }
}

/**
 * Parse facts from Claude's response, handling potential formatting issues
 * @param {string} content - Raw response content
 * @returns {Array} - Parsed facts array
 */
function parseFactsResponse(content) {
  try {
    // Try direct JSON parse first
    return JSON.parse(content);
  } catch {
    // Try to extract JSON array from markdown code blocks
    const jsonMatch = content.match(/\[\s*[\s\S]*?\s*\]/);
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[0]);
      } catch {
        console.error('[MemoryExtractor] Failed to parse extracted JSON:', content.substring(0, 500));
        return [];
      }
    }
    console.error('[MemoryExtractor] No JSON array found in response:', content.substring(0, 500));
    return [];
  }
}

/**
 * Chunk a conversation into smaller pieces for embedding
 * Each chunk maintains context continuity and respects message boundaries
 * @param {Array} messages - Full conversation messages
 * @param {number} chunkSize - Target chunk size in characters (default 2000)
 * @returns {Array} - Array of chunks with metadata
 */
function chunkConversation(messages, chunkSize = 2000) {
  const chunks = [];
  let currentChunk = [];
  let currentSize = 0;

  for (const message of messages) {
    const messageSize = message.content?.length || 0;

    // If adding this message would exceed chunk size, save current chunk
    if (currentSize + messageSize > chunkSize && currentChunk.length > 0) {
      chunks.push(createChunk(currentChunk));
      currentChunk = [];
      currentSize = 0;
    }

    // If single message exceeds chunk size, create chunk from it alone
    if (messageSize > chunkSize) {
      if (currentChunk.length > 0) {
        chunks.push(createChunk(currentChunk));
        currentChunk = [];
        currentSize = 0;
      }
      // Split large message into multiple chunks
      const parts = splitLargeMessage(message, chunkSize);
      chunks.push(...parts);
    } else {
      currentChunk.push(message);
      currentSize += messageSize;
    }
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(createChunk(currentChunk));
  }

  return chunks;
}

/**
 * Create a chunk object from messages
 * @param {Array} messages - Messages in the chunk
 * @returns {Object} - Chunk object
 */
function createChunk(messages) {
  return {
    messages,
    content: messages.map(m => `${m.role}: ${m.content}`).join('\n'),
    startTimestamp: messages[0]?.timestamp || Date.now(),
    endTimestamp: messages[messages.length - 1]?.timestamp || Date.now(),
    messageCount: messages.length
  };
}

/**
 * Split a large message into multiple chunks
 * @param {Object} message - Message to split
 * @param {number} chunkSize - Target chunk size
 * @returns {Array} - Array of chunk objects
 */
function splitLargeMessage(message, chunkSize) {
  const chunks = [];
  const content = message.content || '';
  const prefix = `${message.role}: `;

  // Split by paragraphs or sentences
  const paragraphs = content.split(/\n\n+/);
  let currentContent = '';

  for (const paragraph of paragraphs) {
    if (currentContent.length + paragraph.length > chunkSize - prefix.length) {
      if (currentContent.length > 0) {
        chunks.push({
          messages: [{ ...message, content: currentContent.trim() }],
          content: prefix + currentContent.trim(),
          startTimestamp: message.timestamp || Date.now(),
          endTimestamp: message.timestamp || Date.now(),
          messageCount: 1
        });
        currentContent = '';
      }
    }
    currentContent += (currentContent ? '\n\n' : '') + paragraph;
  }

  // Add remaining content
  if (currentContent.length > 0) {
    chunks.push({
      messages: [{ ...message, content: currentContent.trim() }],
      content: prefix + currentContent.trim(),
      startTimestamp: message.timestamp || Date.now(),
      endTimestamp: message.timestamp || Date.now(),
      messageCount: 1
    });
  }

  return chunks;
}

/**
 * Estimate the number of facts that might be extracted from messages
 * Useful for rate limiting and cost estimation
 * @param {Array} messages - Messages to analyze
 * @returns {number} - Estimated fact count
 */
function estimateFactCount(messages) {
  if (!messages || messages.length === 0) return 0;

  // Rough heuristic: ~1 fact per 2-3 message exchanges
  const exchanges = Math.ceil(messages.length / 2);

  // More facts in technical discussions
  const technicalIndicators = ['code', 'api', 'function', 'class', 'database', 'deploy'];
  const hasTechnical = messages.some(m =>
    technicalIndicators.some(ind => m.content?.toLowerCase().includes(ind))
  );

  return hasTechnical ? Math.ceil(exchanges * 1.5) : exchanges;
}

module.exports = {
  extractFacts,
  chunkConversation,
  estimateFactCount
};

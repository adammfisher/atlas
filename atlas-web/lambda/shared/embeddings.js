/**
 * Embeddings Client for Amazon Titan Embeddings V2
 *
 * Generates vector embeddings for text using Amazon Titan Embeddings V2.
 * These embeddings are used for semantic search in the project memory system.
 */
const { BedrockRuntimeClient, InvokeModelCommand } = require('@aws-sdk/client-bedrock-runtime');

const client = new BedrockRuntimeClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Titan Embeddings V2 configuration
const MODEL_ID = 'amazon.titan-embed-text-v2:0';
const EMBEDDING_DIMENSION = 1024; // Titan V2 supports 256, 512, or 1024
const MAX_INPUT_CHARS = 32000; // ~8192 tokens

/**
 * Generate embedding vector for text using Titan Embeddings V2
 * @param {string} text - Text to embed (max ~8192 tokens)
 * @returns {Promise<number[]>} - 1024-dimensional vector
 */
async function getEmbedding(text) {
  if (!text || text.trim().length === 0) {
    throw new Error('Text cannot be empty');
  }

  // Truncate if too long (Titan V2 supports ~8192 tokens, roughly 4 chars/token)
  const truncatedText = text.slice(0, MAX_INPUT_CHARS);

  const response = await client.send(new InvokeModelCommand({
    modelId: MODEL_ID,
    contentType: 'application/json',
    accept: 'application/json',
    body: JSON.stringify({
      inputText: truncatedText,
      dimensions: EMBEDDING_DIMENSION,
      normalize: true // L2 normalize for cosine similarity
    })
  }));

  const result = JSON.parse(new TextDecoder().decode(response.body));
  return result.embedding;
}

/**
 * Generate embeddings for multiple texts
 * Note: Titan doesn't support true batching, so we parallelize requests
 * @param {string[]} texts - Array of texts to embed
 * @param {number} concurrency - Max concurrent requests (default 5)
 * @returns {Promise<number[][]>} - Array of embedding vectors
 */
async function batchEmbeddings(texts, concurrency = 5) {
  if (!texts || texts.length === 0) {
    return [];
  }

  const results = [];

  // Process in batches to control concurrency
  for (let i = 0; i < texts.length; i += concurrency) {
    const batch = texts.slice(i, i + concurrency);
    const batchResults = await Promise.all(
      batch.map(text => getEmbedding(text).catch(err => {
        console.error(`Embedding failed for text: ${text.substring(0, 100)}...`, err.message);
        return null; // Return null for failed embeddings
      }))
    );
    results.push(...batchResults);
  }

  return results;
}

/**
 * Estimate token count for text (rough approximation)
 * @param {string} text - Text to estimate
 * @returns {number} - Estimated token count
 */
function estimateTokens(text) {
  if (!text) return 0;
  // Rough estimate: ~4 chars per token for English text
  return Math.ceil(text.length / 4);
}

/**
 * Check if text is within embedding limits
 * @param {string} text - Text to check
 * @returns {boolean} - Whether text can be embedded without truncation
 */
function canEmbedWithoutTruncation(text) {
  return text && text.length <= MAX_INPUT_CHARS;
}

module.exports = {
  getEmbedding,
  batchEmbeddings,
  estimateTokens,
  canEmbedWithoutTruncation,
  EMBEDDING_DIMENSION,
  MAX_INPUT_CHARS
};

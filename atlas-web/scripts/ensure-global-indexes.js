#!/usr/bin/env node
/**
 * Ensure Global Indexes Script
 *
 * Creates the two shared global indexes for user-level memory:
 * - global-memories: Stores extracted facts from non-project conversations
 * - global-conversations: Stores conversation chunks from non-project chats
 *
 * This script is idempotent - it can be run multiple times safely.
 * Run this ONCE as infrastructure setup, not per-user.
 *
 * Usage: node scripts/ensure-global-indexes.js
 */

// Load dotenv if available
try {
  require('dotenv').config();
} catch (e) {
  // dotenv not installed, using environment variables directly
}

const {
  S3VectorsClient,
  CreateIndexCommand,
  GetIndexCommand
} = require('@aws-sdk/client-s3vectors');

const VECTOR_BUCKET = process.env.VECTORS_BUCKET;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';

// Shared index names - these are used by all users
const GLOBAL_MEMORIES_INDEX = 'global-memories';
const GLOBAL_CONVERSATIONS_INDEX = 'global-conversations';

// Embedding dimension from Amazon Titan Embeddings V2
const EMBEDDING_DIMENSION = 1024;

const client = new S3VectorsClient({ region: AWS_REGION });

async function indexExists(indexName) {
  try {
    await client.send(new GetIndexCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName
    }));
    return true;
  } catch (err) {
    // Handle various "not found" error types from S3 Vectors
    if (err.name === 'ResourceNotFoundException' ||
        err.name === 'NotFoundException' ||
        err.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw err;
  }
}

async function createIndex(indexName, description) {
  console.log(`\n[${indexName}] Checking if index exists...`);

  const exists = await indexExists(indexName);
  if (exists) {
    console.log(`[${indexName}] ✓ Index already exists`);
    return { created: false, indexName };
  }

  console.log(`[${indexName}] Creating index...`);

  try {
    await client.send(new CreateIndexCommand({
      vectorBucketName: VECTOR_BUCKET,
      indexName,
      dimension: EMBEDDING_DIMENSION,
      distanceMetric: 'cosine',
      dataType: 'float32',
      metadataConfiguration: {
        // Non-filterable keys are returned but not queryable (saves storage)
        // All other metadata keys are filterable by default
        nonFilterableMetadataKeys: description === 'memories'
          ? ['content', 'source_context', 'extraction_reasoning']
          : ['content', 'summary']
      }
    }));

    console.log(`[${indexName}] ✓ Index created successfully`);
    return { created: true, indexName };
  } catch (err) {
    if (err.name === 'ConflictException' || err.message?.includes('already exists')) {
      console.log(`[${indexName}] ✓ Index already exists (race condition)`);
      return { created: false, indexName };
    }
    throw err;
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('Global Index Initialization Script');
  console.log('='.repeat(60));

  // Validate environment
  if (!VECTOR_BUCKET) {
    console.error('\n✗ ERROR: VECTORS_BUCKET environment variable not set');
    console.error('  Set it in your .env file or environment:');
    console.error('  export VECTORS_BUCKET=your-bucket-name');
    process.exit(1);
  }

  console.log(`\nConfiguration:`);
  console.log(`  AWS Region: ${AWS_REGION}`);
  console.log(`  Vector Bucket: ${VECTOR_BUCKET}`);
  console.log(`  Embedding Dimension: ${EMBEDDING_DIMENSION}`);

  const results = [];

  try {
    // Create global memories index
    results.push(await createIndex(GLOBAL_MEMORIES_INDEX, 'memories'));

    // Create global conversations index
    results.push(await createIndex(GLOBAL_CONVERSATIONS_INDEX, 'conversations'));

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('Summary:');
    console.log('='.repeat(60));

    const created = results.filter(r => r.created).length;
    const existing = results.filter(r => !r.created).length;

    if (created > 0) {
      console.log(`  Created: ${created} index(es)`);
    }
    if (existing > 0) {
      console.log(`  Already existed: ${existing} index(es)`);
    }

    console.log('\n✓ Global indexes are ready for use');
    console.log('\nIndexes created:');
    console.log(`  - ${GLOBAL_MEMORIES_INDEX}: Stores user facts with user_id filtering`);
    console.log(`  - ${GLOBAL_CONVERSATIONS_INDEX}: Stores conversation chunks with user_id filtering`);

  } catch (err) {
    console.error('\n✗ ERROR:', err.message);
    console.error('\nFull error:', err);
    process.exit(1);
  }
}

main();

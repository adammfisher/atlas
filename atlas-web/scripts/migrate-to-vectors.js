#!/usr/bin/env node

/**
 * Migration Script: Populate S3 Vectors from Existing Conversations
 *
 * This script processes all existing projects and their conversations to:
 * 1. Create vector indexes for each project
 * 2. Extract facts from conversations using Haiku
 * 3. Generate embeddings and store in S3 Vectors
 *
 * Usage:
 *   node scripts/migrate-to-vectors.js [--dry-run] [--project <projectId>] [--user <userId>]
 *
 * Environment variables required:
 *   - PROJECTS_TABLE
 *   - SESSIONS_TABLE
 *   - MESSAGES_TABLE
 *   - VECTORS_BUCKET
 *   - AWS_REGION (defaults to us-east-1)
 */

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { LambdaClient, InvokeCommand } = require('@aws-sdk/client-lambda');

// Parse command line arguments
const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const projectFilter = args.includes('--project') ? args[args.indexOf('--project') + 1] : null;
const userFilter = args.includes('--user') ? args[args.indexOf('--user') + 1] : null;

// Configuration
const config = {
  region: process.env.AWS_REGION || 'us-east-1',
  tables: {
    projects: process.env.PROJECTS_TABLE || 'atlas-dev-projects',
    sessions: process.env.SESSIONS_TABLE || 'atlas-dev-sessions',
    messages: process.env.MESSAGES_TABLE || 'atlas-dev-messages'
  },
  memoryProcessorLambda: process.env.MEMORY_PROCESSOR_LAMBDA || 'atlas-dev-memory-processor',
  vectorsBucket: process.env.VECTORS_BUCKET
};

// Initialize clients
const dynamoClient = new DynamoDBClient({ region: config.region });
const docClient = DynamoDBDocumentClient.from(dynamoClient, {
  marshallOptions: { removeUndefinedValues: true }
});
const lambdaClient = new LambdaClient({ region: config.region });

// Stats tracking
const stats = {
  projectsScanned: 0,
  projectsProcessed: 0,
  sessionsProcessed: 0,
  indexesCreated: 0,
  errors: [],
  startTime: Date.now()
};

/**
 * Get all projects from DynamoDB
 */
async function getAllProjects() {
  const projects = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: config.tables.projects
    };

    // Only add ExclusiveStartKey if we have one from previous page
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    // Apply filters if provided
    if (projectFilter) {
      params.FilterExpression = 'projectId = :projectId';
      params.ExpressionAttributeValues = { ':projectId': projectFilter };
    } else if (userFilter) {
      params.FilterExpression = 'userId = :userId';
      params.ExpressionAttributeValues = { ':userId': userFilter };
    }

    const response = await docClient.send(new ScanCommand(params));
    projects.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return projects;
}

/**
 * Get all sessions for a project
 */
async function getProjectSessions(projectId) {
  const sessions = [];
  let lastEvaluatedKey = undefined;

  do {
    const params = {
      TableName: config.tables.sessions,
      IndexName: 'projectId-updatedAt-index',
      KeyConditionExpression: 'projectId = :projectId',
      ExpressionAttributeValues: {
        ':projectId': projectId
      }
    };

    // Only add ExclusiveStartKey if we have one from previous page
    if (lastEvaluatedKey) {
      params.ExclusiveStartKey = lastEvaluatedKey;
    }

    const response = await docClient.send(new QueryCommand(params));
    sessions.push(...(response.Items || []));
    lastEvaluatedKey = response.LastEvaluatedKey;
  } while (lastEvaluatedKey);

  return sessions;
}

/**
 * Get message count for a session
 */
async function getSessionMessageCount(sessionId) {
  const response = await docClient.send(new QueryCommand({
    TableName: config.tables.messages,
    KeyConditionExpression: 'sessionId = :sessionId',
    ExpressionAttributeValues: {
      ':sessionId': sessionId
    },
    Select: 'COUNT'
  }));

  return response.Count || 0;
}

/**
 * Invoke memory processor Lambda to process a session
 */
async function processSession(userId, projectId, sessionId) {
  if (DRY_RUN) {
    console.log(`    [DRY RUN] Would process session: ${sessionId}`);
    return { success: true, dryRun: true };
  }

  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: config.memoryProcessorLambda,
      InvocationType: 'Event', // Async invocation
      Payload: JSON.stringify({
        action: 'processSession',
        userId,
        projectId,
        sessionId
      })
    }));

    if (response.StatusCode === 202) {
      return { success: true, async: true };
    } else {
      return { success: false, error: `Unexpected status code: ${response.StatusCode}` };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Initialize vector indexes for a project
 */
async function initializeProjectIndexes(userId, projectId) {
  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would create indexes for project: ${projectId}`);
    return { success: true, dryRun: true };
  }

  try {
    const response = await lambdaClient.send(new InvokeCommand({
      FunctionName: config.memoryProcessorLambda,
      InvocationType: 'RequestResponse', // Sync - wait for completion
      Payload: JSON.stringify({
        action: 'initializeIndexes',
        userId,
        projectId
      })
    }));

    const result = JSON.parse(new TextDecoder().decode(response.Payload));
    if (result.statusCode === 200) {
      return { success: true };
    } else {
      return { success: false, error: result.body };
    }
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Update project to mark migration status
 */
async function updateProjectMigrationStatus(userId, projectId, status) {
  if (DRY_RUN) return;

  try {
    await docClient.send(new UpdateCommand({
      TableName: config.tables.projects,
      Key: { userId, projectId },
      UpdateExpression: 'SET vectorMigration = :status',
      ExpressionAttributeValues: {
        ':status': status
      }
    }));
  } catch (err) {
    console.error(`  Failed to update migration status for ${projectId}:`, err.message);
  }
}

/**
 * Process a single project
 */
async function processProject(project) {
  const { userId, projectId, name } = project;
  console.log(`\nProcessing project: ${name} (${projectId})`);
  console.log(`  User: ${userId}`);

  stats.projectsScanned++;

  // Check if already migrated
  if (project.vectorMigration?.status === 'complete') {
    console.log(`  Skipping - already migrated`);
    return;
  }

  // 1. Initialize vector indexes
  console.log(`  Creating vector indexes...`);
  const indexResult = await initializeProjectIndexes(userId, projectId);

  if (!indexResult.success && !indexResult.dryRun) {
    console.error(`  Failed to create indexes: ${indexResult.error}`);
    stats.errors.push({ projectId, error: `Index creation failed: ${indexResult.error}` });
    await updateProjectMigrationStatus(userId, projectId, { status: 'failed', error: indexResult.error, timestamp: Date.now() });
    return;
  }

  if (!indexResult.dryRun) {
    stats.indexesCreated++;
  }

  // 2. Get all sessions for this project
  const sessions = await getProjectSessions(projectId);
  console.log(`  Found ${sessions.length} sessions`);

  if (sessions.length === 0) {
    console.log(`  No sessions to process`);
    await updateProjectMigrationStatus(userId, projectId, { status: 'complete', sessionsProcessed: 0, timestamp: Date.now() });
    stats.projectsProcessed++;
    return;
  }

  // 3. Process each session
  let sessionsQueued = 0;
  for (const session of sessions) {
    const messageCount = await getSessionMessageCount(session.sessionId);

    if (messageCount === 0) {
      console.log(`    Session ${session.sessionId}: no messages, skipping`);
      continue;
    }

    console.log(`    Session ${session.sessionId}: ${messageCount} messages`);

    const result = await processSession(userId, projectId, session.sessionId);

    if (result.success) {
      sessionsQueued++;
      stats.sessionsProcessed++;
    } else {
      console.error(`      Failed to queue: ${result.error}`);
      stats.errors.push({ projectId, sessionId: session.sessionId, error: result.error });
    }

    // Rate limit to avoid overwhelming Lambda
    if (!DRY_RUN && sessionsQueued > 0 && sessionsQueued % 10 === 0) {
      console.log(`    Pausing for rate limiting...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }

  // 4. Update migration status
  await updateProjectMigrationStatus(userId, projectId, {
    status: 'processing',
    sessionsQueued,
    queuedAt: Date.now()
  });

  stats.projectsProcessed++;
  console.log(`  Queued ${sessionsQueued} sessions for processing`);
}

/**
 * Print final statistics
 */
function printStats() {
  const duration = ((Date.now() - stats.startTime) / 1000).toFixed(1);

  console.log('\n' + '='.repeat(60));
  console.log('MIGRATION SUMMARY');
  console.log('='.repeat(60));
  console.log(`Duration: ${duration}s`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN (no changes made)' : 'LIVE'}`);
  console.log(`Projects scanned: ${stats.projectsScanned}`);
  console.log(`Projects processed: ${stats.projectsProcessed}`);
  console.log(`Vector indexes created: ${stats.indexesCreated}`);
  console.log(`Sessions queued: ${stats.sessionsProcessed}`);

  if (stats.errors.length > 0) {
    console.log(`\nErrors (${stats.errors.length}):`);
    for (const err of stats.errors.slice(0, 10)) {
      console.log(`  - ${err.projectId}${err.sessionId ? '/' + err.sessionId : ''}: ${err.error}`);
    }
    if (stats.errors.length > 10) {
      console.log(`  ... and ${stats.errors.length - 10} more`);
    }
  }

  console.log('='.repeat(60));
}

/**
 * Main entry point
 */
async function main() {
  console.log('='.repeat(60));
  console.log('S3 VECTORS MIGRATION SCRIPT');
  console.log('='.repeat(60));
  console.log(`Region: ${config.region}`);
  console.log(`Projects table: ${config.tables.projects}`);
  console.log(`Sessions table: ${config.tables.sessions}`);
  console.log(`Messages table: ${config.tables.messages}`);
  console.log(`Memory processor: ${config.memoryProcessorLambda}`);
  console.log(`Vectors bucket: ${config.vectorsBucket || '(not set)'}`);
  console.log(`Mode: ${DRY_RUN ? 'DRY RUN' : 'LIVE'}`);

  if (projectFilter) {
    console.log(`Filter: project=${projectFilter}`);
  } else if (userFilter) {
    console.log(`Filter: user=${userFilter}`);
  }

  console.log('='.repeat(60));

  if (!config.vectorsBucket) {
    console.error('\nERROR: VECTORS_BUCKET environment variable is required');
    process.exit(1);
  }

  try {
    // Get all projects
    console.log('\nFetching projects...');
    const projects = await getAllProjects();
    console.log(`Found ${projects.length} projects to process`);

    // Process each project
    for (const project of projects) {
      await processProject(project);
    }

    // Print summary
    printStats();

    // Exit with error code if there were failures
    if (stats.errors.length > 0) {
      process.exit(1);
    }

  } catch (err) {
    console.error('\nFATAL ERROR:', err);
    printStats();
    process.exit(1);
  }
}

// Run the migration
main();

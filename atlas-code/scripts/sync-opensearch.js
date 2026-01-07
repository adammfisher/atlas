/**
 * Sync Neo4j Knowledge Core data to OpenSearch for fast semantic search
 */

const neo4j = require('neo4j-driver');
const { Client } = require('@opensearch-project/opensearch');

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic('neo4j', process.env.NEO4J_PASSWORD || 'allyfinancial')
);

const opensearchClient = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const INDEX_NAME = 'knowledge-core';

async function createIndex() {
  try {
    const exists = await opensearchClient.indices.exists({ index: INDEX_NAME });
    if (exists.body) {
      console.log(`Index ${INDEX_NAME} already exists, deleting...`);
      await opensearchClient.indices.delete({ index: INDEX_NAME });
    }

    console.log(`Creating index ${INDEX_NAME}...`);
    await opensearchClient.indices.create({
      index: INDEX_NAME,
      body: {
        settings: {
          number_of_shards: 1,
          number_of_replicas: 0
        },
        mappings: {
          properties: {
            id: { type: 'keyword' },
            type: { type: 'keyword' }, // artifact, pattern, adr, service
            title: { type: 'text', analyzer: 'english' },
            content: { type: 'text', analyzer: 'english' },
            summary: { type: 'text', analyzer: 'english' },
            author: { type: 'keyword' },
            services: { type: 'keyword' },
            created_at: { type: 'date' },
            updated_at: { type: 'date' }
          }
        }
      }
    });
    console.log('Index created successfully');
  } catch (error) {
    console.error('Error creating index:', error.message);
  }
}

async function syncArtifacts() {
  const session = neo4jDriver.session();
  try {
    console.log('Syncing artifacts...');
    const result = await session.run(`
      MATCH (a:Artifact)
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      OPTIONAL MATCH (a)-[:ANALYZES]->(s:Service)
      RETURN a, author.name as authorName, collect(DISTINCT s.name) as services
    `);

    const bulk = [];
    for (const record of result.records) {
      const artifact = record.get('a').properties;
      bulk.push({ index: { _index: INDEX_NAME, _id: `artifact_${artifact.id}` } });
      bulk.push({
        id: artifact.id,
        type: 'artifact',
        title: artifact.title,
        content: artifact.content || '',
        summary: artifact.content_summary || '',
        author: record.get('authorName'),
        services: record.get('services'),
        created_at: artifact.created_at,
        updated_at: artifact.updated_at
      });
    }

    if (bulk.length > 0) {
      await opensearchClient.bulk({ body: bulk });
      console.log(`Indexed ${result.records.length} artifacts`);
    }
  } finally {
    await session.close();
  }
}

async function syncPatterns() {
  const session = neo4jDriver.session();
  try {
    console.log('Syncing patterns...');
    const result = await session.run(`
      MATCH (p:Pattern)
      RETURN p
    `);

    const bulk = [];
    for (const record of result.records) {
      const pattern = record.get('p').properties;
      bulk.push({ index: { _index: INDEX_NAME, _id: `pattern_${pattern.name}` } });
      bulk.push({
        id: pattern.name,
        type: 'pattern',
        title: pattern.name,
        content: pattern.description || '',
        summary: pattern.use_case || ''
      });
    }

    if (bulk.length > 0) {
      await opensearchClient.bulk({ body: bulk });
      console.log(`Indexed ${result.records.length} patterns`);
    }
  } finally {
    await session.close();
  }
}

async function syncADRs() {
  const session = neo4jDriver.session();
  try {
    console.log('Syncing ADRs...');
    const result = await session.run(`
      MATCH (a:ADR)
      RETURN a
    `);

    const bulk = [];
    for (const record of result.records) {
      const adr = record.get('a').properties;
      bulk.push({ index: { _index: INDEX_NAME, _id: `adr_${adr.id}` } });
      bulk.push({
        id: adr.id,
        type: 'adr',
        title: adr.title,
        content: (adr.context || '') + ' ' + (adr.decision || ''),
        summary: adr.context || ''
      });
    }

    if (bulk.length > 0) {
      await opensearchClient.bulk({ body: bulk });
      console.log(`Indexed ${result.records.length} ADRs`);
    }
  } finally {
    await session.close();
  }
}

async function syncServices() {
  const session = neo4jDriver.session();
  try {
    console.log('Syncing services...');
    const result = await session.run(`
      MATCH (s:Service)
      RETURN s
    `);

    const bulk = [];
    for (const record of result.records) {
      const service = record.get('s').properties;
      bulk.push({ index: { _index: INDEX_NAME, _id: `service_${service.name}` } });
      bulk.push({
        id: service.name,
        type: 'service',
        title: service.name,
        content: service.description || '',
        summary: service.description || ''
      });
    }

    if (bulk.length > 0) {
      await opensearchClient.bulk({ body: bulk });
      console.log(`Indexed ${result.records.length} services`);
    }
  } finally {
    await session.close();
  }
}

async function main() {
  console.log('Starting Knowledge Core sync to OpenSearch...\n');

  await createIndex();
  await syncArtifacts();
  await syncPatterns();
  await syncADRs();
  await syncServices();

  // Refresh index
  await opensearchClient.indices.refresh({ index: INDEX_NAME });

  // Get count
  const count = await opensearchClient.count({ index: INDEX_NAME });
  console.log(`\nSync complete! Total documents: ${count.body.count}`);

  await neo4jDriver.close();
  process.exit(0);
}

main().catch(console.error);

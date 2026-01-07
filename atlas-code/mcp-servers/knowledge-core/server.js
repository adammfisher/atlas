/**
 * Ally AI Platform - Knowledge Core MCP Server
 *
 * Provides enterprise context to Claude Code via MCP protocol.
 * Queries Neo4j for graph relationships, OpenSearch for semantic search.
 *
 * UPDATED: Now includes artifact queries for cross-platform knowledge sharing
 */

const express = require('express');
const neo4j = require('neo4j-driver');
const { Client } = require('@opensearch-project/opensearch');
const Redis = require('ioredis');

const app = express();

// Enable CORS for all origins (needed for browser-based testing)
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// ===========================================
// Database Connections
// ===========================================

const neo4jDriver = neo4j.driver(
  process.env.NEO4J_URI || 'bolt://localhost:7687',
  neo4j.auth.basic(
    process.env.NEO4J_USER || 'neo4j',
    process.env.NEO4J_PASSWORD || 'allyfinancial'
  )
);

const opensearchClient = new Client({
  node: process.env.OPENSEARCH_URL || 'http://localhost:9200'
});

const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');

// ===========================================
// MCP Tool Definitions
// ===========================================

const TOOLS = {
  // Existing tools
  get_service_info: {
    name: 'get_service_info',
    description: 'Get information about a service including owner, patterns, and compliance requirements',
    inputSchema: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'Name of the service to look up' }
      },
      required: ['service_name']
    }
  },
  get_team_standards: {
    name: 'get_team_standards',
    description: 'Get coding standards and patterns for a specific team',
    inputSchema: {
      type: 'object',
      properties: {
        team_name: { type: 'string', description: 'Name of the team' }
      },
      required: ['team_name']
    }
  },
  search_patterns: {
    name: 'search_patterns',
    description: 'Search for architecture patterns by keyword or description',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for patterns' }
      },
      required: ['query']
    }
  },
  get_dependencies: {
    name: 'get_dependencies',
    description: 'Get upstream and downstream dependencies for a service',
    inputSchema: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'Name of the service' }
      },
      required: ['service_name']
    }
  },
  search_adrs: {
    name: 'search_adrs',
    description: 'Search Architecture Decision Records',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for ADRs' }
      },
      required: ['query']
    }
  },
  get_compliance_requirements: {
    name: 'get_compliance_requirements',
    description: 'Get compliance requirements for a domain or service',
    inputSchema: {
      type: 'object',
      properties: {
        domain: { type: 'string', description: 'Domain name (e.g., lending, deposits, payments)' }
      },
      required: ['domain']
    }
  },

  // NEW: Artifact tools
  search_artifacts: {
    name: 'search_artifacts',
    description: 'Search for artifacts (analyses, decisions, patterns, solutions) shared by other team members. Use this to find existing documentation before starting new work.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query for artifacts (e.g., "loan service architecture", "payment compliance")' },
        type: { type: 'string', description: 'Optional: filter by type (analysis, decision, pattern, solution, finding)', enum: ['analysis', 'decision', 'pattern', 'solution', 'finding'] },
        service: { type: 'string', description: 'Optional: filter by related service name' }
      },
      required: ['query']
    }
  },
  get_artifact: {
    name: 'get_artifact',
    description: 'Get the full content of a specific artifact by ID',
    inputSchema: {
      type: 'object',
      properties: {
        artifact_id: { type: 'string', description: 'The artifact ID to retrieve' }
      },
      required: ['artifact_id']
    }
  },
  get_service_artifacts: {
    name: 'get_service_artifacts',
    description: 'Get all artifacts related to a specific service. Call this when exploring a service to see what documentation exists.',
    inputSchema: {
      type: 'object',
      properties: {
        service_name: { type: 'string', description: 'Name of the service' }
      },
      required: ['service_name']
    }
  },
  get_recent_artifacts: {
    name: 'get_recent_artifacts',
    description: 'Get recently shared artifacts to see what the team has been documenting',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', description: 'Number of artifacts to return (default 10, max 20)' }
      }
    }
  },
  check_knowledge_gaps: {
    name: 'check_knowledge_gaps',
    description: 'Check if there are known documentation gaps for given topics',
    inputSchema: {
      type: 'object',
      properties: {
        topics: {
          type: 'array',
          items: { type: 'string' },
          description: 'Topics to check for gaps (e.g., ["real-time payment", "saga pattern"])'
        }
      },
      required: ['topics']
    }
  },

  // FAST semantic search using OpenSearch
  semantic_search: {
    name: 'semantic_search',
    description: 'Fast semantic search across all knowledge (artifacts, patterns, ADRs, services). Use this for a single quick search before diving deeper.',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Natural language search query' },
        types: {
          type: 'array',
          items: { type: 'string', enum: ['artifact', 'pattern', 'adr', 'service'] },
          description: 'Optional: filter by type(s)'
        },
        limit: { type: 'number', description: 'Max results (default 10)' }
      },
      required: ['query']
    }
  },

  // Delete artifact tool
  delete_artifact: {
    name: 'delete_artifact',
    description: 'Delete an artifact from the Knowledge Core. Removes from both Neo4j and OpenSearch.',
    inputSchema: {
      type: 'object',
      properties: {
        artifact_id: { type: 'string', description: 'The artifact ID to delete' }
      },
      required: ['artifact_id']
    }
  }
};

// ===========================================
// Existing Tool Implementations
// ===========================================

async function getServiceInfo(serviceName) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (s:Service {name: $name})
      OPTIONAL MATCH (s)-[:OWNED_BY]->(t:Team)
      OPTIONAL MATCH (s)-[:USES_PATTERN]->(p:Pattern)
      OPTIONAL MATCH (s)-[:MUST_COMPLY]->(c:Compliance)
      OPTIONAL MATCH (s)-[:PART_OF]->(d:Domain)
      RETURN s, t, collect(DISTINCT p) as patterns, collect(DISTINCT c) as compliance, d
    `, { name: serviceName });

    if (result.records.length === 0) {
      return { error: `Service '${serviceName}' not found in Knowledge Core` };
    }

    const record = result.records[0];
    const service = record.get('s').properties;
    const team = record.get('t')?.properties;
    const patterns = record.get('patterns').map(p => p.properties);
    const compliance = record.get('compliance').map(c => c.properties);
    const domain = record.get('d')?.properties;

    return {
      service: {
        name: service.name,
        description: service.description,
        repository: service.repository,
        language: service.language
      },
      owner: team ? {
        name: team.name,
        slack: team.slack_channel,
        oncall: team.oncall_email
      } : null,
      domain: domain?.name,
      patterns: patterns.map(p => ({
        name: p.name,
        description: p.description
      })),
      compliance: compliance.map(c => ({
        name: c.name,
        requirements: c.requirements
      }))
    };
  } finally {
    await session.close();
  }
}

async function getTeamStandards(teamName) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (t:Team {name: $name})
      OPTIONAL MATCH (t)-[:FOLLOWS]->(s:Standard)
      OPTIONAL MATCH (t)-[:PREFERS]->(p:Pattern)
      RETURN t, collect(DISTINCT s) as standards, collect(DISTINCT p) as patterns
    `, { name: teamName });

    if (result.records.length === 0) {
      return { error: `Team '${teamName}' not found` };
    }

    const record = result.records[0];
    const team = record.get('t').properties;
    const standards = record.get('standards').map(s => s.properties);
    const patterns = record.get('patterns').map(p => p.properties);

    return {
      team: team.name,
      coding_standards: standards.map(s => ({
        name: s.name,
        description: s.description,
        documentation_url: s.url
      })),
      preferred_patterns: patterns.map(p => ({
        name: p.name,
        use_case: p.use_case
      }))
    };
  } finally {
    await session.close();
  }
}

async function searchPatterns(query) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (p:Pattern)
      WHERE toLower(p.name) CONTAINS toLower($query)
         OR toLower(p.description) CONTAINS toLower($query)
      RETURN p LIMIT 10
    `, { query });

    return {
      patterns: result.records.map(r => {
        const p = r.get('p').properties;
        return {
          name: p.name,
          description: p.description,
          use_case: p.use_case,
          example_url: p.example_url
        };
      })
    };
  } finally {
    await session.close();
  }
}

async function getDependencies(serviceName) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (s:Service {name: $name})
      OPTIONAL MATCH (s)-[:DEPENDS_ON]->(downstream:Service)
      OPTIONAL MATCH (upstream:Service)-[:DEPENDS_ON]->(s)
      RETURN s, collect(DISTINCT downstream) as downstream, collect(DISTINCT upstream) as upstream
    `, { name: serviceName });

    if (result.records.length === 0) {
      return { error: `Service '${serviceName}' not found` };
    }

    const record = result.records[0];
    return {
      service: serviceName,
      depends_on: record.get('downstream').map(d => d.properties.name),
      depended_by: record.get('upstream').map(u => u.properties.name)
    };
  } finally {
    await session.close();
  }
}

async function searchADRs(query) {
  const session = neo4jDriver.session();
  try {
    // Extract keywords for better matching
    const stopWords = new Set(['give', 'me', 'get', 'info', 'information', 'about', 'on', 'the', 'a', 'an', 'is', 'are', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this', 'for', 'from', 'with', 'to', 'of', 'in', 'and', 'or', 'adr', 'adrs', 'architecture', 'decision', 'record', 'records']);
    const keywords = query.toLowerCase().split(/\s+/).filter(word =>
      word.length > 2 && !stopWords.has(word)
    );
    const searchTerms = keywords.length > 0 ? keywords : [query.toLowerCase()];

    console.log(`[MCP] 🔍 Searching ADRs with keywords: ${searchTerms.join(', ')}`);

    // First, search for actual ADR nodes (if any exist)
    const adrResult = await session.run(`
      MATCH (a:ADR)
      WHERE toLower(a.title) CONTAINS toLower($query)
         OR toLower(a.context) CONTAINS toLower($query)
      RETURN a ORDER BY a.date DESC LIMIT 10
    `, { query });

    // Also search for Artifacts that look like ADRs:
    // - Type is 'decision' or 'adr'
    // - Title contains 'ADR' or 'Architecture Decision'
    // Build keyword conditions for flexible matching
    const keywordConditions = searchTerms.map((_, i) => `
      toLower(a.title) CONTAINS $kw${i}
      OR toLower(a.content) CONTAINS $kw${i}
      OR toLower(a.content_summary) CONTAINS $kw${i}
    `).join(' OR ');

    const params = { query };
    searchTerms.forEach((kw, i) => {
      params[`kw${i}`] = kw;
    });

    const artifactAdrResult = await session.run(`
      MATCH (a:Artifact)
      WHERE (a.state IS NULL OR a.state = 'published')
        AND (
          a.type IN ['decision', 'adr']
          OR toLower(a.title) CONTAINS 'adr'
          OR toLower(a.title) CONTAINS 'architecture decision'
        )
        AND (${keywordConditions})
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      RETURN a, author
      ORDER BY a.created_at DESC
      LIMIT 10
    `, params);

    // Combine results - ADR nodes first, then Artifact-based ADRs
    const adrs = [];

    // Add traditional ADR nodes
    for (const r of adrResult.records) {
      const a = r.get('a').properties;
      adrs.push({
        id: a.id,
        title: a.title,
        status: a.status,
        date: a.date,
        context: a.context,
        decision: a.decision,
        source: 'adr_node'
      });
    }

    // Add Artifact-based ADRs
    for (const r of artifactAdrResult.records) {
      const a = r.get('a').properties;
      const author = r.get('author')?.properties;
      adrs.push({
        id: a.id,
        title: a.title,
        status: a.state,
        date: a.created_at,
        context: a.content_summary || a.content?.substring(0, 500),
        decision: a.content,
        author: author?.name,
        source: 'artifact'
      });
    }

    console.log(`[MCP] 🔍 ADR search found ${adrs.length} results (${adrResult.records.length} ADR nodes, ${artifactAdrResult.records.length} artifacts)`);

    return { adrs };
  } finally {
    await session.close();
  }
}

async function getComplianceRequirements(domain) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (d:Domain {name: $name})-[:SUBJECT_TO]->(c:Compliance)
      RETURN c
    `, { name: domain });

    return {
      domain: domain,
      requirements: result.records.map(r => {
        const c = r.get('c').properties;
        return {
          name: c.name,
          description: c.description,
          requirements: c.requirements,
          documentation_url: c.url
        };
      })
    };
  } finally {
    await session.close();
  }
}

// ===========================================
// NEW: Artifact Tool Implementations
// ===========================================

async function searchArtifacts(query, type = null, service = null) {
  const session = neo4jDriver.session();
  try {
    // Extract meaningful keywords from the query (filter out stop words)
    const stopWords = new Set(['give', 'me', 'get', 'info', 'information', 'about', 'on', 'the', 'a', 'an', 'is', 'are', 'was', 'were', 'what', 'how', 'why', 'when', 'where', 'who', 'which', 'that', 'this', 'for', 'from', 'with', 'to', 'of', 'in', 'and', 'or', 'but', 'not', 'can', 'could', 'would', 'should', 'will', 'do', 'does', 'did', 'have', 'has', 'had', 'be', 'been', 'being', 'i', 'you', 'we', 'they', 'it', 'my', 'your', 'our', 'their', 'its', 'find', 'show', 'tell', 'help', 'need', 'want', 'know', 'look', 'search']);
    const keywords = query.toLowerCase().split(/\s+/).filter(word =>
      word.length > 2 && !stopWords.has(word)
    );

    // If no keywords after filtering, use original query
    const searchTerms = keywords.length > 0 ? keywords : [query.toLowerCase()];

    console.log(`[MCP] 🔍 Searching artifacts with keywords: ${searchTerms.join(', ')}`);

    // Build dynamic WHERE clause that matches ANY keyword
    const keywordConditions = searchTerms.map((_, i) => `
      toLower(a.title) CONTAINS $kw${i}
      OR toLower(a.content) CONTAINS $kw${i}
      OR toLower(a.content_summary) CONTAINS $kw${i}
    `).join(' OR ');

    let cypherQuery = `
      MATCH (a:Artifact)
      WHERE a.state = 'published'
        AND (${keywordConditions})
    `;

    const params = { query };
    // Add each keyword as a parameter
    searchTerms.forEach((kw, i) => {
      params[`kw${i}`] = kw;
    });

    if (type) {
      cypherQuery += ` AND a.type = $type`;
      params.type = type;
    }

    if (service) {
      cypherQuery += ` AND EXISTS { MATCH (a)-[:ANALYZES]->(:Service {name: $service}) }`;
      params.service = service;
    }

    cypherQuery += `
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      OPTIONAL MATCH (a)-[:ANALYZES]->(s:Service)
      RETURN a, author, collect(DISTINCT s.name) as services
      ORDER BY a.updated_at DESC
      LIMIT 10
    `;

    const result = await session.run(cypherQuery, params);

    console.log(`[MCP] 🔍 Artifact search for "${query}" found ${result.records.length} results`);

    return {
      artifacts: result.records.map(r => {
        const artifact = r.get('a').properties;
        const author = r.get('author')?.properties;
        const services = r.get('services');

        return {
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          summary: artifact.content_summary,
          author: author ? { name: author.name, team: author.team } : null,
          services,
          created_at: artifact.created_at,
          view_count: artifact.view_count?.toNumber?.() || artifact.view_count,
          state: artifact.state
        };
      }),
      query,
      count: result.records.length
    };
  } finally {
    await session.close();
  }
}

async function getArtifact(artifactId) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (a:Artifact {id: $id})
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      OPTIONAL MATCH (a)-[:ANALYZES]->(services:Service)
      OPTIONAL MATCH (a)-[:USES_PATTERN]->(patterns:Pattern)
      OPTIONAL MATCH (a)-[:SUBJECT_TO]->(compliance:Compliance)
      OPTIONAL MATCH (a)-[:SUPERSEDES]->(superseded:Artifact)
      OPTIONAL MATCH (newer:Artifact)-[:SUPERSEDES]->(a)
      RETURN a, author,
             collect(DISTINCT services.name) as services,
             collect(DISTINCT patterns.name) as patterns,
             collect(DISTINCT compliance.name) as compliance,
             superseded.title as supersedes,
             newer.title as superseded_by
    `, { id: artifactId });

    if (result.records.length === 0) {
      return { error: `Artifact '${artifactId}' not found` };
    }

    // Increment view count
    await session.run(`
      MATCH (a:Artifact {id: $id})
      SET a.view_count = coalesce(a.view_count, 0) + 1
    `, { id: artifactId });

    const record = result.records[0];
    const artifact = record.get('a').properties;
    const author = record.get('author')?.properties;

    console.log(`[MCP] 📄 Retrieved artifact: ${artifact.title}`);

    return {
      id: artifact.id,
      title: artifact.title,
      type: artifact.type,
      content: artifact.content,
      summary: artifact.content_summary,
      state: artifact.state,
      author: author ? { name: author.name, team: author.team, email: author.email } : null,
      services: record.get('services'),
      patterns: record.get('patterns'),
      compliance: record.get('compliance'),
      supersedes: record.get('supersedes'),
      superseded_by: record.get('superseded_by'),
      created_at: artifact.created_at,
      updated_at: artifact.updated_at,
      expires_at: artifact.expires_at,
      view_count: artifact.view_count?.toNumber?.() || artifact.view_count,
      citation_count: artifact.citation_count?.toNumber?.() || artifact.citation_count
    };
  } finally {
    await session.close();
  }
}

async function getServiceArtifacts(serviceName) {
  const session = neo4jDriver.session();
  try {
    const result = await session.run(`
      MATCH (s:Service {name: $name})
      OPTIONAL MATCH (a:Artifact {state: 'published'})-[:ANALYZES]->(s)
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      RETURN s, a, author
      ORDER BY a.updated_at DESC
    `, { name: serviceName });

    if (result.records.length === 0 || !result.records[0].get('s')) {
      return { error: `Service '${serviceName}' not found` };
    }

    const artifacts = result.records
      .filter(r => r.get('a'))
      .map(r => {
        const artifact = r.get('a').properties;
        const author = r.get('author')?.properties;
        return {
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          summary: artifact.content_summary,
          author: author?.name,
          created_at: artifact.created_at,
          updated_at: artifact.updated_at
        };
      });

    console.log(`[MCP] 📚 Found ${artifacts.length} artifacts for service: ${serviceName}`);

    return {
      service: serviceName,
      artifact_count: artifacts.length,
      artifacts,
      message: artifacts.length === 0
        ? `No artifacts found for ${serviceName}. Consider documenting your findings.`
        : `Found ${artifacts.length} artifacts related to ${serviceName}.`
    };
  } finally {
    await session.close();
  }
}

async function getRecentArtifacts(limit = 10) {
  const session = neo4jDriver.session();
  const actualLimit = Math.min(Math.max(1, limit), 20);

  try {
    const result = await session.run(`
      MATCH (a:Artifact {state: 'published'})
      OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
      OPTIONAL MATCH (a)-[:ANALYZES]->(s:Service)
      RETURN a, author, collect(DISTINCT s.name) as services
      ORDER BY a.created_at DESC
      LIMIT $limit
    `, { limit: neo4j.int(actualLimit) });

    return {
      artifacts: result.records.map(r => {
        const artifact = r.get('a').properties;
        const author = r.get('author')?.properties;
        return {
          id: artifact.id,
          title: artifact.title,
          type: artifact.type,
          summary: artifact.content_summary,
          author: author?.name,
          services: r.get('services'),
          created_at: artifact.created_at
        };
      }),
      count: result.records.length
    };
  } finally {
    await session.close();
  }
}

// ===========================================
// FAST Semantic Search using OpenSearch
// ===========================================

const OPENSEARCH_INDEX = 'knowledge-core';

async function semanticSearch(query, types = null, limit = 10) {
  try {
    const startTime = Date.now();

    // Build OpenSearch query
    const searchBody = {
      size: Math.min(limit, 20),
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: query,
                fields: ['title^3', 'content', 'summary^2'],
                type: 'best_fields',
                fuzziness: 'AUTO'
              }
            }
          ]
        }
      },
      highlight: {
        fields: {
          title: {},
          content: { fragment_size: 150 },
          summary: {}
        }
      }
    };

    // Add type filter if specified
    if (types && types.length > 0) {
      searchBody.query.bool.filter = [
        { terms: { type: types } }
      ];
    }

    const result = await opensearchClient.search({
      index: OPENSEARCH_INDEX,
      body: searchBody
    });

    const elapsed = Date.now() - startTime;
    const hits = result.body.hits.hits;

    console.log(`[MCP] ⚡ Semantic search for "${query}" found ${hits.length} results in ${elapsed}ms`);

    // Filter out low-relevance results - minimum score threshold
    // This prevents irrelevant context from tainting conversations
    const MIN_RELEVANCE_SCORE = 3.0;
    const relevantHits = hits.filter(hit => hit._score >= MIN_RELEVANCE_SCORE);

    console.log(`[MCP] Filtered to ${relevantHits.length} results above score threshold ${MIN_RELEVANCE_SCORE}`);

    // If no relevant results, return empty - don't taint the conversation
    if (relevantHits.length === 0) {
      return {
        query,
        results: [],
        total: 0,
        took_ms: elapsed,
        message: 'No relevant knowledge found for this query.'
      };
    }

    // If we found relevant results, fetch full content from Neo4j for top results
    const enrichedResults = [];
    const neo4jSession = neo4jDriver.session();

    try {
      for (const hit of relevantHits.slice(0, 5)) { // Only enrich top 5
        const doc = hit._source;
        const score = hit._score;

        if (doc.type === 'artifact') {
          // Fetch full artifact from Neo4j
          const artifactResult = await neo4jSession.run(`
            MATCH (a:Artifact {id: $id})
            OPTIONAL MATCH (a)-[:CREATED_BY]->(author:Person)
            RETURN a, author.name as authorName
          `, { id: doc.id });

          if (artifactResult.records.length > 0) {
            const artifact = artifactResult.records[0].get('a').properties;
            enrichedResults.push({
              type: 'artifact',
              id: doc.id,
              title: doc.title,
              summary: doc.summary,
              content: artifact.content,
              author: { name: artifactResult.records[0].get('authorName') },
              score,
              highlight: hit.highlight
            });
          }
        } else {
          // Return basic info for patterns, ADRs, services
          enrichedResults.push({
            type: doc.type,
            id: doc.id,
            title: doc.title,
            summary: doc.summary || doc.content?.substring(0, 200),
            score,
            highlight: hit.highlight
          });
        }
      }
    } finally {
      await neo4jSession.close();
    }

    return {
      query,
      results: enrichedResults,
      total: result.body.hits.total.value,
      took_ms: elapsed,
      message: enrichedResults.length === 0
        ? 'No relevant knowledge found for this query.'
        : `Found ${enrichedResults.length} relevant items.`
    };

  } catch (error) {
    console.error('[MCP] Semantic search error:', error.message);
    // Fallback to empty results - don't block
    return {
      query,
      results: [],
      total: 0,
      took_ms: 0,
      error: error.message,
      message: 'Search unavailable, proceeding without knowledge context.'
    };
  }
}

async function checkKnowledgeGaps(topics) {
  const session = neo4jDriver.session();
  try {
    const gaps = [];

    for (const topic of topics) {
      // Check for existing artifacts covering this topic
      const artifactResult = await session.run(`
        MATCH (a:Artifact {state: 'published'})
        WHERE toLower(a.title) CONTAINS toLower($topic)
           OR toLower(a.content_summary) CONTAINS toLower($topic)
        RETURN count(a) as count, max(a.updated_at) as latest
      `, { topic });

      const count = artifactResult.records[0].get('count').toNumber();
      const latest = artifactResult.records[0].get('latest');

      // Check if there's a tracked gap
      const gapResult = await session.run(`
        MATCH (g:KnowledgeGap)
        WHERE toLower(g.topic) CONTAINS toLower($topic)
        RETURN g
      `, { topic });

      const trackedGap = gapResult.records[0]?.get('g')?.properties;

      if (count === 0) {
        gaps.push({
          topic,
          status: 'no_coverage',
          message: `No documentation found for "${topic}"`,
          tracked: !!trackedGap,
          query_count: trackedGap?.query_count?.toNumber?.() || 0
        });

        // Track this query
        await session.run(`
          MERGE (g:KnowledgeGap {topic: $topic})
          ON CREATE SET g.detected_at = datetime(), g.query_count = 1
          ON MATCH SET g.query_count = g.query_count + 1
        `, { topic });
      } else if (latest) {
        const ageInDays = (Date.now() - new Date(latest).getTime()) / (1000 * 60 * 60 * 24);
        if (ageInDays > 180) {
          gaps.push({
            topic,
            status: 'stale',
            message: `Documentation for "${topic}" is ${Math.round(ageInDays)} days old`,
            artifact_count: count,
            last_updated: latest
          });
        }
      }
    }

    console.log(`[MCP] 🕳️ Gap check for ${topics.length} topics: ${gaps.length} gaps found`);

    return {
      topics,
      gaps,
      gap_count: gaps.length,
      message: gaps.length === 0
        ? 'All topics have current documentation.'
        : `Found ${gaps.length} documentation gaps.`
    };
  } finally {
    await session.close();
  }
}

// ===========================================
// Delete Artifact Implementation
// ===========================================

async function deleteArtifact(artifactId) {
  const session = neo4jDriver.session();

  try {
    // First check if artifact exists
    const checkResult = await session.run(`
      MATCH (a:Artifact {id: $id})
      RETURN a.title as title
    `, { id: artifactId });

    if (checkResult.records.length === 0) {
      return { error: `Artifact '${artifactId}' not found`, success: false };
    }

    const title = checkResult.records[0].get('title');

    // Delete from Neo4j (DETACH DELETE removes all relationships)
    await session.run(`
      MATCH (a:Artifact {id: $id})
      DETACH DELETE a
    `, { id: artifactId });

    console.log(`[MCP] 🗑️ Deleted artifact from Neo4j: ${artifactId} - ${title}`);

    // Delete from OpenSearch
    try {
      await opensearchClient.delete({
        index: OPENSEARCH_INDEX,
        id: `artifact_${artifactId}`
      });
      console.log(`[MCP] 🗑️ Deleted artifact from OpenSearch: artifact_${artifactId}`);
    } catch (osError) {
      // OpenSearch document might not exist - that's okay
      if (osError.meta?.body?.result !== 'not_found') {
        console.warn(`[MCP] ⚠️ OpenSearch delete warning:`, osError.message);
      }
    }

    return {
      success: true,
      artifact_id: artifactId,
      title: title,
      message: `Artifact '${title}' deleted successfully from Knowledge Core`
    };
  } catch (error) {
    console.error(`[MCP] ❌ Delete artifact failed:`, error);
    return { error: error.message, success: false };
  } finally {
    await session.close();
  }
}

// ===========================================
// Artifact Ingestion Endpoint (for Atlas Research sync)
// ===========================================

app.post('/artifacts/ingest', async (req, res) => {
  const session = neo4jDriver.session();
  const {
    id,
    title,
    type,
    content,
    content_summary,
    author,
    entities,
    relationship,
    gap_filled,
    ttl
  } = req.body;

  console.log(`[MCP] 📥 Ingesting artifact: ${title}`);

  // Auto-detect entities from content if not provided
  const textToScan = `${title} ${content}`.toLowerCase();
  const detectedEntities = entities ? [...entities] : [];

  // Known services (from Knowledge Core)
  const knownServices = ['loan-service', 'credit-service', 'customer-service', 'notification-service', 'document-service', 'api-gateway'];
  for (const svc of knownServices) {
    if (textToScan.includes(svc) || textToScan.includes(svc.replace('-service', ''))) {
      if (!detectedEntities.find(e => e.type === 'service' && e.name === svc)) {
        detectedEntities.push({ type: 'service', name: svc });
      }
    }
  }

  // Known patterns
  const knownPatterns = [
    { pattern: 'event sourcing', name: 'Event Sourcing' },
    { pattern: 'cqrs', name: 'CQRS' },
    { pattern: 'saga', name: 'Saga Orchestration' },
    { pattern: 'circuit breaker', name: 'Circuit Breaker' },
    { pattern: 'retry pattern', name: 'Retry' }
  ];
  for (const { pattern, name } of knownPatterns) {
    if (textToScan.includes(pattern)) {
      if (!detectedEntities.find(e => e.type === 'pattern' && e.name === name)) {
        detectedEntities.push({ type: 'pattern', name });
      }
    }
  }

  // Known compliance requirements
  const knownCompliance = [
    { keywords: ['pii', 'personal', 'ssn', 'social security', 'customer data'], name: 'GLBA' },
    { keywords: ['pci', 'payment', 'card', 'cardholder'], name: 'PCI-DSS' },
    { keywords: ['soc2', 'soc 2', 'audit', 'security controls'], name: 'SOC2' },
    { keywords: ['ffiec', 'financial institution'], name: 'FFIEC' }
  ];
  for (const { keywords, name } of knownCompliance) {
    if (keywords.some(kw => textToScan.includes(kw))) {
      if (!detectedEntities.find(e => e.type === 'compliance' && e.name === name)) {
        detectedEntities.push({ type: 'compliance', name });
      }
    }
  }

  if (detectedEntities.length > 0) {
    console.log(`[MCP] 🔗 Auto-detected entities:`, detectedEntities.map(e => `${e.type}:${e.name}`).join(', '));
  }

  try {
    // Create the artifact
    await session.run(`
      CREATE (a:Artifact {
        id: $id,
        title: $title,
        type: $type,
        content: $content,
        content_summary: $content_summary,
        state: 'published',
        created_at: datetime(),
        updated_at: datetime(),
        expires_at: datetime() + duration($ttl),
        view_count: 0,
        citation_count: 0
      })
    `, {
      id,
      title,
      type: type || 'analysis',
      content,
      content_summary: content_summary || content.substring(0, 500),
      ttl: ttl || 'P180D'
    });

    // Link to author
    if (author) {
      await session.run(`
        MERGE (p:Person {id: $authorId})
        ON CREATE SET p.name = $name, p.email = $email, p.team = $team
        WITH p
        MATCH (a:Artifact {id: $artifactId})
        CREATE (a)-[:CREATED_BY]->(p)
      `, {
        authorId: author.id,
        name: author.name,
        email: author.email,
        team: author.team,
        artifactId: id
      });
    }

    // Link to entities (including auto-detected)
    if (detectedEntities.length > 0) {
      for (const entity of detectedEntities) {
        if (entity.type === 'service') {
          await session.run(`
            MATCH (a:Artifact {id: $artifactId})
            MATCH (s:Service {name: $name})
            CREATE (a)-[:ANALYZES]->(s)
          `, { artifactId: id, name: entity.name });
        } else if (entity.type === 'pattern') {
          await session.run(`
            MATCH (a:Artifact {id: $artifactId})
            MATCH (p:Pattern {name: $name})
            CREATE (a)-[:USES_PATTERN]->(p)
          `, { artifactId: id, name: entity.name });
        } else if (entity.type === 'compliance') {
          await session.run(`
            MATCH (a:Artifact {id: $artifactId})
            MATCH (c:Compliance {name: $name})
            CREATE (a)-[:SUBJECT_TO]->(c)
          `, { artifactId: id, name: entity.name });
        }
      }
    }

    // Handle relationships
    if (relationship) {
      if (relationship.type === 'supersedes') {
        await session.run(`
          MATCH (new:Artifact {id: $newId})
          MATCH (old:Artifact {id: $oldId})
          CREATE (new)-[:SUPERSEDES]->(old)
          SET old.state = 'superseded'
        `, { newId: id, oldId: relationship.targetId });
      } else if (relationship.type === 'extends') {
        await session.run(`
          MATCH (new:Artifact {id: $newId})
          MATCH (old:Artifact {id: $oldId})
          CREATE (new)-[:EXTENDS]->(old)
        `, { newId: id, oldId: relationship.targetId });
      } else if (relationship.type === 'links') {
        await session.run(`
          MATCH (new:Artifact {id: $newId})
          MATCH (old:Artifact {id: $oldId})
          CREATE (new)-[:LINKED_TO]->(old)
        `, { newId: id, oldId: relationship.targetId });
      }
    }

    // Mark gap as filled
    if (gap_filled) {
      await session.run(`
        MATCH (g:KnowledgeGap {topic: $topic})
        SET g.filled_by = $artifactId, g.filled_at = datetime()
      `, { topic: gap_filled, artifactId: id });
    }

    console.log(`[MCP] ✅ Artifact ingested successfully: ${id}`);
    res.json({ success: true, id });

  } catch (error) {
    console.error(`[MCP] ❌ Artifact ingestion failed:`, error);
    res.status(500).json({ error: error.message });
  } finally {
    await session.close();
  }
});

// Delete artifact REST endpoint
app.delete('/artifacts/:id', async (req, res) => {
  const { id } = req.params;
  console.log(`[MCP] 🗑️ REST delete request for artifact: ${id}`);

  try {
    const result = await deleteArtifact(id);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json(result);
    }
  } catch (error) {
    console.error(`[MCP] ❌ REST delete failed:`, error);
    res.status(500).json({ error: error.message, success: false });
  }
});

// ===========================================
// MCP Protocol Endpoints
// ===========================================

// List available tools
app.get('/mcp/tools', (req, res) => {
  console.log('[MCP] Tools list requested');
  res.json({ tools: Object.values(TOOLS) });
});

// Execute tool
app.post('/mcp/execute', async (req, res) => {
  const { tool, arguments: args } = req.body;
  console.log(`[MCP] Executing tool: ${tool}`, args);

  try {
    let result;
    switch (tool) {
      // Existing tools
      case 'get_service_info':
        result = await getServiceInfo(args.service_name);
        break;
      case 'get_team_standards':
        result = await getTeamStandards(args.team_name);
        break;
      case 'search_patterns':
        result = await searchPatterns(args.query);
        break;
      case 'get_dependencies':
        result = await getDependencies(args.service_name);
        break;
      case 'search_adrs':
        result = await searchADRs(args.query);
        break;
      case 'get_compliance_requirements':
        result = await getComplianceRequirements(args.domain);
        break;

      // New artifact tools
      case 'search_artifacts':
        result = await searchArtifacts(args.query, args.type, args.service);
        break;
      case 'get_artifact':
        result = await getArtifact(args.artifact_id);
        break;
      case 'get_service_artifacts':
        result = await getServiceArtifacts(args.service_name);
        break;
      case 'get_recent_artifacts':
        result = await getRecentArtifacts(args.limit || 10);
        break;
      case 'check_knowledge_gaps':
        result = await checkKnowledgeGaps(args.topics);
        break;

      // FAST semantic search via OpenSearch
      case 'semantic_search':
        result = await semanticSearch(args.query, args.types, args.limit);
        break;

      case 'delete_artifact':
        result = await deleteArtifact(args.artifact_id);
        break;

      default:
        result = { error: `Unknown tool: ${tool}` };
    }

    console.log(`[MCP] Tool result:`, JSON.stringify(result, null, 2).substring(0, 500));
    res.json({ result });
  } catch (error) {
    console.error(`[MCP] Error executing ${tool}:`, error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'knowledge-core-mcp', version: '2.0' });
});

// ===========================================
// Start Server
// ===========================================

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║  ALLY KNOWLEDGE CORE MCP SERVER v2.0                      ║
║  ─────────────────────────────────────────────────────    ║
║  Port: ${PORT}                                              ║
║  Neo4j: ${process.env.NEO4J_URI || 'bolt://localhost:7687'}                     ║
║                                                           ║
║  NEW: Artifact support enabled                            ║
║  - search_artifacts                                       ║
║  - get_artifact                                           ║
║  - get_service_artifacts                                  ║
║  - get_recent_artifacts                                   ║
║  - check_knowledge_gaps                                   ║
║  - POST /artifacts/ingest (for Atlas Research sync)       ║
╚═══════════════════════════════════════════════════════════╝
  `);
});

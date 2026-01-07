const { getItem, putItem, updateItem, deleteItem, queryItems } = require('./shared/dynamodb');
const {
  success,
  created,
  noContent,
  badRequest,
  notFound,
  serverError,
  getUserId,
  parseBody,
  getPathParam
} = require('./shared/response');

const MCP_CONFIGS_TABLE = process.env.MCP_CONFIGS_TABLE;

// Default available connectors (can be extended via MCP configs)
const DEFAULT_CONNECTORS = [
  { id: 'confluence', name: 'Confluence', icon: '📄', description: 'Search Confluence documentation' },
  { id: 'jira', name: 'Jira', icon: '🎫', description: 'Access Jira tickets and projects' },
  { id: 'gitlab', name: 'GitLab', icon: '🦊', description: 'Access GitLab repositories' },
  { id: 'slack', name: 'Slack', icon: '💬', description: 'Search Slack messages' },
  { id: 'notion', name: 'Notion', icon: '📝', description: 'Access Notion pages' }
];

/**
 * Main handler
 */
exports.handler = async (event) => {
  console.log('MCP Config event:', JSON.stringify(event));

  const method = event.requestContext?.http?.method || event.httpMethod;
  const path = event.requestContext?.http?.path || event.path;
  const serverId = getPathParam(event, 'serverId');

  try {
    // Handle available connectors endpoint
    if (path.includes('/connectors/available')) {
      return getAvailableConnectors(event);
    }

    // Handle tools endpoint - fetch tools from all enabled MCP servers
    if (path.includes('/mcp/tools')) {
      return getAllMcpTools(event);
    }

    // Handle tool execution - proxy to appropriate MCP server
    if (path.includes('/mcp/execute') && method === 'POST') {
      return executeMcpTool(event);
    }

    // Route MCP server management
    if (method === 'GET' && !serverId) {
      return listMcpServers(event);
    } else if (method === 'POST') {
      return createMcpServer(event);
    } else if (method === 'PUT' && serverId) {
      return updateMcpServer(event, serverId);
    } else if (method === 'DELETE' && serverId) {
      return deleteMcpServer(event, serverId);
    }

    return badRequest('Invalid route');
  } catch (error) {
    console.error('MCP Config error:', error);
    return serverError(error.message);
  }
};

/**
 * Get available connectors (default + user configured)
 */
async function getAvailableConnectors(event) {
  const userId = getUserId(event);
  
  // Get user's configured servers
  const userServers = await queryItems(MCP_CONFIGS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  });
  
  // Merge with defaults
  const connectors = [...DEFAULT_CONNECTORS];
  
  for (const server of userServers) {
    const existingIndex = connectors.findIndex(c => c.id === server.serverId);
    if (existingIndex >= 0) {
      // Mark as configured
      connectors[existingIndex] = {
        ...connectors[existingIndex],
        configured: true,
        enabled: server.enabled,
        url: server.url
      };
    } else {
      // Add custom server
      connectors.push({
        id: server.serverId,
        name: server.name,
        icon: server.icon || '🔌',
        description: server.description || 'Custom MCP server',
        configured: true,
        enabled: server.enabled,
        url: server.url,
        custom: true
      });
    }
  }
  
  return success({ connectors });
}

/**
 * List user's MCP server configurations
 */
async function listMcpServers(event) {
  const userId = getUserId(event);
  
  const servers = await queryItems(MCP_CONFIGS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  });
  
  return success({
    servers: servers.map(s => ({
      id: s.serverId,
      name: s.name,
      icon: s.icon,
      description: s.description,
      url: s.url,
      type: s.type,
      enabled: s.enabled,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt
    }))
  });
}

/**
 * Create a new MCP server configuration
 */
async function createMcpServer(event) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  const { name, url, icon, description, type = 'url' } = body;
  
  if (!name || !url) {
    return badRequest('name and url are required');
  }
  
  // Validate URL
  try {
    new URL(url);
  } catch (e) {
    return badRequest('Invalid URL format');
  }
  
  const serverId = `mcp_${Date.now()}`;
  const now = Date.now();
  
  const server = {
    userId,
    serverId,
    name,
    url,
    icon: icon || '🔌',
    description: description || '',
    type,
    enabled: true,
    createdAt: now,
    updatedAt: now
  };
  
  await putItem(MCP_CONFIGS_TABLE, server);
  
  return created({
    id: server.serverId,
    name: server.name,
    icon: server.icon,
    description: server.description,
    url: server.url,
    type: server.type,
    enabled: server.enabled,
    createdAt: server.createdAt
  });
}

/**
 * Update an MCP server configuration
 */
async function updateMcpServer(event, serverId) {
  const userId = getUserId(event);
  const body = parseBody(event);
  
  // Verify server exists
  const server = await getItem(MCP_CONFIGS_TABLE, { userId, serverId });
  if (!server) {
    return notFound('MCP server not found');
  }
  
  // Build updates
  const updates = { updatedAt: Date.now() };
  
  if (body.name !== undefined) {
    updates.name = body.name;
  }
  if (body.url !== undefined) {
    // Validate URL
    try {
      new URL(body.url);
      updates.url = body.url;
    } catch (e) {
      return badRequest('Invalid URL format');
    }
  }
  if (body.icon !== undefined) {
    updates.icon = body.icon;
  }
  if (body.description !== undefined) {
    updates.description = body.description;
  }
  if (body.enabled !== undefined) {
    updates.enabled = body.enabled;
  }
  
  const updated = await updateItem(MCP_CONFIGS_TABLE, { userId, serverId }, updates);
  
  return success({
    id: updated.serverId,
    name: updated.name,
    icon: updated.icon,
    description: updated.description,
    url: updated.url,
    type: updated.type,
    enabled: updated.enabled,
    createdAt: updated.createdAt,
    updatedAt: updated.updatedAt
  });
}

/**
 * Delete an MCP server configuration
 */
async function deleteMcpServer(event, serverId) {
  const userId = getUserId(event);

  // Verify server exists
  const server = await getItem(MCP_CONFIGS_TABLE, { userId, serverId });
  if (!server) {
    return notFound('MCP server not found');
  }

  await deleteItem(MCP_CONFIGS_TABLE, { userId, serverId });

  return noContent();
}

/**
 * Fetch tools from all enabled MCP servers
 */
async function getAllMcpTools(event) {
  const userId = getUserId(event);

  // Get user's enabled servers
  const userServers = await queryItems(MCP_CONFIGS_TABLE, {
    expression: 'userId = :userId',
    values: { ':userId': userId }
  });

  const enabledServers = userServers.filter(s => s.enabled);
  const allTools = [];
  const serverStatus = [];

  // Fetch tools from each enabled server
  for (const server of enabledServers) {
    try {
      const toolsUrl = `${server.url}/mcp/tools`;
      console.log(`Fetching tools from ${server.name}: ${toolsUrl}`);

      const response = await fetch(toolsUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const tools = data.tools || [];

      // Add server info to each tool
      for (const tool of tools) {
        allTools.push({
          ...tool,
          _server: {
            id: server.serverId,
            name: server.name,
            url: server.url
          }
        });
      }

      serverStatus.push({
        id: server.serverId,
        name: server.name,
        status: 'connected',
        toolCount: tools.length
      });

      console.log(`Fetched ${tools.length} tools from ${server.name}`);
    } catch (error) {
      console.error(`Failed to fetch tools from ${server.name}:`, error.message);
      serverStatus.push({
        id: server.serverId,
        name: server.name,
        status: 'error',
        error: error.message
      });
    }
  }

  return success({
    tools: allTools,
    servers: serverStatus,
    totalTools: allTools.length
  });
}

/**
 * Execute a tool on the appropriate MCP server
 */
async function executeMcpTool(event) {
  const userId = getUserId(event);
  const body = parseBody(event);

  const { tool, arguments: args, server_id } = body;

  if (!tool) {
    return badRequest('tool name is required');
  }

  // Get the server to execute on
  let serverUrl = null;

  if (server_id) {
    // Specific server requested
    const server = await getItem(MCP_CONFIGS_TABLE, { userId, serverId: server_id });
    if (!server) {
      return notFound('MCP server not found');
    }
    if (!server.enabled) {
      return badRequest('MCP server is disabled');
    }
    serverUrl = server.url;
  } else {
    // Find server that has this tool
    const userServers = await queryItems(MCP_CONFIGS_TABLE, {
      expression: 'userId = :userId',
      values: { ':userId': userId }
    });

    const enabledServers = userServers.filter(s => s.enabled);

    for (const server of enabledServers) {
      try {
        const toolsResponse = await fetch(`${server.url}/mcp/tools`, {
          signal: AbortSignal.timeout(3000)
        });
        const toolsData = await toolsResponse.json();
        const hasTools = (toolsData.tools || []).some(t => t.name === tool);
        if (hasTools) {
          serverUrl = server.url;
          break;
        }
      } catch (e) {
        continue;
      }
    }
  }

  if (!serverUrl) {
    return notFound(`No MCP server found with tool: ${tool}`);
  }

  // Execute the tool
  try {
    console.log(`Executing tool ${tool} on ${serverUrl}`);

    const response = await fetch(`${serverUrl}/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tool, arguments: args }),
      signal: AbortSignal.timeout(30000) // 30 second timeout for execution
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();
    return success(result);
  } catch (error) {
    console.error(`Tool execution failed:`, error.message);
    return serverError(`Tool execution failed: ${error.message}`);
  }
}

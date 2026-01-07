/**
 * Standard JSON response
 */
function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    },
    body: JSON.stringify(body)
  };
}

/**
 * Success response
 */
function success(body) {
  return jsonResponse(200, body);
}

/**
 * Created response
 */
function created(body) {
  return jsonResponse(201, body);
}

/**
 * No content response
 */
function noContent() {
  return {
    statusCode: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
    }
  };
}

/**
 * Bad request response
 */
function badRequest(message) {
  return jsonResponse(400, { error: message });
}

/**
 * Not found response
 */
function notFound(message = 'Not found') {
  return jsonResponse(404, { error: message });
}

/**
 * Server error response
 */
function serverError(message = 'Internal server error') {
  return jsonResponse(500, { error: message });
}

/**
 * SSE streaming response headers
 */
function sseHeaders() {
  return {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-User-Id'
  };
}

/**
 * Format SSE event
 */
function sseEvent(data) {
  return `data: ${JSON.stringify(data)}\n\n`;
}

/**
 * Get user ID from request (hardcoded for POC)
 */
function getUserId(event) {
  // Check header first
  const headerUserId = event.headers?.['x-user-id'] || event.headers?.['X-User-Id'];
  if (headerUserId) return headerUserId;
  
  // Default for POC
  return 'demo-user';
}

/**
 * Parse request body (JSON or multipart form data)
 */
function parseBody(event) {
  if (!event.body) return {};

  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';

  // Handle multipart form data
  if (contentType.includes('multipart/form-data')) {
    return parseMultipart(event);
  }

  // Handle JSON
  try {
    if (event.isBase64Encoded) {
      return JSON.parse(Buffer.from(event.body, 'base64').toString());
    }
    return JSON.parse(event.body);
  } catch (e) {
    return {};
  }
}

/**
 * Parse multipart form data
 */
function parseMultipart(event) {
  const contentType = event.headers?.['content-type'] || event.headers?.['Content-Type'] || '';
  const boundaryMatch = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  if (!boundaryMatch) return {};

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  let body = event.body;

  if (event.isBase64Encoded) {
    body = Buffer.from(body, 'base64').toString('binary');
  }

  const result = { files: [] };
  const parts = body.split(`--${boundary}`);

  for (const part of parts) {
    if (part.trim() === '' || part.trim() === '--') continue;

    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd === -1) continue;

    const headerSection = part.substring(0, headerEnd);
    const content = part.substring(headerEnd + 4).replace(/\r\n$/, '');

    // Parse Content-Disposition
    const dispositionMatch = headerSection.match(/Content-Disposition:\s*form-data;\s*name="([^"]+)"(?:;\s*filename="([^"]+)")?/i);
    if (!dispositionMatch) continue;

    const fieldName = dispositionMatch[1];
    const filename = dispositionMatch[2];

    if (filename) {
      // This is a file
      const contentTypeMatch = headerSection.match(/Content-Type:\s*([^\r\n]+)/i);
      const fileContentType = contentTypeMatch ? contentTypeMatch[1].trim() : 'application/octet-stream';

      result.files.push({
        name: filename,
        type: fileContentType,
        content: content,
        base64: Buffer.from(content, 'binary').toString('base64')
      });
    } else {
      // This is a regular field
      result[fieldName] = content.trim();
    }
  }

  // Parse JSON fields that might be stringified
  if (result.enabled_connectors) {
    try {
      result.enabled_connectors = JSON.parse(result.enabled_connectors);
    } catch (e) {}
  }

  // Convert string booleans
  if (result.web_search_enabled === 'true') result.web_search_enabled = true;
  if (result.web_search_enabled === 'false') result.web_search_enabled = false;
  if (result.extended_thinking_enabled === 'true') result.extended_thinking_enabled = true;
  if (result.extended_thinking_enabled === 'false') result.extended_thinking_enabled = false;

  return result;
}

/**
 * Get path parameter
 */
function getPathParam(event, name) {
  return event.pathParameters?.[name];
}

/**
 * Get query parameter
 */
function getQueryParam(event, name, defaultValue = null) {
  return event.queryStringParameters?.[name] ?? defaultValue;
}

module.exports = {
  jsonResponse,
  success,
  created,
  noContent,
  badRequest,
  notFound,
  serverError,
  sseHeaders,
  sseEvent,
  getUserId,
  parseBody,
  getPathParam,
  getQueryParam
};

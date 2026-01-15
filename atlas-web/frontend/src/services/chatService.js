/**
 * Chat Service - Connects to Atlas Lambda API
 * All requests include credentials for JWT cookie authentication
 * Cross-domain requests (Lambda Function URL) use Authorization Bearer header
 */

import { getAuthToken } from './authService'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'
const STREAM_URL = import.meta.env.VITE_STREAM_URL || null

// Fetch options with credentials for cookie-based auth (same-domain API Gateway)
const fetchWithCredentials = (options = {}) => ({
  ...options,
  credentials: 'include'
})

// Fetch options for cross-domain Lambda Function URL (uses Bearer token)
const fetchWithAuthHeader = (options = {}) => {
  const token = getAuthToken()
  const headers = {
    ...(options.headers || {}),
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  }
  return {
    ...options,
    headers,
    credentials: 'include'
  }
}

export const chatService = {
  /**
   * Query Knowledge Core for relevant context before sending to Claude
   * This makes the KC query visible in the browser network tab
   */
  async queryKnowledgeCore(query) {
    const startTime = Date.now()
    console.log('[KC] Querying Knowledge Core for:', query)

    try {
      // Query artifacts from Neo4j (works locally without OpenSearch)
      const [artifactsResponse, adrsResponse] = await Promise.all([
        fetch(`${API_URL}/api/mcp/execute`, fetchWithCredentials({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'search_artifacts',
            arguments: { query }
          })
        })),
        fetch(`${API_URL}/api/mcp/execute`, fetchWithCredentials({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool: 'search_adrs',
            arguments: { query }
          })
        }))
      ])

      const elapsed = Date.now() - startTime
      console.log(`[KC] Search completed in ${elapsed}ms`)

      // Parse artifacts
      let artifacts = []
      if (artifactsResponse.ok) {
        const artifactsData = await artifactsResponse.json()
        if (artifactsData.result?.artifacts) {
          artifacts = artifactsData.result.artifacts.map(a => ({
            id: a.id,
            title: a.title,
            content: a.content,
            summary: a.summary,
            author: a.author
          }))
          console.log(`[KC] Found ${artifacts.length} artifacts`)
        }
      }

      // Parse ADRs
      let adrs = []
      if (adrsResponse.ok) {
        const adrsData = await adrsResponse.json()
        if (adrsData.result?.adrs) {
          adrs = adrsData.result.adrs.map(a => ({
            id: a.id,
            title: a.title,
            context: a.context
          }))
          console.log(`[KC] Found ${adrs.length} ADRs`)
        }
      }

      // Return null if no results
      if (artifacts.length === 0 && adrs.length === 0) {
        console.log('[KC] No relevant results found')
        return null
      }

      return { artifacts, patterns: [], adrs, services: [] }
    } catch (error) {
      console.error('[KC] Error querying Knowledge Core:', error)
      return null
    }
  },

  /**
   * Build knowledge context string (without the message)
   * This is sent separately so the clean message can be stored for title/history
   */
  buildKnowledgeContextString(knowledgeContext) {
    if (!knowledgeContext) return null

    let contextBlock = '<knowledge_context>\nRelevant enterprise knowledge:\n'

    if (knowledgeContext.artifacts?.length > 0) {
      for (const a of knowledgeContext.artifacts) {
        contextBlock += `\n## ${a.title}\n${a.content || a.summary || ''}\n`
      }
    }
    if (knowledgeContext.patterns?.length > 0) {
      contextBlock += '\nPatterns: ' + knowledgeContext.patterns.map(p => p.name).join(', ')
    }
    if (knowledgeContext.adrs?.length > 0) {
      contextBlock += '\nADRs: ' + knowledgeContext.adrs.map(a => `${a.id}: ${a.title}`).join(', ')
    }

    contextBlock += '\n</knowledge_context>'
    return contextBlock
  },

  async streamMessage(message, sessionId, projectId, model = 'sonnet', webSearchEnabled = true, knowledgeCoreEnabled = true, enabledConnectors = [], existingArtifacts = [], onChunk, onComplete, onThinking = null, onSearchStart = null, onSearchResults = null, onProcessing = null, onArtifact = null, onKnowledgeContext = null, onMemoryContext = null, onCompaction = null, signal = null) {
    // 1. Query Knowledge Core first (visible in browser network tab) - only if enabled
    let knowledgeContext = null
    if (knowledgeCoreEnabled) {
      knowledgeContext = await this.queryKnowledgeCore(message)

      // 2. Notify UI about knowledge context if found
      if (knowledgeContext && onKnowledgeContext) {
        onKnowledgeContext(knowledgeContext)
      }
    } else {
      console.log('[KC] Knowledge Core disabled, skipping query')
    }

    // 3. Build knowledge context string (separate from message for clean storage)
    const knowledgeContextStr = knowledgeContext ? this.buildKnowledgeContextString(knowledgeContext) : null

    // 4. Stream to chat endpoint (which proxies to AWS)
    // Send original message + knowledge_context separately so AWS can store clean message
    const url = STREAM_URL || `${API_URL}/api/chat/message/stream`
    const isLambdaUrl = STREAM_URL && url.includes('lambda-url')
    console.log('Streaming to URL:', url, isLambdaUrl ? '(Lambda Function URL - using Bearer auth)' : '(API Gateway - using cookies)')

    // Use Bearer auth for Lambda Function URL (cross-domain), cookies for API Gateway
    const fetchOptions = isLambdaUrl ? fetchWithAuthHeader : fetchWithCredentials
    const response = await fetch(url, fetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,  // Original message for storage/title
        knowledge_context: knowledgeContextStr,  // Separate context for Claude
        session_id: sessionId,
        project_id: projectId,
        model,
        web_search_enabled: webSearchEnabled,
        extended_thinking_enabled: false,
        enabled_connectors: enabledConnectors,
        existing_artifacts: existingArtifacts.map(a => ({ id: a.id, title: a.title || a.name, type: a.type }))
      }),
      signal
    }))
    if (!response.ok) throw new Error('Failed to send message')
    await this._processStream(response, onChunk, onComplete, onThinking, onSearchStart, onSearchResults, onProcessing, onArtifact, onKnowledgeContext, onMemoryContext, onCompaction)
  },

  async streamMessageWithFiles(message, files, sessionId, projectId, model = 'sonnet', webSearchEnabled = true, enabledConnectors = [], existingArtifacts = [], onChunk, onComplete, onThinking = null, onSearchStart = null, onSearchResults = null, onProcessing = null, onArtifact = null, onMemoryContext = null, onCompaction = null, signal = null) {
    // Convert files to base64 and send as JSON to Lambda Function URL for true streaming
    const url = STREAM_URL || `${API_URL}/api/chat/message/with-files/stream`
    const isLambdaUrl = STREAM_URL && url.includes('lambda-url')
    console.log('Streaming with files to URL:', url, isLambdaUrl ? '(Lambda Function URL - using Bearer auth)' : '(API Gateway - using cookies)')

    // Convert files to base64
    const filesData = await Promise.all(files.map(async (file) => {
      const base64 = await this._fileToBase64(file)
      return {
        name: file.name,
        type: file.type,
        base64: base64
      }
    }))

    // Use Bearer auth for Lambda Function URL (cross-domain), cookies for API Gateway
    const fetchOptions = isLambdaUrl ? fetchWithAuthHeader : fetchWithCredentials
    const response = await fetch(url, fetchOptions({
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        session_id: sessionId,
        project_id: projectId,
        model,
        web_search_enabled: webSearchEnabled,
        extended_thinking_enabled: false,
        enabled_connectors: enabledConnectors,
        existing_artifacts: existingArtifacts.map(a => ({ id: a.id, title: a.title || a.name, type: a.type })),
        files: filesData
      }),
      signal
    }))
    if (!response.ok) throw new Error('Failed to send message with files')
    await this._processStream(response, onChunk, onComplete, onThinking, onSearchStart, onSearchResults, onProcessing, onArtifact, null, onMemoryContext, onCompaction)
  },

  _fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        // Remove the data:...;base64, prefix
        const base64 = reader.result.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  },

  async _processStream(response, onChunk, onComplete, onThinking = null, onSearchStart = null, onSearchResults = null, onProcessing = null, onArtifact = null, onKnowledgeContext = null, onMemoryContext = null, onCompaction = null) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n\n')
      buffer = lines.pop() || ''

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6))
            if (data.type === 'chunk') onChunk(data.content)
            else if (data.type === 'thinking' && onThinking) onThinking(data.content)
            else if (data.type === 'processing' && onProcessing) onProcessing(data.message)
            else if (data.type === 'processing_done' && onProcessing) onProcessing(null) // Signal processing complete
            else if (data.type === 'knowledge_context' && onKnowledgeContext) onKnowledgeContext(data.context)
            else if (data.type === 'memory_context' && onMemoryContext) onMemoryContext(data)
            else if (data.type === 'search_start' && onSearchStart) onSearchStart(data.query)
            else if (data.type === 'search_results' && onSearchResults) {
              // Parse results if they're a string (JSON from backend)
              let results = data.results
              if (typeof results === 'string') {
                try {
                  const parsed = JSON.parse(results)
                  results = parsed.results || []
                } catch (e) {
                  results = []
                }
              }
              onSearchResults(data.query, results)
            }
            else if (data.type === 'artifact_start' && onArtifact) {
              onArtifact({ event: 'start', artifact: data.artifact })
            }
            else if (data.type === 'artifact_delta' && onArtifact) {
              onArtifact({ event: 'delta', artifact: data.artifact })
            }
            else if (data.type === 'artifact_complete' && onArtifact) {
              onArtifact({ event: 'complete', artifact: data.artifact || data })
            }
            else if (data.type === 'compaction' && onCompaction) {
              onCompaction(data)
            }
            else if (data.type === 'done') onComplete(data)
            else if (data.type === 'error') console.error('Stream error:', data.message)
          } catch (e) { /* ignore */ }
        }
      }
    }
    // Process any remaining buffer
    if (buffer.trim()) {
      const remaining = buffer.trim()
      if (remaining.startsWith('data: ')) {
        try {
          const data = JSON.parse(remaining.slice(6))
          if (data.type === 'done') {
            onComplete(data)
            return // Exit after calling onComplete
          } else if (data.type === 'chunk') {
            onChunk(data.content)
          }
        } catch (e) { console.log('Failed to parse remaining buffer:', remaining) }
      }
    }
    // Ensure onComplete is called even if done event was missed
    // This handles the case where the stream closes without a done event
    onComplete({ type: 'done', session_id: null })
  },

  async getAvailableConnectors() {
    const response = await fetch(`${API_URL}/api/connectors/available`, fetchWithCredentials())
    if (!response.ok) throw new Error('Failed to get connectors')
    const data = await response.json()
    return data.connectors
  },
}

export const sessionsService = {
  async list() {
    const res = await fetch(`${API_URL}/api/sessions`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list sessions')
    return (await res.json()).sessions
  },
  async create(data = {}) {
    const res = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(data)
    })
    if (!res.ok) throw new Error('Failed to create session')
    return res.json()
  },
  async getMessages(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/messages`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get messages')
    return (await res.json()).messages
  },
  async update(sessionId, updates) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, fetchWithCredentials({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }))
    if (!res.ok) throw new Error('Failed to update session')
    return res.json()
  },
  async delete(sessionId) {
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}`, fetchWithCredentials({ method: 'DELETE' }))
    if (!res.ok) throw new Error('Failed to delete session')
  }
}

export const projectsService = {
  async list(status = 'active') {
    const res = await fetch(`${API_URL}/api/projects?status=${status}`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list projects')
    return (await res.json()).projects
  },

  async get(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get project')
    return res.json()
  },

  async create(project) {
    const res = await fetch(`${API_URL}/api/projects`, fetchWithCredentials({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(project) }))
    if (!res.ok) throw new Error('Failed to create project')
    return res.json()
  },

  async update(projectId, updates) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, fetchWithCredentials({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }))
    if (!res.ok) throw new Error('Failed to update project')
    return res.json()
  },

  async delete(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}`, fetchWithCredentials({ method: 'DELETE' }))
    if (!res.ok) throw new Error('Failed to delete project')
  },

  // File management
  async listFiles(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list files')
    return (await res.json()).files
  },

  async getFile(projectId, fileId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${fileId}`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get file')
    return res.json()
  },

  async uploadFile(projectId, file, pinned = false) {
    // Check if it's a zip file - use special endpoint for extraction
    if (file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')) {
      return this.uploadZipFile(projectId, file, pinned)
    }

    const presignRes = await fetch(`${API_URL}/api/projects/${projectId}/files`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, pinned })
    })
    if (!presignRes.ok) throw new Error('Failed to get upload URL')
    const { uploadUrl, file: fileInfo } = await presignRes.json()
    await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    return fileInfo
  },

  async uploadZipFile(projectId, file, pinAll = false) {
    // Convert file to base64
    const base64 = await new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result.split(',')[1])
      reader.onerror = reject
      reader.readAsDataURL(file)
    })

    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/upload-zip`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({
        filename: file.name,
        zipContent: base64,
        includeImages: true,
        includeCode: true,
        includeText: true,
        maxFiles: 50,
        pinAll
      })
    })

    if (!res.ok) throw new Error('Failed to upload and extract zip file')
    return res.json()
  },

  async updateFile(projectId, fileId, updates) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${fileId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify(updates)
    })
    if (!res.ok) throw new Error('Failed to update file')
    return res.json()
  },

  async toggleFilePin(projectId, fileId, pinned) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${fileId}/pin`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ pinned })
    })
    if (!res.ok) throw new Error('Failed to toggle file pin')
    return res.json()
  },

  async deleteFile(projectId, fileId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/${fileId}`, fetchWithCredentials({ method: 'DELETE' }))
    if (!res.ok) throw new Error('Failed to delete file')
  },

  // Save artifact as project file
  async saveArtifactToProject(projectId, { filename, content, artifactId, artifactTitle, pinned = false }) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/files/from-artifact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ filename, content, artifactId, artifactTitle, pinned })
    })
    if (!res.ok) throw new Error('Failed to save artifact to project')
    return res.json()
  },

  // Memory management
  async getMemory(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memory`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get project memory')
    return res.json()
  },

  async updateMemory(projectId, sections) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memory`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ sections })
    })
    if (!res.ok) throw new Error('Failed to update project memory')
    return res.json()
  },

  async regenerateMemory(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memory/regenerate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include'
    })
    if (!res.ok) throw new Error('Failed to regenerate project memory')
    return res.json()
  },

  // Semantic Memories (S3 Vectors)
  async listSemanticMemories(projectId, query = null) {
    const params = query ? `?query=${encodeURIComponent(query)}` : ''
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memories${params}`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list semantic memories')
    return res.json()
  },

  async addSemanticMemory(projectId, content, category = 'general') {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content, category })
    })
    if (!res.ok) throw new Error('Failed to add semantic memory')
    return res.json()
  },

  async updateSemanticMemory(projectId, memoryId, content, category = 'general') {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memories/${memoryId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ content, category })
    })
    if (!res.ok) throw new Error('Failed to update semantic memory')
    return res.json()
  },

  async deleteSemanticMemory(projectId, memoryId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/memories/${memoryId}`, {
      method: 'DELETE',
      credentials: 'include'
    })
    if (!res.ok) throw new Error('Failed to delete semantic memory')
  },

  // Chats/sessions within a project
  async listChats(projectId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/chats`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list project chats')
    return (await res.json()).chats
  },

  async deleteChat(projectId, chatId) {
    const res = await fetch(`${API_URL}/api/projects/${projectId}/chats/${chatId}`, fetchWithCredentials({ method: 'DELETE' }))
    if (!res.ok) throw new Error('Failed to delete chat')
  }
}

export const artifactsService = {
  async listForSession(sessionId) {
    console.log('[artifactsService] Fetching artifacts for session:', sessionId)
    const res = await fetch(`${API_URL}/api/sessions/${sessionId}/artifacts`, fetchWithCredentials())
    if (!res.ok) {
      console.error('[artifactsService] Failed to list artifacts:', res.status, res.statusText)
      throw new Error('Failed to list artifacts')
    }
    const data = await res.json()
    console.log('[artifactsService] Got', data.artifacts?.length || 0, 'artifacts for session')
    return data.artifacts
  },
  async listAll() {
    console.log('[artifactsService] Fetching all artifacts')
    const res = await fetch(`${API_URL}/api/artifacts`, fetchWithCredentials())
    if (!res.ok) {
      console.error('[artifactsService] Failed to list all artifacts:', res.status, res.statusText)
      throw new Error('Failed to list all artifacts')
    }
    const data = await res.json()
    console.log('[artifactsService] Got', data.artifacts?.length || 0, 'total artifacts')
    return data.artifacts
  },
  async getContent(sessionId, artifactId) {
    const res = await fetch(`${API_URL}/api/artifacts/${artifactId}/content?sessionId=${sessionId}`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get artifact content')
    return (await res.text())
  }
}

export const mcpService = {
  async list() {
    const res = await fetch(`${API_URL}/api/mcp/servers`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to list MCP servers')
    return (await res.json()).servers
  },
  async create(server) {
    const res = await fetch(`${API_URL}/api/mcp/servers`, fetchWithCredentials({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(server) }))
    if (!res.ok) throw new Error('Failed to create MCP server')
    return res.json()
  },
  async update(serverId, updates) {
    const res = await fetch(`${API_URL}/api/mcp/servers/${serverId}`, fetchWithCredentials({ method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updates) }))
    if (!res.ok) throw new Error('Failed to update MCP server')
    return res.json()
  },
  async delete(serverId) {
    const res = await fetch(`${API_URL}/api/mcp/servers/${serverId}`, fetchWithCredentials({ method: 'DELETE' }))
    if (!res.ok) throw new Error('Failed to delete MCP server')
  },
  async getTools() {
    const res = await fetch(`${API_URL}/api/mcp/tools`, fetchWithCredentials())
    if (!res.ok) throw new Error('Failed to get MCP tools')
    return res.json()
  },
  async executeTool(tool, args, serverId = null) {
    const res = await fetch(`${API_URL}/api/mcp/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }, credentials: 'include',
      body: JSON.stringify({ tool, arguments: args, server_id: serverId })
    })
    if (!res.ok) throw new Error('Failed to execute MCP tool')
    return res.json()
  }
}

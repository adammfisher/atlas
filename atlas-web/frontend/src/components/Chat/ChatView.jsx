import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { StopCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatStore } from '../../hooks/useChatStore'
import { chatService, sessionsService } from '../../services/chatService'
import ChatInput from './ChatInput'
import ChatTitleBar from './ChatTitleBar'
import ThinkingSteps from './ThinkingSteps'
import StreamingIndicator from './StreamingIndicator'
import MessageFileCard from './MessageFileCard'
import InlineArtifact, { parseMessageForArtifacts, extractTitleFromContent, generateArtifactHash, StreamingArtifactCard } from '../Artifacts/InlineArtifact'

function ChatView({ onToggleArtifacts, artifactsCount = 0, existingArtifacts = [], onArtifactCreated, onOpenArtifactInPanel, onArtifactStreaming, showArtifacts = false, onArtifactsDetected }) {
  const { sessionId, projectId } = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [isStreaming, setIsStreaming] = useState(false)
  const initialMessageProcessed = useRef(false)
  const [isFirstMessage, setIsFirstMessage] = useState(true)
  const [thinkingSteps, setThinkingSteps] = useState([])
  const [showThinkingSteps, setShowThinkingSteps] = useState(false)
  const [isLoadingMessages, setIsLoadingMessages] = useState(false)
  const [knowledgeContext, setKnowledgeContext] = useState(null)
  const messagesEndRef = useRef(null)
  const fullResponseRef = useRef('')
  const thinkingStepsRef = useRef([])
  // Track streaming artifact detection
  const streamingArtifactRef = useRef(null)
  const artifactContentRef = useRef('')
  // Local state for streaming artifact (for rendering inline card)
  const [currentStreamingArtifact, setCurrentStreamingArtifact] = useState(null)
  // AbortController for stopping streaming
  const abortControllerRef = useRef(null)

  const {
    messagesBySession,
    currentSessionId,
    sessions,
    addMessage,
    updateLastMessage,
    setMessageStreaming,
    updateLastMessageThinkingSteps,
    setCurrentSession,
    createSession,
    updateSessionTitle,
    deleteSession,
    setSessionMessages,
    chatFont,
    _hasHydrated,
    setProjectMemoryContext,
  } = useChatStore()

  // Derive messages from messagesBySession for current session
  const messages = messagesBySession[currentSessionId] || []

  // Font family mapping
  const fontFamilies = {
    default: '"Merriweather", Georgia, "Times New Roman", Times, serif',
    poppins: '"Poppins", sans-serif',
    lato: '"Lato", sans-serif',
    sans: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  }

  // Get current session
  const currentSession = sessions.find(s => s.id === currentSessionId) || null

  // Set current session when URL changes - wait for hydration first
  useEffect(() => {
    if (sessionId) {
      // Only set if different to avoid unnecessary re-renders
      if (sessionId !== currentSessionId) {
        setCurrentSession(sessionId)
      }
    }
  }, [sessionId, _hasHydrated, currentSessionId, setCurrentSession])

  // Load messages from backend when session changes and we don't have them locally
  useEffect(() => {
    if (!currentSessionId) return

    const localMessages = messagesBySession[currentSessionId]

    // If we have no local messages for this session, try to load from backend
    if (!localMessages || localMessages.length === 0) {
      const loadMessages = async () => {
        setIsLoadingMessages(true)
        try {
          const backendMessages = await sessionsService.getMessages(currentSessionId)
          if (backendMessages && backendMessages.length > 0) {
            // Normalize message format
            const normalizedMessages = backendMessages.map(m => ({
              id: m.id || m.messageId,
              role: m.role,
              content: m.content,
              thinking: m.thinking,
              files: m.files,
              timestamp: m.timestamp,
              isStreaming: false
            }))
            setSessionMessages(currentSessionId, normalizedMessages)
          }
        } catch (e) {
          console.error('Failed to load messages from backend:', e)
        } finally {
          setIsLoadingMessages(false)
        }
      }
      loadMessages()
    }
  }, [currentSessionId, messagesBySession, setSessionMessages])

  // Auto-scroll when messages change or during streaming
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Also scroll during streaming as content comes in
  useEffect(() => {
    if (isStreaming) {
      const scrollInterval = setInterval(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
      }, 100)
      return () => clearInterval(scrollInterval)
    }
  }, [isStreaming])

  // Reset first message flag when session changes
  useEffect(() => {
    setIsFirstMessage(messages.length === 0)
  }, [currentSessionId, messages.length])

  // Handle initialMessage from URL parameter (from project detail page)
  useEffect(() => {
    const initialMessage = searchParams.get('initialMessage')
    if (initialMessage && currentSessionId && !initialMessageProcessed.current && !isLoadingMessages) {
      initialMessageProcessed.current = true
      // Clear the URL parameter
      setSearchParams({}, { replace: true })
      // Send the initial message
      handleSend({
        message: decodeURIComponent(initialMessage),
        files: [],
        model: 'haiku', // Model selection disabled - using Haiku as default
        webSearchEnabled: false,
        extendedThinkingEnabled: false,
        knowledgeCoreEnabled: false,
        enabledConnectors: []
      })
    }
  }, [searchParams, currentSessionId, isLoadingMessages])

  // Detect artifacts in loaded messages and update count
  // Only run when NOT streaming to avoid constant updates during artifact creation
  useEffect(() => {
    if (messages.length > 0 && onArtifactsDetected && !isStreaming) {
      const allArtifacts = []
      for (const msg of messages) {
        if (msg.role === 'assistant' && msg.content && !msg.isStreaming) {
          const { artifacts } = parseMessageForArtifacts(msg.content)
          allArtifacts.push(...artifacts)
        }
      }
      if (allArtifacts.length > 0) {
        onArtifactsDetected(allArtifacts)
      }
    }
  }, [messages, currentSessionId, onArtifactsDetected, isStreaming])

  // Generate title from the first response
  const generateTitleFromResponse = (response, userMessage) => {
    // Use the first ~50 characters of the user message as the title
    let title = userMessage.trim()
    if (title.length > 50) {
      title = title.substring(0, 47) + '...'
    }
    return title || 'New conversation'
  }

  const handleSend = async ({ message, files, model, webSearchEnabled, extendedThinkingEnabled, knowledgeCoreEnabled, enabledConnectors }) => {
    if ((!message && files.length === 0) || isStreaming) return

    // Use existing session ID if available, otherwise create a temporary local one
    // This ensures messages are stored while we wait for the backend session ID
    let activeSessionId = currentSessionId
    let isNewSession = !activeSessionId
    let tempSessionId = null

    if (isNewSession) {
      // Create a temporary session so messages have somewhere to go
      // Pass projectId if we're in a project context
      tempSessionId = createSession(null, projectId || null)
      activeSessionId = tempSessionId
    }

    // Add user message to store - include preview URLs for images
    const filesWithPreviews = files.map(f => {
      const fileInfo = { name: f.name, type: f.type, size: f.size }
      if (f.type.startsWith('image/')) {
        fileInfo.previewUrl = URL.createObjectURL(f)
      }
      return fileInfo
    })

    addMessage({
      role: 'user',
      content: message,
      files: filesWithPreviews
    })

    // Add placeholder for assistant response
    addMessage({
      role: 'assistant',
      content: '',
      isStreaming: true,
      thinkingSteps: [] // Initialize empty thinking steps for this message
    })

    setIsStreaming(true)
    fullResponseRef.current = ''
    thinkingStepsRef.current = []
    setThinkingSteps([])
    // Reset streaming artifact tracking
    streamingArtifactRef.current = null
    artifactContentRef.current = ''
    // Show steps panel for extended thinking OR web search
    setShowThinkingSteps(extendedThinkingEnabled || webSearchEnabled)

    const shouldGenerateTitle = isFirstMessage && !currentSession?.title
    setIsFirstMessage(false)

    // Helper to update thinking steps both in local state and persist to message
    const updateThinkingSteps = (newSteps) => {
      thinkingStepsRef.current = newSteps
      setThinkingSteps([...newSteps])
      updateLastMessageThinkingSteps([...newSteps])
    }

    // Callbacks for thinking steps
    const handleThinking = (content) => {
      const step = { type: 'thinking', content }
      updateThinkingSteps([...thinkingStepsRef.current, step])
    }

    const handleSearchStart = (query) => {
      const step = { type: 'search_start', query, loading: true }
      updateThinkingSteps([...thinkingStepsRef.current, step])
    }

    const handleSearchResults = (query, results) => {
      // Update the search_start step to show it's done, and add results
      const updatedSteps = thinkingStepsRef.current.map(step => {
        if (step.type === 'search_start' && step.query === query) {
          return { ...step, loading: false, resultCount: results.length }
        }
        return step
      })
      // Add results step
      const resultsStep = { type: 'search_results', query, results }
      updateThinkingSteps([...updatedSteps, resultsStep])
    }

    const handleProcessing = (message) => {
      if (message === null) {
        // Signal to mark all processing steps as done
        const updatedSteps = thinkingStepsRef.current.map(step =>
          step.type === 'processing' ? { ...step, loading: false } : step
        )
        updateThinkingSteps(updatedSteps)
        return
      }
      const step = { type: 'processing', message, loading: true }
      updateThinkingSteps([...thinkingStepsRef.current, step])
      // Show the steps panel when processing files
      setShowThinkingSteps(true)
    }

    const handleKnowledgeContext = (context) => {
      console.log('Knowledge context received:', context)
      setKnowledgeContext(context)
      // Add knowledge context to thinking steps
      const step = { type: 'knowledge_context', context }
      updateThinkingSteps([...thinkingStepsRef.current, step])
      setShowThinkingSteps(true)
    }

    const handleMemoryContext = (data) => {
      console.log('Memory context received:', data)
      // Store the memory context in the global store for display in project sidebar
      if (projectId && data) {
        setProjectMemoryContext(projectId, {
          semanticMemoryCount: data.semanticMemoryCount || 0,
          relevantConversationsCount: data.relevantConversationsCount || 0,
          projectName: data.projectName,
          memories: data.memories || [],
          conversations: data.conversations || []
        })
        // Add to thinking steps if we have memories
        if (data.semanticMemoryCount > 0 || data.relevantConversationsCount > 0) {
          const step = {
            type: 'memory_context',
            semanticMemoryCount: data.semanticMemoryCount,
            relevantConversationsCount: data.relevantConversationsCount
          }
          updateThinkingSteps([...thinkingStepsRef.current, step])
          setShowThinkingSteps(true)
        }
      }
    }

    const handleCompaction = (data) => {
      console.log('Compaction notification received:', data)
      // Add compaction notification to thinking steps
      const step = {
        type: 'compaction',
        message: data.message,
        stats: data.stats
      }
      updateThinkingSteps([...thinkingStepsRef.current, step])
      setShowThinkingSteps(true)
    }

    const handleArtifact = (artifactEvent) => {
      console.log('Artifact event:', artifactEvent)
      if (artifactEvent.event === 'start' && onArtifactStreaming) {
        // Backend detected artifact start - open panel with streaming artifact
        const artifact = artifactEvent.artifact
        const typeInfo = {
          'markdown': { ext: '.md', name: 'Markdown Document' },
          'md': { ext: '.md', name: 'Markdown Document' },
          'html': { ext: '.html', name: 'HTML Document' },
          'svg': { ext: '.svg', name: 'SVG Diagram' },
          'mermaid': { ext: '.mermaid', name: 'Mermaid Diagram' },
          'react': { ext: '.jsx', name: 'React Component' },
          'jsx': { ext: '.jsx', name: 'React Component' },
          'json': { ext: '.json', name: 'JSON Data' },
          'css': { ext: '.css', name: 'CSS Stylesheet' },
          'javascript': { ext: '.js', name: 'JavaScript' },
          'python': { ext: '.py', name: 'Python' },
        }
        const info = typeInfo[artifact.type] || { ext: `.${artifact.type}`, name: artifact.name }
        // Use the actual title from the artifact event, fall back to type name
        const displayTitle = artifact.title || info.name
        // CRITICAL: Use the ID from the backend (stable hash already generated)
        // This ensures start and complete events use the same ID
        const stableId = artifact.id || generateArtifactHash(displayTitle, artifact.type)
        console.log('[ChatView] Artifact start - backend ID:', artifact.id, 'displayTitle:', displayTitle, 'stableId:', stableId)
        streamingArtifactRef.current = {
          id: stableId,
          name: displayTitle,
          title: displayTitle,
          type: artifact.type,
          file_extension: info.ext,
          renderable: true,
          version: 1,
          created_at: new Date().toISOString(),
          content: ''
        }
        // Update local state for inline card rendering
        setCurrentStreamingArtifact(streamingArtifactRef.current)
        onArtifactStreaming(streamingArtifactRef.current)
      } else if (artifactEvent.event === 'delta' && onArtifactStreaming) {
        // Update streaming artifact with new content from backend
        const artifact = artifactEvent.artifact
        if (streamingArtifactRef.current) {
          artifactContentRef.current = artifact.content || ''
          const updatedArtifact = {
            ...streamingArtifactRef.current,
            content: artifact.content || ''
          }
          streamingArtifactRef.current = updatedArtifact
          // Update local state for inline card
          setCurrentStreamingArtifact(updatedArtifact)
          onArtifactStreaming(updatedArtifact)
        }
      } else if (artifactEvent.event === 'complete') {
        console.log('[ChatView] Artifact complete event received:', artifactEvent)
        // Finalize the artifact with content from the backend event
        const artifact = artifactEvent.artifact
        const content = artifact?.content || artifactContentRef.current
        console.log('[ChatView] Content length:', content?.length, 'from event:', !!artifact?.content, 'from ref:', !!artifactContentRef.current)
        if (onArtifactCreated) {
          const artifactType = artifact?.type || streamingArtifactRef.current?.type || 'markdown'
          // CRITICAL: Use the title from the backend (from <artifact title="...">) as primary source
          // This MUST match what was used in artifact_start to prevent duplicates
          // Only use the artifact.id from backend which is already the stable hash
          const backendTitle = artifact?.title || artifact?.name
          const backendId = artifact?.id
          // Use backend's stable ID if available (ensures consistency)
          // Otherwise generate from backend title (fallback)
          const stableId = backendId || generateArtifactHash(backendTitle, artifactType)
          const finalTitle = backendTitle || streamingArtifactRef.current?.title || 'Untitled Artifact'
          const finalArtifact = {
            id: stableId,
            name: finalTitle,
            title: finalTitle,
            type: artifactType,
            content: content,
            size: content.length,
            file_extension: artifact?.file_extension || streamingArtifactRef.current?.file_extension || `.${artifactType}`,
            renderable: true,
            version: artifact?.version || 1,
            created_at: new Date().toISOString()
          }
          console.log('[ChatView] Creating final artifact:', finalArtifact.id, 'title:', finalTitle, 'backendId:', backendId, 'content length:', content.length)
          onArtifactCreated(finalArtifact)
          console.log('[ChatView] Clearing streamingArtifactRef and artifactContentRef')
          streamingArtifactRef.current = null
          artifactContentRef.current = ''
          // Clear local state
          console.log('[ChatView] Clearing currentStreamingArtifact state')
          setCurrentStreamingArtifact(null)
        }
      }
    }

    // Update streaming artifact content (extracts content from code block or <artifact> tag)
    const updateStreamingArtifact = (fullContent) => {
      if (!streamingArtifactRef.current) return

      // First try to extract content from <artifact> tags
      const artifactTagMatch = fullContent.match(/<artifact[^>]*>([\s\S]*)/)
      if (artifactTagMatch) {
        let content = artifactTagMatch[1]
        // Check if artifact is complete (has closing tag)
        const endIndex = content.indexOf('</artifact>')
        if (endIndex !== -1) {
          content = content.substring(0, endIndex)
        }
        // Only update if content has changed
        if (content !== artifactContentRef.current) {
          artifactContentRef.current = content
          if (onArtifactStreaming) {
            onArtifactStreaming({
              ...streamingArtifactRef.current,
              content: content
            })
          }
          // Also update local state for inline card
          setCurrentStreamingArtifact(prev => prev ? { ...prev, content } : null)
        }
        return
      }

      // Fall back to code fence extraction for legacy format
      const artifactType = streamingArtifactRef.current.type
      // Build regex pattern to match the code fence and capture content after it
      const langPattern = artifactType === 'markdown' ? '(?:markdown|md)' : artifactType
      const regex = new RegExp('```' + langPattern + '\\n([\\s\\S]*)')
      const startMatch = fullContent.match(regex)

      if (startMatch) {
        let content = startMatch[1]
        // Check if artifact is complete (has closing ```)
        const endIndex = content.indexOf('```')
        if (endIndex !== -1) {
          content = content.substring(0, endIndex)
        }
        // Only update if content has changed
        if (content !== artifactContentRef.current) {
          artifactContentRef.current = content
          if (onArtifactStreaming) {
            onArtifactStreaming({
              ...streamingArtifactRef.current,
              content: content
            })
          }
        }
      }
    }

    // Reset artifact streaming state for new message
    window._artifactStreamState = { insideArtifact: false, buffer: '' }

    try {
      // Create AbortController for this stream request
      abortControllerRef.current = new AbortController()
      const signal = abortControllerRef.current.signal

      if (files.length > 0) {
        await chatService.streamMessageWithFiles(
          message,
          files,
          activeSessionId,
          projectId,
          model,
          webSearchEnabled,
          enabledConnectors,
          existingArtifacts,
          (chunk) => {
            // Mark processing as done when we start receiving content
            const hasProcessing = thinkingStepsRef.current.some(step =>
              step.type === 'processing' && step.loading
            )
            if (hasProcessing) {
              const updatedSteps = thinkingStepsRef.current.map(step =>
                step.type === 'processing' ? { ...step, loading: false } : step
              )
              updateThinkingSteps(updatedSteps)
            }

            // Use shared artifact filtering state
            const state = window._artifactStreamState

            // Accumulate full response for artifact extraction
            fullResponseRef.current += chunk

            // Add chunk to buffer
            state.buffer += chunk

            // Process buffer to extract display text (filtering out artifact content)
            let displayText = ''

            while (state.buffer.length > 0) {
              if (state.insideArtifact) {
                const closeIndex = state.buffer.indexOf('</artifact>')
                if (closeIndex !== -1) {
                  state.insideArtifact = false
                  state.buffer = state.buffer.substring(closeIndex + '</artifact>'.length)
                } else {
                  break
                }
              } else {
                const openIndex = state.buffer.indexOf('<artifact')
                if (openIndex !== -1) {
                  displayText += state.buffer.substring(0, openIndex)
                  state.insideArtifact = true
                  state.buffer = state.buffer.substring(openIndex)
                } else if (state.buffer.length > 50 || !state.buffer.includes('<a')) {
                  // Flush buffer if it's long enough or doesn't contain start of <artifact tag
                  // Changed from checking for any '<' to specifically '<a' to avoid false holds
                  displayText += state.buffer
                  state.buffer = ''
                } else {
                  break
                }
              }
            }

            // Only update display if we have non-artifact content
            if (displayText && displayText.trim()) {
              updateLastMessage(prev => prev + displayText)
            }

            // Update streaming artifact content if backend initiated one
            if (streamingArtifactRef.current) {
              updateStreamingArtifact(fullResponseRef.current)
            }
          },
          (result) => {
            setIsStreaming(false)
            setMessageStreaming(false)

            // Flush any remaining buffer content
            const state = window._artifactStreamState
            if (state && state.buffer && !state.insideArtifact) {
              updateLastMessage(prev => prev + state.buffer)
              state.buffer = ''
            }

            // If this was a new session, migrate temp session to backend session ID
            if (isNewSession && result.session_id && tempSessionId) {
              const backendSessionId = result.session_id
              const store = useChatStore.getState()
              // Get messages from temp session
              const tempMessages = store.messagesBySession[tempSessionId] || []
              // Update the temp session's ID to the backend ID
              const updatedSessions = store.sessions.map(s =>
                s.id === tempSessionId ? { ...s, id: backendSessionId } : s
              )
              // Move messages to the new session ID and remove temp session
              const { [tempSessionId]: _, ...restMessages } = store.messagesBySession
              store.setSessions(updatedSessions)
              store.setSessionMessages(backendSessionId, tempMessages)
              store.setCurrentSession(backendSessionId)
              // Navigate to the new URL
              navigate(projectId ? `/project/${projectId}/chat/${backendSessionId}` : `/chat/${backendSessionId}`, { replace: true })
              // Update activeSessionId for title generation
              activeSessionId = backendSessionId
            }

            // Generate title for new sessions
            if (shouldGenerateTitle && activeSessionId) {
              const title = generateTitleFromResponse(fullResponseRef.current, message)
              updateSessionTitle(activeSessionId, title)
            }
            // Finalize any streaming artifact that wasn't completed by backend event
            if (streamingArtifactRef.current && artifactContentRef.current && onArtifactCreated) {
              console.log('Finalizing artifact on stream complete (with files)')
              const finalArtifact = {
                ...streamingArtifactRef.current,
                content: artifactContentRef.current,
                size: artifactContentRef.current.length
              }
              onArtifactCreated(finalArtifact)
              streamingArtifactRef.current = null
              artifactContentRef.current = ''
            }
          },
          handleThinking,
          handleSearchStart,
          handleSearchResults,
          handleProcessing,
          handleArtifact,
          handleMemoryContext,
          handleCompaction,
          signal
        )
      } else {
        await chatService.streamMessage(
          message,
          activeSessionId,
          projectId,
          model,
          webSearchEnabled,
          knowledgeCoreEnabled,
          enabledConnectors,
          existingArtifacts,
          (chunk) => {
            // Track if we're inside an artifact (state persists across chunks)
            if (!window._artifactStreamState) {
              window._artifactStreamState = { insideArtifact: false, buffer: '' }
            }
            const state = window._artifactStreamState

            // Accumulate full response for artifact extraction
            fullResponseRef.current += chunk

            // Add chunk to buffer
            state.buffer += chunk

            // Process buffer to extract display text (filtering out artifact content)
            let displayText = ''

            while (state.buffer.length > 0) {
              if (state.insideArtifact) {
                // Look for closing tag
                const closeIndex = state.buffer.indexOf('</artifact>')
                if (closeIndex !== -1) {
                  // Found closing tag - discard artifact content and switch to normal mode
                  state.insideArtifact = false
                  state.buffer = state.buffer.substring(closeIndex + '</artifact>'.length)
                } else {
                  // Still waiting for close tag - hold entire buffer
                  break
                }
              } else {
                // Look for opening tag
                const openIndex = state.buffer.indexOf('<artifact')
                if (openIndex !== -1) {
                  // Found opening tag - extract text before it, then switch to artifact mode
                  displayText += state.buffer.substring(0, openIndex)
                  state.insideArtifact = true
                  state.buffer = state.buffer.substring(openIndex)
                } else if (state.buffer.length > 50 || !state.buffer.includes('<a')) {
                  // Flush buffer if it's long enough or doesn't contain start of <artifact tag
                  // Changed from checking for any '<' to specifically '<a' to avoid false holds
                  displayText += state.buffer
                  state.buffer = ''
                } else {
                  // Could be partial tag, hold buffer
                  break
                }
              }
            }

            // Only update display if we have non-artifact content
            if (displayText && displayText.trim()) {
              updateLastMessage(prev => {
                // Skip if this exact text already exists (deduplication)
                if (prev.includes(displayText)) return prev
                // Check if this is cumulative content (new text extends existing)
                // This handles cases where backend sends full content on each chunk
                if (displayText.startsWith(prev.trim())) {
                  return displayText
                }
                return prev + displayText
              })
            }

            // Update streaming artifact content if backend initiated one
            if (streamingArtifactRef.current) {
              updateStreamingArtifact(fullResponseRef.current)
            }
          },
          (result) => {
            setIsStreaming(false)
            setMessageStreaming(false)

            // Flush any remaining buffer content
            const state = window._artifactStreamState
            if (state && state.buffer && !state.insideArtifact) {
              updateLastMessage(prev => prev + state.buffer)
              state.buffer = ''
            }

            // Clean up displayed message - remove duplicates caused by backend
            updateLastMessage(prev => {
              // Extract artifact-free content and remove duplicate progressive lines
              const lines = prev.split('\n')
              const cleanedLines = []
              for (const line of lines) {
                // Skip if this line is a prefix of a later line we've already seen
                const isDuplicate = cleanedLines.some(existing =>
                  existing.startsWith(line) && existing !== line
                )
                if (!isDuplicate) {
                  // Also skip if this line is just a longer version of the last line
                  const lastLine = cleanedLines[cleanedLines.length - 1]
                  if (lastLine && line.startsWith(lastLine)) {
                    cleanedLines[cleanedLines.length - 1] = line
                  } else {
                    cleanedLines.push(line)
                  }
                }
              }
              return cleanedLines.join('\n')
            })

            // If this was a new session, migrate temp session to backend session ID
            if (isNewSession && result.session_id && tempSessionId) {
              const backendSessionId = result.session_id
              const store = useChatStore.getState()
              // Get messages from temp session
              const tempMessages = store.messagesBySession[tempSessionId] || []
              // Update the temp session's ID to the backend ID
              const updatedSessions = store.sessions.map(s =>
                s.id === tempSessionId ? { ...s, id: backendSessionId } : s
              )
              // Move messages to the new session ID and remove temp session
              const { [tempSessionId]: _, ...restMessages } = store.messagesBySession
              store.setSessions(updatedSessions)
              store.setSessionMessages(backendSessionId, tempMessages)
              store.setCurrentSession(backendSessionId)
              // Navigate to the new URL
              navigate(projectId ? `/project/${projectId}/chat/${backendSessionId}` : `/chat/${backendSessionId}`, { replace: true })
              // Update activeSessionId for title generation
              activeSessionId = backendSessionId
            }

            // Generate title for new sessions
            if (shouldGenerateTitle && activeSessionId) {
              const title = generateTitleFromResponse(fullResponseRef.current, message)
              updateSessionTitle(activeSessionId, title)
            }
            // Finalize any streaming artifact that wasn't completed by backend event
            if (streamingArtifactRef.current && artifactContentRef.current && onArtifactCreated) {
              console.log('Finalizing artifact on stream complete')
              const finalArtifact = {
                ...streamingArtifactRef.current,
                content: artifactContentRef.current,
                size: artifactContentRef.current.length
              }
              onArtifactCreated(finalArtifact)
              streamingArtifactRef.current = null
              artifactContentRef.current = ''
            }
          },
          handleThinking,
          handleSearchStart,
          handleSearchResults,
          handleProcessing,
          handleArtifact,
          handleKnowledgeContext,
          handleMemoryContext,
          handleCompaction,
          signal
        )
      }
    } catch (error) {
      // Don't show error message if user aborted the request
      if (error.name === 'AbortError') {
        console.log('Stream aborted by user')
        return
      }
      console.error('Chat error:', error)
      updateLastMessage('Sorry, an error occurred. Please try again.')
      setIsStreaming(false)
    }
  }

  const handleStop = () => {
    // Abort the fetch request to stop the stream
    if (abortControllerRef.current) {
      abortControllerRef.current.abort()
      abortControllerRef.current = null
    }
    setIsStreaming(false)
    setMessageStreaming(false)
  }

  const handleDelete = (sessionId) => {
    deleteSession(sessionId)
    navigate(projectId ? `/project/${projectId}` : '/')
  }

  const handleAddToProject = (sessionId) => {
    // TODO: Show project selection modal
    console.log('Add to project:', sessionId)
  }

  // Handle viewing a knowledge artifact from the Knowledge Core
  const handleViewKnowledgeArtifact = (artifact) => {
    // Convert Knowledge Core artifact to panel artifact format
    const panelArtifact = {
      id: artifact.id || `kc_${Date.now()}`,
      name: artifact.title,
      title: artifact.title,
      type: 'markdown',
      file_extension: '.md',
      renderable: true,
      version: 1,
      created_at: artifact.created_at || new Date().toISOString(),
      content: artifact.content,
      size: artifact.content?.length || 0,
      source: 'knowledge_core',
      author: artifact.author
    }

    // Add to artifacts and open in panel
    if (onArtifactCreated) {
      onArtifactCreated(panelArtifact)
    }
    if (onOpenArtifactInPanel) {
      onOpenArtifactInPanel(panelArtifact)
    }
  }

  return (
    <div className="flex flex-col h-full relative">
      {/* Title bar - only show when there's an active session */}
      {currentSession && (
        <ChatTitleBar
          onDelete={handleDelete}
          onAddToProject={handleAddToProject}
          artifactsCount={artifactsCount}
          onToggleArtifacts={onToggleArtifacts}
          showArtifacts={showArtifacts}
        />
      )}


      {/* Messages area - max-w-3xl centered */}
      <div className="flex-1 overflow-y-auto">
        <div className="flex flex-col mx-auto max-w-3xl size-full md:px-2">
          {isLoadingMessages ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 mx-auto mb-4" style={{ borderColor: '#CD477E' }} />
                <p style={{color: 'var(--text-muted)'}} className="text-sm">
                  Loading conversation...
                </p>
              </div>
            </div>
          ) : messages.length === 0 && !isStreaming ? (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <h2 className="text-2xl font-normal mb-2" style={{color: 'var(--text-primary)'}}>
                  Let's get started...
                </h2>
                <p style={{color: 'var(--text-muted)'}} className="text-sm">
                  Start a conversation to begin your research
                </p>
              </div>
            </div>
          ) : messages.length === 0 && isStreaming ? (
            <div className="w-full pb-32 pt-4 px-4">
              <StreamingIndicator streamKey={currentSessionId} />
            </div>
          ) : (
            <div className="w-full pb-32 pt-4">
              {messages.map((message, index) => (
                <MessageBubble
                  key={message.id || index}
                  message={message}
                  isStreaming={message.isStreaming && isStreaming}
                  steps={message.role === 'assistant' ? message.thinkingSteps : null}
                  showSteps={message.thinkingSteps && message.thinkingSteps.length > 0}
                  fontFamily={fontFamilies[chatFont] || fontFamilies.default}
                  onOpenArtifactInPanel={onOpenArtifactInPanel}
                  onViewKnowledgeArtifact={handleViewKnowledgeArtifact}
                  streamingArtifact={message.isStreaming ? currentStreamingArtifact : null}
                />
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
      </div>

      {/* Input area - Floating at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 pt-6 pb-3"
        style={{
          background: `linear-gradient(to top, var(--bg-primary) 0%, var(--bg-primary) 70%, transparent 100%)`
        }}
      >
        <div className="max-w-3xl mx-auto px-4">
          {isStreaming && (
            <div className="flex justify-center mb-2">
              <button
                onClick={handleStop}
                className="flex items-center gap-2 px-3 py-1.5 rounded-full transition-colors"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderWidth: '1px',
                  borderColor: 'var(--border-color)',
                  borderOpacity: 'var(--border-opacity)'
                }}
              >
                <StopCircle size={14} className="text-red-400" />
                <span className="text-[13px]" style={{ color: 'var(--text-primary)' }}>
                  Stop generating
                </span>
              </button>
            </div>
          )}
          <ChatInput
            onSend={handleSend}
            disabled={isStreaming}
            placeholder={messages.length === 0 ? "let's build something amazing..." : "Reply..."}
          />
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, isStreaming, steps, showSteps, fontFamily, onOpenArtifactInPanel, onViewKnowledgeArtifact, streamingArtifact }) {
  const isUser = message.role === 'user'

  // Parse message for artifacts (memoized to avoid re-parsing on every render)
  // CRITICAL: Skip parsing during streaming to avoid duplicate key issues
  // The streaming artifact is tracked separately via streamingArtifact prop
  const { artifacts, modifiedContent } = useMemo(() => {
    if (isUser || !message.content) {
      return { artifacts: [], modifiedContent: message.content || '' }
    }
    // Don't parse during streaming - the raw artifact tags will show,
    // but we're displaying the StreamingArtifactCard separately
    if (isStreaming) {
      return { artifacts: [], modifiedContent: message.content || '' }
    }
    return parseMessageForArtifacts(message.content)
  }, [message.content, isUser, isStreaming])

  // Helper to clean artifact tags from streaming content
  // This removes the visible <artifact> tags and their incomplete content during streaming
  const cleanStreamingContent = (content) => {
    if (!content) return content
    // Remove complete <artifact ...>...</artifact> tags
    let cleaned = content.replace(/<artifact\s+[^>]*>[\s\S]*?<\/artifact>/gi, '')
    // Remove incomplete <artifact ...> tags (no closing tag)
    cleaned = cleaned.replace(/<artifact\s+[^>]*>[\s\S]*$/gi, '')
    return cleaned.trim()
  }

  // Render content with artifact placeholders replaced by InlineArtifact components
  const renderContentWithArtifacts = () => {
    // Shared markdown components for consistent styling
    const markdownComponents = {
      p: ({node, ...props}) => <p className="mb-5 last:mb-0 first:mt-0" {...props} />,
      h1: ({node, ...props}) => <h1 className="text-[19px] font-semibold mb-3 mt-6 first:mt-0" style={{color: 'var(--text-primary)'}} {...props} />,
      h2: ({node, ...props}) => <h2 className="text-[17px] font-semibold mb-3 mt-5 first:mt-0" style={{color: 'var(--text-primary)'}} {...props} />,
      h3: ({node, ...props}) => <h3 className="text-[15px] font-semibold mb-2 mt-4 first:mt-0" style={{color: 'var(--text-primary)'}} {...props} />,
      ul: ({node, ...props}) => <ul className="list-disc ml-5 mb-4 mt-1" {...props} />,
      ol: ({node, ...props}) => <ol className="list-decimal ml-5 mb-4 mt-1" {...props} />,
      li: ({node, ...props}) => <li className="mb-1.5 leading-[1.6]" {...props} />,
      strong: ({node, ...props}) => <strong className="font-semibold" style={{color: 'var(--text-primary)'}} {...props} />,
      em: ({node, ...props}) => <em className="italic" {...props} />,
      code: ({node, inline, ...props}) =>
        inline
          ? <code className="text-[#f97316] px-1.5 py-0.5 rounded text-[13px]" style={{fontFamily: 'ui-monospace, monospace', backgroundColor: 'var(--bg-secondary)'}} {...props} />
          : <code className="block rounded-lg p-4 overflow-x-auto text-[13px] my-4" style={{fontFamily: 'ui-monospace, monospace', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)', borderWidth: '1px', borderColor: 'var(--border-color)'}} {...props} />,
      blockquote: ({node, ...props}) => <blockquote className="border-l-2 pl-4 my-4 italic" style={{borderColor: 'var(--text-muted)', color: 'var(--text-muted)'}} {...props} />,
      // Table styling for GFM tables
      table: ({node, ...props}) => (
        <div className="overflow-x-auto my-4">
          <table className="min-w-full border-collapse text-[14px]" style={{borderColor: 'var(--border-color)'}} {...props} />
        </div>
      ),
      thead: ({node, ...props}) => <thead style={{backgroundColor: 'var(--bg-tertiary)'}} {...props} />,
      tbody: ({node, ...props}) => <tbody {...props} />,
      tr: ({node, ...props}) => <tr style={{borderBottomWidth: '1px', borderColor: 'var(--border-color)'}} {...props} />,
      th: ({node, ...props}) => <th className="px-4 py-2 text-left font-semibold" style={{color: 'var(--text-primary)', borderWidth: '1px', borderColor: 'var(--border-color)'}} {...props} />,
      td: ({node, ...props}) => <td className="px-4 py-2" style={{color: 'var(--text-secondary)', borderWidth: '1px', borderColor: 'var(--border-color)'}} {...props} />,
    }

    if (artifacts.length === 0) {
      // During streaming, clean out artifact tags from visible content
      const displayContent = isStreaming ? cleanStreamingContent(message.content) : message.content
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {displayContent || ' '}
        </ReactMarkdown>
      )
    }

    // Split content by artifact placeholders and render
    // The placeholder format is __ARTIFACT_art_HASH__ or __ARTIFACT_inline_art_TIMESTAMP_INDEX__ (legacy)
    const parts = modifiedContent.split(/(__ARTIFACT_(?:inline_art_\d+_\d+|art_[a-z0-9]+)__)/)
    return parts.map((part, index) => {
      // Check if this part is an artifact placeholder (both new and legacy formats)
      const artifactMatch = part.match(/__ARTIFACT_((?:inline_art_\d+_\d+|art_[a-z0-9]+))__/)
      if (artifactMatch) {
        const artifact = artifacts.find(a => a.id === artifactMatch[1])
        if (artifact) {
          return (
            <InlineArtifact
              key={artifact.id}
              artifact={artifact}
              onOpenInPanel={onOpenArtifactInPanel}
            />
          )
        }
      }
      // Regular text - render with markdown
      // Use message.id + index for unique key during streaming
      if (part.trim()) {
        return (
          <ReactMarkdown
            key={`${message.id}-part-${index}`}
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {part}
          </ReactMarkdown>
        )
      }
      return null
    })
  }

  if (isUser) {
    return (
      <div className="w-full flex justify-end px-4 py-2">
        <div className="rounded-[18px] px-4 py-2 max-w-lg" style={{ backgroundColor: 'var(--bg-user-bubble)' }}>
          {message.files && message.files.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-2">
              {message.files.map((file, idx) => (
                <MessageFileCard key={idx} file={file} />
              ))}
            </div>
          )}
          {message.content && (
            <p
              className="text-[14px] font-normal whitespace-pre-wrap leading-5"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
              }}
            >
              {message.content}
            </p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="w-full px-4 py-3">
      {/* Thinking Steps - only shown when extended thinking is enabled */}
      {showSteps && steps && steps.length > 0 && (
        <ThinkingSteps steps={steps} onViewArtifact={onViewKnowledgeArtifact} />
      )}
      {/* Always render content if we have any */}
      {message.content && message.content.trim() !== '' && (
        <div
          className="text-[15px] font-normal leading-[1.6]"
          style={{
            color: 'var(--text-secondary)',
            fontFamily: fontFamily
          }}
        >
          {renderContentWithArtifacts()}
          {/* Show streaming artifact card inline at the end of content during artifact creation */}
          {isStreaming && streamingArtifact && (
            <StreamingArtifactCard
              artifact={streamingArtifact}
              onOpenInPanel={onOpenArtifactInPanel}
            />
          )}
        </div>
      )}
      {/* If no content yet but streaming an artifact, show the card */}
      {isStreaming && streamingArtifact && (!message.content || message.content.trim() === '') && (
        <StreamingArtifactCard
          artifact={streamingArtifact}
          onOpenInPanel={onOpenArtifactInPanel}
        />
      )}
      {/* Show streaming indicator below content while streaming */}
      {isStreaming && (
        <StreamingIndicator streamKey={message.id} />
      )}
    </div>
  )
}

export default ChatView

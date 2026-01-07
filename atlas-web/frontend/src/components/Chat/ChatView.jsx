import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { StopCircle } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useChatStore } from '../../hooks/useChatStore'
import { chatService, sessionsService } from '../../services/chatService'
import ChatInput from './ChatInput'
import ChatTitleBar from './ChatTitleBar'
import ThinkingSteps from './ThinkingSteps'
import StreamingIndicator from './StreamingIndicator'
import InlineArtifact, { parseMessageForArtifacts, extractTitleFromContent } from '../Artifacts/InlineArtifact'

function ChatView({ onToggleArtifacts, artifactsCount = 0, onArtifactCreated, onOpenArtifactInPanel, onArtifactStreaming, showArtifacts = false, onArtifactsDetected }) {
  const { sessionId, projectId } = useParams()
  const navigate = useNavigate()
  const [isStreaming, setIsStreaming] = useState(false)
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
      tempSessionId = createSession()
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
        streamingArtifactRef.current = {
          id: artifact.id,
          name: info.name,
          title: info.name,
          type: artifact.type,
          file_extension: info.ext,
          renderable: true,
          version: 1,
          created_at: new Date().toISOString(),
          content: ''
        }
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
          onArtifactStreaming(updatedArtifact)
        }
      } else if (artifactEvent.event === 'complete') {
        console.log('Artifact complete event received')
        // Finalize the artifact with content from the backend event
        const artifact = artifactEvent.artifact
        const content = artifact?.content || artifactContentRef.current
        if (onArtifactCreated) {
          // Extract title from the content
          const artifactType = artifact?.type || streamingArtifactRef.current?.type || 'markdown'
          const extractedTitle = extractTitleFromContent(
            content,
            artifactType,
            artifact?.title || artifact?.name || streamingArtifactRef.current?.name
          )
          const finalArtifact = {
            id: artifact?.id || streamingArtifactRef.current?.id || `artifact_${Date.now()}`,
            name: extractedTitle,
            title: extractedTitle,
            type: artifactType,
            content: content,
            size: content.length,
            file_extension: streamingArtifactRef.current?.file_extension || `.${artifactType}`,
            renderable: true,
            version: 1,
            created_at: new Date().toISOString()
          }
          console.log('Creating final artifact:', finalArtifact.id, 'with title:', extractedTitle)
          onArtifactCreated(finalArtifact)
          streamingArtifactRef.current = null
          artifactContentRef.current = ''
        }
      }
    }

    // Update streaming artifact content (extracts content from code block)
    const updateStreamingArtifact = (fullContent) => {
      if (!streamingArtifactRef.current) return

      // Find the content after the opening ``` tag
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
          (chunk) => {
            // Mark processing as done when we start receiving content
            thinkingStepsRef.current = thinkingStepsRef.current.map(step =>
              step.type === 'processing' ? { ...step, loading: false } : step
            )
            setThinkingSteps([...thinkingStepsRef.current])
            fullResponseRef.current += chunk
            updateLastMessage(prev => prev + chunk)
            // Update streaming artifact content if backend initiated one
            if (streamingArtifactRef.current) {
              updateStreamingArtifact(fullResponseRef.current)
            }
          },
          (result) => {
            setIsStreaming(false)
            setMessageStreaming(false)

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
          (chunk) => {
            fullResponseRef.current += chunk
            updateLastMessage(prev => prev + chunk)
            // Update streaming artifact content if backend initiated one
            if (streamingArtifactRef.current) {
              updateStreamingArtifact(fullResponseRef.current)
            }
          },
          (result) => {
            setIsStreaming(false)
            setMessageStreaming(false)

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

function MessageBubble({ message, isStreaming, steps, showSteps, fontFamily, onOpenArtifactInPanel, onViewKnowledgeArtifact }) {
  const isUser = message.role === 'user'

  // Parse message for artifacts (memoized to avoid re-parsing on every render)
  const { artifacts, modifiedContent } = useMemo(() => {
    if (isUser || !message.content) {
      return { artifacts: [], modifiedContent: message.content || '' }
    }
    return parseMessageForArtifacts(message.content)
  }, [message.content, isUser])

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
      return (
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={markdownComponents}
        >
          {message.content || ' '}
        </ReactMarkdown>
      )
    }

    // Split content by artifact placeholders and render
    // The placeholder format is __ARTIFACT_inline_art_TIMESTAMP_INDEX__
    const parts = modifiedContent.split(/(__ARTIFACT_inline_art_\d+_\d+__)/)
    return parts.map((part, index) => {
      // Check if this part is an artifact placeholder
      const artifactMatch = part.match(/__ARTIFACT_(inline_art_\d+_\d+)__/)
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
                file.previewUrl ? (
                  <img
                    key={idx}
                    src={file.previewUrl}
                    alt={file.name}
                    className="w-16 h-16 object-cover rounded-lg"
                    style={{ borderWidth: '1px', borderColor: 'var(--border-color)' }}
                    title={file.name}
                  />
                ) : (
                  <span
                    key={idx}
                    className="text-[11px] px-2 py-1 rounded-full"
                    style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-muted)' }}
                  >
                    {file.name}
                  </span>
                )
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
        </div>
      )}
      {/* Show streaming indicator below content while streaming */}
      {isStreaming && (
        <StreamingIndicator streamKey={message.id} />
      )}
    </div>
  )
}

export default ChatView

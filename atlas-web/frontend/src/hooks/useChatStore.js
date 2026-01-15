import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useChatStore = create(
  persist(
    (set, get) => ({
      // Hydration state
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),

      // Messages stored per session: { sessionId: [messages] }
      messagesBySession: {},
      sessions: [],
      projects: [],
      currentSessionId: null,

      // Semantic memory context per project: { projectId: { semanticMemoryCount, relevantConversationsCount, lastUpdated } }
      projectMemoryContext: {},

      // Helper function to get current messages
      getMessages: () => {
        const state = get()
        return state.messagesBySession[state.currentSessionId] || []
      },

      // Input state
      pendingFiles: [],
      selectedModel: 'haiku', // Default model - model selection disabled
      webSearchEnabled: true,
      extendedThinkingEnabled: false,
      knowledgeCoreEnabled: true,  // Knowledge Core semantic search enabled by default
      enabledConnectors: [],
      availableConnectors: [
        { id: 'confluence', name: 'Confluence', icon: '📄' },
        { id: 'jira', name: 'Jira', icon: '🎫' },
        { id: 'gitlab', name: 'GitLab', icon: '🦊' },
      ],

      // User settings
      user: {
        name: 'Adam M Fisher',
        initials: 'AM',
        plan: 'Ally ID: WZYN80'
      },

      // Appearance settings
      colorMode: 'dark', // 'light', 'auto', 'dark'
      chatFont: 'default', // 'default', 'sans', 'system', 'dyslexic'

      // Computed - get current session
      get currentSession() {
        const state = get()
        return state.sessions.find(s => s.id === state.currentSessionId) || null
      },

      // Actions - Session
      setCurrentSession: (sessionId) => set({ currentSessionId: sessionId }),

      createSession: (title = null, projectId = null) => {
        const sessionId = `session_${Date.now()}`
        const session = {
          id: sessionId,
          title: title || null,
          starred: false,
          projectId: projectId || null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        }
        set((state) => ({
          sessions: [session, ...state.sessions],
          currentSessionId: sessionId,
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: []
          }
        }))
        return sessionId
      },

      updateSessionTitle: (sessionId, title) => set((state) => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId
            ? { ...s, title, updatedAt: new Date().toISOString() }
            : s
        )
      })),

      toggleSessionStar: (sessionId) => set((state) => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId
            ? { ...s, starred: !s.starred, updatedAt: new Date().toISOString() }
            : s
        )
      })),

      deleteSession: (sessionId) => set((state) => {
        const newSessions = state.sessions.filter(s => s.id !== sessionId)
        const isCurrentSession = state.currentSessionId === sessionId
        // Remove messages for deleted session
        const { [sessionId]: _, ...restMessages } = state.messagesBySession
        return {
          sessions: newSessions,
          currentSessionId: isCurrentSession ? null : state.currentSessionId,
          messagesBySession: restMessages
        }
      }),

      addSessionToProject: (sessionId, projectId) => set((state) => ({
        sessions: state.sessions.map(s =>
          s.id === sessionId
            ? { ...s, projectId, updatedAt: new Date().toISOString() }
            : s
        )
      })),

      // Actions - Messages
      addMessage: (message) => set((state) => {
        const sessionId = state.currentSessionId
        if (!sessionId) return state
        const currentMessages = state.messagesBySession[sessionId] || []
        // Use timestamp + random suffix to ensure unique IDs even for rapid additions
        const uniqueId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: [...currentMessages, {
              ...message,
              id: uniqueId,
              timestamp: new Date().toISOString()
            }]
          }
        }
      }),

      updateLastMessage: (updater, keepStreaming = true) => set((state) => {
        const sessionId = state.currentSessionId
        if (!sessionId) return state
        const messages = [...(state.messagesBySession[sessionId] || [])]
        if (messages.length > 0) {
          const last = messages[messages.length - 1]
          messages[messages.length - 1] = {
            ...last,
            content: typeof updater === 'function' ? updater(last.content) : updater,
            isStreaming: keepStreaming ? last.isStreaming : false
          }
        }
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: messages
          }
        }
      }),

      setMessageStreaming: (isStreaming) => set((state) => {
        const sessionId = state.currentSessionId
        if (!sessionId) return state
        const messages = [...(state.messagesBySession[sessionId] || [])]
        if (messages.length > 0) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            isStreaming
          }
        }
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: messages
          }
        }
      }),

      updateLastMessageThinkingSteps: (thinkingSteps) => set((state) => {
        const sessionId = state.currentSessionId
        if (!sessionId) return state
        const messages = [...(state.messagesBySession[sessionId] || [])]
        if (messages.length > 0) {
          messages[messages.length - 1] = {
            ...messages[messages.length - 1],
            thinkingSteps
          }
        }
        return {
          messagesBySession: {
            ...state.messagesBySession,
            [sessionId]: messages
          }
        }
      }),

      clearMessages: () => set({ currentSessionId: null }),

      // File upload error state
      fileUploadError: null,
      setFileUploadError: (error) => set({ fileUploadError: error }),
      clearFileUploadError: () => set({ fileUploadError: null }),

      // Actions - Files
      addPendingFile: (file) => set((state) => {
        // Clear any previous error
        const clearError = { fileUploadError: null }

        // Check limits
        if (state.pendingFiles.length >= 20) {
          return { ...state, fileUploadError: 'Maximum 20 files allowed' }
        }
        if (file.size > 30 * 1024 * 1024) {
          return { ...state, fileUploadError: 'File exceeds 30MB limit' }
        }

        // Validate file type
        const ext = file.name?.split('.').pop()?.toLowerCase()
        const mimeType = file.type?.toLowerCase() || ''

        // Supported file extensions
        const supportedExtensions = [
          // Text-based formats
          'txt', 'md',
          // Code files
          'py', 'js', 'jsx', 'ts', 'tsx', 'java', 'cpp', 'c', 'h', 'hpp',
          'cs', 'go', 'rb', 'php', 'swift', 'kt', 'rs', 'scala', 'sql',
          'sh', 'bash', 'zsh', 'ps1', 'bat', 'cmd',
          // Data formats
          'json', 'xml', 'csv', 'tsv', 'yaml', 'yml',
          // Web
          'html', 'htm', 'css', 'scss', 'sass', 'less',
          // Documents
          'pdf', 'docx',
          // Images
          'png', 'jpg', 'jpeg', 'gif', 'webp'
        ]

        // Check by extension
        if (!supportedExtensions.includes(ext)) {
          return {
            ...state,
            fileUploadError: `Unsupported file type: .${ext}. Supported formats: text files (.txt, .md), code files, JSON, XML, CSV, TSV, HTML, PDF (.pdf), Word (.docx), and images (.png, .jpg, .gif, .webp)`
          }
        }

        return { ...clearError, pendingFiles: [...state.pendingFiles, file] }
      }),

      removePendingFile: (index) => set((state) => ({
        pendingFiles: state.pendingFiles.filter((_, i) => i !== index)
      })),

      clearPendingFiles: () => set({ pendingFiles: [] }),

      // Actions - Model
      setSelectedModel: (model) => set({ selectedModel: model }),

      // Actions - Features
      setWebSearchEnabled: (enabled) => set({ webSearchEnabled: enabled }),
      setExtendedThinkingEnabled: (enabled) => set({ extendedThinkingEnabled: enabled }),
      setKnowledgeCoreEnabled: (enabled) => set({ knowledgeCoreEnabled: enabled }),

      // Actions - Connectors
      toggleConnector: (connectorId) => set((state) => {
        const current = state.enabledConnectors
        if (current.includes(connectorId)) {
          return { enabledConnectors: current.filter(id => id !== connectorId) }
        } else {
          return { enabledConnectors: [...current, connectorId] }
        }
      }),

      setAvailableConnectors: (connectors) => set({ availableConnectors: connectors }),

      // Actions - Sessions/Projects
      setSessions: (sessions) => set({ sessions }),

      addSession: (session) => set((state) => ({
        sessions: [session, ...state.sessions]
      })),

      setProjects: (projects) => set({ projects }),

      addProject: (project) => set((state) => ({
        projects: [...state.projects, project]
      })),

      updateProject: (projectId, updates) => set((state) => ({
        projects: state.projects.map(p =>
          p.id === projectId ? { ...p, ...updates } : p
        )
      })),

      deleteProject: (projectId) => set((state) => ({
        projects: state.projects.filter(p => p.id !== projectId),
        sessions: state.sessions.map(s =>
          s.projectId === projectId ? { ...s, projectId: null } : s
        )
      })),

      // Load session messages (now just switches session since messages are persisted)
      loadSession: (sessionId) => {
        set({ currentSessionId: sessionId })
      },

      // Set messages for a specific session (used when loading from backend)
      setSessionMessages: (sessionId, messages) => set((state) => ({
        messagesBySession: {
          ...state.messagesBySession,
          [sessionId]: messages
        }
      })),

      // Actions - Appearance
      setColorMode: (mode) => set({ colorMode: mode }),
      setChatFont: (font) => set({ chatFont: font }),

      // Actions - Project Memory Context
      setProjectMemoryContext: (projectId, context) => set((state) => ({
        projectMemoryContext: {
          ...state.projectMemoryContext,
          [projectId]: {
            ...context,
            lastUpdated: new Date().toISOString()
          }
        }
      })),

      // Clear project memory context (on logout, etc.)
      clearProjectMemoryContext: (projectId = null) => set((state) => {
        if (projectId) {
          const { [projectId]: _, ...rest } = state.projectMemoryContext
          return { projectMemoryContext: rest }
        }
        return { projectMemoryContext: {} }
      }),
    }),
    {
      name: 'ally-chat-store',
      version: 1,
      partialize: (state) => ({
        sessions: state.sessions,
        projects: state.projects,
        messagesBySession: state.messagesBySession,
        currentSessionId: state.currentSessionId,
        selectedModel: state.selectedModel,
        colorMode: state.colorMode,
        chatFont: state.chatFont,
      }),
      onRehydrateStorage: () => (state) => {
        console.log('Hydrated state:', {
          sessionsCount: state?.sessions?.length,
          currentSessionId: state?.currentSessionId
        })
        state?.setHasHydrated(true)
      },
    }
  )
)

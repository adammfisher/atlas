import React, { useState, useEffect, useCallback } from 'react'
import { BrowserRouter, Routes, Route, useParams } from 'react-router-dom'
import Sidebar from './components/ProjectSidebar/Sidebar'
import ChatView from './components/Chat/ChatView'
import InsightsBubble from './components/InsightsBubble/InsightsBubble'
import ArtifactsPanel from './components/Artifacts/ArtifactsPanel'
import ProjectDetailView from './components/Project/ProjectDetailView'
import ProjectsListPage from './components/Project/ProjectsListPage'
import ArtifactsListPage from './components/Artifacts/ArtifactsListPage'
import { useChatStore } from './hooks/useChatStore'
import { insightsService } from './services/insightsService'
import { useInsightsStore } from './hooks/useInsightsStore'
import { AuthProvider, useAuth } from './context/AuthContext'
import LoginPage from './components/Auth/LoginPage'

// Wrapper component that can access route params and manage artifacts
function ChatWithArtifacts({ showArtifacts, toggleArtifacts, localArtifacts, setLocalArtifacts, selectedArtifact, setSelectedArtifact, streamingArtifact, setStreamingArtifact, setShowArtifactsDirectly, fontFamily, onFileSavedToProject }) {
  const { sessionId, projectId } = useParams()
  const fetchInsights = useInsightsStore(state => state.fetchInsights)

  const handleArtifactCreated = useCallback((artifact) => {
    console.log('[App] handleArtifactCreated called:', artifact.id, 'title:', artifact.title, 'content length:', artifact.content?.length)
    // Add or update local artifacts using stable ID matching
    setLocalArtifacts(prev => {
      const existingIndex = prev.findIndex(a => a.id === artifact.id)
      if (existingIndex >= 0) {
        // Update existing artifact - increment version
        const existing = prev[existingIndex]
        const updated = {
          ...artifact,
          version: (existing.version || 1) + 1,
          created_at: existing.created_at,
          updated_at: new Date().toISOString()
        }
        console.log('[App] Updating existing artifact:', artifact.id, 'to version:', updated.version)
        const newList = [...prev]
        newList[existingIndex] = updated
        return newList
      }
      // Add new artifact
      console.log('[App] Adding new artifact:', artifact.id)
      return [...prev, artifact]
    })
    // Clear streaming artifact when complete
    console.log('[App] Clearing streamingArtifact (setting to null)')
    setStreamingArtifact(null)
    // Set as selected so it stays in view
    console.log('[App] Setting selectedArtifact to:', artifact.id)
    setSelectedArtifact(artifact)

    // Send artifact to Insights API for potential sharing to Knowledge Core
    // Only send if artifact has substantial content (not just a placeholder)
    // Skip artifacts that already come from Knowledge Core (they're already shared)
    if (artifact.content && artifact.content.length > 50 && artifact.source !== 'knowledge_core') {
      console.log('Sending artifact to Insights:', artifact.title || artifact.name)
      insightsService.addArtifactInsight(
        {
          id: artifact.id,
          title: artifact.title || artifact.name,
          name: artifact.name,
          type: artifact.type,
          content: artifact.content
        },
        sessionId,
        null // messageId not available here
      ).then(() => {
        console.log('Artifact added to Insights')
        // Refresh insights to update the bubble
        fetchInsights()
      }).catch(err => {
        console.error('Failed to add artifact to Insights:', err)
      })
    }
  }, [setLocalArtifacts, setStreamingArtifact, setSelectedArtifact, sessionId, fetchInsights])

  const handleOpenArtifactInPanel = useCallback((artifact) => {
    console.log('Opening artifact in panel:', artifact)
    // Add to local artifacts if not already there
    setLocalArtifacts(prev => {
      if (prev.find(a => a.id === artifact.id)) return prev
      return [...prev, artifact]
    })
    // Set as selected artifact
    setSelectedArtifact(artifact)
    // Make sure panel is open
    if (!showArtifacts) {
      toggleArtifacts()
    }
  }, [setLocalArtifacts, setSelectedArtifact, showArtifacts, toggleArtifacts])

  // Handler for when artifact starts streaming - opens panel and shows preview
  const handleArtifactStreaming = useCallback((artifact) => {
    console.log('Artifact streaming:', artifact)
    console.log('setShowArtifactsDirectly available:', !!setShowArtifactsDirectly)
    setStreamingArtifact(artifact)
    // Force open the artifacts panel when streaming starts
    if (setShowArtifactsDirectly) {
      console.log('Setting showArtifacts to true')
      setShowArtifactsDirectly(true)
    }
  }, [setStreamingArtifact, setShowArtifactsDirectly])

  // Track which artifacts have been sent to insights (to avoid duplicates)
  const sentToInsightsRef = React.useRef(new Set())
  // Track previously known artifact count to detect NEW artifacts
  const prevArtifactCountRef = React.useRef(0)

  // Handler for when artifacts are detected in loaded messages
  // Uses stable IDs to properly merge/update artifacts
  const handleArtifactsDetected = useCallback((detectedArtifacts) => {
    console.log('Detected artifacts in messages:', detectedArtifacts.length)

    // Merge detected artifacts with existing ones using stable IDs
    setLocalArtifacts(prev => {
      const artifactMap = new Map()

      // First, add all existing artifacts to the map
      prev.forEach(a => artifactMap.set(a.id, a))

      // Then, update or add detected artifacts
      // Artifacts with same ID should be updated (keeping the latest version)
      let hasChanges = false
      detectedArtifacts.forEach(detected => {
        const existing = artifactMap.get(detected.id)
        if (existing) {
          // Update if content changed (new version)
          if (existing.content !== detected.content) {
            artifactMap.set(detected.id, {
              ...detected,
              version: (existing.version || 1) + 1,
              created_at: existing.created_at,
              updated_at: new Date().toISOString()
            })
            hasChanges = true
            console.log('Artifact updated:', detected.title, 'to version:', (existing.version || 1) + 1)
          }
        } else {
          // New artifact
          artifactMap.set(detected.id, detected)
          hasChanges = true
        }
      })

      // Convert map back to array, maintaining order
      const result = Array.from(artifactMap.values())
      return result
    })

    // Check if there are NEW artifacts (count increased)
    const hasNewArtifacts = detectedArtifacts.length > prevArtifactCountRef.current
    prevArtifactCountRef.current = detectedArtifacts.length

    // Send NEW artifacts to insights API (only those not already sent)
    // Skip artifacts from Knowledge Core (they're already shared)
    detectedArtifacts.forEach(artifact => {
      if (artifact.content && artifact.content.length > 50 && !sentToInsightsRef.current.has(artifact.id) && artifact.source !== 'knowledge_core') {
        sentToInsightsRef.current.add(artifact.id)
        console.log('Sending detected artifact to Insights:', artifact.title || artifact.name)
        insightsService.addArtifactInsight(
          {
            id: artifact.id,
            title: artifact.title || artifact.name,
            name: artifact.name,
            type: artifact.type,
            content: artifact.content
          },
          sessionId,
          null
        ).then(() => {
          console.log('Artifact added to Insights')
          fetchInsights()
        }).catch(err => {
          console.error('Failed to add artifact to Insights:', err)
          // Remove from sent set so it can be retried
          sentToInsightsRef.current.delete(artifact.id)
        })
      }
    })

    // If new artifacts were detected, auto-select the latest one and open the panel
    if (hasNewArtifacts && detectedArtifacts.length > 0) {
      const latestArtifact = detectedArtifacts[detectedArtifacts.length - 1]
      console.log('Auto-selecting new artifact:', latestArtifact.title || latestArtifact.name)
      setSelectedArtifact(latestArtifact)
      // Open the artifacts panel to show the viewer
      if (setShowArtifactsDirectly) {
        setShowArtifactsDirectly(true)
      }
    }
  }, [setLocalArtifacts, sessionId, fetchInsights, setSelectedArtifact, setShowArtifactsDirectly])

  return (
    <div className="flex h-full w-full">
      <div className="flex-1 flex flex-col overflow-hidden">
        <ChatView
          onToggleArtifacts={toggleArtifacts}
          artifactsCount={localArtifacts.length}
          existingArtifacts={localArtifacts}
          onArtifactCreated={handleArtifactCreated}
          onOpenArtifactInPanel={handleOpenArtifactInPanel}
          onArtifactStreaming={handleArtifactStreaming}
          showArtifacts={showArtifacts}
          onArtifactsDetected={handleArtifactsDetected}
        />
      </div>
      <ArtifactsPanel
        sessionId={sessionId}
        projectId={projectId}
        artifacts={localArtifacts}
        isVisible={showArtifacts}
        onClose={() => toggleArtifacts()}
        selectedArtifact={selectedArtifact}
        onSelectArtifact={setSelectedArtifact}
        streamingArtifact={streamingArtifact}
        fontFamily={fontFamily}
        onFileSaved={onFileSavedToProject}
      />
    </div>
  )
}

// Font family mapping (shared with ChatView)
const fontFamilies = {
  default: '"Merriweather", Georgia, "Times New Roman", Times, serif',
  poppins: '"Poppins", sans-serif',
  lato: '"Lato", sans-serif',
  sans: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
}

// Loading spinner component
function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="text-center">
        <svg className="animate-spin h-12 w-12 text-blue-500 mx-auto mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <p className="text-gray-400">Loading...</p>
      </div>
    </div>
  )
}

// Main authenticated app content
function AuthenticatedApp() {
  // Use individual selectors for better reactivity
  const colorMode = useChatStore(state => state.colorMode)
  const currentSessionId = useChatStore(state => state.currentSessionId)
  const chatFont = useChatStore(state => state.chatFont)

  // Artifacts panel visibility state
  const [showArtifacts, setShowArtifacts] = useState(false)

  // Local artifacts (detected on frontend)
  const [localArtifacts, setLocalArtifacts] = useState([])

  // Currently selected artifact for viewing in panel
  const [selectedArtifact, setSelectedArtifact] = useState(null)

  // Currently streaming artifact (shown in panel during creation)
  const [streamingArtifact, setStreamingArtifact] = useState(null)

  const toggleArtifacts = useCallback(() => {
    setShowArtifacts(prev => !prev)
  }, [])

  // Reset artifacts when session changes
  useEffect(() => {
    setLocalArtifacts([])
    setSelectedArtifact(null)
    setStreamingArtifact(null)
  }, [currentSessionId])

  // Apply color mode to the document
  useEffect(() => {
    console.log('[App] Color mode effect triggered:', colorMode)

    const root = document.documentElement

    // Remove existing color mode classes
    root.classList.remove('light-mode', 'dark-mode')

    console.log('[App] Applying color mode:', colorMode)

    if (colorMode === 'light') {
      root.classList.add('light-mode')
      console.log('[App] Added light-mode class')
    } else if (colorMode === 'dark') {
      root.classList.add('dark-mode')
      console.log('[App] Added dark-mode class')
    } else if (colorMode === 'auto') {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
      root.classList.add(prefersDark ? 'dark-mode' : 'light-mode')
      console.log('[App] Added auto mode class:', prefersDark ? 'dark-mode' : 'light-mode')
    }
  }, [colorMode])

  return (
    <div
      className="flex h-screen overflow-x-hidden transition-colors duration-200"
      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
    >
      {/* Sidebar */}
      <Sidebar />

      {/* Main content area - smooth transition when artifacts panel opens */}
      <main className="flex-1 flex overflow-hidden transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]">
        <Routes>
            <Route
              path="/"
              element={
                <ChatWithArtifacts
                  showArtifacts={showArtifacts}
                  toggleArtifacts={toggleArtifacts}
                  localArtifacts={localArtifacts}
                  setLocalArtifacts={setLocalArtifacts}
                  selectedArtifact={selectedArtifact}
                  setSelectedArtifact={setSelectedArtifact}
                  streamingArtifact={streamingArtifact}
                  setStreamingArtifact={setStreamingArtifact}
                  setShowArtifactsDirectly={setShowArtifacts}
                  fontFamily={fontFamilies[chatFont] || fontFamilies.default}
                />
              }
            />
            <Route
              path="/chat/:sessionId"
              element={
                <ChatWithArtifacts
                  showArtifacts={showArtifacts}
                  toggleArtifacts={toggleArtifacts}
                  localArtifacts={localArtifacts}
                  setLocalArtifacts={setLocalArtifacts}
                  selectedArtifact={selectedArtifact}
                  setSelectedArtifact={setSelectedArtifact}
                  streamingArtifact={streamingArtifact}
                  setStreamingArtifact={setStreamingArtifact}
                  setShowArtifactsDirectly={setShowArtifacts}
                  fontFamily={fontFamilies[chatFont] || fontFamilies.default}
                />
              }
            />
            <Route
              path="/projects"
              element={<ProjectsListPage />}
            />
            <Route
              path="/artifacts"
              element={<ArtifactsListPage />}
            />
            <Route
              path="/projects/:projectId"
              element={<ProjectDetailView />}
            />
            <Route
              path="/project/:projectId/settings"
              element={<ProjectDetailView />}
            />
            <Route
              path="/project/:projectId"
              element={
                <ChatWithArtifacts
                  showArtifacts={showArtifacts}
                  toggleArtifacts={toggleArtifacts}
                  localArtifacts={localArtifacts}
                  setLocalArtifacts={setLocalArtifacts}
                  selectedArtifact={selectedArtifact}
                  setSelectedArtifact={setSelectedArtifact}
                  streamingArtifact={streamingArtifact}
                  setStreamingArtifact={setStreamingArtifact}
                  setShowArtifactsDirectly={setShowArtifacts}
                  fontFamily={fontFamilies[chatFont] || fontFamilies.default}
                />
              }
            />
            <Route
              path="/project/:projectId/chat/:sessionId"
              element={
                <ChatWithArtifacts
                  showArtifacts={showArtifacts}
                  toggleArtifacts={toggleArtifacts}
                  localArtifacts={localArtifacts}
                  setLocalArtifacts={setLocalArtifacts}
                  selectedArtifact={selectedArtifact}
                  setSelectedArtifact={setSelectedArtifact}
                  streamingArtifact={streamingArtifact}
                  setStreamingArtifact={setStreamingArtifact}
                  setShowArtifactsDirectly={setShowArtifacts}
                  fontFamily={fontFamilies[chatFont] || fontFamilies.default}
                />
              }
            />
          </Routes>
        </main>

        {/* Insights Bubble - always present at bottom */}
        <InsightsBubble />
      </div>
  )
}

// App wrapper with auth check
function AppContent() {
  const { user, loading } = useAuth()

  if (loading) {
    return <LoadingScreen />
  }

  if (!user) {
    return <LoginPage />
  }

  return <AuthenticatedApp />
}

// Root App component with providers
function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </AuthProvider>
  )
}

export default App

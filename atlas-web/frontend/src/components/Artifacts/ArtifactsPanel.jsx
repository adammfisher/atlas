import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Code, Download, X, Eye, Maximize2, Minimize2, ChevronLeft, Copy, Check, GripVertical, FolderPlus, FileCode, Calendar, Clock } from 'lucide-react'
import { artifactsService, projectsService } from '../../services/chatService'
import {
  MarkdownRenderer,
  HTMLRenderer,
  SVGRenderer,
  MermaidRenderer,
  JSONRenderer,
  CSVRenderer,
  CodeRenderer,
  SlideRenderer
} from './renderers'

const ATLAS_ORANGE = '#E07020'
const MIN_WIDTH = 380
const MAX_WIDTH_PERCENT = 80 // Maximum 80% of screen width
const DEFAULT_WIDTH_PERCENT = 50 // Initial width: 50% of screen

function ArtifactsPanel({ sessionId, projectId, artifacts: propArtifacts = [], isVisible = false, onClose, selectedArtifact, onSelectArtifact, streamingArtifact, fontFamily, onFileSaved }) {
  const [isAnimating, setIsAnimating] = useState(false)
  // Fetched artifacts from backend
  const [fetchedArtifacts, setFetchedArtifacts] = useState([])
  // Artifact content for viewing
  const [artifactContent, setArtifactContent] = useState(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  // Fullscreen state
  const [isFullscreen, setIsFullscreen] = useState(false)
  // View mode: 'preview' or 'source'
  const [activeTab, setActiveTab] = useState('preview')
  // Copy state
  const [copied, setCopied] = useState(false)
  // Panel width state (in pixels) - initialize to 50% of viewport
  const [panelWidth, setPanelWidth] = useState(() => Math.max(MIN_WIDTH, window.innerWidth * (DEFAULT_WIDTH_PERCENT / 100)))
  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  // Save to project state
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  // Track completed artifact to keep viewer open during state transition
  const [completedArtifact, setCompletedArtifact] = useState(null)
  const containerRef = useRef(null)
  const panelRef = useRef(null)

  // Combine prop artifacts (from frontend detection) with fetched artifacts (from backend)
  // Deduplicate by artifact ID to prevent showing the same artifact twice
  const allArtifacts = [...propArtifacts, ...fetchedArtifacts]
  const seenIds = new Set()
  const artifacts = allArtifacts.filter(artifact => {
    const id = artifact.id || artifact.artifactId
    if (!id || seenIds.has(id)) return false
    seenIds.add(id)
    return true
  })

  // Determine what to show - streaming artifact takes priority, then selected, then completed (for transition)
  const displayArtifact = streamingArtifact || selectedArtifact || completedArtifact

  useEffect(() => {
    if (isVisible) {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
    } else {
      setIsAnimating(false)
    }
  }, [isVisible])

  // Fetch artifacts when sessionId changes
  useEffect(() => {
    if (sessionId) {
      fetchArtifacts()
    } else {
      setFetchedArtifacts([])
    }
  }, [sessionId])

  // Also fetch when panel becomes visible
  useEffect(() => {
    if (sessionId && isVisible) {
      fetchArtifacts()
    }
  }, [isVisible])

  // Track whether we're in streaming mode
  const wasStreamingRef = useRef(false)
  // Track the last streaming artifact to detect completion
  const lastStreamingArtifactRef = useRef(null)

  // Handle streaming artifact content updates AND transition to completed
  useEffect(() => {
    console.log('[ArtifactsPanel] streamingArtifact effect:', streamingArtifact?.id, 'content length:', streamingArtifact?.content?.length)

    if (streamingArtifact) {
      // We're actively streaming
      wasStreamingRef.current = true
      lastStreamingArtifactRef.current = streamingArtifact
      // Show preview for markdown (renders progressively), source for other formats
      const isMd = streamingArtifact.file_extension === '.md' || streamingArtifact.type === 'markdown'
      setActiveTab(isMd ? 'preview' : 'source')
      // Always update content when streaming artifact exists, even if content is empty string
      setArtifactContent(streamingArtifact.content || '')
    } else if (wasStreamingRef.current) {
      // Streaming just ended - streamingArtifact went from non-null to null
      console.log('[ArtifactsPanel] Streaming ended! wasStreaming:', wasStreamingRef.current, 'selectedArtifact:', selectedArtifact?.id)
      wasStreamingRef.current = false

      // IMPORTANT: Switch to preview view to show the rendered result
      setActiveTab('preview')

      // CRITICAL: Save the completed artifact to keep the viewer open during state transition
      // This ensures we show the rendered artifact, not the list
      const finalArtifact = selectedArtifact || lastStreamingArtifactRef.current
      if (finalArtifact) {
        console.log('[ArtifactsPanel] Setting completedArtifact to keep viewer open:', finalArtifact.id)
        setCompletedArtifact(finalArtifact)
      }

      // When streaming ends, the selectedArtifact should have the complete content
      // Use it directly if it has content, otherwise keep what we have from streaming
      if (selectedArtifact && selectedArtifact.content) {
        console.log('[ArtifactsPanel] Using selectedArtifact content after streaming ended:', selectedArtifact.content.length, 'chars')
        setArtifactContent(selectedArtifact.content)
      } else if (lastStreamingArtifactRef.current?.content) {
        // Fallback: use the last streamed content if selectedArtifact doesn't have content yet
        console.log('[ArtifactsPanel] Keeping last streaming content:', lastStreamingArtifactRef.current.content.length, 'chars')
        setArtifactContent(lastStreamingArtifactRef.current.content)
      }
      lastStreamingArtifactRef.current = null
    }
  }, [streamingArtifact, streamingArtifact?.content, selectedArtifact])

  // Handle selectedArtifact changes (for non-streaming cases like clicking on list)
  useEffect(() => {
    // Skip if we're currently streaming - the above effect handles that
    if (streamingArtifact || wasStreamingRef.current) {
      return
    }

    console.log('[ArtifactsPanel] selectedArtifact change (non-streaming):', selectedArtifact?.id, 'content:', selectedArtifact?.content?.length, 'completedArtifact:', completedArtifact?.id)

    if (selectedArtifact) {
      loadArtifactContent(selectedArtifact)
      // DON'T clear completedArtifact here - it's needed as a fallback if selectedArtifact gets cleared
      // completedArtifact is only cleared explicitly in handleBackToList
    } else if (!completedArtifact) {
      // Only clear content if we don't have a completed artifact keeping us in viewer mode
      setArtifactContent(null)
    }
  }, [selectedArtifact])

  // Handle fullscreen change events
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }

    document.addEventListener('fullscreenchange', handleFullscreenChange)
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange)

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange)
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange)
    }
  }, [])

  // Handle drag resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return

      const maxWidth = window.innerWidth * (MAX_WIDTH_PERCENT / 100)
      const newWidth = window.innerWidth - e.clientX

      if (newWidth >= MIN_WIDTH && newWidth <= maxWidth) {
        setPanelWidth(newWidth)
      }
    }

    const handleMouseUp = () => {
      setIsDragging(false)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    if (isDragging) {
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging])

  const fetchArtifacts = async () => {
    try {
      const fetched = await artifactsService.listForSession(sessionId)
      setFetchedArtifacts(fetched || [])
    } catch (e) {
      console.error('Failed to fetch artifacts:', e)
      setFetchedArtifacts([])
    }
  }

  const loadArtifactContent = async (artifact) => {
    console.log('[ArtifactsPanel] loadArtifactContent called for:', artifact?.title || artifact?.name, 'has content:', !!artifact?.content, 'content length:', artifact?.content?.length)
    setActiveTab('preview')

    // If artifact already has content (e.g., from streaming), use it directly
    if (artifact.content) {
      console.log('[ArtifactsPanel] Setting content from artifact.content directly')
      setArtifactContent(artifact.content)
      setIsLoadingContent(false)
      return
    }

    // Otherwise, fetch from backend
    console.log('[ArtifactsPanel] Fetching content from backend...')
    setArtifactContent(null)
    setIsLoadingContent(true)

    try {
      if (artifact.render_url) {
        const response = await fetch(`${import.meta.env.VITE_API_URL}${artifact.render_url}`, {
          headers: { 'X-User-Id': 'demo-user' }
        })
        if (response.ok) {
          const content = await response.text()
          setArtifactContent(content)
        }
      } else if (artifact.download_url) {
        const response = await fetch(artifact.download_url)
        if (response.ok) {
          const content = await response.text()
          setArtifactContent(content)
        }
      }
    } catch (e) {
      console.error('Failed to fetch artifact content:', e)
    } finally {
      setIsLoadingContent(false)
    }
  }

  const getTypeLabel = (artifact) => {
    if (!artifact) return 'FILE'
    if (artifact.file_extension) {
      const labels = {
        '.md': 'Markdown',
        '.html': 'HTML',
        '.svg': 'SVG',
        '.slides': 'Slides',
        '.mermaid': 'Diagram',
        '.json': 'JSON',
        '.csv': 'CSV',
        '.jsx': 'React',
        '.js': 'JS',
        '.py': 'Python'
      }
      return labels[artifact.file_extension] || artifact.file_extension.slice(1).toUpperCase()
    }
    return artifact.type?.toUpperCase() || 'FILE'
  }

  const handleView = (artifact) => {
    onSelectArtifact?.(artifact)
  }

  const handleBackToList = () => {
    onSelectArtifact?.(null)
    setArtifactContent(null)
    setCompletedArtifact(null) // Clear completed artifact when explicitly going back to list
  }

  const handleDownload = (artifact) => {
    const content = artifactContent || artifact?.content
    if (content) {
      const mimeTypes = {
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.slides': 'text/html',
        '.json': 'application/json',
        '.csv': 'text/csv'
      }
      const mimeType = mimeTypes[artifact?.file_extension] || 'text/plain'
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = artifact?.file_extension === '.slides'
        ? artifact.name.replace(/\.slides$/, '') + '.html'
        : (artifact?.name || 'artifact') + (artifact?.name?.includes('.') ? '' : (artifact?.file_extension || '.txt'))
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } else if (artifact?.download_url) {
      window.open(artifact.download_url, '_blank')
    }
  }

  const handleCopy = async () => {
    const content = artifactContent || displayArtifact?.content
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleSaveToProject = async () => {
    if (!projectId || !displayArtifact) return

    const content = artifactContent || displayArtifact?.content
    if (!content) return

    setIsSaving(true)
    setSaveSuccess(false)

    try {
      // Build filename from artifact name/title
      let filename = displayArtifact.name || displayArtifact.title || 'artifact'
      // Ensure it has the right extension
      if (displayArtifact.file_extension && !filename.endsWith(displayArtifact.file_extension)) {
        filename = filename + displayArtifact.file_extension
      }

      await projectsService.saveArtifactToProject(projectId, {
        filename,
        content,
        artifactId: displayArtifact.id,
        artifactTitle: displayArtifact.title || displayArtifact.name,
        pinned: false
      })

      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)

      // Notify parent to refresh files list
      onFileSaved?.()
    } catch (err) {
      console.error('Failed to save artifact to project:', err)
    } finally {
      setIsSaving(false)
    }
  }

  const handleDragStart = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  // Toggle fullscreen
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        } else if (containerRef.current?.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
      setIsFullscreen(!isFullscreen)
    }
  }, [isFullscreen])

  // Check if artifact is renderable
  const isRenderable = displayArtifact?.renderable !== false && (
    ['.md', '.html', '.svg', '.mermaid', '.json', '.csv', '.jsx', '.slides'].includes(displayArtifact?.file_extension)
  )

  // Render artifact content
  const renderContent = () => {
    console.log('[ArtifactsPanel] renderContent called:', {
      isLoadingContent,
      streamingArtifact: streamingArtifact?.id,
      artifactContent: artifactContent ? `${artifactContent.length} chars` : null,
      selectedArtifact: selectedArtifact?.id
    })

    if (isLoadingContent && !streamingArtifact) {
      console.log('[ArtifactsPanel] Showing loading spinner (backend fetch)')
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ATLAS_ORANGE }} />
        </div>
      )
    }

    if (!artifactContent && !streamingArtifact) {
      console.log('[ArtifactsPanel] Showing "No content available"')
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
          <p>No content available</p>
        </div>
      )
    }

    // During streaming with no content yet, show loading indicator
    if (streamingArtifact && !artifactContent) {
      console.log('[ArtifactsPanel] Showing "Generating content..." spinner')
      return (
        <div className="flex flex-col items-center justify-center h-full gap-3" style={{ color: 'var(--text-muted)' }}>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ATLAS_ORANGE }} />
          <p>Generating content...</p>
        </div>
      )
    }

    console.log('[ArtifactsPanel] Rendering actual content for:', displayArtifact?.title)

    if (activeTab === 'source') {
      return <CodeRenderer content={artifactContent} fileExtension={displayArtifact?.file_extension} />
    }

    // Render preview - all formats render during streaming now
    // The renderers handle partial/incomplete content gracefully
    switch (displayArtifact?.file_extension) {
      case '.md':
        return <MarkdownRenderer content={artifactContent} fontFamily={fontFamily} />
      case '.html':
        return <HTMLRenderer content={artifactContent} />
      case '.svg':
        return <SVGRenderer content={artifactContent} />
      case '.mermaid':
        return <MermaidRenderer content={artifactContent} />
      case '.json':
        return <JSONRenderer content={artifactContent} />
      case '.csv':
        return <CSVRenderer content={artifactContent} />
      case '.slides':
        return <SlideRenderer content={artifactContent} />
      case '.jsx':
        return <CodeRenderer content={artifactContent} fileExtension=".jsx" />
      default:
        return <CodeRenderer content={artifactContent} fileExtension={displayArtifact?.file_extension} />
    }
  }

  // Format date for display
  const formatDate = (dateValue) => {
    if (!dateValue) return '-'
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return '-'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (dateValue) => {
    if (!dateValue) return ''
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  // Render artifact list (when no artifact is selected)
  const renderArtifactList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        <div className="flex items-center gap-2">
          <FileCode size={18} style={{ color: ATLAS_ORANGE }} />
          <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Artifacts</h2>
          <span className="text-xs px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {artifacts.length}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Artifacts Table */}
      <div className="flex-1 overflow-y-auto">
        {artifacts.length === 0 ? (
          <div className="text-center py-12">
            <FileCode size={40} style={{ color: 'var(--text-muted)', opacity: 0.3 }} className="mx-auto mb-3" />
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No artifacts yet
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Artifacts will appear here as they are created
            </p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                <th className="text-left text-xs font-medium px-4 py-2" style={{ color: 'var(--text-muted)' }}>Name</th>
                <th className="text-left text-xs font-medium px-2 py-2 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Type</th>
                <th className="text-left text-xs font-medium px-2 py-2 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Created</th>
                <th className="text-left text-xs font-medium px-2 py-2 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Modified</th>
                <th className="text-right text-xs font-medium px-4 py-2" style={{ color: 'var(--text-muted)' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {artifacts.map((artifact, index) => (
                <tr
                  key={artifact.id || index}
                  className="border-b transition-colors hover:bg-[var(--bg-secondary)] cursor-pointer"
                  style={{
                    borderColor: 'var(--border-color)',
                    opacity: isAnimating ? 1 : 0,
                    transform: isAnimating ? 'translateY(0)' : 'translateY(5px)',
                    transition: `all 200ms ease ${index * 30}ms`
                  }}
                  onClick={() => handleView(artifact)}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                        style={{ backgroundColor: 'var(--bg-tertiary)' }}
                      >
                        <Code size={14} style={{ color: ATLAS_ORANGE }} />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                          {artifact.title || artifact.name || 'Untitled'}
                        </div>
                        <div className="text-xs truncate sm:hidden" style={{ color: 'var(--text-muted)' }}>
                          {getTypeLabel(artifact)}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-2 py-3 hidden sm:table-cell">
                    <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                      {getTypeLabel(artifact)}
                    </span>
                  </td>
                  <td className="px-2 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Calendar size={12} />
                      <span>{formatDate(artifact.createdAt || artifact.created_at)}</span>
                    </div>
                    {(artifact.createdAt || artifact.created_at) && (
                      <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        <Clock size={10} />
                        <span>{formatTime(artifact.createdAt || artifact.created_at)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-2 py-3 hidden lg:table-cell">
                    <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                      <Clock size={12} />
                      <span>{formatDate(artifact.updatedAt || artifact.updated_at || artifact.createdAt || artifact.created_at)}</span>
                    </div>
                    {(artifact.updatedAt || artifact.updated_at || artifact.createdAt || artifact.created_at) && (
                      <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                        <span>{formatTime(artifact.updatedAt || artifact.updated_at || artifact.createdAt || artifact.created_at)}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); handleView(artifact) }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: ATLAS_ORANGE }}
                      >
                        <Eye size={14} />
                        <span className="hidden sm:inline">View</span>
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDownload(artifact) }}
                        className="p-1.5 rounded transition-colors hover:bg-[var(--bg-tertiary)]"
                        style={{ color: 'var(--text-muted)' }}
                        title="Download"
                      >
                        <Download size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )

  // Render artifact viewer (when an artifact is selected or streaming)
  const renderArtifactViewer = () => (
    <div ref={containerRef} className="flex flex-col h-full" style={{ backgroundColor: isFullscreen ? 'var(--bg-secondary)' : 'transparent' }}>
      {/* Header - Claude style: clean with title + type on left, actions on right */}
      <div
        className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0"
        style={{ borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {!isFullscreen && !streamingArtifact && (
            <button
              onClick={handleBackToList}
              className="p-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-muted)' }}
            >
              <ChevronLeft size={18} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <Code size={16} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {displayArtifact?.title || displayArtifact?.name || 'Creating artifact...'}
            </span>
          </div>
          <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
            {getTypeLabel(displayArtifact)}
          </span>
          {streamingArtifact && (
            <div className="flex items-center gap-1.5 ml-2 px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(34, 197, 94, 0.1)' }}>
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[11px] font-medium text-green-500">Building...</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-0.5">
          {/* Copy button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
            title="Copy"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
            <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
          </button>
          {/* Save to Project - only show if within a project */}
          {projectId && !streamingArtifact && (
            <button
              onClick={handleSaveToProject}
              disabled={isSaving}
              className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: saveSuccess ? '#10b981' : 'var(--text-muted)' }}
              title="Save to project files"
            >
              {saveSuccess ? <Check size={14} /> : <FolderPlus size={14} />}
              <span className="text-[11px]">{isSaving ? 'Saving...' : saveSuccess ? 'Saved' : 'Add to Project'}</span>
            </button>
          )}
          {/* Download */}
          <button
            onClick={() => handleDownload(displayArtifact)}
            className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
            title="Download"
          >
            <Download size={14} />
          </button>
          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
          </button>
          {/* Close */}
          <button
            onClick={isFullscreen ? toggleFullscreen : onClose}
            className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
            title="Close"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* Tab Bar - Claude style: subtle, minimal */}
      {isRenderable && (
        <div className="flex gap-1 px-4 py-2 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-md transition-colors"
            style={{
              backgroundColor: activeTab === 'preview' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'preview' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
            onClick={() => setActiveTab('preview')}
          >
            <Eye size={12} />
            Preview
          </button>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] rounded-md transition-colors"
            style={{
              backgroundColor: activeTab === 'source' ? 'var(--bg-primary)' : 'transparent',
              color: activeTab === 'source' ? 'var(--text-primary)' : 'var(--text-muted)',
              boxShadow: activeTab === 'source' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
            }}
            onClick={() => setActiveTab('source')}
          >
            <Code size={12} />
            Source
          </button>
        </div>
      )}

      {/* Content - full width preview with padding */}
      <div className="flex-1 overflow-auto">
        <div className="h-full w-full p-4">
          {renderContent()}
        </div>
      </div>
    </div>
  )

  if (!isVisible) return null

  const showViewer = displayArtifact || streamingArtifact

  return (
    <div
      ref={panelRef}
      className="border-l flex flex-col transition-opacity duration-300 ease-out overflow-hidden h-full relative"
      style={{
        backgroundColor: 'var(--bg-primary)',
        borderColor: 'var(--border-color)',
        fontFamily: 'var(--font-sans, system-ui, -apple-system, BlinkMacSystemFont, sans-serif)',
        width: isAnimating ? `${panelWidth}px` : '0',
        minWidth: isAnimating ? `${MIN_WIDTH}px` : '0',
        maxWidth: isAnimating ? `${MAX_WIDTH_PERCENT}%` : '0',
        opacity: isAnimating ? 1 : 0,
      }}
    >
      {/* Resize Handle */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1 cursor-col-resize group flex items-center justify-center z-10"
        onMouseDown={handleDragStart}
        style={{ backgroundColor: isDragging ? ATLAS_ORANGE : 'transparent' }}
      >
        {/* Visible grip indicator */}
        <div
          className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-4 h-8 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: 'hsl(220, 13%, 20%)' }}
        >
          <GripVertical size={12} style={{ color: 'hsl(220, 13%, 55%)' }} />
        </div>
        {/* Hover highlight bar */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: ATLAS_ORANGE }}
        />
      </div>

      {showViewer ? renderArtifactViewer() : renderArtifactList()}
    </div>
  )
}

export default ArtifactsPanel

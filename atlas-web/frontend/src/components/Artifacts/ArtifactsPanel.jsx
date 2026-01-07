import React, { useEffect, useState, useRef, useCallback } from 'react'
import { Code, Download, X, Eye, Maximize2, Minimize2, ChevronLeft, Copy, Check, GripVertical } from 'lucide-react'
import { artifactsService } from '../../services/chatService'
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

const ALLY_PINK = '#CD477E'
const MIN_WIDTH = 380
const MAX_WIDTH_PERCENT = 75 // Maximum 75% of screen width

function ArtifactsPanel({ sessionId, artifacts: propArtifacts = [], isVisible = false, onClose, selectedArtifact, onSelectArtifact, streamingArtifact, fontFamily }) {
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
  // Panel width state (in pixels)
  const [panelWidth, setPanelWidth] = useState(500)
  // Dragging state
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef(null)
  const panelRef = useRef(null)

  // Combine prop artifacts (from frontend detection) with fetched artifacts (from backend)
  const artifacts = [...propArtifacts, ...fetchedArtifacts]

  // Determine what to show - streaming artifact takes priority
  const displayArtifact = streamingArtifact || selectedArtifact

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

  // Load content when selectedArtifact changes
  useEffect(() => {
    if (selectedArtifact && !streamingArtifact) {
      loadArtifactContent(selectedArtifact)
    } else if (!selectedArtifact && !streamingArtifact) {
      setArtifactContent(null)
    }
  }, [selectedArtifact, streamingArtifact])

  // Update content when streaming artifact changes
  useEffect(() => {
    if (streamingArtifact?.content) {
      setArtifactContent(streamingArtifact.content)
    }
  }, [streamingArtifact?.content])

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
    setActiveTab('preview')

    // If artifact already has content (e.g., from streaming), use it directly
    if (artifact.content) {
      setArtifactContent(artifact.content)
      setIsLoadingContent(false)
      return
    }

    // Otherwise, fetch from backend
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
    if (isLoadingContent && !streamingArtifact) {
      return (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ALLY_PINK }} />
        </div>
      )
    }

    if (!artifactContent) {
      return (
        <div className="flex items-center justify-center h-full" style={{ color: 'var(--text-muted)' }}>
          <p>No content available</p>
        </div>
      )
    }

    if (activeTab === 'source') {
      return <CodeRenderer content={artifactContent} fileExtension={displayArtifact?.file_extension} />
    }

    // Formats that require complete content to parse - show raw code during streaming
    const parseRequiredFormats = ['.json', '.csv', '.mermaid', '.slides']
    const isParseRequired = parseRequiredFormats.includes(displayArtifact?.file_extension)

    // During streaming, show raw code only for formats that need parsing
    if (streamingArtifact && isParseRequired) {
      return <CodeRenderer content={artifactContent} fileExtension={displayArtifact?.file_extension} />
    }

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

  // Render artifact list (when no artifact is selected)
  const renderArtifactList = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
        <h2 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Artifacts</h2>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <X size={18} />
        </button>
      </div>

      {/* Artifacts List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {artifacts.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              No artifacts yet
            </p>
          </div>
        ) : (
          artifacts.map((artifact, index) => (
            <div
              key={artifact.id || index}
              className="flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors"
              style={{
                backgroundColor: selectedArtifact?.id === artifact.id ? 'var(--bg-tertiary)' : 'transparent',
                opacity: isAnimating ? 1 : 0,
                transform: isAnimating ? 'translateX(0)' : 'translateX(10px)',
                transition: `all 200ms ease ${index * 30}ms`
              }}
              onClick={() => handleView(artifact)}
            >
              {/* Icon */}
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: 'var(--bg-secondary)' }}
              >
                <Code size={18} style={{ color: 'var(--text-muted)' }} />
              </div>
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                  {artifact.title || artifact.name}
                </div>
                <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Code · {getTypeLabel(artifact)}
                </div>
              </div>
              {/* Download */}
              <button
                onClick={(e) => { e.stopPropagation(); handleDownload(artifact) }}
                className="p-1.5 rounded transition-colors hover:bg-[hsl(220,13%,26%)]"
                style={{ color: 'hsl(220, 13%, 55%)' }}
              >
                <Download size={16} />
              </button>
            </div>
          ))
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
            <div className="flex items-center gap-1.5 ml-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
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

      {/* Content - clean whitespace like Claude */}
      <div className="flex-1 overflow-auto">
        <div className="px-6 py-6 max-w-none">
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
        style={{ backgroundColor: isDragging ? ALLY_PINK : 'transparent' }}
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
          style={{ backgroundColor: ALLY_PINK }}
        />
      </div>

      {showViewer ? renderArtifactViewer() : renderArtifactList()}
    </div>
  )
}

export default ArtifactsPanel

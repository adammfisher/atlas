import React, { useState, useEffect, useCallback } from 'react'
import { Search, FileText, Eye, Download, Calendar, Clock, FolderOpen, X, Code, ChevronLeft, Copy, Check, Maximize2, Minimize2, GripVertical } from 'lucide-react'
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

const ALLY_PINK = '#CD477E'
const MIN_PANEL_WIDTH_PERCENT = 30
const MAX_PANEL_WIDTH_PERCENT = 70

function ArtifactsListPage() {
  const [artifacts, setArtifacts] = useState([])
  const [projects, setProjects] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedArtifact, setSelectedArtifact] = useState(null)
  const [artifactContent, setArtifactContent] = useState(null)
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [activeTab, setActiveTab] = useState('preview')
  const [copied, setCopied] = useState(false)
  const [panelWidthPercent, setPanelWidthPercent] = useState(50) // Start at 50% width
  const [isDragging, setIsDragging] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)
  const containerRef = React.useRef(null)

  // Fetch all artifacts on mount
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // Fetch all artifacts and projects in parallel
        const [artifactsData, projectsData] = await Promise.all([
          artifactsService.listAll(),
          projectsService.list()
        ])
        setArtifacts(artifactsData || [])
        setProjects(projectsData || [])
      } catch (err) {
        console.error('Failed to fetch artifacts:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  // Load artifact content when selected
  useEffect(() => {
    if (!selectedArtifact) {
      setArtifactContent(null)
      return
    }
    loadArtifactContent(selectedArtifact)
  }, [selectedArtifact])

  // Handle drag resize
  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return
      // Calculate width as percentage of window
      const newWidthPercent = ((window.innerWidth - e.clientX) / window.innerWidth) * 100
      // Clamp to min/max range
      if (newWidthPercent >= MIN_PANEL_WIDTH_PERCENT && newWidthPercent <= MAX_PANEL_WIDTH_PERCENT) {
        setPanelWidthPercent(newWidthPercent)
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

  const loadArtifactContent = async (artifact) => {
    setActiveTab('preview')

    // If artifact already has content, use it
    if (artifact.content) {
      setArtifactContent(artifact.content)
      setIsLoadingContent(false)
      return
    }

    setArtifactContent(null)
    setIsLoadingContent(true)

    try {
      // Fetch content from backend
      const content = await artifactsService.getContent(artifact.sessionId, artifact.artifactId || artifact.id)
      setArtifactContent(content)
    } catch (e) {
      console.error('Failed to fetch artifact content:', e)
    } finally {
      setIsLoadingContent(false)
    }
  }

  const getProjectName = (projectId) => {
    if (!projectId) return '—'
    const project = projects.find(p => p.id === projectId)
    return project?.name || '—'
  }

  const getTypeLabel = (artifact) => {
    if (!artifact) return 'FILE'
    const type = artifact.type || ''
    const labels = {
      'markdown': 'Markdown',
      'md': 'Markdown',
      'html': 'HTML',
      'svg': 'SVG',
      'mermaid': 'Diagram',
      'react': 'React',
      'jsx': 'React',
      'json': 'JSON',
      'css': 'CSS',
      'javascript': 'JavaScript',
      'js': 'JavaScript',
      'python': 'Python'
    }
    return labels[type.toLowerCase()] || type.toUpperCase() || 'FILE'
  }

  const getFileExtension = (artifact) => {
    if (!artifact) return '.txt'
    const type = artifact.type || ''
    const extMap = {
      'markdown': '.md',
      'md': '.md',
      'html': '.html',
      'svg': '.svg',
      'mermaid': '.mermaid',
      'react': '.jsx',
      'jsx': '.jsx',
      'json': '.json',
      'css': '.css',
      'javascript': '.js',
      'js': '.js',
      'python': '.py'
    }
    return extMap[type.toLowerCase()] || `.${type}`
  }

  const formatDate = (dateValue) => {
    if (!dateValue) return '—'
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return '—'
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const formatTime = (dateValue) => {
    if (!dateValue) return ''
    const date = new Date(dateValue)
    if (isNaN(date.getTime())) return ''
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }

  const handleView = (artifact) => {
    setSelectedArtifact(artifact)
  }

  const handleClosePanel = () => {
    setSelectedArtifact(null)
    setArtifactContent(null)
  }

  const handleDownload = (artifact) => {
    const content = artifactContent || artifact?.content
    if (content) {
      const mimeTypes = {
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.css': 'text/css',
        '.js': 'text/javascript'
      }
      const ext = getFileExtension(artifact)
      const mimeType = mimeTypes[ext] || 'text/plain'
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = (artifact?.title || artifact?.name || 'artifact').replace(/\s+/g, '-').toLowerCase() + ext
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  const handleCopy = async () => {
    const content = artifactContent || selectedArtifact?.content
    if (content) {
      await navigator.clipboard.writeText(content)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
    }
  }, [])

  // Filter artifacts by search query
  const filteredArtifacts = artifacts.filter(a => {
    if (!searchQuery) return true
    const query = searchQuery.toLowerCase()
    return (
      (a.title || '').toLowerCase().includes(query) ||
      (a.name || '').toLowerCase().includes(query) ||
      (a.type || '').toLowerCase().includes(query)
    )
  })

  // Check if artifact is renderable
  const isRenderable = selectedArtifact && (
    ['markdown', 'md', 'html', 'svg', 'mermaid', 'json', 'csv', 'jsx', 'react'].includes(selectedArtifact?.type?.toLowerCase())
  )

  // Render artifact content
  const renderContent = () => {
    if (isLoadingContent) {
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
      return <CodeRenderer content={artifactContent} fileExtension={getFileExtension(selectedArtifact)} />
    }

    const type = selectedArtifact?.type?.toLowerCase()
    switch (type) {
      case 'markdown':
      case 'md':
        return <MarkdownRenderer content={artifactContent} />
      case 'html':
        return <HTMLRenderer content={artifactContent} />
      case 'svg':
        return <SVGRenderer content={artifactContent} />
      case 'mermaid':
        return <MermaidRenderer content={artifactContent} />
      case 'json':
        return <JSONRenderer content={artifactContent} />
      case 'csv':
        return <CSVRenderer content={artifactContent} />
      case 'jsx':
      case 'react':
        return <CodeRenderer content={artifactContent} fileExtension=".jsx" />
      default:
        return <CodeRenderer content={artifactContent} fileExtension={getFileExtension(selectedArtifact)} />
    }
  }

  return (
    <div className="flex h-full overflow-hidden" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Main content - artifacts table */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>
                Artifacts
              </h1>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                All artifacts created across your conversations
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="mb-6">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                type="text"
                placeholder="Search artifacts..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border text-sm"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  borderColor: 'var(--border-color)',
                  color: 'var(--text-primary)'
                }}
              />
            </div>
          </div>

          {/* Artifacts Table */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ALLY_PINK }} />
            </div>
          ) : filteredArtifacts.length === 0 ? (
            <div className="text-center py-12">
              <FileText size={48} style={{ color: 'var(--text-muted)', opacity: 0.3 }} className="mx-auto mb-4" />
              <p className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                {searchQuery ? 'No artifacts found' : 'No artifacts yet'}
              </p>
              <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? 'Try a different search term' : 'Artifacts will appear here as you create them in conversations'}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'var(--border-color)' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)' }}>
                    <th className="text-left text-xs font-medium px-4 py-3" style={{ color: 'var(--text-muted)' }}>Name</th>
                    <th className="text-left text-xs font-medium px-4 py-3 hidden sm:table-cell" style={{ color: 'var(--text-muted)' }}>Type</th>
                    <th className="text-left text-xs font-medium px-4 py-3 hidden md:table-cell" style={{ color: 'var(--text-muted)' }}>Project</th>
                    <th className="text-left text-xs font-medium px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Created</th>
                    <th className="text-left text-xs font-medium px-4 py-3 hidden lg:table-cell" style={{ color: 'var(--text-muted)' }}>Updated</th>
                    <th className="text-right text-xs font-medium px-4 py-3" style={{ color: 'var(--text-muted)' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArtifacts.map((artifact, index) => (
                    <tr
                      key={artifact.artifactId || artifact.id || index}
                      className="border-t transition-colors hover:bg-[var(--bg-secondary)] cursor-pointer"
                      style={{ borderColor: 'var(--border-color)' }}
                      onClick={() => handleView(artifact)}
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                            style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          >
                            <Code size={16} style={{ color: ALLY_PINK }} />
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
                      <td className="px-4 py-3 hidden sm:table-cell">
                        <span className="text-xs px-2 py-1 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                          {getTypeLabel(artifact)}
                        </span>
                      </td>
                      <td className="px-4 py-3 hidden md:table-cell">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          {artifact.projectId && <FolderOpen size={12} />}
                          <span>{getProjectName(artifact.projectId)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Calendar size={12} />
                          <span>{formatDate(artifact.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                          <Clock size={10} />
                          <span>{formatTime(artifact.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 hidden lg:table-cell">
                        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--text-muted)' }}>
                          <Clock size={12} />
                          <span>{formatDate(artifact.updatedAt || artifact.createdAt)}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs mt-0.5" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                          <span>{formatTime(artifact.updatedAt || artifact.createdAt)}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); handleView(artifact) }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium transition-colors hover:bg-[var(--bg-tertiary)]"
                            style={{ color: ALLY_PINK }}
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
            </div>
          )}
        </div>
      </div>

      {/* Artifact viewer panel */}
      {selectedArtifact && (
        <div
          className="border-l flex flex-col h-full relative"
          style={{
            backgroundColor: 'var(--bg-primary)',
            borderColor: 'var(--border-color)',
            width: `${panelWidthPercent}%`,
            minWidth: `${MIN_PANEL_WIDTH_PERCENT}%`,
            maxWidth: `${MAX_PANEL_WIDTH_PERCENT}%`
          }}
        >
          {/* Resize Handle - wider hit area and always visible indicator */}
          <div
            className="absolute left-0 top-0 bottom-0 w-2 cursor-col-resize group flex items-center justify-center z-10 hover:w-3 transition-all"
            onMouseDown={(e) => { e.preventDefault(); setIsDragging(true) }}
            style={{ backgroundColor: isDragging ? ALLY_PINK : 'rgba(205, 71, 126, 0.3)' }}
          >
            {/* Grip indicator - always visible */}
            <div
              className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-5 h-12 rounded flex items-center justify-center transition-opacity"
              style={{
                backgroundColor: isDragging ? ALLY_PINK : 'var(--bg-tertiary)',
                opacity: isDragging ? 1 : 0.8
              }}
            >
              <GripVertical size={14} style={{ color: isDragging ? 'white' : 'var(--text-muted)' }} />
            </div>
            {/* Hover highlight */}
            <div
              className="absolute left-0 top-0 bottom-0 w-2 opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ backgroundColor: ALLY_PINK }}
            />
          </div>

          {/* Viewer content */}
          <div ref={containerRef} className="flex flex-col h-full" style={{ backgroundColor: isFullscreen ? 'var(--bg-secondary)' : 'transparent' }}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
              <div className="flex items-center gap-3 min-w-0">
                <button
                  onClick={handleClosePanel}
                  className="p-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <ChevronLeft size={18} />
                </button>
                <div className="flex items-center gap-2">
                  <Code size={16} style={{ color: 'var(--text-muted)' }} />
                  <span className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                    {selectedArtifact?.title || selectedArtifact?.name || 'Artifact'}
                  </span>
                </div>
                <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {getTypeLabel(selectedArtifact)}
                </span>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 px-2 py-1 rounded transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title="Copy"
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  <span className="text-[11px]">{copied ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  onClick={() => handleDownload(selectedArtifact)}
                  className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title="Download"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={toggleFullscreen}
                  className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
                >
                  {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                </button>
                <button
                  onClick={handleClosePanel}
                  className="p-1.5 rounded transition-colors hover:bg-[var(--bg-secondary)]"
                  style={{ color: 'var(--text-muted)' }}
                  title="Close"
                >
                  <X size={14} />
                </button>
              </div>
            </div>

            {/* Tab Bar */}
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

            {/* Content */}
            <div className="flex-1 overflow-auto">
              <div className="p-4 max-w-none">
                {renderContent()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ArtifactsListPage

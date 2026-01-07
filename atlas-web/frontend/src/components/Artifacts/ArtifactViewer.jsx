import React, { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download, Share2, Code, Eye, ExternalLink, Maximize2, Minimize2 } from 'lucide-react'
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

function ArtifactViewer({ artifact, content, onClose, onDownload, onShare }) {
  const [activeTab, setActiveTab] = useState('preview')
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [isLoading, setIsLoading] = useState(!content)
  const containerRef = useRef(null)

  // Update loading state when content changes
  useEffect(() => {
    setIsLoading(!content)
  }, [content])

  // Determine if artifact is renderable
  const isRenderable = artifact?.renderable !== false && (
    ['.md', '.html', '.svg', '.mermaid', '.json', '.csv', '.jsx', '.slides'].includes(artifact?.file_extension)
  )

  // Handle fullscreen change events (e.g., user presses Escape)
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

  // Toggle fullscreen using the browser's Fullscreen API
  const toggleFullscreen = useCallback(async () => {
    try {
      if (!document.fullscreenElement) {
        // Enter fullscreen
        if (containerRef.current?.requestFullscreen) {
          await containerRef.current.requestFullscreen()
        } else if (containerRef.current?.webkitRequestFullscreen) {
          await containerRef.current.webkitRequestFullscreen()
        }
      } else {
        // Exit fullscreen
        if (document.exitFullscreen) {
          await document.exitFullscreen()
        } else if (document.webkitExitFullscreen) {
          await document.webkitExitFullscreen()
        }
      }
    } catch (err) {
      console.error('Fullscreen error:', err)
      // Fallback to CSS-based fullscreen
      setIsFullscreen(!isFullscreen)
    }
  }, [isFullscreen])

  // Get the appropriate renderer
  const renderContent = () => {
    if (isLoading) {
      return (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2" style={{ borderColor: ALLY_PINK }} />
        </div>
      )
    }

    if (!content) {
      return (
        <div className="flex items-center justify-center h-64" style={{ color: 'var(--text-muted)' }}>
          <p>No content available</p>
        </div>
      )
    }

    if (activeTab === 'source') {
      return <CodeRenderer content={content} fileExtension={artifact?.file_extension} />
    }

    // Preview mode - use appropriate renderer
    switch (artifact?.file_extension) {
      case '.md':
        return <MarkdownRenderer content={content} />
      case '.html':
        return <HTMLRenderer content={content} />
      case '.svg':
        return <SVGRenderer content={content} />
      case '.mermaid':
        return <MermaidRenderer content={content} />
      case '.json':
        return <JSONRenderer content={content} />
      case '.csv':
        return <CSVRenderer content={content} />
      case '.slides':
        return <SlideRenderer content={content} />
      case '.jsx':
        // For React components, show code with syntax highlighting
        return <CodeRenderer content={content} fileExtension=".jsx" />
      default:
        // For non-renderable types, show code view
        return <CodeRenderer content={content} fileExtension={artifact?.file_extension} />
    }
  }

  const getTypeLabel = () => {
    const labels = {
      '.md': 'Markdown',
      '.html': 'HTML',
      '.svg': 'SVG Diagram',
      '.mermaid': 'Mermaid Diagram',
      '.json': 'JSON',
      '.csv': 'CSV Data',
      '.slides': 'Slide Deck',
      '.jsx': 'React Component',
      '.js': 'JavaScript',
      '.ts': 'TypeScript',
      '.py': 'Python',
      '.sql': 'SQL',
      '.yaml': 'YAML',
      '.sh': 'Shell Script'
    }
    return labels[artifact?.file_extension] || artifact?.type || 'Document'
  }

  // Get proper MIME type for download
  const getMimeType = () => {
    const mimeTypes = {
      '.md': 'text/markdown',
      '.html': 'text/html',
      '.svg': 'image/svg+xml',
      '.json': 'application/json',
      '.csv': 'text/csv',
      '.slides': 'text/html',
      '.jsx': 'text/javascript',
      '.js': 'text/javascript',
      '.ts': 'text/typescript',
      '.py': 'text/x-python',
      '.txt': 'text/plain'
    }
    return mimeTypes[artifact?.file_extension] || artifact?.content_type || 'text/plain'
  }

  // Get proper file extension for download
  const getDownloadFilename = () => {
    const name = artifact?.name || artifact?.title || 'artifact'
    const ext = artifact?.file_extension || '.txt'

    // For slides, download as HTML
    if (ext === '.slides') {
      return name.replace(/\.slides$/, '') + '.html'
    }

    // If name already has extension, use it
    if (name.includes('.')) {
      return name
    }

    return name + ext
  }

  const handleDownload = () => {
    if (onDownload) {
      onDownload(artifact)
      return
    }

    if (artifact?.download_url) {
      // Use download_url if available
      const a = document.createElement('a')
      a.href = artifact.download_url
      a.download = getDownloadFilename()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      return
    }

    if (content) {
      // Create blob and download
      const mimeType = getMimeType()
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = getDownloadFilename()
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center ${isFullscreen ? '' : 'p-4 md:p-8'}`}
      style={{ backgroundColor: 'rgba(0,0,0,0.8)' }}
      onClick={(e) => e.target === e.currentTarget && onClose?.()}
    >
      <div
        ref={containerRef}
        className={`flex flex-col overflow-hidden shadow-2xl transition-all duration-200 ${
          isFullscreen ? 'w-full h-full rounded-none' : 'w-full max-w-4xl max-h-[90vh] rounded-lg'
        }`}
        style={{ backgroundColor: 'hsl(30,3.3%,11.8%)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex-1 min-w-0 mr-4">
            <h2 className="text-lg font-medium truncate" style={{ color: 'var(--text-primary)' }}>
              {artifact?.title || artifact?.name || 'Artifact'}
            </h2>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs uppercase font-medium px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
                {getTypeLabel()}
              </span>
              {artifact?.version && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  v{artifact.version}
                </span>
              )}
              {artifact?.size && (
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatBytes(artifact.size)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-muted)' }}
              title="Download"
            >
              <Download size={18} />
            </button>
            {onShare && (
              <button
                onClick={() => onShare(artifact)}
                className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Share"
              >
                <Share2 size={18} />
              </button>
            )}
            {artifact?.download_url && (
              <a
                href={artifact.download_url}
                target="_blank"
                rel="noopener noreferrer"
                className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
                style={{ color: 'var(--text-muted)' }}
                title="Open in new tab"
              >
                <ExternalLink size={18} />
              </a>
            )}
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-muted)' }}
              title={isFullscreen ? 'Exit fullscreen (Esc)' : 'Fullscreen'}
            >
              {isFullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
              style={{ color: 'var(--text-muted)' }}
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Tab Bar */}
        {isRenderable && (
          <div className="flex border-b flex-shrink-0" style={{ borderColor: 'var(--border-color)' }}>
            <button
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                activeTab === 'preview' ? 'border-b-2' : ''
              }`}
              style={{
                borderColor: activeTab === 'preview' ? ALLY_PINK : 'transparent',
                color: activeTab === 'preview' ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('preview')}
            >
              <Eye size={16} />
              Preview
            </button>
            <button
              className={`flex items-center gap-2 px-4 py-2.5 text-sm transition-colors ${
                activeTab === 'source' ? 'border-b-2' : ''
              }`}
              style={{
                borderColor: activeTab === 'source' ? ALLY_PINK : 'transparent',
                color: activeTab === 'source' ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab('source')}
            >
              <Code size={16} />
              Source
            </button>
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {renderContent()}
        </div>

        {/* Footer */}
        <div
          className="flex items-center justify-between px-6 py-3 border-t text-xs flex-shrink-0"
          style={{ borderColor: 'var(--border-color)', color: 'var(--text-muted)' }}
        >
          <span>
            {artifact?.created_at && `Created ${formatDate(artifact.created_at)}`}
          </span>
          <span>
            {artifact?.updated_at && artifact.updated_at !== artifact.created_at &&
              `Updated ${formatDate(artifact.updated_at)}`
            }
          </span>
        </div>
      </div>
    </div>
  )
}

function formatBytes(bytes) {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`
}

function formatDate(dateString) {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now - date
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

export default ArtifactViewer

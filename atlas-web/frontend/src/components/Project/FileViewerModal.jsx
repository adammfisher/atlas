import React, { useState, useEffect } from 'react'
import { X, FileText, Code, Image, Download, Loader2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { projectsService, artifactsService } from '../../services/chatService'

/**
 * Get file type info for the header
 */
function getFileTypeInfo(filename, mimeType) {
  const ext = filename?.split('.').pop()?.toLowerCase() || ''

  if (ext === 'md' || mimeType?.includes('markdown')) {
    return { label: 'Markdown', icon: FileText, color: '#3B82F6' }
  }

  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt']
  if (codeExts.includes(ext) || mimeType?.includes('javascript') || mimeType?.includes('typescript')) {
    return { label: ext.toUpperCase(), icon: Code, color: '#10B981' }
  }

  if (['json', 'yaml', 'yml', 'xml', 'csv'].includes(ext)) {
    return { label: ext.toUpperCase(), icon: FileText, color: '#F59E0B' }
  }

  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || mimeType?.startsWith('image/')) {
    return { label: 'Image', icon: Image, color: '#8B5CF6' }
  }

  return { label: ext.toUpperCase() || 'File', icon: FileText, color: '#6B7280' }
}

/**
 * Determine if content should be rendered as markdown
 */
function shouldRenderAsMarkdown(filename, mimeType) {
  const ext = filename?.split('.').pop()?.toLowerCase() || ''
  return ext === 'md' || mimeType?.includes('markdown')
}

/**
 * Determine if content is code that should have syntax highlighting
 */
function isCodeFile(filename, mimeType) {
  const ext = filename?.split('.').pop()?.toLowerCase() || ''
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt', 'json', 'yaml', 'yml', 'xml', 'html', 'css', 'scss', 'sql', 'sh', 'bash']
  return codeExts.includes(ext) || mimeType?.includes('javascript') || mimeType?.includes('typescript') || mimeType?.includes('json')
}

/**
 * FileViewerModal - Modal for viewing file content with markdown rendering
 */
function FileViewerModal({ file, projectId, projectName, onClose }) {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const { label, icon: Icon, color } = getFileTypeInfo(file.name || file.filename, file.type)
  const filename = file.name || file.filename
  const lines = content ? content.split('\n').length : 0

  // Load file content
  useEffect(() => {
    const loadContent = async () => {
      setLoading(true)
      setError(null)
      try {
        if (file.isArtifact) {
          // For artifacts, use artifactsService
          const sessionId = file.sessionId || file.session_id
          const artifactId = file.artifactId || file.id
          const artifactContent = await artifactsService.getContent(sessionId, artifactId)
          setContent(artifactContent || '')
        } else {
          // For project files, use projectsService
          const data = await projectsService.getFileContent(projectId, file.id || file.fileId)
          setContent(data.content || '')
        }
      } catch (err) {
        console.error('Failed to load file content:', err)
        setError('Failed to load file content')
      } finally {
        setLoading(false)
      }
    }

    loadContent()
  }, [projectId, file.id, file.fileId, file.isArtifact, file.sessionId, file.session_id, file.artifactId])

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Handle backdrop click
  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4"
      onClick={handleBackdropClick}
    >
      <div
        className="w-full max-w-4xl max-h-[90vh] rounded-2xl flex flex-col overflow-hidden"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0"
          style={{ borderColor: 'var(--border-color)' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <Icon size={20} style={{ color }} />
            <div className="min-w-0">
              <h2
                className="text-lg font-medium truncate"
                style={{ color: 'var(--text-primary)' }}
                title={filename}
              >
                {filename}
              </h2>
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
                <span
                  className="px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: `${color}20`, color }}
                >
                  {label}
                </span>
                {!loading && content && (
                  <span>{lines.toLocaleString()} lines</span>
                )}
                {file.tokenCount && (
                  <span>{file.tokenCount.toLocaleString()} tokens</span>
                )}
                {projectName && (
                  <>
                    <span>•</span>
                    <span>In {projectName}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 overflow-y-auto p-6"
          style={{ backgroundColor: 'var(--bg-primary)' }}
        >
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-muted)' }} />
              <span className="ml-2" style={{ color: 'var(--text-muted)' }}>Loading file...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center py-12">
              <p style={{ color: '#EF4444' }}>{error}</p>
            </div>
          ) : shouldRenderAsMarkdown(filename, file.type) ? (
            // Render markdown
            <div
              className="prose prose-invert max-w-none"
              style={{
                '--tw-prose-body': 'var(--text-primary)',
                '--tw-prose-headings': 'var(--text-primary)',
                '--tw-prose-links': '#E07020',
                '--tw-prose-bold': 'var(--text-primary)',
                '--tw-prose-code': 'var(--text-primary)',
                '--tw-prose-pre-bg': 'var(--bg-tertiary)',
              }}
            >
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  // Style code blocks
                  pre: ({ children }) => (
                    <pre
                      className="rounded-lg p-4 overflow-x-auto text-sm"
                      style={{ backgroundColor: 'var(--bg-tertiary)' }}
                    >
                      {children}
                    </pre>
                  ),
                  code: ({ inline, children, ...props }) => {
                    if (inline) {
                      return (
                        <code
                          className="px-1.5 py-0.5 rounded text-sm"
                          style={{ backgroundColor: 'var(--bg-tertiary)' }}
                          {...props}
                        >
                          {children}
                        </code>
                      )
                    }
                    return <code {...props}>{children}</code>
                  },
                  // Style tables
                  table: ({ children }) => (
                    <div className="overflow-x-auto">
                      <table className="min-w-full" style={{ borderColor: 'var(--border-color)' }}>
                        {children}
                      </table>
                    </div>
                  ),
                  th: ({ children }) => (
                    <th
                      className="px-4 py-2 text-left text-sm font-medium border-b"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {children}
                    </th>
                  ),
                  td: ({ children }) => (
                    <td
                      className="px-4 py-2 text-sm border-b"
                      style={{ borderColor: 'var(--border-color)', color: 'var(--text-primary)' }}
                    >
                      {children}
                    </td>
                  ),
                }}
              >
                {content}
              </ReactMarkdown>
            </div>
          ) : isCodeFile(filename, file.type) ? (
            // Render code with monospace font
            <pre
              className="text-sm leading-relaxed overflow-x-auto"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace'
              }}
            >
              {content}
            </pre>
          ) : (
            // Plain text
            <pre
              className="text-sm leading-relaxed whitespace-pre-wrap"
              style={{
                color: 'var(--text-primary)',
                fontFamily: 'inherit'
              }}
            >
              {content}
            </pre>
          )}
        </div>
      </div>
    </div>
  )
}

export default FileViewerModal

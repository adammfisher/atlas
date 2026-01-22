import React from 'react'
import { FileText, Image, Code, File } from 'lucide-react'

/**
 * Get file type info for display
 */
function getFileTypeInfo(filename, mimeType) {
  const ext = filename?.split('.').pop()?.toLowerCase() || ''

  // Markdown files
  if (ext === 'md' || mimeType?.includes('markdown')) {
    return { label: 'MD', icon: FileText, color: '#3B82F6' }
  }

  // Code files
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'go', 'rs', 'rb', 'php', 'swift', 'kt']
  if (codeExts.includes(ext) || mimeType?.includes('javascript') || mimeType?.includes('typescript')) {
    return { label: ext.toUpperCase(), icon: Code, color: '#10B981' }
  }

  // Image files
  if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext) || mimeType?.startsWith('image/')) {
    return { label: ext.toUpperCase(), icon: Image, color: '#8B5CF6' }
  }

  // JSON/data files
  if (['json', 'yaml', 'yml', 'xml', 'csv'].includes(ext)) {
    return { label: ext.toUpperCase(), icon: FileText, color: '#F59E0B' }
  }

  // Text files
  if (ext === 'txt' || mimeType?.startsWith('text/')) {
    return { label: 'TXT', icon: FileText, color: '#6B7280' }
  }

  // Default
  return { label: ext.toUpperCase() || 'FILE', icon: File, color: '#6B7280' }
}

/**
 * Estimate line count from token count (rough approximation)
 */
function estimateLines(tokenCount) {
  // Roughly 10 tokens per line on average
  return Math.max(1, Math.round((tokenCount || 0) / 10))
}

/**
 * FileCard - Displays a project file as a card/tile similar to Claude's UI
 */
function FileCard({ file, onClick }) {
  const { label, icon: Icon, color } = getFileTypeInfo(file.name || file.filename, file.type)
  const lines = estimateLines(file.tokenCount)

  return (
    <button
      onClick={() => onClick?.(file)}
      className="group relative w-full text-left rounded-xl overflow-hidden transition-all hover:scale-[1.02] hover:shadow-lg"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        border: '1px solid var(--border-color)'
      }}
    >
      {/* Preview area - shows file icon/preview */}
      <div
        className="h-24 flex items-center justify-center"
        style={{ backgroundColor: 'var(--bg-tertiary)' }}
      >
        <Icon
          size={32}
          style={{ color: 'var(--text-muted)' }}
          strokeWidth={1.5}
        />
      </div>

      {/* File info */}
      <div className="p-3">
        {/* Filename */}
        <p
          className="text-sm font-medium truncate mb-1"
          style={{ color: 'var(--text-primary)' }}
          title={file.name || file.filename}
        >
          {file.name || file.filename}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2">
          {/* File type badge */}
          <span
            className="text-xs px-1.5 py-0.5 rounded font-medium"
            style={{
              backgroundColor: `${color}20`,
              color: color
            }}
          >
            {label}
          </span>

          {/* Line count */}
          <span
            className="text-xs"
            style={{ color: 'var(--text-muted)' }}
          >
            {lines.toLocaleString()} {lines === 1 ? 'line' : 'lines'}
          </span>
        </div>
      </div>

      {/* Hover overlay */}
      <div
        className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
        style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
      >
        <span className="text-white text-sm font-medium">View file</span>
      </div>
    </button>
  )
}

export default FileCard

import React, { useRef, useState } from 'react'
import {
  FileText,
  FileCode,
  FileImage,
  File,
  Pin,
  PinOff,
  Upload,
  Trash2,
  MoreHorizontal,
  FolderArchive,
  X
} from 'lucide-react'

// Map file extensions to icons
const getFileIcon = (filename) => {
  const ext = filename?.split('.').pop()?.toLowerCase()
  const codeExts = ['js', 'jsx', 'ts', 'tsx', 'py', 'java', 'cpp', 'c', 'h', 'css', 'html', 'json', 'xml', 'yaml', 'yml', 'sh', 'bash', 'sql']
  const imageExts = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'ico', 'bmp']
  const docExts = ['md', 'txt', 'doc', 'docx', 'pdf', 'rtf']

  if (codeExts.includes(ext)) return FileCode
  if (imageExts.includes(ext)) return FileImage
  if (docExts.includes(ext)) return FileText
  return File
}

// Format file size
const formatSize = (bytes) => {
  if (!bytes) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

function FilesList({ files, onUpload, onTogglePin, onDelete }) {
  const fileInputRef = useRef(null)
  const zipInputRef = useRef(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [isUploading, setIsUploading] = useState(false)

  // Separate pinned and unpinned files
  const pinnedFiles = files.filter(f => f.pinned === 'true')
  const unpinnedFiles = files.filter(f => f.pinned !== 'true')

  const handleFileClick = () => {
    fileInputRef.current?.click()
  }

  const handleZipClick = () => {
    zipInputRef.current?.click()
  }

  const handleFileChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await onUpload({ target: { files: [file] } })
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handleZipChange = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      await onUpload({ target: { files: [file] } })
    } finally {
      setIsUploading(false)
      event.target.value = ''
    }
  }

  const FileItem = ({ file }) => {
    const Icon = getFileIcon(file.name || file.filename)
    const isPinned = file.pinned === 'true'

    return (
      <div
        className="flex items-center gap-3 p-3 rounded-lg transition-colors group relative"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
      >
        <div className="flex-shrink-0">
          <Icon size={20} style={{ color: isPinned ? '#E07020' : 'var(--text-muted)' }} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
            {file.name || file.filename}
          </p>
          <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{formatSize(file.size)}</span>
            {file.tokenCount && (
              <span>{file.tokenCount.toLocaleString()} tokens</span>
            )}
          </div>
        </div>

        {/* Pin indicator */}
        {isPinned && (
          <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs" style={{ backgroundColor: 'rgba(205, 71, 126, 0.1)', color: '#E07020' }}>
            <Pin size={10} />
            <span>Pinned</span>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={() => onTogglePin(file.fileId, isPinned)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: isPinned ? '#E07020' : 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            title={isPinned ? 'Unpin from context' : 'Pin to context'}
          >
            {isPinned ? <PinOff size={16} /> : <Pin size={16} />}
          </button>
          <button
            onClick={() => setOpenMenuId(openMenuId === file.fileId ? null : file.fileId)}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-primary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>

        {/* Dropdown menu */}
        {openMenuId === file.fileId && (
          <div
            className="absolute right-0 top-full mt-1 w-40 rounded-lg border shadow-xl overflow-hidden z-50"
            style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
          >
            <button
              onClick={() => {
                onTogglePin(file.fileId, isPinned)
                setOpenMenuId(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
              {isPinned ? 'Unpin' : 'Pin to Context'}
            </button>
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            <button
              onClick={() => {
                onDelete(file.fileId)
                setOpenMenuId(null)
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm transition-colors text-left text-red-500"
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 size={14} />
              Delete
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload buttons */}
      <div className="flex items-center gap-3">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".txt,.md,.js,.jsx,.ts,.tsx,.py,.java,.cpp,.c,.h,.css,.html,.json,.xml,.yaml,.yml,.sh,.sql,.pdf,.doc,.docx,.png,.jpg,.jpeg,.gif,.svg"
        />
        <input
          ref={zipInputRef}
          type="file"
          onChange={handleZipChange}
          className="hidden"
          accept=".zip"
        />

        <button
          onClick={handleFileClick}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        >
          <Upload size={16} />
          {isUploading ? 'Uploading...' : 'Upload File'}
        </button>

        <button
          onClick={handleZipClick}
          disabled={isUploading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        >
          <FolderArchive size={16} />
          Upload ZIP
        </button>
      </div>

      {/* Empty state */}
      {files.length === 0 && (
        <div className="text-center py-12">
          <FileText size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)' }}>No files in this project</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            Upload files to give Claude context about your project
          </p>
        </div>
      )}

      {/* Pinned Files Section */}
      {pinnedFiles.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Pin size={14} className="text-[#E07020]" />
            <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              Pinned Files
            </h3>
            <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              Always in context
            </span>
          </div>
          <div className="space-y-2">
            {pinnedFiles.map(file => (
              <FileItem key={file.fileId} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Available Files Section */}
      {unpinnedFiles.length > 0 && (
        <div>
          {pinnedFiles.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <FileText size={14} style={{ color: 'var(--text-muted)' }} />
              <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Available Files
              </h3>
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                Added to context when referenced
              </span>
            </div>
          )}
          <div className="space-y-2">
            {unpinnedFiles.map(file => (
              <FileItem key={file.fileId} file={file} />
            ))}
          </div>
        </div>
      )}

      {/* Click outside handler */}
      {openMenuId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpenMenuId(null)}
        />
      )}
    </div>
  )
}

export default FilesList

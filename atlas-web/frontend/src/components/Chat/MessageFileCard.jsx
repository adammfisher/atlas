import React from 'react'
import { FileText, FileSpreadsheet, File, Image, FileArchive, FileCode, Presentation } from 'lucide-react'

/**
 * File card component for displaying file attachments in chat messages
 * Similar to Claude's file preview cards with file type badges
 */
function MessageFileCard({ file }) {
  const isImage = file.type?.startsWith('image/')
  const ext = getFileExtension(file.name)

  // For images with preview, show the image
  if (isImage && file.previewUrl) {
    return (
      <div className="relative flex-shrink-0 w-[100px] h-[80px] rounded-lg overflow-hidden border border-[var(--border-color)]">
        <img
          src={file.previewUrl}
          alt={file.name}
          className="w-full h-full object-cover"
          title={file.name}
        />
        <div className="absolute bottom-1 left-1">
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/60 text-white uppercase">
            {ext}
          </span>
        </div>
      </div>
    )
  }

  // For non-images, show file card with icon and badge
  const { icon: IconComponent, color } = getFileTypeInfo(file.type, file.name)

  return (
    <div
      className="relative flex-shrink-0 w-[100px] h-[80px] rounded-lg overflow-hidden border border-[var(--border-color)] flex flex-col"
      style={{ backgroundColor: 'hsl(30,3.3%,11.8%)' }}
    >
      {/* File name at top */}
      <div className="flex-1 px-2 pt-2 overflow-hidden">
        <span
          className="text-[11px] leading-tight block break-words line-clamp-2"
          style={{ color: 'hsl(50, 9%, 73.7%)' }}
          title={file.name}
        >
          {file.name}
        </span>
      </div>

      {/* Badge at bottom */}
      <div className="px-2 pb-2">
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded uppercase inline-block"
          style={{
            backgroundColor: 'hsl(30,3.3%,18%)',
            color: color
          }}
        >
          {ext || 'FILE'}
        </span>
      </div>
    </div>
  )
}

/**
 * Get file extension from filename
 */
function getFileExtension(filename) {
  if (!filename) return ''
  const parts = filename.split('.')
  if (parts.length > 1) {
    return parts.pop().toUpperCase()
  }
  return ''
}

/**
 * Get icon and color based on file type
 */
function getFileTypeInfo(mimeType, filename) {
  const ext = filename?.split('.').pop()?.toLowerCase()

  // ZIP files
  if (mimeType === 'application/zip' || ext === 'zip') {
    return { icon: FileArchive, color: '#F59E0B' } // Yellow
  }

  // PDF
  if (mimeType === 'application/pdf' || ext === 'pdf') {
    return { icon: FileText, color: '#EF4444' } // Red
  }

  // PowerPoint
  if (ext === 'pptx' || ext === 'ppt' || mimeType?.includes('presentation')) {
    return { icon: Presentation, color: '#F97316' } // Orange
  }

  // Excel/Spreadsheets
  if (mimeType?.includes('spreadsheet') || ['xlsx', 'xls', 'csv'].includes(ext)) {
    return { icon: FileSpreadsheet, color: '#22C55E' } // Green
  }

  // Word documents
  if (mimeType?.includes('word') || ['docx', 'doc'].includes(ext)) {
    return { icon: FileText, color: '#3B82F6' } // Blue
  }

  // Code files
  if (['js', 'jsx', 'ts', 'tsx', 'py', 'html', 'css', 'json', 'md'].includes(ext)) {
    return { icon: FileCode, color: '#8B5CF6' } // Purple
  }

  // Images
  if (mimeType?.startsWith('image/')) {
    return { icon: Image, color: '#EC4899' } // Pink
  }

  // Default
  return { icon: File, color: '#6B7280' } // Gray
}

export default MessageFileCard

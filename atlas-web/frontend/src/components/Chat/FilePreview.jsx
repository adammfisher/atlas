import React, { useState, useEffect } from 'react'
import { X, FileText, FileSpreadsheet, File, Image, FileArchive } from 'lucide-react'

function FilePreview({ files, onRemove }) {
  return (
    <div className="flex gap-2 px-3 py-2 overflow-x-auto">
      {files.map((file, index) => (
        <FileCard
          key={`${file.name}-${index}`}
          file={file}
          onRemove={() => onRemove(index)}
        />
      ))}
    </div>
  )
}

function FileCard({ file, onRemove }) {
  const isImage = file.type.startsWith('image/')
  const [preview, setPreview] = useState(null)

  useEffect(() => {
    if (isImage) {
      const url = URL.createObjectURL(file)
      setPreview(url)
      return () => URL.revokeObjectURL(url)
    }
  }, [file, isImage])

  const isZip = file.type === 'application/zip' || file.name.toLowerCase().endsWith('.zip')

  const getIcon = () => {
    if (isZip) return <FileArchive size={24} className="text-yellow-400" />
    if (file.type === 'application/pdf') return <FileText size={24} className="text-red-400" />
    if (file.type.includes('spreadsheet') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv'))
      return <FileSpreadsheet size={24} className="text-green-400" />
    if (file.type.includes('word') || file.name.endsWith('.docx') || file.name.endsWith('.doc'))
      return <FileText size={24} className="text-blue-400" />
    if (isImage) return <Image size={24} className="text-purple-400" />
    return <File size={24} className="text-surface-400" />
  }

  const truncateName = (name, maxLength = 12) => {
    if (name.length <= maxLength) return name
    const ext = name.split('.').pop()
    const nameWithoutExt = name.slice(0, name.length - ext.length - 1)
    const truncated = nameWithoutExt.slice(0, maxLength - ext.length - 3)
    return `${truncated}...${ext}`
  }

  return (
    <div className="relative flex-shrink-0 w-[100px] h-[80px] bg-[hsl(30,3.3%,11.8%)] rounded-lg overflow-hidden group border border-[var(--border-color)]">
      {isImage && preview ? (
        <img src={preview} alt={file.name} className="w-full h-full object-cover" />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 p-2">
          {getIcon()}
          <span
            className="text-[10px] text-center leading-tight max-w-full truncate px-1"
            style={{ color: 'hsl(50, 9%, 73.7%)' }}
            title={file.name}
          >
            {truncateName(file.name)}
          </span>
        </div>
      )}

      {/* Remove button */}
      <button
        onClick={onRemove}
        className="absolute top-1 right-1 p-0.5 bg-[hsl(60,2.7%,14.5%)] bg-opacity-80 rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-opacity-100"
      >
        <X size={12} style={{ color: 'hsl(48, 33.3%, 97.1%)' }} />
      </button>
    </div>
  )
}

export default FilePreview

import React, { useState, useRef, useEffect } from 'react'
import { ChevronDown, Star, Pencil, FolderPlus, Trash2, PanelRight } from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'

// Capitalize first letter of a string
const capitalizeFirst = (str) => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

function ChatTitleBar({ onRename, onDelete, onAddToProject, artifactsCount = 0, onToggleArtifacts, showArtifacts = false }) {
  const [showDropdown, setShowDropdown] = useState(false)
  const [isRenaming, setIsRenaming] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const dropdownRef = useRef(null)
  const inputRef = useRef(null)

  const { sessions, currentSessionId, updateSessionTitle, toggleSessionStar } = useChatStore()

  // Compute current session from sessions and currentSessionId
  const currentSession = sessions.find(s => s.id === currentSessionId) || null

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus input when renaming
  useEffect(() => {
    if (isRenaming && inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [isRenaming])

  if (!currentSession) return null

  const handleRenameClick = () => {
    setNewTitle(currentSession.title || 'New conversation')
    setIsRenaming(true)
    setShowDropdown(false)
  }

  const handleRenameSubmit = () => {
    if (newTitle.trim()) {
      updateSessionTitle(currentSession.id, newTitle.trim())
    }
    setIsRenaming(false)
  }

  const handleRenameKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleRenameSubmit()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
    }
  }

  const handleStarClick = () => {
    toggleSessionStar(currentSession.id)
    setShowDropdown(false)
  }

  const handleDeleteClick = () => {
    if (onDelete) {
      onDelete(currentSession.id)
    }
    setShowDropdown(false)
  }

  const handleAddToProjectClick = () => {
    if (onAddToProject) {
      onAddToProject(currentSession.id)
    }
    setShowDropdown(false)
  }

  return (
    <div className="h-12 border-b border-[var(--border-color)] flex items-center justify-between px-4">
      <div className="relative" ref={dropdownRef}>
        {isRenaming ? (
          <input
            ref={inputRef}
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onBlur={handleRenameSubmit}
            onKeyDown={handleRenameKeyDown}
            className="border border-[var(--border-color)] rounded px-2 py-1 text-[14px] outline-none focus:border-opacity-50"
            style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
          />
        ) : (
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <span
              className="text-[16px] font-bold max-w-[300px] truncate"
              style={{ fontFamily: 'var(--font-serif)' }}
            >
              {capitalizeFirst(currentSession.title) || 'New conversation'}
            </span>
            <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} />
          </button>
        )}

        {/* Dropdown menu */}
        {showDropdown && (
          <div
            className="absolute top-full left-0 mt-1 w-48 rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden z-50"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <button
              onClick={handleStarClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Star size={16} className={currentSession.starred ? 'fill-yellow-400 text-yellow-400' : ''} style={{ color: currentSession.starred ? undefined : 'var(--text-muted)' }} />
              <span className="text-[14px]">{currentSession.starred ? 'Unstar' : 'Star'}</span>
            </button>
            <button
              onClick={handleRenameClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Pencil size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[14px]">Rename</span>
            </button>
            <button
              onClick={handleAddToProjectClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              style={{ color: 'var(--text-primary)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <FolderPlus size={16} style={{ color: 'var(--text-muted)' }} />
              <span className="text-[14px]">Add to project</span>
            </button>
            <div className="border-t border-[var(--border-color)] my-1" />
            <button
              onClick={handleDeleteClick}
              className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
              style={{ color: '#ef4444' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
            >
              <Trash2 size={16} />
              <span className="text-[14px]">Delete</span>
            </button>
          </div>
        )}
      </div>

      {/* Artifacts button - on the right side of title bar */}
      {artifactsCount > 0 && !showArtifacts && (
        <button
          onClick={onToggleArtifacts}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)',
            color: 'var(--text-primary)'
          }}
        >
          <PanelRight size={16} style={{ color: 'var(--text-muted)' }} />
          <span className="text-[13px]">Artifacts</span>
          <span
            className="text-[11px] px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
          >
            {artifactsCount}
          </span>
        </button>
      )}
    </div>
  )
}

export default ChatTitleBar

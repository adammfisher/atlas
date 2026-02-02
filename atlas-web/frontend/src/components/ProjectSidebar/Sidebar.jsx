import React, { useState, useRef, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import {
  FolderOpen,
  Plus,
  FileText,
  MoreHorizontal,
  Search,
  X,
  Star,
  Pencil,
  FolderPlus,
  Trash2,
  Settings,
  Server,
  LogOut,
  ChevronUp
} from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'
import { useAuth } from '../../context/AuthContext'
import { sessionsService } from '../../services/chatService'
import SettingsModal from '../Settings/SettingsModal'
import MCPSettingsModal from '../Settings/MCPSettingsModal'

// Capitalize first letter of a string
const capitalizeFirst = (str) => {
  if (!str) return str
  return str.charAt(0).toUpperCase() + str.slice(1)
}

// Atlas Logo SVG Component
function AtlasLogo({ className = "" }) {
  return (


      <svg width="195" height="57" viewBox="0 0 195 57" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M28.984 20.8555C28.984 20.5348 28.7435 20.3744 28.2624 20.3744C27.9417 20.3744 27.5809 20.5548 27.18 20.9156C26.8192 21.2363 26.4785 21.5771 26.1578 21.9379L26.2179 21.8778L21.287 27.891H28.984V20.8555ZM38.5451 17.6685V40.3987C38.5451 40.7996 38.3647 41 38.0039 41H29.5853C29.1845 41 28.984 40.7996 28.984 40.3987V36.1292H15.0933L11.4252 40.7595C11.3851 40.9198 11.2248 41 10.9442 41H1.08239C0.801771 41 0.621372 40.8998 0.541195 40.6993C0.461018 40.4588 0.481062 40.2383 0.601328 40.0379L21.2269 12.6173C22.2291 11.8155 23.5119 11.2543 25.0754 10.9336C26.6388 10.6129 28.2624 10.4525 29.9461 10.4525C31.229 10.4525 32.3915 10.5728 33.4338 10.8133C34.5162 11.0138 35.4182 11.3946 36.1398 11.9559C36.9015 12.5171 37.4828 13.2587 37.8837 14.1808C38.3246 15.1028 38.5451 16.2654 38.5451 17.6685ZM39.2522 18.9313V10.9937C39.2522 10.6329 39.4526 10.4525 39.8535 10.4525H75.1514C75.5523 10.4525 75.7528 10.6329 75.7528 10.9937V18.9313C75.7528 19.2921 75.5523 19.4725 75.1514 19.4725H62.283V40.3987C62.283 40.7996 62.0826 41 61.6817 41H53.2631C52.9023 41 52.7219 40.7996 52.7219 40.3987V19.4725H39.8535C39.4526 19.4725 39.2522 19.2921 39.2522 18.9313ZM85.3721 10.4525C85.773 10.4525 85.9735 10.6329 85.9735 10.9937V31.9199H109.966C110.367 31.9199 110.568 32.1204 110.568 32.5213V40.3987C110.568 40.7996 110.367 41 109.966 41H81.6439C81.0025 41 80.3611 40.8597 79.7197 40.5791C79.1183 40.2584 78.5571 39.8575 78.0359 39.3764C77.5549 38.8553 77.154 38.294 76.8333 37.6927C76.5527 37.0513 76.4124 36.3898 76.4124 35.7083V10.9937C76.4124 10.6329 76.5928 10.4525 76.9535 10.4525H85.3721ZM138.585 20.8555C138.585 20.5348 138.345 20.3744 137.864 20.3744C137.543 20.3744 137.182 20.5548 136.781 20.9156C136.421 21.2363 136.08 21.5771 135.759 21.9379L135.819 21.8778L130.888 27.891H138.585V20.8555ZM148.147 17.6685V40.3987C148.147 40.7996 147.966 41 147.605 41H139.187C138.786 41 138.585 40.7996 138.585 40.3987V36.1292H124.695L121.027 40.7595C120.987 40.9198 120.826 41 120.546 41H110.684C110.403 41 110.223 40.8998 110.143 40.6993C110.062 40.4588 110.082 40.2383 110.203 40.0379L130.828 12.6173C131.831 11.8155 133.113 11.2543 134.677 10.9336C136.24 10.6129 137.864 10.4525 139.548 10.4525C140.83 10.4525 141.993 10.5728 143.035 10.8133C144.118 11.0138 145.02 11.3946 145.741 11.9559C146.503 12.5171 147.084 13.2587 147.485 14.1808C147.926 15.1028 148.147 16.2654 148.147 17.6685ZM179.521 29.8754H157.453C156.851 29.8754 156.23 29.7351 155.588 29.4545C154.987 29.1338 154.426 28.7329 153.905 28.2518C153.424 27.7307 153.023 27.1695 152.702 26.5681C152.381 25.9267 152.221 25.2652 152.221 24.5837V15.7442C152.221 15.1028 152.381 14.4614 152.702 13.82C153.023 13.1786 153.424 12.6173 153.905 12.1363C154.426 11.6151 154.987 11.2142 155.588 10.9336C156.23 10.6129 156.851 10.4525 157.453 10.4525H188.541C188.902 10.4525 189.082 10.6329 189.082 10.9937V18.9313C189.082 19.2921 188.902 19.4725 188.541 19.4725H161.782V21.517H183.851C184.492 21.517 185.114 21.6773 185.715 21.998C186.356 22.2787 186.918 22.6795 187.399 23.2007C187.92 23.7218 188.321 24.3031 188.601 24.9445C188.922 25.586 189.082 26.2274 189.082 26.8688V35.7083C189.082 36.3898 188.922 37.0513 188.601 37.6927C188.321 38.294 187.92 38.8553 187.399 39.3764C186.918 39.8575 186.356 40.2584 185.715 40.5791C185.114 40.8597 184.492 41 183.851 41H149.455C149.054 41 148.854 40.7996 148.854 40.3987V32.5213C148.854 32.1204 149.054 31.9199 149.455 31.9199H179.521V29.8754Z" fill="#B3B3B3"/>
      </svg>

  )
}

function Sidebar() {
  const navigate = useNavigate()
  const { projectId } = useParams()
  const [hoveredChat, setHoveredChat] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)
  const [renamingId, setRenamingId] = useState(null)
  const [renameValue, setRenameValue] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [showSearch, setShowSearch] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)
  const [showMCPSettingsModal, setShowMCPSettingsModal] = useState(false)
  const menuRef = useRef(null)
  const renameInputRef = useRef(null)
  const userMenuRef = useRef(null)

  const {
    sessions,
    currentSessionId,
    clearMessages,
    updateSessionTitle,
    toggleSessionStar,
    deleteSession,
    _hasHydrated,
    setSessions,
    sessionRefreshTrigger
  } = useChatStore()

  const { user: authUser, logout } = useAuth()

  // Build display user object from auth context
  const user = authUser ? {
    name: authUser.displayName || authUser.username,
    initials: (authUser.displayName || authUser.username || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
    plan: authUser.role === 'admin' ? 'Admin' : 'User'
  } : null

  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  // Fetch sessions from backend after hydration - only runs once when hydration completes
  useEffect(() => {
    // Wait for Zustand to hydrate from localStorage first
    if (!_hasHydrated) {
      console.log('[Sidebar] Waiting for hydration...')
      return
    }

    let isMounted = true

    const fetchSessions = async () => {
      try {
        console.log('[Sidebar] Fetching sessions from backend...')
        const backendSessions = await sessionsService.list()
        console.log('[Sidebar] Backend sessions received:', backendSessions?.length)

        if (!isMounted) return

        if (backendSessions && backendSessions.length > 0) {
          // Normalize session format
          const normalizedBackendSessions = backendSessions.map(s => ({
            id: s.id || s.sessionId,
            title: s.title || 'New conversation',
            starred: s.starred || false,
            projectId: s.projectId || null,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt
          }))

          // Merge with local sessions - keep local sessions that aren't in backend
          // BUT: Don't keep temp sessions that have already been migrated
          const localSessions = useChatStore.getState().sessions || []
          const currentSessionId = useChatStore.getState().currentSessionId
          const backendIds = new Set(normalizedBackendSessions.map(s => s.id))
          // Keep sessions that: (1) aren't in backend AND (2) are the CURRENT temp session (still being used)
          const localOnlySessions = localSessions.filter(s => {
            if (backendIds.has(s.id)) return false
            // Only keep temp sessions if they are the CURRENT active session
            // This prevents duplicate entries when a session was just migrated
            if (s.id.startsWith('session_')) {
              return s.id === currentSessionId
            }
            // Keep any other local session not in backend
            return true
          })

          // Combine: local-only sessions + backend sessions, sorted by date
          const mergedSessions = [...localOnlySessions, ...normalizedBackendSessions]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))

          console.log('[Sidebar] Merged', localOnlySessions.length, 'local +', normalizedBackendSessions.length, 'backend =', mergedSessions.length, 'sessions')
          setSessions(mergedSessions)
        } else {
          console.log('[Sidebar] No backend sessions, keeping local sessions (count:', useChatStore.getState().sessions?.length, ')')
        }
        setIsLoadingSessions(false)
      } catch (e) {
        console.error('[Sidebar] Failed to fetch sessions from backend:', e)
        if (isMounted) setIsLoadingSessions(false)
      }
    }

    fetchSessions()

    return () => { isMounted = false }
  }, [_hasHydrated, setSessions, sessionRefreshTrigger])

  // Close menu on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
      if (userMenuRef.current && !userMenuRef.current.contains(e.target)) {
        setShowUserMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Focus rename input
  useEffect(() => {
    if (renamingId && renameInputRef.current) {
      renameInputRef.current.focus()
      renameInputRef.current.select()
    }
  }, [renamingId])

  const handleNewChat = () => {
    clearMessages()
    navigate(projectId ? `/project/${projectId}` : '/')
  }

  // Chat menu handlers
  const handleMenuToggle = (e, sessionId) => {
    e.preventDefault()
    e.stopPropagation()
    setOpenMenuId(openMenuId === sessionId ? null : sessionId)
  }

  const handleStarSession = (sessionId) => {
    toggleSessionStar(sessionId)
    setOpenMenuId(null)
  }

  const handleRenameStart = (session) => {
    setRenameValue(session.title || 'New conversation')
    setRenamingId(session.id)
    setOpenMenuId(null)
  }

  const handleRenameSubmit = (sessionId) => {
    if (renameValue.trim()) {
      updateSessionTitle(sessionId, renameValue.trim())
    }
    setRenamingId(null)
  }

  const handleRenameKeyDown = (e, sessionId) => {
    if (e.key === 'Enter') {
      handleRenameSubmit(sessionId)
    } else if (e.key === 'Escape') {
      setRenamingId(null)
    }
  }

  const handleDeleteSession = async (sessionId) => {
    setOpenMenuId(null)

    // Delete from backend first (this also deletes messages, artifacts from DynamoDB and S3)
    try {
      await sessionsService.delete(sessionId)
      console.log('[Sidebar] Deleted session from backend:', sessionId)
    } catch (e) {
      console.error('[Sidebar] Failed to delete session from backend:', e)
    }

    // Delete from local store
    deleteSession(sessionId)

    if (currentSessionId === sessionId) {
      navigate(projectId ? `/project/${projectId}` : '/')
    }
  }

  const handleAddToProject = (sessionId) => {
    // For now, just show projects expanded and close menu
    // TODO: Implement project selection modal
    setProjectsExpanded(true)
    setOpenMenuId(null)
  }

  // Filter sessions by search query
  const filteredSessions = sessions.filter(session =>
    !searchQuery ||
    (session.title || 'New conversation').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <aside
      className="w-[220px] border-r flex flex-col h-full transition-colors duration-200"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: 'var(--border-color)',
        borderOpacity: 'var(--border-opacity)'
      }}
    >
      {/* Header with Atlas logo and search */}
      <div className="p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-center mb-2">
          <AtlasLogo />
        </div>
        <button
          onClick={() => setShowSearch(!showSearch)}
          className="self-end p-1.5 rounded transition-colors"
          style={{ color: 'var(--text-muted)' }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Search size={16} />
        </button>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 pb-2">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search chats..."
              className="w-full rounded-lg px-3 py-1.5 text-[13px] outline-none"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              }}
              autoFocus
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* New Chat Button */}
      <div className="px-3 pb-3">
        <button
          onClick={handleNewChat}
          className="w-full flex items-center gap-2 px-3 py-2 bg-transparent rounded-lg transition-colors"
          style={{
            color: 'var(--text-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
        >
          <Plus size={16} className="text-[#CD477E]" />
          <span className="text-[13px]">New chat</span>
        </button>
      </div>

      {/* Navigation Sections */}
      <div className="flex-1 overflow-y-auto px-3">
        {/* Projects Link */}
        <div className="mb-2">
          <Link
            to="/projects"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FolderOpen size={14} />
            <span>Projects</span>
          </Link>
        </div>

        {/* Artifacts Link */}
        <div className="mb-2">
          <Link
            to="/artifacts"
            className="flex items-center gap-2 w-full px-2 py-1.5 text-[13px] rounded-lg transition-colors"
            style={{ color: 'var(--text-primary)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <FileText size={14} />
            <span>Artifacts</span>
          </Link>
        </div>

        {/* Recents Section */}
        <div className="mb-2">
          <p className="text-[11px] uppercase tracking-wider px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
            Recents
          </p>

          <div className="mt-1">
            {isLoadingSessions ? (
              <div className="flex items-center gap-2 px-2 py-1.5">
                <div className="animate-spin rounded-full h-3 w-3 border-b border-[#CD477E]" />
                <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>Loading chats...</p>
              </div>
            ) : filteredSessions.length === 0 ? (
              <p className="text-[12px] px-2 py-1.5" style={{ color: 'var(--text-muted)' }}>
                {searchQuery ? 'No matching chats' : 'No conversations yet'}
              </p>
            ) : (
              filteredSessions.slice(0, 20).map(session => (
                <div
                  key={session.id}
                  className="relative group"
                  onMouseEnter={() => setHoveredChat(session.id)}
                  onMouseLeave={() => !openMenuId && setHoveredChat(null)}
                  ref={openMenuId === session.id ? menuRef : null}
                >
                  {renamingId === session.id ? (
                    <input
                      ref={renameInputRef}
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onBlur={() => handleRenameSubmit(session.id)}
                      onKeyDown={(e) => handleRenameKeyDown(e, session.id)}
                      className="w-full py-1 px-2 text-[11px] rounded-lg border border-[var(--border-color)] outline-none"
                      style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}
                    />
                  ) : (
                    <>
                      <Link
                        to={projectId ? `/project/${projectId}/chat/${session.id}` : `/chat/${session.id}`}
                        className="flex items-center py-1 px-2 text-[11px] rounded-lg transition-colors pr-6"
                        style={{
                          color: 'var(--text-primary)',
                          backgroundColor: currentSessionId === session.id ? 'var(--bg-tertiary)' : 'transparent'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => currentSessionId !== session.id && (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        {session.starred && (
                          <Star size={8} className="fill-yellow-400 text-yellow-400 mr-1 flex-shrink-0" />
                        )}
                        <span className="truncate">{capitalizeFirst(session.title) || 'New conversation'}</span>
                      </Link>
                      {(hoveredChat === session.id || openMenuId === session.id) && (
                        <button
                          onClick={(e) => handleMenuToggle(e, session.id)}
                          className="absolute right-1 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity"
                          style={{ color: 'var(--text-muted)' }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <MoreHorizontal size={12} />
                        </button>
                      )}
                      {/* Dropdown menu */}
                      {openMenuId === session.id && (
                        <div className="absolute right-0 top-full mt-1 w-40 rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden z-50" style={{ backgroundColor: 'var(--bg-secondary)' }}>
                          <button
                            onClick={() => handleStarSession(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Star size={14} className={session.starred ? 'fill-yellow-400 text-yellow-400' : ''} style={{ color: session.starred ? undefined : 'var(--text-muted)' }} />
                            <span className="text-[13px]">{session.starred ? 'Unstar' : 'Star'}</span>
                          </button>
                          <button
                            onClick={() => handleRenameStart(session)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Pencil size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[13px]">Rename</span>
                          </button>
                          <button
                            onClick={() => handleAddToProject(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <FolderPlus size={14} style={{ color: 'var(--text-muted)' }} />
                            <span className="text-[13px]">Add to project</span>
                          </button>
                          <div className="border-t border-[var(--border-color)] my-1" />
                          <button
                            onClick={() => handleDeleteSession(session.id)}
                            className="w-full flex items-center gap-2 px-3 py-2 transition-colors text-left"
                            style={{ color: '#ef4444' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={14} />
                            <span className="text-[13px]">Delete</span>
                          </button>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* User Profile Section */}
      <div className="border-t border-[var(--border-color)] p-3">
        <div className="relative" ref={userMenuRef}>
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className="w-full flex items-center gap-3 px-2 py-2 rounded-lg transition-colors"
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            {/* Avatar with initials */}
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-[12px] font-medium" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
              {user?.initials || 'U'}
            </div>
            {/* Name and plan */}
            <div className="flex-1 text-left">
              <p className="text-[13px] font-medium truncate" style={{ color: 'var(--text-primary)' }}>
                {user?.name || 'User'}
              </p>
              <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                {user?.plan || 'Free plan'}
              </p>
            </div>
            {/* Chevron */}
            <ChevronUp
              size={14}
              className={`transition-transform ${showUserMenu ? '' : 'rotate-180'}`}
              style={{ color: 'var(--text-muted)' }}
            />
          </button>

          {/* User Menu Dropdown */}
          {showUserMenu && (
            <div className="absolute bottom-full left-0 right-0 mb-1 rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden" style={{ backgroundColor: 'var(--bg-secondary)' }}>
              <button
                onClick={() => {
                  setShowSettingsModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Settings size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">Settings</span>
              </button>
              <button
                onClick={() => {
                  setShowMCPSettingsModal(true)
                  setShowUserMenu(false)
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <Server size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">MCP Servers</span>
              </button>
              <div className="border-t border-[var(--border-color)]" />
              <button
                onClick={async () => {
                  setShowUserMenu(false)
                  await logout()
                  navigate('/login')
                }}
                className="w-full flex items-center gap-3 px-4 py-2.5 transition-colors text-left"
                style={{ color: 'var(--text-primary)' }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                <LogOut size={16} style={{ color: 'var(--text-muted)' }} />
                <span className="text-[13px]">Log out</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Settings Modal */}
      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
      />

      {/* MCP Settings Modal */}
      <MCPSettingsModal
        isOpen={showMCPSettingsModal}
        onClose={() => setShowMCPSettingsModal(false)}
      />
    </aside>
  )
}

export default Sidebar

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

// Ally Atlas Logo SVG Component
function AllyLogo({ className = "" }) {
  return (

      <svg width="182" height="42" viewBox="0 0 182 42" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M62.9245 16.4571C62.9245 16.2255 62.7508 16.1098 62.4035 16.1098C62.172 16.1098 61.9115 16.24 61.6221 16.5005C61.3616 16.732 61.1156 16.978 60.8841 17.2385L60.9275 17.1951L57.3678 21.5362H62.9245V16.4571ZM69.8269 14.1562V30.5659C69.8269 30.8553 69.6967 31 69.4362 31H63.3586C63.0692 31 62.9245 30.8553 62.9245 30.5659V27.4836H52.8964L50.2482 30.8264C50.2193 30.9421 50.1035 31 49.9009 31H42.7814C42.5788 31 42.4486 30.9276 42.3907 30.7829C42.3328 30.6093 42.3473 30.4501 42.4341 30.3054L57.3244 10.5096C58.0479 9.93082 58.974 9.52565 60.1027 9.29412C61.2314 9.06259 62.4035 8.94682 63.6191 8.94682C64.5452 8.94682 65.3845 9.03365 66.1369 9.20729C66.9184 9.352 67.5695 9.62694 68.0905 10.0321C68.6404 10.4373 69.06 10.9727 69.3494 11.6384C69.6678 12.304 69.8269 13.1433 69.8269 14.1562ZM70.3374 15.0679V9.33753C70.3374 9.07706 70.4821 8.94682 70.7715 8.94682H96.2542C96.5436 8.94682 96.6883 9.07706 96.6883 9.33753V15.0679C96.6883 15.3284 96.5436 15.4586 96.2542 15.4586H86.9641V30.5659C86.9641 30.8553 86.8194 31 86.53 31H80.4523C80.1918 31 80.0616 30.8553 80.0616 30.5659V15.4586H70.7715C70.4821 15.4586 70.3374 15.3284 70.3374 15.0679ZM103.633 8.94682C103.922 8.94682 104.067 9.07706 104.067 9.33753V24.4448H121.388C121.678 24.4448 121.822 24.5895 121.822 24.8789V30.5659C121.822 30.8553 121.678 31 121.388 31H100.941C100.478 31 100.015 30.8987 99.5521 30.6961C99.118 30.4646 98.7128 30.1752 98.3366 29.8279C97.9893 29.4516 97.6999 29.0465 97.4684 28.6124C97.2658 28.1493 97.1645 27.6718 97.1645 27.1798V9.33753C97.1645 9.07706 97.2947 8.94682 97.5552 8.94682H103.633ZM142.049 16.4571C142.049 16.2255 141.876 16.1098 141.528 16.1098C141.297 16.1098 141.036 16.24 140.747 16.5005C140.486 16.732 140.24 16.978 140.009 17.2385L140.052 17.1951L136.492 21.5362H142.049V16.4571ZM148.952 14.1562V30.5659C148.952 30.8553 148.821 31 148.561 31H142.483C142.194 31 142.049 30.8553 142.049 30.5659V27.4836H132.021L129.373 30.8264C129.344 30.9421 129.228 31 129.026 31H121.906C121.704 31 121.573 30.9276 121.515 30.7829C121.458 30.6093 121.472 30.4501 121.559 30.3054L136.449 10.5096C137.173 9.93082 138.099 9.52565 139.227 9.29412C140.356 9.06259 141.528 8.94682 142.744 8.94682C143.67 8.94682 144.509 9.03365 145.262 9.20729C146.043 9.352 146.694 9.62694 147.215 10.0321C147.765 10.4373 148.185 10.9727 148.474 11.6384C148.792 12.304 148.952 13.1433 148.952 14.1562ZM171.602 22.9688H155.67C155.236 22.9688 154.787 22.8675 154.324 22.6649C153.89 22.4334 153.485 22.144 153.109 21.7967C152.761 21.4205 152.472 21.0153 152.24 20.5812C152.009 20.1181 151.893 19.6406 151.893 19.1486V12.7671C151.893 12.304 152.009 11.8409 152.24 11.3779C152.472 10.9148 152.761 10.5096 153.109 10.1624C153.485 9.78612 153.89 9.4967 154.324 9.29412C154.787 9.06259 155.236 8.94682 155.67 8.94682H178.114C178.374 8.94682 178.505 9.07706 178.505 9.33753V15.0679C178.505 15.3284 178.374 15.4586 178.114 15.4586H158.796V16.9346H174.728C175.191 16.9346 175.639 17.0504 176.074 17.2819C176.537 17.4845 176.942 17.7739 177.289 18.1501C177.665 18.5264 177.955 18.946 178.157 19.4091C178.389 19.8721 178.505 20.3352 178.505 20.7982V27.1798C178.505 27.6718 178.389 28.1493 178.157 28.6124C177.955 29.0465 177.665 29.4516 177.289 29.8279C176.942 30.1752 176.537 30.4646 176.074 30.6961C175.639 30.8987 175.191 31 174.728 31H149.896C149.607 31 149.462 30.8553 149.462 30.5659V24.8789C149.462 24.5895 149.607 24.4448 149.896 24.4448H171.602V22.9688Z" fill="#B3B3B3"/>
        <path d="M12.2749 1.20557H15.5204V16.3078H12.2749V1.20557Z" fill="#BE507D"/>
        <path d="M17.0697 1.20557H20.3152V16.3078H17.0697V1.20557Z" fill="#BE507D"/>
        <path d="M21.2001 5.34509H24.7407L26.8797 12.0145L29.0188 5.34497H32.5588L27.0267 20.5238H23.4867L25.1788 16.2315L21.2001 5.34509Z" fill="#BE507D"/>
        <path d="M10.8544 10.906C10.8592 10.1436 10.7248 9.38726 10.4582 8.677C10.0719 7.63911 9.3893 6.74891 8.50204 6.12593C7.61479 5.50295 6.56537 5.17702 5.49471 5.19189C2.07571 5.19189 0 7.70921 0 10.9061C0 14.0359 2.36431 16.4833 4.89711 16.5482L7.69917 13.326L7.65361 13.2458V16.3216H10.8544V10.906ZM7.64231 13.2579L5.43727 13.2637C3.92631 13.2637 2.25642 11.0037 3.95963 9.23295C5.47129 7.66186 7.73634 8.95044 7.73634 11.1368L7.64231 13.2579Z" fill="#BE507D"/>
        <line x1="37.9853" y1="2.63554e-08" x2="37.9853" y2="32.5588" stroke="#828282" stroke-width="1.20588"/>
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
      {/* Header with Ally logo and search */}
      <div className="p-3 flex flex-col items-center">
        <div className="w-full flex items-center justify-center mb-2">
          <AllyLogo />
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

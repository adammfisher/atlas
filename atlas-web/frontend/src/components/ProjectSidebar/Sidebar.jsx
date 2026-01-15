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

// Ally Logo SVG Component
function AllyLogo({ className = "" }) {
  return (
      <svg width="144" height="31" viewBox="0 0 144 31" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M40.4624 30L51.6944 4.8H57.4544L68.7224 30H62.6024L53.3864 7.752H55.6904L46.4384 30H40.4624ZM46.0784 24.6L47.6264 20.172H60.5864L62.1704 24.6H46.0784ZM69.8913 30V9.552H61.8273V4.8H83.7873V9.552H75.7233V30H69.8913ZM83.3252 30V4.8H89.1572V25.248H101.793V30H83.3252ZM98.2803 30L109.512 4.8H115.272L126.54 30H120.42L111.204 7.752H113.508L104.256 30H98.2803ZM103.896 24.6L105.444 20.172H118.404L119.988 24.6H103.896ZM132.035 30.432C130.019 30.432 128.087 30.168 126.239 29.64C124.391 29.088 122.903 28.38 121.775 27.516L123.755 23.124C124.835 23.892 126.107 24.528 127.571 25.032C129.059 25.512 130.559 25.752 132.071 25.752C133.223 25.752 134.147 25.644 134.843 25.428C135.563 25.188 136.091 24.864 136.427 24.456C136.763 24.048 136.931 23.58 136.931 23.052C136.931 22.38 136.667 21.852 136.139 21.468C135.611 21.06 134.915 20.736 134.051 20.496C133.187 20.232 132.227 19.992 131.171 19.776C130.139 19.536 129.095 19.248 128.039 18.912C127.007 18.576 126.059 18.144 125.195 17.616C124.331 17.088 123.623 16.392 123.071 15.528C122.543 14.664 122.279 13.56 122.279 12.216C122.279 10.776 122.663 9.468 123.431 8.292C124.223 7.092 125.399 6.144 126.959 5.448C128.543 4.728 130.523 4.368 132.899 4.368C134.483 4.368 136.043 4.56 137.579 4.944C139.115 5.304 140.471 5.856 141.647 6.6L139.847 11.028C138.671 10.356 137.495 9.864 136.319 9.552C135.143 9.216 133.991 9.048 132.863 9.048C131.735 9.048 130.811 9.18 130.091 9.444C129.371 9.708 128.855 10.056 128.543 10.488C128.231 10.896 128.075 11.376 128.075 11.928C128.075 12.576 128.339 13.104 128.867 13.512C129.395 13.896 130.091 14.208 130.955 14.448C131.819 14.688 132.767 14.928 133.799 15.168C134.855 15.408 135.899 15.684 136.931 15.996C137.987 16.308 138.947 16.728 139.811 17.256C140.675 17.784 141.371 18.48 141.899 19.344C142.451 20.208 142.727 21.3 142.727 22.62C142.727 24.036 142.331 25.332 141.539 26.508C140.747 27.684 139.559 28.632 137.975 29.352C136.415 30.072 134.435 30.432 132.035 30.432Z" fill="#C9C7C7"/>
        <path d="M16.4948 0L20.856 0V19.5437H16.4948V0Z" fill="#CD477E"/>
        <path d="M22.9381 0L27.2994 0V19.5437H22.9381V0Z" fill="#CD477E"/>
        <path d="M28.4885 5.35721H33.2464L36.1207 13.9881L38.9952 5.35706H43.7523L36.3183 25H31.5612L33.8351 19.4453L28.4885 5.35721Z" fill="#CD477E"/>
        <path d="M14.586 12.5536C14.5925 11.567 14.4119 10.5882 14.0537 9.66902C13.5345 8.32588 12.6173 7.17388 11.425 6.36768C10.2327 5.56149 8.82249 5.1397 7.38375 5.15896C2.78932 5.15896 0 8.41661 0 12.5537C0 16.604 3.17715 19.7711 6.58069 19.8551L10.3461 15.6852L10.2849 15.5815V19.5619H14.586V12.5536ZM10.2697 15.5971L7.30656 15.6047C5.27614 15.6047 3.03216 12.68 5.32092 10.3885C7.35227 8.35533 10.396 10.0229 10.396 12.8522L10.2697 15.5971Z" fill="#CD477E"/>
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
    user
  } = useChatStore()

  const { logout } = useAuth()

  const [isLoadingSessions, setIsLoadingSessions] = useState(true)

  // Fetch sessions from backend on mount - always fetch immediately
  useEffect(() => {
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
          const localSessions = useChatStore.getState().sessions || []
          const backendIds = new Set(normalizedBackendSessions.map(s => s.id))
          const localOnlySessions = localSessions.filter(s => !backendIds.has(s.id))

          // Combine: local-only sessions + backend sessions, sorted by date
          const mergedSessions = [...localOnlySessions, ...normalizedBackendSessions]
            .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))

          console.log('[Sidebar] Merged', localOnlySessions.length, 'local +', normalizedBackendSessions.length, 'backend =', mergedSessions.length, 'sessions')
          useChatStore.getState().setSessions(mergedSessions)
          setIsLoadingSessions(false)
        } else {
          console.log('[Sidebar] No backend sessions, keeping local sessions')
          setIsLoadingSessions(false)
        }
      } catch (e) {
        console.error('[Sidebar] Failed to fetch sessions from backend:', e)
        if (isMounted) setIsLoadingSessions(false)
      }
    }

    fetchSessions()

    return () => { isMounted = false }
  }, [])

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

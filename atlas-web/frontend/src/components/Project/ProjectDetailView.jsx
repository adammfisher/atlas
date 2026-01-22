import React, { useState, useEffect, useMemo, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import {
  ArrowLeft,
  MoreHorizontal,
  Star,
  Plus,
  Lock,
  Pencil,
  X,
  // ChevronDown, // Model dropdown disabled
  FileText,
  Upload,
  Trash2,
  ArrowUp
} from 'lucide-react'
import { projectsService, sessionsService, artifactsService } from '../../services/chatService'
import { useChatStore } from '../../hooks/useChatStore'
import FileCard from './FileCard'
import FileViewerModal from './FileViewerModal'

// Model selection disabled - using Haiku as default
// const MODELS = [
//   { id: 'haiku', name: 'Haiku 4.5', description: 'Fast & efficient' },
//   { id: 'sonnet', name: 'Sonnet 4.5', description: 'Balanced' },
//   { id: 'opus', name: 'Opus 4.5', description: 'Most powerful' },
// ]

function ProjectDetailView() {
  const { projectId } = useParams()
  const navigate = useNavigate()
  const fileInputRef = useRef(null)

  const [project, setProject] = useState(null)
  const [files, setFiles] = useState([])
  const [artifacts, setArtifacts] = useState([])
  const [memory, setMemory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarred, setIsStarred] = useState(false)

  // Modals
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)
  const [showMenuDropdown, setShowMenuDropdown] = useState(false)
  const [viewingFile, setViewingFile] = useState(null) // File viewer modal

  // Instructions editing
  const [instructions, setInstructions] = useState('')
  const [editingInstructions, setEditingInstructions] = useState('')

  // Memory editing
  const [editingMemory, setEditingMemory] = useState(null) // { factId, content, category }
  const [newMemoryContent, setNewMemoryContent] = useState('')
  const [showAddMemory, setShowAddMemory] = useState(false)
  const [memoryOperationLoading, setMemoryOperationLoading] = useState(false)

  // New chat input
  const [chatInput, setChatInput] = useState('')
  // Model selection disabled - using Haiku as default
  const [selectedModel] = useState('haiku')
  // const [selectedModel, setSelectedModel] = useState('haiku')
  // const [showModelDropdown, setShowModelDropdown] = useState(false)
  // const modelDropdownRef = useRef(null)

  const { updateProject, sessions, deleteProject, deleteSession, addSession, setCurrentSession, projectMemoryContext, setProjectMemoryContext } = useChatStore()

  // Get chats for this project
  const projectChats = useMemo(() => {
    return sessions.filter(s => s.projectId === projectId)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
  }, [sessions, projectId])

  // Load project data
  useEffect(() => {
    if (!projectId) return

    const loadProject = async () => {
      setIsLoading(true)
      try {
        const [projectData, filesData, memoryData, artifactsData] = await Promise.all([
          projectsService.get(projectId),
          projectsService.listFiles(projectId).catch(() => []),
          projectsService.getMemory(projectId).catch(() => null),
          artifactsService.listForProject(projectId).catch(() => [])
        ])

        setProject(projectData)
        setFiles(filesData || [])
        setArtifacts(artifactsData || [])
        setMemory(memoryData)
        setInstructions(projectData.instructions || '')
        setIsStarred(projectData.starred || false)
      } catch (err) {
        console.error('Failed to load project:', err)
      } finally {
        setIsLoading(false)
      }
    }

    loadProject()
  }, [projectId])

  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return

    try {
      const uploaded = await projectsService.uploadFile(projectId, file, false)
      setFiles(prev => [...prev, uploaded])
    } catch (err) {
      console.error('Failed to upload file:', err)
    }
  }

  const handleDeleteFile = async (fileId) => {
    try {
      await projectsService.deleteFile(projectId, fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (err) {
      console.error('Failed to delete file:', err)
    }
  }

  const handleSaveInstructions = async () => {
    try {
      await projectsService.update(projectId, { instructions: editingInstructions })
      setInstructions(editingInstructions)
      setShowInstructionsModal(false)
    } catch (err) {
      console.error('Failed to save instructions:', err)
    }
  }

  const handleToggleStar = async () => {
    try {
      await projectsService.update(projectId, { starred: !isStarred })
      setIsStarred(!isStarred)
    } catch (err) {
      console.error('Failed to toggle star:', err)
    }
  }

  // Model dropdown disabled - Close model dropdown on outside click
  // useEffect(() => {
  //   const handleClickOutside = (e) => {
  //     if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target)) {
  //       setShowModelDropdown(false)
  //     }
  //   }
  //   document.addEventListener('mousedown', handleClickOutside)
  //   return () => document.removeEventListener('mousedown', handleClickOutside)
  // }, [])

  // Start new chat with initial message
  const handleStartChat = async () => {
    if (!chatInput.trim()) return

    try {
      // Create a new session with projectId
      const session = await sessionsService.create({
        projectId,
        model: selectedModel
      })

      // Add to store and set as current
      addSession(session)
      setCurrentSession(session.id)

      // Navigate to the chat with initial message as URL param
      const encodedMessage = encodeURIComponent(chatInput.trim())
      navigate(`/project/${projectId}/chat/${session.id}?initialMessage=${encodedMessage}`)
    } catch (err) {
      console.error('Failed to start chat:', err)
    }
  }

  const handleChatInputKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleStartChat()
    }
  }

  // Model selector disabled - using Haiku
  // const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[2]

  const handleDeleteProject = async () => {
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }
    try {
      await projectsService.delete(projectId)
      deleteProject(projectId)
      navigate('/projects')
    } catch (err) {
      console.error('Failed to delete project:', err)
    }
  }

  const handleDeleteChat = async (e, chatId) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this chat? This action cannot be undone.')) {
      return
    }
    try {
      await projectsService.deleteChat(projectId, chatId)
      deleteSession(chatId)
    } catch (err) {
      console.error('Failed to delete chat:', err)
    }
  }

  const formatTimeAgo = (dateStr) => {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    const now = new Date()
    const diffMs = now - date
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))

    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  // Memory handlers
  const handleDeleteMemory = async (factId) => {
    if (!window.confirm('Delete this memory?')) return
    setMemoryOperationLoading(true)
    try {
      await projectsService.deleteSemanticMemory(projectId, factId)
      // Update local state
      const memContext = projectMemoryContext[projectId]
      if (memContext) {
        setProjectMemoryContext(projectId, {
          ...memContext,
          memories: (memContext.memories || []).filter(m => m.factId !== factId),
          semanticMemoryCount: Math.max(0, (memContext.semanticMemoryCount || 0) - 1)
        })
      }
    } catch (err) {
      console.error('Failed to delete memory:', err)
    } finally {
      setMemoryOperationLoading(false)
    }
  }

  const handleUpdateMemory = async () => {
    if (!editingMemory || !editingMemory.content.trim()) return
    setMemoryOperationLoading(true)
    try {
      await projectsService.updateSemanticMemory(projectId, editingMemory.factId, editingMemory.content, editingMemory.category)
      // Update local state
      const memContext = projectMemoryContext[projectId]
      if (memContext) {
        setProjectMemoryContext(projectId, {
          ...memContext,
          memories: (memContext.memories || []).map(m =>
            m.factId === editingMemory.factId ? { ...m, content: editingMemory.content, category: editingMemory.category } : m
          )
        })
      }
      setEditingMemory(null)
    } catch (err) {
      console.error('Failed to update memory:', err)
    } finally {
      setMemoryOperationLoading(false)
    }
  }

  const handleAddMemory = async () => {
    if (!newMemoryContent.trim()) return
    setMemoryOperationLoading(true)
    try {
      const result = await projectsService.addSemanticMemory(projectId, newMemoryContent, 'general')
      // Update local state
      const memContext = projectMemoryContext[projectId] || { memories: [], conversations: [], semanticMemoryCount: 0, relevantConversationsCount: 0 }
      const newMemory = {
        factId: result.factId,
        content: newMemoryContent,
        category: 'general',
        confidence: 1.0,
        score: 1.0
      }
      setProjectMemoryContext(projectId, {
        ...memContext,
        memories: [newMemory, ...(memContext.memories || [])],
        semanticMemoryCount: (memContext.semanticMemoryCount || 0) + 1
      })
      setNewMemoryContent('')
      setShowAddMemory(false)
    } catch (err) {
      console.error('Failed to add memory:', err)
    } finally {
      setMemoryOperationLoading(false)
    }
  }

  // Calculate file capacity
  const totalCapacity = 200000 // Example: 200k tokens
  const usedCapacity = files.reduce((sum, f) => sum + (f.tokenCount || 0), 0)
  const capacityPercent = Math.min((usedCapacity / totalCapacity) * 100, 100)

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center" style={{ backgroundColor: 'var(--bg-primary)' }}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CD477E]" />
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col" style={{ backgroundColor: 'var(--bg-primary)' }}>
      {/* Header */}
      <div className="px-6 py-4 border-b" style={{ borderColor: 'var(--border-color)' }}>
        <Link
          to="/projects"
          className="inline-flex items-center gap-1 text-sm mb-4 hover:underline"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft size={16} />
          All projects
        </Link>

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-light" style={{ color: 'var(--text-primary)' }}>
            {project?.name}
          </h1>
          <div className="flex items-center gap-2">
            <div className="relative">
              <button
                onClick={() => setShowMenuDropdown(!showMenuDropdown)}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                style={{ color: 'var(--text-muted)' }}
              >
                <MoreHorizontal size={20} />
              </button>
              {showMenuDropdown && (
                <div
                  className="absolute right-0 top-full mt-1 w-40 rounded-lg shadow-lg overflow-hidden z-10"
                  style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
                >
                  <button
                    onClick={() => { /* rename */ setShowMenuDropdown(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-primary)' }}
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => { /* archive */ setShowMenuDropdown(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)]"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    Archive
                  </button>
                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }} />
                  <button
                    onClick={() => { handleDeleteProject(); setShowMenuDropdown(false) }}
                    className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)] text-red-500"
                  >
                    Delete
                  </button>
                </div>
              )}
            </div>
            <button
              onClick={handleToggleStar}
              className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
              style={{ color: isStarred ? '#facc15' : 'var(--text-muted)' }}
            >
              <Star size={20} fill={isStarred ? '#facc15' : 'none'} />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel - Write & Chats */}
        <div className="flex-1 flex flex-col overflow-hidden border-r" style={{ borderColor: 'var(--border-color)' }}>
          {/* Write Input */}
          <div className="p-6">
            <div
              className="rounded-xl p-4"
              style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
            >
              <div className="flex items-center gap-3">
                <button
                  className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)] transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Plus size={18} />
                </button>
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatInputKeyDown}
                  placeholder="Start a new chat..."
                  className="flex-1 bg-transparent outline-none text-sm"
                  style={{ color: 'var(--text-primary)' }}
                />
                {/* Model Selector - disabled, using Haiku as default */}
                <span
                  className="text-sm px-2 py-1"
                  style={{ color: 'var(--text-muted)' }}
                >
                  Haiku 4.5
                </span>
                {/* Submit Button */}
                <button
                  onClick={handleStartChat}
                  disabled={!chatInput.trim()}
                  className={`p-2 rounded-full transition-colors ${
                    chatInput.trim() ? 'bg-[#CD477E] text-white' : 'bg-[var(--bg-tertiary)]'
                  }`}
                  style={{ color: chatInput.trim() ? 'white' : 'var(--text-muted)' }}
                >
                  <ArrowUp size={16} />
                </button>
              </div>
            </div>
          </div>

          {/* Chats List */}
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            {projectChats.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  No conversations yet
                </p>
                <Link
                  to={`/project/${projectId}`}
                  className="inline-block mt-3 text-sm text-[#CD477E] hover:underline"
                >
                  Start a new chat
                </Link>
              </div>
            ) : (
              <div className="space-y-1">
                {projectChats.map(chat => (
                  <div
                    key={chat.id}
                    className="group flex items-center gap-2 p-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <Link
                      to={`/project/${projectId}/chat/${chat.id}`}
                      className="flex-1 min-w-0"
                    >
                      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {chat.title || 'New conversation'}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                        Last message {formatTimeAgo(chat.updatedAt || chat.createdAt)}
                      </p>
                    </Link>
                    <button
                      onClick={(e) => handleDeleteChat(e, chat.id)}
                      className="p-1.5 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-all"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete chat"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="w-80 flex-shrink-0 overflow-y-auto p-6 space-y-6">
          {/* Memory Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Memory
              </span>
              <div className="flex items-center gap-2">
                <Lock size={14} style={{ color: 'var(--text-muted)' }} />
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>Only you</span>
                <button
                  onClick={() => setShowMemoryModal(true)}
                  className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                  style={{ color: 'var(--text-muted)' }}
                >
                  <Pencil size={14} />
                </button>
              </div>
            </div>
            {(() => {
              const memContext = projectMemoryContext[projectId]
              if (memContext && (memContext.semanticMemoryCount > 0 || memContext.relevantConversationsCount > 0)) {
                return (
                  <>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {memContext.semanticMemoryCount} semantic {memContext.semanticMemoryCount === 1 ? 'memory' : 'memories'}
                      {memContext.relevantConversationsCount > 0 && (
                        <>, {memContext.relevantConversationsCount} {memContext.relevantConversationsCount === 1 ? 'conversation' : 'conversations'}</>
                      )}
                    </p>
                    {/* Preview first few memories */}
                    {memContext.memories?.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {memContext.memories.slice(0, 3).map((mem, idx) => (
                          <p key={idx} className="text-xs line-clamp-1" style={{ color: 'var(--text-muted)' }}>
                            • {mem.content}
                          </p>
                        ))}
                        {memContext.memories.length > 3 && (
                          <p className="text-xs" style={{ color: 'var(--accent-color)' }}>
                            +{memContext.memories.length - 3} more
                          </p>
                        )}
                      </div>
                    )}
                    {memContext.lastUpdated && (
                      <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                        Last retrieved {formatTimeAgo(memContext.lastUpdated)}
                      </p>
                    )}
                  </>
                )
              }
              return (
                <>
                  <p className="text-sm line-clamp-3" style={{ color: 'var(--text-muted)' }}>
                    {memory?.purposeContext || 'No memory yet. Start chatting to build project memory.'}
                  </p>
                  {memory?.updatedAt && (
                    <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                      Last updated {formatTimeAgo(memory.updatedAt)}
                    </p>
                  )}
                </>
              )
            })()}
          </div>

          {/* Instructions Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Instructions
              </span>
              <button
                onClick={() => { setEditingInstructions(instructions); setShowInstructionsModal(true) }}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={14} />
              </button>
            </div>
            {instructions ? (
              <p className="text-sm line-clamp-2" style={{ color: 'var(--text-muted)' }}>
                {instructions}
              </p>
            ) : (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                Add instructions to tailor Claude's responses
              </p>
            )}
          </div>

          {/* Files Section */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                Files
              </span>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-1 rounded hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <Plus size={14} />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Capacity Bar */}
            <div className="mb-3">
              <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-tertiary)' }}>
                <div
                  className="h-full rounded-full bg-[#CD477E]"
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                {Math.round(capacityPercent)}% of project capacity used
              </p>
            </div>

            {/* Files Grid */}
            {files.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No files yet
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {files.map(file => (
                  <div key={file.id} className="relative group">
                    <FileCard
                      file={{ ...file, name: file.filename || file.name }}
                      onClick={() => setViewingFile(file)}
                    />
                    {/* Delete button overlay */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteFile(file.id); }}
                      className="absolute top-2 right-2 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity z-10"
                      style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                      title="Delete file"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Artifacts Section */}
          {artifacts.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  Artifacts
                </span>
                <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                  {artifacts.length}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {artifacts.map(artifact => (
                  <div key={artifact.id || artifact.artifactId} className="relative group">
                    <FileCard
                      file={{
                        id: artifact.id || artifact.artifactId,
                        name: artifact.name || artifact.title + (artifact.file_extension || ''),
                        type: artifact.content_type || artifact.type,
                        tokenCount: artifact.size ? Math.round(artifact.size / 4) : null
                      }}
                      onClick={() => setViewingFile({
                        ...artifact,
                        id: artifact.id || artifact.artifactId,
                        fileId: artifact.id || artifact.artifactId,
                        name: artifact.name || artifact.title + (artifact.file_extension || ''),
                        type: artifact.content_type || artifact.type,
                        isArtifact: true
                      })}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)', zIndex: 10 }}>
              <h2 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
                Manage project memory
              </h2>
              <button
                onClick={() => setShowMemoryModal(false)}
                className="p-2 rounded-lg hover:bg-[var(--bg-tertiary)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Memory is automatically extracted from conversations. You can also add, edit, or delete memories.
                </p>
                <button
                  onClick={() => setShowAddMemory(!showAddMemory)}
                  className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-1"
                  style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-primary)' }}
                >
                  <Plus size={14} />
                  Add
                </button>
              </div>

              {/* Add New Memory Form */}
              {showAddMemory && (
                <div className="mb-6 p-4 rounded-lg" style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}>
                  <h4 className="text-sm font-medium mb-2" style={{ color: 'var(--text-primary)' }}>Add a memory</h4>
                  <textarea
                    value={newMemoryContent}
                    onChange={(e) => setNewMemoryContent(e.target.value)}
                    placeholder="Enter a fact or piece of information about this project..."
                    className="w-full p-3 rounded-lg text-sm resize-none"
                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                    rows={3}
                  />
                  <div className="flex items-center justify-end gap-2 mt-3">
                    <button
                      onClick={() => { setShowAddMemory(false); setNewMemoryContent(''); }}
                      className="px-3 py-1.5 text-sm rounded"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleAddMemory}
                      disabled={!newMemoryContent.trim() || memoryOperationLoading}
                      className="px-4 py-1.5 text-sm rounded bg-[#CD477E] text-white disabled:opacity-50"
                    >
                      {memoryOperationLoading ? 'Adding...' : 'Add Memory'}
                    </button>
                  </div>
                </div>
              )}

              {/* Semantic Memories Section */}
              {(() => {
                const memContext = projectMemoryContext[projectId]
                const memories = memContext?.memories || []
                const conversations = memContext?.conversations || []

                if (memories.length === 0 && conversations.length === 0 && !memory && !showAddMemory) {
                  return (
                    <div className="text-center py-8">
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        No memories yet. Start chatting or add memories manually.
                      </p>
                    </div>
                  )
                }

                // Group memories by category
                const memoriesByCategory = memories.reduce((acc, mem) => {
                  const cat = mem.category || 'general'
                  if (!acc[cat]) acc[cat] = []
                  acc[cat].push(mem)
                  return acc
                }, {})

                return (
                  <div className="space-y-6">
                    {/* Semantic Memories */}
                    {Object.entries(memoriesByCategory).map(([category, categoryMemories]) => (
                      <div key={category}>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium capitalize" style={{ color: 'var(--text-primary)' }}>
                            {category.replace(/_/g, ' ')}
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            {categoryMemories.length} {categoryMemories.length === 1 ? 'memory' : 'memories'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {categoryMemories.map((mem, idx) => (
                            <div
                              key={mem.factId || idx}
                              className="group p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                            >
                              {editingMemory?.factId === mem.factId ? (
                                // Edit mode
                                <div className="space-y-3">
                                  <textarea
                                    value={editingMemory.content}
                                    onChange={(e) => setEditingMemory({ ...editingMemory, content: e.target.value })}
                                    className="w-full p-2 rounded text-sm resize-none"
                                    style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)' }}
                                    rows={3}
                                    autoFocus
                                  />
                                  <div className="flex items-center gap-2 justify-end">
                                    <button
                                      onClick={() => setEditingMemory(null)}
                                      className="px-3 py-1.5 text-xs rounded"
                                      style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      onClick={handleUpdateMemory}
                                      disabled={memoryOperationLoading}
                                      className="px-3 py-1.5 text-xs rounded bg-[#CD477E] text-white"
                                    >
                                      {memoryOperationLoading ? 'Saving...' : 'Save'}
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // Display mode
                                <div className="flex items-start gap-3">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                                      {mem.content}
                                    </p>
                                    <div className="flex items-center gap-3 mt-2">
                                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                        Score: {(mem.score * 100).toFixed(0)}%
                                      </span>
                                      {mem.confidence && (
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                          Confidence: {(mem.confidence * 100).toFixed(0)}%
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => setEditingMemory({ factId: mem.factId, content: mem.content, category: mem.category || 'general' })}
                                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                                      style={{ color: 'var(--text-muted)' }}
                                      title="Edit memory"
                                    >
                                      <Pencil size={14} />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteMemory(mem.factId)}
                                      disabled={memoryOperationLoading}
                                      className="p-1.5 rounded hover:bg-[var(--bg-tertiary)]"
                                      style={{ color: 'var(--text-muted)' }}
                                      title="Delete memory"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}

                    {/* Relevant Conversations */}
                    {conversations.length > 0 && (
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                            Relevant Conversations
                          </h3>
                          <span className="text-xs px-2 py-0.5 rounded" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                            {conversations.length} {conversations.length === 1 ? 'snippet' : 'snippets'}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {conversations.map((conv, idx) => (
                            <div
                              key={idx}
                              className="p-3 rounded-lg"
                              style={{ backgroundColor: 'var(--bg-primary)', border: '1px solid var(--border-color)' }}
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <span className="text-xs font-medium capitalize px-2 py-0.5 rounded" style={{
                                  backgroundColor: conv.role === 'user' ? 'var(--accent-color)' : 'var(--bg-tertiary)',
                                  color: conv.role === 'user' ? 'white' : 'var(--text-muted)'
                                }}>
                                  {conv.role}
                                </span>
                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                  Score: {(conv.score * 100).toFixed(0)}%
                                </span>
                              </div>
                              <p className="text-sm line-clamp-3" style={{ color: 'var(--text-primary)' }}>
                                {conv.contentPreview}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Legacy Memory Sections (if no semantic memories) */}
                    {memories.length === 0 && memory && (
                      <>
                        <div className="pt-4 border-t" style={{ borderColor: 'var(--border-color)' }}>
                          <h3 className="text-sm font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
                            Legacy Memory
                          </h3>
                        </div>
                        {memory.purposeContext && (
                          <div>
                            <h4 className="text-xs font-medium mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                              Purpose & Context
                            </h4>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {memory.purposeContext}
                            </p>
                          </div>
                        )}
                        {memory.currentState && (
                          <div>
                            <h4 className="text-xs font-medium mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                              Current State
                            </h4>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {memory.currentState}
                            </p>
                          </div>
                        )}
                        {memory.keyLearnings && (
                          <div>
                            <h4 className="text-xs font-medium mb-2 uppercase" style={{ color: 'var(--text-muted)' }}>
                              Key Learnings
                            </h4>
                            <p className="text-sm" style={{ color: 'var(--text-primary)' }}>
                              {memory.keyLearnings}
                            </p>
                          </div>
                        )}
                      </>
                    )}

                    {/* Last Updated Info */}
                    {memContext?.lastUpdated && (
                      <p className="text-xs pt-4 text-center" style={{ color: 'var(--text-muted)' }}>
                        Memory last retrieved {formatTimeAgo(memContext.lastUpdated)}
                      </p>
                    )}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Instructions Modal */}
      {showInstructionsModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-xl rounded-2xl"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="p-6">
              <h2 className="text-lg font-medium mb-2" style={{ color: 'var(--text-primary)' }}>
                Set project instructions
              </h2>
              <p className="text-sm mb-4" style={{ color: 'var(--text-muted)' }}>
                Provide Claude with relevant instructions and information for chats within {project?.name}. This will work alongside{' '}
                <a href="#" className="text-[#CD477E] hover:underline">user preferences</a>
                {' '}and the selected style in a chat.
              </p>
              <textarea
                value={editingInstructions}
                onChange={(e) => setEditingInstructions(e.target.value)}
                placeholder="Think step by step and show reasoning for complex problems. Use specific examples."
                className="w-full h-48 p-4 rounded-xl resize-none outline-none text-sm"
                style={{
                  backgroundColor: 'var(--bg-primary)',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-color)'
                }}
              />
              <div className="flex justify-end gap-3 mt-4">
                <button
                  onClick={() => setShowInstructionsModal(false)}
                  className="px-4 py-2 rounded-lg text-sm"
                  style={{ color: 'var(--text-muted)', border: '1px solid var(--border-color)' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveInstructions}
                  className="px-4 py-2 rounded-lg text-sm bg-[#CD477E] text-white"
                >
                  Save instructions
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* File Viewer Modal */}
      {viewingFile && (
        <FileViewerModal
          file={{ ...viewingFile, name: viewingFile.filename || viewingFile.name }}
          projectId={projectId}
          projectName={project?.name}
          onClose={() => setViewingFile(null)}
        />
      )}
    </div>
  )
}

export default ProjectDetailView

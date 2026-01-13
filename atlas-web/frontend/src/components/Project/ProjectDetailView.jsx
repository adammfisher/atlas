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
import { projectsService, sessionsService } from '../../services/chatService'
import { useChatStore } from '../../hooks/useChatStore'

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
  const [memory, setMemory] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isStarred, setIsStarred] = useState(false)

  // Modals
  const [showMemoryModal, setShowMemoryModal] = useState(false)
  const [showInstructionsModal, setShowInstructionsModal] = useState(false)
  const [showMenuDropdown, setShowMenuDropdown] = useState(false)

  // Instructions editing
  const [instructions, setInstructions] = useState('')
  const [editingInstructions, setEditingInstructions] = useState('')

  // New chat input
  const [chatInput, setChatInput] = useState('')
  // Model selection disabled - using Haiku as default
  const [selectedModel] = useState('haiku')
  // const [selectedModel, setSelectedModel] = useState('haiku')
  // const [showModelDropdown, setShowModelDropdown] = useState(false)
  // const modelDropdownRef = useRef(null)

  const { updateProject, sessions, deleteProject, addSession, setCurrentSession } = useChatStore()

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
        const [projectData, filesData, memoryData] = await Promise.all([
          projectsService.get(projectId),
          projectsService.listFiles(projectId).catch(() => []),
          projectsService.getMemory(projectId).catch(() => null)
        ])

        setProject(projectData)
        setFiles(filesData || [])
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
                  <Link
                    key={chat.id}
                    to={`/project/${projectId}/chat/${chat.id}`}
                    className="block p-3 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
                  >
                    <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                      {chat.title || 'New conversation'}
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                      Last message {formatTimeAgo(chat.updatedAt || chat.createdAt)}
                    </p>
                  </Link>
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
            <p className="text-sm line-clamp-3" style={{ color: 'var(--text-muted)' }}>
              {memory?.purposeContext || 'No memory yet. Start chatting to build project memory.'}
            </p>
            {memory?.updatedAt && (
              <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>
                Last updated {formatTimeAgo(memory.updatedAt)}
              </p>
            )}
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

            {/* Files List */}
            {files.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                No files yet
              </p>
            ) : (
              <div className="space-y-2">
                {files.map(file => (
                  <div
                    key={file.id}
                    className="flex items-center gap-2 p-2 rounded-lg group"
                    style={{ backgroundColor: 'var(--bg-secondary)' }}
                  >
                    <FileText size={16} style={{ color: 'var(--text-muted)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                        {file.filename}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {file.tokenCount?.toLocaleString() || 0} tokens
                      </p>
                    </div>
                    <button
                      onClick={() => handleDeleteFile(file.id)}
                      className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-[var(--bg-tertiary)] transition-opacity"
                      style={{ color: 'var(--text-muted)' }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Memory Modal */}
      {showMemoryModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div
            className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-2xl"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <div className="sticky top-0 flex items-center justify-between p-6 border-b" style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}>
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
              <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
                Claude regenerates project memory every evening from your past chats in this project. Only you can see this memory, and it is not shared with other project users.
              </p>

              {/* Memory Sections */}
              <div className="space-y-6">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Purpose & context
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.purposeContext || 'No content yet'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Current state
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.currentState || 'No content yet'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      On the horizon
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.onTheHorizon || 'No content yet'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Key learnings
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.keyLearnings || 'No content yet'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Approach & patterns
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.approachPatterns || 'No content yet'}
                  </p>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                      Tools & resources
                    </h3>
                    <button className="p-1 rounded hover:bg-[var(--bg-tertiary)]" style={{ color: 'var(--text-muted)' }}>
                      <Pencil size={14} />
                    </button>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                    {memory?.toolsResources || 'No content yet'}
                  </p>
                </div>
              </div>
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
    </div>
  )
}

export default ProjectDetailView

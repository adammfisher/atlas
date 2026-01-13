import React, { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Plus, Search, ChevronDown, Trash2 } from 'lucide-react'
import { projectsService } from '../../services/chatService'
import { useChatStore } from '../../hooks/useChatStore'

function ProjectsListPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState('active') // 'active' or 'archived'
  const [sortBy, setSortBy] = useState('activity')
  const [showSortDropdown, setShowSortDropdown] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showNewProjectModal, setShowNewProjectModal] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  const { projects, setProjects, addProject, deleteProject } = useChatStore()

  // Fetch projects on mount
  useEffect(() => {
    const fetchProjects = async () => {
      setIsLoading(true)
      try {
        const data = await projectsService.list(activeTab)
        setProjects(data || [])
      } catch (err) {
        console.error('Failed to fetch projects:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchProjects()
  }, [activeTab, setProjects])

  // Filter and sort projects
  const filteredProjects = projects
    .filter(p => {
      if (!searchQuery) return true
      return p.name?.toLowerCase().includes(searchQuery.toLowerCase())
    })
    .sort((a, b) => {
      if (sortBy === 'activity') {
        return new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
      }
      if (sortBy === 'name') {
        return (a.name || '').localeCompare(b.name || '')
      }
      return 0
    })

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || isCreating) return

    setIsCreating(true)
    try {
      const newProject = await projectsService.create({ name: newProjectName.trim() })
      addProject(newProject)
      setShowNewProjectModal(false)
      setNewProjectName('')
      navigate(`/projects/${newProject.id}`)
    } catch (err) {
      console.error('Failed to create project:', err)
    } finally {
      setIsCreating(false)
    }
  }

  const handleDeleteProject = async (e, projectId) => {
    e.preventDefault()
    e.stopPropagation()
    if (!window.confirm('Are you sure you want to delete this project? This action cannot be undone.')) {
      return
    }
    try {
      await projectsService.delete(projectId)
      deleteProject(projectId)
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
    const diffMonths = Math.floor(diffDays / 30)

    if (diffMonths > 0) return `${diffMonths} month${diffMonths > 1 ? 's' : ''} ago`
    if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
    if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
    return 'Just now'
  }

  return (
    <div className="flex-1 overflow-y-auto" style={{ backgroundColor: 'var(--bg-primary)' }}>
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-light" style={{ color: 'var(--text-primary)' }}>
            Projects
          </h1>
          <button
            onClick={() => setShowNewProjectModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}
          >
            <Plus size={18} />
            New project
          </button>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search
            size={18}
            className="absolute left-4 top-1/2 -translate-y-1/2"
            style={{ color: 'var(--text-muted)' }}
          />
          <input
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-xl outline-none"
            style={{
              backgroundColor: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color)'
            }}
          />
        </div>

        {/* Tabs and Sort */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab('active')}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                activeTab === 'active' ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor: activeTab === 'active' ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-primary)'
              }}
            >
              Your projects
            </button>
            <button
              onClick={() => setActiveTab('archived')}
              className={`px-4 py-2 rounded-full text-sm transition-colors ${
                activeTab === 'archived' ? 'font-medium' : ''
              }`}
              style={{
                backgroundColor: activeTab === 'archived' ? 'var(--bg-tertiary)' : 'transparent',
                color: 'var(--text-muted)'
              }}
            >
              Archived
            </button>
          </div>

          <div className="relative">
            <button
              onClick={() => setShowSortDropdown(!showSortDropdown)}
              className="flex items-center gap-2 text-sm"
              style={{ color: 'var(--text-muted)' }}
            >
              Sort by
              <span style={{ color: 'var(--text-primary)' }}>
                {sortBy === 'activity' ? 'Activity' : 'Name'}
              </span>
              <ChevronDown size={16} />
            </button>
            {showSortDropdown && (
              <div
                className="absolute right-0 top-full mt-1 w-32 rounded-lg shadow-lg overflow-hidden z-10"
                style={{ backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}
              >
                <button
                  onClick={() => { setSortBy('activity'); setShowSortDropdown(false) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Activity
                </button>
                <button
                  onClick={() => { setSortBy('name'); setShowSortDropdown(false) }}
                  className="w-full text-left px-4 py-2 text-sm hover:bg-[var(--bg-tertiary)]"
                  style={{ color: 'var(--text-primary)' }}
                >
                  Name
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Projects Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#CD477E]" />
          </div>
        ) : filteredProjects.length === 0 ? (
          <div className="text-center py-12">
            <p style={{ color: 'var(--text-muted)' }}>
              {searchQuery ? 'No projects match your search' : 'No projects yet'}
            </p>
            {!searchQuery && (
              <button
                onClick={() => setShowNewProjectModal(true)}
                className="mt-4 px-4 py-2 rounded-lg bg-[#CD477E] text-white text-sm"
              >
                Create your first project
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {filteredProjects.map(project => (
              <Link
                key={project.id}
                to={`/projects/${project.id}`}
                className="p-5 rounded-xl transition-colors group relative"
                style={{
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--border-color)'
                }}
              >
                <button
                  onClick={(e) => handleDeleteProject(e, project.id)}
                  className="absolute top-3 right-3 p-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-100 dark:hover:bg-red-900/20"
                  title="Delete project"
                >
                  <Trash2 size={16} className="text-red-500" />
                </button>
                <h3
                  className="text-base font-medium mb-1 group-hover:text-[#CD477E] transition-colors pr-8"
                  style={{ color: 'var(--text-primary)' }}
                >
                  {project.name}
                </h3>
                {project.description && (
                  <p
                    className="text-sm mb-3 line-clamp-2"
                    style={{ color: 'var(--text-muted)' }}
                  >
                    {project.description}
                  </p>
                )}
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  Updated {formatTimeAgo(project.updatedAt || project.createdAt)}
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* New Project Modal */}
      {showNewProjectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div
            className="w-full max-w-md rounded-2xl p-6"
            style={{ backgroundColor: 'var(--bg-secondary)' }}
          >
            <h2 className="text-lg font-medium mb-4" style={{ color: 'var(--text-primary)' }}>
              Create new project
            </h2>
            <input
              type="text"
              placeholder="Project name"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreateProject()}
              autoFocus
              className="w-full px-4 py-3 rounded-lg outline-none mb-4"
              style={{
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color)'
              }}
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowNewProjectModal(false); setNewProjectName('') }}
                className="px-4 py-2 rounded-lg text-sm"
                style={{ color: 'var(--text-muted)' }}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateProject}
                disabled={!newProjectName.trim() || isCreating}
                className="px-4 py-2 rounded-lg text-sm bg-[#CD477E] text-white disabled:opacity-50"
              >
                {isCreating ? 'Creating...' : 'Create project'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ProjectsListPage

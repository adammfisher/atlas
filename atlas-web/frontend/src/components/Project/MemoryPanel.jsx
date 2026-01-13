import React, { useState } from 'react'
import {
  Brain,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Target,
  Clock,
  Compass,
  Lightbulb,
  Settings,
  Wrench,
  Edit3,
  Save,
  X
} from 'lucide-react'
import { projectsService } from '../../services/chatService'

// Memory section configuration
const MEMORY_SECTIONS = [
  {
    id: 'purposeContext',
    title: 'Purpose & Context',
    icon: Target,
    description: 'Core purpose of the project and key background'
  },
  {
    id: 'currentState',
    title: 'Current State',
    icon: Clock,
    description: 'Recent decisions, progress, and current status'
  },
  {
    id: 'onTheHorizon',
    title: 'On the Horizon',
    icon: Compass,
    description: 'Upcoming priorities and planned work'
  },
  {
    id: 'keyLearnings',
    title: 'Key Learnings',
    icon: Lightbulb,
    description: 'Important discoveries and insights'
  },
  {
    id: 'approachPatterns',
    title: 'Approach & Patterns',
    icon: Settings,
    description: 'Established patterns and methodologies'
  },
  {
    id: 'toolsResources',
    title: 'Tools & Resources',
    icon: Wrench,
    description: 'Key tools, documentation, and references'
  }
]

function MemoryPanel({ memory, onRegenerate, projectId }) {
  const [expandedSections, setExpandedSections] = useState(new Set(['purposeContext', 'currentState']))
  const [isRegenerating, setIsRegenerating] = useState(false)
  const [editingSection, setEditingSection] = useState(null)
  const [editValue, setEditValue] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const toggleSection = (sectionId) => {
    setExpandedSections(prev => {
      const next = new Set(prev)
      if (next.has(sectionId)) {
        next.delete(sectionId)
      } else {
        next.add(sectionId)
      }
      return next
    })
  }

  const handleRegenerate = async () => {
    setIsRegenerating(true)
    try {
      await onRegenerate()
    } finally {
      setIsRegenerating(false)
    }
  }

  const handleStartEdit = (sectionId, currentValue) => {
    setEditingSection(sectionId)
    setEditValue(currentValue || '')
  }

  const handleCancelEdit = () => {
    setEditingSection(null)
    setEditValue('')
  }

  const handleSaveEdit = async (sectionId) => {
    setIsSaving(true)
    try {
      // Build the sections update
      const sections = { ...memory?.sections }
      sections[sectionId] = editValue

      await projectsService.updateMemory(projectId, sections)

      // Update local state via parent re-fetch or direct update
      // For now, close the editor - parent will refetch
      setEditingSection(null)
      setEditValue('')

      // Trigger a refetch
      onRegenerate?.()
    } catch (err) {
      console.error('Failed to save memory section:', err)
    } finally {
      setIsSaving(false)
    }
  }

  // No memory yet
  if (!memory) {
    return (
      <div className="space-y-6">
        <div className="text-center py-12">
          <Brain size={48} className="mx-auto mb-4" style={{ color: 'var(--text-muted)', opacity: 0.5 }} />
          <p style={{ color: 'var(--text-muted)' }}>No project memory yet</p>
          <p className="text-sm mt-1 mb-4" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
            Generate memory from your conversations to help Claude understand your project better
          </p>
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#CD477E] text-white text-sm"
          >
            <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
            {isRegenerating ? 'Generating...' : 'Generate Memory'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Memory synthesized from {memory.messageCount || 0} messages
          </p>
          {memory.updatedAt && (
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
              Last updated: {new Date(memory.updatedAt).toLocaleDateString()} at {new Date(memory.updatedAt).toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRegenerate}
          disabled={isRegenerating}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            borderWidth: '1px',
            borderColor: 'var(--border-color)'
          }}
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
        >
          <RefreshCw size={14} className={isRegenerating ? 'animate-spin' : ''} />
          {isRegenerating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      {/* Memory sections */}
      <div className="space-y-3">
        {MEMORY_SECTIONS.map(section => {
          const Icon = section.icon
          const isExpanded = expandedSections.has(section.id)
          const content = memory.sections?.[section.id] || ''
          const isEditing = editingSection === section.id

          return (
            <div
              key={section.id}
              className="rounded-lg overflow-hidden"
              style={{
                backgroundColor: 'var(--bg-secondary)',
                borderWidth: '1px',
                borderColor: 'var(--border-color)'
              }}
            >
              {/* Section header */}
              <button
                onClick={() => toggleSection(section.id)}
                className="w-full flex items-center gap-3 p-3 transition-colors"
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {isExpanded ? (
                  <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
                ) : (
                  <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
                )}
                <Icon size={16} className="text-[#CD477E]" />
                <span className="flex-1 text-left text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
                  {section.title}
                </span>
                {content && !isExpanded && (
                  <span className="text-xs truncate max-w-[200px]" style={{ color: 'var(--text-muted)' }}>
                    {content.slice(0, 50)}...
                  </span>
                )}
              </button>

              {/* Section content */}
              {isExpanded && (
                <div className="px-3 pb-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  {isEditing ? (
                    <div className="pt-3 space-y-3">
                      <textarea
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        className="w-full rounded-lg p-3 text-sm outline-none resize-none"
                        style={{
                          backgroundColor: 'var(--bg-primary)',
                          color: 'var(--text-primary)',
                          borderWidth: '1px',
                          borderColor: 'var(--border-color)'
                        }}
                        rows={6}
                        placeholder={`Add ${section.title.toLowerCase()}...`}
                      />
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={handleCancelEdit}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm"
                          style={{ color: 'var(--text-muted)' }}
                        >
                          <X size={14} />
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSaveEdit(section.id)}
                          disabled={isSaving}
                          className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm bg-[#CD477E] text-white"
                        >
                          <Save size={14} />
                          {isSaving ? 'Saving...' : 'Save'}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-3">
                      {content ? (
                        <div className="space-y-2">
                          <p className="text-sm whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                            {content}
                          </p>
                          <button
                            onClick={() => handleStartEdit(section.id, content)}
                            className="flex items-center gap-1 text-xs transition-colors"
                            style={{ color: 'var(--text-muted)' }}
                            onMouseEnter={(e) => e.currentTarget.style.color = '#CD477E'}
                            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                          >
                            <Edit3 size={12} />
                            Edit
                          </button>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-sm" style={{ color: 'var(--text-muted)', opacity: 0.7 }}>
                            {section.description}
                          </p>
                          <button
                            onClick={() => handleStartEdit(section.id, '')}
                            className="mt-2 flex items-center gap-1 mx-auto text-xs transition-colors"
                            style={{ color: '#CD477E' }}
                          >
                            <Edit3 size={12} />
                            Add content
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Version info */}
      {memory.version > 1 && (
        <p className="text-xs text-center" style={{ color: 'var(--text-muted)', opacity: 0.5 }}>
          Memory version {memory.version}
        </p>
      )}
    </div>
  )
}

export default MemoryPanel

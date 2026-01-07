import React, { useState, useRef, useEffect } from 'react'
import {
  Paperclip,
  Camera,
  FolderPlus,
  Globe,
  Plug,
  ChevronRight,
  Check,
  Plus
} from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'

function PlusMenu({ onClose, onFileSelect, onScreenshot }) {
  const [showConnectors, setShowConnectors] = useState(false)
  const [showProjects, setShowProjects] = useState(false)
  const menuRef = useRef(null)

  const {
    webSearchEnabled,
    setWebSearchEnabled,
    enabledConnectors,
    toggleConnector,
    availableConnectors,
    projects
  } = useChatStore()

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onClose])

  const handleScreenshot = async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { mediaSource: 'screen' }
      })
      const video = document.createElement('video')
      video.srcObject = stream
      await video.play()

      const canvas = document.createElement('canvas')
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      canvas.getContext('2d').drawImage(video, 0, 0)

      stream.getTracks().forEach(track => track.stop())

      canvas.toBlob(blob => {
        const file = new File([blob], `screenshot-${Date.now()}.png`, { type: 'image/png' })
        onScreenshot(file)
      }, 'image/png')
    } catch (err) {
      console.error('Screenshot failed:', err)
      // User cancelled or API not available
    }
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="absolute bottom-full left-0 mb-2 w-[220px] bg-[hsl(30,3.3%,11.8%)] rounded-xl border border-[var(--border-color)] shadow-xl overflow-visible z-50"
    >
      {/* Add files or photos */}
      <button
        onClick={() => { onFileSelect(); onClose() }}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] text-left transition-colors"
      >
        <Paperclip size={16} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
          Add files or photos
        </span>
      </button>

      {/* Take a screenshot */}
      <button
        onClick={handleScreenshot}
        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] text-left transition-colors"
      >
        <Camera size={16} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
          Take a screenshot
        </span>
      </button>

      {/* Add to project - with submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowProjects(true)}
        onMouseLeave={() => setShowProjects(false)}
      >
        <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] transition-colors">
          <div className="flex items-center gap-3">
            <FolderPlus size={16} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
            <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
              Add to project
            </span>
          </div>
          <ChevronRight size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        </button>

        {showProjects && (
          <ProjectsSubmenu projects={projects} onClose={onClose} />
        )}
      </div>

      {/* Divider */}
      <div className="border-t border-[var(--border-color)] my-1" />

      {/* Web search toggle */}
      <button
        onClick={() => setWebSearchEnabled(!webSearchEnabled)}
        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] transition-colors"
      >
        <div className="flex items-center gap-3">
          <Globe
            size={16}
            style={{ color: webSearchEnabled ? 'hsl(187, 71%, 53%)' : 'hsl(48, 4.8%, 59.2%)' }}
          />
          <span
            className="text-[14px]"
            style={{ color: webSearchEnabled ? 'hsl(187, 71%, 53%)' : 'hsl(48, 33.3%, 97.1%)' }}
          >
            Web search
          </span>
        </div>
        {webSearchEnabled && (
          <Check size={16} style={{ color: 'hsl(187, 71%, 53%)' }} />
        )}
      </button>

      {/* Divider */}
      <div className="border-t border-[var(--border-color)] my-1" />

      {/* Connectors - with submenu */}
      <div
        className="relative"
        onMouseEnter={() => setShowConnectors(true)}
        onMouseLeave={() => setShowConnectors(false)}
      >
        <button className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] transition-colors">
          <div className="flex items-center gap-3">
            <Plug size={16} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
            <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
              Connectors
            </span>
            {enabledConnectors.length > 0 && (
              <span className="text-[11px] bg-[hsl(24,75%,50%)] text-white px-1.5 py-0.5 rounded-full min-w-[18px] text-center">
                {enabledConnectors.length}
              </span>
            )}
          </div>
          <ChevronRight size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        </button>

        {showConnectors && (
          <ConnectorsSubmenu
            available={availableConnectors}
            enabled={enabledConnectors}
            onToggle={toggleConnector}
          />
        )}
      </div>
    </div>
  )
}

function ConnectorsSubmenu({ available, enabled, onToggle }) {
  return (
    <div className="absolute left-full top-0 ml-1 w-48 bg-[hsl(30,3.3%,11.8%)] rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden">
      {available.map(connector => (
        <button
          key={connector.id}
          onClick={(e) => { e.stopPropagation(); onToggle(connector.id) }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] text-left transition-colors"
        >
          <div
            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
              enabled.includes(connector.id)
                ? 'bg-[hsl(24,75%,50%)] border-[hsl(24,75%,50%)]'
                : 'border-[hsl(48,4.8%,40%)] bg-transparent'
            }`}
          >
            {enabled.includes(connector.id) && (
              <Check size={10} className="text-white" />
            )}
          </div>
          <span className="text-[14px]">{connector.icon}</span>
          <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
            {connector.name}
          </span>
        </button>
      ))}

      {available.length === 0 && (
        <div className="px-4 py-3 text-[13px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
          No connectors configured
        </div>
      )}
    </div>
  )
}

function ProjectsSubmenu({ projects = [], onClose }) {
  return (
    <div className="absolute left-full top-0 ml-1 w-48 bg-[hsl(30,3.3%,11.8%)] rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden">
      {projects.map(project => (
        <button
          key={project.id}
          onClick={() => {
            // TODO: Add to project
            onClose()
          }}
          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] text-left transition-colors"
        >
          <span className="text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
            {project.name}
          </span>
        </button>
      ))}

      {projects.length === 0 && (
        <div className="px-4 py-2.5 text-[13px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
          No projects yet
        </div>
      )}

      <div className="border-t border-[var(--border-color)]">
        <button
          onClick={() => {
            // TODO: Create new project
            onClose()
          }}
          className="w-full flex items-center gap-2 px-4 py-2.5 hover:bg-[hsl(30,3.3%,18%)] text-left transition-colors"
        >
          <Plus size={14} style={{ color: 'hsl(24,75%,50%)' }} />
          <span className="text-[14px]" style={{ color: 'hsl(24,75%,50%)' }}>
            New Project
          </span>
        </button>
      </div>
    </div>
  )
}

export default PlusMenu

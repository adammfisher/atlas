import React, { useRef, useEffect } from 'react'
import { ChevronDown } from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'

const MODELS = [
  { id: 'haiku', name: 'Haiku 4.5', description: 'Fast & efficient' },
  { id: 'sonnet', name: 'Sonnet 4.6', description: 'Most powerful' },
]

function ModelSelector({ isOpen, onToggle }) {
  const { selectedModel, setSelectedModel } = useChatStore()
  const dropdownRef = useRef(null)

  const currentModel = MODELS.find(m => m.id === selectedModel) || MODELS[0]

  // Close on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        if (isOpen) onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  const handleSelect = (modelId) => {
    setSelectedModel(modelId)
    onToggle()
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={onToggle}
        className="flex items-center gap-1 px-2 py-1 hover:bg-[hsl(30,3.3%,18%)] rounded-lg transition-colors"
        style={{ color: 'hsl(48, 4.8%, 59.2%)' }}
      >
        <span className="text-[13px]">{currentModel.name}</span>
        <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full right-0 mb-2 w-56 bg-[hsl(30,3.3%,11.8%)] rounded-xl border border-[var(--border-color)] shadow-xl overflow-hidden z-50">
          {MODELS.map(model => (
            <button
              key={model.id}
              onClick={() => handleSelect(model.id)}
              className="w-full flex items-center justify-between px-4 py-3 hover:bg-[hsl(30,3.3%,18%)] transition-colors"
            >
              <div className="flex items-center gap-3">
                {/* Radio button */}
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center transition-colors ${
                    selectedModel === model.id
                      ? 'border-[hsl(24,75%,50%)] bg-[hsl(24,75%,50%)]'
                      : 'border-[hsl(48,4.8%,40%)]'
                  }`}
                >
                  {selectedModel === model.id && (
                    <div className="w-1.5 h-1.5 bg-white rounded-full" />
                  )}
                </div>
                <span
                  className="text-[14px]"
                  style={{ color: 'hsl(48, 33.3%, 97.1%)' }}
                >
                  {model.name}
                </span>
              </div>
              <span
                className="text-[12px]"
                style={{ color: 'hsl(48, 4.8%, 59.2%)' }}
              >
                {model.description}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default ModelSelector

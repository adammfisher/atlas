import React from 'react'
import { X } from 'lucide-react'
import { useChatStore } from '../../hooks/useChatStore'

function SettingsModal({ isOpen, onClose }) {
  const colorMode = useChatStore(state => state.colorMode)
  const setColorMode = useChatStore(state => state.setColorMode)
  const chatFont = useChatStore(state => state.chatFont)
  const setChatFont = useChatStore(state => state.setChatFont)

  if (!isOpen) return null

  const colorModes = [
    { id: 'light', label: 'Light' },
    { id: 'auto', label: 'Auto' },
    { id: 'dark', label: 'Dark' },
  ]

  const fonts = [
    { id: 'default', label: 'Default', fontFamily: '"Merriweather", Georgia, "Times New Roman", Times, serif' },
    { id: 'poppins', label: 'Poppins', fontFamily: '"Poppins", sans-serif' },
    { id: 'lato', label: 'Lato', fontFamily: '"Lato", sans-serif' },
    { id: 'sans', label: 'Sans', fontFamily: 'system-ui, -apple-system, sans-serif' },
  ]

  const handleColorModeChange = (mode) => {
    console.log('Setting color mode to:', mode)
    setColorMode(mode)
  }

  const handleFontChange = (font) => {
    console.log('Setting font to:', font)
    setChatFont(font)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="rounded-2xl border border-[var(--border-color)] w-[500px] max-h-[80vh] overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            Appearance
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6">
          {/* Color Mode */}
          <div>
            <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Color mode
            </h3>
            <div className="flex gap-3">
              {colorModes.map((mode) => (
                <button
                  key={mode.id}
                  onClick={() => handleColorModeChange(mode.id)}
                  className={`flex-1 rounded-xl border-2 transition-all overflow-hidden ${
                    colorMode === mode.id
                      ? 'border-[#E07020]'
                      : 'border-[var(--border-color)] hover:border-opacity-40'
                  }`}
                >
                  {/* Preview */}
                  <div className={`h-[70px] p-2 ${
                    mode.id === 'light' ? 'bg-[#F9F7F3]' :
                    mode.id === 'auto' ? 'bg-gradient-to-r from-[#F9F7F3] to-[#252423]' :
                    'bg-[#252423]'
                  }`}>
                    <div className="space-y-1">
                      <div className={`h-1.5 w-12 rounded ${mode.id === 'light' ? 'bg-[#D4D2CD]' : mode.id === 'auto' ? 'bg-gray-400' : 'bg-gray-600'}`} />
                      <div className={`h-1.5 w-16 rounded ${mode.id === 'light' ? 'bg-[#D4D2CD]' : mode.id === 'auto' ? 'bg-gray-400' : 'bg-gray-600'}`} />
                      <div className={`h-1.5 w-10 rounded ${mode.id === 'light' ? 'bg-[#D4D2CD]' : mode.id === 'auto' ? 'bg-gray-400' : 'bg-gray-600'}`} />
                    </div>
                    <div className={`mt-2 h-4 w-14 rounded ${
                      mode.id === 'light' ? 'bg-[#E07020]/30' :
                      mode.id === 'auto' ? 'bg-[#E07020]/40' :
                      'bg-[#E07020]'
                    }`} />
                  </div>
                  {/* Label */}
                  <div
                    className="py-2 text-center text-[13px]"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-tertiary)'
                    }}
                  >
                    {mode.label}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Chat Font */}
          <div>
            <h3 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-muted)' }}>
              Chat font
            </h3>
            <div className="flex gap-3">
              {fonts.map((font) => (
                <button
                  key={font.id}
                  onClick={() => handleFontChange(font.id)}
                  className={`flex-1 rounded-xl border-2 transition-all overflow-hidden ${
                    chatFont === font.id
                      ? 'border-[#E07020]'
                      : 'border-[var(--border-color)] hover:border-opacity-40'
                  }`}
                >
                  {/* Font Preview */}
                  <div
                    className="h-[60px] flex items-center justify-center"
                    style={{ backgroundColor: 'var(--bg-primary)' }}
                  >
                    <span
                      className="text-[28px]"
                      style={{
                        fontFamily: font.fontFamily,
                        color: 'var(--text-primary)'
                      }}
                    >
                      Aa
                    </span>
                  </div>
                  {/* Label */}
                  <div
                    className="py-2 text-center text-[12px]"
                    style={{
                      color: 'var(--text-primary)',
                      backgroundColor: 'var(--bg-tertiary)'
                    }}
                  >
                    {font.label}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SettingsModal

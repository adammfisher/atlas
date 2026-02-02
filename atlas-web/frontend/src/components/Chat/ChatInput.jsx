import React, { useState, useRef, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { Plus, Clock, ArrowUp, Database, X, AlertCircle } from 'lucide-react'
import PlusMenu from './PlusMenu'
import ModelSelector from './ModelSelector'
import FilePreview from './FilePreview'
import { useChatStore } from '../../hooks/useChatStore'

// Atlas brand orange color
const ATLAS_ORANGE = '#E07020'

function ChatInput({ onSend, disabled, placeholder = "Reply..." }) {
  const [input, setInput] = useState('')
  const [showPlusMenu, setShowPlusMenu] = useState(false)
  const [showModelSelector, setShowModelSelector] = useState(false)
  const [isDragOver, setIsDragOver] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const containerRef = useRef(null)
  const location = useLocation()

  const {
    pendingFiles,
    addPendingFile,
    removePendingFile,
    clearPendingFiles,
    selectedModel,
    webSearchEnabled,
    extendedThinkingEnabled,
    setExtendedThinkingEnabled,
    knowledgeCoreEnabled,
    setKnowledgeCoreEnabled,
    enabledConnectors,
    currentSessionId,
    fileUploadError,
    clearFileUploadError
  } = useChatStore()

  // Auto-resize textarea
  useEffect(() => {
    const textarea = textareaRef.current
    if (textarea) {
      textarea.style.height = 'auto'
      textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
    }
  }, [input])

  // Focus textarea on mount and when session changes
  useEffect(() => {
    textareaRef.current?.focus()
  }, [])

  // Clear input and refocus when session changes or navigation occurs (e.g., New chat clicked)
  // Using location.key ensures this triggers even when navigating to the same path
  useEffect(() => {
    setInput('')
    clearPendingFiles()
    // Small delay to ensure DOM is ready after navigation
    setTimeout(() => {
      textareaRef.current?.focus()
    }, 50)
  }, [currentSessionId, location.key, clearPendingFiles])

  // Auto-clear file upload error after 5 seconds
  useEffect(() => {
    if (fileUploadError) {
      const timer = setTimeout(() => {
        clearFileUploadError()
      }, 5000)
      return () => clearTimeout(timer)
    }
  }, [fileUploadError, clearFileUploadError])

  // Handle paste for images
  const handlePaste = (e) => {
    const items = e.clipboardData?.items
    if (items) {
      for (const item of items) {
        if (item.type.startsWith('image/')) {
          const file = item.getAsFile()
          if (file) {
            addPendingFile(file)
            e.preventDefault()
            return
          }
        }
      }
    }
  }

  // Handle drag and drop
  const handleDragOver = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(true)
  }

  const handleDragLeave = (e) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set false if leaving the container entirely
    if (!containerRef.current?.contains(e.relatedTarget)) {
      setIsDragOver(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(e.dataTransfer.files)
    files.forEach(file => addPendingFile(file))
  }

  // Handle file selection from picker
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files)
    files.forEach(file => addPendingFile(file))
    e.target.value = '' // Reset input
  }

  // Handle screenshot from menu
  const handleScreenshot = (file) => {
    addPendingFile(file)
  }

  // Handle send
  const handleSend = () => {
    if ((!input.trim() && pendingFiles.length === 0) || disabled) return

    onSend({
      message: input.trim(),
      files: pendingFiles,
      model: selectedModel,
      webSearchEnabled,
      extendedThinkingEnabled,
      knowledgeCoreEnabled,
      enabledConnectors
    })

    setInput('')
    clearPendingFiles()
  }

  // Handle Enter key
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const canSend = (input.trim() || pendingFiles.length > 0) && !disabled

  return (
    <div
      ref={containerRef}
      className="relative"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* File upload error toast */}
      {fileUploadError && (
        <div
          className="absolute -top-16 left-0 right-0 mx-4 px-4 py-3 rounded-lg flex items-start gap-3 shadow-lg z-50"
          style={{
            backgroundColor: 'hsl(0, 60%, 20%)',
            borderWidth: '1px',
            borderColor: 'hsl(0, 60%, 35%)'
          }}
        >
          <AlertCircle size={18} className="flex-shrink-0 mt-0.5" style={{ color: 'hsl(0, 80%, 65%)' }} />
          <span className="text-[13px] flex-1" style={{ color: 'hsl(0, 30%, 90%)' }}>
            {fileUploadError}
          </span>
          <button
            onClick={clearFileUploadError}
            className="flex-shrink-0 p-0.5 rounded hover:bg-white/10 transition-colors"
            style={{ color: 'hsl(0, 30%, 70%)' }}
          >
            <X size={16} />
          </button>
        </div>
      )}

      {/* Drag overlay */}
      {isDragOver && (
        <div className="absolute inset-0 bg-[hsl(60,2.7%,14.5%)] bg-opacity-90 flex items-center justify-center z-50 rounded-[20px] border-2 border-dashed border-[hsl(24,75%,50%)]">
          <div className="text-center">
            <span className="text-3xl">📁</span>
            <p className="mt-2 text-[14px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
              Drop files here
            </p>
          </div>
        </div>
      )}

      {/* Input container */}
      <div
        className="rounded-[20px]"
        style={{
          backgroundColor: 'var(--bg-input, var(--bg-secondary))',
          borderWidth: '1px',
          borderColor: 'var(--border-color)'
        }}
      >
        {/* File previews - above textarea if files present */}
        {pendingFiles.length > 0 && (
          <div style={{ borderBottomWidth: '1px', borderColor: 'var(--border-color)' }}>
            <FilePreview
              files={pendingFiles}
              onRemove={removePendingFile}
            />
          </div>
        )}

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className="w-full bg-transparent px-4 py-3 resize-none outline-none text-[15px]"
          style={{
            color: 'var(--text-primary)',
            minHeight: '24px',
            maxHeight: '200px'
          }}
        />

        {/* Bottom bar */}
        <div className="flex items-center justify-between px-2 pb-2">
          {/* Left side - Plus button and Extended Thinking (Clock) */}
          <div className="flex items-center gap-0.5">
            <button
              onClick={() => setShowPlusMenu(!showPlusMenu)}
              className="p-2 rounded-lg transition-colors"
              style={{ color: 'var(--text-muted)' }}
              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              title="Add content"
            >
              <Plus size={18} />
            </button>
            <button
              onClick={() => setExtendedThinkingEnabled(!extendedThinkingEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                extendedThinkingEnabled
                  ? 'bg-[#E07020]/20 hover:bg-[#E07020]/30'
                  : ''
              }`}
              style={{ color: extendedThinkingEnabled ? ATLAS_ORANGE : 'var(--text-muted)' }}
              onMouseEnter={(e) => !extendedThinkingEnabled && (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => !extendedThinkingEnabled && (e.currentTarget.style.backgroundColor = 'transparent')}
              title={extendedThinkingEnabled ? "Extended thinking enabled" : "Enable extended thinking"}
            >
              <Clock size={18} />
            </button>
            <button
              onClick={() => setKnowledgeCoreEnabled(!knowledgeCoreEnabled)}
              className={`p-2 rounded-lg transition-colors ${
                knowledgeCoreEnabled
                  ? 'bg-[#E07020]/20 hover:bg-[#E07020]/30'
                  : ''
              }`}
              style={{ color: knowledgeCoreEnabled ? ATLAS_ORANGE : 'var(--text-muted)' }}
              onMouseEnter={(e) => !knowledgeCoreEnabled && (e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)')}
              onMouseLeave={(e) => !knowledgeCoreEnabled && (e.currentTarget.style.backgroundColor = 'transparent')}
              title={knowledgeCoreEnabled ? "Knowledge Core enabled - click to disable" : "Enable Knowledge Core search"}
            >
              <Database size={18} />
            </button>
          </div>

          {/* Right side - Model selector and Send */}
          <div className="flex items-center gap-1">
            {/* Model selector hidden - currently only Haiku is enabled */}
            {/* <ModelSelector
              isOpen={showModelSelector}
              onToggle={() => setShowModelSelector(!showModelSelector)}
            /> */}
            <span
              className="text-[12px] px-2 py-1 rounded"
              style={{ color: 'var(--text-muted)' }}
            >
              Haiku 4.5
            </span>
            <button
              onClick={handleSend}
              disabled={!canSend}
              className="p-2 rounded-full transition-colors"
              style={{
                backgroundColor: canSend ? ATLAS_ORANGE : 'var(--bg-tertiary)',
                color: canSend ? 'white' : 'var(--text-muted)',
                cursor: canSend ? 'pointer' : 'not-allowed'
              }}
              title="Send message"
            >
              <ArrowUp size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>
      </div>

      {/* Plus menu */}
      {showPlusMenu && (
        <PlusMenu
          onClose={() => setShowPlusMenu(false)}
          onFileSelect={() => fileInputRef.current?.click()}
          onScreenshot={handleScreenshot}
        />
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".txt,.md,.py,.js,.jsx,.ts,.tsx,.java,.cpp,.c,.h,.hpp,.cs,.go,.rb,.php,.swift,.kt,.rs,.scala,.sql,.sh,.bash,.zsh,.ps1,.bat,.cmd,.json,.xml,.csv,.tsv,.yaml,.yml,.html,.htm,.css,.scss,.sass,.less,.pdf,.docx,.png,.jpg,.jpeg,.gif,.webp"
        onChange={handleFileSelect}
        className="hidden"
      />
    </div>
  )
}

export default ChatInput

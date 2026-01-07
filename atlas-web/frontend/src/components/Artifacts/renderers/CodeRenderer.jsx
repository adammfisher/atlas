import React, { useState } from 'react'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { Copy, Check } from 'lucide-react'

// Map file extensions to Prism language names
const LANGUAGE_MAP = {
  '.js': 'javascript',
  '.jsx': 'jsx',
  '.ts': 'typescript',
  '.tsx': 'tsx',
  '.py': 'python',
  '.java': 'java',
  '.sql': 'sql',
  '.sh': 'bash',
  '.yaml': 'yaml',
  '.yml': 'yaml',
  '.json': 'json',
  '.css': 'css',
  '.html': 'html',
  '.xml': 'xml',
  '.go': 'go',
  '.rs': 'rust',
  '.rb': 'ruby',
  '.php': 'php',
  '.c': 'c',
  '.cpp': 'cpp',
  '.cs': 'csharp',
  '.swift': 'swift',
  '.kt': 'kotlin',
  '.scala': 'scala',
  '.md': 'markdown',
  '.txt': 'text'
}

function CodeRenderer({ content, fileExtension = '.txt' }) {
  const [copied, setCopied] = useState(false)
  const language = LANGUAGE_MAP[fileExtension] || 'text'

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const lines = content.split('\n').length

  return (
    <div className="w-full relative">
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-2 rounded-t-lg border-b"
        style={{ backgroundColor: 'var(--bg-secondary)', borderColor: 'var(--border-color)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xs font-mono uppercase" style={{ color: 'var(--text-muted)' }}>
            {language}
          </span>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {lines} lines
          </span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{ color: copied ? '#22c55e' : 'var(--text-muted)' }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>

      {/* Code content */}
      <SyntaxHighlighter
        language={language}
        style={oneDark}
        showLineNumbers
        wrapLines
        customStyle={{
          margin: 0,
          borderRadius: '0 0 0.5rem 0.5rem',
          fontSize: '13px',
          lineHeight: '1.5'
        }}
        lineNumberStyle={{
          minWidth: '3em',
          paddingRight: '1em',
          color: 'var(--text-muted)',
          borderRight: '1px solid var(--border-color)',
          marginRight: '1em'
        }}
      >
        {content}
      </SyntaxHighlighter>
    </div>
  )
}

export default CodeRenderer

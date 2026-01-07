import React, { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Copy, Check } from 'lucide-react'

function JSONRenderer({ content }) {
  const [copied, setCopied] = useState(false)

  const parsedJSON = useMemo(() => {
    try {
      return typeof content === 'string' ? JSON.parse(content) : content
    } catch {
      return null
    }
  }, [content])

  const handleCopy = () => {
    const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2)
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (!parsedJSON) {
    return (
      <div className="p-4 rounded-lg bg-red-900/20 border border-red-800">
        <p className="text-red-400 text-sm">Invalid JSON</p>
        <pre className="mt-2 text-xs" style={{ color: 'var(--text-muted)' }}>{content}</pre>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex justify-end mb-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: copied ? '#22c55e' : 'var(--text-muted)'
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <div
        className="p-4 rounded-lg overflow-auto font-mono text-sm"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        <JSONTree data={parsedJSON} />
      </div>
    </div>
  )
}

function JSONTree({ data, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2)
  const isArray = Array.isArray(data)
  const isObject = data !== null && typeof data === 'object' && !isArray

  if (data === null) return <span className="text-gray-500">null</span>
  if (typeof data === 'boolean') return <span className="text-purple-400">{String(data)}</span>
  if (typeof data === 'number') return <span className="text-blue-400">{data}</span>
  if (typeof data === 'string') return <span className="text-green-400">"{data}"</span>

  const entries = isArray ? data.map((v, i) => [i, v]) : Object.entries(data)
  const isEmpty = entries.length === 0

  if (isEmpty) {
    return <span style={{ color: 'var(--text-muted)' }}>{isArray ? '[]' : '{}'}</span>
  }

  const bracket = isArray ? ['[', ']'] : ['{', '}']

  return (
    <span>
      <button
        onClick={() => setExpanded(!expanded)}
        className="inline-flex items-center hover:opacity-70"
        style={{ color: 'var(--text-muted)' }}
      >
        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        <span className="ml-1">{bracket[0]}</span>
      </button>
      {!expanded && (
        <span style={{ color: 'var(--text-muted)' }}>
          {` ${entries.length} ${isArray ? 'items' : 'keys'} `}
        </span>
      )}
      {expanded && (
        <div className="ml-4 border-l" style={{ borderColor: 'var(--border-color)', paddingLeft: '1rem' }}>
          {entries.map(([key, value], index) => (
            <div key={key}>
              {!isArray && <span className="text-orange-400">"{key}"</span>}
              {isArray && <span style={{ color: 'var(--text-muted)' }}>{key}</span>}
              <span style={{ color: 'var(--text-muted)' }}>: </span>
              <JSONTree data={value} depth={depth + 1} />
              {index < entries.length - 1 && <span style={{ color: 'var(--text-muted)' }}>,</span>}
            </div>
          ))}
        </div>
      )}
      {expanded && <span style={{ color: 'var(--text-muted)' }}>{bracket[1]}</span>}
      {!expanded && <span style={{ color: 'var(--text-muted)' }}>{bracket[1]}</span>}
    </span>
  )
}

export default JSONRenderer

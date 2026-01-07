import React, { useEffect, useRef, useState } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  themeVariables: {
    primaryColor: '#CD477E',
    primaryTextColor: '#f5f5f4',
    primaryBorderColor: '#3f3f3f',
    lineColor: '#a8a29e',
    secondaryColor: '#1c1917',
    tertiaryColor: '#292524'
  },
  flowchart: {
    curve: 'basis',
    padding: 20
  },
  sequence: {
    actorMargin: 50,
    messageMargin: 40
  }
})

function MermaidRenderer({ content }) {
  const containerRef = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)

  useEffect(() => {
    const renderDiagram = async () => {
      if (!content) return

      try {
        setError(null)
        const id = `mermaid-${Date.now()}`
        const { svg: renderedSvg } = await mermaid.render(id, content)
        setSvg(renderedSvg)
      } catch (err) {
        console.error('Mermaid render error:', err)
        setError(err.message || 'Failed to render diagram')
      }
    }

    renderDiagram()
  }, [content])

  if (error) {
    return (
      <div className="p-4 rounded-lg bg-red-900/20 border border-red-800">
        <p className="text-red-400 text-sm font-medium mb-2">Failed to render diagram</p>
        <p className="text-red-300 text-xs font-mono">{error}</p>
        <pre className="mt-4 p-3 bg-[var(--bg-secondary)] rounded text-xs overflow-auto" style={{ color: 'var(--text-muted)' }}>
          {content}
        </pre>
      </div>
    )
  }

  return (
    <div
      ref={containerRef}
      className="w-full overflow-auto bg-[hsl(30,3.3%,8%)] rounded-lg p-6 flex items-center justify-center"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default MermaidRenderer

import React, { useEffect, useRef, useState, useId } from 'react'
import mermaid from 'mermaid'

// Initialize mermaid with dark theme
mermaid.initialize({
  startOnLoad: false,
  theme: 'dark',
  suppressErrorRendering: true,
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

// Counter for unique IDs
let renderCounter = 0

function MermaidRenderer({ content }) {
  const containerRef = useRef(null)
  const [svg, setSvg] = useState('')
  const [error, setError] = useState(null)
  const renderIdRef = useRef(null)

  useEffect(() => {
    let isCancelled = false

    const renderDiagram = async () => {
      if (!content) return

      try {
        setError(null)

        // Generate a unique ID using counter to avoid collisions
        renderCounter++
        const id = `mermaid-diagram-${renderCounter}`
        renderIdRef.current = id

        // Clean content - remove any stray artifact tags that might have been included
        let cleanContent = content
          .replace(/<\/?artifact[^>]*>/gi, '')
          .trim()

        // Additional cleanup for common issues
        // Remove any markdown code fence markers that might have slipped through
        cleanContent = cleanContent
          .replace(/^```mermaid\s*/i, '')
          .replace(/```\s*$/i, '')
          .trim()

        // Validate that content looks like mermaid syntax
        if (!cleanContent.match(/^(graph|flowchart|sequenceDiagram|classDiagram|stateDiagram|erDiagram|journey|gantt|pie|gitGraph)/i)) {
          console.warn('Mermaid content may not start with valid diagram type:', cleanContent.substring(0, 50))
        }

        const { svg: renderedSvg } = await mermaid.render(id, cleanContent)

        // Only update state if this render wasn't cancelled
        if (!isCancelled) {
          setSvg(renderedSvg)
        }

        // Clean up the temporary element mermaid creates
        const tempElement = document.getElementById(id)
        if (tempElement) {
          tempElement.remove()
        }
      } catch (err) {
        if (isCancelled) return

        console.error('Mermaid render error:', err)
        // Extract more useful error message
        let errorMsg = err.message || 'Failed to render diagram'
        // Mermaid errors often have a "Parse error" prefix we can simplify
        if (errorMsg.includes('Parse error')) {
          errorMsg = 'Syntax error in diagram: ' + errorMsg.split('Parse error')[1]?.trim()?.substring(0, 100) || errorMsg
        }
        setError(errorMsg)
      }
    }

    renderDiagram()

    // Cleanup function to handle component unmount or content change
    return () => {
      isCancelled = true
      // Clean up any leftover mermaid elements
      if (renderIdRef.current) {
        const tempElement = document.getElementById(renderIdRef.current)
        if (tempElement) {
          tempElement.remove()
        }
      }
    }
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

  // Process SVG to make it responsive
  const responsiveSvg = svg
    ? svg
        .replace(/width="[^"]*"/, 'width="100%"')
        .replace(/style="[^"]*"/, 'style="max-width: 100%; height: auto;"')
    : ''

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto bg-[hsl(30,3.3%,8%)] p-4"
      dangerouslySetInnerHTML={{ __html: responsiveSvg }}
    />
  )
}

export default MermaidRenderer

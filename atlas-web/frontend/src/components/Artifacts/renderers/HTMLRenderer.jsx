import React, { useRef, useEffect, useState } from 'react'

function HTMLRenderer({ content }) {
  const iframeRef = useRef(null)
  const [height, setHeight] = useState(400)

  useEffect(() => {
    if (iframeRef.current) {
      // Try to auto-resize iframe based on content
      const iframe = iframeRef.current
      iframe.onload = () => {
        try {
          const contentHeight = iframe.contentWindow.document.body.scrollHeight
          if (contentHeight > 100) {
            setHeight(Math.min(contentHeight + 20, 800))
          }
        } catch (e) {
          // Cross-origin restrictions may prevent this
        }
      }
    }
  }, [content])

  // Add Tailwind CDN if not present
  const enhancedContent = content.includes('tailwindcss.com')
    ? content
    : content.replace(
        '<head>',
        '<head>\n<script src="https://cdn.tailwindcss.com"></script>'
      )

  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden">
      <iframe
        ref={iframeRef}
        srcDoc={enhancedContent}
        sandbox="allow-scripts allow-same-origin"
        className="w-full border-0"
        style={{ height: `${height}px`, minHeight: '200px' }}
        title="HTML Preview"
      />
    </div>
  )
}

export default HTMLRenderer

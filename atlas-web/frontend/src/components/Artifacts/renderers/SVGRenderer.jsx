import React, { useState } from 'react'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

function SVGRenderer({ content }) {
  const [zoom, setZoom] = useState(1)

  const handleZoomIn = () => setZoom(z => Math.min(z + 0.25, 3))
  const handleZoomOut = () => setZoom(z => Math.max(z - 0.25, 0.25))
  const handleReset = () => setZoom(1)

  return (
    <div className="w-full h-full flex flex-col">
      {/* Zoom controls */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleZoomOut}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom out"
        >
          <ZoomOut size={18} />
        </button>
        <span className="text-sm min-w-[4rem] text-center" style={{ color: 'var(--text-muted)' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button
          onClick={handleZoomIn}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Zoom in"
        >
          <ZoomIn size={18} />
        </button>
        <button
          onClick={handleReset}
          className="p-2 rounded-lg hover:bg-[var(--bg-secondary)] transition-colors"
          style={{ color: 'var(--text-muted)' }}
          title="Reset zoom"
        >
          <RotateCcw size={18} />
        </button>
      </div>

      {/* SVG container */}
      <div className="flex-1 overflow-auto bg-white rounded-lg p-4">
        <div
          className="flex items-center justify-center min-h-full"
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: 'center center',
            transition: 'transform 0.2s ease'
          }}
          dangerouslySetInnerHTML={{ __html: content }}
        />
      </div>
    </div>
  )
}

export default SVGRenderer

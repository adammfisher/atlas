import React, { useState, useRef, useEffect } from 'react'
import { ChevronLeft, ChevronRight, Maximize2, Grid } from 'lucide-react'

const ATLAS_ORANGE = '#E07020'

function SlideRenderer({ content }) {
  const [currentSlide, setCurrentSlide] = useState(0)
  const [showOverview, setShowOverview] = useState(false)
  const iframeRef = useRef(null)
  const containerRef = useRef(null)

  // Parse slides - expects HTML with <!-- SLIDE --> comments or <section> tags
  const parseSlides = (htmlContent) => {
    // Try parsing by <!-- SLIDE --> comments first
    if (htmlContent.includes('<!-- SLIDE -->')) {
      const parts = htmlContent.split('<!-- SLIDE -->')
      // Get the head section if it exists
      const headMatch = parts[0].match(/<head[^>]*>([\s\S]*?)<\/head>/i)
      const headContent = headMatch ? headMatch[0] : ''
      const styleMatch = parts[0].match(/<style[^>]*>([\s\S]*?)<\/style>/gi)
      const styles = styleMatch ? styleMatch.join('\n') : ''

      return parts.slice(1).map((slide, index) => ({
        id: index,
        content: slide.trim(),
        headContent,
        styles
      }))
    }

    // Try parsing by <section> tags
    const sectionRegex = /<section[^>]*>([\s\S]*?)<\/section>/gi
    const sections = []
    let match
    while ((match = sectionRegex.exec(htmlContent)) !== null) {
      sections.push({
        id: sections.length,
        content: match[1].trim(),
        headContent: '',
        styles: ''
      })
    }

    if (sections.length > 0) return sections

    // If no delimiters found, treat the whole content as one slide
    return [{
      id: 0,
      content: htmlContent,
      headContent: '',
      styles: ''
    }]
  }

  const slides = parseSlides(content)
  const totalSlides = slides.length

  const goToSlide = (index) => {
    if (index >= 0 && index < totalSlides) {
      setCurrentSlide(index)
      setShowOverview(false)
    }
  }

  const nextSlide = () => goToSlide(currentSlide + 1)
  const prevSlide = () => goToSlide(currentSlide - 1)

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'ArrowRight' || e.key === ' ') {
        e.preventDefault()
        nextSlide()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        prevSlide()
      } else if (e.key === 'Escape') {
        setShowOverview(false)
      } else if (e.key === 'g' || e.key === 'G') {
        setShowOverview(!showOverview)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentSlide, showOverview])

  const createSlideHTML = (slide) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://cdn.tailwindcss.com"></script>
        <style>
          * { box-sizing: border-box; }
          html, body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            font-family: system-ui, -apple-system, sans-serif;
          }
          .slide-content {
            width: 100%;
            height: 100%;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            color: white;
          }
          h1 { font-size: 2.5rem; font-weight: 700; margin-bottom: 1rem; text-align: center; }
          h2 { font-size: 2rem; font-weight: 600; margin-bottom: 1rem; text-align: center; }
          h3 { font-size: 1.5rem; font-weight: 500; margin-bottom: 0.75rem; }
          p { font-size: 1.25rem; line-height: 1.6; text-align: center; max-width: 80%; }
          ul, ol { font-size: 1.25rem; line-height: 1.8; text-align: left; }
          li { margin-bottom: 0.5rem; }
          .highlight { color: ${ATLAS_ORANGE}; }
          img { max-width: 100%; max-height: 60vh; object-fit: contain; }
          ${slide.styles}
        </style>
      </head>
      <body>
        <div class="slide-content">
          ${slide.content}
        </div>
      </body>
      </html>
    `
  }

  if (showOverview) {
    return (
      <div className="w-full h-full flex flex-col">
        {/* Overview header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium" style={{ color: 'var(--text-primary)' }}>
            Slide Overview ({totalSlides} slides)
          </h3>
          <button
            onClick={() => setShowOverview(false)}
            className="px-3 py-1.5 rounded-lg text-sm transition-colors"
            style={{ backgroundColor: ATLAS_ORANGE, color: 'white' }}
          >
            Close Overview
          </button>
        </div>

        {/* Slide grid */}
        <div className="flex-1 overflow-auto grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 p-2">
          {slides.map((slide, index) => (
            <button
              key={slide.id}
              onClick={() => goToSlide(index)}
              className={`relative aspect-video rounded-lg overflow-hidden border-2 transition-all hover:scale-105 ${
                index === currentSlide ? 'ring-2 ring-offset-2' : ''
              }`}
              style={{
                borderColor: index === currentSlide ? ATLAS_ORANGE : 'var(--border-color)',
                ringColor: ATLAS_ORANGE
              }}
            >
              <iframe
                srcDoc={createSlideHTML(slide)}
                className="w-full h-full pointer-events-none"
                title={`Slide ${index + 1}`}
                sandbox="allow-scripts"
              />
              <div
                className="absolute bottom-0 left-0 right-0 py-1 text-center text-xs font-medium"
                style={{ backgroundColor: 'rgba(0,0,0,0.7)', color: 'white' }}
              >
                {index + 1}
              </div>
            </button>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col">
      {/* Slide container */}
      <div className="flex-1 relative rounded-lg overflow-hidden bg-gray-900">
        <iframe
          ref={iframeRef}
          srcDoc={createSlideHTML(slides[currentSlide])}
          className="w-full h-full border-0"
          title={`Slide ${currentSlide + 1}`}
          sandbox="allow-scripts"
        />
      </div>

      {/* Navigation controls */}
      <div className="flex items-center justify-between mt-4 px-2">
        <button
          onClick={prevSlide}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-30"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
          }}
        >
          <ChevronLeft size={20} />
          <span className="text-sm">Previous</span>
        </button>

        <div className="flex items-center gap-4">
          {/* Slide indicators */}
          <div className="flex items-center gap-2">
            {slides.map((_, index) => (
              <button
                key={index}
                onClick={() => goToSlide(index)}
                className="w-2.5 h-2.5 rounded-full transition-all"
                style={{
                  backgroundColor: index === currentSlide ? ATLAS_ORANGE : 'var(--text-muted)',
                  transform: index === currentSlide ? 'scale(1.2)' : 'scale(1)'
                }}
                title={`Go to slide ${index + 1}`}
              />
            ))}
          </div>

          {/* Slide counter */}
          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
            {currentSlide + 1} / {totalSlides}
          </span>

          {/* Overview button */}
          <button
            onClick={() => setShowOverview(true)}
            className="p-2 rounded-lg transition-colors hover:bg-[var(--bg-secondary)]"
            style={{ color: 'var(--text-muted)' }}
            title="Show overview (G)"
          >
            <Grid size={18} />
          </button>
        </div>

        <button
          onClick={nextSlide}
          disabled={currentSlide === totalSlides - 1}
          className="flex items-center gap-1 px-3 py-2 rounded-lg transition-colors disabled:opacity-30"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            color: 'var(--text-primary)'
          }}
        >
          <span className="text-sm">Next</span>
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}

export default SlideRenderer

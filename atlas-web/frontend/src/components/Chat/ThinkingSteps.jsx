import React, { useState } from 'react'
import { ChevronDown, ChevronRight, Globe, Loader2, Brain, Image, FileText, Database, BookOpen, Eye, Archive } from 'lucide-react'

// Ally brand pink color
const ALLY_PINK = '#CD477E'
const KNOWLEDGE_COLOR = '#4CAF50' // Green for knowledge context
const COMPACTION_COLOR = '#FF9800' // Orange for compaction notification

function ThinkingSteps({ steps, onViewArtifact }) {
  const [isExpanded, setIsExpanded] = useState(false) // Collapsed by default

  if (!steps || steps.length === 0) return null

  // Count completed steps
  const searchSteps = steps.filter(s => s.type === 'search_start')
  const thinkingSteps = steps.filter(s => s.type === 'thinking')
  const processingSteps = steps.filter(s => s.type === 'processing')
  const knowledgeSteps = steps.filter(s => s.type === 'knowledge_context')
  const compactionSteps = steps.filter(s => s.type === 'compaction')
  const isSearching = searchSteps.some(s => s.loading)
  const isProcessing = processingSteps.some(s => s.loading)

  // Extract domain from URL
  const getDomain = (url) => {
    try {
      const hostname = new URL(url).hostname
      return hostname.replace('www.', '')
    } catch {
      return url
    }
  }

  // Get favicon URL
  const getFaviconUrl = (url) => {
    try {
      const hostname = new URL(url).hostname
      return `https://www.google.com/s2/favicons?domain=${hostname}&sz=32`
    } catch {
      return null
    }
  }

  // Build summary text
  const getSummaryText = () => {
    // If processing, show that message
    if (isProcessing && processingSteps.length > 0) {
      return processingSteps[processingSteps.length - 1].message
    }
    const parts = []
    if (compactionSteps.length > 0) {
      parts.push('Conversation compacted')
    }
    if (knowledgeSteps.length > 0) {
      const context = knowledgeSteps[0].context
      const count = (context.artifacts?.length || 0) + (context.patterns?.length || 0) + (context.adrs?.length || 0)
      if (count > 0) parts.push(`${count} knowledge item${count > 1 ? 's' : ''}`)
    }
    if (processingSteps.length > 0 && !isProcessing) parts.push('Analyzed files')
    if (thinkingSteps.length > 0) parts.push(`${thinkingSteps.length} thought${thinkingSteps.length > 1 ? 's' : ''}`)
    if (searchSteps.length > 0) parts.push(`${searchSteps.length} search${searchSteps.length > 1 ? 'es' : ''}`)
    return parts.join(', ') || 'Thinking...'
  }

  return (
    <div className="mb-4 rounded-lg bg-[hsl(30,3.3%,11.8%)] border border-[var(--border-color)] overflow-hidden">
      {/* Header - Minimal summary */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[hsl(30,3.3%,18%)] transition-colors"
      >
        <Brain size={14} style={{ color: ALLY_PINK }} />
        <span className="text-[13px] flex-1 text-left" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
          {getSummaryText()}
        </span>
        {(isSearching || isProcessing) && (
          <Loader2 size={14} className="animate-spin" style={{ color: ALLY_PINK }} />
        )}
        {isExpanded ? (
          <ChevronDown size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        ) : (
          <ChevronRight size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
        )}
      </button>

      {/* Steps content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3">
          {steps.map((step, index) => (
            <div key={index}>
              {step.type === 'processing' && (
                <div className="flex items-center gap-2">
                  <Image size={14} style={{ color: ALLY_PINK }} />
                  <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                    {step.message}
                  </span>
                  {step.loading && (
                    <Loader2 size={14} className="animate-spin" style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                  )}
                  {!step.loading && (
                    <span className="text-[12px]" style={{ color: 'hsl(120, 40%, 50%)' }}>Done</span>
                  )}
                </div>
              )}

              {step.type === 'thinking' && (
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[hsl(48,4.8%,40%)]" />
                  <p className="text-[13px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
                    {step.content}
                  </p>
                </div>
              )}

              {step.type === 'search_start' && (
                <div className="flex items-center gap-2">
                  <Globe size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                  <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                    {step.query}
                  </span>
                  {step.loading && (
                    <Loader2 size={14} className="animate-spin" style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                  )}
                  {step.resultCount !== undefined && (
                    <span className="text-[12px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
                      {step.resultCount} results
                    </span>
                  )}
                </div>
              )}

              {step.type === 'search_results' && step.results && (
                <div className={`mt-2 ml-5 ${step.isCollapsed ? 'hidden' : ''}`}>
                  {step.results.slice(0, 8).map((result, resultIndex) => (
                    <a
                      key={resultIndex}
                      href={result.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 py-1.5 px-2 -mx-2 rounded hover:bg-[hsl(30,3.3%,18%)] transition-colors group"
                    >
                      {result.url ? (
                        <img
                          src={getFaviconUrl(result.url)}
                          alt=""
                          className="w-4 h-4"
                          onError={(e) => e.target.style.display = 'none'}
                        />
                      ) : (
                        <Globe size={14} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                      )}
                      <span
                        className="text-[13px] flex-1 truncate"
                        style={{ color: 'hsl(48, 33.3%, 97.1%)' }}
                      >
                        {result.title}
                      </span>
                      <span
                        className="text-[11px] opacity-60 group-hover:opacity-100"
                        style={{ color: 'hsl(48, 4.8%, 59.2%)' }}
                      >
                        {getDomain(result.url)}
                      </span>
                    </a>
                  ))}
                </div>
              )}

              {step.type === 'knowledge_context' && step.context && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Database size={14} style={{ color: KNOWLEDGE_COLOR }} />
                    <span className="text-[13px] font-medium" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                      Knowledge Core Results
                    </span>
                  </div>

                  {/* Artifacts */}
                  {step.context.artifacts && step.context.artifacts.length > 0 && (
                    <div className="ml-5 space-y-1">
                      <span className="text-[12px]" style={{ color: KNOWLEDGE_COLOR }}>Artifacts:</span>
                      {step.context.artifacts.map((artifact, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <BookOpen size={12} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                          <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                            {artifact.title}
                          </span>
                          <span className="text-[11px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
                            by {artifact.author?.name || 'Unknown'}
                          </span>
                          <span className="flex-1" />
                          {onViewArtifact && artifact.content && (
                            <button
                              onClick={() => onViewArtifact(artifact)}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium transition-colors hover:bg-[hsl(30,3.3%,25%)]"
                              style={{ backgroundColor: 'hsl(30,3.3%,18%)', color: KNOWLEDGE_COLOR }}
                            >
                              <Eye size={10} />
                              View
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Patterns */}
                  {step.context.patterns && step.context.patterns.length > 0 && (
                    <div className="ml-5 space-y-1">
                      <span className="text-[12px]" style={{ color: KNOWLEDGE_COLOR }}>Patterns:</span>
                      {step.context.patterns.map((pattern, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: KNOWLEDGE_COLOR }} />
                          <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                            {pattern.name}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* ADRs */}
                  {step.context.adrs && step.context.adrs.length > 0 && (
                    <div className="ml-5 space-y-1">
                      <span className="text-[12px]" style={{ color: KNOWLEDGE_COLOR }}>ADRs:</span>
                      {step.context.adrs.map((adr, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <FileText size={12} style={{ color: 'hsl(48, 4.8%, 59.2%)' }} />
                          <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                            {adr.id}: {adr.title}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Knowledge Gaps */}
                  {step.context.gaps && step.context.gaps.length > 0 && (
                    <div className="ml-5 space-y-1">
                      <span className="text-[12px]" style={{ color: '#FFA500' }}>Knowledge Gaps:</span>
                      {step.context.gaps.map((gap, i) => (
                        <div key={i} className="flex items-center gap-2 py-1">
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFA500' }} />
                          <span className="text-[13px]" style={{ color: 'hsl(48, 33.3%, 97.1%)' }}>
                            {gap.message}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {step.type === 'synthesis' && (
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 mt-1.5 rounded-full bg-[hsl(24,75%,50%)]" />
                  <p className="text-[13px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
                    {step.content}
                  </p>
                </div>
              )}

              {step.type === 'compaction' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Archive size={14} style={{ color: COMPACTION_COLOR }} />
                    <span className="text-[13px] font-medium" style={{ color: COMPACTION_COLOR }}>
                      {step.message || 'Conversation compacted'}
                    </span>
                  </div>
                  {step.stats && (
                    <div className="ml-5 text-[12px]" style={{ color: 'hsl(48, 4.8%, 59.2%)' }}>
                      <p>{step.stats.summarizedMessages} older messages summarized to maintain context quality.</p>
                      <p className="mt-1">
                        {step.stats.preservedMessages} recent messages preserved.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default ThinkingSteps

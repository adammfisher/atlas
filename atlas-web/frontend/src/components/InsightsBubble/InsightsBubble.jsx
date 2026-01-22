import React, { useState, useEffect } from 'react'
import { Lightbulb, X, Check, Share2, ChevronUp, Trash2, FileText } from 'lucide-react'
import { useInsightsStore } from '../../hooks/useInsightsStore'
import { insightsService } from '../../services/insightsService'

// Ally brand pink color
const ALLY_PINK = '#CD477E'
const ALLY_PINK_HOVER = '#D85A8E'
const ALLY_PINK_DARK = '#A33A65'

function InsightsBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState(new Set())
  const [isSharing, setIsSharing] = useState(false)

  const {
    insights,
    pendingCount,
    fetchInsights,
    markAsShared,
    removeInsight,
    dismissInsight
  } = useInsightsStore()

  useEffect(() => {
    // Poll for new insights periodically
    fetchInsights()
    const interval = setInterval(() => {
      fetchInsights()
    }, 30000) // Every 30 seconds

    return () => clearInterval(interval)
  }, [])

  const handleToggleSelect = (id) => {
    const newSelected = new Set(selectedIds)
    if (newSelected.has(id)) {
      newSelected.delete(id)
    } else {
      newSelected.add(id)
    }
    setSelectedIds(newSelected)
  }

  const handleShare = async () => {
    if (selectedIds.size === 0) return

    setIsSharing(true)
    try {
      const idsArray = Array.from(selectedIds)
      const results = await insightsService.shareInsights(idsArray)
      // Map results to include insight IDs with their KC artifact IDs
      const shareResults = idsArray.map((id, index) => ({
        insightId: id,
        kcArtifactId: results[index]?.kcArtifactId
      }))
      markAsShared(shareResults)
      setSelectedIds(new Set())
      // Refresh insights to sync with server
      fetchInsights()
    } catch (error) {
      console.error('Failed to share insights:', error)
    } finally {
      setIsSharing(false)
    }
  }

  const handleRemoveFromKC = async (insight) => {
    if (!insight.kcArtifactId) {
      console.error('No KC artifact ID found for insight:', insight.id)
      return
    }

    try {
      await insightsService.removeFromKnowledgeCore(insight.kcArtifactId)
      removeInsight(insight.id)
    } catch (error) {
      console.error('Failed to remove from Knowledge Core:', error)
    }
  }

  const handleDismiss = async (insight) => {
    try {
      await insightsService.dismissInsight(insight.id)
      dismissInsight(insight.id)
      // Remove from selected if it was selected
      if (selectedIds.has(insight.id)) {
        const newSelected = new Set(selectedIds)
        newSelected.delete(insight.id)
        setSelectedIds(newSelected)
      }
    } catch (error) {
      console.error('Failed to dismiss insight:', error)
    }
  }

  const pendingInsights = insights.filter(i => i.status === 'pending')
  const sharedInsights = insights.filter(i => i.status === 'shared')

  return (
    <>
      {/* Bubble Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-full shadow-lg transition-all border"
        style={pendingCount > 0 ? {
          backgroundColor: ALLY_PINK,
          borderColor: ALLY_PINK
        } : {
          backgroundColor: 'var(--bg-secondary)',
          borderColor: 'var(--border-color)'
        }}
        onMouseEnter={(e) => {
          if (pendingCount > 0) e.currentTarget.style.backgroundColor = ALLY_PINK_HOVER
        }}
        onMouseLeave={(e) => {
          if (pendingCount > 0) e.currentTarget.style.backgroundColor = ALLY_PINK
        }}
      >
        <Lightbulb size={20} className={pendingCount > 0 ? 'text-yellow-300' : ''} style={pendingCount > 0 ? {} : { color: 'var(--text-muted)' }} />
        <span className="font-medium text-sm" style={pendingCount > 0 ? { color: 'white' } : { color: 'var(--text-primary)' }}>Insights</span>
        {pendingCount > 0 && (
          <span className="flex items-center justify-center w-5 h-5 bg-yellow-400 text-black text-xs font-bold rounded-full pulse-subtle">
            {pendingCount}
          </span>
        )}
        <ChevronUp
          size={16}
          className={`transition-transform ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: 'var(--text-muted)' }}
        />
      </button>

      {/* Insights Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 w-96 max-h-[70vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden"
          style={{
            backgroundColor: 'var(--bg-secondary)',
            borderColor: 'var(--border-color)'
          }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: 'var(--border-color)' }}>
            <div>
              <h3 className="font-medium text-base" style={{ color: 'var(--text-primary)' }}>Extracted Insights</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                AI-detected insights from your conversations
              </p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="p-1 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {/* Pending Insights */}
            {pendingInsights.length > 0 && (
              <div className="p-3">
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  Ready to Share ({pendingInsights.length})
                </h4>
                <div className="space-y-2">
                  {pendingInsights.map(insight => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      isSelected={selectedIds.has(insight.id)}
                      onToggle={() => handleToggleSelect(insight.id)}
                      onDismiss={() => handleDismiss(insight)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Shared Insights */}
            {sharedInsights.length > 0 && (
              <div className="p-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                <h4 className="text-xs font-medium uppercase tracking-wide mb-2" style={{ color: 'var(--text-muted)' }}>
                  In Knowledge Core ({sharedInsights.length})
                </h4>
                <div className="space-y-2">
                  {sharedInsights.map(insight => (
                    <InsightCard
                      key={insight.id}
                      insight={insight}
                      isShared
                      onRemoveFromKC={() => handleRemoveFromKC(insight)}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {insights.length === 0 && (
              <div className="p-8 text-center">
                <Lightbulb size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                  Insights are decisions, patterns, and findings extracted from your conversations. Share them to make them discoverable across the organization.
                </p>
              </div>
            )}
          </div>

          {/* Footer - Share Button */}
          {selectedIds.size > 0 && (
            <div className="p-3 border-t backdrop-blur" style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--bg-secondary)' }}>
              <button
                onClick={handleShare}
                disabled={isSharing}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 text-white rounded-lg transition-colors"
                style={{
                  backgroundColor: isSharing ? ALLY_PINK_DARK : ALLY_PINK
                }}
                onMouseEnter={(e) => {
                  if (!isSharing) e.currentTarget.style.backgroundColor = ALLY_PINK_HOVER
                }}
                onMouseLeave={(e) => {
                  if (!isSharing) e.currentTarget.style.backgroundColor = ALLY_PINK
                }}
              >
                <Share2 size={16} />
                <span>
                  {isSharing
                    ? 'Sharing...'
                    : `Share ${selectedIds.size} Insight${selectedIds.size > 1 ? 's' : ''}`
                  }
                </span>
              </button>
              <p className="text-xs text-center mt-2" style={{ color: 'var(--text-muted)' }}>
                Your name will be attributed to shared insights
              </p>
            </div>
          )}
        </div>
      )}
    </>
  )
}

function InsightCard({ insight, isSelected, onToggle, isShared, onRemoveFromKC, onDismiss }) {
  const typeColors = {
    decision: 'bg-blue-500/20 text-blue-400',
    pattern: 'bg-purple-500/20 text-purple-400',
    solution: 'bg-green-500/20 text-green-400',
    finding: 'bg-yellow-500/20 text-yellow-400',
    artifact: 'bg-pink-500/20 text-pink-400'
  }

  // For artifact-type insights, get title and content from the artifact object
  const isArtifact = insight.type === 'artifact' && insight.artifact
  const displayTitle = isArtifact ? insight.artifact.title || insight.artifact.name : null
  const displayContent = isArtifact
    ? (insight.artifact.content?.substring(0, 150) + (insight.artifact.content?.length > 150 ? '...' : ''))
    : insight.content
  const displayType = isArtifact ? 'artifact' : insight.type

  return (
    <div
      className="p-3 rounded-lg border transition-colors cursor-pointer"
      style={isSelected ? {
        backgroundColor: 'rgba(205, 71, 126, 0.2)',
        borderColor: ALLY_PINK
      } : {
        backgroundColor: 'var(--bg-tertiary)',
        borderColor: 'var(--border-color)'
      }}
      onClick={onToggle}
    >
      <div className="flex items-start gap-3">
        {!isShared && (
          <div
            className="w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-0.5"
            style={isSelected ? {
              backgroundColor: ALLY_PINK,
              borderColor: ALLY_PINK
            } : {
              borderColor: 'var(--text-muted)'
            }}
          >
            {isSelected && <Check size={12} className="text-white" />}
          </div>
        )}

        {isShared && (
          <div className="w-5 h-5 rounded bg-green-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
            <Check size={12} className="text-green-400" />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {isArtifact && <FileText size={12} className="text-pink-400" />}
            <span className={`text-xs px-2 py-0.5 rounded-full ${typeColors[displayType] || typeColors.finding}`}>
              {displayType}
            </span>
          </div>
          {displayTitle && (
            <p className="text-sm font-medium mb-1" style={{ color: 'var(--text-primary)' }}>
              {displayTitle}
            </p>
          )}
          <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            {displayContent}
          </p>
          {insight.keywords?.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2">
              {insight.keywords.slice(0, 3).map(keyword => (
                <span
                  key={keyword}
                  className="text-xs px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
                >
                  {keyword}
                </span>
              ))}
            </div>
          )}

          {/* Dismiss button for pending insights */}
          {!isShared && onDismiss && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onDismiss()
              }}
              className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-gray-500/20"
              style={{ color: 'var(--text-muted)' }}
            >
              <X size={12} />
              <span>Dismiss</span>
            </button>
          )}

          {/* Remove from KC button for shared insights */}
          {isShared && onRemoveFromKC && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                onRemoveFromKC()
              }}
              className="mt-2 flex items-center gap-1 text-xs px-2 py-1 rounded transition-colors hover:bg-red-500/20"
              style={{ color: 'var(--text-muted)' }}
            >
              <Trash2 size={12} className="text-red-400" />
              <span>Remove from KC</span>
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

export default InsightsBubble

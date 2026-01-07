import { create } from 'zustand'
import { insightsService } from '../services/insightsService'

export const useInsightsStore = create((set, get) => ({
  // State
  insights: [],
  pendingCount: 0,
  isLoading: false,

  // Computed
  getPendingInsights: () => get().insights.filter(i => i.status === 'pending'),
  getSharedInsights: () => get().insights.filter(i => i.status === 'shared'),

  // Actions
  fetchInsights: async () => {
    set({ isLoading: true })
    try {
      const insights = await insightsService.getInsights()
      const pendingCount = insights.filter(i => i.status === 'pending').length
      set({ insights, pendingCount, isLoading: false })
    } catch (error) {
      // Silently fail - insights backend not deployed yet
      set({ insights: [], pendingCount: 0, isLoading: false })
    }
  },

  addInsight: (insight) => set((state) => ({
    insights: [...state.insights, insight],
    pendingCount: state.pendingCount + (insight.status === 'pending' ? 1 : 0)
  })),

  updateInsight: (id, updates) => set((state) => ({
    insights: state.insights.map(i =>
      i.id === id ? { ...i, ...updates } : i
    )
  })),

  // Mark insights as shared with their KC artifact IDs
  // shareResults is an array of { insightId, kcArtifactId }
  markAsShared: (shareResults) => set((state) => {
    const resultsMap = new Map(shareResults.map(r => [r.insightId, r.kcArtifactId]))
    return {
      insights: state.insights.map(i =>
        resultsMap.has(i.id)
          ? { ...i, status: 'shared', sharedAt: new Date().toISOString(), kcArtifactId: resultsMap.get(i.id) }
          : i
      ),
      pendingCount: state.pendingCount - shareResults.length
    }
  }),

  dismissInsight: (id) => set((state) => ({
    insights: state.insights.map(i =>
      i.id === id ? { ...i, status: 'dismissed' } : i
    ),
    pendingCount: state.pendingCount - 1
  })),

  // Remove an insight completely (used when removing from KC)
  removeInsight: (id) => set((state) => ({
    insights: state.insights.filter(i => i.id !== id)
  })),

  // Called when new insight detected from backend
  onInsightDetected: (insight) => {
    const existing = get().insights.find(i => i.id === insight.id)
    if (existing) {
      // Update existing insight
      get().updateInsight(insight.id, insight)
    } else {
      // Add new insight
      get().addInsight(insight)
    }
  }
}))

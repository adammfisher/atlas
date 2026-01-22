const INSIGHTS_API_URL = import.meta.env.VITE_INSIGHTS_API_URL || ''

// Helper to add credentials to fetch requests
const withCredentials = (options = {}) => ({
  ...options,
  credentials: 'include'
})

export const insightsService = {
  /**
   * Get all insights for the current user
   */
  async getInsights() {
    const response = await fetch(`${INSIGHTS_API_URL}/api/insights/`, withCredentials())
    if (!response.ok) {
      throw new Error('Failed to fetch insights')
    }
    const data = await response.json()
    return data.insights || []
  },

  /**
   * Get count of pending insights (for badge)
   */
  async getPendingCount() {
    const response = await fetch(`${INSIGHTS_API_URL}/api/insights/pending/count`, withCredentials())
    if (!response.ok) {
      throw new Error('Failed to fetch pending count')
    }
    const data = await response.json()
    return data.count
  },

  /**
   * Add a new artifact insight (called when artifact is detected in chat)
   */
  async addArtifactInsight(artifact, sessionId, messageId) {
    const response = await fetch(`${INSIGHTS_API_URL}/api/insights`, withCredentials({
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        artifact,
        sessionId,
        messageId
      }),
    }))

    if (!response.ok) {
      throw new Error('Failed to add artifact insight')
    }

    return response.json()
  },

  /**
   * Share selected insights to Knowledge Core
   * Calls individual share endpoints for each insight
   */
  async shareInsights(insightIds) {
    const results = await Promise.all(
      insightIds.map(async (id) => {
        const response = await fetch(`${INSIGHTS_API_URL}/api/insights/${id}/share`, withCredentials({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
        }))

        if (!response.ok) {
          throw new Error(`Failed to share insight ${id}`)
        }

        return response.json()
      })
    )

    return results
  },

  /**
   * Dismiss an insight
   */
  async dismissInsight(insightId) {
    const response = await fetch(`${INSIGHTS_API_URL}/api/insights/${insightId}/dismiss`, withCredentials({
      method: 'POST',
    }))

    if (!response.ok) {
      throw new Error('Failed to dismiss insight')
    }

    return response.json()
  },

  /**
   * Remove a shared artifact from Knowledge Core
   */
  async removeFromKnowledgeCore(kcArtifactId) {
    const response = await fetch(`${INSIGHTS_API_URL}/api/knowledge-core/artifacts/${kcArtifactId}`, withCredentials({
      method: 'DELETE',
    }))

    if (!response.ok) {
      throw new Error('Failed to remove from Knowledge Core')
    }

    return response.json()
  },

  /**
   * Update a previously shared insight
   */
  async updateSharedInsight(insightId) {
    const response = await fetch(`${INSIGHTS_API_URL}/api/insights/${insightId}/update-shared`, withCredentials({
      method: 'POST',
    }))

    if (!response.ok) {
      throw new Error('Failed to update insight')
    }

    return response.json()
  },

  /**
   * Search shared insights across the organization
   */
  async searchSharedInsights(query) {
    const response = await fetch(
      `${INSIGHTS_API_URL}/api/insights/shared/search?query=${encodeURIComponent(query)}`,
      withCredentials()
    )

    if (!response.ok) {
      throw new Error('Failed to search insights')
    }

    return response.json()
  },
}

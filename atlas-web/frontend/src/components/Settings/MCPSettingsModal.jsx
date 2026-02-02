import React, { useState, useEffect } from 'react'
import { X, Plus, Trash2, Server, Check, AlertCircle, Loader2 } from 'lucide-react'
import { mcpService } from '../../services/chatService'

function MCPSettingsModal({ isOpen, onClose }) {
  const [servers, setServers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [newServer, setNewServer] = useState({ name: '', url: '', description: '' })
  const [saving, setSaving] = useState(false)
  const [testingServer, setTestingServer] = useState(null)
  const [testResults, setTestResults] = useState({})

  useEffect(() => {
    if (isOpen) {
      loadServers()
    }
  }, [isOpen])

  const loadServers = async () => {
    try {
      setLoading(true)
      const data = await mcpService.list()
      setServers(data || [])
      setError(null)
    } catch (e) {
      console.error('Failed to load MCP servers:', e)
      setError('Failed to load MCP servers')
    } finally {
      setLoading(false)
    }
  }

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.url) return
    try {
      setSaving(true)
      const created = await mcpService.create(newServer)
      setServers([...servers, created])
      setNewServer({ name: '', url: '', description: '' })
      setShowAddForm(false)
    } catch (e) {
      console.error('Failed to add MCP server:', e)
      setError('Failed to add MCP server')
    } finally {
      setSaving(false)
    }
  }

  const handleToggleEnabled = async (server) => {
    try {
      await mcpService.update(server.id, { enabled: !server.enabled })
      setServers(servers.map(s => s.id === server.id ? { ...s, enabled: !s.enabled } : s))
    } catch (e) {
      console.error('Failed to toggle server:', e)
    }
  }

  const handleDeleteServer = async (serverId) => {
    if (!confirm('Delete this MCP server?')) return
    try {
      await mcpService.delete(serverId)
      setServers(servers.filter(s => s.id !== serverId))
    } catch (e) {
      console.error('Failed to delete server:', e)
    }
  }

  const handleTestServer = async (server) => {
    setTestingServer(server.id)
    setTestResults(prev => ({ ...prev, [server.id]: null }))
    try {
      const response = await fetch(`${server.url}/mcp/tools`, {
        signal: AbortSignal.timeout(5000)
      })
      if (response.ok) {
        const data = await response.json()
        setTestResults(prev => ({
          ...prev,
          [server.id]: { success: true, toolCount: data.tools?.length || 0 }
        }))
      } else {
        setTestResults(prev => ({
          ...prev,
          [server.id]: { success: false, error: `HTTP ${response.status}` }
        }))
      }
    } catch (e) {
      setTestResults(prev => ({
        ...prev,
        [server.id]: { success: false, error: e.message }
      }))
    } finally {
      setTestingServer(null)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div
        className="rounded-2xl border border-[var(--border-color)] w-[600px] max-h-[80vh] overflow-hidden shadow-2xl"
        style={{ backgroundColor: 'var(--bg-secondary)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-color)]">
          <h2 className="text-[18px] font-semibold" style={{ color: 'var(--text-primary)' }}>
            MCP Servers
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: 'var(--text-muted)' }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-4 max-h-[60vh] overflow-y-auto">
          <p className="text-[13px]" style={{ color: 'var(--text-muted)' }}>
            Configure MCP (Model Context Protocol) servers to extend the assistant with additional tools and capabilities.
          </p>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="animate-spin" size={24} style={{ color: 'var(--text-muted)' }} />
            </div>
          ) : error ? (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)' }}>
              <AlertCircle size={16} className="text-red-500" />
              <span className="text-[13px] text-red-500">{error}</span>
            </div>
          ) : (
            <>
              {/* Server List */}
              {servers.length === 0 && !showAddForm ? (
                <div className="text-center py-8">
                  <Server size={32} className="mx-auto mb-3" style={{ color: 'var(--text-muted)' }} />
                  <p className="text-[14px] mb-4" style={{ color: 'var(--text-muted)' }}>
                    No MCP servers configured
                  </p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#E07020] text-white text-[13px] hover:bg-[#c05a10] transition-colors"
                  >
                    <Plus size={16} />
                    Add MCP Server
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {servers.map(server => (
                    <div
                      key={server.id}
                      className="p-4 rounded-xl border border-[var(--border-color)]"
                      style={{ backgroundColor: 'var(--bg-primary)' }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-[14px] font-medium" style={{ color: 'var(--text-primary)' }}>
                              {server.icon || '🔌'} {server.name}
                            </span>
                            {server.enabled ? (
                              <span className="px-2 py-0.5 text-[11px] rounded-full bg-green-500/20 text-green-500">
                                Enabled
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 text-[11px] rounded-full" style={{ backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                                Disabled
                              </span>
                            )}
                          </div>
                          <p className="text-[12px] mt-1 truncate" style={{ color: 'var(--text-muted)' }}>
                            {server.url}
                          </p>
                          {server.description && (
                            <p className="text-[12px] mt-1" style={{ color: 'var(--text-muted)' }}>
                              {server.description}
                            </p>
                          )}
                          {testResults[server.id] && (
                            <div className="mt-2">
                              {testResults[server.id].success ? (
                                <span className="text-[12px] text-green-500 flex items-center gap-1">
                                  <Check size={12} /> Connected - {testResults[server.id].toolCount} tools available
                                </span>
                              ) : (
                                <span className="text-[12px] text-red-500 flex items-center gap-1">
                                  <AlertCircle size={12} /> {testResults[server.id].error}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleTestServer(server)}
                            disabled={testingServer === server.id}
                            className="px-3 py-1.5 text-[12px] rounded-lg border border-[var(--border-color)] transition-colors"
                            style={{ color: 'var(--text-primary)' }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            {testingServer === server.id ? (
                              <Loader2 className="animate-spin" size={14} />
                            ) : (
                              'Test'
                            )}
                          </button>
                          <button
                            onClick={() => handleToggleEnabled(server)}
                            className={`px-3 py-1.5 text-[12px] rounded-lg transition-colors ${
                              server.enabled
                                ? 'bg-[#E07020]/20 text-[#E07020]'
                                : 'border border-[var(--border-color)]'
                            }`}
                            style={{ color: server.enabled ? '#E07020' : 'var(--text-primary)' }}
                          >
                            {server.enabled ? 'Disable' : 'Enable'}
                          </button>
                          <button
                            onClick={() => handleDeleteServer(server.id)}
                            className="p-1.5 rounded-lg text-red-500 transition-colors"
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Server Form */}
              {showAddForm && (
                <div
                  className="p-4 rounded-xl border-2 border-dashed border-[var(--border-color)]"
                  style={{ backgroundColor: 'var(--bg-primary)' }}
                >
                  <h4 className="text-[14px] font-medium mb-3" style={{ color: 'var(--text-primary)' }}>
                    Add MCP Server
                  </h4>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>
                        Name *
                      </label>
                      <input
                        type="text"
                        value={newServer.name}
                        onChange={(e) => setNewServer({ ...newServer, name: e.target.value })}
                        placeholder="Knowledge Core"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-[13px] outline-none focus:border-[#E07020]"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>
                        URL *
                      </label>
                      <input
                        type="url"
                        value={newServer.url}
                        onChange={(e) => setNewServer({ ...newServer, url: e.target.value })}
                        placeholder="http://localhost:3001"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-[13px] outline-none focus:border-[#E07020]"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] mb-1" style={{ color: 'var(--text-muted)' }}>
                        Description
                      </label>
                      <input
                        type="text"
                        value={newServer.description}
                        onChange={(e) => setNewServer({ ...newServer, description: e.target.value })}
                        placeholder="Optional description"
                        className="w-full px-3 py-2 rounded-lg border border-[var(--border-color)] text-[13px] outline-none focus:border-[#E07020]"
                        style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div className="flex gap-2 justify-end pt-2">
                      <button
                        onClick={() => {
                          setShowAddForm(false)
                          setNewServer({ name: '', url: '', description: '' })
                        }}
                        className="px-4 py-2 text-[13px] rounded-lg transition-colors"
                        style={{ color: 'var(--text-muted)' }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddServer}
                        disabled={!newServer.name || !newServer.url || saving}
                        className="px-4 py-2 text-[13px] rounded-lg bg-[#E07020] text-white hover:bg-[#c05a10] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                      >
                        {saving ? 'Adding...' : 'Add Server'}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Add Button */}
              {servers.length > 0 && !showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-[var(--border-color)] text-[13px] transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = 'var(--bg-tertiary)'
                    e.currentTarget.style.borderColor = '#E07020'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'transparent'
                    e.currentTarget.style.borderColor = 'var(--border-color)'
                  }}
                >
                  <Plus size={16} />
                  Add MCP Server
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default MCPSettingsModal

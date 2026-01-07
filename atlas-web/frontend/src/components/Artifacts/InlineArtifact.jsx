import React from 'react'
import { Code, Download, AlertTriangle } from 'lucide-react'

// Simple inline artifact card - clicking opens in the right panel
function InlineArtifact({ artifact, onOpenInPanel }) {
  const isIncomplete = artifact.incomplete === true

  const getTypeLabel = () => {
    const labels = {
      '.html': 'HTML',
      '.svg': 'SVG',
      '.md': 'Markdown',
      '.mermaid': 'Diagram',
      '.jsx': 'React',
      '.json': 'JSON',
      '.css': 'CSS',
      '.js': 'JavaScript',
      '.py': 'Python'
    }
    return labels[artifact.file_extension] || artifact.type?.toUpperCase() || 'Code'
  }

  const handleDownload = (e) => {
    e.stopPropagation()
    if (artifact.content) {
      const mimeTypes = {
        '.md': 'text/markdown',
        '.html': 'text/html',
        '.svg': 'image/svg+xml',
        '.json': 'application/json',
        '.css': 'text/css',
        '.js': 'text/javascript'
      }
      const mimeType = mimeTypes[artifact.file_extension] || 'text/plain'
      const blob = new Blob([artifact.content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const filename = (artifact.title || artifact.name || 'artifact').replace(/\s+/g, '-').toLowerCase() + artifact.file_extension
      a.download = filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    }
  }

  return (
    <div
      className="my-4 rounded-xl overflow-hidden border cursor-pointer transition-all hover:border-opacity-60"
      style={{
        backgroundColor: 'var(--bg-secondary)',
        borderColor: isIncomplete ? '#f59e0b' : 'var(--border-color)'
      }}
      onClick={() => onOpenInPanel?.(artifact)}
    >
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          {/* Code icon - show warning for incomplete */}
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: isIncomplete ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-tertiary)' }}
          >
            {isIncomplete ? (
              <AlertTriangle size={20} style={{ color: '#f59e0b' }} />
            ) : (
              <Code size={20} style={{ color: 'var(--text-muted)' }} />
            )}
          </div>
          {/* Title and type */}
          <div>
            <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
              {artifact.title || artifact.name}
            </div>
            <div className="text-xs" style={{ color: isIncomplete ? '#f59e0b' : 'var(--text-muted)' }}>
              {isIncomplete ? 'Response cut off · ' : 'Code · '}{getTypeLabel()}
            </div>
          </div>
        </div>
        {/* Download button - disabled or warning for incomplete */}
        <button
          onClick={handleDownload}
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{
            backgroundColor: isIncomplete ? 'rgba(245, 158, 11, 0.2)' : 'var(--bg-tertiary)',
            color: isIncomplete ? '#f59e0b' : 'var(--text-primary)'
          }}
          onMouseEnter={(e) => e.target.style.opacity = '0.8'}
          onMouseLeave={(e) => e.target.style.opacity = '1'}
          title={isIncomplete ? 'Download incomplete content' : 'Download artifact'}
        >
          {isIncomplete ? 'Incomplete' : 'Download'}
        </button>
      </div>
    </div>
  )
}

// Extract a meaningful title from artifact content
function extractTitleFromContent(content, type, fallbackName) {
  if (!content) return fallbackName

  // For markdown, look for ADR-specific patterns first, then fall back to # heading
  if (type === 'markdown' || type === 'md') {
    // Check for ADR/document-specific title patterns
    // Match **Title:** PII Handling in AI Services
    const titleFieldMatch = content.match(/\*\*Title:\*\*\s*(.+?)(?:\n|$)/i)
    if (titleFieldMatch) {
      return titleFieldMatch[1].trim()
    }

    // Match ## Title: PII Handling...
    const titleHeadingMatch = content.match(/^##?\s*Title:\s*(.+)$/mi)
    if (titleHeadingMatch) {
      return titleHeadingMatch[1].trim()
    }

    // Match **Decision:** as alternative for ADRs
    const decisionMatch = content.match(/\*\*Decision:\*\*\s*(.+?)(?:\n|$)/i)
    if (decisionMatch) {
      return decisionMatch[1].trim()
    }

    // Match **Subject:** pattern
    const subjectMatch = content.match(/\*\*Subject:\*\*\s*(.+?)(?:\n|$)/i)
    if (subjectMatch) {
      return subjectMatch[1].trim()
    }

    // Fall back to first # heading
    const headingMatch = content.match(/^#\s+(.+)$/m)
    if (headingMatch) {
      return headingMatch[1].trim()
    }
  }

  // For HTML, look for <title> or first <h1>
  if (type === 'html') {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i)
    if (titleMatch) return titleMatch[1].trim()
    const h1Match = content.match(/<h1[^>]*>([^<]+)<\/h1>/i)
    if (h1Match) return h1Match[1].trim()
  }

  // For JSON, try to extract a name/title field
  if (type === 'json') {
    try {
      const parsed = JSON.parse(content)
      if (parsed.title) return parsed.title
      if (parsed.name) return parsed.name
    } catch (e) {
      // Not valid JSON yet
    }
  }

  // For React/JSX, look for component name or export
  if (type === 'react' || type === 'jsx') {
    const funcMatch = content.match(/(?:function|const)\s+([A-Z][a-zA-Z0-9]*)/m)
    if (funcMatch) return funcMatch[1]
    const exportMatch = content.match(/export\s+(?:default\s+)?(?:function\s+)?([A-Z][a-zA-Z0-9]*)/m)
    if (exportMatch) return exportMatch[1]
  }

  // For SVG, look for title element
  if (type === 'svg') {
    const titleMatch = content.match(/<title>([^<]+)<\/title>/i)
    if (titleMatch) return titleMatch[1].trim()
  }

  return fallbackName
}

// Type to extension mapping
const typeToExtension = {
  'html': '.html',
  'svg': '.svg',
  'markdown': '.md',
  'md': '.md',
  'mermaid': '.mermaid',
  'react': '.jsx',
  'jsx': '.jsx',
  'json': '.json',
  'css': '.css',
  'javascript': '.js',
  'js': '.js',
  'python': '.py',
  'py': '.py'
}

// Type to display name mapping
const typeToName = {
  'html': 'HTML Document',
  'svg': 'SVG Diagram',
  'markdown': 'Markdown Document',
  'md': 'Markdown Document',
  'mermaid': 'Mermaid Diagram',
  'react': 'React Component',
  'jsx': 'React Component',
  'json': 'JSON Data',
  'css': 'CSS Stylesheet',
  'javascript': 'JavaScript',
  'js': 'JavaScript',
  'python': 'Python',
  'py': 'Python'
}

// Parse message content and extract artifacts
export function parseMessageForArtifacts(content) {
  const artifacts = []
  let modifiedContent = content
  let artifactIndex = 0

  // NEW: Parse <artifact> tags first (preferred format)
  // Match: <artifact type="TYPE" title="TITLE">CONTENT</artifact>
  const artifactTagRegex = /<artifact\s+type=["']([^"']+)["']\s+title=["']([^"']+)["']\s*>([\s\S]*?)<\/artifact>/gi
  let tagMatch

  while ((tagMatch = artifactTagRegex.exec(content)) !== null) {
    const type = tagMatch[1].toLowerCase()
    const title = tagMatch[2]
    const artifactContent = tagMatch[3].trim()

    if (artifactContent.length > 50) {
      const artifactId = `inline_art_${Date.now()}_${artifactIndex++}`
      const ext = typeToExtension[type] || '.txt'
      const normalizedType = type === 'md' ? 'markdown' : (type === 'js' ? 'javascript' : type)

      artifacts.push({
        id: artifactId,
        name: title,
        title: title,
        type: normalizedType,
        file_extension: ext,
        content: artifactContent,
        renderable: true,
        incomplete: false,
        version: 1,
        created_at: new Date().toISOString(),
        size: artifactContent.length,
        placeholder: `__ARTIFACT_${artifactId}__`
      })
      modifiedContent = modifiedContent.replace(tagMatch[0], `__ARTIFACT_${artifactId}__`)
    }
  }

  // Check for incomplete <artifact> tags (opened but not closed)
  const incompleteArtifactRegex = /<artifact\s+type=["']([^"']+)["']\s+title=["']([^"']+)["']\s*>([\s\S]+)$/gi
  let incompleteTagMatch

  while ((incompleteTagMatch = incompleteArtifactRegex.exec(modifiedContent)) !== null) {
    const type = incompleteTagMatch[1].toLowerCase()
    const title = incompleteTagMatch[2]
    const artifactContent = incompleteTagMatch[3].trim()

    if (artifactContent.length > 100) {
      const artifactId = `inline_art_${Date.now()}_${artifactIndex++}`
      const ext = typeToExtension[type] || '.txt'
      const normalizedType = type === 'md' ? 'markdown' : (type === 'js' ? 'javascript' : type)

      artifacts.push({
        id: artifactId,
        name: title,
        title: title + ' (Incomplete)',
        type: normalizedType,
        file_extension: ext,
        content: artifactContent,
        renderable: true,
        incomplete: true,
        version: 1,
        created_at: new Date().toISOString(),
        size: artifactContent.length,
        placeholder: `__ARTIFACT_${artifactId}__`
      })
      modifiedContent = modifiedContent.replace(incompleteTagMatch[0], `__ARTIFACT_${artifactId}__`)
    }
  }

  // LEGACY: Also support old code block format for backwards compatibility
  const artifactPatterns = [
    { regex: /```html\n([\s\S]*?)```/g, type: 'html', ext: '.html', name: 'HTML Document' },
    { regex: /```svg\n([\s\S]*?)```/g, type: 'svg', ext: '.svg', name: 'SVG Diagram' },
    { regex: /```markdown\n([\s\S]*?)```/g, type: 'markdown', ext: '.md', name: 'Markdown Document' },
    { regex: /```md\n([\s\S]*?)```/g, type: 'markdown', ext: '.md', name: 'Markdown Document' },
    { regex: /```mermaid\n([\s\S]*?)```/g, type: 'mermaid', ext: '.mermaid', name: 'Mermaid Diagram' },
    { regex: /```jsx\n([\s\S]*?)```/g, type: 'react', ext: '.jsx', name: 'React Component' },
    { regex: /```json\n([\s\S]*?)```/g, type: 'json', ext: '.json', name: 'JSON Data' },
    { regex: /```css\n([\s\S]*?)```/g, type: 'css', ext: '.css', name: 'CSS Stylesheet' },
  ]

  // Patterns for incomplete artifacts (no closing ```)
  const incompletePatterns = [
    { regex: /```html\n([\s\S]+)$/g, type: 'html', ext: '.html', name: 'HTML Document (Incomplete)' },
    { regex: /```svg\n([\s\S]+)$/g, type: 'svg', ext: '.svg', name: 'SVG Diagram (Incomplete)' },
    { regex: /```markdown\n([\s\S]+)$/g, type: 'markdown', ext: '.md', name: 'Markdown Document (Incomplete)' },
    { regex: /```md\n([\s\S]+)$/g, type: 'markdown', ext: '.md', name: 'Markdown Document (Incomplete)' },
    { regex: /```mermaid\n([\s\S]+)$/g, type: 'mermaid', ext: '.mermaid', name: 'Mermaid Diagram (Incomplete)' },
    { regex: /```jsx\n([\s\S]+)$/g, type: 'react', ext: '.jsx', name: 'React Component (Incomplete)' },
    { regex: /```json\n([\s\S]+)$/g, type: 'json', ext: '.json', name: 'JSON Data (Incomplete)' },
    { regex: /```css\n([\s\S]+)$/g, type: 'css', ext: '.css', name: 'CSS Stylesheet (Incomplete)' },
  ]

  // Process complete code block artifacts (legacy format)
  for (const pattern of artifactPatterns) {
    let match
    pattern.regex.lastIndex = 0

    while ((match = pattern.regex.exec(modifiedContent)) !== null) {
      const codeContent = match[1].trim()
      // Only create artifacts for substantial content (more than 100 chars)
      if (codeContent.length > 100) {
        const artifactId = `inline_art_${Date.now()}_${artifactIndex++}`
        const extractedTitle = extractTitleFromContent(codeContent, pattern.type, pattern.name)
        artifacts.push({
          id: artifactId,
          name: extractedTitle,
          title: extractedTitle,
          type: pattern.type,
          file_extension: pattern.ext,
          content: codeContent,
          renderable: true,
          incomplete: false,
          version: 1,
          created_at: new Date().toISOString(),
          size: codeContent.length,
          placeholder: `__ARTIFACT_${artifactId}__`
        })
        modifiedContent = modifiedContent.replace(match[0], `__ARTIFACT_${artifactId}__`)
      }
    }
  }

  // Then, check for incomplete code block artifacts (legacy format)
  for (const pattern of incompletePatterns) {
    let match
    pattern.regex.lastIndex = 0

    while ((match = pattern.regex.exec(modifiedContent)) !== null) {
      const codeContent = match[1].trim()
      // Only create artifacts for substantial incomplete content (more than 200 chars)
      if (codeContent.length > 200) {
        const artifactId = `inline_art_${Date.now()}_${artifactIndex++}`
        const extractedTitle = extractTitleFromContent(codeContent, pattern.type, pattern.name)
        artifacts.push({
          id: artifactId,
          name: extractedTitle,
          title: extractedTitle + ' (Incomplete)',
          type: pattern.type,
          file_extension: pattern.ext,
          content: codeContent,
          renderable: true,
          incomplete: true,
          version: 1,
          created_at: new Date().toISOString(),
          size: codeContent.length,
          placeholder: `__ARTIFACT_${artifactId}__`
        })
        modifiedContent = modifiedContent.replace(match[0], `__ARTIFACT_${artifactId}__`)
      }
    }
  }

  return { artifacts, modifiedContent }
}

// Export for use in ChatView
export { extractTitleFromContent }

export default InlineArtifact

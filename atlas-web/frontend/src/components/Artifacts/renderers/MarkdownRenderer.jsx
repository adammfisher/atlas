import React, { useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter'
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism'

// Try to fix malformed tables that are all on one line
function fixMalformedTables(content) {
  if (!content) return content

  // Process line by line
  const lines = content.split('\n')
  const fixedLines = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Skip lines that don't look like tables at all
    if (!line.includes('|')) {
      fixedLines.push(line)
      continue
    }

    // Check if this line contains a table separator pattern
    // Match patterns like: |---|---|---| or | --- | --- | --- |
    const hasSeparator = /\|[\s]*[-:]+[\s]*\|/.test(line)

    if (hasSeparator) {
      // This line has a separator - check if it's all on one line (malformed)
      // A well-formed table has the separator on its own line
      const parts = line.split(/(\|[\s]*[-:]+[\s]*(?:\|[\s]*[-:]+[\s]*)+\|)/)

      if (parts.length >= 2 && parts[0].includes('|')) {
        // Header is before the separator, data after
        const header = parts[0].trim()
        const separator = parts[1].trim()
        const afterSeparator = parts.slice(2).join('').trim()

        // Count columns from separator
        const sepParts = separator.split('|').filter(s => s.trim() !== '')
        const numColumns = sepParts.length

        // Add header row
        if (header) {
          fixedLines.push(header.endsWith('|') ? header : header + ' |')
        }

        // Add separator row
        fixedLines.push(separator)

        // Process data rows after separator
        if (afterSeparator && numColumns > 0) {
          // Remove leading | if present
          let dataContent = afterSeparator
          if (dataContent.startsWith('|')) {
            dataContent = dataContent.substring(1)
          }

          // Split the remaining content by | and reconstruct rows
          const cells = dataContent.split('|').map(c => c.trim())

          let currentRow = []
          for (let j = 0; j < cells.length; j++) {
            if (cells[j] === '') continue // Skip empty cells from consecutive ||
            currentRow.push(cells[j])
            if (currentRow.length === numColumns) {
              fixedLines.push('| ' + currentRow.join(' | ') + ' |')
              currentRow = []
            }
          }
          // Handle any remaining cells (incomplete row)
          if (currentRow.length > 0) {
            // Pad with empty cells if needed
            while (currentRow.length < numColumns) {
              currentRow.push('')
            }
            fixedLines.push('| ' + currentRow.join(' | ') + ' |')
          }
        }
      } else {
        // Separator is on its own or at the start - line is probably fine
        fixedLines.push(line)
      }
    } else {
      // No separator on this line, just add it
      fixedLines.push(line)
    }
  }

  return fixedLines.join('\n')
}

function MarkdownRenderer({ content, fontFamily }) {
  // Attempt to fix malformed tables
  const processedContent = useMemo(() => fixMalformedTables(content), [content])

  // Use passed fontFamily or fall back to system default
  const effectiveFontFamily = fontFamily || 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif'

  return (
    <div className="max-w-none" style={{ fontFamily: effectiveFontFamily, lineHeight: 1.7 }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="text-[1.75rem] font-semibold mt-8 mb-4 first:mt-0 tracking-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.02em' }}
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="text-[1.25rem] font-semibold mt-8 mb-3 tracking-tight"
              style={{ color: 'var(--text-primary)', letterSpacing: '-0.01em' }}
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="text-[1.1rem] font-semibold mt-6 mb-2"
              style={{ color: 'var(--text-primary)' }}
              {...props}
            />
          ),
          h4: ({ node, ...props }) => (
            <h4
              className="text-[1rem] font-semibold mt-5 mb-2"
              style={{ color: 'var(--text-primary)' }}
              {...props}
            />
          ),
          p: ({ node, ...props }) => (
            <p className="mb-4 text-[0.9375rem] leading-[1.7]" style={{ color: 'var(--text-secondary)' }} {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-6 mb-4 space-y-2 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }} {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-6 mb-4 space-y-2 text-[0.9375rem]" style={{ color: 'var(--text-secondary)' }} {...props} />
          ),
          li: ({ node, ...props }) => (
            <li className="leading-[1.6] pl-1" {...props} />
          ),
          a: ({ node, ...props }) => (
            <a className="text-[#CD477E] hover:underline" target="_blank" rel="noopener noreferrer" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-3 pl-4 my-5 italic text-[0.9375rem]"
              style={{ borderColor: 'var(--border-color)', borderLeftWidth: '3px', color: 'var(--text-muted)' }}
              {...props}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong className="font-semibold" style={{ color: 'var(--text-primary)' }} {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-5 rounded-lg border" style={{ borderColor: 'var(--border-color)' }}>
              <table className="min-w-full border-collapse text-[0.875rem]" {...props} />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead style={{ backgroundColor: 'var(--bg-secondary)' }} {...props} />
          ),
          tbody: ({ node, ...props }) => (
            <tbody {...props} />
          ),
          tr: ({ node, ...props }) => (
            <tr className="border-b last:border-b-0" style={{ borderColor: 'var(--border-color)' }} {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="px-4 py-2.5 text-left font-semibold text-[0.8125rem]"
              style={{ color: 'var(--text-primary)' }}
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className="px-4 py-2.5 text-[0.8125rem]"
              style={{ color: 'var(--text-secondary)' }}
              {...props}
            />
          ),
          code: ({ node, inline, className, children, ...props }) => {
            const match = /language-(\w+)/.exec(className || '')
            return !inline && match ? (
              <SyntaxHighlighter
                style={oneDark}
                language={match[1]}
                PreTag="div"
                className="rounded-lg my-5 text-[0.8125rem]"
                customStyle={{ fontSize: '0.8125rem' }}
                {...props}
              >
                {String(children).replace(/\n$/, '')}
              </SyntaxHighlighter>
            ) : (
              <code
                className="px-1.5 py-0.5 rounded text-[0.8125rem]"
                style={{ backgroundColor: 'var(--bg-tertiary)', color: '#f97316' }}
                {...props}
              >
                {children}
              </code>
            )
          },
          hr: ({ node, ...props }) => (
            <hr className="my-8 border-t" style={{ borderColor: 'var(--border-color)' }} {...props} />
          ),
        }}
      >
        {processedContent}
      </ReactMarkdown>
    </div>
  )
}

export default MarkdownRenderer

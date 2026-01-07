import React, { useMemo, useState } from 'react'
import { ArrowUp, ArrowDown, Download } from 'lucide-react'

function CSVRenderer({ content }) {
  const [sortColumn, setSortColumn] = useState(null)
  const [sortDirection, setSortDirection] = useState('asc')

  const { headers, rows } = useMemo(() => {
    if (!content) return { headers: [], rows: [] }

    const lines = content.trim().split('\n')
    if (lines.length === 0) return { headers: [], rows: [] }

    // Parse CSV - handle quoted values
    const parseLine = (line) => {
      const result = []
      let current = ''
      let inQuotes = false

      for (let i = 0; i < line.length; i++) {
        const char = line[i]
        if (char === '"') {
          inQuotes = !inQuotes
        } else if (char === ',' && !inQuotes) {
          result.push(current.trim())
          current = ''
        } else {
          current += char
        }
      }
      result.push(current.trim())
      return result
    }

    const headers = parseLine(lines[0])
    const rows = lines.slice(1).map(line => parseLine(line))

    return { headers, rows }
  }, [content])

  const sortedRows = useMemo(() => {
    if (sortColumn === null) return rows

    return [...rows].sort((a, b) => {
      const aVal = a[sortColumn] || ''
      const bVal = b[sortColumn] || ''

      // Try numeric sort first
      const aNum = parseFloat(aVal)
      const bNum = parseFloat(bVal)
      if (!isNaN(aNum) && !isNaN(bNum)) {
        return sortDirection === 'asc' ? aNum - bNum : bNum - aNum
      }

      // Fall back to string sort
      const comparison = aVal.localeCompare(bVal)
      return sortDirection === 'asc' ? comparison : -comparison
    })
  }, [rows, sortColumn, sortDirection])

  const handleSort = (columnIndex) => {
    if (sortColumn === columnIndex) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(columnIndex)
      setSortDirection('asc')
    }
  }

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'data.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (headers.length === 0) {
    return (
      <div className="p-4 text-center" style={{ color: 'var(--text-muted)' }}>
        No data to display
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="flex justify-between items-center mb-3">
        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
          {rows.length} rows, {headers.length} columns
        </span>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 px-2 py-1 rounded text-xs transition-colors hover:bg-[var(--bg-tertiary)]"
          style={{ backgroundColor: 'var(--bg-secondary)', color: 'var(--text-muted)' }}
        >
          <Download size={14} />
          Download CSV
        </button>
      </div>

      <div className="overflow-auto rounded-lg border" style={{ borderColor: 'var(--border-color)', maxHeight: '500px' }}>
        <table className="w-full text-sm">
          <thead className="sticky top-0" style={{ backgroundColor: 'var(--bg-secondary)' }}>
            <tr>
              {headers.map((header, i) => (
                <th
                  key={i}
                  className="px-4 py-2 text-left font-medium cursor-pointer hover:bg-[var(--bg-tertiary)] transition-colors"
                  style={{ color: 'var(--text-primary)', borderBottom: '1px solid var(--border-color)' }}
                  onClick={() => handleSort(i)}
                >
                  <div className="flex items-center gap-1">
                    {header}
                    {sortColumn === i && (
                      sortDirection === 'asc' ? <ArrowUp size={14} /> : <ArrowDown size={14} />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className="hover:bg-[var(--bg-secondary)] transition-colors"
                style={{ borderBottom: '1px solid var(--border-color)' }}
              >
                {row.map((cell, cellIndex) => (
                  <td
                    key={cellIndex}
                    className="px-4 py-2"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CSVRenderer

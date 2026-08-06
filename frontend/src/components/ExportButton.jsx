import { useLocation } from 'react-router-dom'
import { Download } from 'lucide-react'

const ROUTE_MAP = {
  '/colleges': { label: 'Colleges', filename: 'colleges-export.txt' },
  '/programs': { label: 'Programs', filename: 'programs-export.txt' },
  '/scholarships': { label: 'Scholarships', filename: 'scholarships-export.txt' },
}

function collectExportText() {
  const container = document.querySelector('main') || document.body
  const text = container.innerText || ''
  return text
    .replace(/ /g, ' ')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export default function ExportButton() {
  const location = useLocation()
  const meta = ROUTE_MAP[location.pathname]

  if (!meta) return null

  function handleExport() {
    const exportText = collectExportText()
    if (!exportText) return

    const blob = new Blob(
      [`Exported ${meta.label} content\nGenerated: ${new Date().toLocaleString()}\n\n${exportText}`],
      { type: 'text/plain;charset=utf-8' }
    )
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = meta.filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
  }

  return (
    <button
      type="button"
      onClick={handleExport}
      className="fixed right-4 top-20 z-40 flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-semibold text-text-primary shadow-lg shadow-ink/10 hover:bg-surface-raised md:top-4 md:z-50"
    >
      <Download size={16} />
      Export {meta.label}
    </button>
  )
}

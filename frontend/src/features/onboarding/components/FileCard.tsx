// Uploaded-file display with delete affordance (design doc §6) — thumbnail
// for images, a document icon + filename for PDFs.

import { FileText, Image as ImageIcon, X } from 'lucide-react'
import type { UploadedFile } from '../types/onboarding.ts'

export interface FileCardProps {
  file: UploadedFile
  onRemove: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function FileCard({ file, onRemove }: FileCardProps): JSX.Element {
  const isImage = file.content_type.startsWith('image/')

  return (
    <div className="flex items-center gap-3 rounded-md border border-border bg-surface px-3 py-2">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-surface-raised text-text-secondary">
        {isImage ? <ImageIcon size={16} /> : <FileText size={16} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">{file.file_name}</p>
        <p className="text-xs text-text-secondary">{formatSize(file.size_bytes)}</p>
      </div>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${file.file_name}`}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-warning"
      >
        <X size={14} />
      </button>
    </div>
  )
}

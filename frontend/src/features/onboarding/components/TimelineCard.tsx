// Timeline entry card — shared by Volunteer Work and Internships (design doc
// §3 comment: "volunteer/internship entries"). Mobile: full-width stacked
// card with a top-border accent; desktop: same card, just wider.

import { Pencil, Trash2 } from 'lucide-react'

export interface TimelineCardProps {
  title: string
  subtitle?: string | null
  dateRange: string
  meta?: string | null
  description?: string | null
  accentClassName?: string
  onEdit: () => void
  onDelete: () => void
}

export function TimelineCard({
  title,
  subtitle,
  dateRange,
  meta,
  description,
  accentClassName = 'border-t-accent',
  onEdit,
  onDelete,
}: TimelineCardProps): JSX.Element {
  return (
    <div className={`rounded-lg border border-border border-t-4 bg-surface p-4 ${accentClassName}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text-primary">{title}</p>
          {subtitle && <p className="truncate text-xs text-text-secondary">{subtitle}</p>}
        </div>
        <div className="flex shrink-0 gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Edit"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-accent"
          >
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete"
            className="flex h-7 w-7 items-center justify-center rounded-full text-text-secondary hover:bg-surface-raised hover:text-warning"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
        <span>{dateRange}</span>
        {meta && (
          <>
            <span aria-hidden="true">·</span>
            <span>{meta}</span>
          </>
        )}
      </div>
      {description && <p className="mt-2 line-clamp-3 text-sm text-text-secondary">{description}</p>}
    </div>
  )
}

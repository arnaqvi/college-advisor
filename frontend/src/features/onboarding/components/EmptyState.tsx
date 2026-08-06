// Encouraging, opportunity-framed empty state (design doc §10 microcopy tone
// — never "You're missing 3 things!").

import type { LucideIcon } from 'lucide-react'

export interface EmptyStateProps {
  icon: LucideIcon
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
}

export function EmptyState({ icon: Icon, title, subtitle, actionLabel, onAction }: EmptyStateProps): JSX.Element {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-border bg-surface-raised px-6 py-10 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon size={20} />
      </span>
      <p className="text-sm font-medium text-text-primary">{title}</p>
      {subtitle && <p className="max-w-sm text-xs text-text-secondary">{subtitle}</p>}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="mt-2 rounded-md bg-accent px-4 py-2 text-xs font-semibold text-accent-contrast"
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

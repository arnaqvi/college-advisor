// Shared badge component — used both for the Awards step's badge-grid and
// the gamification Achievements system (design doc §10: "same
// AchievementBadge.tsx component in both places, so the two systems feel
// unified instead of bolted together").

import type { LucideIcon } from 'lucide-react'
import { motion } from 'framer-motion'

export interface AchievementBadgeProps {
  icon: LucideIcon
  label: string
  earned: boolean
  description?: string
}

export function AchievementBadge({ icon: Icon, label, earned, description }: AchievementBadgeProps): JSX.Element {
  return (
    <motion.div
      initial={false}
      animate={{ opacity: earned ? 1 : 0.5, scale: earned ? 1 : 0.96 }}
      className="flex flex-col items-center gap-2 rounded-lg border border-border bg-surface p-4 text-center"
    >
      <span
        className={`flex h-12 w-12 items-center justify-center rounded-full ${
          earned ? 'bg-accent text-accent-contrast' : 'bg-surface-raised text-text-secondary'
        }`}
      >
        <Icon size={22} />
      </span>
      <p className="text-xs font-semibold text-text-primary">{label}</p>
      {description && <p className="text-[11px] text-text-secondary">{description}</p>}
    </motion.div>
  )
}

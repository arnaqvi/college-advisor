// Toast shown alongside the confetti burst at 25/50/75/100% (design doc §1).

import { motion, AnimatePresence } from 'framer-motion'
import { PartyPopper } from 'lucide-react'

export interface MilestoneToastProps {
  pct: number | null
  onDismiss: () => void
}

const MESSAGES: Record<number, string> = {
  25: "Nice start — you're a quarter of the way to a complete profile!",
  50: "Halfway there — keep the momentum going!",
  75: "So close — just a few sections left!",
  100: 'Profile complete — your College Readiness Score is ready!',
}

export function MilestoneToast({ pct, onDismiss }: MilestoneToastProps): JSX.Element {
  return (
    <AnimatePresence>
      {pct !== null && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.2 }}
          className="fixed bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 shadow-lg lg:bottom-6"
          role="status"
        >
          <PartyPopper size={16} className="text-accent" />
          <span className="text-sm font-medium text-text-primary">{MESSAGES[pct] ?? `${pct}% complete!`}</span>
          <button
            type="button"
            onClick={onDismiss}
            className="ml-1 text-xs font-semibold text-text-secondary hover:text-text-primary"
          >
            Dismiss
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

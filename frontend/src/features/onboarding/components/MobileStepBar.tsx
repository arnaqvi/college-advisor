// Sticky mobile top + bottom bars (design doc §2): top = back chevron + step
// title + progress ring; bottom = ghost "Back" + filled "Continue", safe-area
// padded.

import { ChevronLeft } from 'lucide-react'
import { ProgressRing } from './ProgressRing.tsx'

export interface MobileTopBarProps {
  title: string
  percent: number
  onBack: (() => void) | null
}

export function MobileTopBar({ title, percent, onBack }: MobileTopBarProps): JSX.Element {
  return (
    <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-surface px-4 py-3 lg:hidden">
      <button
        type="button"
        onClick={onBack ?? undefined}
        disabled={!onBack}
        aria-label="Back"
        className={`flex h-8 w-8 items-center justify-center rounded-full ${
          onBack ? 'text-text-primary hover:bg-surface-raised' : 'invisible'
        }`}
      >
        <ChevronLeft size={20} />
      </button>
      <h1 className="text-sm font-semibold text-text-primary">{title}</h1>
      <ProgressRing percent={percent} size={32} strokeWidth={3} />
    </header>
  )
}

export interface MobileBottomBarProps {
  onBack: (() => void) | null
  onContinue: () => void
  continueLabel?: string
  continueDisabled?: boolean
}

export function MobileBottomBar({
  onBack,
  onContinue,
  continueLabel = 'Continue',
  continueDisabled = false,
}: MobileBottomBarProps): JSX.Element {
  return (
    <footer
      className="sticky bottom-0 z-20 flex gap-3 border-t border-border bg-surface px-4 py-3 lg:hidden"
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      {onBack && (
        <button
          type="button"
          onClick={onBack}
          className="flex-1 rounded-md border border-border px-4 py-2.5 text-sm font-medium text-text-primary"
        >
          Back
        </button>
      )}
      <button
        type="button"
        onClick={onContinue}
        disabled={continueDisabled}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-semibold text-accent-contrast disabled:opacity-50"
      >
        {continueLabel}
      </button>
    </footer>
  )
}

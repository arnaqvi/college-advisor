// Desktop left nav (design doc §2: fixed 280px rail, all 9 steps + checkmarks,
// the "free jump" nav once every step has been visited once).

import { Check } from 'lucide-react'
import { NavLink } from 'react-router-dom'
import { STEP_LABELS, STEP_ORDER, type StepKey } from '../types/onboarding.ts'

export interface StepRailProps {
  completedSteps: StepKey[]
  canJump: boolean
}

export function StepRail({ completedSteps, canJump }: StepRailProps): JSX.Element {
  return (
    <nav className="hidden w-[280px] shrink-0 flex-col gap-1 border-r border-border bg-surface-raised px-4 py-6 lg:flex">
      {STEP_ORDER.map((step, index) => {
        const isDone = completedSteps.includes(step)
        const locked = !canJump && !isDone && index > 0 && !completedSteps.includes(STEP_ORDER[index - 1])
        return (
          <NavLink
            key={step}
            to={locked ? '#' : `/onboarding/${step}`}
            onClick={(event) => {
              if (locked) event.preventDefault()
            }}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-accent/10 text-accent'
                  : locked
                    ? 'cursor-not-allowed text-text-secondary/50'
                    : 'text-text-secondary hover:bg-surface hover:text-text-primary'
              }`
            }
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
                isDone ? 'bg-success text-white' : 'border border-border text-text-secondary'
              }`}
            >
              {isDone ? <Check size={12} /> : index + 1}
            </span>
            {STEP_LABELS[step]}
          </NavLink>
        )
      })}
    </nav>
  )
}

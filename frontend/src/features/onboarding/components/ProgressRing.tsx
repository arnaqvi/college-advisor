// Circular progress ring — animates stroke-dashoffset on value change via
// Framer Motion rather than re-mounting (design doc §2).

import { motion, useReducedMotion } from 'framer-motion'

export interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  label?: string
}

export function ProgressRing({ percent, size = 44, strokeWidth = 4, label }: ProgressRingProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, percent))
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const prefersReducedMotion = useReducedMotion()

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--border)"
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={false}
          animate={{ strokeDashoffset: circumference * (1 - clamped / 100) }}
          transition={prefersReducedMotion ? { duration: 0 } : { duration: 0.6, ease: 'easeOut' }}
        />
      </svg>
      <span className="absolute text-[10px] font-semibold text-text-primary">{label ?? `${clamped}%`}</span>
    </div>
  )
}

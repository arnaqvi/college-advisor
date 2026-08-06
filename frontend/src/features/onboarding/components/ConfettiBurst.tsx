// Fires a canvas-confetti burst whenever `trigger` changes (design doc §2:
// "canvas-confetti (lightweight, no dependency on Framer for particles)").
// Renders nothing itself — canvas-confetti manages its own overlay canvas.

import { useEffect, useRef } from 'react'
import confetti from 'canvas-confetti'

export interface ConfettiBurstProps {
  trigger: number
}

export function ConfettiBurst({ trigger }: ConfettiBurstProps): null {
  const firedFor = useRef<number | null>(null)

  useEffect(() => {
    if (trigger === 0 || firedFor.current === trigger) return
    firedFor.current = trigger

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReducedMotion) return

    void confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.3 },
      colors: ['#4f46e5', '#818cf8', '#16a34a', '#fbbf24'],
    })
  }, [trigger])

  return null
}

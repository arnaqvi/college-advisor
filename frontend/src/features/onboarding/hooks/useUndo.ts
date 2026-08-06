// 10s-window undo-toast primitive (design doc §1: "Undo: last mutation per
// section kept in memory (not persisted) for a 10s toast ... after 10s it's a
// real DELETE"). Generic over the payload type so it can back any section's
// remove flow (volunteer entries, awards, etc.) without duplication.

import { useCallback, useEffect, useRef, useState } from 'react'

const UNDO_WINDOW_MS = 10_000

export interface UndoEntry<T> {
  id: string
  message: string
  data: T
}

export interface UseUndoResult<T> {
  entry: UndoEntry<T> | null
  pushUndo: (message: string, data: T, onExpire: (data: T) => void) => void
  undo: (onUndo: (data: T) => void) => void
}

export function useUndo<T>(): UseUndoResult<T> {
  const [entry, setEntry] = useState<UndoEntry<T> | null>(null)
  const timerRef = useRef<number | null>(null)
  const entryRef = useRef<UndoEntry<T> | null>(null)

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pushUndo = useCallback(
    (message: string, data: T, onExpire: (data: T) => void) => {
      clearTimer()
      const next: UndoEntry<T> = { id: crypto.randomUUID(), message, data }
      entryRef.current = next
      setEntry(next)
      timerRef.current = window.setTimeout(() => {
        onExpire(data)
        entryRef.current = null
        setEntry(null)
        timerRef.current = null
      }, UNDO_WINDOW_MS)
    },
    [clearTimer],
  )

  const undo = useCallback(
    (onUndo: (data: T) => void) => {
      if (!entryRef.current) return
      clearTimer()
      onUndo(entryRef.current.data)
      entryRef.current = null
      setEntry(null)
    },
    [clearTimer],
  )

  useEffect(() => clearTimer, [clearTimer])

  return { entry, pushUndo, undo }
}

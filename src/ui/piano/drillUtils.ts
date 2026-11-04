import { useCallback, useEffect, useRef } from 'react'

export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

/**
 * A clock that stops while the drill is out of view (another tab, Home), so time spent away
 * isn't counted as reading time. `now()` is milliseconds of visible time.
 */
export function useVisibleClock(active: boolean): () => number {
  const paused = useRef(0)
  const pausedAt = useRef<number | null>(active ? null : Date.now())
  useEffect(() => {
    if (active && pausedAt.current !== null) {
      paused.current += Date.now() - pausedAt.current
      pausedAt.current = null
    } else if (!active && pausedAt.current === null) pausedAt.current = Date.now()
  }, [active])
  return useCallback(() => (pausedAt.current ?? Date.now()) - paused.current, [])
}

export interface MissedChip {
  key: string
  label: string
  /** RH / LH. */
  hand: string
}

export const handOf = (clef: 'treble' | 'bass') => (clef === 'treble' ? 'RH' : 'LH')

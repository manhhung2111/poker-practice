import type { HandClass } from './hands'
import type { AnswerLog } from './log'

/**
 * Spaced repetition for missed hands (design §8.3).
 * A miss puts (chart, hand) in the queue, due again after 3 hands. Each later
 * correct answer pushes it further out: 10, 30, then 100 hands. One more correct
 * answer and it leaves the queue. A new miss starts it over.
 * "Hands" means answers in any drill, counted across all sessions.
 */
export const REVIEW_INTERVALS = [3, 10, 30, 100]

export interface ReviewItem {
  key: string
  chartId: string
  hand: HandClass
  /** 0 after a miss, +1 per correct answer since. */
  step: number
  /** Answer number at which it's due again. */
  due: number
}

export const reviewKey = (chartId: string, hand: HandClass) => `${chartId}|${hand}`

export interface ReviewQueue {
  items: Map<string, ReviewItem>
  /** Total answers so far (the clock the intervals count in). */
  count: number
}

/** Replays the answer log into the review queue. */
export function buildReviews(log: readonly AnswerLog[]): ReviewQueue {
  const items = new Map<string, ReviewItem>()
  log.forEach((e, i) => applyAnswer(items, e.chartId, e.hand, e.correct, i + 1))
  return { items, count: log.length }
}

/** Updates the queue for one answer, given as answer number `n` (1-based). */
export function applyAnswer(items: Map<string, ReviewItem>, chartId: string, hand: HandClass, correct: boolean, n: number) {
  const key = reviewKey(chartId, hand)
  const item = items.get(key)
  if (!correct) {
    items.set(key, { key, chartId, hand, step: 0, due: n + REVIEW_INTERVALS[0] })
    return
  }
  if (!item) return
  const step = item.step + 1
  if (step >= REVIEW_INTERVALS.length) items.delete(key)
  else items.set(key, { ...item, step, due: n + REVIEW_INTERVALS[step] })
}

/** Items due now, most overdue first. */
export function dueItems(q: ReviewQueue): ReviewItem[] {
  return [...q.items.values()].filter((i) => i.due <= q.count + 1).sort((a, b) => a.due - b.due)
}

/** All queued items, soonest due first. */
export function queuedItems(q: ReviewQueue): ReviewItem[] {
  return [...q.items.values()].sort((a, b) => a.due - b.due)
}

import type { HandRecord } from './handRecord'
import type { Severity } from './grading'
import { POSTFLOP_FOCUSES, type PostflopFocus } from './postflopGrading'
import type { HandClass } from './hands'
import type { AnswerLog } from './log'

export interface Tally {
  answered: number
  correct: number
}

const DAY = 24 * 60 * 60 * 1000

export function tally(log: readonly AnswerLog[]): Tally {
  return { answered: log.length, correct: log.filter((e) => e.correct).length }
}

export const accuracy = (t: Tally) => (t.answered ? t.correct / t.answered : 0)

/** Start of the local day containing `t`. */
export function dayStart(t: number): number {
  const d = new Date(t)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Entries from the last `days` days (today included). */
export function lastDays(log: readonly AnswerLog[], now: number, days: number): AnswerLog[] {
  const from = dayStart(now) - (days - 1) * DAY
  return log.filter((e) => e.at >= from)
}

/** One tally per day for the last `days` days, oldest first. */
export function dailyTrend(log: readonly AnswerLog[], now: number, days = 7): (Tally & { day: number })[] {
  const today = dayStart(now)
  const out = Array.from({ length: days }, (_, i) => ({ day: today - (days - 1 - i) * DAY, answered: 0, correct: 0 }))
  for (const e of log) {
    const i = Math.round((dayStart(e.at) - out[0].day) / DAY)
    if (i < 0 || i >= days) continue
    out[i].answered++
    if (e.correct) out[i].correct++
  }
  return out
}

/** Tallies grouped by a key, in first-seen order of `order` (keys not in order come last). */
export function groupTally<K extends string>(
  log: readonly AnswerLog[],
  keyOf: (e: AnswerLog) => K,
  order: readonly K[] = [],
): (Tally & { key: K })[] {
  const map = new Map<K, Tally>()
  for (const k of order) map.set(k, { answered: 0, correct: 0 })
  for (const e of log) {
    const k = keyOf(e)
    const t = map.get(k) ?? { answered: 0, correct: 0 }
    t.answered++
    if (e.correct) t.correct++
    map.set(k, t)
  }
  return [...map.entries()].map(([key, t]) => ({ key, ...t }))
}

/** Minimum answers before a group can be called "weakest". */
export const MIN_FOR_WEAKEST = 10

/** Key of the group with the lowest accuracy among those with enough answers. */
export function weakest<K extends string>(groups: readonly (Tally & { key: K })[]): K | undefined {
  const eligible = groups.filter((g) => g.answered >= MIN_FOR_WEAKEST)
  if (!eligible.length) return undefined
  return eligible.reduce((w, g) => (accuracy(g) < accuracy(w) ? g : w)).key
}

/** Per-hand tallies for one chart: the data behind the leak heatmap. */
export function handTallies(log: readonly AnswerLog[], chartId: string): Map<HandClass, Tally> {
  const map = new Map<HandClass, Tally>()
  for (const e of log) {
    if (e.chartId !== chartId) continue
    const t = map.get(e.hand) ?? { answered: 0, correct: 0 }
    t.answered++
    if (e.correct) t.correct++
    map.set(e.hand, t)
  }
  return map
}

export interface Miss {
  chartId: string
  hand: HandClass
  misses: number
  answered: number
}

/** Hands missed most often, per chart. Ties: more answered first. */
export function mostMissed(log: readonly AnswerLog[], limit = 10): Miss[] {
  const map = new Map<string, Miss>()
  for (const e of log) {
    const k = `${e.chartId}|${e.hand}`
    const m = map.get(k) ?? { chartId: e.chartId, hand: e.hand, misses: 0, answered: 0 }
    m.answered++
    if (!e.correct) m.misses++
    map.set(k, m)
  }
  return [...map.values()]
    .filter((m) => m.misses > 0)
    .sort((a, b) => b.misses - a.misses || b.answered - a.answered)
    .slice(0, limit)
}

// ---------------------------------------------------------------------------
// Postflop decisions from played hands (graded by guidelines, M10)
// ---------------------------------------------------------------------------

export interface PostflopStats {
  total: Tally
  byFocus: (Tally & { key: PostflopFocus })[]
  byStreet: (Tally & { key: 'flop' | 'turn' | 'river' })[]
  /** Most recent misses first. */
  mistakes: { at: number; street: string; label: string; reason: string; severity: Severity }[]
}

export function postflopStats(records: readonly HandRecord[], maxMistakes = 5): PostflopStats {
  const total: Tally = { answered: 0, correct: 0 }
  const focus = new Map<PostflopFocus, Tally>(POSTFLOP_FOCUSES.map((f) => [f, { answered: 0, correct: 0 }]))
  const streets = ['flop', 'turn', 'river'] as const
  const street = new Map<(typeof streets)[number], Tally>(streets.map((s) => [s, { answered: 0, correct: 0 }]))
  const mistakes: PostflopStats['mistakes'] = []
  const newestFirst = [...records].sort((a, b) => b.at - a.at)
  for (const r of newestFirst) {
    for (const d of r.decisions) {
      const g = d.postflop
      if (!g || d.street === 'preflop') continue
      for (const t of [total, focus.get(g.focus)!, street.get(d.street)!]) {
        t.answered++
        if (g.correct) t.correct++
      }
      if (!g.correct && mistakes.length < maxMistakes)
        mistakes.push({ at: r.at, street: d.street, label: d.label, reason: g.reason, severity: g.severity })
    }
  }
  return {
    total,
    byFocus: [...focus].map(([key, t]) => ({ key, ...t })),
    byStreet: [...street].map(([key, t]) => ({ key, ...t })),
    mistakes,
  }
}

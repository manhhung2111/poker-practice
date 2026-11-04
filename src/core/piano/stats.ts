import { type Prompt, promptKey } from './notes'

/** Running totals for one item (a note or a chord) on one clef. */
export interface NoteStat {
  n: number
  correct: number
  /** Total answer time, ms. */
  ms: number
}

/** Keyed by promptKey: "treble:F♯5". */
export type PianoStats = Record<string, NoteStat>

/** Answers slower than this count as a pause, not reading time. */
const MS_CAP = 15000

/** Adds one answer to the item at `key`. */
export function recordStat<T extends Record<string, NoteStat>>(stats: T, key: string, correct: boolean, ms: number): T {
  const s = stats[key] ?? { n: 0, correct: 0, ms: 0 }
  return { ...stats, [key]: { n: s.n + 1, correct: s.correct + (correct ? 1 : 0), ms: s.ms + Math.min(ms, MS_CAP) } }
}

export const recordNote = (stats: PianoStats, p: Prompt, correct: boolean, ms: number): PianoStats =>
  recordStat(stats, promptKey(p), correct, ms)

/** Reads stored stats, keeping only keys matching `keyPattern` with sane numbers. */
export function parseKeyedStats(raw: unknown, keyPattern: RegExp): Record<string, NoteStat> {
  const out: Record<string, NoteStat> = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as Partial<NoteStat> | null
    if (!keyPattern.test(k) || !s) continue
    const n = Number(s.n), correct = Number(s.correct), ms = Number(s.ms)
    if (!(n > 0) || !(correct >= 0) || correct > n || !(ms >= 0)) continue
    out[k] = { n, correct, ms }
  }
  return out
}

export const parsePianoStats = (raw: unknown): PianoStats => parseKeyedStats(raw, /^(treble|bass):/)

/**
 * How often an item should come up: unseen items and missed or slow ones more, ones you
 * get quickly and correctly less (but never zero).
 */
export function statWeight(s: NoteStat | undefined): number {
  if (!s) return 1.5
  const miss = (s.n - s.correct + 1) / (s.n + 2)
  const avg = s.ms / s.n
  const slow = Math.min(Math.max((avg - 1500) / 3000, 0), 1)
  return 0.4 + 3 * miss + slow
}

export const noteWeight = (stats: PianoStats, p: Prompt) => statWeight(stats[promptKey(p)])

export interface Summary {
  n: number
  correct: number
  avgMs: number
}

export function summarize(stats: Record<string, NoteStat>, keep: (key: string) => boolean = () => true): Summary {
  let n = 0, correct = 0, ms = 0
  for (const [k, s] of Object.entries(stats)) {
    if (!keep(k)) continue
    n += s.n
    correct += s.correct
    ms += s.ms
  }
  return { n, correct, avgMs: n ? ms / n : 0 }
}

/** Items you miss most, then slowest; only ones seen at least `minSeen` times. */
export function weakest(stats: Record<string, NoteStat>, limit = 5, minSeen = 3): { key: string; stat: NoteStat }[] {
  return Object.entries(stats)
    .filter(([, s]) => s.n >= minSeen)
    .map(([key, stat]) => ({ key, stat, acc: stat.correct / stat.n, avg: stat.ms / stat.n }))
    .filter((x) => x.acc < 1 || x.avg > 2500)
    .sort((a, b) => a.acc - b.acc || b.avg - a.avg)
    .slice(0, limit)
    .map(({ key, stat }) => ({ key, stat }))
}

/** Totals for Read a row. A clean row had no wrong note. */
export interface RowTotals {
  rows: number
  clean: number
  notes: number
  correct: number
  ms: number
}

export const EMPTY_ROWS: RowTotals = { rows: 0, clean: 0, notes: 0, correct: 0, ms: 0 }

export const recordRow = (t: RowTotals, notesRight: number, notes: number, ms: number): RowTotals => ({
  rows: t.rows + 1,
  clean: t.clean + (notesRight === notes ? 1 : 0),
  notes: t.notes + notes,
  correct: t.correct + notesRight,
  ms: t.ms + ms,
})

export function parseRowTotals(raw: unknown): RowTotals {
  if (!raw || typeof raw !== 'object') return EMPTY_ROWS
  const r = raw as Record<string, unknown>
  const t = { rows: Number(r.rows), clean: Number(r.clean), notes: Number(r.notes), correct: Number(r.correct), ms: Number(r.ms) }
  const ok = Object.values(t).every((v) => Number.isFinite(v) && v >= 0) && t.clean <= t.rows && t.correct <= t.notes
  return ok ? t : EMPTY_ROWS
}

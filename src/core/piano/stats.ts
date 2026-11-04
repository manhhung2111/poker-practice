import { type Prompt, promptKey } from './notes'

/** Running totals for one note on one clef. */
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

export function recordNote(stats: PianoStats, p: Prompt, correct: boolean, ms: number): PianoStats {
  const key = promptKey(p)
  const s = stats[key] ?? { n: 0, correct: 0, ms: 0 }
  return { ...stats, [key]: { n: s.n + 1, correct: s.correct + (correct ? 1 : 0), ms: s.ms + Math.min(ms, MS_CAP) } }
}

export function parsePianoStats(raw: unknown): PianoStats {
  const out: PianoStats = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const s = v as Partial<NoteStat> | null
    if (!/^(treble|bass):/.test(k) || !s) continue
    const n = Number(s.n), correct = Number(s.correct), ms = Number(s.ms)
    if (!(n > 0) || !(correct >= 0) || correct > n || !(ms >= 0)) continue
    out[k] = { n, correct, ms }
  }
  return out
}

/**
 * How often a note should come up: unseen notes and missed or slow ones more, notes you
 * read quickly and correctly less (but never zero).
 */
export function noteWeight(stats: PianoStats, p: Prompt): number {
  const s = stats[promptKey(p)]
  if (!s) return 1.5
  const miss = (s.n - s.correct + 1) / (s.n + 2)
  const avg = s.ms / s.n
  const slow = Math.min(Math.max((avg - 1500) / 3000, 0), 1)
  return 0.4 + 3 * miss + slow
}

export interface Summary {
  n: number
  correct: number
  avgMs: number
}

export function summarize(stats: PianoStats, keep: (key: string) => boolean = () => true): Summary {
  let n = 0, correct = 0, ms = 0
  for (const [k, s] of Object.entries(stats)) {
    if (!keep(k)) continue
    n += s.n
    correct += s.correct
    ms += s.ms
  }
  return { n, correct, avgMs: n ? ms / n : 0 }
}

/** Notes you miss most, then slowest; only notes seen at least `minSeen` times. */
export function weakest(stats: PianoStats, limit = 5, minSeen = 3): { key: string; stat: NoteStat }[] {
  return Object.entries(stats)
    .filter(([, s]) => s.n >= minSeen)
    .map(([key, stat]) => ({ key, stat, acc: stat.correct / stat.n, avg: stat.ms / stat.n }))
    .filter((x) => x.acc < 1 || x.avg > 2500)
    .sort((a, b) => a.acc - b.acc || b.avg - a.avg)
    .slice(0, limit)
    .map(({ key, stat }) => ({ key, stat }))
}

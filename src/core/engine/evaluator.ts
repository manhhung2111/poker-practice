import { type Card, type Rank, RANKS, SUITS, cardRank, cardSuit, rankValue } from '../cards'

/**
 * Poker hand evaluator: best 5-card hand from 5, 6 or 7 cards.
 *
 * Returns a score where higher = better. The score packs the category in the
 * top bits and up to five tie-break ranks below, so two hands compare with a
 * plain number comparison.
 */
export const CATEGORIES = [
  'High card',
  'Pair',
  'Two pair',
  'Three of a kind',
  'Straight',
  'Flush',
  'Full house',
  'Four of a kind',
  'Straight flush',
] as const
export type Category = (typeof CATEGORIES)[number]

const pack = (cat: number, ranks: number[]) => {
  let s = cat
  for (let i = 0; i < 5; i++) s = s * 16 + (ranks[i] ?? 0)
  return s
}

export const categoryOf = (score: number): Category => CATEGORIES[Math.floor(score / 16 ** 5)]

/** Ranks (2–14) in a bitmask, highest first. */
function ranksFromMask(mask: number, n: number): number[] {
  const out: number[] = []
  for (let r = 14; r >= 2 && out.length < n; r--) if (mask & (1 << r)) out.push(r)
  return out
}

/** Highest straight in a rank mask (A counts low too), or 0. */
function straightHigh(mask: number): number {
  const m = mask & (1 << 14) ? mask | (1 << 1) : mask
  for (let hi = 14; hi >= 5; hi--) {
    const run = 0b11111 << (hi - 4)
    if ((m & run) === run) return hi
  }
  return 0
}

export function evaluate(cards: readonly Card[]): number {
  if (cards.length < 5 || cards.length > 7) throw new Error(`Need 5 to 7 cards, got ${cards.length}`)
  const counts = new Array(15).fill(0)
  const suitMask = [0, 0, 0, 0]
  let rankMask = 0
  for (const c of cards) {
    const r = rankValue(cardRank(c))
    const s = SUITS.indexOf(cardSuit(c))
    counts[r]++
    suitMask[s] |= 1 << r
    rankMask |= 1 << r
  }

  // Flushes and straight flushes
  const flushMask = suitMask.find((m) => popcount(m) >= 5)
  if (flushMask !== undefined) {
    const sf = straightHigh(flushMask)
    if (sf) return pack(8, [sf])
  }

  // Group ranks by count, highest rank first
  const quads: number[] = []
  const trips: number[] = []
  const pairs: number[] = []
  const singles: number[] = []
  for (let r = 14; r >= 2; r--) {
    if (counts[r] === 4) quads.push(r)
    else if (counts[r] === 3) trips.push(r)
    else if (counts[r] === 2) pairs.push(r)
    else if (counts[r] === 1) singles.push(r)
  }
  const kickersExcept = (exclude: number[], n: number) => ranksFromMask(rankMask & ~exclude.reduce((m, r) => m | (1 << r), 0), n)

  if (quads.length) return pack(7, [quads[0], ...kickersExcept([quads[0]], 1)])
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const pairRank = Math.max(trips[1] ?? 0, pairs[0] ?? 0)
    return pack(6, [trips[0], pairRank])
  }
  if (flushMask !== undefined) return pack(5, ranksFromMask(flushMask, 5))
  const st = straightHigh(rankMask)
  if (st) return pack(4, [st])
  if (trips.length) return pack(3, [trips[0], ...kickersExcept([trips[0]], 2)])
  if (pairs.length >= 2) return pack(2, [pairs[0], pairs[1], ...kickersExcept([pairs[0], pairs[1]], 1)])
  if (pairs.length) return pack(1, [pairs[0], ...kickersExcept([pairs[0]], 3)])
  return pack(0, ranksFromMask(rankMask, 5))
}

function popcount(n: number): number {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

const NAMES: Record<number, string> = { 14: 'Ace', 13: 'King', 12: 'Queen', 11: 'Jack', 10: 'Ten', 9: 'Nine', 8: 'Eight', 7: 'Seven', 6: 'Six', 5: 'Five', 4: 'Four', 3: 'Three', 2: 'Two' }
const plural = (r: number) => (r === 6 ? 'Sixes' : `${NAMES[r]}s`)

/** Human description of a score, e.g. "Two pair, Kings and Sevens". */
export function describe(score: number): string {
  const cat = Math.floor(score / 16 ** 5)
  const r = (i: number) => Math.floor(score / 16 ** (4 - i)) % 16
  switch (cat) {
    case 8:
      return r(0) === 14 ? 'Royal flush' : `Straight flush, ${NAMES[r(0)]} high`
    case 7:
      return `Four ${plural(r(0))}`
    case 6:
      return `Full house, ${plural(r(0))} full of ${plural(r(1))}`
    case 5:
      return `Flush, ${NAMES[r(0)]} high`
    case 4:
      return `Straight, ${NAMES[r(0)]} high`
    case 3:
      return `Three ${plural(r(0))}`
    case 2:
      return `Two pair, ${plural(r(0))} and ${plural(r(1))}`
    case 1:
      return `Pair of ${plural(r(0))}`
    default:
      return `${NAMES[r(0)]} high`
  }
}

/** Rank character for a rank value (14 → "A"). */
export const rankChar = (v: number): Rank => RANKS[14 - v]

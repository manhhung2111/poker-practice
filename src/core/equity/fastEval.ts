import { type Card, SUITS, cardRank, cardSuit, rankValue } from '../cards'

/**
 * Fast evaluator for equity simulations. Cards are numbers 0–51:
 * (rank − 2) × 4 + suit. Scores are identical to `engine/evaluator.evaluate`,
 * so the two can be mixed and compared.
 */
export const cardToInt = (c: Card): number => (rankValue(cardRank(c)) - 2) * 4 + SUITS.indexOf(cardSuit(c))

const counts = new Uint8Array(15)
const suitMask = new Int32Array(4)

const pack = (cat: number, a = 0, b = 0, c = 0, d = 0, e = 0) => ((((cat * 16 + a) * 16 + b) * 16 + c) * 16 + d) * 16 + e

function straightHigh(mask: number): number {
  const m = mask & (1 << 14) ? mask | 2 : mask
  for (let hi = 14; hi >= 5; hi--) {
    const run = 0b11111 << (hi - 4)
    if ((m & run) === run) return hi
  }
  return 0
}

function popcount(n: number): number {
  let c = 0
  while (n) {
    n &= n - 1
    c++
  }
  return c
}

/** Top `n` ranks in a mask, packed after `cat` and `lead` ranks. */
function packTop(cat: number, lead: number[], mask: number, n: number): number {
  const r: number[] = [...lead]
  for (let v = 14; v >= 2 && r.length < lead.length + n; v--) if (mask & (1 << v)) r.push(v)
  return pack(cat, r[0], r[1], r[2], r[3], r[4])
}

/** Scores the first `n` cards of `cards` (5–7 cards). */
export function evalInts(cards: ArrayLike<number>, n: number): number {
  counts.fill(0)
  suitMask.fill(0)
  let rankMask = 0
  for (let i = 0; i < n; i++) {
    const c = cards[i]
    const r = (c >> 2) + 2
    counts[r]++
    suitMask[c & 3] |= 1 << r
    rankMask |= 1 << r
  }
  let flush = -1
  for (let s = 0; s < 4; s++) if (popcount(suitMask[s]) >= 5) flush = suitMask[s]
  if (flush >= 0) {
    const sf = straightHigh(flush)
    if (sf) return pack(8, sf)
  }
  let quad = 0
  let t1 = 0
  let t2 = 0
  let p1 = 0
  let p2 = 0
  for (let r = 14; r >= 2; r--) {
    const k = counts[r]
    if (k === 4) quad ||= r
    else if (k === 3) {
      if (!t1) t1 = r
      else if (!t2) t2 = r
    } else if (k === 2) {
      if (!p1) p1 = r
      else if (!p2) p2 = r
    }
  }
  if (quad) return packTop(7, [quad], rankMask & ~(1 << quad), 1)
  if (t1 && (t2 || p1)) return pack(6, t1, Math.max(t2, p1))
  if (flush >= 0) return packTop(5, [], flush, 5)
  const st = straightHigh(rankMask)
  if (st) return pack(4, st)
  if (t1) return packTop(3, [t1], rankMask & ~(1 << t1), 2)
  if (p2) return packTop(2, [p1, p2], rankMask & ~(1 << p1) & ~(1 << p2), 1)
  if (p1) return packTop(1, [p1], rankMask & ~(1 << p1), 3)
  return packTop(0, [], rankMask, 5)
}

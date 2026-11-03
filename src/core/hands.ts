import { type Card, type Rank, RANKS, SUITS, cardRank, cardSuit, rankValue, isRank } from './cards'

/**
 * One of the 169 starting-hand classes:
 *   pairs   "AA" … "22"   (6 combos each)
 *   suited  "AKs" … "32s" (4 combos each)
 *   offsuit "AKo" … "32o" (12 combos each)
 * The higher rank always comes first.
 */
export type HandClass = string

export type HandKind = 'pair' | 'suited' | 'offsuit'

export const TOTAL_COMBOS = 1326

/**
 * Hand class at a 13×13 grid cell (standard chart layout):
 *   diagonal = pairs, upper-right = suited, lower-left = offsuit.
 * Row/col 0 = Ace … 12 = Two.
 */
export function handAt(row: number, col: number): HandClass {
  if (row === col) return RANKS[row] + RANKS[row]
  if (row < col) return RANKS[row] + RANKS[col] + 's'
  return RANKS[col] + RANKS[row] + 'o'
}

/** Grid cell of a hand class (inverse of handAt). */
export function gridPosition(hand: HandClass): { row: number; col: number } {
  const { high, low, kind } = parseHandClass(hand)
  const hi = RANKS.indexOf(high)
  const lo = RANKS.indexOf(low)
  if (kind === 'pair') return { row: hi, col: hi }
  if (kind === 'suited') return { row: hi, col: lo }
  return { row: lo, col: hi }
}

/** All 169 hand classes in grid order (row by row). */
export const ALL_HANDS: readonly HandClass[] = (() => {
  const out: HandClass[] = []
  for (let r = 0; r < 13; r++) for (let c = 0; c < 13; c++) out.push(handAt(r, c))
  return out
})()

const HAND_SET = new Set(ALL_HANDS)

export function isHandClass(x: string): x is HandClass {
  return HAND_SET.has(x)
}

export function parseHandClass(hand: HandClass): { high: Rank; low: Rank; kind: HandKind } {
  const high = hand[0]
  const low = hand[1]
  if (!isHandClass(hand) || !isRank(high) || !isRank(low)) {
    throw new Error(`Invalid hand class: "${hand}"`)
  }
  const kind: HandKind = hand.length === 2 ? 'pair' : hand[2] === 's' ? 'suited' : 'offsuit'
  return { high, low, kind }
}

export function handKind(hand: HandClass): HandKind {
  return parseHandClass(hand).kind
}

/** Number of card combinations for a hand class: 6, 4 or 12. */
export function comboCount(hand: HandClass): number {
  const kind = handKind(hand)
  return kind === 'pair' ? 6 : kind === 'suited' ? 4 : 12
}

/** All concrete two-card combos for a hand class. */
export function combos(hand: HandClass): [Card, Card][] {
  const { high, low, kind } = parseHandClass(hand)
  const out: [Card, Card][] = []
  for (let i = 0; i < SUITS.length; i++) {
    for (let j = 0; j < SUITS.length; j++) {
      const s1 = SUITS[i]
      const s2 = SUITS[j]
      if (kind === 'pair' && j > i) out.push([`${high}${s1}`, `${low}${s2}`])
      if (kind === 'suited' && i === j) out.push([`${high}${s1}`, `${low}${s2}`])
      if (kind === 'offsuit' && i !== j) out.push([`${high}${s1}`, `${low}${s2}`])
    }
  }
  return out
}

/** Hand class of two concrete cards, e.g. ("Kd", "As") → "AKo". */
export function handClassOf(a: Card, b: Card): HandClass {
  if (a === b) throw new Error(`Same card twice: ${a}`)
  const ra = cardRank(a)
  const rb = cardRank(b)
  if (ra === rb) return ra + rb
  const [high, low] = rankValue(ra) > rankValue(rb) ? [ra, rb] : [rb, ra]
  return high + low + (cardSuit(a) === cardSuit(b) ? 's' : 'o')
}

/**
 * Broad hand category, used for "why" explanations and stats.
 * Checked in order; the first matching category wins.
 */
export type HandCategory =
  | 'premium-pair' // QQ+
  | 'high-pair' // TT–JJ
  | 'mid-pair' // 66–99
  | 'low-pair' // 22–55
  | 'suited-ace' // A2s–AKs
  | 'offsuit-ace' // A2o–AKo
  | 'suited-broadway' // both cards T+ (no ace), suited
  | 'offsuit-broadway' // both cards T+ (no ace), offsuit
  | 'suited-connector' // suited, consecutive ranks (e.g. 98s)
  | 'suited-gapper' // suited, one or two gaps (e.g. 97s, 86s)
  | 'suited-other' // other suited hands (e.g. K4s)
  | 'offsuit-connector' // offsuit, consecutive ranks (e.g. 98o)
  | 'offsuit-other' // everything else (e.g. 72o)

export function handCategory(hand: HandClass): HandCategory {
  const { high, low, kind } = parseHandClass(hand)
  const hv = rankValue(high)
  const lv = rankValue(low)
  if (kind === 'pair') {
    if (hv >= 12) return 'premium-pair'
    if (hv >= 10) return 'high-pair'
    if (hv >= 6) return 'mid-pair'
    return 'low-pair'
  }
  const suited = kind === 'suited'
  if (high === 'A') return suited ? 'suited-ace' : 'offsuit-ace'
  if (lv >= 10) return suited ? 'suited-broadway' : 'offsuit-broadway'
  const gap = hv - lv - 1
  if (suited) {
    if (gap === 0) return 'suited-connector'
    if (gap <= 2) return 'suited-gapper'
    return 'suited-other'
  }
  return gap === 0 ? 'offsuit-connector' : 'offsuit-other'
}

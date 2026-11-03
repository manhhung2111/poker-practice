import { rankValue, type Rank } from './cards'
import { type HandClass, ALL_HANDS, TOTAL_COMBOS, comboCount, parseHandClass } from './hands'

/**
 * Preflop hand strength ranking for all 169 hand classes.
 *
 * Based on the Chen formula (Bill Chen), a well-known preflop scoring system,
 * used unrounded for finer ordering:
 *   1. Highest card: A=10, K=8, Q=7, J=6, T…2 = half the rank (T=5 … 2=1)
 *   2. Pairs: double it, minimum 5
 *   3. Suited: +2
 *   4. Gap between ranks: 0 → 0, 1 → −1, 2 → −2, 3 → −4, 4+ → −5
 *   5. +1 if gap ≤ 1 and both cards are below Q (straight potential)
 * Ties are broken by: pairs first, higher top card, suited first, higher kicker.
 *
 * Used for the severity rating (how far a hand is from a range's edge) and for
 * picking "edge" hands in smart dealing. It is a proxy for strength, not an
 * exact equity ranking.
 */
export function chenScore(hand: HandClass): number {
  const { high, low, kind } = parseHandClass(hand)
  const base = cardPoints(high)
  if (kind === 'pair') return Math.max(5, base * 2)
  let score = base
  if (kind === 'suited') score += 2
  const gap = rankValue(high) - rankValue(low) - 1
  score -= gap === 0 ? 0 : gap === 1 ? 1 : gap === 2 ? 2 : gap === 3 ? 4 : 5
  if (gap <= 1 && rankValue(high) < rankValue('Q')) score += 1
  return score
}

function cardPoints(rank: Rank): number {
  switch (rank) {
    case 'A':
      return 10
    case 'K':
      return 8
    case 'Q':
      return 7
    case 'J':
      return 6
    default:
      return rankValue(rank) / 2
  }
}

/** All 169 hands, strongest first. */
export const HANDS_BY_STRENGTH: readonly HandClass[] = (() => {
  const kindOrder = { pair: 0, suited: 1, offsuit: 2 }
  return ALL_HANDS.slice().sort((a, b) => {
    const diff = chenScore(b) - chenScore(a)
    if (diff !== 0) return diff
    const pa = parseHandClass(a)
    const pb = parseHandClass(b)
    const pairFirst = Number(pa.kind !== 'pair') - Number(pb.kind !== 'pair')
    return (
      pairFirst ||
      rankValue(pb.high) - rankValue(pa.high) ||
      kindOrder[pa.kind] - kindOrder[pb.kind] ||
      rankValue(pb.low) - rankValue(pa.low)
    )
  })
})()

const RANK_INDEX = new Map(HANDS_BY_STRENGTH.map((h, i) => [h, i]))

/** 1 = strongest (AA) … 169 = weakest. */
export function strengthRank(hand: HandClass): number {
  const i = RANK_INDEX.get(hand)
  if (i === undefined) throw new Error(`Invalid hand class: "${hand}"`)
  return i + 1
}

const TOP_PERCENT = (() => {
  const map = new Map<HandClass, number>()
  let cumulative = 0
  for (const h of HANDS_BY_STRENGTH) {
    cumulative += comboCount(h)
    map.set(h, cumulative / TOTAL_COMBOS)
  }
  return map
})()

/**
 * Fraction of all 1326 starting combos that are this hand or stronger (0–1).
 * E.g. AA ≈ 0.0045 ("top 0.5%"), the weakest hand = 1.
 */
export function topPercent(hand: HandClass): number {
  const p = TOP_PERCENT.get(hand)
  if (p === undefined) throw new Error(`Invalid hand class: "${hand}"`)
  return p
}

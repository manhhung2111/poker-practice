import { type Card, type Rank, cardRank, cardSuit, rankValue } from './cards'

/**
 * How "wet" a board is (design §9.2, lesson 7): how many strong hands and draws it
 * makes possible. Dry boards (K♠7♦2♣) favor the preflop raiser and small c-bets;
 * wet boards (J♥T♥8♣) give callers many draws, so bet bigger or check more.
 */
export type Wetness = 'dry' | 'medium' | 'wet'

export interface BoardTexture {
  wetness: Wetness
  /** Most cards of one suit on the board. */
  suited: number
  paired: boolean
  /** A straight is possible (three ranks within a five-rank window). */
  straightPossible: boolean
  /** Two ranks close enough for straight draws. */
  connected: boolean
  high: Rank
  /** Plain-English notes, e.g. "two hearts: flush draws". */
  notes: string[]
}

export function boardTexture(board: readonly Card[]): BoardTexture {
  if (board.length < 3) throw new Error('Board texture needs a flop')
  const suitCounts = new Map<string, number>()
  for (const c of board) suitCounts.set(cardSuit(c), (suitCounts.get(cardSuit(c)) ?? 0) + 1)
  const suited = Math.max(...suitCounts.values())
  const values = board.map((c) => rankValue(cardRank(c)))
  const distinct = [...new Set(values.flatMap((v) => (v === 14 ? [14, 1] : [v])))].sort((a, b) => a - b)
  const paired = new Set(values).size < values.length
  const inWindow = (k: number, span: number) =>
    distinct.some((lo) => distinct.filter((v) => v >= lo && v < lo + span).length >= k)
  const straightPossible = inWindow(3, 5)
  const connected = inWindow(2, 4)
  const high = board.map(cardRank).sort((a, b) => rankValue(b) - rankValue(a))[0]

  const cardsToCome = 5 - board.length
  let score = 0
  const notes: string[] = []
  if (suited >= 3) {
    score += 3
    notes.push(`${suited} of one suit: a flush is possible`)
  } else if (suited === 2 && cardsToCome > 0) {
    score += 1
    notes.push('two of one suit: flush draws')
  }
  if (straightPossible) {
    score += 2
    notes.push('connected: straights and straight draws')
  } else if (connected && cardsToCome > 0) {
    score += 1
    notes.push('some straight draws')
  }
  if (paired) {
    score -= 1
    notes.push('paired: fewer strong hands')
  }
  if (!notes.length) notes.push('few draws')
  const wetness: Wetness = score <= 0 ? 'dry' : score <= 2 ? 'medium' : 'wet'
  return { wetness, suited, paired, straightPossible, connected, high, notes }
}

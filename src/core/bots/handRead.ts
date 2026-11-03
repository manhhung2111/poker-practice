import { type Card, cardRank, cardSuit, rankValue } from '../cards'
import { categoryOf, evaluate } from '../engine/evaluator'

/**
 * What a bot "sees" after the flop: how strong its made hand is relative to the
 * board, and which draws it has. Deliberately simple and readable; Phase 2b adds
 * real equity for grading.
 */
export type Made =
  | 'monster' // straight or better that uses a hole card, set, strong full house…
  | 'strong' // two pair with both hole cards, overpair, trips
  | 'top-pair' // top pair, good kicker
  | 'medium' // top pair weak kicker, second pair, pocket pair below top card
  | 'weak' // bottom pair, small underpair
  | 'nothing'

export interface HandRead {
  made: Made
  flushDraw: boolean
  /** Open-ended straight draw (8 outs). */
  openEnded: boolean
  /** Inside straight draw (4 outs). */
  gutshot: boolean
  /** Rough chance to win against a typical range, 0–1 (made hand or draw, whichever is higher). */
  strength: number
}

const MADE_STRENGTH: Record<Made, number> = {
  monster: 0.95,
  strong: 0.8,
  'top-pair': 0.66,
  medium: 0.5,
  weak: 0.32,
  nothing: 0.12,
}

export function readHand(hole: readonly Card[], board: readonly Card[]): HandRead {
  if (board.length < 3) throw new Error('readHand is for after the flop')
  const all = [...hole, ...board]
  const score = evaluate(all)
  const cat = categoryOf(score)
  const boardRanks = board.map((c) => rankValue(cardRank(c))).sort((a, b) => b - a)
  const [h1, h2] = hole.map((c) => rankValue(cardRank(c)))
  const top = boardRanks[0]
  const pocketPair = h1 === h2
  const boardPaired = new Set(boardRanks).size < boardRanks.length
  // Does the best hand actually use our cards? (On a 5-card board the board can "play".)
  const boardOnly = board.length === 5 ? evaluate(board) : -1
  const usesHole = score > boardOnly

  let made: Made = 'nothing'
  if (!usesHole) made = 'nothing'
  else if (['Straight flush', 'Four of a kind', 'Full house', 'Flush', 'Straight'].includes(cat)) made = 'monster'
  else if (cat === 'Three of a kind') made = pocketPair ? 'monster' : 'strong'
  else if (cat === 'Two pair') {
    const both = boardRanks.includes(h1) && boardRanks.includes(h2) && h1 !== h2
    made = both ? 'strong' : pocketPair && h1 > top ? 'strong' : boardPaired ? 'medium' : 'strong'
  } else if (cat === 'Pair') {
    if (pocketPair) made = h1 > top ? 'strong' : h1 > boardRanks[boardRanks.length - 1] ? 'medium' : 'weak'
    else {
      const paired = boardRanks.includes(h1) ? h1 : boardRanks.includes(h2) ? h2 : 0
      const kicker = paired === h1 ? h2 : h1
      if (paired === top) made = kicker >= 10 ? 'top-pair' : 'medium'
      else if (paired && paired >= boardRanks[1]) made = 'medium'
      else if (paired) made = 'weak'
    }
  }

  // Draws only matter with cards to come.
  let flushDraw = false
  let openEnded = false
  let gutshot = false
  if (board.length < 5 && !['monster'].includes(made)) {
    const suits = new Map<string, number>()
    for (const c of all) suits.set(cardSuit(c), (suits.get(cardSuit(c)) ?? 0) + 1)
    flushDraw = hole.some((c) => suits.get(cardSuit(c)) === 4)
    // Straight draws: which ranks would complete a straight that uses one of our cards?
    const rankMask = (cards: readonly Card[]) => cards.reduce((m, c) => m | (1 << rankValue(cardRank(c))), 0)
    const allMask = rankMask(all)
    const boardMask = rankMask(board)
    if (!straightHigh(allMask)) {
      let completing = 0
      for (let r = 2; r <= 14; r++) {
        if (allMask & (1 << r)) continue
        if (straightHigh(allMask | (1 << r)) && !straightHigh(boardMask | (1 << r))) completing++
      }
      openEnded = completing >= 2 // open-ended or double gutshot: 8 outs
      gutshot = completing === 1 // 4 outs
    }
  }

  const cardsToCome = 5 - board.length
  const drawEquity =
    (flushDraw ? (cardsToCome === 2 ? 0.35 : 0.19) : 0) +
    (openEnded ? (cardsToCome === 2 ? 0.32 : 0.17) : gutshot ? (cardsToCome === 2 ? 0.17 : 0.09) : 0)
  const strength = Math.max(MADE_STRENGTH[made], Math.min(0.6, drawEquity + (made === 'weak' ? 0.1 : 0)))
  return { made, flushDraw, openEnded, gutshot, strength }
}

/** Highest straight in a rank bitmask (bit r = rank r, ace also counts as 1), or 0. */
function straightHigh(mask: number): number {
  const m = mask & (1 << 14) ? mask | 2 : mask
  for (let hi = 14; hi >= 5; hi--) {
    const run = 0b11111 << (hi - 4)
    if ((m & run) === run) return hi
  }
  return 0
}

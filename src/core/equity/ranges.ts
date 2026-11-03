import type { Card } from '../cards'
import { type Decision, type HandAction, type HandState, act, startHand } from '../engine/game'
import { ALL_HANDS, type HandClass, combos, handClassOf } from '../hands'
import { type Rng, seededRng } from '../random'
import { parseRange } from '../rangeParser'
import type { Personality } from '../bots/personality'
import type { Range } from './equity'

/** A decide function with no equity thinking (avoids loops: ranges are read with the simple bot). */
export type SimpleDecide = (state: HandState, personality: Personality, rng: Rng) => Decision

/** Range for a list of hand classes in range notation, e.g. "QQ+, AKs". Every combo weighs 1. */
export function rangeOf(notation: string): Range {
  return [...parseRange(notation)].flatMap((h) => combos(h).map((cards) => ({ cards, weight: 1 })))
}

/** Any two cards. */
export const ANY_TWO: Range = ALL_HANDS.flatMap((h) => combos(h).map((cards) => ({ cards, weight: 1 })))

/**
 * The states before each voluntary action of the hand so far, oldest first.
 * Rebuilds the hand from the start with the same stacks, cards and actions.
 */
export function replay(state: HandState): { before: HandState; action: HandAction }[] {
  const n = state.players.length
  const deck: Card[] = []
  for (let round = 0; round < 2; round++) for (let i = 1; i <= n; i++) deck.push(state.players[(state.button + i) % n].hole[round])
  // Board cards in dealing order, with stand-ins for burns and cards not dealt yet.
  const spare = [...state.deck]
  const slot = (i: number) => state.board[i] ?? spare.shift()!
  deck.push(spare.shift()!, slot(0), slot(1), slot(2), spare.shift()!, slot(3), spare.shift()!, slot(4), ...spare)

  let s = startHand({
    names: state.players.map((p) => p.name),
    stacks: state.players.map((p) => p.stack + p.committed - (state.result?.payouts[p.seat] ?? 0)),
    button: state.button,
    deck,
  })
  const out: { before: HandState; action: HandAction }[] = []
  for (const a of state.actions) {
    if (a.type === 'post') continue
    out.push({ before: s, action: a })
    s = act(s, toDecision(a))
  }
  return out
}

function toDecision(a: HandAction): Decision {
  if (a.type === 'bet' || a.type === 'raise') return { type: 'raise', to: a.amount }
  return { type: a.type as 'fold' | 'check' | 'call' }
}

type Kind = 'fold' | 'passive' | 'aggressive'
const kindOf = (t: Decision['type'] | HandAction['type']): Kind =>
  t === 'fold' ? 'fold' : t === 'raise' || t === 'bet' ? 'aggressive' : 'passive'

const withHole = (s: HandState, seat: number, hole: [Card, Card]): HandState => ({
  ...s,
  players: s.players.map((p) => (p.seat === seat ? { ...p, hole } : p)),
})

export interface EstimateOptions {
  /** Cards the viewer knows aren't in the range (own hole cards and the board). */
  dead: readonly Card[]
  /** Samples of the bot's random choices per decision. */
  preflopSamples?: number
  postflopSamples?: number
  seed?: number
}

/**
 * What `seat` probably holds, judged by replaying each of their actions with every
 * possible holding: hands that would often have acted the same way weigh more.
 * The player is modeled by their style (you are modeled as a regular).
 */
export function estimateRange(
  history: { before: HandState; action: HandAction }[],
  seat: number,
  personality: Personality,
  decideSimple: SimpleDecide,
  opts: EstimateOptions,
): Range {
  const kPre = opts.preflopSamples ?? 6
  const kPost = opts.postflopSamples ?? 3
  const dead = new Set(opts.dead)
  const first = history[0]?.before
  const key = [
    seat,
    personality,
    kPre,
    kPost,
    opts.seed ?? 7,
    first ? `${first.button}:${first.players.map((p) => p.stack + p.committed).join(',')}` : '',
    history.map((h) => `${h.action.seat}${h.action.type[0]}${h.action.amount}${h.before.board.join('')}`).join(' '),
  ].join('|')
  let full = cache.get(key)
  if (!full) {
    full = estimateUncached(history, seat, personality, decideSimple, kPre, kPost, opts.seed ?? 7)
    cache.set(key, full)
    if (cache.size > 64) cache.delete(cache.keys().next().value!)
  }
  return full.filter((c) => !dead.has(c.cards[0]) && !dead.has(c.cards[1]))
}

/** Recent estimates: every bot at the table reads the same opponents on the same street. */
const cache = new Map<string, Range>()

function estimateUncached(
  history: { before: HandState; action: HandAction }[],
  seat: number,
  personality: Personality,
  decideSimple: SimpleDecide,
  kPre: number,
  kPost: number,
  seed: number,
): Range {
  const rng = seededRng(seed)
  const mine = history.filter((h) => h.action.seat === seat)
  const pre = mine.filter((h) => h.action.street === 'preflop')
  const post = mine.filter((h) => h.action.street !== 'preflop')
  const board = history[history.length - 1]?.before.board ?? []
  const onBoard = new Set<Card>(board)

  const likelihood = (s: HandState, hole: [Card, Card], want: Kind, k: number, floor: number) => {
    let hits = 0
    const st = withHole(s, seat, hole)
    for (let i = 0; i < k; i++) if (kindOf(decideSimple(st, personality, rng).type) === want) hits++
    return Math.max(floor, hits / k)
  }

  // Preflop play depends only on the hand class, so score each class once.
  const classWeight = new Map<HandClass, number>()
  for (const h of ALL_HANDS) {
    const sample = combos(h)[0]
    let w = 1
    for (const d of pre) {
      w *= likelihood(d.before, sample, kindOf(d.action.type), kPre, 0.004)
      if (w < 1e-6) break
    }
    classWeight.set(h, w)
  }

  const range: Range = []
  for (const h of ALL_HANDS) {
    const wClass = classWeight.get(h)!
    if (wClass < 1e-6) continue
    for (const cards of combos(h)) {
      if (onBoard.has(cards[0]) || onBoard.has(cards[1])) continue
      let w = wClass
      for (const d of post) w *= likelihood(d.before, cards, kindOf(d.action.type), kPost, 0.01)
      range.push({ cards, weight: w })
    }
  }
  return range
}

/** Combo-weighted share of all hands in a range (for "they have ~18% of hands"). */
export function rangeWidth(range: Range): number {
  return range.reduce((s, c) => s + c.weight, 0) / 1326
}

/** The top hand classes in a range by weight, for explanations. */
export function topClasses(range: Range, n = 6): HandClass[] {
  const byClass = new Map<HandClass, number>()
  for (const c of range) {
    const cls = handClassOf(c.cards[0], c.cards[1])
    byClass.set(cls, (byClass.get(cls) ?? 0) + c.weight)
  }
  return [...byClass.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map(([h]) => h)
}

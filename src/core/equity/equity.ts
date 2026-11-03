import type { Card } from '../cards'
import { type Rng, defaultRng } from '../random'
import { cardToInt, evalInts } from './fastEval'

/** A possible holding with a weight (how likely the player has it). */
export interface WeightedCombo {
  cards: [Card, Card]
  weight: number
}
export type Range = WeightedCombo[]

export interface EquityResult {
  /** Share of the pot you win on average, 0–1 (ties split). */
  equity: number
  win: number
  tie: number
  /** Simulated (or enumerated) run-outs. */
  samples: number
  exact: boolean
}

interface PreparedRange {
  cards: Int32Array // 2 per combo
  cumulative: Float64Array
  total: number
}

function prepare(range: Range, dead: Set<number>): PreparedRange {
  const live = range
    .map((c) => ({ a: cardToInt(c.cards[0]), b: cardToInt(c.cards[1]), w: c.weight }))
    .filter((c) => c.w > 0 && !dead.has(c.a) && !dead.has(c.b))
  const cards = new Int32Array(live.length * 2)
  const cumulative = new Float64Array(live.length)
  let total = 0
  live.forEach((c, i) => {
    cards[2 * i] = c.a
    cards[2 * i + 1] = c.b
    total += c.w
    cumulative[i] = total
  })
  return { cards, cumulative, total }
}

function pick(r: PreparedRange, rng: Rng): number {
  const x = rng() * r.total
  let lo = 0
  let hi = r.cumulative.length - 1
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (r.cumulative[mid] > x) hi = mid
    else lo = mid + 1
  }
  return lo
}

export interface EquityOptions {
  iterations?: number
  rng?: Rng
}

/**
 * Your equity against one or more opponents' ranges (design §9.2).
 * Heads-up on the turn or river it is enumerated exactly; otherwise Monte Carlo.
 */
export function equity(hero: readonly [Card, Card], opponents: readonly Range[], board: readonly Card[], opts: EquityOptions = {}): EquityResult {
  if (!opponents.length) return { equity: 1, win: 1, tie: 0, samples: 0, exact: true }
  const heroInts = hero.map(cardToInt)
  const boardInts = board.map(cardToInt)
  const dead = new Set([...heroInts, ...boardInts])
  if (dead.size !== heroInts.length + boardInts.length) throw new Error('A card appears twice')
  const ranges = opponents.map((r) => prepare(r, dead))
  if (ranges.some((r) => r.total <= 0)) throw new Error('An opponent range is empty')

  if (ranges.length === 1 && board.length >= 4) return exactHeadsUp(heroInts, ranges[0], boardInts, dead)

  const rng = opts.rng ?? defaultRng
  const iterations = opts.iterations ?? 2000
  const used = new Uint8Array(52)
  const heroHand = new Int32Array(7)
  const oppHand = new Int32Array(7)
  const runout = new Int32Array(5)
  let won = 0
  let wins = 0
  let ties = 0
  let samples = 0

  for (let it = 0; it < iterations; it++) {
    used.fill(0)
    for (const c of dead) used[c] = 1
    // Deal each opponent a hand from their range.
    const oppCards: number[] = []
    let ok = true
    for (const r of ranges) {
      let tries = 0
      let i = pick(r, rng)
      while (used[r.cards[2 * i]] || used[r.cards[2 * i + 1]]) {
        if (++tries > 30) {
          ok = false
          break
        }
        i = pick(r, rng)
      }
      if (!ok) break
      const a = r.cards[2 * i]
      const b = r.cards[2 * i + 1]
      used[a] = used[b] = 1
      oppCards.push(a, b)
    }
    if (!ok) continue
    // Complete the board.
    for (let k = 0; k < boardInts.length; k++) runout[k] = boardInts[k]
    for (let k = boardInts.length; k < 5; k++) {
      let c: number
      do c = Math.floor(rng() * 52)
      while (used[c])
      used[c] = 1
      runout[k] = c
    }
    heroHand[0] = heroInts[0]
    heroHand[1] = heroInts[1]
    for (let k = 0; k < 5; k++) heroHand[k + 2] = oppHand[k + 2] = runout[k]
    const mine = evalInts(heroHand, 7)
    let best = -1
    let tied = 0
    for (let o = 0; o < ranges.length; o++) {
      oppHand[0] = oppCards[2 * o]
      oppHand[1] = oppCards[2 * o + 1]
      const s = evalInts(oppHand, 7)
      if (s > best) {
        best = s
        tied = 0
      }
      if (s === best) tied++
    }
    samples++
    if (mine > best) {
      won += 1
      wins++
    } else if (mine === best) {
      won += 1 / (tied + 1)
      ties++
    }
  }
  if (!samples) throw new Error('Could not deal hands from the ranges')
  return { equity: won / samples, win: wins / samples, tie: ties / samples, samples, exact: false }
}

function exactHeadsUp(hero: number[], range: PreparedRange, board: number[], dead: Set<number>): EquityResult {
  const h = new Int32Array(7)
  const o = new Int32Array(7)
  const rivers: number[][] = []
  if (board.length === 5) rivers.push([])
  else for (let c = 0; c < 52; c++) if (!dead.has(c)) rivers.push([c])
  let won = 0
  let wins = 0
  let ties = 0
  let total = 0
  let samples = 0
  const n = range.cumulative.length
  for (let i = 0; i < n; i++) {
    const a = range.cards[2 * i]
    const b = range.cards[2 * i + 1]
    const w = range.cumulative[i] - (i ? range.cumulative[i - 1] : 0)
    for (const extra of rivers) {
      if (extra.length && (extra[0] === a || extra[0] === b)) continue
      const full = [...board, ...extra]
      h[0] = hero[0]
      h[1] = hero[1]
      o[0] = a
      o[1] = b
      for (let k = 0; k < 5; k++) h[k + 2] = o[k + 2] = full[k]
      const mine = evalInts(h, 7)
      const theirs = evalInts(o, 7)
      total += w
      samples++
      if (mine > theirs) {
        won += w
        wins += w
      } else if (mine === theirs) {
        won += w / 2
        ties += w
      }
    }
  }
  return { equity: won / total, win: wins / total, tie: ties / total, samples, exact: true }
}

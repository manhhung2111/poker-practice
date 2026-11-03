import type { Card } from './cards'
import { type Chart, type ChartSpot, findChart, mainAction } from './charts'
import { type HandClass, ALL_HANDS, combos, handAt, gridPosition, comboCount } from './hands'
import { type Position, OPENERS, POSITIONS, actsAfter } from './positions'
import { type Rng, defaultRng, randomInt } from './random'
import type { ReviewItem } from './review'

/**
 * smart     = ~20% reviews of missed hands, the rest 60% borderline / 40% random
 * realistic = true card frequencies
 * easy      = clear-cut hands only (lesson warm-ups)
 * weak      = only hands from the review queue (falls back to smart when it's empty)
 */
export type DealingMode = 'smart' | 'realistic' | 'easy' | 'weak'

/** What the player drills. "blinds" = facing an open from the SB/BB. */
export type DrillSpot = 'rfi' | 'facing-open' | 'blinds' | 'facing-3bet'
export type DrillChoice = DrillSpot | 'mixed'
export const DRILL_SPOTS: readonly DrillSpot[] = ['rfi', 'facing-open', 'blinds', 'facing-3bet']

export type SeatState = 'folded' | 'waiting' | 'hero' | 'raised'

export interface Spot {
  type: DrillSpot
  chart: Chart
  hero: Position
  /** The opener (facing-open / blinds) or the 3-bettor (facing-3bet). */
  villain?: Position
  cards: [Card, Card]
  hand: HandClass
  /** Plain-text actions before the hero, e.g. ["UTG folds", "UTG+1 raises to 2.5bb"]. */
  history: string[]
  seats: Record<Position, SeatState>
  /** Chips in front of each seat, in bb. */
  bets: Partial<Record<Position, number>>
  /** Bet sizes for the hero's buttons, in bb (total amounts, not increments). */
  sizes: { call?: number; raise: number }
}

/** Share of smart-mode deals taken from near the edge of the range. */
export const SMART_EDGE_SHARE = 0.6
/** Share of smart-mode deals that replay a due missed hand, when one fits the drill. */
export const SMART_REVIEW_SHARE = 0.2

/** Review items available to the dealer. */
export interface ReviewPool {
  /** Due now, most overdue first. */
  due: readonly ReviewItem[]
  /** Everything queued, soonest first (used by weak-spots mode). */
  queued: readonly ReviewItem[]
}

// ---------- Bet sizes (design §3) ----------

const isBlind = (p: Position) => p === 'SB' || p === 'BB'

/** Open-raise size: 2.5bb, or 3bb from the SB. */
export function openSize(opener: Position): number {
  return opener === 'SB' ? 3 : 2.5
}

/** True if `later` will act after `earlier` on every postflop street. */
export function hasPositionOn(later: Position, earlier: Position): boolean {
  if (isBlind(later) && !isBlind(earlier)) return false
  if (isBlind(earlier) && !isBlind(later)) return true
  return actsAfter(later, earlier)
}

/** 3-bet size: 3× the open in position, 4× out of position. */
export function threeBetSize(opener: Position, threeBettor: Position): number {
  return openSize(opener) * (hasPositionOn(threeBettor, opener) ? 3 : 4)
}

/** 4-bet size: about 2.2× the 3-bet, rounded to 0.5bb. */
export function fourBetSize(threeBet: number): number {
  return Math.round(threeBet * 2.2 * 2) / 2
}

// ---------- Which seats can be drilled ----------

/** Hero seats that make sense for each drill spot. */
export function heroOptions(type: DrillSpot): readonly Position[] {
  switch (type) {
    case 'rfi':
    case 'facing-3bet':
      return OPENERS
    case 'facing-open':
      return POSITIONS.filter((p) => p !== 'UTG' && !isBlind(p))
    case 'blinds':
      return ['SB', 'BB']
  }
}

/** Seats allowed per spot type (e.g. by unlocked lessons). Missing = all of heroOptions. */
export type AllowedSeats = Partial<Record<DrillSpot, readonly Position[]>>

/** Hero seats for a spot type, given the player's choice and what's allowed. */
export function seatsFor(type: DrillSpot, positions: readonly Position[], allowed: AllowedSeats = {}): Position[] {
  const ok = allowed[type] ?? heroOptions(type)
  return heroOptions(type).filter((p) => positions.includes(p) && ok.includes(p))
}

/** Drill spots that have at least one usable seat. */
export function availableSpots(
  choice: DrillChoice,
  positions: readonly Position[],
  allowed: AllowedSeats = {},
): DrillSpot[] {
  const types = choice === 'mixed' ? DRILL_SPOTS : [choice]
  return types.filter((t) => seatsFor(t, positions, allowed).length > 0)
}

// ---------- Hand selection ----------

/**
 * Hands on the edge of a chart's range: at least one neighbouring grid cell
 * (up/down/left/right, plus the next pair up/down for pairs) has a different main action.
 * These are the hands where the decision is hard and learning happens.
 */
export function edgeHands(chart: Chart): HandClass[] {
  return ALL_HANDS.filter((h) => {
    const { row, col } = gridPosition(h)
    const action = mainAction(chart, h)
    const neighbours: [number, number][] = [
      [row - 1, col],
      [row + 1, col],
      [row, col - 1],
      [row, col + 1],
    ]
    // Pairs sit on the diagonal: the next pair up/down is their closest relative.
    if (row === col) neighbours.push([row - 1, col - 1], [row + 1, col + 1])
    return neighbours.some(
      ([r, c]) => r >= 0 && r < 13 && c >= 0 && c < 13 && mainAction(chart, handAt(r, c)) !== action,
    )
  })
}

/**
 * Picks a hand class: realistic = true card frequencies; smart = 60% edge hands,
 * else realistic; easy = only hands away from the edge.
 */
export function pickHand(chart: Chart, mode: DealingMode, rng: Rng = defaultRng): HandClass {
  if (mode === 'easy') {
    const edges = new Set(edgeHands(chart))
    return weightedPick(
      ALL_HANDS.filter((h) => !edges.has(h)),
      rng,
    )
  }
  if ((mode === 'smart' || mode === 'weak') && rng() < SMART_EDGE_SHARE) {
    const edges = edgeHands(chart)
    if (edges.length) return weightedPick(edges, rng)
  }
  return weightedPick(ALL_HANDS, rng)
}

/** Pick a hand class weighted by its number of combos (pairs 6, suited 4, offsuit 12). */
function weightedPick(hands: readonly HandClass[], rng: Rng): HandClass {
  const total = hands.reduce((n, h) => n + comboCount(h), 0)
  let x = rng() * total
  for (const h of hands) {
    x -= comboCount(h)
    if (x < 0) return h
  }
  return hands[hands.length - 1]
}

const pick = <T,>(items: readonly T[], rng: Rng): T => items[randomInt(items.length, rng)]

// ---------- Dealing ----------

/** Ways a chart can be dealt within the player's choice: drill type, hero seat, possible villains. */
function chartOptions(
  chart: Chart,
  choice: DrillChoice,
  positions: readonly Position[],
  allowed: AllowedSeats,
): { type: DrillSpot; hero: Position; villains: Position[] }[] {
  const out: { type: DrillSpot; hero: Position; villains: Position[] }[] = []
  for (const hero of chart.hero) {
    const type: DrillSpot =
      chart.spot === 'facing-open' ? (hero === 'SB' || hero === 'BB' ? 'blinds' : 'facing-open') : chart.spot
    if (choice !== 'mixed' && choice !== type) continue
    if (!seatsFor(type, positions, allowed).includes(hero)) continue
    const villains =
      type === 'rfi'
        ? []
        : chart.villain.filter((v) => (type === 'facing-3bet' ? actsAfter(v, hero) : actsAfter(hero, v) && OPENERS.includes(v)))
    if (type !== 'rfi' && !villains.length) continue
    out.push({ type, hero, villains })
  }
  return out
}

/** Builds a spot for a given chart and hand class. */
function buildSpot(chart: Chart, type: DrillSpot, hero: Position, villain: Position | undefined, hand: HandClass, rng: Rng): Spot {
  const [a, b] = pick(combos(hand), rng)
  const cards: [Card, Card] = rng() < 0.5 ? [a, b] : [b, a]
  return { type, chart, hero, villain, cards, hand, ...tableFor(type, hero, villain) }
}

/** Tries to deal one of the review items (in the order given). */
function dealReview(
  charts: readonly Chart[],
  items: readonly ReviewItem[],
  choice: DrillChoice,
  positions: readonly Position[],
  allowed: AllowedSeats,
  rng: Rng,
): Spot | null {
  for (const item of items) {
    const chart = charts.find((c) => c.id === item.chartId)
    if (!chart) continue
    const options = chartOptions(chart, choice, positions, allowed)
    if (!options.length) continue
    const o = pick(options, rng)
    return buildSpot(chart, o.type, o.hero, o.villains.length ? pick(o.villains, rng) : undefined, item.hand, rng)
  }
  return null
}

/**
 * Deals one drill spot.
 * @param choice    which spot type to drill ('mixed' picks among the available ones)
 * @param positions hero seats the player selected
 * @param allowed   seats unlocked per spot type
 * @param review    missed hands to replay (smart and weak modes)
 */
export function dealSpot(
  charts: readonly Chart[],
  choice: DrillChoice,
  positions: readonly Position[],
  mode: DealingMode,
  rng: Rng = defaultRng,
  allowed: AllowedSeats = {},
  review?: ReviewPool,
): Spot {
  const types = availableSpots(choice, positions, allowed)
  if (!types.length) throw new Error('None of the chosen positions fit this drill')

  if (review && mode === 'weak') {
    // Prefer due items, then the rest of the queue; shuffle the front a little so it isn't one fixed order.
    const front = review.due.length ? review.due : review.queued
    const start = randomInt(Math.min(front.length, 5) || 1, rng)
    const spot = dealReview(charts, [...front.slice(start), ...front.slice(0, start), ...review.queued], choice, positions, allowed, rng)
    if (spot) return spot
  }
  if (review && mode === 'smart' && review.due.length && rng() < SMART_REVIEW_SHARE) {
    const spot = dealReview(charts, review.due, choice, positions, allowed, rng)
    if (spot) return spot
  }

  const type = pick(types, rng)
  const hero = pick(seatsFor(type, positions, allowed), rng)

  const chartSpot: ChartSpot = type === 'blinds' ? 'facing-open' : type
  let villain: Position | undefined
  if (type === 'facing-open' || type === 'blinds') {
    villain = pick(OPENERS.filter((p) => actsAfter(hero, p)), rng)
  } else if (type === 'facing-3bet') {
    villain = pick(POSITIONS.filter((p) => actsAfter(p, hero)), rng)
  }

  const chart = findChart(charts, chartSpot, hero, villain)
  if (!chart) throw new Error(`No chart for ${chartSpot} ${hero} vs ${villain}`)
  return buildSpot(chart, type, hero, villain, pickHand(chart, mode, rng), rng)
}

/** Builds the action history, seat states, bets and button sizes for a spot. */
export function tableFor(
  type: DrillSpot,
  hero: Position,
  villain?: Position,
): Pick<Spot, 'history' | 'seats' | 'bets' | 'sizes'> {
  const seats = Object.fromEntries(POSITIONS.map((p) => [p, 'waiting'])) as Record<Position, SeatState>
  const bets: Partial<Record<Position, number>> = { SB: 0.5, BB: 1 }
  const history: string[] = []
  const fold = (p: Position) => {
    seats[p] = 'folded'
    history.push(`${p} folds`)
  }
  seats[hero] = 'hero'

  if (type === 'rfi') {
    for (const p of POSITIONS) if (actsAfter(hero, p)) fold(p)
    return { history, seats, bets, sizes: { raise: openSize(hero) } }
  }

  if (!villain) throw new Error(`${type} needs a villain`)

  if (type === 'facing-open' || type === 'blinds') {
    const open = openSize(villain)
    for (const p of POSITIONS) {
      if (p === villain) {
        seats[p] = 'raised'
        bets[p] = open
        history.push(`${p} raises to ${open}bb`)
      } else if (p !== hero && actsAfter(hero, p)) {
        fold(p)
      }
    }
    const threeBet = open * (hasPositionOn(hero, villain) ? 3 : 4)
    return { history, seats, bets, sizes: { call: open, raise: threeBet } }
  }

  // facing-3bet: hero opened, villain 3-bet, everyone else folded.
  const open = openSize(hero)
  const threeBet = threeBetSize(hero, villain)
  for (const p of POSITIONS) {
    if (p === hero) {
      history.push(`You raise to ${open}bb`)
    } else if (p === villain) {
      seats[p] = 'raised'
      history.push(`${p} 3-bets to ${threeBet}bb`)
    } else {
      fold(p)
    }
  }
  bets[hero] = open
  bets[villain] = threeBet
  return { history, seats, bets, sizes: { call: threeBet, raise: fourBetSize(threeBet) } }
}

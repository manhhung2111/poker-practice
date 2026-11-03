import type { Card } from './cards'
import { type Chart, type ChartSpot, findChart, mainAction } from './charts'
import { type HandClass, ALL_HANDS, combos, handAt, gridPosition, comboCount } from './hands'
import { type Position, OPENERS, POSITIONS, actsAfter } from './positions'
import { type Rng, defaultRng, randomInt } from './random'

export type DealingMode = 'smart' | 'realistic'

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

/** Drill spots that have at least one of the chosen positions. */
export function availableSpots(choice: DrillChoice, positions: readonly Position[]): DrillSpot[] {
  const types = choice === 'mixed' ? DRILL_SPOTS : [choice]
  return types.filter((t) => heroOptions(t).some((p) => positions.includes(p)))
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

/** Picks a hand class: realistic = true card frequencies; smart = 60% edge hands, else realistic. */
export function pickHand(chart: Chart, mode: DealingMode, rng: Rng = defaultRng): HandClass {
  if (mode === 'smart' && rng() < SMART_EDGE_SHARE) {
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

/**
 * Deals one drill spot.
 * @param choice   which spot type to drill ('mixed' picks among the available ones)
 * @param positions hero seats the player selected
 */
export function dealSpot(
  charts: readonly Chart[],
  choice: DrillChoice,
  positions: readonly Position[],
  mode: DealingMode,
  rng: Rng = defaultRng,
): Spot {
  const types = availableSpots(choice, positions)
  if (!types.length) throw new Error('None of the chosen positions fit this drill')
  const type = pick(types, rng)
  const hero = pick(
    heroOptions(type).filter((p) => positions.includes(p)),
    rng,
  )

  const chartSpot: ChartSpot = type === 'blinds' ? 'facing-open' : type
  let villain: Position | undefined
  if (type === 'facing-open' || type === 'blinds') {
    villain = pick(OPENERS.filter((p) => actsAfter(hero, p)), rng)
  } else if (type === 'facing-3bet') {
    villain = pick(POSITIONS.filter((p) => actsAfter(p, hero)), rng)
  }

  const chart = findChart(charts, chartSpot, hero, villain)
  if (!chart) throw new Error(`No chart for ${chartSpot} ${hero} vs ${villain}`)

  const hand = pickHand(chart, mode, rng)
  const [a, b] = pick(combos(hand), rng)
  const cards: [Card, Card] = rng() < 0.5 ? [a, b] : [b, a]

  return { type, chart, hero, villain, cards, hand, ...tableFor(type, hero, villain) }
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

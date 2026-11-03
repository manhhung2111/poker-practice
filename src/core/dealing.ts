import type { Card } from './cards'
import { type Chart, findChart, mainAction } from './charts'
import { type HandClass, ALL_HANDS, combos, handAt, gridPosition, comboCount } from './hands'
import { type Position, POSITIONS } from './positions'
import { type Rng, defaultRng, randomInt } from './random'

export type DealingMode = 'smart' | 'realistic'

export interface Spot {
  spot: 'rfi'
  chart: Chart
  hero: Position
  cards: [Card, Card]
  hand: HandClass
  /** Plain-text actions before the hero, e.g. ["UTG folds", "UTG+1 folds"]. */
  history: string[]
}

/** Share of smart-mode deals taken from near the edge of the range. */
export const SMART_EDGE_SHARE = 0.6

/**
 * Hands on the edge of a chart's range: at least one neighbouring grid cell
 * (up/down/left/right, plus the next pair up/down for pairs) has a different main action. These are the hands where
 * the decision is hard and learning happens.
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

/** Deals an open-or-fold spot for one of the given positions. */
export function dealRfi(
  charts: readonly Chart[],
  positions: readonly Position[],
  mode: DealingMode,
  rng: Rng = defaultRng,
): Spot {
  const openers = positions.filter((p) => p !== 'BB')
  if (!openers.length) throw new Error('No position to open from')
  const hero = openers[randomInt(openers.length, rng)]
  const chart = findChart(charts, 'rfi', hero)
  if (!chart) throw new Error(`No RFI chart for ${hero}`)
  const hand = pickHand(chart, mode, rng)
  const options = combos(hand)
  const [a, b] = options[randomInt(options.length, rng)]
  // Randomize which card shows first.
  const cards: [Card, Card] = rng() < 0.5 ? [a, b] : [b, a]
  const history = POSITIONS.slice(0, POSITIONS.indexOf(hero)).map((p) => `${p} folds`)
  return { spot: 'rfi', chart, hero, cards, hand, history }
}

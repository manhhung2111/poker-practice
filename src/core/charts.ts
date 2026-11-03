import { type HandClass, ALL_HANDS, comboCount, isHandClass, TOTAL_COMBOS } from './hands'
import { type Position, isPosition } from './positions'
import { parseRange } from './rangeParser'

export type Action = 'fold' | 'call' | 'raise'
export const ACTIONS: readonly Action[] = ['raise', 'call', 'fold']

/** Spot types a chart can describe. Blinds defense = 'facing-open' with hero SB/BB. */
export type ChartSpot = 'rfi' | 'facing-open' | 'facing-3bet'

/** Frequencies per action for one hand; values sum to 1. */
export type Mix = Partial<Record<Action, number>>

/** Chart as written in the JSON data files. */
export interface ChartDef {
  id: string
  spot: ChartSpot
  title: string
  hero: string[]
  villain?: string[]
  keyIdea: string
  /**
   * Range notation per action. Hands not listed fold.
   * If a hand appears in both, raise wins over call.
   */
  actions: { raise?: string; call?: string }
  /** Mixed strategies; override `actions` for the listed hands. */
  mixed?: Record<string, Mix>
  /** Hand-specific explanations. */
  notes?: Record<string, string>
}

/** Validated chart with a strategy for all 169 hands. */
export interface Chart {
  id: string
  spot: ChartSpot
  title: string
  hero: Position[]
  villain: Position[]
  keyIdea: string
  strategy: Record<HandClass, Mix>
  notes: Record<HandClass, string>
  /** True when the user edited this chart's ranges. */
  edited?: boolean
}

export class ChartError extends Error {
  constructor(chartId: string, message: string) {
    super(`Chart "${chartId}": ${message}`)
  }
}

export function compileChart(def: ChartDef): Chart {
  const fail = (msg: string): never => {
    throw new ChartError(def.id, msg)
  }
  if (!def.id) fail('missing id')
  if (!['rfi', 'facing-open', 'facing-3bet'].includes(def.spot)) fail(`unknown spot "${def.spot}"`)

  const hero = def.hero.map((p) => (isPosition(p) ? p : fail(`unknown hero position "${p}"`)))
  const villain = (def.villain ?? []).map((p) => (isPosition(p) ? p : fail(`unknown villain position "${p}"`)))
  if (hero.length === 0) fail('no hero positions')
  if (def.spot === 'rfi' && villain.length) fail('RFI charts have no villain')
  if (def.spot !== 'rfi' && villain.length === 0) fail('missing villain positions')

  const parse = (text: string | undefined, label: string) => {
    try {
      return parseRange(text ?? '')
    } catch (e) {
      return fail(`${label}: ${(e as Error).message}`)
    }
  }
  const raise = parse(def.actions.raise, 'raise')
  const call = parse(def.actions.call, 'call')
  if (def.spot === 'rfi' && call.size) fail('RFI charts cannot have calls')

  const strategy: Record<HandClass, Mix> = {}
  for (const h of ALL_HANDS) {
    strategy[h] = raise.has(h) ? { raise: 1 } : call.has(h) ? { call: 1 } : { fold: 1 }
  }

  for (const [hand, mix] of Object.entries(def.mixed ?? {})) {
    if (!isHandClass(hand)) fail(`mixed: invalid hand "${hand}"`)
    let sum = 0
    for (const [action, freq] of Object.entries(mix)) {
      if (!ACTIONS.includes(action as Action)) fail(`mixed ${hand}: unknown action "${action}"`)
      if (typeof freq !== 'number' || freq < 0 || freq > 1) fail(`mixed ${hand}: bad frequency`)
      sum += freq as number
    }
    if (Math.abs(sum - 1) > 1e-6) fail(`mixed ${hand}: frequencies sum to ${sum}, not 1`)
    strategy[hand] = { ...mix }
  }

  const notes: Record<HandClass, string> = {}
  for (const [hand, text] of Object.entries(def.notes ?? {})) {
    if (!isHandClass(hand)) fail(`notes: invalid hand "${hand}"`)
    notes[hand] = text
  }

  return { id: def.id, spot: def.spot, title: def.title, hero, villain, keyIdea: def.keyIdea, strategy, notes }
}

/** Actions with frequency > 0 for a hand — any of these counts as correct. */
export function correctActions(chart: Chart, hand: HandClass): Action[] {
  const mix = chart.strategy[hand]
  return ACTIONS.filter((a) => (mix[a] ?? 0) > 0)
}

/** The most frequent action for a hand. */
export function mainAction(chart: Chart, hand: HandClass): Action {
  const mix = chart.strategy[hand]
  return ACTIONS.reduce((best, a) => ((mix[a] ?? 0) > (mix[best] ?? 0) ? a : best), 'fold' as Action)
}

/** Share of all 1326 combos taking each action (weighted by frequency). */
export function actionShares(chart: Chart): Record<Action, number> {
  const shares: Record<Action, number> = { raise: 0, call: 0, fold: 0 }
  for (const h of ALL_HANDS) {
    for (const a of ACTIONS) shares[a] += (chart.strategy[h][a] ?? 0) * comboCount(h)
  }
  for (const a of ACTIONS) shares[a] /= TOTAL_COMBOS
  return shares
}

/** Display name of "raise" for a chart's spot: Raise / 3-bet / 4-bet. */
export function actionLabel(spot: ChartSpot, action: Action): string {
  if (action === 'fold') return 'Fold'
  if (action === 'call') return 'Call'
  return spot === 'rfi' ? 'Raise' : spot === 'facing-open' ? '3-bet' : '4-bet'
}

/** The chart for a spot, or undefined. Villain is ignored for RFI. */
export function findChart(
  charts: readonly Chart[],
  spot: ChartSpot,
  hero: Position,
  villain?: Position,
): Chart | undefined {
  return charts.find(
    (c) => c.spot === spot && c.hero.includes(hero) && (spot === 'rfi' || (villain !== undefined && c.villain.includes(villain))),
  )
}

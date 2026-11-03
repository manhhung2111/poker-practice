import { type Action, type Chart, correctActions, mainAction } from './charts'
import { type HandClass, ALL_HANDS, TOTAL_COMBOS, comboCount } from './hands'
import { topPercent } from './strength'

export type Severity = 'none' | 'close' | 'clear' | 'blunder'

/**
 * Severity thresholds on "depth": how far inside the correct action's region the
 * hand sits, relative to that region's size (0 = right on the edge, 1 = the far end).
 */
export const SEVERITY_THRESHOLDS = { close: 0.2, clear: 0.45 }

export interface Grade {
  correct: boolean
  chosen: Action
  /** Most frequent correct action. */
  best: Action
  /** All actions that count as correct (more than one for mixed hands). */
  correctActions: Action[]
  severity: Severity
  /** Relative depth (0–1) used for severity; 0 when correct. */
  depth: number
}

/**
 * Grades an answer.
 *
 * For a wrong answer we find the nearest hand (by strength percentile) where the
 * chosen action is correct: that's the edge of the region your hand is in. The
 * distance to it, divided by the size of the correct action's region, is the
 * "depth". Folding QQ from UTG is deep inside a small raise region → blunder;
 * opening KJo from UTG is right at the edge → close spot.
 *
 * Mixing up two ways of playing a hand (call vs raise) is capped at "clear":
 * the costly mistakes are folding good hands and playing bad ones.
 */
export function grade(chart: Chart, hand: HandClass, chosen: Action): Grade {
  const ok = correctActions(chart, hand)
  const best = mainAction(chart, hand)
  if (ok.includes(chosen)) {
    return { correct: true, chosen, best, correctActions: ok, severity: 'none', depth: 0 }
  }

  const here = topPercent(hand)
  let distance = Infinity
  let region = 0
  for (const h of ALL_HANDS) {
    const mix = chart.strategy[h]
    if ((mix[chosen] ?? 0) > 0) distance = Math.min(distance, Math.abs(topPercent(h) - here))
    region += (mix[best] ?? 0) * comboCount(h)
  }
  region /= TOTAL_COMBOS
  const depth = Number.isFinite(distance) && region > 0 ? Math.min(1, distance / region) : 1

  let severity = severityOf(depth)
  if (chosen !== 'fold' && best !== 'fold' && severity === 'blunder') severity = 'clear'
  return { correct: false, chosen, best, correctActions: ok, severity, depth }
}

export function severityOf(depth: number): Exclude<Severity, 'none'> {
  if (depth <= SEVERITY_THRESHOLDS.close) return 'close'
  if (depth <= SEVERITY_THRESHOLDS.clear) return 'clear'
  return 'blunder'
}

import { type Action, type Chart, type ChartDef, type Mix, compileChart } from './charts'
import { type HandClass, ALL_HANDS } from './hands'
import { formatRange } from './rangeParser'

/**
 * A user's edit of one chart (design §6.3): the actions replace the default
 * chart's actions; title, key idea and notes stay. Stored per chart id.
 */
export interface ChartOverride {
  actions: { raise: string; call: string }
  mixed?: Record<HandClass, Mix>
}

export type Overrides = Record<string, ChartOverride>

/** Compiles a chart definition with an optional override applied. */
export function applyOverride(def: ChartDef, override?: ChartOverride): Chart {
  if (!override) return compileChart(def)
  return compileChart({ ...def, actions: override.actions, mixed: override.mixed ?? {} })
}

const isPure = (mix: Mix, a: Action) => (mix[a] ?? 0) === 1

/** Turns a full strategy back into compact range notation (inverse of compiling). */
export function strategyToOverride(strategy: Record<HandClass, Mix>): ChartOverride {
  const raise: HandClass[] = []
  const call: HandClass[] = []
  const mixed: Record<HandClass, Mix> = {}
  for (const h of ALL_HANDS) {
    const mix = strategy[h] ?? { fold: 1 }
    if (isPure(mix, 'raise')) raise.push(h)
    else if (isPure(mix, 'call')) call.push(h)
    else if (!isPure(mix, 'fold')) mixed[h] = { ...mix }
  }
  return {
    actions: { raise: formatRange(raise), call: formatRange(call) },
    ...(Object.keys(mixed).length ? { mixed } : {}),
  }
}

/** True if two strategies give every hand the same frequencies. */
export function sameStrategy(a: Record<HandClass, Mix>, b: Record<HandClass, Mix>): boolean {
  return ALL_HANDS.every((h) => (['raise', 'call', 'fold'] as const).every((x) => (a[h]?.[x] ?? 0) === (b[h]?.[x] ?? 0)))
}

/** Warnings for edits that are probably mistakes. They don't block saving. */
export function sanityWarnings(chart: Chart): string[] {
  const out: string[] = []
  if ((chart.strategy['AA'].fold ?? 0) > 0) out.push('AA is folded. Almost every chart raises it.')
  if ((chart.strategy['KK'].fold ?? 0) > 0) out.push('KK is folded. It is almost never a fold preflop.')
  if ((chart.strategy['72o'].fold ?? 0) < 1) out.push('72o is played. It is the weakest hand.')
  return out
}

/**
 * Validates saved overrides against the known chart definitions, dropping
 * entries for unknown charts or that don't compile.
 */
export function parseOverrides(raw: unknown, defs: readonly ChartDef[]): Overrides {
  const out: Overrides = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const def = defs.find((d) => d.id === id)
    const o = v as Partial<ChartOverride>
    if (!def || !o || typeof o.actions?.raise !== 'string' || typeof o.actions?.call !== 'string') continue
    const override: ChartOverride = { actions: { raise: o.actions.raise, call: o.actions.call }, ...(o.mixed ? { mixed: o.mixed } : {}) }
    try {
      applyOverride(def, override)
      out[id] = override
    } catch {
      /* skip invalid */
    }
  }
  return out
}

import { type Chart, type ChartDef, type ChartSpot, compileChart } from '../core/charts'

const files = import.meta.glob<ChartDef>('./ranges/**/*.json', { eager: true, import: 'default' })

const SPOT_ORDER: ChartSpot[] = ['rfi', 'facing-open', 'facing-3bet']

/** Default charts shipped with the app, compiled and validated at load time. */
export const DEFAULT_CHART_DEFS: readonly ChartDef[] = Object.values(files)

export const DEFAULT_CHARTS: readonly Chart[] = DEFAULT_CHART_DEFS.map(compileChart).sort(
  (a, b) =>
    SPOT_ORDER.indexOf(a.spot) - SPOT_ORDER.indexOf(b.spot) || chartOrder(a) - chartOrder(b),
)

/** Order charts by the earliest hero position, then the earliest villain position. */
function chartOrder(c: Chart): number {
  const order = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB']
  const minIndex = (ps: string[]) => Math.min(...ps.map((p) => order.indexOf(p)), 99)
  return minIndex(c.hero) * 100 + minIndex(c.villain)
}

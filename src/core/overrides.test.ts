import { describe, expect, it } from 'vitest'
import { DEFAULT_CHART_DEFS, DEFAULT_CHARTS } from '../data/charts'
import { applyOverride, parseOverrides, sameStrategy, sanityWarnings, strategyToOverride } from './overrides'

const def = DEFAULT_CHART_DEFS.find((d) => d.id === 'facing-open/bb-vs-late')!

describe('chart overrides', () => {
  it('round-trips every default chart through range notation', () => {
    for (const chart of DEFAULT_CHARTS) {
      const d = DEFAULT_CHART_DEFS.find((x) => x.id === chart.id)!
      const back = applyOverride(d, strategyToOverride(chart.strategy))
      expect(sameStrategy(back.strategy, chart.strategy), chart.id).toBe(true)
    }
  })

  it('applies an edit but keeps title, key idea and notes', () => {
    const c = applyOverride(def, { actions: { raise: 'AA', call: 'KK' } })
    expect(c.strategy['AA']).toEqual({ raise: 1 })
    expect(c.strategy['KK']).toEqual({ call: 1 })
    expect(c.strategy['QQ']).toEqual({ fold: 1 })
    expect(c.title).toBe(def.title)
    expect(c.keyIdea).toBe(def.keyIdea)
  })

  it('keeps mixed hands', () => {
    const base = applyOverride(def)
    const strategy = { ...base.strategy, A2o: { call: 0.5, fold: 0.5 } }
    const o = strategyToOverride(strategy)
    expect(o.mixed).toEqual({ A2o: { call: 0.5, fold: 0.5 } })
    expect(applyOverride(def, o).strategy['A2o']).toEqual({ call: 0.5, fold: 0.5 })
  })

  it('warns about likely mistakes', () => {
    expect(sanityWarnings(applyOverride(def))).toEqual([])
    const bad = applyOverride(def, { actions: { raise: '72o', call: '' } })
    expect(sanityWarnings(bad)).toHaveLength(3)
  })

  it('drops saved overrides for unknown charts or bad notation', () => {
    const parsed = parseOverrides(
      {
        [def.id]: { actions: { raise: 'AA', call: '' } },
        'no/such-chart': { actions: { raise: 'AA', call: '' } },
        'rfi/utg': { actions: { raise: 'AX', call: '' } },
        'rfi/co': { actions: { raise: 'AA' } },
      },
      DEFAULT_CHART_DEFS,
    )
    expect(Object.keys(parsed)).toEqual([def.id])
    expect(parseOverrides(null, DEFAULT_CHART_DEFS)).toEqual({})
  })
})

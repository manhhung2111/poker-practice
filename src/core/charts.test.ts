import { describe, expect, it } from 'vitest'
import { type ChartDef, ChartError, actionLabel, actionShares, compileChart, correctActions, findChart, mainAction } from './charts'

const base: ChartDef = {
  id: 'test',
  spot: 'facing-open',
  title: 'Test',
  hero: ['BB'],
  villain: ['BTN'],
  keyIdea: 'Test chart',
  actions: { raise: 'QQ+, AKs', call: 'JJ-22, AKs' },
}

describe('compileChart', () => {
  it('fills all 169 hands, folding unlisted ones', () => {
    const c = compileChart(base)
    expect(Object.keys(c.strategy)).toHaveLength(169)
    expect(c.strategy['72o']).toEqual({ fold: 1 })
    expect(c.strategy['55']).toEqual({ call: 1 })
    expect(c.strategy['AA']).toEqual({ raise: 1 })
  })

  it('lets raise win when a hand is listed in both raise and call', () => {
    expect(compileChart(base).strategy['AKs']).toEqual({ raise: 1 })
  })

  it('applies mixed strategies over the action lists', () => {
    const c = compileChart({ ...base, mixed: { JJ: { raise: 0.5, call: 0.5 }, AQo: { call: 0.3, fold: 0.7 } } })
    expect(c.strategy['JJ']).toEqual({ raise: 0.5, call: 0.5 })
    expect(correctActions(c, 'JJ')).toEqual(['raise', 'call'])
    expect(mainAction(c, 'AQo')).toBe('fold')
    expect(correctActions(c, 'AQo')).toEqual(['call', 'fold'])
  })

  it('rejects bad data with a clear error', () => {
    const bad: Partial<ChartDef>[] = [
      { hero: ['XYZ'] },
      { hero: [] },
      { villain: [] },
      { villain: ['BTN', 'nope'] },
      { actions: { raise: 'AX' } },
      { mixed: { AKs: { raise: 0.5, call: 0.4 } } },
      { mixed: { AKx: { raise: 1 } } },
      { mixed: { AKs: { shove: 1 } as never } },
      { notes: { ZZ: 'x' } },
      { spot: 'rfi', villain: ['BTN'] },
      { spot: 'rfi', villain: undefined, actions: { call: 'AA' } },
      { spot: 'nope' as never },
    ]
    for (const patch of bad) {
      expect(() => compileChart({ ...base, ...patch }), JSON.stringify(patch)).toThrow(ChartError)
    }
  })
})

describe('chart helpers', () => {
  it('computes combo-weighted action shares', () => {
    const c = compileChart({ ...base, actions: { raise: 'AA' } })
    const s = actionShares(c)
    expect(s.raise).toBeCloseTo(6 / 1326)
    expect(s.fold).toBeCloseTo(1 - 6 / 1326)
    expect(s.call).toBe(0)
  })

  it('labels the raise action by spot', () => {
    expect(actionLabel('rfi', 'raise')).toBe('Raise')
    expect(actionLabel('facing-open', 'raise')).toBe('3-bet')
    expect(actionLabel('facing-3bet', 'raise')).toBe('4-bet')
    expect(actionLabel('rfi', 'fold')).toBe('Fold')
  })

  it('finds charts by spot and positions', () => {
    const a = compileChart(base)
    const b = compileChart({ ...base, id: 'rfi', spot: 'rfi', hero: ['BTN'], villain: undefined, actions: { raise: 'AA' } })
    expect(findChart([a, b], 'facing-open', 'BB', 'BTN')).toBe(a)
    expect(findChart([a, b], 'facing-open', 'BB', 'CO')).toBeUndefined()
    expect(findChart([a, b], 'rfi', 'BTN')).toBe(b)
    expect(findChart([a, b], 'rfi', 'CO')).toBeUndefined()
  })
})

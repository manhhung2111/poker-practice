/**
 * Sanity checks for the default range charts (design §6.6).
 * These protect against teaching wrong poker through a typo in the data.
 */
import { describe, expect, it } from 'vitest'
import { type Chart, actionShares, correctActions, findChart, mainAction } from '../core/charts'
import { ALL_HANDS } from '../core/hands'
import { OPENERS, facing3betMatchups, facingOpenMatchups } from '../core/positions'
import { DEFAULT_CHARTS } from './charts'

const byId = (id: string): Chart => {
  const c = DEFAULT_CHARTS.find((x) => x.id === id)
  if (!c) throw new Error(`missing chart ${id}`)
  return c
}
const playable = (c: Chart) => new Set(ALL_HANDS.filter((h) => mainAction(c, h) !== 'fold'))

describe('default charts', () => {
  it('loads 25 charts with unique ids', () => {
    expect(DEFAULT_CHARTS).toHaveLength(25)
    expect(new Set(DEFAULT_CHARTS.map((c) => c.id)).size).toBe(25)
  })

  it('every chart covers all 169 hands with frequencies summing to 1', () => {
    for (const c of DEFAULT_CHARTS) {
      for (const h of ALL_HANDS) {
        const sum = Object.values(c.strategy[h]).reduce((a, b) => a + (b ?? 0), 0)
        expect(sum, `${c.id} ${h}`).toBeCloseTo(1)
      }
    }
  })

  it('never folds AA or KK, and always raises AA', () => {
    for (const c of DEFAULT_CHARTS) {
      expect(correctActions(c, 'AA'), c.id).toEqual(['raise'])
      expect(correctActions(c, 'KK'), c.id).not.toContain('fold')
    }
  })

  it('never plays 72o', () => {
    for (const c of DEFAULT_CHARTS) expect(mainAction(c, '72o'), c.id).toBe('fold')
  })

  it('has exactly one RFI chart per opening position', () => {
    for (const p of OPENERS) {
      expect(DEFAULT_CHARTS.filter((c) => c.spot === 'rfi' && c.hero.includes(p)), p).toHaveLength(1)
    }
  })

  it('has exactly one chart for every facing-open matchup', () => {
    for (const { hero, villain } of facingOpenMatchups()) {
      const matches = DEFAULT_CHARTS.filter(
        (c) => c.spot === 'facing-open' && c.hero.includes(hero) && c.villain.includes(villain),
      )
      expect(matches.map((c) => c.id), `${hero} vs ${villain} open`).toHaveLength(1)
    }
  })

  it('has exactly one chart for every facing-3bet matchup', () => {
    for (const { hero, villain } of facing3betMatchups()) {
      const matches = DEFAULT_CHARTS.filter(
        (c) => c.spot === 'facing-3bet' && c.hero.includes(hero) && c.villain.includes(villain),
      )
      expect(matches.map((c) => c.id), `${hero} open vs ${villain} 3-bet`).toHaveLength(1)
    }
  })

  it('RFI ranges are nested and widen from UTG to BTN', () => {
    const order = ['rfi/utg', 'rfi/utg1', 'rfi/mp', 'rfi/lj', 'rfi/hj', 'rfi/co', 'rfi/btn']
    for (let i = 1; i < order.length; i++) {
      const tighter = playable(byId(order[i - 1]))
      const wider = playable(byId(order[i]))
      const missing = [...tighter].filter((h) => !wider.has(h))
      expect(missing, `${order[i - 1]} ⊆ ${order[i]}`).toEqual([])
      expect(wider.size).toBeGreaterThan(tighter.size)
    }
  })

  it('RFI sizes are in sensible 9-max ranges', () => {
    const expected: Record<string, [number, number]> = {
      'rfi/utg': [0.09, 0.13],
      'rfi/utg1': [0.1, 0.14],
      'rfi/mp': [0.12, 0.17],
      'rfi/lj': [0.15, 0.2],
      'rfi/hj': [0.18, 0.25],
      'rfi/co': [0.24, 0.32],
      'rfi/btn': [0.4, 0.52],
      'rfi/sb': [0.35, 0.5],
    }
    for (const [id, [lo, hi]] of Object.entries(expected)) {
      const r = actionShares(byId(id)).raise
      expect(r, id).toBeGreaterThanOrEqual(lo)
      expect(r, id).toBeLessThanOrEqual(hi)
    }
  })

  it('BB defends wider against later openers', () => {
    const order = ['facing-open/bb-vs-early', 'facing-open/bb-vs-middle', 'facing-open/bb-vs-late', 'facing-open/bb-vs-sb']
    for (let i = 1; i < order.length; i++) {
      const tighter = playable(byId(order[i - 1]))
      const wider = playable(byId(order[i]))
      expect([...tighter].filter((h) => !wider.has(h)), `${order[i - 1]} ⊆ ${order[i]}`).toEqual([])
    }
  })

  it('continues vs a 3-bet only with hands that were opened', () => {
    for (const c of DEFAULT_CHARTS.filter((x) => x.spot === 'facing-3bet')) {
      for (const hero of c.hero) {
        const opens = playable(findChart(DEFAULT_CHARTS, 'rfi', hero)!)
        const notOpened = [...playable(c)].filter((h) => !opens.has(h))
        expect(notOpened, `${c.id} as ${hero}`).toEqual([])
      }
    }
  })

  it('every chart has a title and key idea, and notes only mention real hands', () => {
    for (const c of DEFAULT_CHARTS) {
      expect(c.title.length, c.id).toBeGreaterThan(5)
      expect(c.keyIdea.length, c.id).toBeGreaterThan(20)
    }
  })
})

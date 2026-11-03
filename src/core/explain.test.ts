import { describe, expect, it } from 'vitest'
import { findChart } from './charts'
import { explain } from './explain'
import { ALL_HANDS } from './hands'
import { DEFAULT_CHARTS } from '../data/charts'

describe('explain', () => {
  it('prefers the chart note for a hand', () => {
    const utg = findChart(DEFAULT_CHARTS, 'rfi', 'UTG')!
    expect(explain(utg, 'ATo').hand).toBe(utg.notes['ATo'])
  })

  it('falls back to a hand-type note matching whether the hand is played', () => {
    const utg = findChart(DEFAULT_CHARTS, 'rfi', 'UTG')!
    expect(explain(utg, '72o').hand).toMatch(/Fold/)
    expect(explain(utg, 'QQ').hand).toMatch(/premium pair/i)
  })

  it('states how often you open from the position', () => {
    const co = findChart(DEFAULT_CHARTS, 'rfi', 'CO')!
    expect(explain(co, 'AA').spot).toBe('From CO you open about 28% of hands.')
  })

  it('produces non-empty text for every hand in every chart', () => {
    for (const c of DEFAULT_CHARTS) {
      for (const h of ALL_HANDS) {
        const e = explain(c, h)
        expect(e.hand.length, `${c.id} ${h}`).toBeGreaterThan(10)
        expect(e.spot.length).toBeGreaterThan(10)
        expect(e.keyIdea).toBe(c.keyIdea)
      }
    }
  })
})

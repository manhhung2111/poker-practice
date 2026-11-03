import { describe, expect, it } from 'vitest'
import { findChart } from './charts'
import { dealRfi, edgeHands, pickHand } from './dealing'
import { handClassOf } from './hands'
import { seededRng } from './random'
import { DEFAULT_CHARTS } from '../data/charts'

const utg = findChart(DEFAULT_CHARTS, 'rfi', 'UTG')!

describe('edgeHands', () => {
  it('finds hands bordering a different action', () => {
    const edges = new Set(edgeHands(utg))
    expect(edges.has('77')).toBe(true) // 77 raise, 66 fold below it
    expect(edges.has('66')).toBe(true)
    expect(edges.has('KQo')).toBe(true) // raise next to KJo fold
    expect(edges.has('AA')).toBe(false) // surrounded by raises
    expect(edges.has('72o')).toBe(false) // surrounded by folds
  })
})

describe('pickHand', () => {
  it('smart mode deals edge hands much more often than realistic mode', () => {
    const edges = new Set(edgeHands(utg))
    const share = (mode: 'smart' | 'realistic') => {
      const rng = seededRng(5)
      let n = 0
      for (let i = 0; i < 5000; i++) if (edges.has(pickHand(utg, mode, rng))) n++
      return n / 5000
    }
    const realistic = share('realistic')
    const smart = share('smart')
    expect(realistic).toBeLessThan(0.3)
    expect(smart).toBeGreaterThan(0.6) // ≥ 60% edge + some random edges
  })

  it('realistic mode follows card frequencies (offsuit hands 3× suited)', () => {
    const rng = seededRng(9)
    let suited = 0
    let offsuit = 0
    for (let i = 0; i < 20000; i++) {
      const h = pickHand(utg, 'realistic', rng)
      if (h.endsWith('s')) suited++
      if (h.endsWith('o')) offsuit++
    }
    expect(offsuit / suited).toBeGreaterThan(2.7)
    expect(offsuit / suited).toBeLessThan(3.3)
  })
})

describe('dealRfi', () => {
  it('deals only from the chosen positions, never the BB', () => {
    const rng = seededRng(3)
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(dealRfi(DEFAULT_CHARTS, ['CO', 'BTN', 'BB'], 'smart', rng).hero)
    expect(seen).toEqual(new Set(['CO', 'BTN']))
  })

  it('deals two different cards that match the hand class and the right chart', () => {
    const rng = seededRng(11)
    for (let i = 0; i < 500; i++) {
      const s = dealRfi(DEFAULT_CHARTS, ['UTG', 'HJ', 'SB'], 'smart', rng)
      expect(s.cards[0]).not.toBe(s.cards[1])
      expect(handClassOf(s.cards[0], s.cards[1])).toBe(s.hand)
      expect(s.chart.hero).toContain(s.hero)
      expect(s.chart.spot).toBe('rfi')
    }
  })

  it('lists everyone before the hero as folding', () => {
    const s = dealRfi(DEFAULT_CHARTS, ['CO'], 'realistic', seededRng(1))
    expect(s.history).toEqual(['UTG folds', 'UTG+1 folds', 'MP folds', 'LJ folds', 'HJ folds'])
    expect(dealRfi(DEFAULT_CHARTS, ['UTG'], 'realistic', seededRng(1)).history).toEqual([])
  })

  it('is reproducible with a seed', () => {
    const a = dealRfi(DEFAULT_CHARTS, ['UTG', 'BTN'], 'smart', seededRng(77))
    const b = dealRfi(DEFAULT_CHARTS, ['UTG', 'BTN'], 'smart', seededRng(77))
    expect(a).toEqual(b)
  })

  it('throws if no position can open', () => {
    expect(() => dealRfi(DEFAULT_CHARTS, ['BB'], 'smart')).toThrow()
  })
})

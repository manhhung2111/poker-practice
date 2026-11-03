import { describe, expect, it } from 'vitest'
import { findChart } from './charts'
import { dealSpot, edgeHands, fourBetSize, pickHand, tableFor, threeBetSize, availableSpots } from './dealing'
import { actsAfter } from './positions'
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

describe('dealSpot: open or fold', () => {
  it('deals only from the chosen positions, never the BB', () => {
    const rng = seededRng(3)
    const seen = new Set<string>()
    for (let i = 0; i < 300; i++) seen.add(dealSpot(DEFAULT_CHARTS, 'rfi', ['CO', 'BTN', 'BB'], 'smart', rng).hero)
    expect(seen).toEqual(new Set(['CO', 'BTN']))
  })

  it('deals two different cards that match the hand class and the right chart', () => {
    const rng = seededRng(11)
    for (let i = 0; i < 500; i++) {
      const s = dealSpot(DEFAULT_CHARTS, 'rfi', ['UTG', 'HJ', 'SB'], 'smart', rng)
      expect(s.cards[0]).not.toBe(s.cards[1])
      expect(handClassOf(s.cards[0], s.cards[1])).toBe(s.hand)
      expect(s.chart.hero).toContain(s.hero)
      expect(s.chart.spot).toBe('rfi')
    }
  })

  it('lists everyone before the hero as folding', () => {
    const s = dealSpot(DEFAULT_CHARTS, 'rfi', ['CO'], 'realistic', seededRng(1))
    expect(s.history).toEqual(['UTG folds', 'UTG+1 folds', 'MP folds', 'LJ folds', 'HJ folds'])
    expect(dealSpot(DEFAULT_CHARTS, 'rfi', ['UTG'], 'realistic', seededRng(1)).history).toEqual([])
  })

  it('is reproducible with a seed', () => {
    const a = dealSpot(DEFAULT_CHARTS, 'rfi', ['UTG', 'BTN'], 'smart', seededRng(77))
    const b = dealSpot(DEFAULT_CHARTS, 'rfi', ['UTG', 'BTN'], 'smart', seededRng(77))
    expect(a).toEqual(b)
  })

  it('throws if no position can open', () => {
    expect(() => dealSpot(DEFAULT_CHARTS, 'rfi', ['BB'], 'smart')).toThrow()
    expect(() => dealSpot(DEFAULT_CHARTS, 'blinds', ['CO'], 'smart')).toThrow()
  })
})

describe('bet sizes', () => {
  it('3-bets 3x in position and 4x out of position', () => {
    expect(threeBetSize('UTG', 'BTN')).toBe(7.5) // in position
    expect(threeBetSize('BTN', 'BB')).toBe(10) // blind is out of position
    expect(threeBetSize('CO', 'SB')).toBe(10)
    expect(threeBetSize('SB', 'BB')).toBe(9) // BB has position on SB; SB opens 3bb
  })

  it('4-bets about 2.2x, rounded to 0.5bb', () => {
    expect(fourBetSize(7.5)).toBe(16.5)
    expect(fourBetSize(10)).toBe(22)
    expect(fourBetSize(9)).toBe(20)
  })
})

describe('tableFor', () => {
  it('facing an open: earlier seats fold, opener raised, later seats still to act', () => {
    const t = tableFor('facing-open', 'CO', 'MP')
    expect(t.history).toEqual(['UTG folds', 'UTG+1 folds', 'MP raises to 2.5bb', 'LJ folds', 'HJ folds'])
    expect(t.seats.MP).toBe('raised')
    expect(t.seats.CO).toBe('hero')
    expect(t.seats.BTN).toBe('waiting')
    expect(t.bets).toEqual({ SB: 0.5, BB: 1, MP: 2.5 })
    expect(t.sizes).toEqual({ call: 2.5, raise: 7.5 })
  })

  it('blinds defense: BB vs SB open uses 3bb and an in-position 3-bet', () => {
    const t = tableFor('blinds', 'BB', 'SB')
    expect(t.sizes).toEqual({ call: 3, raise: 9 })
    expect(t.bets.SB).toBe(3)
  })

  it('SB facing a button open 3-bets 4x (out of position)', () => {
    expect(tableFor('blinds', 'SB', 'BTN').sizes).toEqual({ call: 2.5, raise: 10 })
  })

  it('facing a 3-bet: hero opened, villain 3-bet, everyone else folded', () => {
    const t = tableFor('facing-3bet', 'CO', 'BB')
    expect(t.history).toEqual([
      'UTG folds', 'UTG+1 folds', 'MP folds', 'LJ folds', 'HJ folds',
      'You raise to 2.5bb', 'BTN folds', 'SB folds', 'BB 3-bets to 10bb',
    ])
    expect(t.bets.CO).toBe(2.5)
    expect(t.bets.BB).toBe(10)
    expect(t.sizes).toEqual({ call: 10, raise: 22 })
  })
})

describe('dealSpot: all spot types', () => {
  it('offers only spots that fit the chosen positions', () => {
    expect(availableSpots('mixed', ['BB'])).toEqual(['blinds'])
    expect(availableSpots('mixed', ['UTG'])).toEqual(['rfi', 'facing-3bet'])
    expect(availableSpots('facing-open', ['SB', 'BB'])).toEqual([])
  })

  it('always deals a consistent spot with a matching chart', () => {
    const rng = seededRng(21)
    const all = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
    const seenTypes = new Set<string>()
    for (let i = 0; i < 2000; i++) {
      const s = dealSpot(DEFAULT_CHARTS, 'mixed', all, 'smart', rng)
      seenTypes.add(s.type)
      expect(s.chart.hero).toContain(s.hero)
      expect(handClassOf(s.cards[0], s.cards[1])).toBe(s.hand)
      if (s.type === 'rfi') expect(s.villain).toBeUndefined()
      if (s.type === 'facing-open' || s.type === 'blinds') {
        expect(actsAfter(s.hero, s.villain!)).toBe(true)
        expect(s.chart.spot).toBe('facing-open')
        expect(s.chart.villain).toContain(s.villain)
      }
      if (s.type === 'blinds') expect(['SB', 'BB']).toContain(s.hero)
      if (s.type === 'facing-open') expect(['SB', 'BB', 'UTG']).not.toContain(s.hero)
      if (s.type === 'facing-3bet') {
        expect(actsAfter(s.villain!, s.hero)).toBe(true)
        expect(s.chart.villain).toContain(s.villain)
      }
    }
    expect(seenTypes).toEqual(new Set(['rfi', 'facing-open', 'blinds', 'facing-3bet']))
  })
})

import { describe, expect, it } from 'vitest'
import { makeDeck } from './cards'
import {
  ALL_HANDS,
  TOTAL_COMBOS,
  comboCount,
  combos,
  gridPosition,
  handAt,
  handCategory,
  handClassOf,
  isHandClass,
} from './hands'

describe('hand classes', () => {
  it('has 169 unique hand classes: 13 pairs, 78 suited, 78 offsuit', () => {
    expect(ALL_HANDS).toHaveLength(169)
    expect(new Set(ALL_HANDS).size).toBe(169)
    expect(ALL_HANDS.filter((h) => h.length === 2)).toHaveLength(13)
    expect(ALL_HANDS.filter((h) => h.endsWith('s'))).toHaveLength(78)
    expect(ALL_HANDS.filter((h) => h.endsWith('o'))).toHaveLength(78)
  })

  it('lays out the grid like a standard chart', () => {
    expect(handAt(0, 0)).toBe('AA')
    expect(handAt(0, 1)).toBe('AKs') // upper-right = suited
    expect(handAt(1, 0)).toBe('AKo') // lower-left = offsuit
    expect(handAt(12, 12)).toBe('22')
    expect(handAt(11, 12)).toBe('32s')
    expect(handAt(12, 11)).toBe('32o')
  })

  it('gridPosition is the inverse of handAt', () => {
    for (let r = 0; r < 13; r++) {
      for (let c = 0; c < 13; c++) expect(gridPosition(handAt(r, c))).toEqual({ row: r, col: c })
    }
  })

  it('counts combos: pairs 6, suited 4, offsuit 12, total 1326', () => {
    expect(comboCount('AA')).toBe(6)
    expect(comboCount('AKs')).toBe(4)
    expect(comboCount('AKo')).toBe(12)
    expect(ALL_HANDS.reduce((n, h) => n + comboCount(h), 0)).toBe(TOTAL_COMBOS)
  })

  it('enumerates concrete combos that map back to their class', () => {
    let total = 0
    const seen = new Set<string>()
    for (const h of ALL_HANDS) {
      const cs = combos(h)
      expect(cs).toHaveLength(comboCount(h))
      for (const [a, b] of cs) {
        expect(handClassOf(a, b)).toBe(h)
        seen.add([a, b].sort().join())
      }
      total += cs.length
    }
    expect(total).toBe(1326)
    expect(seen.size).toBe(1326)
  })

  it('maps every pair of real cards to a valid class', () => {
    const deck = makeDeck()
    for (const a of deck) for (const b of deck) if (a !== b) expect(isHandClass(handClassOf(a, b))).toBe(true)
  })

  it('classifies two cards regardless of order', () => {
    expect(handClassOf('Kd', 'As')).toBe('AKo')
    expect(handClassOf('Ks', 'As')).toBe('AKs')
    expect(handClassOf('7h', '7c')).toBe('77')
    expect(handClassOf('2c', 'Tc')).toBe('T2s')
    expect(() => handClassOf('As', 'As')).toThrow()
  })

  it('rejects invalid hand classes', () => {
    for (const bad of ['KA', 'AKx', 'AAs', 'A', '', 'AKss']) expect(isHandClass(bad)).toBe(false)
  })

  it('assigns categories', () => {
    expect(handCategory('KK')).toBe('premium-pair')
    expect(handCategory('JJ')).toBe('high-pair')
    expect(handCategory('77')).toBe('mid-pair')
    expect(handCategory('22')).toBe('low-pair')
    expect(handCategory('A5s')).toBe('suited-ace')
    expect(handCategory('AKo')).toBe('offsuit-ace')
    expect(handCategory('KQs')).toBe('suited-broadway')
    expect(handCategory('QTo')).toBe('offsuit-broadway')
    expect(handCategory('98s')).toBe('suited-connector')
    expect(handCategory('86s')).toBe('suited-gapper')
    expect(handCategory('K4s')).toBe('suited-other')
    expect(handCategory('98o')).toBe('offsuit-connector')
    expect(handCategory('72o')).toBe('offsuit-other')
  })
})

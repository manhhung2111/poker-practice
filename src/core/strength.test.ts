import { describe, expect, it } from 'vitest'
import { ALL_HANDS } from './hands'
import { HANDS_BY_STRENGTH, chenScore, strengthRank, topPercent } from './strength'

describe('Chen score', () => {
  it('matches known Chen formula values', () => {
    expect(chenScore('AA')).toBe(20)
    expect(chenScore('KK')).toBe(16)
    expect(chenScore('TT')).toBe(10)
    expect(chenScore('55')).toBe(5)
    expect(chenScore('22')).toBe(5) // minimum 5 for pairs
    expect(chenScore('AKs')).toBe(12)
    expect(chenScore('AKo')).toBe(10)
    expect(chenScore('KQs')).toBe(10) // no straight bonus: K is not below Q
    expect(chenScore('JTs')).toBe(9) // 6 + 2 suited + 1 bonus
    expect(chenScore('A5s')).toBe(7) // 10 + 2 − 5 (gap 8)
    expect(chenScore('76s')).toBe(6.5) // 3.5 + 2 + 1
    expect(chenScore('72o')).toBe(-1.5) // 3.5 − 5
  })
})

describe('strength ranking', () => {
  it('ranks all 169 hands exactly once', () => {
    expect(HANDS_BY_STRENGTH).toHaveLength(169)
    expect(new Set(HANDS_BY_STRENGTH)).toEqual(new Set(ALL_HANDS))
  })

  it('puts premium hands at the top and 72o at the bottom', () => {
    expect(HANDS_BY_STRENGTH.slice(0, 5)).toEqual(['AA', 'KK', 'QQ', 'JJ', 'AKs'])
    expect(strengthRank('AA')).toBe(1)
    expect(strengthRank('72o')).toBe(169)
  })

  it('follows common-sense orderings', () => {
    const stronger = (a: string, b: string) => expect(strengthRank(a), `${a} > ${b}`).toBeLessThan(strengthRank(b))
    stronger('AKs', 'AKo')
    stronger('AKo', 'KQs')
    stronger('TT', '99')
    stronger('KQs', 'K2s')
    stronger('JTs', 'J9s')
    stronger('76s', 'K2o')
    stronger('ATs', 'ATo')
    for (const h of ALL_HANDS) {
      if (h.endsWith('o')) stronger(h.slice(0, 2) + 's', h) // suited always beats offsuit twin
    }
  })

  it('topPercent rises monotonically from AA (~0.45%) to 100%', () => {
    expect(topPercent('AA')).toBeCloseTo(6 / 1326)
    expect(topPercent(HANDS_BY_STRENGTH[168])).toBe(1)
    for (let i = 1; i < 169; i++) {
      expect(topPercent(HANDS_BY_STRENGTH[i])).toBeGreaterThan(topPercent(HANDS_BY_STRENGTH[i - 1]))
    }
  })

  it('throws for invalid hands', () => {
    expect(() => strengthRank('KA')).toThrow()
    expect(() => topPercent('XX')).toThrow()
  })
})

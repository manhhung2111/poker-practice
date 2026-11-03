import { describe, expect, it } from 'vitest'
import { ALL_HANDS } from './hands'
import { RangeParseError, formatRange, parseRange, sortHands } from './rangeParser'
import { seededRng } from './random'

const parse = (s: string) => sortHands(parseRange(s))

describe('parseRange', () => {
  it('parses single hands', () => {
    expect(parse('AA')).toEqual(['AA'])
    expect(parse('AKs')).toEqual(['AKs'])
    expect(parse('AKo')).toEqual(['AKo'])
  })

  it('treats a hand without suffix as both suited and offsuit', () => {
    expect(parse('AK')).toEqual(['AKs', 'AKo'])
  })

  it('accepts reversed rank order', () => {
    expect(parse('KAs')).toEqual(['AKs'])
  })

  it('parses pair plus notation', () => {
    expect(parse('QQ+')).toEqual(['AA', 'KK', 'QQ'])
    expect(parse('22+')).toHaveLength(13)
    expect(parse('AA+')).toEqual(['AA'])
  })

  it('parses kicker plus notation', () => {
    expect(parse('ATs+')).toEqual(['AKs', 'AQs', 'AJs', 'ATs'])
    expect(parse('KTo+')).toEqual(['KQo', 'KJo', 'KTo'])
    expect(parse('A2s+')).toHaveLength(12)
    expect(parse('QJ+')).toEqual(['QJs', 'QJo'])
    expect(parse('T9s+')).toEqual(['T9s'])
  })

  it('parses dash ranges in either order', () => {
    expect(parse('99-66')).toEqual(['99', '88', '77', '66'])
    expect(parse('66-99')).toEqual(['99', '88', '77', '66'])
    expect(parse('KTo-K8o')).toEqual(['KTo', 'K9o', 'K8o'])
    expect(parse('K8o-KTo')).toEqual(['KTo', 'K9o', 'K8o'])
    expect(parse('A5s-A2s')).toEqual(['A5s', 'A4s', 'A3s', 'A2s'])
    expect(parse('KT-K9')).toEqual(['KTs', 'K9s', 'KTo', 'K9o'])
  })

  it('combines tokens separated by commas and/or spaces, ignoring duplicates', () => {
    expect(parse('AA, KK  QQ,,AA')).toEqual(['AA', 'KK', 'QQ'])
    expect(parse('')).toEqual([])
    expect(parse('  ')).toEqual([])
  })

  it('parses a realistic opening range', () => {
    const r = parseRange('22+, A2s+, K9s+, Q9s+, J9s+, T9s, 98s, 87s, ATo+, KJo+, QJo')
    expect(r.has('55')).toBe(true)
    expect(r.has('A3s')).toBe(true)
    expect(r.has('K8s')).toBe(false)
    expect(r.has('QJo')).toBe(true)
    expect(r.has('A9o')).toBe(false)
    expect(r.size).toBe(13 + 12 + 4 + 3 + 2 + 3 + 4 + 2 + 1)
  })

  it('rejects invalid tokens with a helpful error', () => {
    const bad = ['AX', 'AAs', 'AKz', 'AK-QJ', 'AKs-AQo', '99-AK', 'A', 'AKQ', 'AK-QJ-T9', 'ak']
    for (const b of bad) {
      expect(() => parseRange(b), b).toThrow(RangeParseError)
    }
    expect(() => parseRange('AA, KX')).toThrow(/KX/)
  })
})

describe('formatRange', () => {
  it('formats compactly', () => {
    expect(formatRange(parseRange('22+'))).toBe('22+')
    expect(formatRange(parseRange('AA'))).toBe('AA')
    expect(formatRange(parseRange('QQ-99'))).toBe('QQ-99')
    expect(formatRange(parseRange('ATs+'))).toBe('ATs+')
    expect(formatRange(parseRange('KTo-K8o'))).toBe('KTo-K8o')
    expect(formatRange(parseRange('AK'))).toBe('AKs, AKo')
    expect(formatRange([])).toBe('')
  })

  it('round-trips random ranges exactly', () => {
    const rng = seededRng(123)
    for (let i = 0; i < 300; i++) {
      const density = rng()
      const hands = ALL_HANDS.filter(() => rng() < density)
      const text = formatRange(hands)
      expect(sortHands(parseRange(text))).toEqual(sortHands(hands))
    }
  })

  it('formats the full range', () => {
    expect(parseRange(formatRange(ALL_HANDS)).size).toBe(169)
  })
})

import { describe, expect, it } from 'vitest'
import { cardLabel, makeDeck, parseCard, rankValue, shuffle } from './cards'
import { seededRng } from './random'

describe('cards', () => {
  it('builds a 52-card deck with no duplicates', () => {
    const deck = makeDeck()
    expect(deck).toHaveLength(52)
    expect(new Set(deck).size).toBe(52)
  })

  it('ranks A highest and 2 lowest', () => {
    expect(rankValue('A')).toBe(14)
    expect(rankValue('T')).toBe(10)
    expect(rankValue('2')).toBe(2)
  })

  it('parses valid cards and rejects invalid ones', () => {
    expect(parseCard('As')).toBe('As')
    expect(parseCard('Td')).toBe('Td')
    for (const bad of ['', 'A', 'Ax', '1s', 'AsK', 'as']) {
      expect(() => parseCard(bad)).toThrow()
    }
  })

  it('labels cards for display', () => {
    expect(cardLabel('As')).toBe('A♠')
    expect(cardLabel('Th')).toBe('10♥')
  })

  it('shuffles deterministically with a seed and keeps all cards', () => {
    const deck = makeDeck()
    const a = shuffle(deck, seededRng(42))
    const b = shuffle(deck, seededRng(42))
    const c = shuffle(deck, seededRng(7))
    expect(a).toEqual(b)
    expect(a).not.toEqual(c)
    expect(a).not.toEqual(deck)
    expect([...a].sort()).toEqual([...deck].sort())
  })

  it('shuffle is roughly uniform', () => {
    // Count how often the ace of spades lands in the first slot.
    const rng = seededRng(1)
    const deck = makeDeck()
    const trials = 52_000
    let hits = 0
    for (let i = 0; i < trials; i++) if (shuffle(deck, rng)[0] === 'As') hits++
    expect(hits).toBeGreaterThan(800) // expected 1000
    expect(hits).toBeLessThan(1200)
  })
})

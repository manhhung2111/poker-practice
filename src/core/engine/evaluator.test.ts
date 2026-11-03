import { describe as group, expect, it } from 'vitest'
import { type Card, makeDeck } from '../cards'
import { CATEGORIES, categoryOf, describe, evaluate } from './evaluator'

const h = (s: string) => s.split(' ') as Card[]
const score = (s: string) => evaluate(h(s))

group('evaluate', () => {
  it('counts every 5-card hand exactly (2,598,960 hands)', () => {
    const deck = makeDeck()
    const counts = Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<string, number>
    const hand: Card[] = new Array(5)
    for (let a = 0; a < 52; a++)
      for (let b = a + 1; b < 52; b++)
        for (let c = b + 1; c < 52; c++)
          for (let d = c + 1; d < 52; d++)
            for (let e = d + 1; e < 52; e++) {
              hand[0] = deck[a]
              hand[1] = deck[b]
              hand[2] = deck[c]
              hand[3] = deck[d]
              hand[4] = deck[e]
              counts[categoryOf(evaluate(hand))]++
            }
    expect(counts).toEqual({
      'High card': 1302540,
      Pair: 1098240,
      'Two pair': 123552,
      'Three of a kind': 54912,
      Straight: 10200,
      Flush: 5108,
      'Full house': 3744,
      'Four of a kind': 624,
      'Straight flush': 40,
    })
  }, 60_000)

  it('orders categories correctly', () => {
    const ordered = [
      'Ah Kd 9c 7s 3h', // high card
      '2h 2d 9c 7s 3h', // pair
      '2h 2d 3c 3s 9h', // two pair
      '2h 2d 2c 7s 9h', // trips
      'Ah 2d 3c 4s 5h', // wheel
      '2h 7h 9h Jh Kh', // flush
      '2h 2d 2c 3s 3h', // full house
      '2h 2d 2c 2s 3h', // quads
      'Ah 2h 3h 4h 5h', // steel wheel
    ].map(score)
    for (let i = 1; i < ordered.length; i++) expect(ordered[i]).toBeGreaterThan(ordered[i - 1])
  })

  it('breaks ties with kickers', () => {
    expect(score('Ah Ad Kc 7s 3h')).toBeGreaterThan(score('Ah Ad Qc 7s 3h'))
    expect(score('Kh Kd 7c 7s Ah')).toBeGreaterThan(score('Kh Kd 7c 7s Qh'))
    expect(score('Kh Kd 7c 7s 2h')).toBeGreaterThan(score('Qh Qd Jc Js Ah'))
    expect(score('Th Jh Qd Kc Ad')).toBeGreaterThan(score('9h Th Jd Qc Kd'))
    expect(score('6h 2d 3c 4s 5h')).toBeGreaterThan(score('Ah 2d 3c 4s 5h')) // 6-high beats the wheel
    expect(score('Ah Kd 9c 7s 3h')).toBe(score('Ad Kc 9h 7d 3s')) // suits don't matter
  })

  it('picks the best 5 of 7', () => {
    expect(categoryOf(score('9h Th Jc Qd Kh 2h 5h'))).toBe('Flush') // flush beats the 9-K straight
    expect(categoryOf(score('Ah Kh 2h 7h 9h 2c 2d'))).toBe('Flush') // flush beats trips
    expect(describe(score('Ah Kh Qh Jh Th 9h 8h'))).toBe('Royal flush')
    expect(describe(score('As Ks Kd Kh 7c 7d Ac'))).toBe('Full house, Kings full of Aces')
    expect(describe(score('2c 3d 4h 5s 9c Kd Ah'))).toBe('Straight, Five high')
    expect(describe(score('Kc Kd 7h 7s 2c 2d Ah'))).toBe('Two pair, Kings and Sevens')
    expect(describe(score('6c 6d 6h Ks 2c'))).toBe('Three Sixes')
    // Three pairs: best two pairs + best kicker (the third pair's rank can be the kicker)
    expect(score('Kc Kd 7h 7s 5c 5d 2h')).toBe(score('Kc Kd 7h 7s 5c 2d 3h'))
  })

  it('counts 7-card split pots: board plays', () => {
    const board = 'Ah Kh Qh Jh Th'
    expect(score(`${board} 2c 3d`)).toBe(score(`${board} 9c 4d`))
  })

  it('describes hands', () => {
    expect(describe(score('Ah Ad Kc 7s 3h'))).toBe('Pair of Aces')
    expect(describe(score('2h 7h 9h Jh Kh'))).toBe('Flush, King high')
    expect(describe(score('9c 9d 9h 9s 2c'))).toBe('Four Nines')
    expect(describe(score('Ah Kd 9c 7s 3h'))).toBe('Ace high')
  })

  it('rejects wrong card counts', () => {
    expect(() => evaluate(h('Ah Kd 9c 7s'))).toThrow()
  })
})

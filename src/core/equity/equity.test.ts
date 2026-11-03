import { describe, expect, it } from 'vitest'
import { type Card, makeDeck, shuffle } from '../cards'
import { DEFAULT_CHARTS } from '../../data/charts'
import { decide } from '../bots/brain'
import { type Decision, type HandState, act, startHand } from '../engine/game'
import { readHand } from '../bots/handRead'
import { evaluate } from '../engine/evaluator'
import { stackDeck } from '../engine/testDeck'
import { seededRng } from '../random'
import { equity } from './equity'
import { cardToInt, evalInts } from './fastEval'
import { ANY_TWO, estimateRange, rangeOf, rangeWidth, replay, topClasses } from './ranges'

const c = (s: string) => s.split(' ') as Card[]
const hand = (s: string) => c(s) as [Card, Card]
const rng = seededRng(42)

describe('fast evaluator', () => {
  it('scores exactly like the engine evaluator', () => {
    const r = seededRng(3)
    for (let i = 0; i < 20000; i++) {
      const cards = shuffle(makeDeck(), r).slice(0, 5 + (i % 3))
      expect(evalInts(cards.map(cardToInt), cards.length)).toBe(evaluate(cards))
    }
  })
})

describe('equity', () => {
  it('matches known preflop matchups', () => {
    const eq = (h: string, v: string) => equity(hand(h), [rangeOf(v)], [], { iterations: 30000, rng }).equity
    expect(eq('As Ah', 'KK')).toBeCloseTo(0.82, 1) // AA vs KK ≈ 82%
    expect(Math.abs(eq('As Ks', 'QQ') - 0.46)).toBeLessThan(0.015) // AKs vs QQ ≈ 46%
    expect(Math.abs(eq('7s 7h', 'AKo') - 0.555)).toBeLessThan(0.015) // classic coin flip
    expect(Math.abs(equity(hand('As Ah'), [ANY_TWO], [], { iterations: 30000, rng }).equity - 0.85)).toBeLessThan(0.015)
  })

  it('is exact heads-up on the turn and river', () => {
    // Set vs flush draw on the turn: 9 hearts left, but 9h and Qh pair the board and
    // give the set a full house, so the draw has 7 outs of 44.
    const r = equity(hand('7c 7d'), [[{ cards: hand('Ah Kh'), weight: 1 }]], c('7h 2h 9s Qc'))
    expect(r.exact).toBe(true)
    expect(r.equity).toBeCloseTo(1 - 7 / 44, 9)
    const river = equity(hand('Ac Ad'), [rangeOf('KK, QQ')], c('2s 5h 9c Td 3s'))
    expect(river.equity).toBe(1)
  })

  it('splits ties', () => {
    // Board is a broadway straight: everyone chops.
    expect(equity(hand('2c 3d'), [rangeOf('44')], c('As Kd Qh Jc Ts')).equity).toBe(0.5)
  })

  it('handles several opponents', () => {
    const three = equity(hand('As Ah'), [ANY_TWO, ANY_TWO, ANY_TWO], [], { iterations: 20000, rng }).equity
    expect(Math.abs(three - 0.64)).toBeLessThan(0.02) // AA vs 3 random hands ≈ 64%
  })

  it('rejects impossible inputs', () => {
    expect(() => equity(hand('As Ah'), [rangeOf('AA')], c('Ad Ac 2s'))).toThrow()
    expect(() => equity(hand('As Ah'), [rangeOf('KK')], c('As 3c 2s'))).toThrow()
  })
})

const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
const table = (holes: Record<number, [Card, Card]>, board: Card[] = []) =>
  startHand({ names, stacks: Array(9).fill(1000), button: 0, deck: stackDeck(9, 0, holes, board) })
const simple = (s: HandState, personality: Parameters<typeof decide>[1]['personality'], r: () => number) =>
  decide(s, { charts: DEFAULT_CHARTS, personality, rng: r })

describe('range estimation', () => {
  it('replays the hand so far', () => {
    let s = table({ 3: hand('As Ad') }, c('Kh 7d 2c 9s 4h'))
    const ds: Decision[] = [{ type: 'raise', to: 25 }, ...Array(7).fill({ type: 'fold' }), { type: 'call' }, { type: 'check' }]
    for (const d of ds) s = act(s, d)
    const h = replay(s)
    expect(h.length).toBe(ds.length)
    expect(h[0].action.type).toBe('raise')
    const last = h[h.length - 1]
    expect(last.before.board).toEqual(c('Kh 7d 2c'))
    const again = act(last.before, { type: 'check' })
    expect({ ...again, deck: [] }).toEqual({ ...s, deck: [] })
  })

  it('reads a UTG open as a tight range and a nit 3-bet as premiums', () => {
    let s = table({})
    s = act(s, { type: 'raise', to: 25 }) // UTG opens
    const open = estimateRange(replay(s), 3, 'regular', simple, { dead: [] })
    expect(rangeWidth(open)).toBeGreaterThan(0.08)
    expect(rangeWidth(open)).toBeLessThan(0.2)
    expect(topClasses(open, 30)).toContain('AA')
    expect(topClasses(open, 30)).not.toContain('72o')

    s = act(s, { type: 'raise', to: 80 }) // UTG+1 (seat 4) 3-bets
    const nit = estimateRange(replay(s), 4, 'nit', simple, { dead: [] })
    expect(rangeWidth(nit)).toBeLessThan(0.05)
    const fish = estimateRange(replay(s), 4, 'maniac', simple, { dead: [] })
    expect(rangeWidth(fish)).toBeGreaterThan(rangeWidth(nit))
  })

  it('narrows a range after a postflop raise', () => {
    let s = table({ 0: hand('Qc Jc'), 2: hand('8h 6h') }, c('Ks 7d 2c 9s 4h'))
    for (let i = 0; i < 6; i++) s = act(s, { type: 'fold' })
    s = act(s, { type: 'raise', to: 25 }) // BTN opens
    s = act(s, { type: 'fold' })
    s = act(s, { type: 'call' }) // BB calls
    const preflop = estimateRange(replay(s), 2, 'regular', simple, { dead: c('Qc Jc') })
    s = act(s, { type: 'check' })
    s = act(s, { type: 'raise', to: 18 }) // BTN c-bets
    s = act(s, { type: 'raise', to: 60 }) // BB check-raises
    const after = estimateRange(replay(s), 2, 'regular', simple, { dead: c('Qc Jc Ks 7d 2c') })
    const board = c('Ks 7d 2c')
    const strong = (r: typeof after) =>
      r
        .filter((x) => !board.includes(x.cards[0]) && !board.includes(x.cards[1]))
        .filter((x) => ['monster', 'strong'].includes(readHand(x.cards, board).made))
        .reduce((a, x) => a + x.weight, 0) / r.reduce((a, x) => a + x.weight, 0)
    expect(strong(after)).toBeGreaterThan(strong(preflop) + 0.1)
  })

  it('is fast enough for the table', () => {
    let s = table({}, c('Ks 7d 2c 9s 4h'))
    for (let i = 0; i < 6; i++) s = act(s, { type: 'fold' })
    s = act(s, { type: 'raise', to: 25 })
    s = act(s, { type: 'fold' })
    s = act(s, { type: 'call' })
    s = act(s, { type: 'check' })
    s = act(s, { type: 'raise', to: 18 })
    const t = performance.now()
    const r = estimateRange(replay(s), 0, 'regular', simple, { dead: s.players[2].hole })
    equity(s.players[2].hole, [r], s.board, { iterations: 2000 })
    expect(performance.now() - t).toBeLessThan(1500)
  })
})

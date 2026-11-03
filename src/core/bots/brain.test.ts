import { describe, expect, it } from 'vitest'
import type { Card } from '../cards'
import { DEFAULT_CHARTS } from '../../data/charts'
import { type Decision, type HandState, act, legalActions, startHand } from '../engine/game'
import { stackDeck } from '../engine/testDeck'
import { seededRng } from '../random'
import { decide, legalize, preflopSituation } from './brain'
import { PERSONALITIES, type Personality } from './personality'

const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
const ctx = (personality: Personality, seed = 1) => ({ charts: DEFAULT_CHARTS, personality, rng: seededRng(seed) })
/** Button on seat 0: SB 1, BB 2, UTG 3 … CO 8. */
const table = (holes: Record<number, [Card, Card]>) =>
  startHand({ names, stacks: Array(9).fill(1000), button: 0, deck: stackDeck(9, 0, holes) })
const fold: Decision = { type: 'fold' }
const play = (s: HandState, ...ds: Decision[]) => ds.reduce(act, s)

describe('regular bots follow the charts preflop', () => {
  it('opens AA from UTG to 2.5bb and folds 72o', () => {
    expect(decide(table({ 3: ['As', 'Ad'] }), ctx('regular'))).toEqual({ type: 'raise', to: 25 })
    expect(decide(table({ 3: ['7s', '2d'] }), ctx('regular'))).toEqual({ type: 'fold' })
  })

  it('defends the BB vs a button open: calls K7s, 3-bets AA to 10bb', () => {
    const toBB = (hole: [Card, Card]) => play(table({ 2: hole }), ...Array(6).fill(fold), { type: 'raise', to: 25 }, fold)
    expect(toBB(['Ks', '7s']).toAct).toBe(2)
    expect(decide(toBB(['Ks', '7s']), ctx('regular'))).toEqual({ type: 'call' })
    expect(decide(toBB(['As', 'Ad']), ctx('regular'))).toEqual({ type: 'raise', to: 100 })
  })

  it('reads the preflop situation', () => {
    const s = play(table({}), { type: 'call' }, { type: 'raise', to: 40 }, { type: 'call' })
    expect(preflopSituation(s)).toEqual({ raises: 1, opener: 4, lastRaiser: 4, limpers: 1, callers: 1 })
  })
})

describe('legalize', () => {
  const legal = { seat: 0, toCall: 0, canCheck: true, callAmount: 0, canRaise: true, minRaiseTo: 10, maxRaiseTo: 500 }
  it('fixes impossible wishes', () => {
    expect(legalize({ type: 'fold' }, legal)).toEqual({ type: 'check' })
    expect(legalize({ type: 'call' }, legal)).toEqual({ type: 'check' })
    expect(legalize({ type: 'raise', to: 3 }, legal)).toEqual({ type: 'raise', to: 10 })
    expect(legalize({ type: 'raise', to: 450 }, legal)).toEqual({ type: 'raise', to: 500 }) // near all-in → shove
    expect(legalize({ type: 'raise', to: 50 }, { ...legal, canRaise: false, canCheck: false, toCall: 20 })).toEqual({ type: 'call' })
  })
})

/** Plays many hands with bots in every seat; returns per-personality preflop stats. */
function simulate(hands: number, seed: number) {
  const rng = seededRng(seed)
  const seats: Personality[] = Array.from({ length: 9 }, (_, i) => PERSONALITIES[i % 4])
  const stats = Object.fromEntries(PERSONALITIES.map((p) => [p, { hands: 0, vpip: 0, pfr: 0 }])) as Record<
    Personality,
    { hands: number; vpip: number; pfr: number }
  >
  let stacks = Array(9).fill(1000)
  let button = 0
  for (let h = 0; h < hands; h++) {
    stacks = stacks.map((c) => (c < 300 ? 1000 : c))
    const before = stacks.reduce((a, b) => a + b, 0)
    let s = startHand({ names, stacks, button, rng })
    let steps = 0
    while (s.toAct !== null) {
      const seat = s.toAct
      const d = decide(s, { charts: DEFAULT_CHARTS, personality: seats[seat], rng })
      expect(() => legalActions(s)).not.toThrow()
      s = act(s, d)
      if (++steps > 300) throw new Error('hand did not end')
    }
    expect(s.players.reduce((a, p) => a + p.stack, 0)).toBe(before)
    for (const p of s.players) {
      const mine = s.actions.filter((a) => a.seat === p.seat && a.street === 'preflop')
      const st = stats[seats[p.seat]]
      st.hands++
      if (mine.some((a) => a.type === 'call' || a.type === 'raise')) st.vpip++
      if (mine.some((a) => a.type === 'raise')) st.pfr++
    }
    stacks = s.players.map((p) => p.stack)
    // Rotate personalities with the button so every style plays every seat.
    seats.unshift(seats.pop()!)
    button = (button + 1) % 9
  }
  return stats
}

describe('bot tables', () => {
  it('play thousands of legal hands, and the personalities really differ', () => {
    const stats = simulate(4000, 7)
    const vpip = (p: Personality) => stats[p].vpip / stats[p].hands
    const pfr = (p: Personality) => stats[p].pfr / stats[p].hands
    expect(vpip('nit')).toBeLessThan(vpip('regular'))
    expect(vpip('regular')).toBeLessThan(vpip('fish'))
    expect(pfr('maniac')).toBeGreaterThan(pfr('regular'))
    expect(pfr('fish')).toBeLessThan(pfr('regular'))
    // Sanity ranges for a 9-max game. Regulars run a bit tight here because two maniacs
    // at the table raise ~35% of hands, so regulars face more raises and fold more.
    expect(vpip('regular')).toBeGreaterThan(0.1)
    expect(vpip('regular')).toBeLessThan(0.3)
    expect(vpip('maniac')).toBeGreaterThan(0.25)
    expect(vpip('fish')).toBeGreaterThan(0.25)
  }, 120_000)
})

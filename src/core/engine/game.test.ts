import { describe, expect, it } from 'vitest'
import type { Card } from '../cards'
import { seededRng } from '../random'
import { type Decision, type HandState, IllegalAction, act, buildPots, legalActions, positionsFor, startHand } from './game'
import { stackDeck } from './testDeck'

const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
const total = (s: HandState) => s.players.reduce((n, p) => n + p.stack + p.committed * (s.result ? 0 : 1), 0)

/** Button on seat 0: SB = 1, BB = 2, UTG = 3 … CO = 8. */
function table(opts: { stacks?: number[]; holes?: Record<number, [Card, Card]>; board?: Card[] } = {}) {
  return startHand({
    names,
    stacks: opts.stacks ?? Array(9).fill(1000),
    button: 0,
    deck: stackDeck(9, 0, opts.holes ?? {}, opts.board ?? []),
  })
}
const play = (s: HandState, ...ds: Decision[]) => ds.reduce(act, s)
const foldN = (n: number): Decision[] => Array(n).fill({ type: 'fold' })

describe('positions', () => {
  it('names seats from the button', () => {
    expect(positionsFor(9)).toEqual(['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO'])
    expect(positionsFor(6)).toEqual(['BTN', 'SB', 'BB', 'LJ', 'HJ', 'CO'])
    expect(() => positionsFor(2)).toThrow()
  })
})

describe('start of a hand', () => {
  it('posts blinds and starts with UTG', () => {
    const s = table()
    expect(s.players[0].position).toBe('BTN')
    expect(s.players[3].position).toBe('UTG')
    expect(s.players[1]).toMatchObject({ stack: 995, bet: 5 })
    expect(s.players[2]).toMatchObject({ stack: 990, bet: 10 })
    expect(s.toAct).toBe(3)
    expect(legalActions(s)).toMatchObject({ toCall: 10, canCheck: false, canRaise: true, minRaiseTo: 20, maxRaiseTo: 1000 })
  })

  it('deals two different cards to everyone', () => {
    const s = startHand({ names, stacks: Array(9).fill(1000), button: 4, rng: seededRng(1) })
    const cards = s.players.flatMap((p) => p.hole)
    expect(new Set(cards).size).toBe(18)
    expect(s.deck).toHaveLength(52 - 18)
  })
})

describe('betting', () => {
  it('gives the pot to the big blind when everyone folds', () => {
    const s = play(table(), ...foldN(8))
    expect(s.result?.reason).toBe('fold')
    expect(s.result?.payouts).toEqual({ 2: 15 })
    expect(s.players[1].stack).toBe(995)
    expect(s.players[2].stack).toBe(1005)
    expect(s.toAct).toBeNull()
  })

  it('enforces the minimum raise', () => {
    let s = play(table(), { type: 'raise', to: 25 }) // UTG opens 2.5bb: a raise of 15
    expect(legalActions(s).minRaiseTo).toBe(40)
    expect(() => act(s, { type: 'raise', to: 30 })).toThrow(IllegalAction)
    s = act(s, { type: 'raise', to: 75 }) // 3-bet: raise of 50
    expect(legalActions(s).minRaiseTo).toBe(125)
  })

  it('gives the big blind the option, then deals the flop with SB first', () => {
    let s = play(table(), ...Array(7).fill({ type: 'call' }), { type: 'call' }) // UTG..BTN (7) call, SB completes
    expect(s.toAct).toBe(2)
    expect(legalActions(s)).toMatchObject({ canCheck: true, canRaise: true })
    s = act(s, { type: 'check' })
    expect(s.street).toBe('flop')
    expect(s.board).toHaveLength(3)
    expect(s.toAct).toBe(1)
    expect(s.currentBet).toBe(0)
    expect(legalActions(s)).toMatchObject({ canCheck: true, minRaiseTo: 10 })
  })

  it('a short all-in does not reopen betting for players who already acted', () => {
    const stacks = Array(9).fill(1000)
    stacks[4] = 40
    let s = play(table({ stacks }), { type: 'raise', to: 30 }, { type: 'raise', to: 40 }) // UTG 30, UTG+1 all-in 40
    expect(s.players[4].allIn).toBe(true)
    // MP has not acted: may raise, minimum is 40 + the last full raise (20).
    expect(legalActions(s)).toMatchObject({ seat: 5, canRaise: true, minRaiseTo: 60 })
    s = play(s, ...foldN(7)) // MP, LJ, HJ, CO, BTN, SB, BB fold
    expect(s.toAct).toBe(3)
    expect(legalActions(s)).toMatchObject({ toCall: 10, canRaise: false })
  })

  it('rejects illegal actions', () => {
    const s = table()
    expect(() => act(s, { type: 'check' })).toThrow(IllegalAction)
    expect(() => act(s, { type: 'raise', to: 2000 })).toThrow(IllegalAction)
    expect(() => act(s, { type: 'raise', to: 15 })).toThrow(IllegalAction)
    const bb = play(s, ...Array(8).fill({ type: 'call' })) // UTG..BTN call, SB completes
    expect(() => act(bb, { type: 'call' })).toThrow(IllegalAction)
  })
})

describe('showdown', () => {
  it('pays the best hand after checking down', () => {
    const holes: Record<number, [Card, Card]> = { 1: ['As', 'Ad'], 2: ['Ks', 'Kd'] }
    let s = play(table({ holes, board: ['2c', '7d', '9h', '4s', 'Jc'] }), ...foldN(7), { type: 'call' }, { type: 'check' })
    for (let i = 0; i < 6; i++) s = act(s, { type: 'check' })
    expect(s.result?.reason).toBe('showdown')
    expect(s.result?.payouts).toEqual({ 1: 20 })
    expect(s.result?.shown).toEqual({ 1: 'Pair of Aces', 2: 'Pair of Kings' })
    expect(s.result?.pots[0].hand).toBe('Pair of Aces')
  })

  it('builds side pots for three all-ins and returns the uncalled excess', () => {
    const stacks = Array(9).fill(1000)
    stacks[3] = 100
    stacks[4] = 300
    const holes: Record<number, [Card, Card]> = { 3: ['As', 'Ad'], 4: ['Ks', 'Kd'], 5: ['Qs', 'Qd'] }
    const s = play(
      table({ stacks, holes, board: ['2c', '7d', '9h', '4s', 'Jc'] }),
      { type: 'raise', to: 100 },
      { type: 'raise', to: 300 },
      { type: 'raise', to: 1000 },
      ...foldN(6), // LJ, HJ, CO, BTN, SB, BB
    )
    expect(s.board).toHaveLength(5)
    expect(s.result?.pots.map((p) => [p.amount, p.eligible, p.winners])).toEqual([
      [315, [3, 4, 5], [3]], // main pot incl. blinds
      [400, [4, 5], [4]],
      [700, [5], [5]], // returned
    ])
    expect(s.players[3].stack).toBe(315)
    expect(s.players[4].stack).toBe(400)
    expect(s.players[5].stack).toBe(700)
  })

  it('splits a pot and gives the odd chip to the first winner left of the button', () => {
    const holes: Record<number, [Card, Card]> = { 2: ['2c', '3d'], 3: ['2d', '3c'] }
    // UTG calls, everyone else folds to the SB who folds (5 dead), BB checks: pot 25.
    let s = play(table({ holes, board: ['Ah', 'Kh', 'Qh', 'Jh', 'Th'] }), { type: 'call' }, ...foldN(7), { type: 'check' })
    for (let i = 0; i < 6; i++) s = act(s, { type: 'check' })
    expect(s.result?.pots[0]).toMatchObject({ amount: 25, winners: [2, 3], hand: 'Royal flush' })
    expect(s.result?.payouts).toEqual({ 2: 13, 3: 12 })
  })
})

describe('buildPots', () => {
  it('merges levels with the same eligible players and counts folded chips', () => {
    const p = (seat: number, committed: number, folded = false) =>
      ({ seat, committed, folded }) as unknown as HandState['players'][number]
    expect(buildPots([p(0, 50, true), p(1, 100), p(2, 100)])).toEqual([{ amount: 250, eligible: [1, 2], winners: [] }])
  })
})

describe('random play', () => {
  it('always ends, never creates or loses chips, and deals a full board at showdown', () => {
    const rng = seededRng(2026)
    let stacks = Array(9).fill(1000)
    let button = 0
    for (let hand = 0; hand < 3000; hand++) {
      stacks = stacks.map((c) => (c < 50 ? 1000 : c)) // rebuy
      const before = stacks.reduce((a, b) => a + b, 0)
      let s = startHand({ names, stacks, button, rng })
      let steps = 0
      while (s.toAct !== null) {
        const l = legalActions(s)
        const r = rng()
        let d: Decision
        if (l.canRaise && r < 0.15) d = { type: 'raise', to: Math.round(l.minRaiseTo + (l.maxRaiseTo - l.minRaiseTo) * rng() * rng()) }
        else if (l.canCheck) d = { type: 'check' }
        else if (r < 0.55) d = { type: 'call' }
        else d = { type: 'fold' }
        s = act(s, d)
        expect(total(s)).toBe(before)
        if (++steps > 200) throw new Error('hand did not end')
      }
      const after = s.players.reduce((a, p) => a + p.stack, 0)
      expect(after).toBe(before)
      if (s.result?.reason === 'showdown') expect(s.board).toHaveLength(5)
      expect(Object.values(s.result!.payouts).every((c) => c > 0)).toBe(true)
      stacks = s.players.map((p) => p.stack)
      button = (button + 1) % 9
    }
  }, 60_000)
})

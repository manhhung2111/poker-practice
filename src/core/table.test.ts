import { describe, expect, it } from 'vitest'
import { DEFAULT_CHARTS } from '../data/charts'
import type { Card } from './cards'
import { type Decision, type HandState, act, startHand } from './engine/game'
import { stackDeck } from './engine/testDeck'
import { seededRng } from './random'
import { BOT_RELOAD_BELOW, START_STACK, finishHand, gradeHeroDecision, heroChartSpot, isTrivialFold, newSession, nextHand } from './table'

const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
/** Button on seat 0: SB 1, BB 2, UTG 3 … CO 8. Hero is the seat we pass. */
const table = (holes: Record<number, [Card, Card]> = {}) =>
  startHand({ names, stacks: Array(9).fill(1000), button: 0, deck: stackDeck(9, 0, holes) })
const fold: Decision = { type: 'fold' }
const play = (s: HandState, ...ds: Decision[]) => ds.reduce(act, s)

describe('table session', () => {
  it('seats you plus 8 bots with every style present', () => {
    const s = newSession(seededRng(3))
    expect(s.seats).toHaveLength(9)
    expect(s.seats[0]).toMatchObject({ name: 'You', personality: null, stack: START_STACK })
    expect(new Set(s.seats.slice(1).map((x) => x.personality))).toEqual(new Set(['nit', 'regular', 'fish', 'maniac']))
    expect(new Set(s.seats.map((x) => x.name)).size).toBe(9)
  })

  it('moves the button, reloads short bots and rebuys you when busted', () => {
    let s = newSession(seededRng(1))
    s = { ...s, seats: s.seats.map((x, i) => (i === 0 ? { ...x, stack: 0 } : i === 1 ? { ...x, stack: BOT_RELOAD_BELOW - 1 } : x)) }
    const { session, hand } = nextHand(s, seededRng(2))
    expect(session.button).toBe((s.button + 1) % 9)
    expect(session.rebuys).toBe(1)
    expect(session.seats[0].stack).toBe(START_STACK)
    expect(session.seats[1].stack).toBe(START_STACK)
    expect(hand.button).toBe(session.button)
  })

  it('tracks your result when a hand finishes', () => {
    const s0 = newSession(seededRng(5))
    const { session, hand } = nextHand({ ...s0, button: 8 }, seededRng(6)) // button → seat 0: you're the BTN
    let h = hand
    while (h.toAct !== null) h = act(h, fold) // everyone folds; BB wins the blinds
    const after = finishHand(session, h)
    expect(after.handsPlayed).toBe(1)
    expect(after.net).toBe(0) // the button posts nothing
    expect(after.seats[2].stack).toBe(START_STACK + 5) // BB won the SB
  })
})

describe('grading your preflop decisions', () => {
  it('grades an open from UTG against the RFI chart', () => {
    const s = table({ 3: ['As', 'Ad'] })
    expect(heroChartSpot(s, 3, DEFAULT_CHARTS)?.chart.id).toBe('rfi/utg')
    expect(gradeHeroDecision(s, 3, { type: 'raise', to: 25 }, DEFAULT_CHARTS)?.grade.correct).toBe(true)
    const g = gradeHeroDecision(s, 3, fold, DEFAULT_CHARTS)!.grade
    expect(g).toMatchObject({ correct: false, severity: 'blunder' })
  })

  it('maps the BB facing a button open to blinds defense', () => {
    const s = play(table({ 2: ['Ks', '7s'] }), ...Array(6).fill(fold), { type: 'raise', to: 25 }, fold)
    const spot = heroChartSpot(s, 2, DEFAULT_CHARTS)!
    expect(spot).toMatchObject({ type: 'blinds', hero: 'BB', villain: 'BTN' })
    expect(spot.chart.id).toBe('facing-open/bb-vs-late')
    expect(gradeHeroDecision(s, 2, { type: 'call' }, DEFAULT_CHARTS)?.grade.correct).toBe(true)
  })

  it('maps facing a 3-bet after your open', () => {
    const s = play(table({ 8: ['Qs', 'Qd'] }), ...Array(5).fill(fold), { type: 'raise', to: 25 }, { type: 'raise', to: 75 }, fold, fold) // SB, BB fold
    expect(s.toAct).toBe(8)
    expect(heroChartSpot(s, 8, DEFAULT_CHARTS)).toMatchObject({ type: 'facing-3bet', hero: 'CO', villain: 'BTN' })
  })

  it("doesn't grade spots the charts don't cover", () => {
    // A limper before you
    expect(heroChartSpot(play(table(), { type: 'call' }), 4, DEFAULT_CHARTS)).toBeNull()
    // A caller of the open before you
    expect(heroChartSpot(play(table(), { type: 'raise', to: 25 }, { type: 'call' }), 5, DEFAULT_CHARTS)).toBeNull()
    // Not your turn
    expect(heroChartSpot(table(), 4, DEFAULT_CHARTS)).toBeNull()
  })

  it('treats 72o from UTG as a trivial fold, but not a borderline hand', () => {
    expect(isTrivialFold(table({ 3: ['7s', '2d'] }), 3, DEFAULT_CHARTS)).toBe(true)
    expect(isTrivialFold(table({ 3: ['Ks', 'Jd'] }), 3, DEFAULT_CHARTS)).toBe(false) // KJo: edge of UTG range
    expect(isTrivialFold(table({ 3: ['As', 'Ad'] }), 3, DEFAULT_CHARTS)).toBe(false)
  })
})

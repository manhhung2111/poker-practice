import { describe, expect, it } from 'vitest'
import type { Card } from './cards'
import { DEFAULT_CHARTS } from '../data/charts'
import { readEquity } from './bots/brain'
import { act, startHand } from './engine/game'
import { stackDeck } from './engine/testDeck'
import { seededRng } from './random'
import { type PostflopSpotInfo, gradePostflop, postflopAction, postflopInfo } from './postflopGrading'

const base: PostflopSpotInfo = {
  street: 'flop',
  canCheck: false,
  canRaise: true,
  equity: 0.4,
  needed: 0.25,
  opponents: 1,
  draw: false,
  made: 'medium',
  wetness: 'medium',
  aggressor: false,
}
const spot = (o: Partial<PostflopSpotInfo>) => ({ ...base, ...o })

describe('facing a bet', () => {
  it('calls when equity beats the price', () => {
    expect(gradePostflop(spot({}), 'call')).toMatchObject({ correct: true, best: 'call' })
    const fold = gradePostflop(spot({}), 'fold')
    expect(fold).toMatchObject({ correct: false, severity: 'blunder' }) // 15 points of equity thrown away
    expect(fold.reason).toContain('40%')
    expect(gradePostflop(spot({ equity: 0.28 }), 'fold').severity).toBe('close')
    expect(gradePostflop(spot({ equity: 0.33 }), 'fold').severity).toBe('clear')
  })

  it('folds when it does not', () => {
    expect(gradePostflop(spot({ equity: 0.2, needed: 0.33 }), 'fold').correct).toBe(true)
    expect(gradePostflop(spot({ equity: 0.2, needed: 0.33 }), 'call')).toMatchObject({ correct: false, severity: 'clear' })
    // Raising with a weak hand is worse than calling.
    expect(gradePostflop(spot({ equity: 0.2, needed: 0.33 }), 'raise')).toMatchObject({ correct: false, severity: 'blunder' })
  })

  it('credits draws with implied odds and allows semi-bluffs heads-up', () => {
    const draw = spot({ equity: 0.3, needed: 0.33, draw: true })
    expect(gradePostflop(draw, 'call').correct).toBe(true)
    expect(gradePostflop(draw, 'raise').correct).toBe(true)
    expect(gradePostflop({ ...draw, opponents: 3 }, 'raise').correct).toBe(false)
  })

  it('raises strong hands for value, and calling them is fine too', () => {
    const strong = spot({ equity: 0.8 })
    expect(gradePostflop(strong, 'raise')).toMatchObject({ correct: true, best: 'raise' })
    expect(gradePostflop(strong, 'call').correct).toBe(true)
    expect(gradePostflop(spot({ equity: 0.5 }), 'raise')).toMatchObject({ correct: false, severity: 'close' })
  })
})

describe('checked to you', () => {
  const open = (o: Partial<PostflopSpotInfo>) => spot({ canCheck: true, needed: null, ...o })

  it('value bets strong hands', () => {
    expect(gradePostflop(open({ equity: 0.7 }), 'bet').correct).toBe(true)
    expect(gradePostflop(open({ equity: 0.65 }), 'check')).toMatchObject({ correct: false, severity: 'close' })
    expect(gradePostflop(open({ equity: 0.65, street: 'river' }), 'check').severity).toBe('clear')
    // Trapping a monster on a dry flop is allowed.
    expect(gradePostflop(open({ equity: 0.9, wetness: 'dry' }), 'check').correct).toBe(true)
  })

  it('suggests bigger bets on wet boards', () => {
    expect(gradePostflop(open({ equity: 0.7, wetness: 'wet' }), 'bet', 0.3).reason).toContain('bet bigger')
  })

  it('allows c-bets, semi-bluffs and heads-up bluffs, but not bets with medium hands', () => {
    expect(gradePostflop(open({ equity: 0.4, aggressor: true, wetness: 'dry' }), 'bet').correct).toBe(true)
    expect(gradePostflop(open({ equity: 0.4, aggressor: true, wetness: 'wet' }), 'bet').correct).toBe(false)
    expect(gradePostflop(open({ equity: 0.35, draw: true }), 'bet').correct).toBe(true)
    expect(gradePostflop(open({ equity: 0.15, street: 'river' }), 'bet').correct).toBe(true)
    expect(gradePostflop(open({ equity: 0.45, street: 'river' }), 'bet')).toMatchObject({ correct: false, severity: 'close' })
  })

  it('warns against bluffing into many players', () => {
    expect(gradePostflop(open({ equity: 0.2, opponents: 3 }), 'bet')).toMatchObject({ correct: false, severity: 'clear' })
    expect(gradePostflop(open({ equity: 0.2, opponents: 3 }), 'check').correct).toBe(true)
  })
})

describe('reading a real spot', () => {
  it('builds the info from a hand', () => {
    const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
    let s = startHand({
      names,
      stacks: Array(9).fill(1000),
      button: 0,
      deck: stackDeck(9, 0, { 0: ['Ah', 'Kh'], 2: ['7c', '7d'] }, ['Qh', '7h', '2c', '9s', '4d'] as Card[]),
    })
    for (let i = 0; i < 6; i++) s = act(s, { type: 'fold' })
    s = act(s, { type: 'raise', to: 25 })
    s = act(s, { type: 'fold' })
    s = act(s, { type: 'call' })
    s = act(s, { type: 'raise', to: 30 }) // BB leads with a set
    const eq = readEquity(s, 0, DEFAULT_CHARTS, ['regular', 'nit', 'regular'], seededRng(1), 1500)
    const info = postflopInfo(s, 0, eq)
    expect(info).toMatchObject({ canCheck: false, draw: true, aggressor: true, opponents: 1 })
    expect(info.needed).toBeCloseTo(30 / 115, 5) // pot 55 + bet 30, plus our call
    expect(postflopAction(s, { type: 'raise', to: 90 })).toEqual({ action: 'raise', fraction: 90 / 85 })
    expect(postflopAction(s, { type: 'call' }).action).toBe('call')
  })
})

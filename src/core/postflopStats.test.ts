import { describe, expect, it } from 'vitest'
import type { HandRecord, HeroDecision } from './handRecord'
import { gradePostflop } from './postflopGrading'
import { postflopStats } from './stats'

const info = { street: 'flop' as const, canCheck: false, canRaise: true, equity: 0.4, needed: 0.25, opponents: 1, draw: false, made: 'medium' as const, wetness: 'dry' as const, aggressor: false }
const dec = (street: HeroDecision['street'], chosen: 'call' | 'fold'): HeroDecision => ({
  street,
  label: chosen,
  situation: '',
  board: [],
  postflop: gradePostflop({ ...info, street: street === 'preflop' ? 'flop' : street }, chosen),
})
const rec = (at: number, decisions: HeroDecision[]) => ({ at, decisions }) as unknown as HandRecord

describe('postflopStats', () => {
  it('tallies by focus and street, newest mistakes first', () => {
    const s = postflopStats([rec(1, [dec('flop', 'call'), dec('turn', 'fold')]), rec(2, [dec('river', 'fold')])])
    expect(s.total).toEqual({ answered: 3, correct: 1 })
    expect(s.byFocus.find((f) => f.key === 'postflop-facing-bet')).toMatchObject({ answered: 3, correct: 1 })
    expect(s.byStreet.map((x) => x.answered)).toEqual([1, 1, 1])
    expect(s.mistakes.map((m) => m.street)).toEqual(['river', 'turn'])
  })
})

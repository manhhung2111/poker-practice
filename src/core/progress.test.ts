import { describe, expect, it } from 'vitest'
import {
  type LessonInfo,
  type ProgressState,
  PASS_WINDOW,
  allowedSeats,
  isPassing,
  isUnlocked,
  parseProgress,
  recordAnswer,
  windowScore,
} from './progress'

const lessons: LessonInfo[] = [
  { id: 'l1', number: 1, title: 'One', drill: { spot: 'rfi', positions: ['CO', 'BTN'] } },
  { id: 'l2', number: 2, title: 'Two', drill: { spot: 'rfi', positions: ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB'] } },
  { id: 'l3', number: 3, title: 'Three', drill: { spot: 'blinds', positions: ['SB', 'BB'] } },
]

const play = (state: ProgressState, n: number, correct: boolean, hero: 'CO' | 'UTG' = 'CO') => {
  let s = state
  const passed: string[] = []
  for (let i = 0; i < n; i++) {
    const r = recordAnswer(s, lessons, 'rfi', hero, correct)
    s = r.state
    passed.push(...r.passed)
  }
  return { state: s, passed }
}

describe('progress', () => {
  it('needs 16 of the last 20', () => {
    expect(isPassing(Array(19).fill(true))).toBe(false)
    expect(isPassing([...Array(4).fill(false), ...Array(16).fill(true)])).toBe(true)
    expect(isPassing([...Array(5).fill(false), ...Array(15).fill(true)])).toBe(false)
    expect(isPassing([...Array(10).fill(false), ...Array(4).fill(false), ...Array(16).fill(true)])).toBe(true)
  })

  it('unlocks lesson 1 only at the start', () => {
    expect(isUnlocked({}, lessons, 'l1')).toBe(true)
    expect(isUnlocked({}, lessons, 'l2')).toBe(false)
    expect(isUnlocked({}, lessons, 'nope')).toBe(false)
  })

  it('passing lesson 1 unlocks lesson 2, and answers then count for both', () => {
    let { state, passed } = play({}, 19, true)
    expect(passed).toEqual([])
    ;({ state, passed } = play(state, 1, true))
    expect(passed).toEqual(['l1'])
    expect(isUnlocked(state, lessons, 'l2')).toBe(true)
    expect(state.l2).toBeUndefined() // lesson 2 was locked during those answers
    ;({ state } = play(state, 3, false))
    expect(state.l1.passed).toBe(true) // stays passed
    expect(windowScore(state.l2.recent)).toEqual({ correct: 0, played: 3 })
  })

  it('ignores answers from seats outside the lesson drill', () => {
    const { state } = play({}, 25, true, 'UTG')
    expect(state.l1).toBeUndefined()
  })

  it('keeps only the last 20 results', () => {
    const { state } = play({}, 50, false)
    expect(state.l1.recent).toHaveLength(PASS_WINDOW)
  })

  it('computes allowed seats from unlocked lessons', () => {
    expect(allowedSeats({}, lessons)).toEqual({ rfi: ['CO', 'BTN'], 'facing-open': [], blinds: [], 'facing-3bet': [] })
    const done = { l1: { recent: [], passed: true }, l2: { recent: [], passed: true } }
    const a = allowedSeats(done, lessons)
    expect(a.rfi).toHaveLength(8)
    expect(a.blinds).toEqual(['SB', 'BB'])
    expect(allowedSeats({}, lessons, true)['facing-3bet']).toHaveLength(8)
  })

  it('parses saved progress defensively', () => {
    expect(parseProgress(null)).toEqual({})
    expect(parseProgress({ a: { recent: [true, 'x', false], passed: true }, b: 5 })).toEqual({
      a: { recent: [true, false], passed: true },
    })
  })
})

describe('table lessons (postflop)', () => {
  const withTable: LessonInfo[] = [
    ...lessons,
    { id: 'l4', number: 4, title: 'Four', drill: { spot: 'postflop-facing-bet', positions: ['UTG', 'CO', 'BTN', 'BB'] } },
  ]
  const passedAll: ProgressState = { l1: { recent: [], passed: true }, l2: { recent: [], passed: true }, l3: { recent: [], passed: true } }

  it('count postflop decisions once unlocked', () => {
    let s = passedAll
    const passed: string[] = []
    for (let i = 0; i < PASS_WINDOW; i++) {
      const r = recordAnswer(s, withTable, 'postflop-facing-bet', 'BTN', true)
      s = r.state
      passed.push(...r.passed)
    }
    expect(passed).toEqual(['l4'])
    // Locked lessons don't count.
    expect(recordAnswer({}, withTable, 'postflop-facing-bet', 'BTN', true).state.l4).toBeUndefined()
  })

  it('do not add drill seats', () => {
    expect(allowedSeats(passedAll, withTable).rfi).toEqual(allowedSeats(passedAll, lessons).rfi)
  })
})

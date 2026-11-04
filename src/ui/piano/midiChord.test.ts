import { describe, expect, it } from 'vitest'
import { EMPTY_ATTEMPT, addPress, complete } from './midiChord'

describe('MIDI chord attempts', () => {
  it('completes at three different keys and ignores repeats', () => {
    let a = addPress(EMPTY_ATTEMPT, 60, 0)
    a = addPress(a, 60, 100)
    a = addPress(a, 64, 200)
    expect(complete(a)).toBe(false)
    a = addPress(a, 67, 300)
    expect(complete(a)).toBe(true)
    expect(a.keys).toEqual([60, 64, 67])
  })

  it('starts fresh after a gap longer than 1.5 s', () => {
    let a = addPress(EMPTY_ATTEMPT, 60, 0)
    a = addPress(a, 64, 1000)
    a = addPress(a, 67, 2600)
    expect(a.keys).toEqual([67])
    a = addPress(a, 71, 4000)
    expect(a.keys).toEqual([67, 71])
  })

  it('starts fresh after a completed attempt', () => {
    let a = addPress(addPress(addPress(EMPTY_ATTEMPT, 60, 0), 64, 10), 67, 20)
    a = addPress(a, 72, 30)
    expect(a.keys).toEqual([72])
  })
})

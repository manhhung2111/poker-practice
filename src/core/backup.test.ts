import { describe, expect, it } from 'vitest'
import { BackupError, makeBackup, parseBackup } from './backup'
import { entry } from './testLog'

describe('backup', () => {
  it('round-trips answers and progress', () => {
    const data = { answers: [entry({ at: 2 }), entry({ at: 1, villain: undefined })], progress: { positions: { recent: [true], passed: false } } }
    const back = parseBackup(makeBackup(data))
    expect(back.answers.map((a) => a.at)).toEqual([1, 2]) // sorted by time
    expect(back.progress).toEqual(data.progress)
    expect(back.skipped).toBe(0)
  })

  it('skips malformed entries and counts them', () => {
    const text = JSON.stringify({ app: 'poker-practice-trainer', version: 1, answers: [entry(), { at: 'x' }, { ...entry(), hero: 'XX' }], progress: {} })
    const back = parseBackup(text)
    expect(back.answers).toHaveLength(1)
    expect(back.skipped).toBe(2)
  })

  it('rejects non-backups with clear messages', () => {
    expect(() => parseBackup('hello')).toThrow(BackupError)
    expect(() => parseBackup('{"app":"other"}')).toThrow(/isn't a Poker Trainer backup/)
    expect(() => parseBackup('{"app":"poker-practice-trainer","version":99}')).toThrow(/newer version/)
  })
})

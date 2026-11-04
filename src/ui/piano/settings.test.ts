// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest'
import { DEFAULT_PIANO_SETTINGS, loadPianoSettings, savePianoSettings, sessionLength } from './settings'

const KEY = 'piano:settings'

beforeEach(() => localStorage.clear())

describe('piano settings', () => {
  it('loads settings saved before drill modes existed', () => {
    localStorage.setItem(KEY, JSON.stringify({ hand: 'left', level: 'ledger', accidentals: true, labels: false, length: 50, midi: false }))
    const s = loadPianoSettings()
    expect(s.mode).toBe('single')
    expect(s.hand).toBe('left')
    expect(s.lengths).toEqual({ single: 50, row: 10, chord: 20 })
    expect(sessionLength(s)).toBe(50)
  })

  it('falls back on invalid lengths and modes', () => {
    localStorage.setItem(KEY, JSON.stringify({ mode: 'karaoke', lengths: { single: 20, row: 7, chord: 0 } }))
    const s = loadPianoSettings()
    expect(s.mode).toBe('single')
    expect(s.lengths).toEqual({ single: 20, row: 10, chord: 0 })
  })

  it('round-trips a chosen mode with its own length', () => {
    savePianoSettings({ ...DEFAULT_PIANO_SETTINGS, mode: 'chord', lengths: { single: 20, row: 5, chord: 10 } })
    const s = loadPianoSettings()
    expect(s.mode).toBe('chord')
    expect(sessionLength(s)).toBe(10)
  })
})

import { describe, expect, it } from 'vitest'
import type { Prompt } from './notes'
import { noteWeight, parsePianoStats, recordNote, summarize, weakest } from './stats'

const c4: Prompt = { clef: 'treble', note: { letter: 0, octave: 4, acc: 0 } }
const g2: Prompt = { clef: 'bass', note: { letter: 4, octave: 2, acc: 0 } }

describe('piano stats', () => {
  it('records answers and caps long pauses', () => {
    let s = recordNote({}, c4, true, 1000)
    s = recordNote(s, c4, false, 60000)
    expect(s['treble:C4']).toEqual({ n: 2, correct: 1, ms: 16000 })
  })

  it('missed notes weigh more than known ones', () => {
    let s = {}
    for (let i = 0; i < 5; i++) s = recordNote(s, c4, true, 800)
    for (let i = 0; i < 5; i++) s = recordNote(s, g2, false, 800)
    expect(noteWeight(s, g2)).toBeGreaterThan(noteWeight(s, c4) * 3)
  })

  it('summarizes by clef', () => {
    let s = recordNote({}, c4, true, 1000)
    s = recordNote(s, g2, false, 3000)
    expect(summarize(s)).toEqual({ n: 2, correct: 1, avgMs: 2000 })
    expect(summarize(s, (k) => k.startsWith('bass:'))).toEqual({ n: 1, correct: 0, avgMs: 3000 })
  })

  it('lists weakest notes first', () => {
    let s = {}
    for (let i = 0; i < 4; i++) s = recordNote(s, c4, i > 0, 900)
    for (let i = 0; i < 4; i++) s = recordNote(s, g2, false, 900)
    expect(weakest(s).map((w) => w.key)).toEqual(['bass:G2', 'treble:C4'])
  })

  it('parses stored data and drops junk', () => {
    expect(parsePianoStats({ 'treble:C4': { n: 2, correct: 1, ms: 100 }, 'x:C4': { n: 1, correct: 1, ms: 1 }, 'bass:G2': { n: 1, correct: 3, ms: 1 } })).toEqual({
      'treble:C4': { n: 2, correct: 1, ms: 100 },
    })
    expect(parsePianoStats(null)).toEqual({})
  })
})

import { describe, expect, it } from 'vitest'
import { seededRng } from '../random'
import {
  CHORD_ROOTS,
  type Chord,
  type Quality,
  chordKey,
  chordName,
  chordPool,
  isChordCorrectMidi,
  isChordCorrectOnScreen,
  pickChord,
  spellTriad,
} from './chords'
import { type Note, LEVEL_STEPS, letterName, midi, staffStep } from './notes'

const n = (letter: number, octave: number, acc: Note['acc'] = 0): Note => ({ letter, octave, acc })
const names = (root: Note, q: Quality) => spellTriad(root, q).map(letterName)
const C = 0, D = 1, E = 2, F = 3, G = 4, A = 5, B = 6

describe('spellTriad', () => {
  it('spells common triads', () => {
    expect(names(n(C, 4), 'major')).toEqual(['C', 'E', 'G'])
    expect(names(n(D, 4), 'major')).toEqual(['D', 'F♯', 'A'])
    expect(names(n(E, 4, -1), 'major')).toEqual(['E♭', 'G', 'B♭'])
    expect(names(n(C, 4, 1), 'minor')).toEqual(['C♯', 'E', 'G♯'])
    expect(names(n(G, 4, 1), 'minor')).toEqual(['G♯', 'B', 'D♯'])
    expect(names(n(B, 4, -1), 'minor')).toEqual(['B♭', 'D♭', 'F'])
    expect(names(n(F, 4, 1), 'major')).toEqual(['F♯', 'A♯', 'C♯'])
  })

  it('carries the octave up across B→C', () => {
    expect(spellTriad(n(A, 4), 'minor').map((x) => x.octave)).toEqual([4, 5, 5])
  })

  it('every listed chord uses single valid accidentals and the right gaps', () => {
    const bad = new Set(['E♯', 'B♯', 'C♭', 'F♭'])
    for (const q of ['major', 'minor'] as Quality[]) {
      for (const r of CHORD_ROOTS[q]) {
        const notes = spellTriad(n(r.letter, 4, r.acc), q)
        for (const x of notes) {
          expect(Math.abs(x.acc)).toBeLessThanOrEqual(1)
          expect(bad.has(letterName(x))).toBe(false)
        }
        const m = notes.map(midi)
        expect([m[1] - m[0], m[2] - m[1]]).toEqual(q === 'major' ? [4, 3] : [3, 4])
      }
    }
  })

  it('has 12 roots per quality with the fixed spellings', () => {
    const roots = (q: Quality) => CHORD_ROOTS[q].map((r) => letterName(n(r.letter, 4, r.acc)))
    expect(roots('major')).toEqual(['C', 'D♭', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'A♭', 'A', 'B♭', 'B'])
    expect(roots('minor')).toEqual(['C', 'C♯', 'D', 'E♭', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'B♭', 'B'])
  })
})

describe('chordPool', () => {
  it('without sharps and flats offers only the six natural chords', () => {
    const got = new Set(chordPool('both', 'wide', false).map(chordName))
    expect(got).toEqual(new Set(['C major', 'F major', 'G major', 'D minor', 'E minor', 'A minor']))
  })

  it('widens the range by one ledger line, so the default setup has C major', () => {
    const pool = chordPool('right', 'staff', false)
    const keys = pool.map(chordKey)
    expect(keys).toContain('treble:C major')
    expect(pool.find((c) => chordKey(c) === 'treble:C major')!.notes[0]).toEqual(n(C, 4))
    expect(pool.some((c) => chordKey(c) === 'treble:D minor' && c.notes[2].letter === A && c.notes[2].octave === 5)).toBe(true)
    for (const c of pool) for (const x of c.notes) {
      const s = staffStep(x, c.clef)
      expect(s).toBeGreaterThanOrEqual(LEVEL_STEPS.staff[0] - 2)
      expect(s).toBeLessThanOrEqual(LEVEL_STEPS.staff[1] + 2)
    }
  })

  it('is never empty', () => {
    for (const hand of ['right', 'left', 'both'] as const)
      for (const level of ['staff', 'ledger', 'wide'] as const)
        for (const acc of [false, true]) expect(chordPool(hand, level, acc).length).toBeGreaterThan(0)
  })

  it('uses the clefs of the chosen hand', () => {
    expect(new Set(chordPool('left', 'ledger', true).map((c) => c.clef))).toEqual(new Set(['bass']))
    expect(new Set(chordPool('both', 'ledger', true).map((c) => c.clef))).toEqual(new Set(['treble', 'bass']))
  })
})

describe('grading', () => {
  const cMajor: Chord = { clef: 'treble', quality: 'major', notes: [n(C, 4), n(E, 4), n(G, 4)] }

  it('on screen compares pitch classes as a set', () => {
    expect(isChordCorrectOnScreen(cMajor, new Set([7, 0, 4]))).toBe(true)
    expect(isChordCorrectOnScreen(cMajor, new Set([0, 4]))).toBe(false)
    expect(isChordCorrectOnScreen(cMajor, new Set([0, 4, 7, 9]))).toBe(false)
  })

  it('on MIDI needs the exact keys', () => {
    expect(isChordCorrectMidi(cMajor, [64, 60, 67])).toBe(true)
    expect(isChordCorrectMidi(cMajor, [72, 64, 67])).toBe(false)
  })

  it('names chords', () => {
    expect(chordName(cMajor)).toBe('C major')
    expect(chordKey(cMajor)).toBe('treble:C major')
  })
})

describe('pickChord', () => {
  it('never repeats the previous chord', () => {
    const pool = chordPool('both', 'ledger', true)
    const rng = seededRng(11)
    let last = pickChord(pool, null, undefined, rng)
    for (let i = 0; i < 300; i++) {
      const next = pickChord(pool, last, undefined, rng)
      expect(chordKey(next)).not.toBe(chordKey(last))
      last = next
    }
  })
})

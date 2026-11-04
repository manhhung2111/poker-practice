import { describe, expect, it } from 'vitest'
import { seededRng } from '../random'
import {
  type Note,
  isCorrect,
  ledgerSteps,
  midi,
  noteName,
  pickPrompt,
  promptKey,
  promptPool,
  staffStep,
} from './notes'

const n = (letter: number, octave: number, acc: Note['acc'] = 0): Note => ({ letter, octave, acc })
const C = 0, D = 1, E = 2, F = 3, G = 4, A = 5, B = 6

describe('staff positions', () => {
  it('treble lines are E4 G4 B4 D5 F5', () => {
    expect([n(E, 4), n(G, 4), n(B, 4), n(D, 5), n(F, 5)].map((x) => staffStep(x, 'treble'))).toEqual([0, 2, 4, 6, 8])
  })

  it('bass lines are G2 B2 D3 F3 A3', () => {
    expect([n(G, 2), n(B, 2), n(D, 3), n(F, 3), n(A, 3)].map((x) => staffStep(x, 'bass'))).toEqual([0, 2, 4, 6, 8])
  })

  it('middle C sits on one ledger line below treble and one above bass', () => {
    expect(staffStep(n(C, 4), 'treble')).toBe(-2)
    expect(staffStep(n(C, 4), 'bass')).toBe(10)
    expect(ledgerSteps(-2)).toEqual([-2])
    expect(ledgerSteps(10)).toEqual([10])
  })

  it('spaces just outside the staff need no ledger line', () => {
    expect(ledgerSteps(-1)).toEqual([]) // D4 under treble
    expect(ledgerSteps(9)).toEqual([]) // G5 over treble
    expect(ledgerSteps(4)).toEqual([])
  })

  it('notes further out stack ledger lines', () => {
    expect(ledgerSteps(-5)).toEqual([-2, -4])
    expect(ledgerSteps(12)).toEqual([10, 12])
  })
})

describe('pitches', () => {
  it('middle C is MIDI 60, A4 is 69', () => {
    expect(midi(n(C, 4))).toBe(60)
    expect(midi(n(A, 4))).toBe(69)
    expect(midi(n(F, 4, 1))).toBe(66)
    expect(midi(n(B, 3, -1))).toBe(58)
  })

  it('names', () => {
    expect(noteName(n(F, 5, 1))).toBe('F♯5')
    expect(noteName(n(B, 2, -1))).toBe('B♭2')
  })

  it('on-screen answers ignore the octave; MIDI answers must match it', () => {
    expect(isCorrect(n(C, 4), 72, false)).toBe(true)
    expect(isCorrect(n(C, 4), 72, true)).toBe(false)
    expect(isCorrect(n(C, 4), 60, true)).toBe(true)
    expect(isCorrect(n(G, 4, -1), 66, false)).toBe(true) // G♭ = F♯ key
    expect(isCorrect(n(G, 4), 66, false)).toBe(false)
  })
})

describe('prompt pool', () => {
  it('staff level covers exactly the 9 lines and spaces of each clef', () => {
    const right = promptPool('right', 'staff', false)
    expect(right.map((p) => noteName(p.note))).toEqual(['E4', 'F4', 'G4', 'A4', 'B4', 'C5', 'D5', 'E5', 'F5'])
    const left = promptPool('left', 'staff', false)
    expect(left.map((p) => noteName(p.note))).toEqual(['G2', 'A2', 'B2', 'C3', 'D3', 'E3', 'F3', 'G3', 'A3'])
    expect(promptPool('both', 'staff', false)).toHaveLength(18)
  })

  it('ledger level reaches two ledger lines each way', () => {
    const names = promptPool('right', 'ledger', false).map((p) => noteName(p.note))
    expect(names[0]).toBe('A3')
    expect(names[names.length - 1]).toBe('C6')
    const bass = promptPool('left', 'ledger', false).map((p) => noteName(p.note))
    expect(bass[0]).toBe('C2')
    expect(bass[bass.length - 1]).toBe('E4')
  })

  it('accidentals skip E♯, B♯, C♭, F♭', () => {
    const names = promptPool('right', 'wide', true).map((p) => noteName(p.note))
    for (const bad of ['E♯', 'B♯', 'C♭', 'F♭']) expect(names.some((x) => x.startsWith(bad))).toBe(false)
    expect(names).toContain('F♯4')
    expect(names).toContain('B♭4')
  })
})

describe('pickPrompt', () => {
  it('never repeats the previous note', () => {
    const pool = promptPool('both', 'staff', true)
    const rng = seededRng(7)
    let last = pickPrompt(pool, null, undefined, rng)
    for (let i = 0; i < 500; i++) {
      const next = pickPrompt(pool, last, undefined, rng)
      expect(promptKey(next)).not.toBe(promptKey(last))
      last = next
    }
  })

  it('favours heavier notes', () => {
    const pool = promptPool('right', 'staff', false)
    const rng = seededRng(3)
    let hits = 0
    for (let i = 0; i < 1000; i++) if (noteName(pickPrompt(pool, null, (p) => (noteName(p.note) === 'B4' ? 10 : 1), rng).note) === 'B4') hits++
    expect(hits).toBeGreaterThan(400)
  })
})

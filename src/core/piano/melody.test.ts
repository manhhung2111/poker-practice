import { describe, expect, it } from 'vitest'
import { seededRng } from '../random'
import { ROW_LENGTH, makeRow, phaseFor } from './melody'
import { type Clef, type Level, type Note, LEVEL_STEPS, diatonic, letterName, staffStep } from './notes'

const CLEFS: Clef[] = ['treble', 'bass']
const LEVELS: Level[] = ['staff', 'ledger', 'wide']
const moves = (row: Note[]) => row.slice(1).map((x, i) => Math.abs(diatonic(x) - diatonic(row[i])))

describe('makeRow', () => {
  it('makes 6 notes inside the level, with no neighbouring repeats', () => {
    const rng = seededRng(5)
    for (const clef of CLEFS)
      for (const level of LEVELS)
        for (const phase of ['early', 'later'] as const)
          for (let i = 0; i < 200; i++) {
            const row = makeRow(clef, level, true, phase, rng)
            expect(row).toHaveLength(ROW_LENGTH)
            for (const x of row) {
              expect(staffStep(x, clef)).toBeGreaterThanOrEqual(LEVEL_STEPS[level][0])
              expect(staffStep(x, clef)).toBeLessThanOrEqual(LEVEL_STEPS[level][1])
            }
            expect(moves(row).every((m) => m > 0)).toBe(true)
          }
  })

  it('early rows are mostly steps to the next note', () => {
    const rng = seededRng(9)
    const all = Array.from({ length: 300 }, () => moves(makeRow('treble', 'ledger', false, 'early', rng))).flat()
    expect(Math.max(...all)).toBeLessThanOrEqual(2)
    expect(all.filter((m) => m === 1).length / all.length).toBeGreaterThanOrEqual(0.75)
  })

  it('later rows jump up to a 5th', () => {
    const rng = seededRng(13)
    const all = Array.from({ length: 300 }, () => moves(makeRow('treble', 'wide', false, 'later', rng))).flat()
    expect(Math.max(...all)).toBeLessThanOrEqual(4)
    expect(all.some((m) => m >= 3)).toBe(true)
  })

  it('accidentals off keeps every note natural; on adds valid sharps and flats', () => {
    const rng = seededRng(21)
    const off = Array.from({ length: 100 }, () => makeRow('bass', 'ledger', false, 'later', rng)).flat()
    expect(off.every((x) => x.acc === 0)).toBe(true)
    const on = Array.from({ length: 200 }, () => makeRow('bass', 'ledger', true, 'later', rng)).flat()
    expect(on.some((x) => x.acc !== 0)).toBe(true)
    for (const bad of ['E♯', 'B♯', 'C♭', 'F♭']) expect(on.some((x) => letterName(x) === bad)).toBe(false)
  })

  it('a sharp or flat holds for the rest of the row', () => {
    const rng = seededRng(34)
    for (let i = 0; i < 500; i++) {
      const row = makeRow('treble', 'staff', true, 'early', rng)
      const seen = new Map<number, number>()
      for (const x of row) {
        const d = diatonic(x)
        if (seen.has(d)) expect(x.acc).toBe(seen.get(d))
        seen.set(d, x.acc)
      }
    }
  })
})

describe('phaseFor', () => {
  it('first half of a session is early; endless sessions turn after 5 rows', () => {
    expect([0, 1, 2, 3, 4].map((i) => phaseFor(i, 10))).toEqual(Array(5).fill('early'))
    expect(phaseFor(5, 10)).toBe('later')
    expect(phaseFor(4, 0)).toBe('early')
    expect(phaseFor(5, 0)).toBe('later')
  })
})

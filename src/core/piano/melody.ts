import { type Rng, defaultRng } from '../random'
import { type Clef, type Level, type Note, BOTTOM_LINE, LEVEL_STEPS, allowedAccidentals, noteFromDiatonic } from './notes'

/** Early rows move mostly by step; later rows mix in jumps. */
export type Phase = 'early' | 'later'

export const ROW_LENGTH = 6

/** Move sizes in staff steps (1 = a 2nd … 4 = a 5th) with their weights. */
const MOVES: Record<Phase, [number, number][]> = {
  early: [
    [1, 85],
    [2, 15],
  ],
  later: [
    [1, 40],
    [2, 30],
    [3, 15],
    [4, 15],
  ],
}

const KEEP_DIRECTION = 0.7
const ACCIDENTAL_CHANCE = 0.2

function pickMove(phase: Phase, rng: Rng): number {
  const list = MOVES[phase]
  let left = rng() * list.reduce((a, [, w]) => a + w, 0)
  for (const [size, w] of list) {
    left -= w
    if (left < 0) return size
  }
  return list[list.length - 1][0]
}

/**
 * A short melody on one staff, inside the level's range. Direction tends to continue and bounces off
 * the range edges; no note repeats its neighbour. A sharp or flat holds for the rest of the row, as it
 * would within a bar.
 */
export function makeRow(clef: Clef, level: Level, accidentals: boolean, phase: Phase, rng: Rng = defaultRng): Note[] {
  const [lo, hi] = LEVEL_STEPS[level]
  const steps: number[] = [lo + Math.floor(rng() * (hi - lo + 1))]
  let dir = rng() < 0.5 ? -1 : 1
  while (steps.length < ROW_LENGTH) {
    const cur = steps[steps.length - 1]
    const size = pickMove(phase, rng)
    if (rng() > KEEP_DIRECTION) dir = -dir
    let next = cur + dir * size
    if (next < lo || next > hi) {
      dir = -dir
      next = cur + dir * size
    }
    if (next < lo || next > hi) next = cur + (cur < hi ? 1 : -1)
    steps.push(next)
  }

  const held = new Map<number, Note['acc']>()
  return steps.map((s) => {
    const d = BOTTOM_LINE[clef] + s
    if (!held.has(d)) {
      const options = allowedAccidentals(((d % 7) + 7) % 7)
      const acc = accidentals && options.length && rng() < ACCIDENTAL_CHANCE ? options[Math.floor(rng() * options.length)] : 0
      held.set(d, acc)
    }
    return noteFromDiatonic(d, held.get(d)!)
  })
}

/** Rows in the first half of a session (or the first 5 of an endless one) are early. */
export const phaseFor = (rowIndex: number, sessionRows: number): Phase =>
  rowIndex < (sessionRows ? sessionRows / 2 : 5) ? 'early' : 'later'

import { type Rng, defaultRng } from '../random'
import {
  type Clef,
  type Hand,
  type Level,
  type Note,
  LEVEL_STEPS,
  LETTERS,
  ACC_SYMBOL,
  clefsFor,
  midi,
  noteFromDiatonic,
  diatonic,
  pitchClass,
  staffStep,
} from './notes'

export type Quality = 'major' | 'minor'

/** A root-position triad on one staff, notes low to high. */
export interface Chord {
  clef: Clef
  quality: Quality
  notes: [Note, Note, Note]
}

type Root = { letter: number; acc: Note['acc'] }
const r = (letter: number, acc: Note['acc'] = 0): Root => ({ letter, acc })

/**
 * The fixed spelling of every chord. Names are stats keys, so these must not change.
 * Majors: C D♭ D E♭ E F F♯ G A♭ A B♭ B. Minors: C C♯ D E♭ E F F♯ G G♯ A B♭ B.
 */
export const CHORD_ROOTS: Record<Quality, Root[]> = {
  major: [r(0), r(1, -1), r(1), r(2, -1), r(2), r(3), r(3, 1), r(4), r(5, -1), r(5), r(6, -1), r(6)],
  minor: [r(0), r(0, 1), r(1), r(2, -1), r(2), r(3), r(3, 1), r(4), r(4, 1), r(5), r(6, -1), r(6)],
}

const THIRD: Record<Quality, number> = { major: 4, minor: 3 }

/** Stacks letters root–3rd–5th and adds the ♯/♭ each needs to sit 3/4 and 7 semitones above the root. */
export function spellTriad(root: Note, quality: Quality): [Note, Note, Note] {
  const base = diatonic(root)
  const at = (steps: number, semis: number): Note => {
    const natural = noteFromDiatonic(base + steps)
    return { ...natural, acc: (midi(root) + semis - midi(natural)) as Note['acc'] }
  }
  return [root, at(2, THIRD[quality]), at(4, 7)]
}

export const chordName = (c: Chord) => `${LETTERS[c.notes[0].letter]}${ACC_SYMBOL[c.notes[0].acc]} ${c.quality}`
export const chordKey = (c: Chord) => `${c.clef}:${chordName(c)}`

/** Chords may reach one ledger line (2 steps) past the level's range. */
const CHORD_PAD = 2

/** Every chord a hand and level can show. Without sharps & flats, only all-natural chords. */
export function chordPool(hand: Hand, level: Level, accidentals: boolean): Chord[] {
  const [lo, hi] = LEVEL_STEPS[level]
  const out: Chord[] = []
  for (const clef of clefsFor(hand)) {
    for (const quality of ['major', 'minor'] as Quality[]) {
      for (const root of CHORD_ROOTS[quality]) {
        for (let octave = 1; octave <= 7; octave++) {
          const notes = spellTriad({ letter: root.letter, octave, acc: root.acc }, quality)
          if (!accidentals && notes.some((x) => x.acc !== 0)) continue
          if (staffStep(notes[0], clef) < lo - CHORD_PAD || staffStep(notes[2], clef) > hi + CHORD_PAD) continue
          out.push({ clef, quality, notes })
        }
      }
    }
  }
  return out
}

/** Next chord, never the same chord name on the same staff twice in a row; heavier chords come up more. */
export function pickChord(
  pool: readonly Chord[],
  last: Chord | null,
  weight: (c: Chord) => number = () => 1,
  rng: Rng = defaultRng,
): Chord {
  const lastKey = last ? chordKey(last) : null
  const candidates = pool.length > 1 ? pool.filter((c) => chordKey(c) !== lastKey) : pool
  const list = candidates.length ? candidates : pool
  const weights = list.map(weight)
  let left = rng() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < list.length; i++) {
    left -= weights[i]
    if (left < 0) return list[i]
  }
  return list[list.length - 1]
}

/** On-screen answer: the selected keys (pitch classes) are exactly the chord's three. */
export function isChordCorrectOnScreen(c: Chord, pitchClasses: ReadonlySet<number>): boolean {
  const want = new Set(c.notes.map(pitchClass))
  return pitchClasses.size === want.size && [...want].every((p) => pitchClasses.has(p))
}

/** MIDI answer: exactly the chord's keys, octave included. */
export function isChordCorrectMidi(c: Chord, midis: readonly number[]): boolean {
  const want = c.notes.map(midi).sort((a, b) => a - b)
  const got = [...new Set(midis)].sort((a, b) => a - b)
  return got.length === want.length && got.every((m, i) => m === want[i])
}

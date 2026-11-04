import { type Rng, defaultRng } from '../random'

/** Treble = right hand, bass = left hand. */
export type Clef = 'treble' | 'bass'
export type Hand = 'right' | 'left' | 'both'
/** How far notes may sit from the staff: on it, up to 2 ledger lines, up to 3. */
export type Level = 'staff' | 'ledger' | 'wide'

export const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const
const NATURAL_SEMITONES = [0, 2, 4, 5, 7, 9, 11]

export interface Note {
  /** 0 = C … 6 = B. */
  letter: number
  /** Scientific pitch octave: middle C is C4. */
  octave: number
  /** -1 flat, 0 natural, 1 sharp. */
  acc: -1 | 0 | 1
}

export interface Prompt {
  note: Note
  clef: Clef
}

/** Steps up the white keys from C0; one per line or space on a staff. */
export const diatonic = (n: Note) => n.octave * 7 + n.letter

export const midi = (n: Note) => (n.octave + 1) * 12 + NATURAL_SEMITONES[n.letter] + n.acc

/** 0 = C … 11 = B, ignoring octave. */
export const pitchClass = (n: Note) => ((midi(n) % 12) + 12) % 12

export function noteFromDiatonic(d: number, acc: Note['acc'] = 0): Note {
  return { letter: ((d % 7) + 7) % 7, octave: Math.floor(d / 7), acc }
}

/** Bottom staff line: E4 for treble, G2 for bass. */
const BOTTOM_LINE: Record<Clef, number> = { treble: 4 * 7 + 2, bass: 2 * 7 + 4 }

/** Position on the staff: 0 = bottom line, 1 = first space, … 8 = top line. Negative is below. */
export const staffStep = (n: Note, clef: Clef) => diatonic(n) - BOTTOM_LINE[clef]

/** Steps of the ledger lines a note needs (always even: ledger lines sit on lines). */
export function ledgerSteps(step: number): number[] {
  const out: number[] = []
  for (let s = -2; s >= step; s -= 2) out.push(s)
  for (let s = 10; s <= step; s += 2) out.push(s)
  return out
}

/** Lowest and highest staff step per level. 2 steps = one ledger line. */
export const LEVEL_STEPS: Record<Level, [number, number]> = {
  staff: [0, 8],
  ledger: [-4, 12],
  wide: [-6, 14],
}

export const ACC_SYMBOL = { [-1]: '♭', 0: '', 1: '♯' } as const

/** "C4", "F♯5". */
export const noteName = (n: Note) => `${LETTERS[n.letter]}${ACC_SYMBOL[n.acc]}${n.octave}`

/** "C", "F♯": what the on-screen keyboard answers. */
export const letterName = (n: Note) => `${LETTERS[n.letter]}${ACC_SYMBOL[n.acc]}`

export const promptKey = (p: Prompt) => `${p.clef}:${noteName(p.note)}`

export const clefsFor = (hand: Hand): Clef[] => (hand === 'right' ? ['treble'] : hand === 'left' ? ['bass'] : ['treble', 'bass'])

/** Letters that take a sharp / flat without landing on another white key (no E♯, C♭ …). */
const SHARPABLE = new Set([0, 1, 3, 4, 5]) // C D F G A
const FLATTABLE = new Set([1, 2, 4, 5, 6]) // D E G A B

/** Every prompt a hand and level can produce. */
export function promptPool(hand: Hand, level: Level, accidentals: boolean): Prompt[] {
  const [lo, hi] = LEVEL_STEPS[level]
  const out: Prompt[] = []
  for (const clef of clefsFor(hand)) {
    for (let s = lo; s <= hi; s++) {
      const base = noteFromDiatonic(BOTTOM_LINE[clef] + s)
      out.push({ clef, note: base })
      if (accidentals) {
        if (SHARPABLE.has(base.letter)) out.push({ clef, note: { ...base, acc: 1 } })
        if (FLATTABLE.has(base.letter)) out.push({ clef, note: { ...base, acc: -1 } })
      }
    }
  }
  return out
}

/**
 * Picks the next prompt, never the same key as `last`. `weight` lets missed or slow notes come up
 * more often; naturals are favoured so sharps and flats stay a minority.
 */
export function pickPrompt(
  pool: readonly Prompt[],
  last: Prompt | null,
  weight: (p: Prompt) => number = () => 1,
  rng: Rng = defaultRng,
): Prompt {
  const lastKey = last ? promptKey(last) : null
  const candidates = pool.length > 1 ? pool.filter((p) => promptKey(p) !== lastKey) : pool
  const weights = candidates.map((p) => weight(p) * (p.note.acc === 0 ? 1 : 0.35))
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < candidates.length; i++) {
    r -= weights[i]
    if (r < 0) return candidates[i]
  }
  return candidates[candidates.length - 1]
}

/**
 * Grades an answer. On-screen keys carry only a pitch class (no octave), so `exact` is false for them;
 * a MIDI keyboard sends the real key, which must match the octave too.
 */
export function isCorrect(note: Note, answerMidi: number, exact: boolean): boolean {
  return exact ? answerMidi === midi(note) : ((answerMidi % 12) + 12) % 12 === pitchClass(note)
}

/** Name for a pitch class as shown on the keyboard (sharps for black keys). */
export const PITCH_CLASS_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B']

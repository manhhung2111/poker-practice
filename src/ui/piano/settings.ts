import type { Hand, Level } from '../../core/piano/notes'
import { safeStorage } from '../storage'

export type DrillMode = 'single' | 'row' | 'chord'
export const DRILL_MODES: DrillMode[] = ['single', 'row', 'chord']

export interface PianoSettings {
  mode: DrillMode
  hand: Hand
  level: Level
  accidentals: boolean
  /** Letter names on the on-screen keys. */
  labels: boolean
  /** Session length per mode, in notes / rows / chords. 0 = endless. */
  lengths: Record<DrillMode, number>
  /** Answer on a connected MIDI keyboard (octave must match). */
  midi: boolean
}

export const SESSION_CHOICES: Record<DrillMode, readonly number[]> = {
  single: [20, 50, 0],
  row: [5, 10, 0],
  chord: [10, 20, 0],
}

export const DEFAULT_PIANO_SETTINGS: PianoSettings = {
  mode: 'single',
  hand: 'right',
  level: 'staff',
  accidentals: false,
  labels: true,
  lengths: { single: 20, row: 10, chord: 20 },
  midi: false,
}

export const sessionLength = (s: PianoSettings) => s.lengths[s.mode]

const KEY = 'piano:settings'

export function loadPianoSettings(): PianoSettings {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? 'null')
    if (!raw) return DEFAULT_PIANO_SETTINGS
    const d = DEFAULT_PIANO_SETTINGS
    // Settings saved before drill modes had a single `length` for Single notes.
    const saved: Record<string, unknown> = raw.lengths && typeof raw.lengths === 'object' ? raw.lengths : { single: raw.length }
    const lengths = Object.fromEntries(
      DRILL_MODES.map((m) => [m, SESSION_CHOICES[m].includes(saved[m] as number) ? (saved[m] as number) : d.lengths[m]]),
    ) as Record<DrillMode, number>
    return {
      mode: DRILL_MODES.includes(raw.mode) ? raw.mode : 'single',
      hand: raw.hand === 'left' || raw.hand === 'both' ? raw.hand : 'right',
      level: raw.level === 'ledger' || raw.level === 'wide' ? raw.level : 'staff',
      accidentals: typeof raw.accidentals === 'boolean' ? raw.accidentals : d.accidentals,
      labels: typeof raw.labels === 'boolean' ? raw.labels : d.labels,
      lengths,
      midi: raw.midi === true,
    }
  } catch {
    return DEFAULT_PIANO_SETTINGS
  }
}

export const savePianoSettings = (s: PianoSettings) => safeStorage.set(KEY, JSON.stringify(s))

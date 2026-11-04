import type { Hand, Level } from '../../core/piano/notes'
import { safeStorage } from '../storage'

export interface PianoSettings {
  hand: Hand
  level: Level
  accidentals: boolean
  /** Letter names on the on-screen keys. */
  labels: boolean
  /** 0 = endless. */
  length: number
  /** Answer on a connected MIDI keyboard (octave must match). */
  midi: boolean
}

export const SESSION_LENGTHS = [20, 50, 0] as const

export const DEFAULT_PIANO_SETTINGS: PianoSettings = {
  hand: 'right',
  level: 'staff',
  accidentals: false,
  labels: true,
  length: 20,
  midi: false,
}

const KEY = 'piano:settings'

export function loadPianoSettings(): PianoSettings {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? 'null')
    if (!raw) return DEFAULT_PIANO_SETTINGS
    const d = DEFAULT_PIANO_SETTINGS
    return {
      hand: raw.hand === 'left' || raw.hand === 'both' ? raw.hand : 'right',
      level: raw.level === 'ledger' || raw.level === 'wide' ? raw.level : 'staff',
      accidentals: typeof raw.accidentals === 'boolean' ? raw.accidentals : d.accidentals,
      labels: typeof raw.labels === 'boolean' ? raw.labels : d.labels,
      length: (SESSION_LENGTHS as readonly number[]).includes(raw.length) ? raw.length : d.length,
      midi: raw.midi === true,
    }
  } catch {
    return DEFAULT_PIANO_SETTINGS
  }
}

export const savePianoSettings = (s: PianoSettings) => safeStorage.set(KEY, JSON.stringify(s))

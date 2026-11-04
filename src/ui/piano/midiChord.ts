/** Keys pressed on a MIDI keyboard toward one chord answer. */
export interface Attempt {
  keys: number[]
  lastAt: number
}

export const EMPTY_ATTEMPT: Attempt = { keys: [], lastAt: -Infinity }

/** A press more than this long after the previous one starts a fresh attempt. */
const GAP_MS = 1500
const CHORD_SIZE = 3

export const complete = (a: Attempt) => a.keys.length >= CHORD_SIZE

/** Adds a key press: repeats are ignored; a long gap or a finished attempt starts over. */
export function addPress(a: Attempt, midi: number, at: number): Attempt {
  const fresh = complete(a) || at - a.lastAt > GAP_MS
  const keys = fresh ? [] : a.keys
  return { keys: keys.includes(midi) ? keys : [...keys, midi], lastAt: at }
}

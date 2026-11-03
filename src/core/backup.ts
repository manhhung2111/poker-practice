import type { ChartDef } from './charts'
import { type AnswerLog, parseLogEntry } from './log'
import { type Overrides, parseOverrides } from './overrides'
import { type ProgressState, parseProgress } from './progress'

/** Everything a backup holds (design §8.4). */
export interface BackupData {
  answers: AnswerLog[]
  progress: ProgressState
  /** Range edits per chart id. */
  ranges: Overrides
}

const APP = 'poker-practice-trainer'
const VERSION = 1

export function makeBackup(data: BackupData, now = Date.now()): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date(now).toISOString(), ...data })
}

export class BackupError extends Error {}

/**
 * Reads a backup file's text. Throws BackupError with a message the user can act on.
 * `defs` are the app's chart definitions, used to validate range edits.
 */
export function parseBackup(text: string, defs: readonly ChartDef[] = []): BackupData & { skipped: number } {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupError("This isn't a backup file: it isn't valid JSON. Paste the whole text you copied.")
  }
  const r = raw as Record<string, unknown>
  if (!r || r.app !== APP) throw new BackupError("This file isn't a Poker Trainer backup.")
  if (typeof r.version !== 'number' || r.version > VERSION) {
    throw new BackupError('This backup comes from a newer version of the app. Update the app and try again.')
  }
  const list = Array.isArray(r.answers) ? r.answers : []
  const answers = list.map(parseLogEntry).filter((e): e is AnswerLog => e !== null)
  return {
    answers: answers.sort((a, b) => a.at - b.at),
    progress: parseProgress(r.progress),
    ranges: parseOverrides(r.ranges, defs),
    skipped: list.length - answers.length,
  }
}

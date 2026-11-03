import { type AnswerLog, parseLogEntry } from './log'
import { type ProgressState, parseProgress } from './progress'

/** Everything a backup holds (design §8.4). Range edits join in M6. */
export interface BackupData {
  answers: AnswerLog[]
  progress: ProgressState
}

const APP = 'poker-practice-trainer'
const VERSION = 1

export function makeBackup(data: BackupData, now = Date.now()): string {
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date(now).toISOString(), ...data })
}

export class BackupError extends Error {}

/** Reads a backup file's text. Throws BackupError with a message the user can act on. */
export function parseBackup(text: string): BackupData & { skipped: number } {
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
  return { answers: answers.sort((a, b) => a.at - b.at), progress: parseProgress(r.progress), skipped: list.length - answers.length }
}

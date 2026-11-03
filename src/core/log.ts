import type { Action } from './charts'
import type { DrillSpot } from './dealing'
import type { Severity } from './grading'
import type { HandClass } from './hands'
import { type Position, isPosition } from './positions'

/** One answered spot (design §8.1). */
export interface AnswerLog {
  /** Unix time in ms. */
  at: number
  chartId: string
  type: DrillSpot
  hero: Position
  villain?: Position
  hand: HandClass
  chosen: Action
  best: Action
  correct: boolean
  severity: Severity
  /** Time to answer, in ms. */
  ms: number
  source: 'drill' | 'play'
}

const SPOTS = ['rfi', 'facing-open', 'blinds', 'facing-3bet']
const ACTIONS = ['fold', 'call', 'raise']
const SEVERITIES = ['none', 'close', 'clear', 'blunder']

/** Validates one log entry from untrusted data (backups). Returns null if malformed. */
export function parseLogEntry(x: unknown): AnswerLog | null {
  if (!x || typeof x !== 'object') return null
  const e = x as Record<string, unknown>
  const ok =
    typeof e.at === 'number' &&
    typeof e.chartId === 'string' &&
    SPOTS.includes(e.type as string) &&
    typeof e.hero === 'string' &&
    isPosition(e.hero) &&
    (e.villain === undefined || (typeof e.villain === 'string' && isPosition(e.villain))) &&
    typeof e.hand === 'string' &&
    ACTIONS.includes(e.chosen as string) &&
    ACTIONS.includes(e.best as string) &&
    typeof e.correct === 'boolean' &&
    SEVERITIES.includes(e.severity as string)
  if (!ok) return null
  return {
    at: e.at as number,
    chartId: e.chartId as string,
    type: e.type as DrillSpot,
    hero: e.hero as Position,
    ...(e.villain ? { villain: e.villain as Position } : {}),
    hand: e.hand as string,
    chosen: e.chosen as Action,
    best: e.best as Action,
    correct: e.correct as boolean,
    severity: e.severity as Severity,
    ms: typeof e.ms === 'number' ? e.ms : 0,
    source: e.source === 'play' ? 'play' : 'drill',
  }
}

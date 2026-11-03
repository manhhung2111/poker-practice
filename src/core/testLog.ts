import type { AnswerLog } from './log'

/** Test helper: a log entry with sensible defaults. */
export function entry(over: Partial<AnswerLog> = {}): AnswerLog {
  return {
    at: Date.UTC(2026, 10, 3, 12),
    chartId: 'rfi/utg',
    type: 'rfi',
    hero: 'UTG',
    hand: 'AKo',
    chosen: 'raise',
    best: 'raise',
    correct: true,
    severity: 'none',
    ms: 1500,
    source: 'drill',
    ...over,
  }
}

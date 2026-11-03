import type { DealingMode } from '../../core/dealing'
import { type Position, OPENERS, isPosition } from '../../core/positions'
import { safeStorage } from '../storage'

export type SessionMode = 'endless' | 'session'
export const SESSION_LENGTH = 25

export interface DrillSettings {
  positions: Position[]
  session: SessionMode
  dealing: DealingMode
}

export const DEFAULT_SETTINGS: DrillSettings = {
  positions: [...OPENERS],
  session: 'session',
  dealing: 'smart',
}

const KEY = 'poker-trainer:drill-settings'

export function loadSettings(): DrillSettings {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? 'null')
    if (!raw) return DEFAULT_SETTINGS
    const positions = Array.isArray(raw.positions)
      ? raw.positions.filter((p: string) => isPosition(p) && p !== 'BB')
      : []
    return {
      positions: positions.length ? positions : DEFAULT_SETTINGS.positions,
      session: raw.session === 'endless' ? 'endless' : 'session',
      dealing: raw.dealing === 'realistic' ? 'realistic' : 'smart',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: DrillSettings): void {
  safeStorage.set(KEY, JSON.stringify(s))
}

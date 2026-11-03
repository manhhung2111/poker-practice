import { type DealingMode, type DrillChoice, DRILL_SPOTS } from '../../core/dealing'
import { type Position, POSITIONS, isPosition } from '../../core/positions'
import { safeStorage } from '../storage'

export type SessionMode = 'endless' | 'session'
export const SESSION_LENGTH = 25

export interface DrillSettings {
  spot: DrillChoice
  positions: Position[]
  session: SessionMode
  dealing: DealingMode
}

export const DEFAULT_SETTINGS: DrillSettings = {
  spot: 'rfi',
  positions: [...POSITIONS],
  session: 'session',
  dealing: 'smart',
}

const KEY = 'poker-trainer:drill-settings'

export function loadSettings(): DrillSettings {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? 'null')
    if (!raw) return DEFAULT_SETTINGS
    const positions: Position[] = Array.isArray(raw.positions) ? raw.positions.filter(isPosition) : []
    const spot: DrillChoice = raw.spot === 'mixed' || DRILL_SPOTS.includes(raw.spot) ? raw.spot : 'rfi'
    return {
      spot,
      positions: positions.length ? positions : DEFAULT_SETTINGS.positions,
      session: raw.session === 'endless' ? 'endless' : 'session',
      dealing: raw.dealing === 'realistic' || raw.dealing === 'weak' ? raw.dealing : 'smart',
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

export function saveSettings(s: DrillSettings): void {
  safeStorage.set(KEY, JSON.stringify(s))
}

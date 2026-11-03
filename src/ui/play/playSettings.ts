import { safeStorage } from '../storage'

export type BotSpeed = 'normal' | 'fast' | 'instant'

export interface PlaySettings {
  speed: BotSpeed
  /** Auto-fold clear chart folds (design §9.5). Off by default. */
  skipTrivial: boolean
  /** Show pot odds when facing a bet. Off by default. */
  hints: boolean
}

export const BOT_DELAY: Record<BotSpeed, number> = { normal: 650, fast: 220, instant: 0 }

const KEY = 'poker-trainer:play-settings'
const DEFAULTS: PlaySettings = { speed: 'normal', skipTrivial: false, hints: false }

export function loadPlaySettings(): PlaySettings {
  try {
    const raw = JSON.parse(safeStorage.get(KEY) ?? 'null')
    if (!raw) return DEFAULTS
    return {
      speed: ['normal', 'fast', 'instant'].includes(raw.speed) ? raw.speed : 'normal',
      skipTrivial: raw.skipTrivial === true,
      hints: raw.hints === true,
    }
  } catch {
    return DEFAULTS
  }
}

export const savePlaySettings = (s: PlaySettings) => safeStorage.set(KEY, JSON.stringify(s))

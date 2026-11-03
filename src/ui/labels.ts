import type { LessonSpot } from '../core/progress'
import type { ChartSpot } from '../core/charts'
import type { DrillChoice, DrillSpot } from '../core/dealing'
import type { HandCategory } from '../core/hands'
import type { Position } from '../core/positions'

export const SPOT_TITLES: Record<ChartSpot, string> = {
  rfi: 'Open or fold',
  'facing-open': 'Facing a raise',
  'facing-3bet': 'Facing a 3-bet',
}

export const SPOT_DESCRIPTIONS: Record<ChartSpot, string> = {
  rfi: 'Everyone folded to you. Raise 2.5bb or fold.',
  'facing-open': 'One player raised before you. Fold, call, or 3-bet. Includes blinds defense.',
  'facing-3bet': 'You opened and someone re-raised. Fold, call, or 4-bet.',
}

export const CATEGORY_NAMES: Record<HandCategory, string> = {
  'premium-pair': 'Premium pair',
  'high-pair': 'High pair',
  'mid-pair': 'Middle pair',
  'low-pair': 'Small pair',
  'suited-ace': 'Suited ace',
  'offsuit-ace': 'Offsuit ace',
  'suited-broadway': 'Suited broadway',
  'offsuit-broadway': 'Offsuit broadway',
  'suited-connector': 'Suited connector',
  'suited-gapper': 'Suited gapper',
  'suited-other': 'Suited hand',
  'offsuit-connector': 'Offsuit connector',
  'offsuit-other': 'Weak offsuit hand',
}

/** "AKs" → "AK suited", "72o" → "72 offsuit", "77" → "Pocket 7s". */
export function handName(hand: string): string {
  if (hand.length === 2) return `Pocket ${hand[0] === 'T' ? '10' : hand[0]}s`
  return `${hand.slice(0, 2)} ${hand[2] === 's' ? 'suited' : 'offsuit'}`
}

export function percent(x: number): string {
  return `${(x * 100).toFixed(x < 0.1 ? 1 : 0)}%`
}

export const DRILL_SPOT_TITLES: Record<DrillChoice, string> = {
  rfi: 'Open or fold',
  'facing-open': 'Facing a raise',
  blinds: 'Blinds defense',
  'facing-3bet': 'Facing a 3-bet',
  mixed: 'Mixed',
}

/** Practice titles for every kind of lesson, preflop drills and table practice. */
export const LESSON_SPOT_TITLES: Record<LessonSpot, string> = {
  rfi: DRILL_SPOT_TITLES.rfi,
  'facing-open': DRILL_SPOT_TITLES['facing-open'],
  blinds: DRILL_SPOT_TITLES.blinds,
  'facing-3bet': DRILL_SPOT_TITLES['facing-3bet'],
  'postflop-facing-bet': 'Facing a bet after the flop',
  'postflop-betting': 'Betting after the flop',
}

export const DRILL_SPOT_NOTES: Record<DrillChoice, string> = {
  rfi: 'Folded to you: raise or fold',
  'facing-open': 'Someone raised: fold, call or 3-bet',
  blinds: 'SB/BB vs a raise: defend or fold',
  'facing-3bet': 'You opened, got 3-bet: fold, call or 4-bet',
  mixed: 'All of the above, shuffled together',
}

/** Merges runs of folds: ["UTG folds", "UTG+1 folds", "MP raises…"] → "UTG and UTG+1 fold. MP raises…" */
export function describeHistory(history: string[]): string[] {
  const out: string[] = []
  let folds: string[] = []
  const flush = () => {
    if (folds.length === 1) out.push(`${folds[0]} folds`)
    else if (folds.length === 2) out.push(`${folds[0]} and ${folds[1]} fold`)
    else if (folds.length > 2) out.push(`${folds[0]} to ${folds[folds.length - 1]} fold`)
    folds = []
  }
  for (const h of history) {
    const m = /^(\S+) folds$/.exec(h)
    if (m) folds.push(m[1])
    else {
      flush()
      out.push(h)
    }
  }
  flush()
  return out
}

/** Short description of the spot for feedback lines. */
export function spotContext(type: DrillSpot, hero: Position, villain?: Position): string {
  if (type === 'rfi') return `from ${hero}`
  if (type === 'facing-3bet') return `after your ${hero} open vs a ${villain} 3-bet`
  return `in the ${hero} vs a ${villain} raise`
}

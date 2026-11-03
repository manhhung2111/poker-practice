import type { ChartSpot } from '../core/charts'
import type { HandCategory } from '../core/hands'

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

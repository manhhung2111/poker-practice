/** 9-max positions in preflop action order. */
export const POSITIONS = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO', 'BTN', 'SB', 'BB'] as const
export type Position = (typeof POSITIONS)[number]

export type PositionGroup = 'early' | 'middle' | 'late' | 'blinds'

export const POSITION_GROUPS: Record<PositionGroup, readonly Position[]> = {
  early: ['UTG', 'UTG+1', 'MP'],
  middle: ['LJ', 'HJ'],
  late: ['CO', 'BTN'],
  blinds: ['SB', 'BB'],
}

export const POSITION_NAMES: Record<Position, string> = {
  UTG: 'Under the Gun',
  'UTG+1': 'Under the Gun +1',
  MP: 'Middle Position',
  LJ: 'Lojack',
  HJ: 'Hijack',
  CO: 'Cutoff',
  BTN: 'Button',
  SB: 'Small Blind',
  BB: 'Big Blind',
}

export function isPosition(x: string): x is Position {
  return (POSITIONS as readonly string[]).includes(x)
}

export function positionGroup(p: Position): PositionGroup {
  for (const [group, list] of Object.entries(POSITION_GROUPS)) {
    if (list.includes(p)) return group as PositionGroup
  }
  throw new Error(`Unknown position ${p}`)
}

/** True if `a` acts after `b` preflop. */
export function actsAfter(a: Position, b: Position): boolean {
  return POSITIONS.indexOf(a) > POSITIONS.indexOf(b)
}

/** Positions that can open-raise (everyone except the BB). */
export const OPENERS: readonly Position[] = POSITIONS.filter((p) => p !== 'BB')

/** Every (hero, villain) pair where villain opened and hero acts after. */
export function facingOpenMatchups(): { hero: Position; villain: Position }[] {
  const out: { hero: Position; villain: Position }[] = []
  for (const villain of OPENERS)
    for (const hero of POSITIONS) if (actsAfter(hero, villain)) out.push({ hero, villain })
  return out
}

/** Every (hero, villain) pair where hero opened and a later villain 3-bet. */
export function facing3betMatchups(): { hero: Position; villain: Position }[] {
  const out: { hero: Position; villain: Position }[] = []
  for (const hero of OPENERS)
    for (const villain of POSITIONS) if (actsAfter(villain, hero)) out.push({ hero, villain })
  return out
}

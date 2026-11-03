import type { Personality } from './bots/personality'
import type { Card } from './cards'
import type { Action, ChartSpot } from './charts'
import { type HandAction, type HandResult, type HandState, type Street, toBB } from './engine/game'
import type { Severity } from './grading'
import type { PostflopGrade } from './postflopGrading'
import type { Position } from './positions'

/** One of your decisions in a played hand, with its grade when the charts cover it. */
export interface HeroDecision {
  street: Street
  /** What you did, e.g. "Raise to 2.5bb". */
  label: string
  /** What happened before, e.g. "UTG to MP fold, LJ raises to 2.5bb". */
  situation: string
  board: Card[]
  /** After the flop: your estimated equity then, and what a call needed. */
  equity?: { value: number; needed: number | null; opponents: number }
  /** After the flop: graded by guidelines (equity, pot odds, board texture). */
  postflop?: PostflopGrade
  graded?: {
    chartId: string
    chartSpot: ChartSpot
    chartTitle: string
    correct: boolean
    severity: Severity
    chosen: Action
    best: Action
    correctActions: Action[]
  }
}

export interface HandRecord {
  at: number
  heroSeat: number
  players: { name: string; personality: Personality | null; position: Position; hole: [Card, Card]; start: number; end: number }[]
  board: Card[]
  actions: HandAction[]
  result: HandResult
  /** Your chip result (end − start). */
  heroNet: number
  decisions: HeroDecision[]
}

const fmt = (chips: number) => `${+toBB(chips).toFixed(1)}bb`

/** "UTG raises to 2.5bb", "SB calls 2bb", "BB checks", "CO bets 4bb (all-in)". */
export function describeAction(a: HandAction, name?: string): string {
  const who = name ? `${name} (${a.position})` : a.position
  const allIn = a.allIn ? ' (all-in)' : ''
  switch (a.type) {
    case 'post':
      return `${who} posts ${fmt(a.amount)}`
    case 'fold':
      return `${who} folds`
    case 'check':
      return `${who} checks`
    case 'call':
      return `${who} calls ${fmt(a.amount)}${allIn}`
    case 'bet':
      return `${who} bets ${fmt(a.amount)}${allIn}`
    case 'raise':
      return `${who} raises to ${fmt(a.amount)}${allIn}`
  }
}

/** Your own action phrased as a button label: "Fold", "Call 2bb", "Raise to 7.5bb". */
export function heroLabel(a: HandAction): string {
  const allIn = a.allIn ? ' (all-in)' : ''
  switch (a.type) {
    case 'fold':
      return 'Fold'
    case 'check':
      return 'Check'
    case 'call':
      return `Call ${fmt(a.amount)}${allIn}`
    case 'bet':
      return `Bet ${fmt(a.amount)}${allIn}`
    case 'raise':
      return `Raise to ${fmt(a.amount)}${allIn}`
    default:
      return a.type
  }
}

/** What happened on this street before the hero's latest action, with runs of folds merged. */
export function situationBefore(state: HandState): string {
  const parts: string[] = []
  let folds: Position[] = []
  const flush = () => {
    if (folds.length === 1) parts.push(`${folds[0]} folds`)
    else if (folds.length === 2) parts.push(`${folds[0]} and ${folds[1]} fold`)
    else if (folds.length > 2) parts.push(`${folds[0]} to ${folds[folds.length - 1]} fold`)
    folds = []
  }
  for (const a of state.actions) {
    if (a.street !== state.street || a.type === 'post') continue
    if (a.type === 'fold') folds.push(a.position)
    else {
      flush()
      parts.push(describeAction(a))
    }
  }
  flush()
  return parts.length ? parts.join(', ') : state.street === 'preflop' ? 'Folded to you' : 'Checked to you'
}

export function makeRecord(
  final: HandState,
  heroSeat: number,
  personalities: (Personality | null)[],
  startStacks: number[],
  decisions: HeroDecision[],
  at = Date.now(),
): HandRecord {
  if (!final.result) throw new Error('The hand is not finished')
  return {
    at,
    heroSeat,
    players: final.players.map((p, i) => ({
      name: p.name,
      personality: personalities[i],
      position: p.position,
      hole: p.hole,
      start: startStacks[i],
      end: p.stack,
    })),
    board: final.board,
    actions: final.actions,
    result: final.result,
    heroNet: final.players[heroSeat].stack - startStacks[heroSeat],
    decisions,
  }
}

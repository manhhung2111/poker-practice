import { PERSONALITIES, type Personality } from './bots/personality'
import { preflopSituation } from './bots/brain'
import { type Action, type Chart, findChart, mainAction } from './charts'
import { type DrillSpot, edgeHands } from './dealing'
import { type Decision, type HandState, BB, startHand } from './engine/game'
import { type Grade, grade } from './grading'
import { handClassOf } from './hands'
import type { Position } from './positions'
import { type Rng, defaultRng, randomInt } from './random'

/** A cash-game table session: you plus 8 bots (design §9). */
export interface SeatInfo {
  name: string
  /** null = you. */
  personality: Personality | null
  stack: number
}

export interface TableSession {
  seats: SeatInfo[]
  heroSeat: number
  button: number
  handsPlayed: number
  /** Your result in chips, not counting rebuys. */
  net: number
  rebuys: number
}

export const START_STACK = 100 * BB
/** Bots reload to 100bb when they drop below this. */
export const BOT_RELOAD_BELOW = 40 * BB

const BOT_NAMES = ['Ana', 'Ben', 'Chen', 'Dara', 'Eli', 'Femi', 'Gus', 'Hana', 'Ivo', 'Jun', 'Kai', 'Lea', 'Mo', 'Nia', 'Omar', 'Pia', 'Rui', 'Sami']

export function newSession(rng: Rng = defaultRng): TableSession {
  const names = [...BOT_NAMES]
  const seats: SeatInfo[] = [{ name: 'You', personality: null, stack: START_STACK }]
  // A random mix, but at least one of each style.
  const styles: Personality[] = [...PERSONALITIES]
  while (styles.length < 8) styles.push(PERSONALITIES[randomInt(PERSONALITIES.length, rng)])
  for (let i = styles.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng)
    ;[styles[i], styles[j]] = [styles[j], styles[i]]
  }
  for (const personality of styles) {
    const name = names.splice(randomInt(names.length, rng), 1)[0]
    seats.push({ name, personality, stack: START_STACK })
  }
  return { seats, heroSeat: 0, button: randomInt(9, rng), handsPlayed: 0, net: 0, rebuys: 0 }
}

/** Reloads short stacks, moves the button, and deals the next hand. */
export function nextHand(session: TableSession, rng: Rng = defaultRng): { session: TableSession; hand: HandState } {
  let rebuys = session.rebuys
  const seats = session.seats.map((s, i) => {
    if (i === session.heroSeat) {
      if (s.stack < BB) {
        rebuys++
        return { ...s, stack: START_STACK }
      }
      return s
    }
    return s.stack < BOT_RELOAD_BELOW ? { ...s, stack: START_STACK } : s
  })
  const button = (session.button + 1) % seats.length
  const hand = startHand({ names: seats.map((s) => s.name), stacks: seats.map((s) => s.stack), button, rng })
  return { session: { ...session, seats, button, rebuys }, hand }
}

/** Applies a finished hand's stacks to the session. */
export function finishHand(session: TableSession, hand: HandState): TableSession {
  if (!hand.result) throw new Error('The hand is not finished')
  const before = session.seats[session.heroSeat].stack
  const seats = session.seats.map((s, i) => ({ ...s, stack: hand.players[i].stack }))
  return { ...session, seats, handsPlayed: session.handsPlayed + 1, net: session.net + seats[session.heroSeat].stack - before }
}

// ---------------------------------------------------------------------------
// Grading your preflop decisions against the charts
// ---------------------------------------------------------------------------

export interface HeroChartSpot {
  type: DrillSpot
  chart: Chart
  hero: Position
  villain?: Position
}

/**
 * The chart that covers the hero's current preflop decision, or null when the
 * spot isn't one the charts describe (limpers, callers before you, cold 4-bets…).
 */
export function heroChartSpot(state: HandState, heroSeat: number, charts: readonly Chart[]): HeroChartSpot | null {
  if (state.street !== 'preflop' || state.toAct !== heroSeat) return null
  const sit = preflopSituation(state)
  const hero = state.players[heroSeat].position
  const pos = (seat: number) => state.players[seat].position
  if (sit.limpers > 0) return null
  if (sit.raises === 0) {
    if (hero === 'BB') return null
    const chart = findChart(charts, 'rfi', hero)
    return chart ? { type: 'rfi', chart, hero } : null
  }
  if (sit.raises === 1 && sit.callers === 0) {
    const villain = pos(sit.opener!)
    const chart = findChart(charts, 'facing-open', hero, villain)
    if (!chart) return null
    return { type: hero === 'SB' || hero === 'BB' ? 'blinds' : 'facing-open', chart, hero, villain }
  }
  if (sit.raises === 2 && sit.callers === 0 && sit.opener === heroSeat) {
    const villain = pos(sit.lastRaiser!)
    const chart = findChart(charts, 'facing-3bet', hero, villain)
    return chart ? { type: 'facing-3bet', chart, hero, villain } : null
  }
  return null
}

/** Maps an engine decision to a chart action. */
export function chartAction(d: Decision): Action {
  return d.type === 'raise' ? 'raise' : d.type === 'fold' ? 'fold' : 'call'
}

/** Grades the hero's decision if the spot is a chart spot. Call with the state before acting. */
export function gradeHeroDecision(
  state: HandState,
  heroSeat: number,
  d: Decision,
  charts: readonly Chart[],
): { spot: HeroChartSpot; grade: Grade } | null {
  const spot = heroChartSpot(state, heroSeat, charts)
  if (!spot) return null
  const p = state.players[heroSeat]
  return { spot, grade: grade(spot.chart, handClassOf(p.hole[0], p.hole[1]), chartAction(d)) }
}

/**
 * "Skip trivial folds" (design §9.5): a clear fold the chart agrees with, far from
 * the edge of the range, so there's nothing to learn by deciding it.
 */
export function isTrivialFold(state: HandState, heroSeat: number, charts: readonly Chart[]): boolean {
  const spot = heroChartSpot(state, heroSeat, charts)
  if (!spot) return false
  const p = state.players[heroSeat]
  const hand = handClassOf(p.hole[0], p.hole[1])
  return mainAction(spot.chart, hand) === 'fold' && (spot.chart.strategy[hand].fold ?? 0) === 1 && !edgeHands(spot.chart).includes(hand)
}

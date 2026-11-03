import type { SpotEquity } from './bots/brain'
import { preflopSituation } from './bots/brain'
import { type Made, readHand } from './bots/handRead'
import { type Wetness, boardTexture } from './boardTexture'
import { type Decision, type HandState, type Street, legalActions, potSize } from './engine/game'
import type { Severity } from './grading'

/**
 * Postflop grading by guidelines (design §9.2). Not solver truth: simple rules built on
 * your equity against their likely hands, the pot odds, and the board texture.
 */
export type PostflopFocus = 'postflop-facing-bet' | 'postflop-betting'
export const POSTFLOP_FOCUSES: readonly PostflopFocus[] = ['postflop-facing-bet', 'postflop-betting']
export type PostflopAction = 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface PostflopSpotInfo {
  street: Street
  /** Nobody has bet: you can check or bet. */
  canCheck: boolean
  canRaise: boolean
  equity: number
  /** Equity needed to call, when facing a bet. */
  needed: number | null
  opponents: number
  /** Flush draw or open-ended straight draw, with cards to come. */
  draw: boolean
  made: Made
  wetness: Wetness
  /** You made the last preflop raise. */
  aggressor: boolean
}

export interface PostflopGrade {
  focus: PostflopFocus
  correct: boolean
  severity: Severity
  chosen: PostflopAction
  best: PostflopAction
  acceptable: PostflopAction[]
  /** Plain-English reason with the numbers. */
  reason: string
  equity: number
  needed: number | null
}

/** Bet for value when checked to with at least this much equity. */
export const VALUE_EQUITY = 0.6
/** Raise for value when facing a bet with at least this much. */
export const RAISE_EQUITY = 0.7
/** Extra equity credited to draws for the money you win when they hit (implied odds). */
export const IMPLIED_ODDS = 0.05

export function postflopInfo(state: HandState, seat: number, eq: SpotEquity): PostflopSpotInfo {
  const legal = legalActions(state)
  const me = state.players[seat]
  const read = readHand(me.hole, state.board)
  return {
    street: state.street,
    canCheck: legal.canCheck,
    canRaise: legal.canRaise,
    equity: eq.equity,
    needed: eq.needed,
    opponents: eq.opponents,
    draw: state.board.length < 5 && (read.flushDraw || read.openEnded),
    made: read.made,
    wetness: boardTexture(state.board).wetness,
    aggressor: preflopSituation(state).lastRaiser === seat,
  }
}

/** Your decision as a postflop action, and its size as a fraction of the pot. */
export function postflopAction(state: HandState, d: Decision): { action: PostflopAction; fraction: number } {
  if (d.type !== 'raise') return { action: d.type, fraction: 0 }
  const me = state.players[state.toAct!]
  const pot = potSize(state)
  return { action: state.currentBet === 0 ? 'bet' : 'raise', fraction: (d.to - me.bet) / Math.max(1, pot) }
}

const pct = (x: number) => `${Math.round(x * 100)}%`
const sevOf = (gap: number): Exclude<Severity, 'none'> => (gap < 0.06 ? 'close' : gap < 0.15 ? 'clear' : 'blunder')
const worse = (s: Exclude<Severity, 'none'>): Exclude<Severity, 'none'> => (s === 'close' ? 'clear' : 'blunder')

export function gradePostflop(info: PostflopSpotInfo, chosen: PostflopAction, fraction = 0): PostflopGrade {
  const { equity: eq } = info
  const result = (
    focus: PostflopFocus,
    acceptable: PostflopAction[],
    best: PostflopAction,
    severity: Severity,
    reason: string,
  ): PostflopGrade => ({
    focus,
    correct: acceptable.includes(chosen),
    severity: acceptable.includes(chosen) ? 'none' : severity,
    chosen,
    best,
    acceptable,
    reason,
    equity: eq,
    needed: info.needed,
  })
  const headsUp = info.opponents === 1

  if (!info.canCheck) {
    // ---- Facing a bet: compare equity with the pot odds ----
    const needed = info.needed ?? 0
    const implied = info.draw ? IMPLIED_ODDS : 0
    const effective = eq + implied
    const drawNote = implied ? ` (+${pct(implied)} for your draw's implied odds)` : ''
    const semiBluff = info.draw && headsUp && info.canRaise && effective >= needed - 0.1
    if (effective >= needed) {
      const strong = eq >= RAISE_EQUITY && info.canRaise
      const acceptable: PostflopAction[] = strong || semiBluff ? ['call', 'raise'] : ['call']
      const best: PostflopAction = strong ? 'raise' : 'call'
      const gap = effective - needed
      if (chosen === 'fold')
        return result('postflop-facing-bet', acceptable, best, sevOf(gap), `You had about ${pct(eq)} equity${drawNote} and needed ${pct(needed)} to call. When your equity beats the price, calling wins over time.`)
      if (chosen === 'raise' && !acceptable.includes('raise'))
        return result('postflop-facing-bet', acceptable, best, 'close', `Calling is enough. With ${pct(eq)} equity you beat the price (${pct(needed)}) but aren't strong enough to raise for value: worse hands fold and better ones continue.`)
      return result(
        'postflop-facing-bet',
        acceptable,
        best,
        'none',
        strong
          ? `About ${pct(eq)} equity: you're well ahead of their likely hands. Raising for value is best; calling is fine too.`
          : `About ${pct(eq)} equity${drawNote} against ${pct(needed)} needed: a profitable call.`,
      )
    }
    const acceptable: PostflopAction[] = semiBluff ? ['fold', 'raise'] : ['fold']
    const gap = needed - effective
    if (chosen === 'call')
      return result('postflop-facing-bet', acceptable, 'fold', sevOf(gap), `You needed ${pct(needed)} equity to call but had about ${pct(eq)}${drawNote}. Calling here loses chips over time.`)
    if (chosen === 'raise' && !semiBluff)
      return result('postflop-facing-bet', acceptable, 'fold', worse(sevOf(gap)), `With about ${pct(eq)} equity you're behind their likely hands, and raising puts even more chips in. Fold, or raise only with a strong draw heads-up.`)
    return result(
      'postflop-facing-bet',
      acceptable,
      'fold',
      'none',
      chosen === 'raise'
        ? `A semi-bluff raise with a draw heads-up: they may fold, and you can still hit.`
        : `About ${pct(eq)} equity${drawNote} but a call needed ${pct(needed)}. A good fold.`,
    )
  }

  // ---- Checked to you (or first to act): bet or check ----
  const cbetSpot = info.aggressor && info.street === 'flop' && info.opponents <= 2 && info.wetness !== 'wet'
  const semiBluff = info.draw && info.opponents <= 2
  const pureBluff = headsUp && eq < 0.3
  if (eq >= VALUE_EQUITY) {
    const trap = eq >= 0.85 && info.wetness === 'dry' && info.street !== 'river'
    const acceptable: PostflopAction[] = trap ? ['bet', 'check'] : ['bet']
    if (chosen === 'check' && !trap)
      return result('postflop-betting', acceptable, 'bet', info.street === 'river' || eq >= 0.75 ? 'clear' : 'close', `About ${pct(eq)} equity: you're ahead of what they likely hold. Bet for value so worse hands pay you${info.street === 'river' ? '; on the river it is your last chance' : ''}.`)
    let reason = trap && chosen === 'check' ? `Very strong on a dry board: checking to trap is fine here, though betting is the default.` : `About ${pct(eq)} equity: a value bet.`
    if (chosen === 'bet' && info.wetness === 'wet' && fraction < 0.4) reason += ' On a wet board, bet bigger (½–¾ pot) to charge the draws.'
    return result('postflop-betting', acceptable, 'bet', 'none', reason)
  }
  const acceptable: PostflopAction[] = ['check']
  if (cbetSpot || semiBluff || pureBluff) acceptable.push('bet')
  if (chosen === 'bet' && !acceptable.includes('bet')) {
    if (info.opponents >= 3)
      return result('postflop-betting', acceptable, 'check', 'clear', `Betting without a strong hand into ${info.opponents} players rarely works: someone usually has something. Check.`)
    if (eq >= 0.3)
      return result('postflop-betting', acceptable, 'check', 'close', `About ${pct(eq)} equity is a medium hand: if you bet, worse hands fold and better ones call. Check and get to showdown cheaply.`)
    return result('postflop-betting', acceptable, 'check', 'close', `A bluff here has little going for it. Check.`)
  }
  let reason: string
  if (chosen === 'check') reason = `About ${pct(eq)} equity: not enough to bet for value. Checking is fine${acceptable.includes('bet') ? ', and a bet would also be reasonable here' : ''}.`
  else if (cbetSpot) reason = `A c-bet: you raised preflop and the ${info.wetness} board suits your range. Small sizes (⅓–½ pot) work well.`
  else if (semiBluff) reason = `A semi-bluff: they may fold now, and your draw can still win if called.`
  else reason = `A bluff with a weak hand heads-up: fine now and then. Bluff with hands that can't win at showdown, not medium ones.`
  return result('postflop-betting', acceptable, 'check', 'none', reason)
}

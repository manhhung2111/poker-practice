import { type Action, type Chart, type Mix, actionShares, findChart } from '../charts'
import { fourBetSize, openSize, threeBetSize } from '../dealing'
import { type Decision, type HandState, type LegalActions, BB, legalActions, potSize } from '../engine/game'
import { handClassOf } from '../hands'
import type { Rng } from '../random'
import { topPercent } from '../strength'
import { readHand } from './handRead'
import { type Personality, STYLES, type Style } from './personality'

export interface BotContext {
  /** Charts bots base their preflop play on (the app's defaults, not the user's edits). */
  charts: readonly Chart[]
  personality: Personality
  rng: Rng
}

/** Decides for the player whose turn it is. Always returns a legal decision. */
export function decide(state: HandState, ctx: BotContext): Decision {
  const legal = legalActions(state)
  const style = STYLES[ctx.personality]
  const wish = state.street === 'preflop' ? preflop(state, legal, style, ctx) : postflop(state, legal, style, ctx.rng)
  return legalize(wish, legal)
}

// ---------------------------------------------------------------------------
// Preflop
// ---------------------------------------------------------------------------

interface PreflopSituation {
  raises: number
  /** Seat of the first raiser, if any. */
  opener?: number
  /** Seat of the latest raiser. */
  lastRaiser?: number
  limpers: number
  /** Callers of the latest raise. */
  callers: number
}

export function preflopSituation(state: HandState): PreflopSituation {
  const sit: PreflopSituation = { raises: 0, limpers: 0, callers: 0 }
  for (const a of state.actions) {
    if (a.street !== 'preflop' || a.type === 'post') continue
    if (a.type === 'raise' || a.type === 'bet') {
      sit.raises++
      sit.opener ??= a.seat
      sit.lastRaiser = a.seat
      sit.callers = 0
    } else if (a.type === 'call') {
      if (sit.raises === 0) sit.limpers++
      else sit.callers++
    }
  }
  return sit
}

/** Picks an action from a chart mix. */
function sample(mix: Mix, rng: Rng): Action {
  let x = rng()
  for (const a of ['raise', 'call', 'fold'] as const) {
    x -= mix[a] ?? 0
    if (x < 0) return a
  }
  return 'fold'
}

/** Share of all starting hands a chart plays (raise + call), combo-weighted. */
function playShare(chart: Chart): number {
  const s = actionShares(chart)
  return s.raise + s.call
}

function preflop(state: HandState, legal: LegalActions, style: Style, ctx: BotContext): Decision {
  const me = state.players[legal.seat]
  const pos = me.position
  const hand = handClassOf(me.hole[0], me.hole[1])
  const top = topPercent(hand)
  const sit = preflopSituation(state)
  const rng = ctx.rng
  const posOf = (seat: number) => state.players[seat].position
  const raiseTo = (chips: number): Decision => ({ type: 'raise', to: Math.round(chips) })

  // ---- Nobody raised yet ----
  if (sit.raises === 0) {
    if (pos === 'BB') {
      // Limped pot: raise strong hands, otherwise check the option.
      return top <= 0.08 ? raiseTo(BB * (4 + sit.limpers)) : { type: 'check' }
    }
    const chart = findChart(ctx.charts, 'rfi', pos)
    let action: Action = chart ? sample(chart.strategy[hand], rng) : 'fold'
    action = adjust(action, chart, top, style, rng, 'rfi')
    if (action === 'raise') {
      const size = sit.limpers ? BB * (4 + sit.limpers) : openSize(pos) * BB
      return raiseTo(size)
    }
    if (style.limpChance && top <= 0.4 && rng() < style.limpChance) return { type: 'call' }
    return { type: 'fold' }
  }

  const lastRaiserPos = posOf(sit.lastRaiser!)
  // ---- Facing one raise ----
  if (sit.raises === 1) {
    const chart = findChart(ctx.charts, 'facing-open', pos, posOf(sit.opener!))
    let action: Action = chart ? sample(chart.strategy[hand], rng) : top <= 0.03 ? 'raise' : 'fold'
    action = adjust(action, chart, top, style, rng, 'facing-open')
    if (action === 'raise') {
      const base = threeBetSize(lastRaiserPos, pos) * BB
      return raiseTo(base + sit.callers * (state.currentBet))
    }
    return action === 'call' ? { type: 'call' } : { type: 'fold' }
  }

  // ---- Facing a 3-bet ----
  if (sit.raises === 2) {
    const iOpened = sit.opener === legal.seat
    const chart = iOpened ? findChart(ctx.charts, 'facing-3bet', pos, lastRaiserPos) : undefined
    let action: Action
    if (chart) action = sample(chart.strategy[hand], rng)
    else action = ['AA', 'KK'].includes(hand) ? 'raise' : ['QQ', 'AKs', 'AKo', 'JJ'].includes(hand) ? 'call' : 'fold'
    if (style.rangeKeep < 1 && action !== 'fold' && top > 0.03) action = 'fold'
    if (style.callToRaise && action === 'call' && rng() < style.callToRaise / 2) action = 'raise'
    if (style.looseCall && action === 'fold' && top <= 0.08) action = 'call'
    if (action === 'raise') return raiseTo(fourBetSize(state.currentBet / BB) * BB)
    return action === 'call' ? { type: 'call' } : { type: 'fold' }
  }

  // ---- Facing a 4-bet or more: premiums only ----
  if (['AA', 'KK'].includes(hand)) return raiseTo(legal.maxRaiseTo)
  if (['QQ', 'AKs'].includes(hand) || (style.callToRaise && ['JJ', 'AKo'].includes(hand))) return { type: 'call' }
  return { type: 'fold' }
}

/** Personality changes to the chart's choice. */
function adjust(
  action: Action,
  chart: Chart | undefined,
  top: number,
  style: Style,
  rng: Rng,
  spot: 'rfi' | 'facing-open',
): Action {
  // Nits drop the weaker part of the range.
  if (style.rangeKeep < 1 && action !== 'fold' && chart && top > playShare(chart) * style.rangeKeep) action = 'fold'
  // Some styles only 3-bet premiums and flat the rest.
  if (spot === 'facing-open' && action === 'raise' && top > style.threeBetTop) action = 'call'
  // Fish call a single raise with lots of hands.
  if (spot === 'facing-open' && action === 'fold' && style.looseCall && top <= style.looseCall) action = 'call'
  // Maniacs raise instead of calling, and raise extra hands.
  if (action === 'call' && rng() < style.callToRaise) action = 'raise'
  if (action === 'fold' && style.extraRaiseTop && top <= style.extraRaiseTop && rng() < style.extraRaiseChance) action = 'raise'
  return action
}

// ---------------------------------------------------------------------------
// Postflop
// ---------------------------------------------------------------------------

function postflop(state: HandState, legal: LegalActions, style: Style, rng: Rng): Decision {
  const me = state.players[legal.seat]
  const read = readHand(me.hole, state.board)
  const pot = potSize(state)
  const opponents = state.players.filter((p) => !p.folded && p.seat !== me.seat).length
  const sit = preflopSituation(state)
  const iAmAggressor = sit.lastRaiser === me.seat
  const valueHand = read.made === 'monster' || read.made === 'strong' || read.made === 'top-pair'
  const draw = read.flushDraw || read.openEnded
  const bet = (fraction: number): Decision => ({ type: 'raise', to: me.bet + Math.max(BB, Math.round(pot * fraction)) })

  if (legal.canCheck) {
    if (valueHand && rng() < style.valueBet) return bet(read.made === 'monster' ? 0.75 : 0.6)
    const firstToBetFlop = state.street === 'flop' && iAmAggressor
    if (firstToBetFlop && rng() < style.cbet / Math.max(1, opponents)) return bet(0.4)
    if (draw && rng() < style.semiBluff / Math.max(1, opponents - 0.5)) return bet(0.55)
    return { type: 'check' }
  }

  // Facing a bet: compare a rough win chance with the price.
  const price = legal.callAmount / (pot + legal.callAmount)
  if (read.made === 'monster') {
    return rng() < style.raiseMonster ? { type: 'raise', to: state.currentBet * 3 } : { type: 'call' }
  }
  if (read.made === 'strong' && rng() < style.raiseStrong) return { type: 'raise', to: state.currentBet * 3 }
  if (draw && style.semiBluff > 0.5 && rng() < style.semiBluff * 0.2) return { type: 'raise', to: state.currentBet * 3 }
  if (read.strength >= price + 0.08 + style.callMargin) return { type: 'call' }
  // Fish call with any pair.
  if (style.callMargin < -0.1 && read.made !== 'nothing') return { type: 'call' }
  return { type: 'fold' }
}

// ---------------------------------------------------------------------------

/** Turns a wish into a legal decision: clamps sizes, and swaps check/call/fold as needed. */
export function legalize(d: Decision, legal: LegalActions): Decision {
  if (d.type === 'raise') {
    if (!legal.canRaise) return legal.canCheck ? { type: 'check' } : { type: 'call' }
    let to = Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, d.to))
    // Going nearly all-in? Just shove.
    if (to >= legal.maxRaiseTo * 0.85) to = legal.maxRaiseTo
    return { type: 'raise', to }
  }
  if (d.type === 'call' && legal.toCall === 0) return { type: 'check' }
  if (d.type === 'check' && !legal.canCheck) return { type: 'fold' }
  if (d.type === 'fold' && legal.canCheck) return { type: 'check' }
  return d
}


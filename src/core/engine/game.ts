import { type Card, makeDeck, shuffle } from '../cards'
import type { Position } from '../positions'
import { type Rng, defaultRng } from '../random'
import { describe as describeScore, evaluate } from './evaluator'

/**
 * No-limit hold'em hand engine (design §9.4).
 *
 * Chips are integers: 1 big blind = 10 chips (so 2.5bb = 25, 0.5bb = 5).
 * State is immutable: `act` returns a new state.
 */
export const BB = 10
export const SB = 5
export const toBB = (chips: number) => chips / BB

export type Street = 'preflop' | 'flop' | 'turn' | 'river'
export const STREETS: readonly Street[] = ['preflop', 'flop', 'turn', 'river']

export interface PlayerState {
  seat: number
  name: string
  position: Position
  stack: number
  hole: [Card, Card]
  folded: boolean
  allIn: boolean
  /** Chips put in on the current street. */
  bet: number
  /** Chips put in this hand. */
  committed: number
  /** Has acted since the street started or the last full raise. */
  acted: boolean
}

export type ActionType = 'post' | 'fold' | 'check' | 'call' | 'bet' | 'raise'

export interface HandAction {
  seat: number
  position: Position
  street: Street
  type: ActionType
  /** For bet/raise/post: the player's total bet on this street after acting. For call: chips added. */
  amount: number
  allIn: boolean
}

export interface Pot {
  amount: number
  eligible: number[]
  winners: number[]
  /** Winning hand description at showdown. */
  hand?: string
}

export interface HandResult {
  reason: 'fold' | 'showdown'
  pots: Pot[]
  /** Chips won per seat (including chips returned). */
  payouts: Record<number, number>
  /** Seats whose cards were shown, with their hand description. */
  shown: Record<number, string>
}

export interface HandState {
  players: PlayerState[]
  button: number
  street: Street
  board: Card[]
  deck: Card[]
  /** Highest bet on this street. */
  currentBet: number
  /** Size of the last full raise on this street (the minimum raise increment). */
  lastRaise: number
  /** Seat to act, or null when the hand is over. */
  toAct: number | null
  actions: HandAction[]
  result: HandResult | null
}

/** Position names by distance from the button, for 3–9 players. */
export function positionsFor(n: number): Position[] {
  if (n < 3 || n > 9) throw new Error(`Tables need 3–9 players, got ${n}`)
  const early: Position[] = ['UTG', 'UTG+1', 'MP', 'LJ', 'HJ', 'CO']
  return ['BTN', 'SB', 'BB', ...early.slice(early.length - (n - 3))]
}

export interface StartOptions {
  names: string[]
  stacks: number[]
  /** Seat index of the dealer button. */
  button: number
  rng?: Rng
  /** Fixed deck order (tests). Cards are dealt from the start. */
  deck?: Card[]
}

export function startHand(opts: StartOptions): HandState {
  const n = opts.names.length
  if (opts.stacks.length !== n) throw new Error('names and stacks differ in length')
  if (opts.stacks.some((s) => s <= 0)) throw new Error('Every player needs chips')
  const posNames = positionsFor(n)
  const deck = opts.deck ? [...opts.deck] : shuffle(makeDeck(), opts.rng ?? defaultRng)

  // Deal two cards each, starting left of the button.
  const holes: Card[][] = Array.from({ length: n }, () => [])
  for (let round = 0; round < 2; round++)
    for (let i = 1; i <= n; i++) holes[(opts.button + i) % n].push(deck.shift()!)

  const players: PlayerState[] = opts.names.map((name, seat) => ({
    seat,
    name,
    position: posNames[(seat - opts.button + n) % n],
    stack: opts.stacks[seat],
    hole: holes[seat] as [Card, Card],
    folded: false,
    allIn: false,
    bet: 0,
    committed: 0,
    acted: false,
  }))

  let state: HandState = {
    players,
    button: opts.button,
    street: 'preflop',
    board: [],
    deck,
    currentBet: 0,
    lastRaise: BB,
    toAct: null,
    actions: [],
    result: null,
  }
  state = post(state, (opts.button + 1) % n, SB)
  state = post(state, (opts.button + 2) % n, BB)
  state.currentBet = BB
  state.toAct = nextToAct(state, (opts.button + 2) % n)
  return state
}

function post(state: HandState, seat: number, amount: number): HandState {
  const players = state.players.map((p) => ({ ...p }))
  const p = players[seat]
  const paid = Math.min(amount, p.stack)
  p.stack -= paid
  p.bet += paid
  p.committed += paid
  p.allIn = p.stack === 0
  return {
    ...state,
    players,
    actions: [...state.actions, { seat, position: p.position, street: 'preflop', type: 'post', amount: p.bet, allIn: p.allIn }],
  }
}

/** Players who can still make decisions. */
const canAct = (p: PlayerState) => !p.folded && !p.allIn
const live = (s: HandState) => s.players.filter((p) => !p.folded)

/** Next seat after `from` that still needs to act this street, or null if the street is done. */
function nextToAct(state: HandState, from: number): number | null {
  const n = state.players.length
  for (let i = 1; i <= n; i++) {
    const p = state.players[(from + i) % n]
    if (canAct(p) && (!p.acted || p.bet < state.currentBet)) return p.seat
  }
  return null
}

export interface LegalActions {
  seat: number
  /** Chips needed to call (0 = can check). */
  toCall: number
  canCheck: boolean
  /** Chips actually added by calling (may be less than toCall when all-in). */
  callAmount: number
  canRaise: boolean
  /** Raise/bet "to" limits: total bet on this street. */
  minRaiseTo: number
  maxRaiseTo: number
}

export function legalActions(state: HandState): LegalActions {
  if (state.toAct === null) throw new Error('Nobody is to act: the hand or street is over')
  const p = state.players[state.toAct]
  const toCall = Math.max(0, state.currentBet - p.bet)
  const callAmount = Math.min(toCall, p.stack)
  const maxRaiseTo = p.bet + p.stack
  const others = state.players.filter((o) => o.seat !== p.seat && canAct(o))
  // A player may raise if they have chips beyond a call, someone can still respond,
  // and betting is open to them (they haven't acted since the last full raise).
  const canRaise = p.stack > toCall && others.length > 0 && !p.acted
  const minRaiseTo = Math.min(maxRaiseTo, state.currentBet + Math.max(state.lastRaise, BB))
  return { seat: p.seat, toCall, canCheck: toCall === 0, callAmount, canRaise, minRaiseTo, maxRaiseTo }
}

export type Decision = { type: 'fold' } | { type: 'check' } | { type: 'call' } | { type: 'raise'; to: number }

export class IllegalAction extends Error {}

export function act(state: HandState, d: Decision): HandState {
  const legal = legalActions(state)
  const seat = legal.seat
  const players = state.players.map((p) => ({ ...p }))
  const p = players[seat]
  let { currentBet, lastRaise } = state
  let action: HandAction

  switch (d.type) {
    case 'fold':
      p.folded = true
      p.acted = true
      action = { seat, position: p.position, street: state.street, type: 'fold', amount: 0, allIn: false }
      break
    case 'check':
      if (!legal.canCheck) throw new IllegalAction(`${p.name} can't check: ${legal.toCall} to call`)
      p.acted = true
      action = { seat, position: p.position, street: state.street, type: 'check', amount: 0, allIn: false }
      break
    case 'call': {
      if (legal.toCall === 0) throw new IllegalAction(`${p.name} has nothing to call; check instead`)
      const add = legal.callAmount
      p.stack -= add
      p.bet += add
      p.committed += add
      p.allIn = p.stack === 0
      p.acted = true
      action = { seat, position: p.position, street: state.street, type: 'call', amount: add, allIn: p.allIn }
      break
    }
    case 'raise': {
      if (!legal.canRaise) throw new IllegalAction(`${p.name} can't raise here`)
      const to = d.to
      if (!Number.isInteger(to)) throw new IllegalAction('Bet sizes must be whole chips')
      if (to > legal.maxRaiseTo) throw new IllegalAction(`${p.name} only has ${legal.maxRaiseTo} in total`)
      const allIn = to === legal.maxRaiseTo
      if (to < legal.minRaiseTo && !allIn) throw new IllegalAction(`Minimum raise is to ${legal.minRaiseTo}`)
      if (to <= currentBet) throw new IllegalAction('A raise must be bigger than the current bet')
      const add = to - p.bet
      const increment = to - currentBet
      const fullRaise = increment >= Math.max(lastRaise, BB) || currentBet === 0
      p.stack -= add
      p.bet = to
      p.committed += add
      p.allIn = p.stack === 0
      p.acted = true
      if (fullRaise) {
        lastRaise = Math.max(increment, BB)
        // Betting reopens for everyone else.
        for (const o of players) if (o.seat !== seat && canAct(o)) o.acted = false
      }
      const type: ActionType = currentBet === 0 ? 'bet' : 'raise'
      currentBet = to
      action = { seat, position: p.position, street: state.street, type, amount: to, allIn: p.allIn }
      break
    }
  }

  const next: HandState = { ...state, players, currentBet, lastRaise, actions: [...state.actions, action] }
  return advance(next, seat)
}

/** After an action: move to the next player, the next street, or finish the hand. */
function advance(state: HandState, lastSeat: number): HandState {
  if (live(state).length === 1) return finish(state, 'fold')
  const toAct = nextToAct(state, lastSeat)
  if (toAct !== null) return { ...state, toAct }

  // Street complete.
  const stillActing = state.players.filter(canAct).length
  if (state.street === 'river' || stillActing <= 1) {
    // Everyone left is all-in (or one player has no one to bet against): run out the board.
    let s = state
    while (s.board.length < 5) s = dealStreet(s)
    return finish(s, 'showdown')
  }
  const s = dealStreet(state)
  return { ...s, toAct: nextToAct(s, s.button) }
}

function dealStreet(state: HandState): HandState {
  const deck = [...state.deck]
  const count = state.board.length === 0 ? 3 : 1
  deck.shift() // burn
  const board = [...state.board, ...deck.splice(0, count)]
  const street = STREETS[STREETS.indexOf(state.street) + 1] ?? 'river'
  const players = state.players.map((p) => ({ ...p, bet: 0, acted: false }))
  return { ...state, deck, board, street, players, currentBet: 0, lastRaise: BB }
}

/** Splits the chips into a main pot and side pots by how much each player put in. */
export function buildPots(players: readonly PlayerState[]): Pot[] {
  const levels = [...new Set(players.filter((p) => !p.folded && p.committed > 0).map((p) => p.committed))].sort((a, b) => a - b)
  const maxCommitted = Math.max(...players.map((p) => p.committed))
  if (!levels.length || levels[levels.length - 1] < maxCommitted) levels.push(maxCommitted)
  const pots: Pot[] = []
  let prev = 0
  for (const level of levels) {
    const amount = players.reduce((sum, p) => sum + Math.max(0, Math.min(p.committed, level) - prev), 0)
    let eligible = players.filter((p) => !p.folded && p.committed >= level).map((p) => p.seat)
    // Safety net: chips nobody live reached go to everyone still in the hand.
    if (!eligible.length) eligible = players.filter((p) => !p.folded).map((p) => p.seat)
    prev = level
    if (amount === 0) continue
    const last = pots[pots.length - 1]
    if (last && last.eligible.join() === eligible.join()) last.amount += amount
    else pots.push({ amount, eligible, winners: [] })
  }
  return pots
}

function finish(state: HandState, reason: HandResult['reason']): HandState {
  const n = state.players.length
  const players = state.players.map((p) => ({ ...p, bet: 0 }))
  const pots = buildPots(players)
  const payouts: Record<number, number> = {}
  const shown: Record<number, string> = {}
  const scores = new Map<number, number>()

  if (reason === 'showdown') {
    for (const p of players) {
      if (p.folded) continue
      const sc = evaluate([...p.hole, ...state.board])
      scores.set(p.seat, sc)
      shown[p.seat] = describeScore(sc)
    }
  }

  for (const pot of pots) {
    let winners: number[]
    if (pot.eligible.length === 1) winners = pot.eligible
    else {
      const best = Math.max(...pot.eligible.map((s) => scores.get(s) ?? -1))
      winners = pot.eligible.filter((s) => scores.get(s) === best)
      pot.hand = describeScore(best)
    }
    pot.winners = winners
    // Split evenly; odd chips go to the winners closest to the left of the button.
    const share = Math.floor(pot.amount / winners.length)
    let odd = pot.amount - share * winners.length
    const ordered = [...winners].sort((a, b) => ((a - state.button + n) % n || n) - ((b - state.button + n) % n || n))
    for (const s of ordered) {
      const extra = odd > 0 ? 1 : 0
      odd -= extra
      payouts[s] = (payouts[s] ?? 0) + share + extra
    }
  }
  for (const [seat, chips] of Object.entries(payouts)) players[Number(seat)].stack += chips

  return { ...state, players, toAct: null, result: { reason, pots, payouts, shown } }
}

/** Total chips in the middle (all bets this hand). */
export const potSize = (state: HandState) => state.players.reduce((s, p) => s + p.committed, 0)

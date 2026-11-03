import { fourBetSize, openSize, threeBetSize } from '../../core/dealing'
import { type HandState, type LegalActions, BB, potSize } from '../../core/engine/game'
import { preflopSituation } from '../../core/bots/brain'

export interface SizeOption {
  label: string
  to: number
}

/**
 * Quick bet sizes for your raise button (design §9.5): standard preflop sizes from
 * §3, and pot fractions after the flop. Clamped to what's legal; duplicates removed.
 */
export function quickSizes(state: HandState, legal: LegalActions): SizeOption[] {
  const me = state.players[legal.seat]
  const clamp = (to: number) => Math.max(legal.minRaiseTo, Math.min(legal.maxRaiseTo, Math.round(to)))
  const opts: SizeOption[] = []
  if (state.street === 'preflop') {
    const sit = preflopSituation(state)
    const pos = (seat: number) => state.players[seat].position
    if (sit.raises === 0) {
      const open = openSize(me.position) * BB + sit.limpers * BB
      opts.push({ label: 'Standard', to: open }, { label: '3bb', to: 3 * BB + sit.limpers * BB }, { label: '4bb', to: 4 * BB + sit.limpers * BB })
    } else if (sit.raises === 1) {
      const std = threeBetSize(pos(sit.lastRaiser!), me.position) * BB + sit.callers * state.currentBet
      opts.push({ label: 'Standard', to: std }, { label: '3×', to: state.currentBet * 3 }, { label: '4×', to: state.currentBet * 4 })
    } else {
      opts.push({ label: 'Standard', to: fourBetSize(state.currentBet / BB) * BB }, { label: '2.5×', to: state.currentBet * 2.5 })
    }
  } else {
    const pot = potSize(state)
    if (state.currentBet === 0) {
      for (const [label, f] of [['⅓ pot', 1 / 3], ['½ pot', 1 / 2], ['⅔ pot', 2 / 3], ['Pot', 1]] as const) opts.push({ label, to: pot * f })
    } else {
      // Pot-size raise: call, then raise the size of the pot after the call.
      const call = state.currentBet - me.bet
      opts.push({ label: '2.5×', to: state.currentBet * 2.5 }, { label: '3×', to: state.currentBet * 3 }, { label: 'Pot', to: state.currentBet + pot + call })
    }
  }
  opts.push({ label: 'All-in', to: legal.maxRaiseTo })
  const seen = new Set<number>()
  return opts
    .map((o) => ({ ...o, to: clamp(o.to) }))
    .filter((o) => {
      if (seen.has(o.to)) return false
      seen.add(o.to)
      return true
    })
}

/** Chips → "2.5bb". */
export const bb = (chips: number) => `${+(chips / BB).toFixed(1)}bb`

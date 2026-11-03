import { describe, expect, it } from 'vitest'
import { type Decision, type HandState, act, legalActions, startHand } from '../../core/engine/game'
import { stackDeck } from '../../core/engine/testDeck'
import { bb, quickSizes } from './sizes'

const names = Array.from({ length: 9 }, (_, i) => `p${i}`)
const table = () => startHand({ names, stacks: Array(9).fill(1000), button: 0, deck: stackDeck(9, 0, {}) })
const play = (s: HandState, ...ds: Decision[]) => ds.reduce(act, s)
const fold: Decision = { type: 'fold' }

describe('quick sizes', () => {
  it('offers a 2.5bb open first to act', () => {
    const s = table()
    expect(quickSizes(s, legalActions(s)).map((o) => [o.label, o.to])).toEqual([
      ['Standard', 25],
      ['3bb', 30],
      ['4bb', 40],
      ['All-in', 1000],
    ])
  })

  it('offers an in-position 3-bet of 3× facing an open', () => {
    const s = play(table(), { type: 'raise', to: 25 }) // UTG opens; UTG+1 to act
    expect(quickSizes(s, legalActions(s))[0]).toEqual({ label: 'Standard', to: 75 })
  })

  it('offers pot fractions after the flop', () => {
    const s = play(table(), ...Array(6).fill(fold), { type: 'raise', to: 25 }, fold, { type: 'call' }) // BTN vs BB
    expect(s.street).toBe('flop')
    expect(quickSizes(s, legalActions(s)).map((o) => o.label)).toEqual(['⅓ pot', '½ pot', '⅔ pot', 'Pot', 'All-in'])
    expect(quickSizes(s, legalActions(s))[3].to).toBe(55) // pot = 25 + 25 + 5
  })

  it('formats chips as big blinds', () => {
    expect(bb(25)).toBe('2.5bb')
    expect(bb(100)).toBe('10bb')
  })
})

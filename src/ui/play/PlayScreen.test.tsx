// @vitest-environment jsdom
/**
 * Plays real hands through the Play screen in a simulated browser: bots act, your
 * buttons appear, hands finish with a review, and chart spots are graded and logged.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AnswerLog } from '../../core/log'
import { DEFAULT_CHARTS } from '../../data/charts'
import { PlayScreen } from './PlayScreen'

afterEach(cleanup)

describe('Play screen', () => {
  it('plays 30 hands end to end', async () => {
    localStorage.setItem('poker-trainer:play-settings', JSON.stringify({ speed: 'instant', skipTrivial: false, hints: true }))
    const logged: AnswerLog[] = []
    const errors = vi.spyOn(console, 'error')
    render(<PlayScreen charts={DEFAULT_CHARTS} active onLogAnswer={(e) => logged.push(e)} />)

    let hands = 0
    let actions = 0
    for (let guard = 0; guard < 2000 && hands < 30; guard++) {
      await waitFor(() => {
        const ready = screen.queryByRole('dialog', { name: 'Hand review' }) || screen.queryByRole('button', { name: /^(Call|Check)/ })
        expect(ready).toBeTruthy()
      })
      const next = screen.queryByRole('button', { name: 'Next hand' })
      if (next) {
        expect(screen.getByText('Your decisions')).toBeTruthy()
        fireEvent.click(next)
        hands++
        continue
      }
      // Mix of plays: raise sometimes, call/check otherwise, fold now and then.
      const r = (actions++ * 7) % 10
      const raise = screen.queryByRole('button', { name: /^(Raise|Bet) ▸/ })
      const fold = screen.queryByRole('button', { name: 'Fold' })
      if (r < 2 && raise) {
        fireEvent.click(raise)
        fireEvent.click(screen.getByRole('button', { name: /^(Raise to|Bet) / }))
      } else if (r < 4 && fold) {
        fireEvent.click(fold)
      } else {
        fireEvent.click(screen.getByRole('button', { name: /^(Call|Check)/ }))
      }
    }

    expect(hands).toBe(30)
    expect(logged.length).toBeGreaterThan(0)
    expect(logged.every((e) => e.source === 'play')).toBe(true)
    expect(errors).not.toHaveBeenCalled()
    // The session result is saved for next time.
    const saved = JSON.parse(localStorage.getItem('poker-trainer:table')!)
    expect(saved.handsPlayed).toBe(30)
  }, 60_000)
})

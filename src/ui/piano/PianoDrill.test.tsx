// @vitest-environment jsdom
/** Drives the piano drill: answering, ignoring taps during feedback, and finishing a session. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Prompt } from '../../core/piano/notes'
import { PianoDrill } from './PianoDrill'
import { DEFAULT_PIANO_SETTINGS } from './settings'

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Piano drill', () => {
  it('grades a tap once, ignores taps during feedback, and ends the session', () => {
    const answers: { p: Prompt; correct: boolean }[] = []
    render(
      <PianoDrill
        settings={{ ...DEFAULT_PIANO_SETTINGS, length: 2 }}
        stats={{}}
        active
        onAnswer={(p, correct) => answers.push({ p, correct })}
        onExit={() => {}}
      />,
    )
    expect(screen.getByText('1 / 2')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    fireEvent.click(screen.getByRole('button', { name: 'D' }))
    expect(answers).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toMatch(answers[0].correct ? /✓/ : /^It's/)

    act(() => vi.advanceTimersByTime(1600))
    expect(screen.getByText('2 / 2')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'E' }))
    expect(answers).toHaveLength(2)

    act(() => vi.advanceTimersByTime(1600))
    expect(screen.getByText('Session done')).toBeTruthy()
    const right = answers.filter((a) => a.correct).length
    expect(screen.getByText(`/2`)).toBeTruthy()
    expect(screen.getByText(new RegExp(`^${right * 50}% right`))).toBeTruthy()
  })
})

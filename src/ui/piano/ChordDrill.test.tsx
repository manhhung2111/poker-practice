// @vitest-environment jsdom
/** Drives Chords: select keys, Check, feedback lock-out, session end. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Chord } from '../../core/piano/chords'
import { ChordDrill } from './ChordDrill'
import { DEFAULT_PIANO_SETTINGS, type PianoSettings } from './settings'

const settings: PianoSettings = { ...DEFAULT_PIANO_SETTINGS, mode: 'chord', lengths: { ...DEFAULT_PIANO_SETTINGS.lengths, chord: 1 } }
const key = (name: string) => screen.getByRole('button', { name })
const check = () => screen.getByRole('button', { name: 'Check' })

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Chords', () => {
  it('toggles keys, grades once on Check, then ends the session', () => {
    const graded: { c: Chord; ok: boolean }[] = []
    render(<ChordDrill settings={settings} chordStats={{}} active onChord={(c, ok) => graded.push({ c, ok })} onExit={() => {}} />)
    expect((check() as HTMLButtonElement).disabled).toBe(true)

    fireEvent.click(key('C'))
    expect(key('C').className).toContain('selected')
    fireEvent.click(key('C'))
    expect(key('C').className).not.toContain('selected')

    for (const k of ['C', 'E', 'G']) fireEvent.click(key(k))
    fireEvent.click(check())
    expect(graded).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toMatch(/(major|minor):/)
    fireEvent.click(key('A'))
    fireEvent.click(check())
    expect(graded).toHaveLength(1)

    act(() => vi.advanceTimersByTime(2000))
    expect(screen.getByText('Session done')).toBeTruthy()
    expect(screen.getByText('/1')).toBeTruthy()
  })

  it('marks missed chord keys after a wrong answer', () => {
    render(<ChordDrill settings={settings} chordStats={{}} active onChord={() => {}} onExit={() => {}} />)
    // A chord never contains both C♯ and D, so this answer is always wrong.
    fireEvent.click(key('C♯'))
    fireEvent.click(key('D'))
    fireEvent.click(check())
    expect(document.querySelectorAll('.key.missed').length + document.querySelectorAll('.key.right').length).toBe(3)
    expect(document.querySelectorAll('.key.wrong').length).toBeGreaterThanOrEqual(1)
  })
})

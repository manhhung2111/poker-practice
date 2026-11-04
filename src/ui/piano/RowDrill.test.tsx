// @vitest-environment jsdom
/** Drives Read a row: six answers per row, no stopping on mistakes, row results, session end. */
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { RowDrill } from './RowDrill'
import { DEFAULT_PIANO_SETTINGS, type PianoSettings } from './settings'

const settings: PianoSettings = { ...DEFAULT_PIANO_SETTINGS, mode: 'row', lengths: { ...DEFAULT_PIANO_SETTINGS.lengths, row: 1 } }

beforeEach(() => vi.useFakeTimers())
afterEach(() => {
  cleanup()
  vi.useRealTimers()
})

describe('Read a row', () => {
  it('takes six answers, keeps going after mistakes, then reports the row and ends', () => {
    const notes: boolean[] = []
    const rows: [number, number, number][] = []
    render(<RowDrill settings={settings} active onNote={(_p, ok) => notes.push(ok)} onRow={(r, t, ms) => rows.push([r, t, ms])} onExit={() => {}} />)
    expect(screen.getByText('Row 1 / 1')).toBeTruthy()

    for (let i = 0; i < 6; i++) {
      act(() => vi.advanceTimersByTime(500))
      fireEvent.click(screen.getByRole('button', { name: i % 2 ? 'C♯' : 'D' }))
    }
    expect(notes).toHaveLength(6)
    fireEvent.click(screen.getByRole('button', { name: 'E' }))
    expect(notes).toHaveLength(6)
    expect(rows).toHaveLength(1)
    expect(rows[0][0]).toBe(notes.filter(Boolean).length)
    expect(rows[0][1]).toBe(6)
    expect(rows[0][2]).toBe(3000)

    act(() => vi.advanceTimersByTime(700))
    expect(screen.getByText('Session done')).toBeTruthy()
    expect(screen.getByText('/6')).toBeTruthy()
  })

  it("doesn't count time spent away from the drill", () => {
    const ms: number[] = []
    const { rerender } = render(<RowDrill settings={settings} active={false} onNote={(_p, _ok, t) => ms.push(t)} onRow={() => {}} onExit={() => {}} />)
    act(() => vi.advanceTimersByTime(10000))
    rerender(<RowDrill settings={settings} active onNote={(_p, _ok, t) => ms.push(t)} onRow={() => {}} onExit={() => {}} />)
    act(() => vi.advanceTimersByTime(400))
    fireEvent.click(screen.getByRole('button', { name: 'C' }))
    expect(ms[0]).toBeLessThan(1000)
  })
})

import { describe, expect, it } from 'vitest'
import { type Action, type ChartSpot, compileChart, findChart } from './charts'
import { grade, severityOf } from './grading'
import { DEFAULT_CHARTS } from '../data/charts'
import type { Position } from './positions'

const g = (spot: ChartSpot, hero: Position, villain: Position | undefined, hand: string, chosen: Action) =>
  grade(findChart(DEFAULT_CHARTS, spot, hero, villain)!, hand, chosen)

describe('grade', () => {
  it('marks chart actions as correct with no severity', () => {
    const r = g('rfi', 'UTG', undefined, 'AA', 'raise')
    expect(r).toMatchObject({ correct: true, best: 'raise', severity: 'none', depth: 0 })
    expect(g('rfi', 'UTG', undefined, '72o', 'fold').correct).toBe(true)
  })

  it('rates folding premium hands as blunders', () => {
    expect(g('rfi', 'UTG', undefined, 'AA', 'fold').severity).toBe('blunder')
    expect(g('rfi', 'UTG', undefined, 'QQ', 'fold').severity).toBe('blunder')
    expect(g('rfi', 'BTN', undefined, 'AKs', 'fold').severity).toBe('blunder')
    expect(g('facing-open', 'BB', 'BTN', 'KK', 'fold').severity).toBe('blunder')
  })

  it('rates playing trash as a blunder', () => {
    expect(g('rfi', 'UTG', undefined, '72o', 'raise').severity).toBe('blunder')
    expect(g('facing-open', 'BB', 'BTN', '72o', 'call').severity).toBe('blunder')
  })

  it('rates hands at the edge of a range as close spots', () => {
    expect(g('rfi', 'UTG', undefined, 'KJo', 'raise').severity).toBe('close')
    expect(g('rfi', 'UTG', undefined, '77', 'fold').severity).toBe('close')
    expect(g('rfi', 'BTN', undefined, 'K7o', 'raise').severity).toBe('close')
    expect(g('facing-open', 'MP', 'UTG', 'KQo', 'call').severity).toBe('close')
  })

  it('caps call-vs-raise mix-ups at "clear"', () => {
    const r = g('facing-3bet', 'UTG', 'CO', 'AA', 'call')
    expect(r.correct).toBe(false)
    expect(r.best).toBe('raise')
    expect(r.severity).toBe('clear')
  })

  it('accepts any action of a mixed hand', () => {
    const chart = compileChart({
      id: 't',
      spot: 'facing-open',
      title: 'Test',
      hero: ['BB'],
      villain: ['BTN'],
      keyIdea: 'Test chart for mixed hands',
      actions: { raise: 'AA' },
      mixed: { AQo: { call: 0.6, raise: 0.4 } },
    })
    expect(grade(chart, 'AQo', 'call').correct).toBe(true)
    expect(grade(chart, 'AQo', 'raise').correct).toBe(true)
    const wrong = grade(chart, 'AQo', 'fold')
    expect(wrong.correct).toBe(false)
    expect(wrong.best).toBe('call')
    expect(wrong.correctActions).toEqual(['raise', 'call'])
  })

  it('treats an action never used in the chart as a blunder', () => {
    const chart = compileChart({ id: 't', spot: 'rfi', title: 'Test', hero: ['UTG'], keyIdea: 'Test chart, raise only', actions: { raise: 'AA' } })
    expect(grade(chart, 'KK', 'call').severity).toBe('blunder')
  })

  it('maps depth to severity at the thresholds', () => {
    expect(severityOf(0)).toBe('close')
    expect(severityOf(0.2)).toBe('close')
    expect(severityOf(0.3)).toBe('clear')
    expect(severityOf(0.45)).toBe('clear')
    expect(severityOf(0.9)).toBe('blunder')
  })

  it('every wrong answer in every chart gets a severity and depth in [0, 1]', () => {
    for (const c of DEFAULT_CHARTS) {
      for (const h of Object.keys(c.strategy)) {
        for (const a of ['fold', 'call', 'raise'] as const) {
          const r = grade(c, h, a)
          expect(r.depth).toBeGreaterThanOrEqual(0)
          expect(r.depth).toBeLessThanOrEqual(1)
          expect(r.correct ? r.severity === 'none' : r.severity !== 'none').toBe(true)
        }
      }
    }
  })
})

import { describe, expect, it } from 'vitest'
import { accuracy, dailyTrend, groupTally, handTallies, lastDays, mostMissed, tally, weakest } from './stats'
import { entry } from './testLog'

const DAY = 86_400_000
const now = new Date(2026, 10, 3, 18).getTime()

describe('stats', () => {
  it('tallies accuracy', () => {
    const t = tally([entry(), entry({ correct: false }), entry()])
    expect(t).toEqual({ answered: 3, correct: 2 })
    expect(accuracy(t)).toBeCloseTo(2 / 3)
    expect(accuracy({ answered: 0, correct: 0 })).toBe(0)
  })

  it('builds a 7-day trend including empty days', () => {
    const log = [entry({ at: now }), entry({ at: now - DAY, correct: false }), entry({ at: now - 10 * DAY })]
    const t = dailyTrend(log, now, 7)
    expect(t).toHaveLength(7)
    expect(t[6]).toMatchObject({ answered: 1, correct: 1 })
    expect(t[5]).toMatchObject({ answered: 1, correct: 0 })
    expect(t.slice(0, 5).every((d) => d.answered === 0)).toBe(true)
    expect(lastDays(log, now, 7)).toHaveLength(2)
  })

  it('groups and finds the weakest group (needs 10+ answers)', () => {
    const log = [
      ...Array.from({ length: 10 }, (_, i) => entry({ hero: 'UTG', correct: i < 9 })),
      ...Array.from({ length: 10 }, (_, i) => entry({ hero: 'BTN', correct: i < 6 })),
      ...Array.from({ length: 3 }, () => entry({ hero: 'SB', correct: false })),
    ]
    const g = groupTally(log, (e) => e.hero, ['UTG', 'CO', 'BTN', 'SB'])
    expect(g.map((x) => x.key)).toEqual(['UTG', 'CO', 'BTN', 'SB'])
    expect(g[1]).toMatchObject({ answered: 0 })
    expect(weakest(g)).toBe('BTN') // SB is worse but has only 3 answers
  })

  it('tallies hands per chart for the heatmap', () => {
    const m = handTallies([entry({ hand: 'KJo', correct: false }), entry({ hand: 'KJo' }), entry({ chartId: 'x', hand: 'KJo' })], 'rfi/utg')
    expect(m.get('KJo')).toEqual({ answered: 2, correct: 1 })
  })

  it('lists the most-missed hands', () => {
    const log = [
      entry({ hand: 'KJo', correct: false }),
      entry({ hand: 'KJo', correct: false }),
      entry({ hand: 'A9o', correct: false }),
      entry({ hand: 'AA' }),
    ]
    expect(mostMissed(log)).toEqual([
      { chartId: 'rfi/utg', hand: 'KJo', misses: 2, answered: 2 },
      { chartId: 'rfi/utg', hand: 'A9o', misses: 1, answered: 1 },
    ])
  })
})

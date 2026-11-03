import { describe, expect, it } from 'vitest'
import { buildReviews, dueItems, queuedItems, reviewKey } from './review'
import { entry } from './testLog'

const miss = (hand = 'KJo') => entry({ hand, correct: false, chosen: 'raise', best: 'fold', severity: 'close' })
const hit = (hand = 'KJo') => entry({ hand, correct: true, chosen: 'fold', best: 'fold' })
const filler = (n: number) => Array.from({ length: n }, () => entry({ hand: 'AA' }))

describe('spaced repetition', () => {
  it('a miss comes back after 3 hands', () => {
    const q1 = buildReviews([miss(), ...filler(1)])
    expect(dueItems(q1)).toEqual([])
    const q2 = buildReviews([miss(), ...filler(2)])
    expect(dueItems(q2).map((i) => i.hand)).toEqual(['KJo'])
  })

  it('correct answers push it out 10, 30, 100 hands, then it leaves the queue', () => {
    const log = [miss(), hit()]
    let q = buildReviews(log)
    expect(q.items.get(reviewKey('rfi/utg', 'KJo'))).toMatchObject({ step: 1, due: 2 + 10 })
    log.push(hit())
    q = buildReviews(log)
    expect(q.items.get(reviewKey('rfi/utg', 'KJo'))).toMatchObject({ step: 2, due: 3 + 30 })
    log.push(hit())
    expect(buildReviews(log).items.get(reviewKey('rfi/utg', 'KJo'))).toMatchObject({ step: 3, due: 4 + 100 })
    log.push(hit())
    expect(buildReviews(log).items.size).toBe(0)
  })

  it('a new miss restarts the schedule', () => {
    const q = buildReviews([miss(), hit(), hit(), miss()])
    expect(q.items.get(reviewKey('rfi/utg', 'KJo'))).toMatchObject({ step: 0, due: 4 + 3 })
  })

  it('correct answers on hands never missed add nothing', () => {
    expect(buildReviews(filler(20)).items.size).toBe(0)
  })

  it('orders due items by how overdue they are, and queued items by due time', () => {
    const q = buildReviews([miss('A'.concat('9o')), miss('KJo'), ...filler(10)])
    expect(dueItems(q).map((i) => i.hand)).toEqual(['A9o', 'KJo'])
    expect(queuedItems(q)).toHaveLength(2)
  })
})

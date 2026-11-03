import { describe, expect, it } from 'vitest'
import type { Card } from '../cards'
import { readHand } from './handRead'

const read = (hole: string, board: string) => readHand(hole.split(' ') as Card[], board.split(' ') as Card[])

describe('readHand', () => {
  it('rates made hands relative to the board', () => {
    expect(read('7c 7d', 'Kh 7s 2d').made).toBe('monster') // set
    expect(read('Ac Ad', 'Kh 7s 2d').made).toBe('strong') // overpair
    expect(read('Kc Qd', 'Kh 7s 2d').made).toBe('top-pair') // top pair, good kicker
    expect(read('Kc 4d', 'Kh 7s 2d').made).toBe('medium') // top pair, weak kicker
    expect(read('8c 7d', 'Kh 7s 2d').made).toBe('medium') // second pair
    expect(read('Ac 2c', 'Kh 7s 2d').made).toBe('weak') // bottom pair
    expect(read('Kc 7d', 'Kh 7s 2d').made).toBe('strong') // two pair with both cards
    expect(read('Ac Qd', 'Kh 7s 2d').made).toBe('nothing')
    expect(read('9c Td', 'Jh Qs Kd').made).toBe('monster') // straight
  })

  it('knows when the board plays', () => {
    expect(read('2c 3d', 'Ah Kh Qh Jh Th').made).toBe('nothing')
    expect(read('9h 3d', 'Ah Kh Qh Jh 2h').made).toBe('monster') // our 9h makes A-K-Q-J-9, better than the board's flush
  })

  it('finds draws', () => {
    expect(read('Ah 5h', 'Kh 7h 2d')).toMatchObject({ flushDraw: true, openEnded: false })
    expect(read('9c 8d', 'Th 7s 2d')).toMatchObject({ openEnded: true, gutshot: false })
    expect(read('9c 8d', 'Jh 7s 2d')).toMatchObject({ openEnded: false, gutshot: true })
    expect(read('Ac Kd', 'Qh Js 2d')).toMatchObject({ openEnded: false, gutshot: true }) // needs a T
    expect(read('Kc Qd', 'Kh 7s 2d')).toMatchObject({ flushDraw: false, openEnded: false, gutshot: false })
    // A straight draw made only by the board isn't ours.
    expect(read('2c 2d', '9h Ts Jd').openEnded).toBe(false)
  })

  it('values draws by cards to come', () => {
    expect(read('Ah 5h', 'Kh 7h 2d').strength).toBeGreaterThan(read('Ah 5h', 'Kh 7h 2d 3c').strength)
  })

  it('needs a flop', () => {
    expect(() => read('Ah 5h', 'Kh 7h')).toThrow()
  })
})

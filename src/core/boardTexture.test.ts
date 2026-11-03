import { describe, expect, it } from 'vitest'
import type { Card } from './cards'
import { boardTexture } from './boardTexture'

const b = (s: string) => s.split(' ') as Card[]

describe('boardTexture', () => {
  it('rates classic boards', () => {
    expect(boardTexture(b('Ks 7d 2c')).wetness).toBe('dry')
    expect(boardTexture(b('As Ad 6c')).wetness).toBe('dry')
    expect(boardTexture(b('Jh Th 8c')).wetness).toBe('wet')
    expect(boardTexture(b('9s 8s 7s')).wetness).toBe('wet')
    expect(boardTexture(b('Kh 9h 3c')).wetness).toBe('medium')
  })

  it('counts the ace as low for straights', () => {
    expect(boardTexture(b('As 3d 4c')).straightPossible).toBe(true)
    expect(boardTexture(b('As 8d 4c')).straightPossible).toBe(false)
  })

  it('explains itself', () => {
    expect(boardTexture(b('Jh Th 8c')).notes).toEqual(['two of one suit: flush draws', 'connected: straights and straight draws'])
  })
})

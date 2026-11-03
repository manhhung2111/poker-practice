import { describe, expect, it } from 'vitest'
import { makeLinker } from './glossary'

const link = makeLinker([
  { id: '3-bet', term: '3-bet', definition: 'x', match: ['3-bet', '3-bets'] },
  { id: 'ip', term: 'In position', definition: 'x', match: ['in position'] },
  { id: 'range', term: 'Range', definition: 'x' },
])

describe('makeLinker', () => {
  it('links whole phrases, case-insensitively, once per term', () => {
    expect(link('You 3-bet. Then In Position you 3-bet again.')).toEqual([
      { text: 'You ' },
      { text: '3-bet', termId: '3-bet' },
      { text: '. Then ' },
      { text: 'In Position', termId: 'ip' },
      { text: ' you 3-bet again.' },
    ])
  })

  it('prefers the longest phrase and respects word boundaries', () => {
    expect(link('He 3-bets.')).toEqual([{ text: 'He ' }, { text: '3-bets', termId: '3-bet' }, { text: '.' }])
    expect(link('x3-bet and 3-betting')).toEqual([{ text: 'x3-bet and 3-betting' }])
  })

  it('never links terms without match phrases', () => {
    expect(link('their range')).toEqual([{ text: 'their range' }])
  })

  it('shares a seen-set across calls', () => {
    const seen = new Set<string>()
    link('a 3-bet', seen)
    expect(link('another 3-bet', seen)).toEqual([{ text: 'another 3-bet' }])
  })
})

import { describe, expect, it } from 'vitest'
import { parseBlocks, parseFrontmatter, parseInline, termRefs } from './markdown'

describe('markdown', () => {
  it('reads frontmatter', () => {
    const { meta, body } = parseFrontmatter('---\nid: a\ntitle: "X: y"\n---\nHello')
    expect(meta).toEqual({ id: 'a', title: '"X: y"' })
    expect(body).toBe('Hello')
    expect(parseFrontmatter('no meta').meta).toEqual({})
  })

  it('parses headings, paragraphs, lists, tables and callouts', () => {
    const blocks = parseBlocks(
      ['## Title', '', 'Line one', 'line two', '', '- a', '- b', '', '| H1 | H2 |', '|---|---|', '| x | y |', '', '> tip one', '> tip two'].join('\n'),
    )
    expect(blocks).toEqual([
      { type: 'heading', text: 'Title' },
      { type: 'paragraph', text: 'Line one line two' },
      { type: 'list', items: ['a', 'b'] },
      { type: 'table', header: ['H1', 'H2'], rows: [['x', 'y']] },
      { type: 'callout', text: 'tip one tip two' },
    ])
  })

  it('parses bold and glossary links inline', () => {
    expect(parseInline('A **bold** [[3-bet]] and [[defend|defending]].')).toEqual([
      { type: 'text', text: 'A ' },
      { type: 'bold', text: 'bold' },
      { type: 'text', text: ' ' },
      { type: 'term', id: '3-bet', text: '3-bet' },
      { type: 'text', text: ' and ' },
      { type: 'term', id: 'defend', text: 'defending' },
      { type: 'text', text: '.' },
    ])
    expect(termRefs('[[a]] x [[b|c]]')).toEqual(['a', 'b'])
  })
})

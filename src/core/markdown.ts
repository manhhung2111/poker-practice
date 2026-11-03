/**
 * A tiny Markdown subset for lesson files:
 *   ---            frontmatter block with "key: value" lines
 *   ## Heading
 *   - bullet
 *   | a | b |      tables (first row = header, a "|---|" row is skipped)
 *   > tip          callout
 *   paragraphs     separated by blank lines
 * Inline: **bold**, [[term-id]] or [[term-id|shown text]] for glossary links.
 */

export type Block =
  | { type: 'heading'; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; items: string[] }
  | { type: 'table'; header: string[]; rows: string[][] }
  | { type: 'callout'; text: string }

export type Inline =
  | { type: 'text'; text: string }
  | { type: 'bold'; text: string }
  | { type: 'term'; id: string; text: string }

export function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw)
  if (!m) return { meta: {}, body: raw }
  const meta: Record<string, string> = {}
  for (const line of m[1].split(/\r?\n/)) {
    const i = line.indexOf(':')
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim()
  }
  return { meta, body: raw.slice(m[0].length) }
}

export function parseBlocks(body: string): Block[] {
  const blocks: Block[] = []
  const lines = body.split(/\r?\n/)
  let para: string[] = []
  const flushPara = () => {
    if (para.length) blocks.push({ type: 'paragraph', text: para.join(' ') })
    para = []
  }
  const cells = (line: string) =>
    line
      .trim()
      .replace(/^\||\|$/g, '')
      .split('|')
      .map((c) => c.trim())

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line) {
      flushPara()
    } else if (line.startsWith('## ')) {
      flushPara()
      blocks.push({ type: 'heading', text: line.slice(3).trim() })
    } else if (line.startsWith('- ')) {
      flushPara()
      const items = [line.slice(2).trim()]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('- ')) items.push(lines[++i].trim().slice(2).trim())
      blocks.push({ type: 'list', items })
    } else if (line.startsWith('|')) {
      flushPara()
      const rows = [cells(line)]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
        const next = lines[++i].trim()
        if (!/^\|[\s|:-]+\|$/.test(next)) rows.push(cells(next))
      }
      blocks.push({ type: 'table', header: rows[0], rows: rows.slice(1) })
    } else if (line.startsWith('> ')) {
      flushPara()
      const text = [line.slice(2).trim()]
      while (i + 1 < lines.length && lines[i + 1].trim().startsWith('> ')) text.push(lines[++i].trim().slice(2).trim())
      blocks.push({ type: 'callout', text: text.join(' ') })
    } else {
      para.push(line)
    }
  }
  flushPara()
  return blocks
}

export function parseInline(text: string): Inline[] {
  const out: Inline[] = []
  const re = /\*\*(.+?)\*\*|\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g
  let last = 0
  for (const m of text.matchAll(re)) {
    if (m.index > last) out.push({ type: 'text', text: text.slice(last, m.index) })
    if (m[1] !== undefined) out.push({ type: 'bold', text: m[1] })
    else out.push({ type: 'term', id: m[2].trim(), text: (m[3] ?? m[2]).trim() })
    last = m.index + m[0].length
  }
  if (last < text.length) out.push({ type: 'text', text: text.slice(last) })
  return out
}

/** All glossary ids referenced with [[...]] in a text. */
export function termRefs(text: string): string[] {
  return parseInline(text)
    .filter((t): t is Extract<Inline, { type: 'term' }> => t.type === 'term')
    .map((t) => t.id)
}

export interface GlossaryEntry {
  id: string
  term: string
  definition: string
  example?: string
  /**
   * Phrases that link to this entry automatically in app text (case-insensitive,
   * whole words). Leave empty for everyday words (range, call…) that would
   * underline everything; those are linked only with [[id]] in lessons.
   */
  match?: string[]
}

export type Segment = { text: string; termId?: string }

/**
 * Builds a function that splits plain text into segments, marking glossary
 * phrases. Each term is linked at most once per call (pass a shared `seen` set
 * to link once across several pieces of one text block).
 */
export function makeLinker(entries: readonly GlossaryEntry[]) {
  const phrases = entries
    .flatMap((e) => (e.match ?? []).map((p) => ({ phrase: p.toLowerCase(), id: e.id })))
    .sort((a, b) => b.phrase.length - a.phrase.length)
  if (!phrases.length) return (text: string): Segment[] => [{ text }]

  const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const re = new RegExp(`(?<![\\w-])(${phrases.map((p) => escape(p.phrase)).join('|')})(?![\\w-])`, 'gi')
  const idOf = new Map(phrases.map((p) => [p.phrase, p.id]))

  return (text: string, seen: Set<string> = new Set()): Segment[] => {
    const out: Segment[] = []
    let last = 0
    for (const m of text.matchAll(re)) {
      const id = idOf.get(m[0].toLowerCase())
      if (!id || seen.has(id)) continue
      seen.add(id)
      if (m.index > last) out.push({ text: text.slice(last, m.index) })
      out.push({ text: m[0], termId: id })
      last = m.index + m[0].length
    }
    if (last < text.length) out.push({ text: text.slice(last) })
    return out
  }
}

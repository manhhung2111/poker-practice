import { describe, expect, it } from 'vitest'
import { heroOptions } from '../core/dealing'
import { termRefs } from '../core/markdown'
import { GLOSSARY, GLOSSARY_BY_ID, LESSONS } from './learning'

describe('lesson and glossary content', () => {
  it('has 5 lessons in order with unique ids', () => {
    expect(LESSONS.map((l) => l.number)).toEqual([1, 2, 3, 4, 5])
    expect(new Set(LESSONS.map((l) => l.id)).size).toBe(5)
    for (const l of LESSONS) {
      expect(l.title.length).toBeGreaterThan(5)
      expect(l.blocks.length).toBeGreaterThan(5)
    }
  })

  it('lesson drills use seats that exist for their spot', () => {
    for (const l of LESSONS) {
      for (const p of l.drill.positions) expect(heroOptions(l.drill.spot), `${l.id} ${p}`).toContain(p)
    }
  })

  it('every [[term]] link points to a glossary entry', () => {
    for (const l of LESSONS) {
      for (const b of l.blocks) {
        const texts =
          b.type === 'list' ? b.items : b.type === 'table' ? [...b.header, ...b.rows.flat()] : [b.text]
        for (const t of texts) for (const id of termRefs(t)) expect(GLOSSARY_BY_ID.has(id), `${l.id}: [[${id}]]`).toBe(true)
      }
    }
  })

  it('glossary ids and match phrases are unique', () => {
    expect(new Set(GLOSSARY.map((e) => e.id)).size).toBe(GLOSSARY.length)
    const phrases = GLOSSARY.flatMap((e) => (e.match ?? []).map((m) => m.toLowerCase()))
    expect(new Set(phrases).size).toBe(phrases.length)
    for (const e of GLOSSARY) expect(e.definition.length, e.id).toBeGreaterThan(20)
  })
})

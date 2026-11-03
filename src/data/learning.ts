import { DRILL_SPOTS, type DrillSpot } from '../core/dealing'
import type { GlossaryEntry } from '../core/glossary'
import { type Block, parseBlocks, parseFrontmatter } from '../core/markdown'
import { type Position, isPosition } from '../core/positions'
import type { LessonInfo } from '../core/progress'
import glossaryJson from './glossary.json'

export interface Lesson extends LessonInfo {
  summary: string
  minutes: number
  blocks: Block[]
}

const files = import.meta.glob<string>('./lessons/*.md', { eager: true, query: '?raw', import: 'default' })

export function parseLesson(path: string, raw: string, number: number): Lesson {
  const { meta, body } = parseFrontmatter(raw)
  const fail = (msg: string): never => {
    throw new Error(`Lesson ${path}: ${msg}`)
  }
  const spot = meta.drill as DrillSpot
  if (!meta.id) fail('missing id')
  if (!meta.title) fail('missing title')
  if (!DRILL_SPOTS.includes(spot)) fail(`unknown drill "${meta.drill}"`)
  const positions = (meta.positions ?? '').split(',').map((p) => p.trim())
  for (const p of positions) if (!isPosition(p)) fail(`unknown position "${p}"`)
  return {
    id: meta.id,
    number,
    title: meta.title.replace(/^"|"$/g, ''),
    summary: meta.summary ?? '',
    minutes: Number(meta.minutes) || 2,
    drill: { spot, positions: positions as Position[] },
    blocks: parseBlocks(body),
  }
}

export const LESSONS: readonly Lesson[] = Object.keys(files)
  .sort()
  .map((path, i) => parseLesson(path, files[path], i + 1))

export const GLOSSARY: readonly GlossaryEntry[] = (glossaryJson as GlossaryEntry[])
  .slice()
  .sort((a, b) => a.term.localeCompare(b.term))

export const GLOSSARY_BY_ID = new Map(GLOSSARY.map((e) => [e.id, e]))

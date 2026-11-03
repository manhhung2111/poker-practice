import { DRILL_SPOTS, type DrillSpot, heroOptions } from './dealing'
import type { PostflopFocus } from './postflopGrading'
import type { Position } from './positions'

/** What a lesson practices: a preflop drill spot, or postflop decisions at the table. */
export type LessonSpot = DrillSpot | PostflopFocus

export const isDrillSpot = (s: LessonSpot): s is DrillSpot => (DRILL_SPOTS as readonly string[]).includes(s)

/** A lesson's drill: which spot type and hero seats count toward passing it. */
export interface LessonDrill {
  spot: LessonSpot
  positions: Position[]
}

export interface LessonInfo {
  id: string
  number: number
  title: string
  drill: LessonDrill
}

export interface LessonProgress {
  /** Results of the most recent answers in this lesson's drill (true = correct), oldest first. */
  recent: boolean[]
  /** Once passed, a lesson stays passed. */
  passed: boolean
}

export type ProgressState = Record<string, LessonProgress>

/** Pass rule (design §7.3): at least 80% correct over the last 20 hands. */
export const PASS_WINDOW = 20
export const PASS_RATE = 0.8
export const PASS_NEEDED = Math.ceil(PASS_WINDOW * PASS_RATE) // 16

const empty = (): LessonProgress => ({ recent: [], passed: false })

export function lessonProgress(state: ProgressState, id: string): LessonProgress {
  return state[id] ?? empty()
}

/** Lesson 1 is always open; each later lesson opens when the one before is passed. */
export function isUnlocked(state: ProgressState, lessons: readonly LessonInfo[], id: string): boolean {
  const i = lessons.findIndex((l) => l.id === id)
  if (i <= 0) return i === 0
  return lessonProgress(state, lessons[i - 1].id).passed
}

export function isPassing(recent: readonly boolean[]): boolean {
  return recent.length >= PASS_WINDOW && recent.slice(-PASS_WINDOW).filter(Boolean).length >= PASS_NEEDED
}

/** Correct answers among the last PASS_WINDOW, and how many hands have been played toward it. */
export function windowScore(recent: readonly boolean[]): { correct: number; played: number } {
  const w = recent.slice(-PASS_WINDOW)
  return { correct: w.filter(Boolean).length, played: w.length }
}

/** Does an answer in this spot count toward this lesson? */
export function countsFor(lesson: LessonInfo, type: LessonSpot, hero: Position): boolean {
  return lesson.drill.spot === type && lesson.drill.positions.includes(hero)
}

/**
 * Records one answer. It counts toward every unlocked, matching lesson.
 * Returns the new state and the ids of lessons passed by this answer.
 */
export function recordAnswer(
  state: ProgressState,
  lessons: readonly LessonInfo[],
  type: LessonSpot,
  hero: Position,
  correct: boolean,
): { state: ProgressState; passed: string[] } {
  const next: ProgressState = { ...state }
  const passed: string[] = []
  for (const lesson of lessons) {
    if (!countsFor(lesson, type, hero) || !isUnlocked(state, lessons, lesson.id)) continue
    const prev = lessonProgress(state, lesson.id)
    const recent = [...prev.recent, correct].slice(-PASS_WINDOW)
    const nowPassed = prev.passed || isPassing(recent)
    if (nowPassed && !prev.passed) passed.push(lesson.id)
    next[lesson.id] = { recent, passed: nowPassed }
  }
  return { state: next, passed }
}

/** Hero seats the player may drill for each spot type, given unlocked lessons. */
export function allowedSeats(
  state: ProgressState,
  lessons: readonly LessonInfo[],
  unlockAll = false,
): Record<DrillSpot, Position[]> {
  const out: Record<DrillSpot, Position[]> = { rfi: [], 'facing-open': [], blinds: [], 'facing-3bet': [] }
  for (const lesson of lessons) {
    const spot = lesson.drill.spot
    if (!isDrillSpot(spot) || (!unlockAll && !isUnlocked(state, lessons, lesson.id))) continue
    const seats = new Set([...out[spot], ...lesson.drill.positions])
    out[spot] = heroOptions(spot).filter((p) => seats.has(p))
  }
  if (unlockAll) for (const t of Object.keys(out) as DrillSpot[]) out[t] = [...heroOptions(t)]
  return out
}

/** The lesson that unlocks a spot type (first lesson drilling it). */
export function lessonForSpot(lessons: readonly LessonInfo[], type: LessonSpot): LessonInfo | undefined {
  return lessons.find((l) => l.drill.spot === type)
}

/** Parses saved progress, dropping anything malformed. */
export function parseProgress(raw: unknown): ProgressState {
  const out: ProgressState = {}
  if (!raw || typeof raw !== 'object') return out
  for (const [id, v] of Object.entries(raw as Record<string, unknown>)) {
    const p = v as Partial<LessonProgress>
    if (!p || !Array.isArray(p.recent)) continue
    out[id] = { recent: p.recent.filter((x) => typeof x === 'boolean').slice(-PASS_WINDOW), passed: p.passed === true }
  }
  return out
}

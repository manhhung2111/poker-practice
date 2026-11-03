import { type ProgressState, PASS_NEEDED, PASS_WINDOW, isDrillSpot, lessonProgress, windowScore } from '../../core/progress'
import type { Lesson } from '../../data/learning'
import { LESSON_SPOT_TITLES } from '../labels'
import { LessonBody } from './LessonBody'

interface Props {
  lesson: Lesson
  next?: Lesson
  progress: ProgressState
  onBack: () => void
  onDrill: () => void
}

export function LessonScreen({ lesson, next, progress, onBack, onDrill }: Props) {
  const p = lessonProgress(progress, lesson.id)
  const { correct, played } = windowScore(p.recent)
  const atTable = !isDrillSpot(lesson.drill.spot)
  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to Learn">
          ‹
        </button>
        <h1>
          {lesson.number}. {lesson.title}
        </h1>
      </header>
      <p className="lead">{lesson.summary}</p>

      <LessonBody blocks={lesson.blocks} />

      <section className="lesson-drill" aria-labelledby="drill-title">
        <p className="eyebrow" id="drill-title">
          {atTable
            ? `Practice at the table · ${LESSON_SPOT_TITLES[lesson.drill.spot]}`
            : `Drill · ${LESSON_SPOT_TITLES[lesson.drill.spot]} · ${lesson.drill.positions.join(', ')}`}
        </p>
        <Meter correct={correct} played={played} />
        <p className="hint">
          {p.passed
            ? next
              ? `Passed. Lesson ${next.number} is unlocked. Keep practicing any time.`
              : 'Passed. You finished the course.'
            : played
              ? `${correct} right in your last ${played}. Get ${PASS_NEEDED} of ${PASS_WINDOW} to pass${next ? ` and unlock lesson ${next.number}` : ''}.`
              : atTable
                ? `Play hands at the table. Each ${LESSON_SPOT_TITLES[lesson.drill.spot].toLowerCase()} decision is graded by the guidelines; get ${PASS_NEEDED} of your last ${PASS_WINDOW} right to pass.`
                : `Get ${PASS_NEEDED} of your last ${PASS_WINDOW} right to pass. The first 3 hands are warm-ups.`}
        </p>
        <button type="button" className="primary" onClick={onDrill}>
          {atTable ? 'Play at the table' : played ? 'Continue drill' : 'Start drill'}
        </button>
      </section>
    </>
  )
}

/** 20 small pips: green = right, red = wrong, empty = not played yet. */
export function Meter({ correct, played }: { correct: number; played: number }) {
  return (
    <div className="meter" role="img" aria-label={`${correct} of ${played} correct in the last ${PASS_WINDOW}`}>
      {Array.from({ length: PASS_WINDOW }, (_, i) => (
        <span key={i} className={i < played ? (i < correct ? 'ok' : 'miss') : ''} />
      ))}
      <span className="meter-mark" style={{ left: `${(PASS_NEEDED / PASS_WINDOW) * 100}%` }} aria-hidden="true" />
    </div>
  )
}

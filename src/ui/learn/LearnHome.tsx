import { type ProgressState, PASS_NEEDED, PASS_WINDOW, isUnlocked, lessonProgress, windowScore } from '../../core/progress'
import type { Lesson } from '../../data/learning'

interface Props {
  lessons: readonly Lesson[]
  progress: ProgressState
  unlockAll: boolean
  onLesson: (id: string) => void
  onCharts: () => void
  onGlossary: () => void
}

export function LearnHome({ lessons, progress, unlockAll, onLesson, onCharts, onGlossary }: Props) {
  const passedCount = lessons.filter((l) => lessonProgress(progress, l.id).passed).length
  return (
    <>
      <header className="header">
        <h1>Learn</h1>
      </header>

      <section className="section" aria-labelledby="path-title">
        <div className="section-head">
          <h2 id="path-title">Preflop course</h2>
          <span className="muted">
            {passedCount}/{lessons.length} passed
          </span>
        </div>
        {unlockAll && <p className="hint">Test mode: all lessons unlocked.</p>}
        <ol className="path">
          {lessons.map((l) => {
            const p = lessonProgress(progress, l.id)
            const open = unlockAll || isUnlocked(progress, lessons, l.id)
            const { correct, played } = windowScore(p.recent)
            const status = p.passed
              ? 'Passed'
              : !open
                ? `Pass lesson ${l.number - 1} to unlock`
                : played
                  ? `${correct}/${played} right in your last ${played}. Need ${PASS_NEEDED}/${PASS_WINDOW}`
                  : `${l.minutes} min read, then a drill`
            return (
              <li key={l.id} className={`path-step${p.passed ? ' passed' : ''}${open ? '' : ' locked'}`}>
                <button type="button" disabled={!open} onClick={() => onLesson(l.id)}>
                  <span className="step-mark" aria-hidden="true">
                    {p.passed ? '✓' : open ? l.number : <LockIcon />}
                  </span>
                  <span className="step-text">
                    <strong>{l.title}</strong>
                    <small>{status}</small>
                  </span>
                </button>
              </li>
            )
          })}
        </ol>
      </section>

      <section className="section" aria-labelledby="ref-title">
        <h2 id="ref-title">Reference</h2>
        <ul className="chart-list">
          <li>
            <button type="button" className="chart-row" onClick={onCharts}>
              <span className="title">Range charts</span>
              <span className="share">25</span>
              <span className="matchup muted">Every preflop spot in a 13×13 grid</span>
            </button>
          </li>
          <li>
            <button type="button" className="chart-row" onClick={onGlossary}>
              <span className="title">Glossary</span>
              <span className="share">A–Z</span>
              <span className="matchup muted">Poker terms in plain English</span>
            </button>
          </li>
        </ul>
      </section>
    </>
  )
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="11" width="14" height="9" rx="2" />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" />
    </svg>
  )
}

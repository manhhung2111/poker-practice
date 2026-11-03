import { useCallback, useEffect, useRef, useState } from 'react'
import { type Action, type Chart, actionLabel } from '../../core/charts'
import { type Spot, dealRfi } from '../../core/dealing'
import { explain } from '../../core/explain'
import { type Grade, type Severity, grade } from '../../core/grading'
import { type Position, POSITIONS } from '../../core/positions'
import { MiniTable, type SeatState } from '../components/MiniTable'
import { PlayingCard } from '../components/PlayingCard'
import { RangeGrid } from '../components/RangeGrid'
import { handName } from '../labels'
import { type DrillSettings, SESSION_LENGTH } from './settings'

interface Props {
  charts: readonly Chart[]
  settings: DrillSettings
  /** False while another tab is shown: pauses auto-advance and keyboard shortcuts. */
  active: boolean
  onExit: () => void
}

interface Result {
  spot: Spot
  grade: Grade
}

type Phase = 'answer' | 'correct' | 'feedback' | 'summary'

const AUTO_ADVANCE_MS = 1100

const SEVERITY_LABELS: Record<Severity, string> = {
  none: 'Correct',
  close: 'Close spot',
  clear: 'Clear mistake',
  blunder: 'Blunder',
}

const SEVERITY_PLURALS: Record<Exclude<Severity, 'none'>, string> = {
  close: 'close spots',
  clear: 'clear mistakes',
  blunder: 'blunders',
}

export function DrillScreen({ charts, settings, active, onExit }: Props) {
  const deal = useCallback(() => dealRfi(charts, settings.positions, settings.dealing), [charts, settings])
  const [spot, setSpot] = useState<Spot>(deal)
  const [phase, setPhase] = useState<Phase>('answer')
  const [results, setResults] = useState<Result[]>([])
  const last = results[results.length - 1]
  const isSession = settings.session === 'session'
  const correctCount = results.filter((r) => r.grade.correct).length

  const next = useCallback(() => {
    if (isSession && results.length >= SESSION_LENGTH) {
      setPhase('summary')
      return
    }
    setSpot(deal())
    setPhase('answer')
  }, [deal, isSession, results.length])

  const answer = useCallback(
    (action: Action) => {
      if (phase !== 'answer') return
      const g = grade(spot.chart, spot.hand, action)
      setResults((rs) => [...rs, { spot, grade: g }])
      setPhase(g.correct ? 'correct' : 'feedback')
    },
    [phase, spot],
  )

  // Correct answers move on by themselves.
  useEffect(() => {
    if (phase !== 'correct' || !active) return
    const t = setTimeout(next, AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [phase, next, active])

  // Keyboard: F = fold, R = raise, Enter/Space = next.
  const keyRef = useRef({ answer, next, phase, active })
  keyRef.current = { answer, next, phase, active }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { answer, next, phase, active } = keyRef.current
      if (!active || e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      if (phase === 'answer' && k === 'f') answer('fold')
      if (phase === 'answer' && k === 'r') answer('raise')
      if ((phase === 'feedback' || phase === 'correct') && (k === 'enter' || k === ' ')) {
        e.preventDefault()
        next()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (phase === 'summary') {
    return (
      <Summary
        results={results}
        onAgain={() => {
          setResults([])
          setSpot(deal())
          setPhase('answer')
        }}
        onExit={onExit}
      />
    )
  }

  const raiseSize = spot.hero === 'SB' ? '3bb' : '2.5bb'

  return (
    <div className="drill">
      <header className="header">
        <button type="button" className="back" onClick={onExit} aria-label="End drill">
          ‹
        </button>
        <h1>Open or fold</h1>
        <span className="progress" aria-label="Progress">
          {isSession ? `${Math.min(results.length + (phase === 'answer' ? 1 : 0), SESSION_LENGTH)}/${SESSION_LENGTH}` : `#${results.length + (phase === 'answer' ? 1 : 0)}`}
          <span className="score"> · {correctCount} right</span>
        </span>
      </header>

      <MiniTable hero={spot.hero} seats={seatStates(spot.hero)} bets={{ SB: 0.5, BB: 1 }} />

      <p className="situation">
        {situation(spot.hero)} <span className="muted">You are {spot.hero}.</span>
      </p>

      <div className="hole">
        <PlayingCard card={spot.cards[0]} />
        <PlayingCard card={spot.cards[1]} />
      </div>

      <div className="actions">
        <button type="button" className="action fold" onClick={() => answer('fold')} disabled={phase !== 'answer'}>
          Fold
        </button>
        <button type="button" className="action raise" onClick={() => answer('raise')} disabled={phase !== 'answer'}>
          Raise {raiseSize}
        </button>
      </div>

      {phase === 'correct' && last && (
        <div className="toast" role="status">
          <span>
            <strong>Correct.</strong> {last.spot.hand} is a {actionLabel(last.spot.chart.spot, last.grade.best).toLowerCase()} from {last.spot.hero}.
          </span>
          <button type="button" className="link-button" onClick={() => setPhase('feedback')}>
            Why?
          </button>
        </div>
      )}

      {phase === 'feedback' && last && <FeedbackSheet result={last} onNext={next} />}
    </div>
  )
}

function seatStates(hero: Position): Partial<Record<Position, SeatState>> {
  const out: Partial<Record<Position, SeatState>> = {}
  for (const p of POSITIONS) {
    if (p === hero) out[p] = 'hero'
    else if (POSITIONS.indexOf(p) < POSITIONS.indexOf(hero)) out[p] = 'folded'
  }
  return out
}

function situation(hero: Position): string {
  const i = POSITIONS.indexOf(hero)
  if (i === 0) return "You're first to act."
  if (i === 1) return 'UTG folds to you.'
  return `${POSITIONS[0]} to ${POSITIONS[i - 1]} fold to you.`
}

function FeedbackSheet({ result, onNext }: { result: Result; onNext: () => void }) {
  const { spot, grade: g } = result
  const why = explain(spot.chart, spot.hand)
  const label = (a: Action) => actionLabel(spot.chart.spot, a)
  const nextRef = useRef<HTMLButtonElement>(null)
  useEffect(() => nextRef.current?.focus(), [])

  return (
    <div className="sheet-backdrop">
      <section className="sheet" role="dialog" aria-modal="true" aria-labelledby="feedback-title">
        <div className="sheet-head">
          <span className={`severity ${g.severity}`}>{SEVERITY_LABELS[g.severity]}</span>
          <h2 id="feedback-title">
            {spot.hand} from {spot.hero}: {g.correctActions.map(label).join(' or ')}
          </h2>
          {!g.correct && (
            <p className="muted">
              You chose {label(g.chosen).toLowerCase()}. {handName(spot.hand)}.
            </p>
          )}
        </div>
        <div className="why">
          <p>{why.hand}</p>
          <p className="muted">
            {why.spot} {why.keyIdea}
          </p>
        </div>
        <RangeGrid chart={spot.chart} hero={spot.hand} />
        <button ref={nextRef} type="button" className="primary" onClick={onNext}>
          Next hand
        </button>
      </section>
    </div>
  )
}

function Summary({ results, onAgain, onExit }: { results: Result[]; onAgain: () => void; onExit: () => void }) {
  const right = results.filter((r) => r.grade.correct).length
  const mistakes = results.filter((r) => !r.grade.correct)
  const count = (s: Severity) => mistakes.filter((r) => r.grade.severity === s).length
  return (
    <>
      <header className="header">
        <h1>Session done</h1>
      </header>
      <div className="summary">
        <p className="big-score">
          {right}
          <span>/{results.length}</span>
        </p>
        <p className="muted">{Math.round((right / results.length) * 100)}% correct</p>
        {mistakes.length > 0 && (
          <div className="sev-counts">
            {(['blunder', 'clear', 'close'] as const).map((s) => (
              <span key={s} className={`severity ${s}`}>
                {count(s)} {count(s) === 1 ? SEVERITY_LABELS[s].toLowerCase() : SEVERITY_PLURALS[s]}
              </span>
            ))}
          </div>
        )}
        {mistakes.length > 0 ? (
          <>
            <h2>Your mistakes</h2>
            <ul className="mistakes">
              {mistakes.map((r, i) => (
                <li key={i}>
                  <span className="pos">{r.spot.hero}</span>
                  <strong>{r.spot.hand}</strong>
                  <span className="muted">
                    you {actionLabel('rfi', r.grade.chosen).toLowerCase()}, best {actionLabel('rfi', r.grade.best).toLowerCase()}
                  </span>
                  <span className={`severity ${r.grade.severity}`}>{SEVERITY_LABELS[r.grade.severity]}</span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <p>No mistakes. Try fewer positions or Realistic dealing for a different test.</p>
        )}
        <div className="summary-actions">
          <button type="button" className="primary" onClick={onAgain}>
            Play again
          </button>
          <button type="button" className="secondary" onClick={onExit}>
            Change setup
          </button>
        </div>
      </div>
    </>
  )
}

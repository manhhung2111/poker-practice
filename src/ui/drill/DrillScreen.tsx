import { useCallback, useEffect, useRef, useState } from 'react'
import { type Action, type Chart, actionLabel } from '../../core/charts'
import { type AllowedSeats, type ReviewPool, type Spot, dealSpot } from '../../core/dealing'
import { explain } from '../../core/explain'
import { type Grade, type Severity, grade } from '../../core/grading'
import { PASS_NEEDED, PASS_WINDOW } from '../../core/progress'
import { MiniTable } from '../components/MiniTable'
import { PlayingCard } from '../components/PlayingCard'
import { RangeGrid } from '../components/RangeGrid'
import { DRILL_SPOT_TITLES, describeHistory, handName, spotContext } from '../labels'
import { RichText } from '../learn/RichText'
import { type DrillSettings, SESSION_LENGTH } from './settings'

interface Props {
  charts: readonly Chart[]
  settings: DrillSettings
  /** Seats unlocked per spot type. */
  allowed: AllowedSeats
  /** Set when this drill belongs to a lesson: shows its pass meter and starts with warm-ups. */
  lesson?: { number: number; title: string; correct: number; played: number; passed: boolean }
  /** False while another tab is shown: pauses auto-advance and keyboard shortcuts. */
  active: boolean
  /** Missed hands to replay. Read when each hand is dealt. */
  review: ReviewPool
  onAnswer: (spot: Spot, grade: Grade, ms: number) => void
  onExit: () => void
}

/** Lesson drills start with this many clear-cut hands. */
const WARMUP_HANDS = 3

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

/** Button label with the size, e.g. "Call 2.5bb", "3-bet to 7.5bb", "Raise 2.5bb". */
function buttonLabel(spot: Spot, action: Action): string {
  const name = actionLabel(spot.chart.spot, action)
  if (action === 'fold') return name
  if (action === 'call') return `${name} ${spot.sizes.call}bb`
  return spot.type === 'rfi' ? `${name} ${spot.sizes.raise}bb` : `${name} to ${spot.sizes.raise}bb`
}

export function DrillScreen({ charts, settings, allowed, lesson, active, review, onAnswer, onExit }: Props) {
  const dealtRef = useRef(0)
  const reviewRef = useRef(review)
  reviewRef.current = review
  const shownAt = useRef(Date.now())
  const deal = useCallback(() => {
    const warmup = lesson && dealtRef.current < WARMUP_HANDS
    dealtRef.current++
    shownAt.current = Date.now()
    return dealSpot(
      charts,
      settings.spot,
      settings.positions,
      warmup ? 'easy' : settings.dealing,
      undefined,
      allowed,
      reviewRef.current,
    )
  }, [charts, settings, allowed, lesson])
  const [spot, setSpot] = useState<Spot>(deal)
  const [phase, setPhase] = useState<Phase>('answer')
  const [results, setResults] = useState<Result[]>([])
  const last = results[results.length - 1]
  const isSession = settings.session === 'session'
  const correctCount = results.filter((r) => r.grade.correct).length
  const actions: Action[] = spot.type === 'rfi' ? ['fold', 'raise'] : ['fold', 'call', 'raise']

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
      onAnswer(spot, g, Date.now() - shownAt.current)
    },
    [phase, spot, onAnswer],
  )

  // Correct answers move on by themselves.
  useEffect(() => {
    if (phase !== 'correct' || !active) return
    const t = setTimeout(next, AUTO_ADVANCE_MS)
    return () => clearTimeout(t)
  }, [phase, next, active])

  // Keyboard: F = fold, C = call, R = raise, Enter/Space = next.
  const keyRef = useRef({ answer, next, phase, active, actions })
  keyRef.current = { answer, next, phase, active, actions }
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const { answer, next, phase, active, actions } = keyRef.current
      if (!active || e.target instanceof HTMLInputElement) return
      const k = e.key.toLowerCase()
      const byKey: Record<string, Action> = { f: 'fold', c: 'call', r: 'raise' }
      if (phase === 'answer' && byKey[k] && actions.includes(byKey[k])) answer(byKey[k])
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

  const handNumber = results.length + (phase === 'answer' ? 1 : 0)
  const story = describeHistory(spot.history)

  return (
    <div className="drill">
      <header className="header">
        <button type="button" className="back" onClick={onExit} aria-label="End drill">
          ‹
        </button>
        <h1>{lesson ? `Lesson ${lesson.number} drill` : DRILL_SPOT_TITLES[spot.type]}</h1>
        <span className="progress" aria-label="Progress">
          {lesson ? (
            <>
              {lesson.correct}/{lesson.played || 0}
              <span className="score"> · need {PASS_NEEDED}/{PASS_WINDOW}</span>
            </>
          ) : (
            <>
              {isSession ? `${Math.min(handNumber, SESSION_LENGTH)}/${SESSION_LENGTH}` : `#${handNumber}`}
              <span className="score"> · {correctCount} right</span>
            </>
          )}
        </span>
      </header>
      {lesson && dealtRef.current <= WARMUP_HANDS && phase === 'answer' && (
        <p className="hint warmup">Warm-up hand {dealtRef.current} of {WARMUP_HANDS}: an easy one.</p>
      )}

      <MiniTable hero={spot.hero} seats={spot.seats} bets={spot.bets} />

      <p className="situation">
        {story.length ? `${story.join('. ')}.` : "You're first to act."}{' '}
        <strong>You are {spot.hero}.</strong>
      </p>

      <div className="hole">
        <PlayingCard card={spot.cards[0]} />
        <PlayingCard card={spot.cards[1]} />
      </div>

      <div className="actions">
        {actions.map((a) => (
          <button
            key={a}
            type="button"
            className={`action ${a}`}
            onClick={() => answer(a)}
            disabled={phase !== 'answer'}
          >
            {buttonLabel(spot, a)}
          </button>
        ))}
      </div>

      {phase === 'correct' && last && (
        <div className="toast" role="status">
          <span>
            <strong>Correct.</strong> {last.spot.hand} is a {actionLabel(last.spot.chart.spot, last.grade.chosen).toLowerCase()}{' '}
            {spotContext(last.spot.type, last.spot.hero, last.spot.villain)}.
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
            {spot.hand}: {g.correctActions.map(label).join(' or ')}
          </h2>
          <p className="muted">
            {handName(spot.hand)} {spotContext(spot.type, spot.hero, spot.villain)}.
            {!g.correct && ` You chose ${label(g.chosen).toLowerCase()}.`}
          </p>
        </div>
        <div className="why">
          <p>
            <RichText text={why.hand} />
          </p>
          <p className="muted">
            {why.spot} <RichText text={why.keyIdea} />
          </p>
        </div>
        <p className="eyebrow">{spot.chart.title}</p>
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
              {mistakes.map((r, i) => {
                const lbl = (a: Action) => actionLabel(r.spot.chart.spot, a).toLowerCase()
                return (
                  <li key={i}>
                    <span className="pos">
                      {r.spot.hero}
                      {r.spot.villain ? ` v ${r.spot.villain}` : ''}
                    </span>
                    <strong>{r.spot.hand}</strong>
                    <span className="muted">
                      you {lbl(r.grade.chosen)}, best {lbl(r.grade.best)}
                    </span>
                    <span className={`severity ${r.grade.severity}`}>{SEVERITY_LABELS[r.grade.severity]}</span>
                  </li>
                )
              })}
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

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  type Prompt,
  clefsFor,
  isCorrect,
  letterName,
  noteName,
  pickPrompt,
  pitchClass,
  promptPool,
} from '../../core/piano/notes'
import { type PianoStats, noteWeight } from '../../core/piano/stats'
import { type KeyMark, Keyboard } from './Keyboard'
import { type PianoSettings, sessionLength } from './settings'
import { Staff } from './Staff'
import { MIDI_STATUS_TEXT, useMidi } from './useMidi'

interface Props {
  settings: PianoSettings
  stats: PianoStats
  active: boolean
  onAnswer: (p: Prompt, correct: boolean, ms: number) => void
  onExit: () => void
}

interface Feedback {
  correct: boolean
  /** Pitch class pressed. */
  pressed: number
}

const NEXT_AFTER_RIGHT = 450
const NEXT_AFTER_WRONG = 1600

const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0)

export function PianoDrill({ settings, stats, active, onAnswer, onExit }: Props) {
  const total = sessionLength(settings)
  const pool = useMemo(() => promptPool(settings.hand, settings.level, settings.accidentals), [settings])
  // Weights are read when a note is picked, so they follow the latest stats without re-dealing.
  const statsRef = useRef(stats)
  statsRef.current = stats
  const next = useCallback((last: Prompt | null) => pickPrompt(pool, last, (p) => noteWeight(statsRef.current, p)), [pool])

  const [prompt, setPrompt] = useState<Prompt>(() => next(null))
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [count, setCount] = useState(0)
  const [right, setRight] = useState(0)
  const [streak, setStreak] = useState(0)
  const [best, setBest] = useState(0)
  const [missed, setMissed] = useState<Prompt[]>([])
  const [totalMs, setTotalMs] = useState(0)
  const shownAt = useRef(Date.now())
  const done = total > 0 && count >= total && !feedback

  // The clock restarts on each note and whenever the drill comes back into view, so time spent on
  // another tab doesn't count as reading time.
  useEffect(() => {
    if (active) shownAt.current = Date.now()
  }, [prompt, active])

  const advance = useCallback(() => {
    setFeedback(null)
    setPrompt((p) => next(p))
  }, [next])

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(advance, feedback.correct ? NEXT_AFTER_RIGHT : NEXT_AFTER_WRONG)
    return () => clearTimeout(t)
  }, [feedback, advance])

  const answer = (midi: number, exact: boolean) => {
    if (feedback || done || !active) return
    const ok = isCorrect(prompt.note, midi, exact)
    const ms = Date.now() - shownAt.current
    onAnswer(prompt, ok, ms)
    setFeedback({ correct: ok, pressed: ((midi % 12) + 12) % 12 })
    setCount((c) => c + 1)
    setTotalMs((t) => t + ms)
    if (ok) {
      setRight((r) => r + 1)
      setStreak(streak + 1)
      setBest(Math.max(best, streak + 1))
    } else {
      setStreak(0)
      setMissed((m) => [...m, prompt])
    }
  }

  const midiStatus = useMidi(settings.midi && active && !done, (m) => answer(m, true))

  const marks: Partial<Record<number, KeyMark>> = {}
  if (feedback) {
    if (feedback.correct) marks[feedback.pressed] = 'right'
    else if (feedback.pressed === pitchClass(prompt.note)) marks[feedback.pressed] = 'wrong'
    else {
      marks[feedback.pressed] = 'wrong'
      marks[pitchClass(prompt.note)] = 'answer'
    }
  }
  // Only a MIDI keyboard can name the right letter in the wrong octave.
  const wrongOctave = feedback && !feedback.correct && feedback.pressed === pitchClass(prompt.note)

  if (done) {
    const uniqueMissed = [...new Map(missed.map((p) => [`${p.clef}:${noteName(p.note)}`, p])).values()]
    return (
      <>
        <header className="header">
          <button type="button" className="back" aria-label="Back to setup" onClick={onExit}>
            ‹
          </button>
          <h1>Session done</h1>
        </header>
        <div className="summary">
          <p className="big-score">
            {right}
            <span>/{count}</span>
          </p>
          <p className="muted">
            {pct(right, count)}% right · {(totalMs / Math.max(count, 1) / 1000).toFixed(1)} s per note · best streak {best}
          </p>
          {uniqueMissed.length > 0 && (
            <section className="section">
              <h2>Missed</h2>
              <ul className="note-chips">
                {uniqueMissed.map((p) => (
                  <li key={`${p.clef}:${noteName(p.note)}`}>
                    {noteName(p.note)} <span className="muted">{p.clef === 'treble' ? 'RH' : 'LH'}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <div className="summary-actions">
            <button type="button" className="primary" onClick={onExit}>
              Done
            </button>
          </div>
        </div>
      </>
    )
  }

  return (
    <div className="piano-drill">
      <header className="header">
        <button type="button" className="back" aria-label="End session" onClick={onExit}>
          ‹
        </button>
        <h1 className="progress">
          {total ? `${Math.min(count + (feedback ? 0 : 1), total)} / ${total}` : `${count} notes`}
          <span className="score muted"> · {pct(right, count)}%</span>
        </h1>
        <span className="streak" aria-label="Streak">
          {streak > 1 ? `🔥 ${streak}` : ''}
        </span>
      </header>

      <div className="staff-card">
        <span className="eyebrow">{prompt.clef === 'treble' ? 'Right hand · treble' : 'Left hand · bass'}</span>
        <Staff
          clefs={clefsFor(settings.hand)}
          level={settings.level}
          prompt={prompt}
          mark={feedback ? (feedback.correct ? 'right' : 'wrong') : 'neutral'}
        />
        <p className={`note-feedback${feedback ? (feedback.correct ? ' right' : ' wrong') : ''}`} role="status">
          {feedback
            ? feedback.correct
              ? `${letterName(prompt.note)} ✓`
              : wrongOctave
                ? `Right note, wrong octave: it's ${noteName(prompt.note)}`
                : `It's ${noteName(prompt.note)}`
            : settings.midi && midiStatus !== 'off'
              ? MIDI_STATUS_TEXT[midiStatus]
              : 'Which note is this?'}
        </p>
      </div>

      <div className="keyboard-dock">
        <Keyboard marks={marks} labels={settings.labels} disabled={!!feedback} onPress={(m) => answer(m, false)} />
      </div>
    </div>
  )
}

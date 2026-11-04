import { useEffect, useMemo, useRef, useState } from 'react'
import {
  type Chord,
  chordKey,
  chordName,
  chordPool,
  isChordCorrectMidi,
  isChordCorrectOnScreen,
  pickChord,
} from '../../core/piano/chords'
import { letterName, pitchClass } from '../../core/piano/notes'
import { type NoteStat, statWeight } from '../../core/piano/stats'
import { type KeyMark, Keyboard } from './Keyboard'
import { type Attempt, EMPTY_ATTEMPT, addPress, complete } from './midiChord'
import { SessionSummary } from './SessionSummary'
import { type PianoSettings, sessionLength } from './settings'
import { Staff } from './Staff'
import { MIDI_STATUS_TEXT, useMidi } from './useMidi'
import { type MissedChip, handOf, pct, useVisibleClock } from './drillUtils'

interface Props {
  settings: PianoSettings
  chordStats: Record<string, NoteStat>
  active: boolean
  onChord: (c: Chord, correct: boolean, ms: number) => void
  onExit: () => void
}

interface Feedback {
  ok: boolean
  /** Pitch classes answered. */
  picked: Set<number>
}

const NEXT_AFTER_RIGHT = 450
const NEXT_AFTER_WRONG = 2000

const pcOf = (midi: number) => ((midi % 12) + 12) % 12

/** Chords: play the three keys of a stacked chord. */
export function ChordDrill({ settings, chordStats, active, onChord, onExit }: Props) {
  const total = sessionLength(settings)
  const pool = useMemo(() => chordPool(settings.hand, settings.level, settings.accidentals), [settings])
  const statsRef = useRef(chordStats)
  statsRef.current = chordStats
  const next = (last: Chord | null) => pickChord(pool, last, (c) => statWeight(statsRef.current[chordKey(c)]))

  const [chord, setChord] = useState<Chord>(() => next(null))
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const [count, setCount] = useState(0)
  const [right, setRight] = useState(0)
  const [totalMs, setTotalMs] = useState(0)
  const [missed, setMissed] = useState<MissedChip[]>([])
  const attempt = useRef<Attempt>(EMPTY_ATTEMPT)

  const clock = useVisibleClock(active)
  const shownAt = useRef(clock())
  const done = total > 0 && count >= total && !feedback

  useEffect(() => {
    if (!feedback) return
    const t = setTimeout(
      () => {
        setFeedback(null)
        setSelected(new Set())
        attempt.current = EMPTY_ATTEMPT
        setChord((c) => next(c))
        shownAt.current = clock()
      },
      feedback.ok ? NEXT_AFTER_RIGHT : NEXT_AFTER_WRONG,
    )
    return () => clearTimeout(t)
    // next reads the pool and latest stats; advance once per answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedback])

  const grade = (ok: boolean, picked: Set<number>) => {
    const ms = clock() - shownAt.current
    onChord(chord, ok, ms)
    setFeedback({ ok, picked })
    setCount((c) => c + 1)
    setTotalMs((t) => t + ms)
    if (ok) setRight((r) => r + 1)
    else setMissed((m) => [...m, { key: chordKey(chord), label: chordName(chord), hand: handOf(chord.clef) }])
  }

  const ready = active && !feedback && !done

  const toggle = (midi: number) => {
    if (!ready) return
    const pc = pcOf(midi)
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(pc)) n.delete(pc)
      else n.add(pc)
      return n
    })
  }

  const midiStatus = useMidi(settings.midi && active && !done, (m) => {
    if (!ready) return
    attempt.current = addPress(attempt.current, m, Date.now())
    const pcs = new Set(attempt.current.keys.map(pcOf))
    setSelected(pcs)
    if (complete(attempt.current)) grade(isChordCorrectMidi(chord, attempt.current.keys), pcs)
  })

  if (done)
    return (
      <SessionSummary
        right={right}
        total={count}
        detail={`${pct(right, count)}% right · ${(totalMs / Math.max(count, 1) / 1000).toFixed(1)} s per chord`}
        missed={missed}
        onExit={onExit}
      />
    )

  const tones = new Set(chord.notes.map(pitchClass))
  const marks: Partial<Record<number, KeyMark>> = {}
  if (feedback) {
    for (const pc of tones) marks[pc] = feedback.picked.has(pc) ? 'right' : 'missed'
    for (const pc of feedback.picked) if (!tones.has(pc)) marks[pc] = 'wrong'
  } else for (const pc of selected) marks[pc] = 'selected'

  const spelled = `${chordName(chord)}: ${chord.notes.map(letterName).join(' ')}`
  const hint = feedback
    ? feedback.ok
      ? `${spelled} ✓`
      : spelled
    : settings.midi && midiStatus !== 'off'
      ? MIDI_STATUS_TEXT[midiStatus]
      : 'Tap the 3 keys, then Check'

  return (
    <div className="piano-drill with-check">
      <header className="header">
        <button type="button" className="back" aria-label="End session" onClick={onExit}>
          ‹
        </button>
        <h1 className="progress">
          {total ? `Chord ${Math.min(count + (feedback ? 0 : 1), total)} / ${total}` : `${count} chords`}
          <span className="score muted"> · {pct(right, count)}%</span>
        </h1>
      </header>

      <div className="staff-card">
        <span className="eyebrow">{chord.clef === 'treble' ? 'Right hand · treble' : 'Left hand · bass'}</span>
        <Staff
          clefs={[chord.clef]}
          clef={chord.clef}
          level={settings.level}
          levelPad={2}
          columns={[{ notes: chord.notes, mark: feedback ? (feedback.ok ? 'right' : 'wrong') : 'neutral' }]}
        />
        <p className={`note-feedback${feedback ? (feedback.ok ? ' right' : ' wrong') : ''}`} role="status">
          {hint}
        </p>
      </div>

      <div className="keyboard-dock">
        <Keyboard marks={marks} labels={settings.labels} disabled={!!feedback} onPress={toggle} />
        <button
          type="button"
          className="primary check-button"
          disabled={!ready || selected.size === 0}
          onClick={() => grade(isChordCorrectOnScreen(chord, selected), new Set(selected))}
        >
          Check
        </button>
      </div>
    </div>
  )
}

import { useEffect, useMemo, useRef, useState } from 'react'
import { ROW_LENGTH, makeRow, phaseFor } from '../../core/piano/melody'
import { type Clef, type Note, type Prompt, clefsFor, isCorrect, letterName, noteName } from '../../core/piano/notes'
import { type KeyMark, Keyboard } from './Keyboard'
import { type PianoSettings, sessionLength } from './settings'
import { type NoteMark, Staff } from './Staff'
import { MIDI_STATUS_TEXT, useMidi } from './useMidi'
import { SessionSummary } from './SessionSummary'
import { type MissedChip, handOf, pct, useVisibleClock } from './drillUtils'

interface Props {
  settings: PianoSettings
  active: boolean
  onNote: (p: Prompt, correct: boolean, ms: number) => void
  onRow: (right: number, total: number, ms: number) => void
  onExit: () => void
}

/** Pause after a row's last note before the next row appears. */
const NEXT_ROW_AFTER = 700

interface Row {
  clef: Clef
  notes: Note[]
}

/** Read a row: six notes left to right, keep going after mistakes. */
export function RowDrill({ settings, active, onNote, onRow, onExit }: Props) {
  const total = sessionLength(settings)
  const clefs = useMemo(() => clefsFor(settings.hand), [settings.hand])
  const newRow = (index: number): Row => {
    const clef = clefs[Math.floor(Math.random() * clefs.length)]
    return { clef, notes: makeRow(clef, settings.level, settings.accidentals, phaseFor(index, total)) }
  }

  const [rowIndex, setRowIndex] = useState(0)
  const [row, setRow] = useState<Row>(() => newRow(0))
  const [pos, setPos] = useState(0)
  const [marks, setMarks] = useState<NoteMark[]>([])
  const [keyMarks, setKeyMarks] = useState<Partial<Record<number, KeyMark>>>({})
  const [last, setLast] = useState<{ ok: boolean; note: Note } | null>(null)
  const [right, setRight] = useState(0)
  const [count, setCount] = useState(0)
  const [rowsMs, setRowsMs] = useState(0)
  const [clean, setClean] = useState(0)
  const [missed, setMissed] = useState<MissedChip[]>([])
  const [done, setDone] = useState(false)

  const clock = useVisibleClock(active)
  const rowStart = useRef(clock())
  const lastAt = useRef(clock())
  const rowRight = useRef(0)
  const waiting = pos >= ROW_LENGTH

  useEffect(() => {
    if (!waiting) return
    const t = setTimeout(() => {
      if (total && rowIndex + 1 >= total) return setDone(true)
      setRowIndex((i) => i + 1)
      setRow(newRow(rowIndex + 1))
      setPos(0)
      setMarks([])
      setKeyMarks({})
      setLast(null)
      rowRight.current = 0
      rowStart.current = lastAt.current = clock()
    }, NEXT_ROW_AFTER)
    return () => clearTimeout(t)
    // newRow reads settings only; the row advances once per finished row.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting])

  const answer = (midi: number, exact: boolean) => {
    if (!active || waiting || done) return
    const note = row.notes[pos]
    const ok = isCorrect(note, midi, exact)
    const now = clock()
    onNote({ clef: row.clef, note }, ok, now - lastAt.current)
    lastAt.current = now
    setMarks((m) => [...m, ok ? 'right' : 'wrong'])
    setKeyMarks({ [((midi % 12) + 12) % 12]: ok ? 'right' : 'wrong' })
    setLast({ ok, note })
    setCount((c) => c + 1)
    if (ok) {
      setRight((r) => r + 1)
      rowRight.current++
    } else setMissed((m) => [...m, { key: `${row.clef}:${noteName(note)}`, label: noteName(note), hand: handOf(row.clef) }])
    if (pos + 1 === ROW_LENGTH) {
      const ms = now - rowStart.current
      onRow(rowRight.current, ROW_LENGTH, ms)
      setRowsMs((t) => t + ms)
      if (rowRight.current === ROW_LENGTH) setClean((c) => c + 1)
    }
    setPos(pos + 1)
  }

  const midiStatus = useMidi(settings.midi && active && !done, (m) => answer(m, true))

  if (done) {
    const rows = rowIndex + 1
    return (
      <SessionSummary
        right={right}
        total={count}
        detail={`${pct(right, count)}% right · ${(rowsMs / rows / 1000).toFixed(1)} s per row · ${clean} clean ${clean === 1 ? 'row' : 'rows'}`}
        missed={missed}
        onExit={onExit}
      />
    )
  }

  const hint = last
    ? last.ok
      ? `${letterName(last.note)} ✓`
      : `That was ${noteName(last.note)}`
    : settings.midi && midiStatus !== 'off'
      ? MIDI_STATUS_TEXT[midiStatus]
      : 'Play the notes left to right'

  return (
    <div className="piano-drill">
      <header className="header">
        <button type="button" className="back" aria-label="End session" onClick={onExit}>
          ‹
        </button>
        <h1 className="progress">
          {total ? `Row ${rowIndex + 1} / ${total}` : `Row ${rowIndex + 1}`}
          <span className="score muted"> · {pct(right, count)}%</span>
        </h1>
      </header>

      <div className="staff-card">
        <span className="eyebrow">
          {row.clef === 'treble' ? 'Right hand · treble' : 'Left hand · bass'} · note {Math.min(pos + 1, ROW_LENGTH)} of {ROW_LENGTH}
        </span>
        <Staff
          clefs={[row.clef]}
          clef={row.clef}
          level={settings.level}
          current={waiting ? undefined : pos}
          columns={row.notes.map((n, i) => ({ notes: [n], mark: marks[i] ?? 'neutral' }))}
        />
        <p className={`note-feedback${last ? (last.ok ? ' right' : ' wrong') : ''}`} role="status">
          {hint}
        </p>
      </div>

      <div className="keyboard-dock">
        <Keyboard marks={keyMarks} labels={settings.labels} disabled={waiting} onPress={(m) => answer(m, false)} />
      </div>
    </div>
  )
}

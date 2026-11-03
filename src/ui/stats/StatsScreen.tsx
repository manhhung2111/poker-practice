import { useMemo, useRef, useState } from 'react'
import { BackupError, makeBackup, parseBackup, type BackupData } from '../../core/backup'
import type { Chart } from '../../core/charts'
import type { DrillSpot } from '../../core/dealing'
import type { HandClass } from '../../core/hands'
import type { AnswerLog } from '../../core/log'
import { POSITIONS } from '../../core/positions'
import { type ProgressState, lessonProgress, windowScore } from '../../core/progress'
import {
  type Tally,
  accuracy,
  dailyTrend,
  groupTally,
  handTallies,
  lastDays,
  mostMissed,
  tally,
  weakest,
} from '../../core/stats'
import type { Lesson } from '../../data/learning'
import { DRILL_SPOT_TITLES } from '../labels'
import { HeatGrid } from './HeatGrid'
import { TrendChart } from './TrendChart'

interface Props {
  answers: readonly AnswerLog[]
  charts: readonly Chart[]
  lessons: readonly Lesson[]
  progress: ProgressState
  persistent: boolean
  queueSize: number
  onDrillWeak: () => void
  onImport: (data: BackupData) => void
  onReset: () => void
}

const SPOT_ORDER: DrillSpot[] = ['rfi', 'facing-open', 'blinds', 'facing-3bet']
const pct = (t: Tally) => (t.answered ? `${Math.round(accuracy(t) * 100)}%` : '–')

export function StatsScreen(props: Props) {
  const { answers, charts, lessons, progress, persistent, queueSize, onDrillWeak } = props
  // Cheap even for thousands of answers, so recomputed each render ("today" stays current).
  const now = Date.now()
  const week = tally(lastDays(answers, now, 7))
  const month = tally(lastDays(answers, now, 30))
  const trend = dailyTrend(answers, now, 7)
  const recent = lastDays(answers, now, 30)
  const bySpot = groupTally(recent, (e) => e.type, SPOT_ORDER)
  const byPos = groupTally(recent, (e) => e.hero, POSITIONS)
  const missed = mostMissed(recent, 8)
  const chartTitle = (id: string) => charts.find((c) => c.id === id)?.title ?? id

  return (
    <>
      <header className="header">
        <h1>Stats</h1>
      </header>

      {!persistent && (
        <p className="notice">
          This browser isn't letting the app save data, so your stats last only until you close the page. Use Copy backup
          below to keep them.
        </p>
      )}

      {answers.length === 0 ? (
        <div className="empty">
          <h2>No hands yet</h2>
          <p>
            Your accuracy per spot and seat, a heatmap of the hands you miss, and a review queue appear here after your
            first drill. Start with lesson 1 in the Learn tab.
          </p>
        </div>
      ) : (
        <>
          <section className="tiles" aria-label="Summary">
            <div className="tile">
              <span className="eyebrow">All time</span>
              <strong>{answers.length}</strong>
              <small>hands</small>
            </div>
            <div className="tile">
              <span className="eyebrow">Last 7 days</span>
              <strong>{pct(week)}</strong>
              <small>{week.answered} hands</small>
            </div>
            <div className="tile">
              <span className="eyebrow">Last 30 days</span>
              <strong>{pct(month)}</strong>
              <small>{month.answered} hands</small>
            </div>
          </section>

          <section className="section">
            <h2>Accuracy per day</h2>
            <TrendChart days={trend} />
          </section>

          <BarList
            title="By spot (last 30 days)"
            rows={bySpot.map((g) => ({ ...g, label: DRILL_SPOT_TITLES[g.key] }))}
            weakestKey={weakest(bySpot)}
          />
          <BarList
            title="By your seat (last 30 days)"
            rows={byPos.map((g) => ({ ...g, label: g.key }))}
            weakestKey={weakest(byPos)}
          />

          <section className="section">
            <h2>Most-missed hands</h2>
            {missed.length === 0 ? (
              <p className="muted">No misses in the last 30 days.</p>
            ) : (
              <ul className="missed">
                {missed.map((m) => (
                  <li key={`${m.chartId}|${m.hand}`}>
                    <strong>{m.hand}</strong>
                    <span className="muted">{chartTitle(m.chartId)}</span>
                    <span className="count">
                      {m.misses}/{m.answered}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <button type="button" className="primary" disabled={queueSize === 0} onClick={onDrillWeak}>
              {queueSize ? `Drill your weak spots (${queueSize})` : 'No weak spots queued'}
            </button>
            <p className="hint">
              Missed hands come back after about 3 hands, then 10, 30 and 100 as you get them right, until you've
              answered them right four times in a row.
            </p>
          </section>

          <Heatmap answers={recent} charts={charts} />
        </>
      )}

      <section className="section">
        <h2>Lessons</h2>
        <ul className="chart-list">
          {lessons.map((l) => {
            const p = lessonProgress(progress, l.id)
            const { correct, played } = windowScore(p.recent)
            return (
              <li key={l.id} className="lesson-row">
                <span>
                  {l.number}. {l.title}
                </span>
                <span className={p.passed ? 'severity none' : 'muted'}>
                  {p.passed ? 'Passed' : played ? `${correct}/${played}` : '–'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <BackupSection {...props} />
    </>
  )
}

function BarList({
  title,
  rows,
  weakestKey,
}: {
  title: string
  rows: (Tally & { key: string; label: string })[]
  weakestKey?: string
}) {
  return (
    <section className="section">
      <h2>{title}</h2>
      <ul className="bars">
        {rows.map((r) => (
          <li key={r.key} className={r.key === weakestKey ? 'weak' : ''}>
            <span className="bar-label">
              {r.label}
              {r.key === weakestKey && <span className="severity clear">Weakest</span>}
            </span>
            <span className="bar-track" aria-hidden="true">
              <span className="bar-fill" style={{ width: `${accuracy(r) * 100}%` }} />
            </span>
            <span className="bar-value">
              {pct(r)}
              <small> · {r.answered}</small>
            </span>
          </li>
        ))}
      </ul>
    </section>
  )
}

function Heatmap({ answers, charts }: { answers: readonly AnswerLog[]; charts: readonly Chart[] }) {
  const played = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of answers) counts.set(a.chartId, (counts.get(a.chartId) ?? 0) + 1)
    return charts.filter((c) => counts.has(c.id)).sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0))
  }, [answers, charts])
  const [chartId, setChartId] = useState<string | undefined>()
  const [hand, setHand] = useState<HandClass | undefined>()
  const chart = played.find((c) => c.id === chartId) ?? played[0]
  const tallies = useMemo(() => (chart ? handTallies(answers, chart.id) : new Map()), [answers, chart])
  if (!chart) return null
  const t = hand ? tallies.get(hand) : undefined

  return (
    <section className="section">
      <h2>Leak heatmap</h2>
      <label className="select">
        <span className="visually-hidden">Chart</span>
        <select
          id="heatmap-chart"
          value={chart.id}
          onChange={(e) => {
            setChartId(e.target.value)
            setHand(undefined)
          }}
        >
          {played.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
      </label>
      <HeatGrid tallies={tallies} selected={hand} onSelect={setHand} />
      <div className="heat-legend">
        <span className="swatch none" /> not played
        <span className="ramp" aria-hidden="true" />
        <span>0% → 100% missed</span>
      </div>
      <p className="hint" aria-live="polite">
        {hand
          ? t
            ? `${hand}: missed ${t.answered - t.correct} of ${t.answered} in the last 30 days.`
            : `${hand}: not played in this chart yet.`
          : 'Darker cells are hands you miss more. Tap one for numbers.'}
      </p>
    </section>
  )
}

function BackupSection({ answers, progress, onImport, onReset }: Props) {
  const [message, setMessage] = useState<string | null>(null)
  const [paste, setPaste] = useState('')
  const [shown, setShown] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const framed = typeof window !== 'undefined' && window.self !== window.top

  const text = () => makeBackup({ answers: [...answers], progress })

  const copy = async () => {
    const t = text()
    try {
      await navigator.clipboard.writeText(t)
      setMessage(`Copied a backup of ${answers.length} hands. Paste it into a note or message to keep it.`)
      setShown(null)
    } catch {
      setShown(t)
      setMessage('Copying is blocked here. Select the text below and copy it yourself.')
    }
  }

  const download = () => {
    const url = URL.createObjectURL(new Blob([text()], { type: 'application/json' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `poker-trainer-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  const load = (raw: string) => {
    try {
      const data = parseBackup(raw)
      onImport(data)
      setPaste('')
      setMessage(
        `Restored ${data.answers.length} hands and your lesson progress.${data.skipped ? ` Skipped ${data.skipped} damaged entries.` : ''}`,
      )
    } catch (e) {
      setMessage(e instanceof BackupError ? e.message : 'Could not read that backup.')
    }
  }

  return (
    <section className="section backup">
      <h2>Backup</h2>
      <p className="hint">
        Your stats live only on this device. A backup holds every answer and your lesson progress. Restoring one replaces
        what's here.
      </p>
      <div className="button-row">
        <button type="button" className="secondary" onClick={copy}>
          Copy backup
        </button>
        {!framed && (
          <button type="button" className="secondary" onClick={download}>
            Download file
          </button>
        )}
      </div>
      {shown && <textarea id="backup-out" className="backup-text" readOnly value={shown} onFocus={(e) => e.target.select()} />}

      <label className="field-label" htmlFor="backup-in">
        Restore: paste a backup
      </label>
      <textarea
        id="backup-in"
        className="backup-text"
        placeholder='{"app":"poker-practice-trainer", …}'
        value={paste}
        onChange={(e) => setPaste(e.target.value)}
      />
      <div className="button-row">
        <button type="button" className="secondary" disabled={!paste.trim()} onClick={() => load(paste)}>
          Restore pasted backup
        </button>
        <button type="button" className="secondary" onClick={() => fileRef.current?.click()}>
          Restore from file
        </button>
        <input
          ref={fileRef}
          id="backup-file"
          type="file"
          accept="application/json,.json,.txt"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0]
            if (f) load(await f.text())
            e.target.value = ''
          }}
        />
      </div>
      {message && (
        <p className="notice" role="status">
          {message}
        </p>
      )}

      <div className="danger">
        {confirmReset ? (
          <>
            <p>Delete all {answers.length} hands and lesson progress from this device? This can't be undone.</p>
            <div className="button-row">
              <button
                type="button"
                className="danger-button"
                onClick={() => {
                  onReset()
                  setConfirmReset(false)
                  setMessage('All data deleted.')
                }}
              >
                Delete everything
              </button>
              <button type="button" className="secondary" onClick={() => setConfirmReset(false)}>
                Keep my data
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="link-button danger-link" onClick={() => setConfirmReset(true)}>
            Reset all data…
          </button>
        )}
      </div>
    </section>
  )
}

import { useState } from 'react'
import { type Clef, noteFromDiatonic, noteName } from '../../core/piano/notes'
import { type NoteStat, type PianoStats as Stats, type RowTotals, summarize, weakest } from '../../core/piano/stats'

interface Props {
  stats: Stats
  rows: RowTotals
  /** Keyed like "treble:F major". */
  chords: Record<string, NoteStat>
  onReset: () => void
}

const CLEF_LABEL: Record<Clef, string> = {
  treble: 'Right hand · treble',
  bass: 'Left hand · bass',
}
/** Natural notes shown per clef, low to high: 3 ledger lines each way. */
const RANGE: Record<Clef, [number, number]> = {
  treble: [24, 44],
  bass: [12, 32],
}

const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–')
const secs = (ms: number) => (ms ? `${(ms / 1000).toFixed(1)} s` : '–')

const tone = (acc: number | null) => (acc === null ? 'none' : acc >= 0.9 ? 'good' : acc >= 0.7 ? 'ok' : 'bad')

export function PianoStatsScreen({ stats, rows, chords, onReset }: Props) {
  const [confirm, setConfirm] = useState(false)
  const all = summarize(stats)
  const weak = weakest(stats)
  const chordAll = summarize(chords)
  const chordWeak = weakest(chords)

  if (!all.n && !rows.rows && !chordAll.n) {
    return (
      <>
        <header className="header">
          <h1>Piano stats</h1>
        </header>
        <div className="empty">
          <h2>No notes yet</h2>
          <p className="muted">Finish a few notes, rows or chords in Practice and your accuracy and speed show up here.</p>
        </div>
      </>
    )
  }

  return (
    <>
      <header className="header">
        <h1>Piano stats</h1>
      </header>

      {all.n > 0 && (
        <div className="stat-tiles">
          <div>
            <span className="eyebrow">Notes</span>
            <strong>{all.n}</strong>
          </div>
          <div>
            <span className="eyebrow">Accuracy</span>
            <strong>{pct(all.correct, all.n)}</strong>
          </div>
          <div>
            <span className="eyebrow">Per note</span>
            <strong>{secs(all.avgMs)}</strong>
          </div>
        </div>
      )}

      {weak.length > 0 && (
        <section className="section">
          <h2>Practise these</h2>
          <ul className="note-chips">
            {weak.map(({ key, stat }) => (
              <li key={key}>
                {key.split(':')[1]}{' '}
                <span className="muted">
                  {key.startsWith('treble') ? 'RH' : 'LH'} · {pct(stat.correct, stat.n)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {all.n > 0 &&
        (['treble', 'bass'] as Clef[]).map((clef) => {
          const s = summarize(stats, (k) => k.startsWith(`${clef}:`))
          const [lo, hi] = RANGE[clef]
          const notes = Array.from({ length: hi - lo + 1 }, (_, i) => noteName(noteFromDiatonic(hi - i)))
          return (
            <section key={clef} className="section">
              <h2>{CLEF_LABEL[clef]}</h2>
              <p className="muted">
                {s.n ? `${s.n} notes · ${pct(s.correct, s.n)} right · ${secs(s.avgMs)} per note` : 'Not practised yet.'}
              </p>
              {s.n > 0 && (
                <ul className="note-grid">
                  {notes.map((name) => {
                    // Sharps and flats of this letter count toward it here.
                    const keys = Object.keys(stats).filter((k) => k.startsWith(`${clef}:`) && k.replace(/[♯♭]/, '') === `${clef}:${name}`)
                    const n = keys.reduce((a, k) => a + stats[k].n, 0)
                    const c = keys.reduce((a, k) => a + stats[k].correct, 0)
                    const acc = n ? c / n : null
                    return (
                      <li key={name} className={tone(acc)} title={n ? `${name}: ${c}/${n}` : `${name}: not seen`}>
                        <span>{name}</span>
                        <small>{acc === null ? '·' : pct(c, n)}</small>
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          )
        })}

      {rows.rows > 0 && (
        <section className="section">
          <h2>Rows</h2>
          <p className="muted">
            {`${rows.rows} ${rows.rows === 1 ? 'row' : 'rows'} · ${pct(rows.correct, rows.notes)} notes right · ${secs(rows.ms / rows.rows)} per row · ${rows.clean} clean`}
          </p>
        </section>
      )}

      {chordAll.n > 0 && (
        <section className="section">
          <h2>Chords</h2>
          <p className="muted">
            {`${chordAll.n} chords · ${pct(chordAll.correct, chordAll.n)} right · ${secs(chordAll.avgMs)} per chord`}
          </p>
          {chordWeak.length > 0 && (
            <ul className="note-chips">
              {chordWeak.map(({ key, stat }) => (
                <li key={key}>
                  {key.split(':')[1]}{' '}
                  <span className="muted">
                    {key.startsWith('treble') ? 'RH' : 'LH'} · {pct(stat.correct, stat.n)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <ul className="note-grid chord-grid">
            {Object.entries(chords)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([key, stat]) => (
                <li key={key} className={tone(stat.correct / stat.n)} title={`${key.split(':')[1]}: ${stat.correct}/${stat.n}`}>
                  <span>{key.split(':')[1]}</span>
                  <small>
                    {key.startsWith('treble') ? 'RH' : 'LH'} · {pct(stat.correct, stat.n)}
                  </small>
                </li>
              ))}
          </ul>
        </section>
      )}

      <section className="section">
        {confirm ? (
          <div className="confirm-row">
            <span>Delete all piano stats?</span>
            <button type="button" className="link-button danger" onClick={() => (onReset(), setConfirm(false))}>
              Delete
            </button>
            <button type="button" className="link-button" onClick={() => setConfirm(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button type="button" className="link-button" onClick={() => setConfirm(true)}>
            Reset piano stats
          </button>
        )}
      </section>
    </>
  )
}

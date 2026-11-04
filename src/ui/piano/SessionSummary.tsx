import type { MissedChip } from './drillUtils'

interface SummaryProps {
  right: number
  total: number
  /** e.g. "83% right · 6.2 s per row · 4 clean rows". */
  detail: string
  missed: MissedChip[]
  onExit: () => void
}

/** End-of-session screen shared by the piano drills. */
export function SessionSummary({ right, total, detail, missed, onExit }: SummaryProps) {
  const unique = [...new Map(missed.map((m) => [m.key, m])).values()]
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
          <span>/{total}</span>
        </p>
        <p className="muted">{detail}</p>
        {unique.length > 0 && (
          <section className="section">
            <h2>Missed</h2>
            <ul className="note-chips">
              {unique.map((m) => (
                <li key={m.key}>
                  {m.label} <span className="muted">{m.hand}</span>
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

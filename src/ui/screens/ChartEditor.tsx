import { useState } from 'react'
import { type Action, type Chart, type ChartDef, type Mix, ACTIONS, actionLabel, actionShares } from '../../core/charts'
import type { HandClass } from '../../core/hands'
import { type ChartOverride, applyOverride, sameStrategy, sanityWarnings, strategyToOverride } from '../../core/overrides'
import { RangeGrid } from '../components/RangeGrid'
import { percent } from '../labels'
import { mixBackground } from '../mixBackground'

interface Props {
  def: ChartDef
  /** The chart as currently used (default or edited). */
  chart: Chart
  onSave: (override: ChartOverride | null) => void
  onCancel: () => void
}

/** Paint a chart's ranges, or type them in range notation. */
export function ChartEditor({ def, chart, onSave, onCancel }: Props) {
  const defaults = applyOverride(def)
  const [strategy, setStrategy] = useState<Record<HandClass, Mix>>(chart.strategy)
  const brushes: Action[] = chart.spot === 'rfi' ? ['raise', 'fold'] : ['raise', 'call', 'fold']
  const [brush, setBrush] = useState<Action>('raise')
  const [eraseStroke, setEraseStroke] = useState(false)
  const initialText = strategyToOverride(chart.strategy).actions
  const [raiseText, setRaiseText] = useState(initialText.raise)
  const [callText, setCallText] = useState(initialText.call)
  const [textError, setTextError] = useState<string | null>(null)

  const preview: Chart = { ...chart, strategy }
  const shares = actionShares(preview)
  const warnings = sanityWarnings(preview)
  const isDefault = sameStrategy(strategy, defaults.strategy)
  const changed = !sameStrategy(strategy, chart.strategy)

  const syncText = (next: Record<HandClass, Mix>) => {
    const t = strategyToOverride(next).actions
    setRaiseText(t.raise)
    setCallText(t.call)
    setTextError(null)
  }

  const paint = (hand: HandClass, first: boolean) => {
    // A stroke that starts on a cell already painted with the brush erases (to fold) instead.
    let erase = eraseStroke
    if (first) {
      erase = brush !== 'fold' && (strategy[hand][brush] ?? 0) === 1
      setEraseStroke(erase)
    }
    setStrategy((prev) => {
      const next = { ...prev, [hand]: { [erase ? 'fold' : brush]: 1 } }
      syncText(next)
      return next
    })
  }

  const applyText = () => {
    try {
      const c = applyOverride(def, { actions: { raise: raiseText, call: chart.spot === 'rfi' ? '' : callText } })
      setStrategy(c.strategy)
      setTextError(null)
    } catch (e) {
      setTextError((e as Error).message.replace(/^Chart "[^"]+": /, ''))
    }
  }

  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onCancel} aria-label="Cancel editing">
          ‹
        </button>
        <h1>Edit: {chart.title}</h1>
      </header>

      <p className="hint">
        Pick an action, then tap or drag across hands. Starting on a hand that already has that action clears it to fold.
      </p>

      <div className="segmented brushes" role="group" aria-label="Paint with">
        {brushes.map((a) => (
          <button key={a} type="button" aria-pressed={brush === a} onClick={() => setBrush(a)}>
            <i className="swatch" style={{ background: mixBackground({ [a]: 1 }) }} />
            {actionLabel(chart.spot, a)}
          </button>
        ))}
      </div>

      <RangeGrid chart={preview} onPaint={paint} />

      <div className="legend">
        {ACTIONS.filter((a) => a === 'fold' || shares[a] > 0).map((a) => (
          <span key={a}>
            <i className="swatch" style={{ background: mixBackground({ [a]: 1 }) }} />
            {actionLabel(chart.spot, a)} {percent(shares[a])}
          </span>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="notice warnings">
          {warnings.map((w) => (
            <li key={w}>{w}</li>
          ))}
        </ul>
      )}

      <section className="section">
        <h2>As range text</h2>
        <p className="hint">
          Edit or paste ranges like <code>22+, A2s+, KTo+</code>, then tap Apply. Hands in both lists count as{' '}
          {actionLabel(chart.spot, 'raise').toLowerCase()}.
        </p>
        <label className="field-label" htmlFor="range-raise">
          {actionLabel(chart.spot, 'raise')}
        </label>
        <textarea id="range-raise" className="backup-text" value={raiseText} onChange={(e) => setRaiseText(e.target.value)} />
        {chart.spot !== 'rfi' && (
          <>
            <label className="field-label" htmlFor="range-call">
              Call
            </label>
            <textarea id="range-call" className="backup-text" value={callText} onChange={(e) => setCallText(e.target.value)} />
          </>
        )}
        <button type="button" className="secondary" onClick={applyText}>
          Apply text to the grid
        </button>
        {textError && (
          <p className="notice" role="alert">
            {textError}
          </p>
        )}
      </section>

      <div className="summary-actions">
        <button type="button" className="primary" disabled={!changed} onClick={() => onSave(isDefault ? null : strategyToOverride(strategy))}>
          Save chart
        </button>
        {!isDefault && (
          <button
            type="button"
            className="secondary"
            onClick={() => {
              setStrategy(defaults.strategy)
              syncText(defaults.strategy)
            }}
          >
            Reset to the app's default
          </button>
        )}
        <button type="button" className="secondary" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </>
  )
}

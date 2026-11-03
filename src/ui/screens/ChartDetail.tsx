import { useState } from 'react'
import { type Chart, ACTIONS, actionLabel, actionShares, correctActions } from '../../core/charts'
import { type HandClass, handCategory } from '../../core/hands'
import { topPercent } from '../../core/strength'
import { RangeGrid } from '../components/RangeGrid'
import { mixBackground } from '../mixBackground'
import { Matchup } from '../components/Positions'
import { CATEGORY_NAMES, SPOT_TITLES, handName, percent } from '../labels'
import { RichText } from '../learn/RichText'

export function ChartDetail({ chart, onBack }: { chart: Chart; onBack: () => void }) {
  const [selected, setSelected] = useState<HandClass | undefined>()
  const shares = actionShares(chart)
  const legend = ACTIONS.filter((a) => a === 'fold' || shares[a] > 0)

  return (
    <>
      <header className="header">
        <button type="button" className="back" onClick={onBack} aria-label="Back to all charts">
          ‹
        </button>
        <h1>{chart.title}</h1>
      </header>
      <div className="chart-meta">
        <span className="eyebrow">{SPOT_TITLES[chart.spot]}</span>
        <Matchup chart={chart} />
      </div>
      <p className="key-idea">
        <RichText text={chart.keyIdea} />
      </p>

      <RangeGrid chart={chart} selected={selected} onSelect={setSelected} />

      <div className="legend">
        {legend.map((a) => (
          <span key={a}>
            <i className="swatch" style={{ background: mixBackground({ [a]: 1 }) }} />
            {actionLabel(chart.spot, a)} {percent(shares[a])}
          </span>
        ))}
      </div>

      {selected ? (
        <HandDetail chart={chart} hand={selected} />
      ) : (
        <p className="muted" style={{ fontSize: 'var(--step--1)' }}>
          Tap any hand for details. Percentages count every card combination, so pairs and offsuit hands weigh more than
          they look.
        </p>
      )}
    </>
  )
}

function HandDetail({ chart, hand }: { chart: Chart; hand: HandClass }) {
  const actions = correctActions(chart, hand)
  const mix = chart.strategy[hand]
  const mixed = actions.length > 1
  return (
    <div className="hand-detail" aria-live="polite">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
        <span className="hand-name">{hand}</span>
        <span className="muted">
          {handName(hand)} · {CATEGORY_NAMES[handCategory(hand)]} · top {percent(topPercent(hand))}
        </span>
      </div>
      <p>
        <strong>
          {mixed
            ? actions.map((a) => `${actionLabel(chart.spot, a)} ${percent(mix[a] ?? 0)}`).join(' / ')
            : actionLabel(chart.spot, actions[0])}
        </strong>
      </p>
      {chart.notes[hand] && (
        <p>
          <RichText text={chart.notes[hand]} />
        </p>
      )}
    </div>
  )
}

import type { CSSProperties } from 'react'
import { type HandClass, handAt } from '../../core/hands'
import type { Tally } from '../../core/stats'

interface Props {
  tallies: Map<HandClass, Tally>
  selected?: HandClass
  onSelect: (hand: HandClass) => void
}

/** Miss-rate heatmap on the 13×13 grid: one hue, darker = missed more often. */
export function HeatGrid({ tallies, selected, onSelect }: Props) {
  const cells = []
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handAt(r, c)
      const t = tallies.get(hand)
      const miss = t ? (t.answered - t.correct) / t.answered : 0
      const style: CSSProperties = t
        ? {
            background: `color-mix(in oklab, var(--sev-blunder) ${Math.round(12 + 88 * miss)}%, var(--surface-2))`,
            color: miss > 0.45 ? 'var(--on-action)' : 'var(--fg)',
          }
        : { background: 'var(--bg)', color: 'var(--fold-fg)' }
      const label = t ? `${hand}: missed ${t.answered - t.correct} of ${t.answered}` : `${hand}: not played yet`
      cells.push(
        <button
          key={hand}
          type="button"
          className={`cell${hand === selected ? ' selected' : ''}`}
          style={style}
          title={label}
          aria-label={label}
          onClick={() => onSelect(hand)}
        >
          {hand}
        </button>,
      )
    }
  }
  return (
    <div className="grid heat" role="grid" aria-label="Leak heatmap">
      {cells}
    </div>
  )
}

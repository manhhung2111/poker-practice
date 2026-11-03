import type { CSSProperties } from 'react'
import { type Chart, mainAction } from '../../core/charts'
import { type HandClass, handAt } from '../../core/hands'
import { mixBackground } from '../mixBackground'

interface Props {
  chart: Chart
  /** Hand to pulse-highlight (e.g. the hand you were dealt). */
  hero?: HandClass
  /** Hand currently tapped. */
  selected?: HandClass
  onSelect?: (hand: HandClass) => void
}

/** The 13×13 starting-hand chart. Pairs on the diagonal, suited top-right, offsuit bottom-left. */
export function RangeGrid({ chart, hero, selected, onSelect }: Props) {
  const cells = []
  for (let r = 0; r < 13; r++) {
    for (let c = 0; c < 13; c++) {
      const hand = handAt(r, c)
      const mix = chart.strategy[hand]
      const action = mainAction(chart, hand)
      const style: CSSProperties = { background: mixBackground(mix) }
      const cls = ['cell', action === 'fold' && !mix.raise && !mix.call ? 'fold' : '']
      if (hand === hero) cls.push('hero')
      if (hand === selected) cls.push('selected')
      cells.push(
        <button
          key={hand}
          type="button"
          className={cls.filter(Boolean).join(' ')}
          style={style}
          onClick={() => onSelect?.(hand)}
          aria-label={`${hand}: ${action}`}
        >
          {hand}
        </button>,
      )
    }
  }
  return (
    <div className="grid" role="grid" aria-label={`${chart.title} range chart`}>
      {cells}
    </div>
  )
}

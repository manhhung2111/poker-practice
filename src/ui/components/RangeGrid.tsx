import { type CSSProperties, type PointerEvent, useRef } from 'react'
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
  /** Edit mode: called for every cell touched while tapping or dragging; `first` marks the start of a stroke. */
  onPaint?: (hand: HandClass, first: boolean) => void
}

/** The 13×13 starting-hand chart. Pairs on the diagonal, suited top-right, offsuit bottom-left. */
export function RangeGrid({ chart, hero, selected, onSelect, onPaint }: Props) {
  const painting = useRef(false)
  const last = useRef<HandClass | null>(null)

  const handAtPoint = (x: number, y: number): HandClass | null => {
    const el = document.elementFromPoint(x, y) as HTMLElement | null
    return el?.dataset.hand ?? null
  }
  const paint = (hand: HandClass | null) => {
    if (!hand || hand === last.current) return
    const first = last.current === null
    last.current = hand
    onPaint?.(hand, first)
  }
  const paintHandlers = onPaint
    ? {
        onPointerDown: (e: PointerEvent<HTMLDivElement>) => {
          painting.current = true
          last.current = null
          e.currentTarget.setPointerCapture(e.pointerId)
          paint(handAtPoint(e.clientX, e.clientY))
        },
        onPointerMove: (e: PointerEvent<HTMLDivElement>) => {
          if (painting.current) paint(handAtPoint(e.clientX, e.clientY))
        },
        onPointerUp: () => {
          painting.current = false
        },
        onPointerCancel: () => {
          painting.current = false
        },
      }
    : {}

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
          data-hand={hand}
          className={cls.filter(Boolean).join(' ')}
          style={style}
          onClick={onPaint ? undefined : () => onSelect?.(hand)}
          onKeyDown={
            onPaint
              ? (e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onPaint(hand, true)
                  }
                }
              : undefined
          }
          aria-label={`${hand}: ${action}`}
        >
          {hand}
        </button>,
      )
    }
  }
  return (
    <div
      className={`grid${onPaint ? ' editing' : ''}`}
      role="grid"
      aria-label={`${chart.title} range chart`}
      {...paintHandlers}
    >
      {cells}
    </div>
  )
}

import type { SeatState } from '../../core/dealing'
import { type Position, POSITIONS } from '../../core/positions'

interface Props {
  hero: Position
  seats: Partial<Record<Position, SeatState>>
  /** Bet shown in front of a seat, in bb (blinds, raises). */
  bets?: Partial<Record<Position, number>>
}

const W = 320
const H = 176
const CX = W / 2
const CY = H / 2
const RX = 128
const RY = 64

/**
 * A 9-seat table seen from above, rotated so the hero sits at the bottom.
 * Seats go clockwise in action order (UTG → BB).
 */
export function MiniTable({ hero, seats, bets = {} }: Props) {
  const heroIndex = POSITIONS.indexOf(hero)
  const place = (p: Position, scale = 1) => {
    const offset = (POSITIONS.indexOf(p) - heroIndex + 9) % 9
    const angle = Math.PI / 2 + (offset * 2 * Math.PI) / 9
    return { x: CX + RX * scale * Math.cos(angle), y: CY + RY * scale * Math.sin(angle) }
  }
  const btn = place('BTN', 0.72)
  const label = (p: Position) => seats[p] ?? 'waiting'

  return (
    <svg className="mini-table" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Table: you are ${hero}`}>
      <ellipse cx={CX} cy={CY} rx={RX - 18} ry={RY - 14} className="felt" />
      {POSITIONS.map((p) => {
        const b = bets[p]
        if (!b) return null
        const at = place(p, 0.58)
        return (
          <g key={`bet-${p}`} className={`bet${label(p) === 'raised' ? ' raised' : ''}`}>
            <circle cx={at.x} cy={at.y} r={4} />
            <text x={at.x + 7} y={at.y + 3.5}>
              {b}
            </text>
          </g>
        )
      })}
      <g className="dealer">
        <circle cx={btn.x} cy={btn.y} r={7} />
        <text x={btn.x} y={btn.y + 3.5} textAnchor="middle">
          D
        </text>
      </g>
      {POSITIONS.map((p) => {
        const { x, y } = place(p)
        const state = label(p)
        const w = p === hero ? 56 : 46
        return (
          <g key={p} className={`seat ${state}`}>
            <rect x={x - w / 2} y={y - 11} width={w} height={22} rx={6} />
            <text x={x} y={y + 4.5} textAnchor="middle">
              {p === hero ? `YOU ${p}` : p}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

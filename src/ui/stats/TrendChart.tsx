import { type Tally, accuracy } from '../../core/stats'

const W = 320
const H = 140
const PAD = { top: 12, right: 30, bottom: 34, left: 8 }

/** Daily accuracy for the last 7 days, with the 80% pass line. */
export function TrendChart({ days }: { days: (Tally & { day: number })[] }) {
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom
  const slot = innerW / days.length
  const barW = Math.min(26, slot - 10)
  const y = (v: number) => PAD.top + innerH * (1 - v)
  const fmt = new Intl.DateTimeFormat(undefined, { weekday: 'short' })
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Accuracy per day, last 7 days">
      {[0, 0.5, 1].map((v) => (
        <line key={v} x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} className="grid-line" />
      ))}
      <line x1={PAD.left} x2={W - PAD.right} y1={y(0.8)} y2={y(0.8)} className="pass-line" />
      <text x={W - PAD.right + 4} y={y(0.8) + 4} className="axis-label">
        80%
      </text>
      <text x={W - PAD.right + 4} y={y(1) + 4} className="axis-label">
        100
      </text>
      <text x={W - PAD.right + 4} y={y(0) + 4} className="axis-label">
        0
      </text>
      {days.map((d, i) => {
        const cx = PAD.left + slot * i + slot / 2
        const acc = accuracy(d)
        const label = d.answered
          ? `${fmt.format(d.day)}: ${Math.round(acc * 100)}% of ${d.answered} hands`
          : `${fmt.format(d.day)}: no hands`
        const top = y(acc)
        const h = y(0) - top
        return (
          <g key={d.day}>
            <title>{label}</title>
            {/* Full-height hit area, bigger than the bar. */}
            <rect x={cx - slot / 2} y={PAD.top} width={slot} height={innerH} fill="transparent" />
            {d.answered > 0 ? (
              <path
                className="bar"
                d={`M${cx - barW / 2},${y(0)} V${top + 4} q0,-4 4,-4 H${cx + barW / 2 - 4} q4,0 4,4 V${y(0)} Z`}
                style={{ opacity: h > 0 ? 1 : 0 }}
              />
            ) : (
              <circle cx={cx} cy={y(0) - 2} r={2} className="empty-dot" />
            )}
            <text x={cx} y={H - 18} textAnchor="middle" className="axis-label">
              {fmt.format(d.day).slice(0, 2)}
            </text>
            <text x={cx} y={H - 4} textAnchor="middle" className="axis-label count">
              {d.answered || ''}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

import { type Clef, type Level, type Note, ACC_SYMBOL, LEVEL_STEPS, ledgerSteps, staffStep } from '../../core/piano/notes'

/** Half a line gap: one staff step. */
const STEP = 6
const WIDTH = 300
const STAFF_H = 8 * STEP
/** A lone column sits right of centre; several spread across the staff after the clef. */
const SINGLE_X = 190
const FIRST_X = 82
const LAST_X = 274
const ACC_W = 12

export type NoteMark = 'neutral' | 'right' | 'wrong'

/** One x position on the staff: a single note, or a stacked chord. */
export interface StaffColumn {
  notes: Note[]
  mark?: NoteMark
}

interface Props {
  /** Staves to draw, top to bottom (two = grand staff). */
  clefs: Clef[]
  /** The staff the columns sit on. */
  clef: Clef
  level: Level
  columns: StaffColumn[]
  /** Column under the gold "you are here" bar. */
  current?: number
  /** Extra steps of room above and below the level (chords may reach one ledger line further). */
  levelPad?: number
}

/** Room above/below a staff for the level's ledger notes (and the clef's overhang). */
const margin = (level: Level, pad: number) => Math.max(26, (LEVEL_STEPS[level][1] + pad - 8) * STEP + 14)

const columnX = (i: number, count: number) => (count === 1 ? SINGLE_X : FIRST_X + ((LAST_X - FIRST_X) * i) / (count - 1))

/**
 * One staff (one hand) or a grand staff (both hands) with note columns and their ledger lines.
 * Clefs and accidentals come from the Noto Music font; glyph offsets were measured from its outlines.
 */
export function Staff({ clefs, clef, level, columns, current, levelPad = 0 }: Props) {
  const m = margin(level, levelPad)
  // Bottom-line y of each staff, top to bottom.
  const bottoms: Partial<Record<Clef, number>> = {}
  let y = m
  for (const c of clefs) {
    bottoms[c] = y + STAFF_H
    y += STAFF_H + m * (clefs.length > 1 ? 1.3 : 1)
  }
  const height = clefs.length > 1 ? y - m * 0.3 : y
  const yOf = (c: Clef, step: number) => bottoms[c]! - step * STEP
  const first = bottoms[clefs[0]]! - STAFF_H
  const last = bottoms[clefs[clefs.length - 1]]!
  const label = columns.length > 1 ? `${columns.length} notes on the staff` : columns[0]?.notes.length > 1 ? 'Chord on the staff' : 'Note on the staff'

  return (
    <svg className="staff" viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={columns.length ? label : 'Staff'}>
      {current !== undefined && columns[current] && (
        <rect className="current-bar" x={columnX(current, columns.length) - 14} y={yOf(clef, 8) - m + 6} width="28" height={STAFF_H + 2 * m - 12} rx="5" />
      )}
      {clefs.length > 1 && <path className="staff-line" d={`M8 ${first}V${last}`} strokeWidth="1.5" />}
      {clefs.map((c) => (
        <g key={c}>
          {[0, 2, 4, 6, 8].map((s) => (
            <line key={s} className="staff-line" x1="8" x2={WIDTH - 8} y1={yOf(c, s)} y2={yOf(c, s)} />
          ))}
          <line className="staff-line" x1={WIDTH - 8} x2={WIDTH - 8} y1={yOf(c, 8)} y2={yOf(c, 0)} />
          {c === 'treble' ? (
            <text className="clef" x="16" y={yOf(c, 0)} fontSize={STAFF_H}>
              𝄞
            </text>
          ) : (
            <text className="clef" x="16" y={yOf(c, 1)} fontSize={STAFF_H}>
              𝄢
            </text>
          )}
        </g>
      ))}
      {columns.map((col, i) => {
        const x = columnX(i, columns.length)
        const steps = col.notes.map((n) => staffStep(n, clef))
        const ledgers = [...new Set(steps.flatMap(ledgerSteps))]
        // Accidentals top-down; one within 4 steps of the last placed one moves a column further left.
        const accs: { step: number; acc: -1 | 1; shift: number }[] = []
        col.notes
          .map((n, k) => ({ step: steps[k], acc: n.acc }))
          .filter((a): a is { step: number; acc: -1 | 1 } => a.acc !== 0)
          .sort((a, b) => b.step - a.step)
          .forEach((a) => {
            const prev = accs[accs.length - 1]
            const shift = prev && prev.step - a.step <= 4 ? prev.shift + 1 : 0
            accs.push({ ...a, shift })
          })
        return (
          <g key={i} className={`note mark-${col.mark ?? 'neutral'}`} aria-hidden="true">
            {ledgers.map((s) => (
              <line key={s} className="staff-line" x1={x - 15} x2={x + 15} y1={yOf(clef, s)} y2={yOf(clef, s)} />
            ))}
            {accs.map((a) => (
              <text
                key={a.step}
                className="accidental"
                x={x - 13 - a.shift * ACC_W}
                y={yOf(clef, a.step) + (a.acc > 0 ? 5.5 : 4)}
                fontSize={42}
                textAnchor="end"
              >
                {ACC_SYMBOL[a.acc]}
              </text>
            ))}
            {steps.map((s, k) => (
              <ellipse key={k} className="note-head" cx={x} cy={yOf(clef, s)} rx="7.6" ry="5.6" transform={`rotate(-20 ${x} ${yOf(clef, s)})`} />
            ))}
          </g>
        )
      })}
    </svg>
  )
}

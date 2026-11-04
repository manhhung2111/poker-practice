import { type Clef, type Level, type Prompt, ACC_SYMBOL, LEVEL_STEPS, ledgerSteps, staffStep } from '../../core/piano/notes'

/** Half a line gap: one staff step. */
const STEP = 6
const WIDTH = 300
const NOTE_X = 190
const STAFF_H = 8 * STEP

export type NoteMark = 'neutral' | 'right' | 'wrong'

interface Props {
  clefs: Clef[]
  level: Level
  prompt: Prompt | null
  mark?: NoteMark
}

/** Room above/below a staff for the level's ledger notes (and the clef's overhang). */
const margin = (level: Level) => Math.max(26, (LEVEL_STEPS[level][1] - 8) * STEP + 14)

/**
 * One staff (one hand) or a grand staff (both hands), with a single note head and its
 * ledger lines. Clefs come from the Noto Music font.
 */
export function Staff({ clefs, level, prompt, mark = 'neutral' }: Props) {
  const m = margin(level)
  // Bottom-line y of each staff, top to bottom.
  const bottoms: Partial<Record<Clef, number>> = {}
  let y = m
  for (const c of clefs) {
    bottoms[c] = y + STAFF_H
    y += STAFF_H + m * (clefs.length > 1 ? 1.3 : 1)
  }
  const height = clefs.length > 1 ? y - m * 0.3 : y
  const yOf = (clef: Clef, step: number) => bottoms[clef]! - step * STEP

  const step = prompt ? staffStep(prompt.note, prompt.clef) : 0
  const noteY = prompt ? yOf(prompt.clef, step) : 0
  const first = bottoms[clefs[0]]! - STAFF_H
  const last = bottoms[clefs[clefs.length - 1]]!

  return (
    <svg className={`staff mark-${mark}`} viewBox={`0 0 ${WIDTH} ${height}`} role="img" aria-label={prompt ? 'Note on the staff' : 'Staff'}>
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
      {prompt && (
        <g className="note" aria-hidden="true">
          {ledgerSteps(step).map((s) => (
            <line key={s} className="staff-line" x1={NOTE_X - 15} x2={NOTE_X + 15} y1={yOf(prompt.clef, s)} y2={yOf(prompt.clef, s)} />
          ))}
          {prompt.note.acc !== 0 && (
            <text className="accidental" x={NOTE_X - 13} y={noteY + (prompt.note.acc > 0 ? 5.5 : 4)} fontSize={42} textAnchor="end">
              {ACC_SYMBOL[prompt.note.acc]}
            </text>
          )}
          <ellipse className="note-head" cx={NOTE_X} cy={noteY} rx="7.6" ry="5.6" transform={`rotate(-20 ${NOTE_X} ${noteY})`} />
        </g>
      )}
    </svg>
  )
}

import { PITCH_CLASS_NAMES } from '../../core/piano/notes'

/** answer = the right key after a wrong single note; selected = picked for a chord; missed = a chord key not picked. */
export type KeyMark = 'right' | 'wrong' | 'answer' | 'selected' | 'missed'

interface Props {
  /** Pitch class (0–11) → highlight. */
  marks: Partial<Record<number, KeyMark>>
  labels: boolean
  disabled?: boolean
  /** Called with a MIDI number in the middle-C octave; only its pitch class matters. */
  onPress: (midi: number) => void
}

const WHITE = [0, 2, 4, 5, 7, 9, 11]
/** Black keys and the white-key boundary (1–6) they sit on. */
const BLACK: [number, number][] = [
  [1, 1],
  [3, 2],
  [6, 4],
  [8, 5],
  [10, 6],
]

/** One octave, C to B. */
export function Keyboard({ marks, labels, disabled, onPress }: Props) {
  const key = (pc: number, black: boolean, style?: React.CSSProperties) => (
    <button
      key={pc}
      type="button"
      className={`key ${black ? 'black' : 'white'}${marks[pc] ? ` ${marks[pc]}` : ''}`}
      style={style}
      aria-label={PITCH_CLASS_NAMES[pc]}
      disabled={disabled}
      onClick={() => onPress(60 + pc)}
    >
      {labels && <span>{PITCH_CLASS_NAMES[pc]}</span>}
    </button>
  )
  return (
    <div className="keyboard" role="group" aria-label="Piano keys">
      {WHITE.map((pc) => key(pc, false))}
      {BLACK.map(([pc, at]) => key(pc, true, { left: `calc(${(at * 100) / 7}% - var(--black-w) / 2)` }))}
    </div>
  )
}

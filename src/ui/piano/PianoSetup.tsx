import type { Hand, Level } from '../../core/piano/notes'
import { type DrillMode, type PianoSettings, SESSION_CHOICES } from './settings'
import { midiSupported } from './useMidi'

interface Props {
  settings: PianoSettings
  onChange: (s: PianoSettings) => void
  onStart: () => void
}

const MODES: { id: DrillMode; label: string; note: string; unit: string }[] = [
  { id: 'single', label: 'Single notes', note: 'One note at a time.', unit: 'notes' },
  { id: 'row', label: 'Read a row', note: 'Six notes, left to right. Keep going.', unit: 'rows' },
  { id: 'chord', label: 'Chords', note: 'Play the three notes of a chord.', unit: 'chords' },
]

const HANDS: { id: Hand; label: string }[] = [
  { id: 'right', label: 'Right' },
  { id: 'left', label: 'Left' },
  { id: 'both', label: 'Both' },
]

const LEVELS: { id: Level; title: string; note: string }[] = [
  { id: 'staff', title: 'On the staff', note: 'The 5 lines and 4 spaces' },
  { id: 'ledger', title: 'Ledger lines', note: 'Up to 2 lines above or below' },
  { id: 'wide', title: 'Wide', note: 'Up to 3 ledger lines' },
]

const HAND_NOTES: Record<Hand, string> = {
  right: 'Right hand reads the treble clef.',
  left: 'Left hand reads the bass clef.',
  both: 'Grand staff: each note lands on either clef.',
}

export function PianoSetup({ settings, onChange, onStart }: Props) {
  const set = (patch: Partial<PianoSettings>) => onChange({ ...settings, ...patch })
  const mode = MODES.find((m) => m.id === settings.mode)!
  return (
    <>
      <header className="header">
        <h1>Read notes</h1>
      </header>
      <div className="setup">
        <fieldset className="field">
          <legend>Drill</legend>
          <div className="segmented">
            {MODES.map((m) => (
              <button key={m.id} type="button" aria-pressed={settings.mode === m.id} onClick={() => set({ mode: m.id })}>
                {m.label}
              </button>
            ))}
          </div>
          <p className="hint">{mode.note}</p>
        </fieldset>

        <fieldset className="field">
          <legend>Hand</legend>
          <div className="segmented">
            {HANDS.map((h) => (
              <button key={h.id} type="button" aria-pressed={settings.hand === h.id} onClick={() => set({ hand: h.id })}>
                {h.label}
              </button>
            ))}
          </div>
          <p className="hint">{HAND_NOTES[settings.hand]}</p>
        </fieldset>

        <fieldset className="field">
          <legend>Range</legend>
          <div className="options">
            {LEVELS.map((l) => (
              <label key={l.id} className={`option${l.id === 'wide' ? ' wide' : ''}`}>
                <input type="radio" name="piano-level" checked={settings.level === l.id} onChange={() => set({ level: l.id })} />
                <span>
                  {l.title}
                  <small>{l.note}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Options</legend>
          <div className="options">
            <label className="option">
              <input type="checkbox" checked={settings.accidentals} onChange={(e) => set({ accidentals: e.target.checked })} />
              <span>
                Sharps &amp; flats
                <small>♯ and ♭ notes too</small>
              </span>
            </label>
            <label className="option">
              <input type="checkbox" checked={settings.labels} onChange={(e) => set({ labels: e.target.checked })} />
              <span>
                Key names
                <small>Letters on the keys</small>
              </span>
            </label>
            {midiSupported() && (
              <label className="option wide">
                <input type="checkbox" checked={settings.midi} onChange={(e) => set({ midi: e.target.checked })} />
                <span>
                  MIDI keyboard
                  <small>Play answers on a connected keyboard; the octave must match</small>
                </span>
              </label>
            )}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Session</legend>
          <div className="segmented">
            {SESSION_CHOICES[settings.mode].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={settings.lengths[settings.mode] === n}
                onClick={() => set({ lengths: { ...settings.lengths, [settings.mode]: n } })}
              >
                {n ? `${n} ${mode.unit}` : 'Endless'}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" className="primary" onClick={onStart}>
          Start
        </button>
      </div>
    </>
  )
}

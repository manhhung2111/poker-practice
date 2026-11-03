import { type DrillChoice, type DrillSpot, DRILL_SPOTS, availableSpots, heroOptions } from '../../core/dealing'
import { type Position, POSITIONS, POSITION_GROUPS } from '../../core/positions'
import { DRILL_SPOT_NOTES, DRILL_SPOT_TITLES } from '../labels'
import { type DrillSettings, SESSION_LENGTH } from './settings'

interface Props {
  settings: DrillSettings
  onChange: (s: DrillSettings) => void
  onStart: () => void
}

const CHOICES: DrillChoice[] = [...DRILL_SPOTS, 'mixed']

const PRESETS: { label: string; positions: readonly Position[] }[] = [
  { label: 'All', positions: POSITIONS },
  { label: 'Early', positions: POSITION_GROUPS.early },
  { label: 'Middle', positions: POSITION_GROUPS.middle },
  { label: 'Late', positions: POSITION_GROUPS.late },
  { label: 'Blinds', positions: POSITION_GROUPS.blinds },
]

/** Seats that can be drilled for a choice. */
function usableSeats(choice: DrillChoice): Set<Position> {
  const types: readonly DrillSpot[] = choice === 'mixed' ? DRILL_SPOTS : [choice]
  return new Set(types.flatMap((t) => heroOptions(t)))
}

export function DrillSetup({ settings, onChange, onStart }: Props) {
  const usable = usableSeats(settings.spot)
  const canStart = availableSpots(settings.spot, settings.positions).length > 0
  const toggle = (p: Position) => {
    const has = settings.positions.includes(p)
    const next = has ? settings.positions.filter((x) => x !== p) : [...settings.positions, p]
    onChange({ ...settings, positions: POSITIONS.filter((x) => next.includes(x)) })
  }
  const samePositions = (ps: readonly Position[]) =>
    ps.length === settings.positions.length && ps.every((p) => settings.positions.includes(p))

  return (
    <>
      <header className="header">
        <h1>Drill</h1>
      </header>

      <div className="setup">
        <fieldset className="field">
          <legend>Spot</legend>
          <div className="options">
            {CHOICES.map((c) => (
              <label key={c} className={`option${c === 'mixed' ? ' wide' : ''}`}>
                <input
                  type="radio"
                  id={`spot-${c}`}
                  name="spot"
                  checked={settings.spot === c}
                  onChange={() => onChange({ ...settings, spot: c })}
                />
                <span>
                  <strong>{DRILL_SPOT_TITLES[c]}</strong>
                  <small>{DRILL_SPOT_NOTES[c]}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Your position</legend>
          <div className="chips" role="group" aria-label="Positions">
            {POSITIONS.map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={settings.positions.includes(p)}
                disabled={!usable.has(p)}
                title={usable.has(p) ? undefined : `${p} can't be drilled in this spot`}
                onClick={() => toggle(p)}
              >
                {p}
              </button>
            ))}
          </div>
          <div className="presets">
            {PRESETS.map((pr) => (
              <button
                key={pr.label}
                type="button"
                className="link-button"
                aria-pressed={samePositions(pr.positions)}
                onClick={() => onChange({ ...settings, positions: [...pr.positions] })}
              >
                {pr.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Length</legend>
          <div className="segmented">
            <button type="button" aria-pressed={settings.session === 'session'} onClick={() => onChange({ ...settings, session: 'session' })}>
              {SESSION_LENGTH} hands
            </button>
            <button type="button" aria-pressed={settings.session === 'endless'} onClick={() => onChange({ ...settings, session: 'endless' })}>
              Endless
            </button>
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Dealing</legend>
          <div className="segmented">
            <button type="button" aria-pressed={settings.dealing === 'smart'} onClick={() => onChange({ ...settings, dealing: 'smart' })}>
              Smart
            </button>
            <button type="button" aria-pressed={settings.dealing === 'realistic'} onClick={() => onChange({ ...settings, dealing: 'realistic' })}>
              Realistic
            </button>
          </div>
          <p className="hint">
            {settings.dealing === 'smart'
              ? 'More borderline hands, where decisions are hard and you learn the most.'
              : 'Real card frequencies: most hands are easy folds, like at a real table.'}
          </p>
        </fieldset>

        <button type="button" className="primary" disabled={!canStart} onClick={onStart}>
          {canStart ? 'Start drill' : 'Pick a position that fits this spot'}
        </button>
      </div>
    </>
  )
}

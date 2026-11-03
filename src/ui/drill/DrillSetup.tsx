import { type Position, OPENERS, POSITION_GROUPS } from '../../core/positions'
import { type DrillSettings, SESSION_LENGTH } from './settings'

interface Props {
  settings: DrillSettings
  onChange: (s: DrillSettings) => void
  onStart: () => void
}

const SPOT_TYPES = [
  { id: 'rfi', label: 'Open or fold', note: 'Folded to you: raise or fold', ready: true },
  { id: 'facing-open', label: 'Facing a raise', note: 'Coming in M3', ready: false },
  { id: 'blinds', label: 'Blinds defense', note: 'Coming in M3', ready: false },
  { id: 'facing-3bet', label: 'Facing a 3-bet', note: 'Coming in M3', ready: false },
]

const PRESETS: { label: string; positions: readonly Position[] }[] = [
  { label: 'All', positions: OPENERS },
  { label: 'Early', positions: POSITION_GROUPS.early },
  { label: 'Middle', positions: POSITION_GROUPS.middle },
  { label: 'Late + SB', positions: [...POSITION_GROUPS.late, 'SB'] },
]

export function DrillSetup({ settings, onChange, onStart }: Props) {
  const toggle = (p: Position) => {
    const has = settings.positions.includes(p)
    const next = has ? settings.positions.filter((x) => x !== p) : [...settings.positions, p]
    onChange({ ...settings, positions: OPENERS.filter((x) => next.includes(x)) })
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
            {SPOT_TYPES.map((t) => (
              <label key={t.id} className={`option${t.ready ? '' : ' disabled'}`}>
                <input type="radio" id={`spot-${t.id}`} name="spot" checked={t.id === 'rfi'} disabled={!t.ready} readOnly />
                <span>
                  <strong>{t.label}</strong>
                  <small>{t.note}</small>
                </span>
              </label>
            ))}
          </div>
        </fieldset>

        <fieldset className="field">
          <legend>Your position</legend>
          <div className="chips" role="group" aria-label="Positions">
            {OPENERS.map((p) => (
              <button
                key={p}
                type="button"
                className="chip"
                aria-pressed={settings.positions.includes(p)}
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

        <button type="button" className="primary" disabled={settings.positions.length === 0} onClick={onStart}>
          {settings.positions.length ? 'Start drill' : 'Pick at least one position'}
        </button>
      </div>
    </>
  )
}

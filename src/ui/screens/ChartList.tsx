import { type Chart, type ChartSpot, actionShares } from '../../core/charts'
import { Matchup } from '../components/Positions'
import { SPOT_DESCRIPTIONS, SPOT_TITLES, percent } from '../labels'

const SPOTS: ChartSpot[] = ['rfi', 'facing-open', 'facing-3bet']

export function ChartList({ charts, onOpen }: { charts: readonly Chart[]; onOpen: (id: string) => void }) {
  return (
    <>
      <header className="header">
        <h1>Range charts</h1>
      </header>
      <p className="muted" style={{ margin: 0, maxWidth: '60ch' }}>
        9-max, 100bb cash. Opens are 2.5bb. Tap a chart to see every hand.
      </p>
      {SPOTS.map((spot) => (
        <section key={spot} className="section" aria-labelledby={`spot-${spot}`}>
          <h2 id={`spot-${spot}`}>{SPOT_TITLES[spot]}</h2>
          <p className="muted" style={{ margin: 0, fontSize: 'var(--step--1)' }}>
            {SPOT_DESCRIPTIONS[spot]}
          </p>
          <ul className="chart-list">
            {charts
              .filter((c) => c.spot === spot)
              .map((c) => {
                const s = actionShares(c)
                return (
                  <li key={c.id}>
                    <button type="button" className="chart-row" onClick={() => onOpen(c.id)}>
                      <span className="title">
                        {c.title}
                        {c.edited && <span className="severity clear edited-tag">Edited</span>}
                      </span>
                      <span className="share" title="Share of hands played">
                        {percent(s.raise + s.call)}
                      </span>
                      <span className="matchup">
                        <Matchup chart={c} />
                      </span>
                    </button>
                  </li>
                )
              })}
          </ul>
        </section>
      ))}
    </>
  )
}

import type { Chart } from '../../core/charts'

/** "CO BTN vs UTG UTG+1 MP" with the hero seats highlighted. */
export function Matchup({ chart }: { chart: Chart }) {
  const villainWord = chart.spot === 'facing-3bet' ? '3-bet by' : 'vs'
  return (
    <>
      {chart.hero.map((p) => (
        <span key={p} className="pos hero">
          {p}
        </span>
      ))}
      {chart.villain.length > 0 && <span className="muted">{chart.spot === 'facing-open' ? 'vs raise from' : villainWord}</span>}
      {chart.villain.map((p) => (
        <span key={p} className="pos">
          {p}
        </span>
      ))}
    </>
  )
}

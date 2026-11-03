import { STYLES } from '../../core/bots/personality'
import { actionLabel } from '../../core/charts'
import { STREETS } from '../../core/engine/game'
import { type HandRecord, describeAction } from '../../core/handRecord'
import { MiniCard } from './MiniCard'
import { bb } from './sizes'

const SEVERITY_LABELS = { none: 'Correct', close: 'Close spot', clear: 'Clear mistake', blunder: 'Blunder' } as const

/** After-hand review (design §9.6): result, showdown, your graded decisions, full history. */
export function HandReview({ record, onNext, nextLabel = 'Next hand' }: { record: HandRecord; onNext: () => void; nextLabel?: string }) {
  const hero = record.players[record.heroSeat]
  const name = (seat: number) => (seat === record.heroSeat ? 'You' : record.players[seat].name)
  const net = record.heroNet
  const folded = record.actions.some((a) => a.seat === record.heroSeat && a.type === 'fold')

  return (
    <div className="review">
      <div className="review-head">
        <p className="eyebrow">
          {hero.position} · <MiniCard card={hero.hole[0]} /> <MiniCard card={hero.hole[1]} />
        </p>
        <h2 className={net > 0 ? 'won' : net < 0 ? 'lost' : ''}>
          {net > 0 ? `You won ${bb(net)}` : net < 0 ? `You lost ${bb(-net)}` : folded ? 'You folded' : 'Even'}
        </h2>
        {record.board.length > 0 && (
          <p className="review-board">
            {record.board.map((c) => (
              <MiniCard key={c} card={c} />
            ))}
          </p>
        )}
        <ul className="pots">
          {record.result.pots.map((p, i) => (
            <li key={i}>
              {p.winners.map(name).join(' and ')} {p.winners.length > 1 ? 'split' : p.winners[0] === record.heroSeat ? 'win' : 'wins'}{' '}
              {bb(p.amount)}
              {record.result.pots.length > 1 ? (i === 0 ? ' (main pot)' : ' (side pot)') : ''}
              {p.hand ? ` with ${p.hand.toLowerCase()}` : ''}
            </li>
          ))}
        </ul>
        {Object.keys(record.result.shown).length > 0 && (
          <ul className="shown">
            {Object.entries(record.result.shown).map(([seat, desc]) => {
              const p = record.players[Number(seat)]
              return (
                <li key={seat}>
                  <span>
                    {p.personality && <span aria-hidden="true">{STYLES[p.personality].icon} </span>}
                    {name(Number(seat))}
                  </span>
                  <span>
                    <MiniCard card={p.hole[0]} /> <MiniCard card={p.hole[1]} />
                  </span>
                  <span className="muted">{desc}</span>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <section>
        <h3>Your decisions</h3>
        {record.decisions.some((d) => d.postflop) && (
          <p className="muted small">After the flop, grades follow simple guidelines (equity, pot odds, board texture), not solver answers.</p>
        )}
        {record.decisions.length === 0 ? (
          <p className="muted">You didn't act this hand.</p>
        ) : (
          <ol className="decisions">
            {record.decisions.map((d, i) => (
              <li key={i}>
                <span className="street-tag">{d.street}</span>
                <div>
                  <p className="muted">{d.situation}</p>
                  <p>
                    <strong>{d.label}</strong>
                  </p>
                  {d.equity && <EquityLine eq={d.equity} />}
                  {d.graded ? (
                    <p>
                      <span className={`severity ${d.graded.severity}`}>{SEVERITY_LABELS[d.graded.severity]}</span>{' '}
                      {!d.graded.correct && (
                        <span>
                          Chart: {d.graded.correctActions.map((a) => actionLabel(d.graded!.chartSpot, a).toLowerCase()).join(' or ')}.
                        </span>
                      )}{' '}
                      <span className="muted">{d.graded.chartTitle}</span>
                    </p>
                  ) : d.postflop ? (
                    <>
                      <p>
                        <span className={`severity ${d.postflop.severity}`}>{SEVERITY_LABELS[d.postflop.severity]}</span>{' '}
                        {!d.postflop.correct && <span>Guideline: {d.postflop.acceptable.join(' or ')}.</span>}
                      </p>
                      <p className="small">{d.postflop.reason}</p>
                    </>
                  ) : (
                    <p className="muted small">
                      {d.street === 'preflop'
                        ? 'Not graded: the charts assume no limpers or callers before you.'
                        : 'Not graded.'}
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      <details className="history">
        <summary>Full hand history</summary>
        {STREETS.map((street) => {
          const acts = record.actions.filter((a) => a.street === street)
          if (!acts.length) return null
          const cards = street === 'flop' ? record.board.slice(0, 3) : street === 'turn' ? record.board.slice(3, 4) : street === 'river' ? record.board.slice(4, 5) : []
          return (
            <div key={street} className="history-street">
              <p className="eyebrow">
                {street} {cards.map((c) => <MiniCard key={c} card={c} />)}
              </p>
              <ul>
                {acts.map((a, i) => (
                  <li key={i}>{describeAction(a, name(a.seat))}</li>
                ))}
              </ul>
            </div>
          )
        })}
      </details>

      <button type="button" className="primary" onClick={onNext} autoFocus>
        {nextLabel}
      </button>
    </div>
  )
}


/** "Equity ≈ 34% vs 1 player · a call needed 25%", colored by whether it was enough. */
export function EquityLine({ eq, live = false }: { eq: { value: number; needed: number | null; opponents: number }; live?: boolean }) {
  const pct = (x: number) => `${Math.round(x * 100)}%`
  const enough = eq.needed === null ? null : eq.value >= eq.needed
  return (
    <p className={`equity-line small ${enough === null ? '' : enough ? 'up' : 'down'}`}>
      Equity ≈ {pct(eq.value)} vs {eq.opponents === 1 ? 'their' : `${eq.opponents} players'`} likely hands
      {eq.needed !== null && <> · {live ? 'a call needs' : 'a call needed'} {pct(eq.needed)}</>}
    </p>
  )
}

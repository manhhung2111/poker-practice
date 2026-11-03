import type { CSSProperties } from 'react'
import { STYLES } from '../../core/bots/personality'
import { type HandState, potSize } from '../../core/engine/game'
import { describeAction } from '../../core/handRecord'
import type { TableSession } from '../../core/table'
import { CardBack, MiniCard } from './MiniCard'
import { bb } from './sizes'

interface Props {
  hand: HandState
  session: TableSession
  onSeatInfo: (seat: number) => void
}

/** Point on the table oval for a seat, rotated so you sit at the bottom. Returns percentages. */
function place(seat: number, hero: number, n: number, scale = 1) {
  const offset = (seat - hero + n) % n
  const angle = Math.PI / 2 + (offset * 2 * Math.PI) / n
  return { left: 50 + 44 * scale * Math.cos(angle), top: 50 + 42 * scale * Math.sin(angle) }
}

const pct = (p: { left: number; top: number }): CSSProperties => ({ left: `${p.left}%`, top: `${p.top}%` })

export function TableView({ hand, session, onSeatInfo }: Props) {
  const n = hand.players.length
  const hero = session.heroSeat
  const over = hand.result !== null
  const winners = new Set(hand.result?.pots.flatMap((p) => p.winners) ?? [])
  // Pot shown in the middle = chips from finished streets (current bets sit in front of players).
  const middle = potSize(hand) - hand.players.reduce((s, p) => s + p.bet, 0)
  const lastAction = (seat: number) => {
    const mine = hand.actions.filter((a) => a.seat === seat && a.street === hand.street && a.type !== 'post')
    return mine[mine.length - 1]
  }

  return (
    <div className="poker-table" role="group" aria-label="Poker table">
      <div className="felt-oval" />

      <div className="table-center">
        <div className="board" aria-label="Board">
          {Array.from({ length: 5 }, (_, i) => (hand.board[i] ? <MiniCard key={i} card={hand.board[i]} /> : <span key={i} className="mini-card slot" />))}
        </div>
        <div className="pot">Pot {bb(over ? potSize(hand) : middle)}</div>
      </div>

      {hand.players.map((p) => {
        const isHero = p.seat === hero
        const info = session.seats[p.seat]
        const style = info.personality ? STYLES[info.personality] : null
        const last = lastAction(p.seat)
        const showCards = !isHero && !p.folded && (over ? hand.result!.shown[p.seat] !== undefined : false)
        const cls = [
          'seat',
          isHero ? 'me' : '',
          p.folded ? 'folded' : '',
          hand.toAct === p.seat ? 'acting' : '',
          over && winners.has(p.seat) ? 'winner' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <div key={p.seat}>
            <button
              type="button"
              className={cls}
              style={pct(place(p.seat, hero, n))}
              onClick={() => !isHero && onSeatInfo(p.seat)}
              aria-label={`${p.name}${style ? `, ${style.label}` : ''}, ${p.position}, ${bb(p.stack)}${p.folded ? ', folded' : ''}`}
            >
              <span className="seat-name">
                {style && <span aria-hidden="true">{style.icon} </span>}
                {isHero ? 'You' : p.name}
              </span>
              <span className="seat-stack">
                {p.allIn && !over ? 'ALL-IN' : bb(p.stack)} · {p.position}
              </span>
              {!isHero && !p.folded && (
                <span className="seat-cards">
                  {showCards ? (
                    <>
                      <MiniCard card={p.hole[0]} />
                      <MiniCard card={p.hole[1]} />
                    </>
                  ) : (
                    <>
                      <CardBack />
                      <CardBack />
                    </>
                  )}
                </span>
              )}
              {last && !over && <span className={`seat-action ${last.type}`}>{describeAction(last).replace(`${p.position} `, '')}</span>}
            </button>
            {p.bet > 0 && !over && (
              <span className="bet-chip" style={pct(place(p.seat, hero, n, 0.6))}>
                {bb(p.bet)}
              </span>
            )}
          </div>
        )
      })}

      <span className="dealer-button" style={pct(place(hand.button, hero, n, 0.74))} aria-label="Dealer button">
        D
      </span>
    </div>
  )
}

import { type Card, SUIT_SYMBOLS, cardRank, cardSuit } from '../../core/cards'

/** A small face-up card for the board, showdowns and history. */
export function MiniCard({ card }: { card: Card }) {
  const suit = cardSuit(card)
  const rank = cardRank(card)
  const red = suit === 'h' || suit === 'd'
  return (
    <span className={`mini-card${red ? ' red' : ''}`} aria-label={`${rank === 'T' ? '10' : rank} of ${suit}`}>
      {rank === 'T' ? '10' : rank}
      <span>{SUIT_SYMBOLS[suit]}</span>
    </span>
  )
}

export function CardBack() {
  return <span className="mini-card back" aria-hidden="true" />
}

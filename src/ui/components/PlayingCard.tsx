import { type Card, SUIT_SYMBOLS, cardRank, cardSuit } from '../../core/cards'

/** A large, readable card face. Hearts/diamonds red, spades/clubs black. */
export function PlayingCard({ card }: { card: Card }) {
  const suit = cardSuit(card)
  const rank = cardRank(card)
  const red = suit === 'h' || suit === 'd'
  const label = rank === 'T' ? '10' : rank
  return (
    <div className={`playing-card${red ? ' red' : ''}`} role="img" aria-label={`${label} of ${SUIT_NAMES[suit]}`}>
      <span className="rank">{label}</span>
      <span className="suit">{SUIT_SYMBOLS[suit]}</span>
    </div>
  )
}

const SUIT_NAMES = { s: 'spades', h: 'hearts', d: 'diamonds', c: 'clubs' } as const

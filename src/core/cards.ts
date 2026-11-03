import { type Rng, defaultRng, randomInt } from './random'

/** Ranks from highest to lowest. */
export const RANKS = ['A', 'K', 'Q', 'J', 'T', '9', '8', '7', '6', '5', '4', '3', '2'] as const
export type Rank = (typeof RANKS)[number]

export const SUITS = ['s', 'h', 'd', 'c'] as const
export type Suit = (typeof SUITS)[number]

/** A card as a 2-char string, e.g. "As" (ace of spades), "Td" (ten of diamonds). */
export type Card = `${Rank}${Suit}`

export const SUIT_SYMBOLS: Record<Suit, string> = { s: '♠', h: '♥', d: '♦', c: '♣' }

/** Numeric value of a rank: 2 → 2 … A → 14. */
export function rankValue(rank: Rank): number {
  return 14 - RANKS.indexOf(rank)
}

export function isRank(x: string): x is Rank {
  return (RANKS as readonly string[]).includes(x)
}

export function isSuit(x: string): x is Suit {
  return (SUITS as readonly string[]).includes(x)
}

export function parseCard(s: string): Card {
  if (s.length !== 2 || !isRank(s[0]) || !isSuit(s[1])) {
    throw new Error(`Invalid card: "${s}"`)
  }
  return s as Card
}

export function cardRank(card: Card): Rank {
  return card[0] as Rank
}

export function cardSuit(card: Card): Suit {
  return card[1] as Suit
}

/** Human-friendly label, e.g. "A♠". */
export function cardLabel(card: Card): string {
  return `${card[0] === 'T' ? '10' : card[0]}${SUIT_SYMBOLS[cardSuit(card)]}`
}

/** Fresh ordered 52-card deck. */
export function makeDeck(): Card[] {
  const deck: Card[] = []
  for (const r of RANKS) for (const s of SUITS) deck.push(`${r}${s}`)
  return deck
}

/** Fisher–Yates shuffle; returns a new array. */
export function shuffle<T>(items: readonly T[], rng: Rng = defaultRng): T[] {
  const a = items.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = randomInt(i + 1, rng)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

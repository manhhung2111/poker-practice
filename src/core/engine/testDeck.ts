import { type Card, makeDeck } from '../cards'

/**
 * Test helper: a deck that deals the given hole cards and board.
 * Deal order: one card each starting left of the button, twice; then burn+flop, burn+turn, burn+river.
 */
export function stackDeck(n: number, button: number, holes: Record<number, [Card, Card]>, board: Card[] = []): Card[] {
  const used = new Set<Card>([...Object.values(holes).flat(), ...board])
  const rest = makeDeck().filter((c) => !used.has(c))
  const take = () => rest.shift()!
  const deck: Card[] = []
  for (let round = 0; round < 2; round++)
    for (let i = 1; i <= n; i++) {
      const seat = (button + i) % n
      deck.push(holes[seat]?.[round] ?? take())
    }
  const b = [...board]
  const next = () => b.shift() ?? take()
  deck.push(take(), next(), next(), next(), take(), next(), take(), next())
  return [...deck, ...rest]
}

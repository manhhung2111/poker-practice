import { type Chart, actionShares, mainAction } from './charts'
import { type HandCategory, type HandClass, handCategory } from './hands'

/** Generic notes per hand type: one for when the hand is played, one for when it's folded. */
const CATEGORY_NOTES: Record<HandCategory, { play: string; fold: string }> = {
  'premium-pair': {
    play: 'A premium pair is ahead of almost every range. Build the pot.',
    fold: 'Premium pairs are almost never folded preflop.',
  },
  'high-pair': {
    play: 'A high pair is a strong favorite against most ranges.',
    fold: 'Even a high pair can be too weak against a very strong range.',
  },
  'mid-pair': {
    play: 'Middle pairs win unimproved sometimes and hit sets about 12% of the time.',
    fold: 'Middle pairs are hard to play against strong ranges: you often face overcards on the flop.',
  },
  'low-pair': {
    play: 'Small pairs play for set value: you hit a set about 1 time in 8, and deep stacks pay you off.',
    fold: 'Small pairs rarely win without a set; from here they are not worth playing.',
  },
  'suited-ace': {
    play: 'Suited aces make the nut flush and block strong aces in other ranges.',
    fold: 'A weak suited ace still has a weak kicker: from here it is not strong enough.',
  },
  'offsuit-ace': {
    play: 'A strong offsuit ace usually dominates weaker aces and kings.',
    fold: 'Offsuit aces with weak kickers are often dominated: when you hit the ace, a better ace beats you.',
  },
  'suited-broadway': {
    play: 'Two suited high cards make strong pairs, straights and flushes.',
    fold: 'Even suited high cards get dominated by stronger ranges.',
  },
  'offsuit-broadway': {
    play: 'Two high cards make strong top pairs.',
    fold: 'Offsuit high cards are often dominated (KJo vs AK, AJ, KQ) and have no flush potential.',
  },
  'suited-connector': {
    play: 'Suited connectors make straights and flushes and are easy to play after the flop.',
    fold: 'Suited connectors need position and multiway pots; from here they lose too often.',
  },
  'suited-gapper': {
    play: 'Suited gappers can still make straights and flushes.',
    fold: 'Suited gappers make fewer straights than connectors and are too weak from here.',
  },
  'suited-other': {
    play: 'Being suited adds flush potential to an otherwise weak hand.',
    fold: 'Being suited is not enough: the cards are too far apart and the kicker is weak.',
  },
  'offsuit-connector': {
    play: 'Offsuit connectors can make straights, but they are weak without a flush draw.',
    fold: 'Offsuit connectors rarely make strong hands. Fold.',
  },
  'offsuit-other': {
    play: 'Weak, but the situation makes it worth playing.',
    fold: 'Unconnected, offsuit and low: one of the weakest kinds of hand. Fold.',
  },
}

export interface Explanation {
  /** Most specific sentence: hand note from the chart, else the hand-type note. */
  hand: string
  /** One line of context about the spot, e.g. "From CO you open about 28% of hands." */
  spot: string
  /** The chart's key idea. */
  keyIdea: string
}

export function explain(chart: Chart, hand: HandClass): Explanation {
  const played = mainAction(chart, hand) !== 'fold'
  const generic = CATEGORY_NOTES[handCategory(hand)][played ? 'play' : 'fold']
  const s = actionShares(chart)
  const pct = Math.round((s.raise + s.call) * 100)
  const spot =
    chart.spot === 'rfi'
      ? `From ${chart.hero.join('/')} you open about ${pct}% of hands.`
      : chart.spot === 'facing-open'
        ? `In this spot you continue with about ${pct}% of hands.`
        : `Against this 3-bet you continue with about ${pct}% of all hands.`
  return { hand: chart.notes[hand] ?? generic, spot, keyIdea: chart.keyIdea }
}

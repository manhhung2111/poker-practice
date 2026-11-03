/** Bot styles (design §9.3). Icons and names are shown at the table so you can adjust to them. */
export type Personality = 'nit' | 'regular' | 'fish' | 'maniac'
export const PERSONALITIES: readonly Personality[] = ['nit', 'regular', 'fish', 'maniac']

export interface Style {
  label: string
  icon: string
  blurb: string
  // ---- preflop ----
  /** Keep only this fraction of the chart's playing range (strongest part). 1 = whole chart. */
  rangeKeep: number
  /** Also call a single raise with any hand in the top X of all hands (fish). 0 = off. */
  looseCall: number
  /** Chance to raise instead of call when the chart calls (maniac). */
  callToRaise: number
  /** Chance to open/3-bet a hand in the top X that the chart folds (maniac). */
  extraRaiseTop: number
  extraRaiseChance: number
  /** Chance to limp a hand the chart folds when nobody raised, if it's in the top 40% (fish). */
  limpChance: number
  /** 3-bet only hands in the top X when facing an open (else call instead). 1 = follow chart. */
  threeBetTop: number
  // ---- postflop ----
  /** Chance to bet a value hand when checked to. */
  valueBet: number
  /** Chance to c-bet as the preflop raiser without a value hand (heads-up; less multiway). */
  cbet: number
  /** Chance to semi-bluff a draw. */
  semiBluff: number
  /** Chance to raise a bet with a monster / strong hand. */
  raiseMonster: number
  raiseStrong: number
  /** Added to the equity needed to call (positive = folds more). */
  callMargin: number
  /** Postflop decisions use real equity vs estimated ranges (regulars). */
  thinksInEquity: boolean
}

export const STYLES: Record<Personality, Style> = {
  nit: {
    label: 'Nit',
    icon: '🧊',
    blurb: 'Plays few hands and folds a lot. When a nit bets big, believe it.',
    rangeKeep: 0.6,
    looseCall: 0,
    callToRaise: 0,
    extraRaiseTop: 0,
    extraRaiseChance: 0,
    limpChance: 0,
    threeBetTop: 0.03,
    valueBet: 0.6,
    cbet: 0.3,
    semiBluff: 0.15,
    raiseMonster: 0.5,
    raiseStrong: 0.05,
    callMargin: 0.08,
    thinksInEquity: false,
  },
  regular: {
    label: 'Regular',
    icon: '🎯',
    blurb: 'Follows the charts and plays solid. The standard to learn from.',
    rangeKeep: 1,
    looseCall: 0,
    callToRaise: 0,
    extraRaiseTop: 0,
    extraRaiseChance: 0,
    limpChance: 0,
    threeBetTop: 1,
    valueBet: 0.8,
    cbet: 0.55,
    semiBluff: 0.4,
    raiseMonster: 0.55,
    raiseStrong: 0.15,
    callMargin: 0,
    thinksInEquity: true,
  },
  fish: {
    label: 'Fish',
    icon: '🐟',
    blurb: 'Plays too many hands and calls too much. Value bet them; don\'t bluff them.',
    rangeKeep: 1,
    looseCall: 0.45,
    callToRaise: 0,
    extraRaiseTop: 0,
    extraRaiseChance: 0,
    limpChance: 0.5,
    threeBetTop: 0.02,
    valueBet: 0.5,
    cbet: 0.2,
    semiBluff: 0.1,
    raiseMonster: 0.25,
    raiseStrong: 0.05,
    callMargin: -0.15,
    thinksInEquity: false,
  },
  maniac: {
    label: 'Maniac',
    icon: '🔥',
    blurb: 'Raises and bluffs all the time. Call down lighter and let them bluff.',
    rangeKeep: 1,
    looseCall: 0,
    callToRaise: 0.6,
    extraRaiseTop: 0.5,
    extraRaiseChance: 0.6,
    limpChance: 0,
    threeBetTop: 1,
    valueBet: 0.95,
    cbet: 0.85,
    semiBluff: 0.75,
    raiseMonster: 0.8,
    raiseStrong: 0.4,
    callMargin: -0.05,
    thinksInEquity: false,
  },
}

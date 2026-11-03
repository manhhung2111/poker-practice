import { type Rank, RANKS, isRank } from './cards'
import { type HandClass, ALL_HANDS, parseHandClass } from './hands'

/**
 * Parses standard range notation into a set of hand classes.
 *
 * Supported forms (comma or whitespace separated):
 *   AA, AKs, AKo     single hand class
 *   AK               both AKs and AKo
 *   77+              pairs 77 and higher (77…AA)
 *   ATs+, ATo+, AT+  same high card, kicker T up to just below the high card (AT…AK)
 *   99-66            pairs from 99 down to 66 (either order)
 *   KTo-K8o, KT-K8   same high card, kickers from T down to 8 (either order)
 */
export class RangeParseError extends Error {
  constructor(public token: string, reason: string) {
    super(`Invalid range token "${token}": ${reason}`)
  }
}

type Suffix = 's' | 'o' | ''

interface Parsed {
  high: Rank
  low: Rank
  suffix: Suffix
}

const idx = (r: Rank) => RANKS.indexOf(r) // 0 = A … 12 = 2

function parseBase(token: string, s: string): Parsed {
  const m = /^([AKQJT2-9])([AKQJT2-9])([so]?)$/.exec(s)
  if (!m || !isRank(m[1]) || !isRank(m[2])) throw new RangeParseError(token, `can't read "${s}"`)
  let high: Rank = m[1]
  let low: Rank = m[2]
  const suffix = m[3] as Suffix
  if (idx(high) > idx(low)) [high, low] = [low, high] // allow "KA" → "AK"
  if (high === low && suffix) throw new RangeParseError(token, 'pairs cannot be suited or offsuit')
  return { high, low, suffix }
}

/** Expand one (high, kicker, suffix) to hand classes. */
function expand(high: Rank, low: Rank, suffix: Suffix): HandClass[] {
  if (high === low) return [high + low]
  if (suffix) return [high + low + suffix]
  return [high + low + 's', high + low + 'o']
}

function parseToken(token: string): HandClass[] {
  const out: HandClass[] = []

  if (token.endsWith('+')) {
    const { high, low, suffix } = parseBase(token, token.slice(0, -1))
    if (high === low) {
      for (let i = idx(high); i >= 0; i--) out.push(...expand(RANKS[i], RANKS[i], ''))
    } else {
      // kicker from `low` up to one below `high`
      for (let i = idx(low); i > idx(high); i--) out.push(...expand(high, RANKS[i], suffix))
    }
    return out
  }

  if (token.includes('-')) {
    const parts = token.split('-')
    if (parts.length !== 2) throw new RangeParseError(token, 'too many dashes')
    const a = parseBase(token, parts[0])
    const b = parseBase(token, parts[1])
    const aPair = a.high === a.low
    const bPair = b.high === b.low
    if (aPair && bPair) {
      const [from, to] = [idx(a.high), idx(b.high)].sort((x, y) => x - y)
      for (let i = from; i <= to; i++) out.push(...expand(RANKS[i], RANKS[i], ''))
      return out
    }
    if (aPair || bPair) throw new RangeParseError(token, 'cannot mix pairs and non-pairs')
    if (a.high !== b.high) throw new RangeParseError(token, 'both ends must have the same high card')
    if (a.suffix !== b.suffix) throw new RangeParseError(token, 'both ends must have the same suffix')
    const [from, to] = [idx(a.low), idx(b.low)].sort((x, y) => x - y)
    for (let i = from; i <= to; i++) out.push(...expand(a.high, RANKS[i], a.suffix))
    return out
  }

  const { high, low, suffix } = parseBase(token, token)
  return expand(high, low, suffix)
}

export function parseRange(text: string): Set<HandClass> {
  const result = new Set<HandClass>()
  const tokens = text
    .split(/[\s,]+/)
    .map((t) => t.trim())
    .filter(Boolean)
  for (const token of tokens) for (const h of parseToken(token)) result.add(h)
  return result
}

/**
 * Formats a set of hand classes as compact range notation — the inverse of parseRange.
 * Output order: pairs, then suited hands, then offsuit hands, each from highest card down.
 */
export function formatRange(hands: Iterable<HandClass>): string {
  const set = new Set(hands)
  for (const h of set) parseHandClass(h) // validate
  const parts: string[] = []

  // Pairs
  const pairRuns = runs(RANKS.map((r) => set.has(r + r)))
  for (const [start, end] of pairRuns) {
    const top = RANKS[start] + RANKS[start]
    const bottom = RANKS[end] + RANKS[end]
    if (start === end) parts.push(top)
    else if (start === 0) parts.push(bottom + '+')
    else parts.push(`${top}-${bottom}`)
  }

  // Non-pairs, suited then offsuit
  for (const suffix of ['s', 'o'] as const) {
    for (let h = 0; h < 12; h++) {
      const high = RANKS[h]
      // kickers from just below high (index h+1) down to 2 (index 12)
      const kickers = RANKS.slice(h + 1)
      const present = kickers.map((k) => set.has(high + k + suffix))
      for (const [start, end] of runs(present)) {
        const top = high + kickers[start] + suffix
        const bottom = high + kickers[end] + suffix
        if (start === end) parts.push(top)
        else if (start === 0) parts.push(bottom + '+')
        else parts.push(`${top}-${bottom}`)
      }
    }
  }
  return parts.join(', ')
}

/** Contiguous runs of `true` as [startIndex, endIndex] pairs. */
function runs(flags: boolean[]): [number, number][] {
  const out: [number, number][] = []
  let start = -1
  flags.forEach((f, i) => {
    if (f && start < 0) start = i
    if (!f && start >= 0) {
      out.push([start, i - 1])
      start = -1
    }
  })
  if (start >= 0) out.push([start, flags.length - 1])
  return out
}

/** Hands in grid order — handy for stable display and tests. */
export function sortHands(hands: Iterable<HandClass>): HandClass[] {
  const set = new Set(hands)
  return ALL_HANDS.filter((h) => set.has(h))
}

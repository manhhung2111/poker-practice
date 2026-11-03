import type { Mix } from '../core/charts'

/** Background for a grid cell: one solid color, or left-to-right stripes for mixed strategies. */
export function mixBackground(mix: Mix): string {
  const parts = (
    [
      ['var(--raise)', mix.raise ?? 0],
      ['var(--call)', mix.call ?? 0],
      ['var(--fold)', mix.fold ?? 0],
    ] as [string, number][]
  ).filter(([, f]) => f > 0)
  if (parts.length === 1) return parts[0][0]
  let at = 0
  const stops = parts.flatMap(([color, f]) => {
    const from = at * 100
    at += f
    return [`${color} ${from}%`, `${color} ${at * 100}%`]
  })
  return `linear-gradient(to right, ${stops.join(', ')})`
}

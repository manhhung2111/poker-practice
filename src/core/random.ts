/** A random number generator returning floats in [0, 1). */
export type Rng = () => number

/** Small, fast seeded RNG (mulberry32). Same seed → same sequence; used in tests. */
export function seededRng(seed: number): Rng {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const defaultRng: Rng = Math.random

/** Random integer in [0, n). */
export function randomInt(n: number, rng: Rng = defaultRng): number {
  return Math.floor(rng() * n)
}

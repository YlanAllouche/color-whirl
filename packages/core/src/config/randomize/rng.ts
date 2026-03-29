import { clamp } from './utils.js';

/** Generate a random value using a weighted normal distribution. */
export type RNG = () => number;

export function createRng(seed: number): RNG {
  // mulberry32
  let t = (seed >>> 0) || 1;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sample a triangular distribution over [min, max] with a peak at `mode`.
 * This is a simple "biased random" sampler where `mode` acts as the normal value.
 */
export function randomTriangular(rng: RNG, min: number, mode: number, max: number): number {
  const a = Number(min);
  const b = Number(max);
  const c = clamp(Number(mode), Math.min(a, b), Math.max(a, b));

  if (!Number.isFinite(a) || !Number.isFinite(b) || !Number.isFinite(c) || a === b) return a;
  const lo = Math.min(a, b);
  const hi = Math.max(a, b);
  const m = clamp(c, lo, hi);
  const u = clamp(rng(), 0, 1);
  const fc = (m - lo) / (hi - lo);
  if (u < fc) {
    return lo + Math.sqrt(u * (hi - lo) * (m - lo));
  }
  return hi - Math.sqrt((1 - u) * (hi - lo) * (hi - m));
}

// Back-compat alias (historical name)
export function randomWeighted(rng: RNG, min: number, max: number, normal: number): number {
  return randomTriangular(rng, min, normal, max);
}

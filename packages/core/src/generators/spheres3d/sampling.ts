import type { PaletteAssignMode } from '../../types.js';

export function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

export function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (u <= acc) return i;
  }
  return wNorm.length - 1;
}

export function hash01(seed: number, a: number, b: number): number {
  let x = (Number(seed) >>> 0) ^ (Math.imul(a | 0, 374761393) >>> 0) ^ (Math.imul(b | 0, 668265263) >>> 0);
  x = Math.imul(x ^ (x >>> 13), 1274126177);
  x = (x ^ (x >>> 16)) >>> 0;
  return x / 4294967296;
}

export function pickIndex(mode: PaletteAssignMode, i: number, rng: () => number, w: number[], n: number): number {
  if (mode === 'cycle') return i % n;
  return sampleWeightedIndex01(rng(), w);
}

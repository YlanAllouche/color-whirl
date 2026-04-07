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

export function pickIndex(mode: PaletteAssignMode, i: number, rng: () => number, w: number[], n: number): number {
  if (mode === 'cycle') return i % n;
  return sampleWeightedIndex01(rng(), w);
}

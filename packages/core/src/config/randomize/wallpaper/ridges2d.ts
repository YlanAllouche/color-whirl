import type { WallpaperConfig } from '../../types.js';
import { DEFAULT_RIDGES2D_CONFIG } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createRidges2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, tri, chance, randomWeighted } = context;

  // Keep ridges configs conservative: disable collisions/emission (not used by this generator).
  const levels = Math.max(6, Math.min(28, Math.round(tri(6, DEFAULT_RIDGES2D_CONFIG.ridges.levels, 28))));
  const stepPx = Math.max(3, Math.min(16, Math.round(tri(3, DEFAULT_RIDGES2D_CONFIG.ridges.gridStepPx, 16))));
  const oct = Math.max(1, Math.min(8, Math.round(tri(1, DEFAULT_RIDGES2D_CONFIG.ridges.octaves, 7))));
  const detailFrequency = clamp(randomWeighted(3.5, 12, 7.5), 0.1, 40);
  const detailAmplitude = clamp(randomWeighted(0.02, 0.36, 0.18), 0, 0.7);
  const contrast = clamp(randomWeighted(0.75, 1.55, 1.05), 0.2, 3);
  const bias = clamp(randomWeighted(-0.18, 0.18, 0), -0.5, 0.5);
  const levelJitter = clamp(randomWeighted(0.02, 0.32, 0.1), 0, 0.4);
  const warpDepth = clamp(randomWeighted(0, 0.72, 0.28), 0, 1);

  return {
    ...base,
    type: 'ridges2d',
    emission: { ...(base as any).emission, enabled: false },
    bloom: { ...(base as any).bloom, enabled: false },
    collisions: {
      ...(base as any).collisions,
      mode: 'none',
      carve: { ...(base as any).collisions.carve, marginPx: 0, featherPx: 0 }
    },
    ridges: {
      gridStepPx: stepPx,
      frequency: clamp(tri(0.6, DEFAULT_RIDGES2D_CONFIG.ridges.frequency, 5.5), 0.05, 50),
      detailFrequency,
      detailAmplitude,
      octaves: oct,
      warpAmount: clamp(tri(0.0, DEFAULT_RIDGES2D_CONFIG.ridges.warpAmount, 2.4), 0, 50),
      warpDepth,
      warpFrequency: clamp(tri(0.2, DEFAULT_RIDGES2D_CONFIG.ridges.warpFrequency, 4.0), 0.01, 50),
      contrast,
      bias,
      levels,
      levelJitter,
      lineWidthPx: clamp(tri(0.5, DEFAULT_RIDGES2D_CONFIG.ridges.lineWidthPx, 3.0), 0.1, 50),
      lineOpacity: clamp(tri(0.08, DEFAULT_RIDGES2D_CONFIG.ridges.lineOpacity, 0.95), 0, 1),
      smoothing: clamp(tri(0.0, DEFAULT_RIDGES2D_CONFIG.ridges.smoothing, 0.85), 0, 1),
      fillBands: {
        enabled: chance(0.65),
        opacity: clamp(tri(0.04, DEFAULT_RIDGES2D_CONFIG.ridges.fillBands.opacity, 0.45), 0, 1)
      },
      paletteMode: chance(0.65) ? 'weighted' : 'cycle',
      colorWeights: [0.58, 0.18, 0.12, 0.08, 0.04]
    }
  };
}

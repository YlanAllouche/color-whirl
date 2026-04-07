import type { WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createFlowlines2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, randomWeighted } = context;

  return {
    ...base,
    type: 'flowlines2d',
    emission: { ...base.emission, enabled: false, intensity: 0 },
    bloom: { ...base.bloom, enabled: false },
    collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
    flowlines: {
      seedOffset: Math.round(tri(-50, 0, 50)),
      frequency: clamp(tri(0.4, 2.4, 6.5), 0.05, 50),
      octaves: Math.max(1, Math.min(8, Math.round(tri(1, 3, 7)))),
      warpAmount: clamp(tri(0.0, 0.55, 2.2), 0, 10),
      warpFrequency: clamp(tri(0.2, 1.8, 4.2), 0.01, 50),
      strength: clamp(tri(0.25, 1.0, 2.2), 0, 20),
      epsilonPx: clamp(tri(0.4, 1.0, 2.0), 0.1, 6),
      spawn: rng() < 0.8 ? 'grid' : 'random',
      density: clamp(tri(0.2, 0.9, 1.0), 0, 1),
      spacingPx: clamp(tri(2, 6, 14), 2, 80),
      marginPx: clamp(tri(0, 18, 80), 0, 400),
      stepPx: clamp(tri(0.4, 1.15, 2.8), 0.05, 20),
      maxSteps: Math.max(12, Math.min(1200, Math.round(tri(40, 240, 680)))),
      maxLines: Math.max(0, Math.min(20000, Math.round(randomWeighted(50, 6000, 2600)))),
      minLengthPx: clamp(tri(0, 26, 120), 0, 2000),
      jitter: clamp(tri(0, 1.0, 1.0), 0, 1),
      stroke: {
        widthPx: clamp(tri(0.3, 1.2, 3.6), 0.05, 50),
        opacity: clamp(tri(0.05, 0.22, 0.55), 0, 1),
        taper: clamp(tri(0.0, 0.25, 0.7), 0, 1)
      },
      paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      colorJitter: clamp(tri(0, 0.12, 0.45), 0, 1)
    }
  };
}

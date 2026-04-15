import type { WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createDiamondgrid2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, randomWeighted } = context;

  const tw = Math.round(randomWeighted(40, 260, 120));
  const th = Math.round(clamp(tw * clamp(tri(0.35, 0.5, 0.7), 0.1, 2), 20, 180));
  return {
    ...base,
    type: 'diamondgrid2d',
    emission: { ...base.emission, enabled: false, intensity: 0 },
    bloom: { ...base.bloom, enabled: false },
    collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
    diamondgrid: {
      tileWidthPx: tw,
      tileHeightPx: th,
      marginPx: Math.round(randomWeighted(0, 14, 2)),
      originPx: { x: 0, y: 0 },
      overscanPx: Math.round(randomWeighted(0, 220, 64)),
      fillOpacity: clamp(tri(0.35, 0.96, 1.0), 0, 1),
      stroke: {
        enabled: rng() < 0.3,
        widthPx: Math.round(randomWeighted(1, 10, 2)),
        color: '#0b0b10',
        opacity: clamp(tri(0.15, 0.6, 1.0), 0, 1),
        join: 'round'
      },
      coloring: { paletteMode: rng() < 0.65 ? 'weighted' : 'cycle', colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08] },
      bevel: {
        enabled: rng() < 0.92,
        amount: clamp(tri(0, 0.48, 1.0), 0, 1),
        lightDeg: randomWeighted(0, 360, 315),
        variation: clamp(tri(0, 0.15, 0.6), 0, 1)
      }
    }
  };
}

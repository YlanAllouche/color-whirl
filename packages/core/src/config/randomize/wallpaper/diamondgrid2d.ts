import type { WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createDiamondgrid2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, randomWeighted } = context;

  const facetStyle = rng() < 0.22;

  const tw = facetStyle
    ? Math.round(randomWeighted(18, 96, 42))
    : Math.round(randomWeighted(40, 260, 120));
  const th = Math.round(
    clamp(
      tw * clamp(facetStyle ? tri(0.35, 0.55, 0.85) : tri(0.35, 0.5, 0.7), 0.1, 2),
      12,
      facetStyle ? 120 : 180
    )
  );

  return {
    ...base,
    type: 'diamondgrid2d',
    emission: { ...base.emission, enabled: false, intensity: 0 },
    bloom: { ...base.bloom, enabled: false },
    collisions: { ...base.collisions, mode: 'none', carve: { ...base.collisions.carve, marginPx: 0, featherPx: 0 } },
    diamondgrid: {
      tileWidthPx: tw,
      tileHeightPx: th,
      marginPx: Math.round(facetStyle ? randomWeighted(0, 8, 1) : randomWeighted(0, 14, 2)),
      originPx: { x: 0, y: 0 },
      overscanPx: Math.round(randomWeighted(0, 220, 64)),
      fillOpacity: clamp(facetStyle ? tri(0.82, 0.98, 1.0) : tri(0.35, 0.96, 1.0), 0, 1),
      stroke: {
        enabled: facetStyle ? rng() < 0.66 : rng() < 0.3,
        widthPx: Math.round(facetStyle ? randomWeighted(1, 5, 2) : randomWeighted(1, 10, 2)),
        color: '#0b0b10',
        opacity: clamp(facetStyle ? tri(0.2, 0.62, 0.98) : tri(0.15, 0.6, 1.0), 0, 1),
        join: 'round'
      },
      coloring: {
        paletteMode: facetStyle ? (rng() < 0.84 ? 'weighted' : 'cycle') : rng() < 0.65 ? 'weighted' : 'cycle',
        colorWeights: facetStyle ? [0.62, 0.2, 0.1, 0.06, 0.02] : [0.34, 0.28, 0.18, 0.12, 0.08]
      },
      bevel: {
        enabled: facetStyle ? true : rng() < 0.92,
        amount: clamp(facetStyle ? tri(0.52, 0.84, 1.0) : tri(0, 0.48, 1.0), 0, 1),
        lightDeg: facetStyle ? randomWeighted(250, 350, 315) : randomWeighted(0, 360, 315),
        variation: clamp(facetStyle ? tri(0, 0.05, 0.18) : tri(0, 0.15, 0.6), 0, 1)
      }
    }
  };
}

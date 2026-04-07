import type { WallpaperConfig } from '../../types.js';
import { DEFAULT_POLYGON2D_CONFIG } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createPolygon2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, chance, tri, skewCountLow, randomWeighted } = context;

  const starGrid = chance(0.22);
  const mode = starGrid ? 'grid' : 'scatter';
  const shape = starGrid ? 'star' : rng() < 0.12 ? 'star' : 'polygon';
  const edges = Math.max(3, Math.min(16, Math.round(randomWeighted(3, 12, 6))));
  const rMinPx = Math.round(randomWeighted(6, 40, 18));
  const rMaxPx = Math.round(randomWeighted(30, 280, 130));
  const cellPx = Math.round(randomWeighted(18, 140, 54));
  return {
    ...base,
    bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
    type: 'polygon2d',
    polygons: {
      mode,
      shape,
      count: starGrid
        ? skewCountLow(20, 900, 2600, 9000, 0.02)
        : skewCountLow(10, DEFAULT_POLYGON2D_CONFIG.polygons.count, 420, 1600, 0.03),
      edges,
      rMinPx,
      rMaxPx,
      jitter: clamp(randomWeighted(0, 1, 1), 0, 1),
      rotateJitterDeg: starGrid ? randomWeighted(0, 25, 6) : randomWeighted(0, 360, 180),
      grid: {
        kind: starGrid ? 'diamond' : rng() < 0.4 ? 'diamond' : 'square',
        cellPx,
        jitter: clamp(randomWeighted(0, 1, 0.65), 0, 1)
      },
      star: {
        innerScale: clamp(tri(0.25, 0.5, 0.8), 0.05, 0.95)
      },
      fillOpacity: clamp(randomWeighted(starGrid ? 0.05 : 0.2, 1, starGrid ? 0.32 : 0.95), 0, 1),
      stroke: {
        enabled: rng() < (starGrid ? 0.75 : 0.25),
        widthPx: starGrid ? 1 : 2,
        color: '#ffffff',
        opacity: clamp(tri(0.08, 0.55, 1.0), 0, 1)
      },
      paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
    }
  };
}

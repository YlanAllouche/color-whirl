import type { WallpaperConfig } from '../../types.js';
import { DEFAULT_CIRCLES2D_CONFIG } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createCircles2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, skewCountLow, randomWeighted } = context;

  return {
    ...base,
    bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
    type: 'circles2d',
    circles: {
      mode: rng() < 0.7 ? 'scatter' : 'grid',
      count: skewCountLow(10, DEFAULT_CIRCLES2D_CONFIG.circles.count, 420, 1200, 0.03),
      rMinPx: Math.round(randomWeighted(6, 40, 18)),
      rMaxPx: Math.round(randomWeighted(30, 280, 150)),
      jitter: clamp(randomWeighted(0, 1, 1), 0, 1),
      fillOpacity: clamp(randomWeighted(0.2, 1, 0.95), 0, 1),
      stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
      paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      croissant: {
        enabled: rng() < 0.35,
        innerScale: clamp(randomWeighted(0.5, 0.92, 0.72), 0.01, 0.99),
        offset: clamp(randomWeighted(0.05, 0.8, 0.35), 0, 1),
        angleJitterDeg: randomWeighted(0, 360, 180)
      }
    }
  };
}

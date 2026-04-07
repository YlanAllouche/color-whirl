import type { WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createTriangles2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, randomWeighted } = context;

  return {
    ...base,
    bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
    type: 'triangles2d',
    triangles: {
      mode: (['tessellation', 'scatter', 'lowpoly'] as const)[Math.floor(rng() * 3)],
      density: clamp(randomWeighted(0.3, 3.0, 1.0), 0.05, 50),
      scalePx: Math.round(randomWeighted(28, 220, 90)),
      jitter: clamp(randomWeighted(0, 1, 0.15), 0, 1),
      rotateJitterDeg: randomWeighted(0, 180, 25),
      insetPx: Math.round(randomWeighted(0, 120, 0)),
      fillOpacity: clamp(randomWeighted(0.2, 1, 0.95), 0, 1),
      stroke: { enabled: rng() < 0.25, widthPx: 2, color: '#0b0b10', opacity: 0.6 },
      paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      shading: {
        enabled: rng() < 0.85,
        lightDeg: randomWeighted(0, 360, 35),
        strength: clamp(randomWeighted(0, 1, 0.25), 0, 1)
      }
    }
  };
}

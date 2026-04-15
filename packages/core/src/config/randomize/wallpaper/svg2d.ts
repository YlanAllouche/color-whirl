import type { WallpaperConfig } from '../../types.js';
import { DEFAULT_SVG2D_CONFIG, DEFAULT_SVG_SOURCE } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createSvg2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, skewCountLow, randomWeighted } = context;

  return {
    ...base,
    bloom: (base as any).emission.enabled ? { ...(base as any).bloom, enabled: true } : { ...(base as any).bloom },
    type: 'svg2d',
    svg: {
      source: DEFAULT_SVG_SOURCE,
      renderMode: 'auto',
      colorMode: rng() < 0.12 ? 'svg-to-palette' : 'palette',
      maxTones: Math.max(2, Math.min(12, Math.round(tri(2, 8, 12)))),
      mode: chance(0.15) ? 'grid' : 'scatter',
      count: chance(0.15) ? 1 : skewCountLow(2, DEFAULT_SVG2D_CONFIG.svg.count, 420, 1600, 0.03),
      rMinPx: Math.round(randomWeighted(6, 40, DEFAULT_SVG2D_CONFIG.svg.rMinPx)),
      rMaxPx: Math.round(randomWeighted(30, 280, DEFAULT_SVG2D_CONFIG.svg.rMaxPx)),
      jitter: clamp(randomWeighted(0, 1, DEFAULT_SVG2D_CONFIG.svg.jitter), 0, 1),
      rotateJitterDeg: randomWeighted(0, 360, DEFAULT_SVG2D_CONFIG.svg.rotateJitterDeg),
      fillOpacity: clamp(randomWeighted(0.2, 1, DEFAULT_SVG2D_CONFIG.svg.fillOpacity), 0, 1),
      stroke: { enabled: rng() < 0.35, widthPx: 2, color: '#0b0b10', opacity: 0.7 },
      paletteMode: rng() < 0.65 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08]
    }
  };
}

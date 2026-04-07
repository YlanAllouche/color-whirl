import type { WallpaperConfig } from '../../types.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createHexgrid2dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, randomWeighted } = context;

  return {
    ...base,
    emission: { ...(base as any).emission, enabled: false },
    bloom: { ...(base as any).bloom, enabled: false },
    type: 'hexgrid2d',
    hexgrid: {
      radiusPx: Math.round(randomWeighted(14, 120, 56)),
      marginPx: Math.round(randomWeighted(0, 10, 2)),
      originPx: { x: 0, y: 0 },
      overscanPx: 32,
      stroke: { enabled: rng() < 0.3, widthPx: 2, color: '#0b0b10', opacity: 0.6, join: 'round' },
      coloring: {
        weightsMode: 'preset',
        preset: (['equal', 'dominant', 'accents', 'rare-accents'] as const)[Math.floor(rng() * 4)],
        weights: [1, 1, 1, 1, 1],
        paletteMode: 'weighted'
      },
      effect: {
        kind: (['none', 'bevel', 'grain', 'gradient'] as const)[Math.floor(rng() * 4)],
        amount: clamp(randomWeighted(0, 1, 0.45), 0, 1),
        frequency: randomWeighted(0.2, 3.0, 1.0)
      },
      grouping: {
        // Grouping is visually strong and can be expensive; keep it less common.
        mode: rng() < 0.55 ? 'none' : rng() < 0.7 ? 'noise' : rng() < 0.86 ? 'voronoi' : 'random-walk',
        strength: clamp(randomWeighted(0, 1, 0.6), 0, 1),
        targetGroupCount: Math.max(1, Math.round(randomWeighted(1, 80, 24)))
      },
      fillOpacity: clamp(randomWeighted(0.2, 1, 0.96), 0, 1)
    }
  };
}

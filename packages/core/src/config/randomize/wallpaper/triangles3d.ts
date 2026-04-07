import type { WallpaperConfig } from '../../types.js';
import { DEFAULT_TRIANGLES3D_CONFIG } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createTriangles3dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, skewCountLow, randomWeighted, randomStickOpacity } = context;

  const bulgeX = clamp(tri(-1, 0, 1), -1, 1);
  const bulgeY = chance(0.65) ? bulgeX : clamp(tri(-1, 0, 1), -1, 1);

  return {
    ...base,
    type: 'triangles3d',
    prisms: {
      mode: 'stackedPrisms',
      count: skewCountLow(10, DEFAULT_TRIANGLES3D_CONFIG.prisms.count, 360, 1500, 0.03),
      base: (['prism', 'pyramidTri', 'pyramidSquare'] as const)[Math.floor(rng() * 3)],
      radius: randomWeighted(0.06, 0.6, 0.22),
      height: randomWeighted(0.06, 1.2, 0.5),
      taper: (() => {
        // Strongly bias toward prisms; occasional frustums/pyramids.
        const r = rng();
        if (r < 0.72) return clamp(tri(0.85, 1.0, 1.0), 0, 1);
        if (r < 0.95) return clamp(tri(0.35, 0.85, 1.0), 0, 1);
        return clamp(tri(0.0, 0.15, 0.5), 0, 1);
      })(),
      wallBulgeX: bulgeX,
      wallBulgeY: bulgeY,
      spread: randomWeighted(0.8, 6.5, 4.4),
      jitter: clamp(randomWeighted(0, 1, 0.65), 0, 1),
      paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      opacity: randomStickOpacity()
    }
  };
}

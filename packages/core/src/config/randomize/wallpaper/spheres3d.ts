import type { Spheres3DShapeConfig, WallpaperConfig } from '../../types.js';
import { DEFAULT_SPHERES3D_CONFIG } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createSpheres3dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, skewCountLow, randomWeighted, randomStickOpacity } = context;

  const shape: Spheres3DShapeConfig = (() => {
    const polyChance = 0.32;
    const boxChance = 0.22;
    const roll = rng();
    if (roll < polyChance) {
      const roundness = clamp(tri(0.35, 0.75, 1.0), 0, 1);
      const faceting = clamp(tri(0.5, 0.85, 1.0), 0, 1);
      return { kind: 'geodesicPoly' as const, roundness, faceting };
    }

    if (roll < polyChance + boxChance) {
      // Bias to "good looking": fairly round + some faceting; allow rare cubes.
      const cubeish = chance(0.08);
      const roundness = cubeish ? clamp(tri(0.0, 0.12, 0.55), 0, 1) : clamp(tri(0.35, 0.9, 1.0), 0, 1);
      const faceting = cubeish ? clamp(tri(0.75, 1.0, 1.0), 0, 1) : clamp(tri(0.05, 0.55, 1.0), 0, 1);
      return { kind: 'spherifiedBox' as const, roundness, faceting };
    }

    return { kind: 'uvSphere' as const, roundness: 1, faceting: 0 };
  })();

  return {
    ...base,
    type: 'spheres3d',
    spheres: {
      count: skewCountLow(20, DEFAULT_SPHERES3D_CONFIG.spheres.count, 380, 1000, 0.03),
      distribution: (['jitteredGrid', 'scatter', 'layeredDepth'] as const)[Math.floor(rng() * 3)],
      radiusMin: randomWeighted(0.04, 0.18, 0.08),
      radiusMax: randomWeighted(0.12, 0.55, 0.26),
      spread: randomWeighted(1.0, 6.0, 4.2),
      depth: randomWeighted(0.5, 7.0, 4.0),
      layers: Math.max(1, Math.min(8, Math.round(randomWeighted(1, 8, 3)))),
      paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      opacity: randomStickOpacity(),
      shape
    }
  };
}

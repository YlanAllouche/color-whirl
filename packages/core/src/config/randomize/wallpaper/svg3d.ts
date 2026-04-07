import type { SvgColorMode, WallpaperConfig } from '../../types.js';
import { DEFAULT_SVG3D_CONFIG, DEFAULT_SVG_SOURCE } from '../../defaults.js';

import type { RandomConfigContext } from './helpers.js';
import { clamp } from '../utils.js';

export function createSvg3dConfig(context: RandomConfigContext): WallpaperConfig {
  const { base, rng, tri, chance, skewCountLow, randomWeighted, randomStickOpacity } = context;

  const logoMode = chance(0.18);
  const colorMode: SvgColorMode = rng() < 0.12 ? 'svg-to-palette' : 'palette';
  const count = logoMode ? 1 : chance(0.15) ? 1 : skewCountLow(2, DEFAULT_SVG3D_CONFIG.svg.count, 360, 1500, 0.03);
  const spread = logoMode ? 0 : randomWeighted(0.8, 6.5, DEFAULT_SVG3D_CONFIG.svg.spread);
  const depth = logoMode ? 0 : randomWeighted(0.5, 7.0, DEFAULT_SVG3D_CONFIG.svg.depth);
  const tiltDeg = logoMode ? 0 : chance(0.75) ? 0 : Math.round(clamp(randomWeighted(0, 45, 8), 0, 80));

  const rotateDeg = 0;
  const rotateJitterDeg = logoMode ? 0 : clamp(randomWeighted(0, 360, DEFAULT_SVG3D_CONFIG.svg.rotateJitterDeg), 0, 3600);

  const logoSize = logoMode ? clamp(randomWeighted(0.35, 1.8, 0.85), 0.05, 3.0) : 0;
  const sizeMin = logoMode ? logoSize : randomWeighted(0.05, 0.32, DEFAULT_SVG3D_CONFIG.svg.sizeMin);
  const sizeMax = logoMode ? logoSize : randomWeighted(0.14, 0.9, DEFAULT_SVG3D_CONFIG.svg.sizeMax);

  return {
    ...base,
    type: 'svg3d',
    svg: {
      source: DEFAULT_SVG_SOURCE,
      renderMode: 'auto',
      colorMode,
      maxTones: Math.max(2, Math.min(12, Math.round(tri(2, 8, 12)))),
      count,
      spread,
      depth,
      tiltDeg,
      rotateDeg,
      rotateJitterDeg,
      sizeMin,
      sizeMax,
      extrudeDepth: randomWeighted(0.02, 0.6, DEFAULT_SVG3D_CONFIG.svg.extrudeDepth),
      stroke: {
        enabled: logoMode ? true : rng() < 0.45,
        radius: clamp(tri(0.006, DEFAULT_SVG3D_CONFIG.svg.stroke.radius, 0.06), 0.001, 0.2),
        segments: Math.max(1, Math.min(12, Math.round(tri(2, DEFAULT_SVG3D_CONFIG.svg.stroke.segments, 10)))),
        opacity: randomStickOpacity()
      },
      bevel: {
        enabled: chance(0.7),
        size: clamp(tri(0.0, DEFAULT_SVG3D_CONFIG.svg.bevel.size, 0.14), 0, 0.2),
        segments: Math.max(0, Math.min(6, Math.round(tri(0, DEFAULT_SVG3D_CONFIG.svg.bevel.segments, 4))))
      },
      paletteMode: rng() < 0.55 ? 'weighted' : 'cycle',
      colorWeights: [0.34, 0.28, 0.18, 0.12, 0.08],
      opacity: randomStickOpacity()
    }
  };
}

import type { WallpaperConfig, WallpaperType } from '../../types.js';

import { createRandomConfigContext } from './helpers.js';
import { createBands2dConfig } from './bands2d.js';
import { createCircles2dConfig } from './circles2d.js';
import { createDiamondgrid2dConfig } from './diamondgrid2d.js';
import { createFlowlines2dConfig } from './flowlines2d.js';
import { createHexgrid2dConfig } from './hexgrid2d.js';
import { createPolygon2dConfig } from './polygon2d.js';
import { createPopsicleConfig } from './popsicle.js';
import { createRidges2dConfig } from './ridges2d.js';
import { createSpheres3dConfig } from './spheres3d.js';
import { createSvg2dConfig } from './svg2d.js';
import { createSvg3dConfig } from './svg3d.js';
import { createTriangles2dConfig } from './triangles2d.js';
import { createTriangles3dConfig } from './triangles3d.js';

/** Generate a random wallpaper configuration, including colors, without using presets. */
export function generateRandomConfigNoPresets(): WallpaperConfig {
  const seed = Math.floor(Math.random() * 0xffffffff) >>> 0;
  return generateRandomConfigNoPresetsFromSeed(seed, 'popsicle');
}

export function generateRandomConfigNoPresetsFromSeed(seed: number, type: WallpaperType = 'popsicle'): WallpaperConfig {
  const context = createRandomConfigContext(seed, type);

  switch (type) {
    case 'spheres3d':
      return createSpheres3dConfig(context);
    case 'bands2d':
      return createBands2dConfig(context);
    case 'flowlines2d':
      return createFlowlines2dConfig(context);
    case 'diamondgrid2d':
      return createDiamondgrid2dConfig(context);
    case 'circles2d':
      return createCircles2dConfig(context);
    case 'polygon2d':
      return createPolygon2dConfig(context);
    case 'triangles2d':
      return createTriangles2dConfig(context);
    case 'triangles3d':
      return createTriangles3dConfig(context);
    case 'svg2d':
      return createSvg2dConfig(context);
    case 'svg3d':
      return createSvg3dConfig(context);
    case 'hexgrid2d':
      return createHexgrid2dConfig(context);
    case 'ridges2d':
      return createRidges2dConfig(context);
    case 'popsicle':
    default:
      return createPopsicleConfig(context);
  }
}

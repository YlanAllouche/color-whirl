import type {
  Bands2DConfig,
  Circles2DConfig,
  DiamondGrid2DConfig,
  Flowlines2DConfig,
  HexGrid2DConfig,
  Polygon2DConfig,
  Ridges2DConfig,
  Triangles2DConfig
} from './generators-2d.js';
import type { PopsicleConfig, Spheres3DConfig, Triangles3DConfig } from './generators-3d.js';
import type { Svg2DConfig, Svg3DConfig } from './svg.js';

export * from './base.js';
export * from './generators-2d.js';
export * from './generators-3d.js';
export * from './svg.js';

export type WallpaperConfig =
  | PopsicleConfig
  | Spheres3DConfig
  | Bands2DConfig
  | Flowlines2DConfig
  | DiamondGrid2DConfig
  | Circles2DConfig
  | Polygon2DConfig
  | Triangles2DConfig
  | Triangles3DConfig
  | HexGrid2DConfig
  | Ridges2DConfig
  | Svg2DConfig
  | Svg3DConfig;

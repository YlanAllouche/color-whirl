import * as THREE from 'three';
import type {
  WallpaperConfig,
  PopsicleConfig,
  Spheres3DConfig,
  Triangles3DConfig,
  Circles2DConfig,
  Polygon2DConfig,
  Triangles2DConfig,
  HexGrid2DConfig,
  Ridges2DConfig
} from '../types.js';

import { createPopsicleScene, renderPopsicleToCanvas } from './popsicle.js';
import { createSpheres3DScene, renderSpheres3DToCanvas } from './spheres3d.js';
import { createTriangles3DScene, renderTriangles3DToCanvas } from './triangles3d.js';
import { renderCircles2DToCanvas } from './circles2d.js';
import { renderPolygon2DToCanvas } from './polygon2d.js';
import { renderTriangles2DToCanvas } from './triangles2d.js';
import { renderHexGrid2DToCanvas } from './hexgrid2d.js';
import { renderRidges2DToCanvas } from './ridges2d.js';

export function createWallpaperScene(
  config: WallpaperConfig,
  options?: {
    canvas?: HTMLCanvasElement;
    preserveDrawingBuffer?: boolean;
    pixelRatio?: number;
    /**
     * Optional scale factor for collision masking depth targets (3D only).
     * Keeps previews snappy without affecting export.
     */
    collisionMaskScale?: number;
  }
): {
  scene: THREE.Scene;
  camera: THREE.Camera;
  renderer: THREE.WebGLRenderer;
} {
  switch (config.type) {
    case 'popsicle':
      return createPopsicleScene(config as PopsicleConfig, options);
    case 'spheres3d':
      return createSpheres3DScene(config as Spheres3DConfig, options);
    case 'triangles3d':
      return createTriangles3DScene(config as Triangles3DConfig, options);
    default:
      throw new Error(`createWallpaperScene not supported for type: ${config.type}`);
  }
}

export function renderWallpaperToCanvas(config: WallpaperConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  switch (config.type) {
    case 'popsicle':
      return renderPopsicleToCanvas(config as PopsicleConfig, canvas);
    case 'spheres3d':
      return renderSpheres3DToCanvas(config as Spheres3DConfig, canvas);
    case 'triangles3d':
      return renderTriangles3DToCanvas(config as Triangles3DConfig, canvas);
    case 'circles2d':
      return renderCircles2DToCanvas(config as Circles2DConfig, canvas);
    case 'polygon2d':
      return renderPolygon2DToCanvas(config as Polygon2DConfig, canvas);
    case 'triangles2d':
      return renderTriangles2DToCanvas(config as Triangles2DConfig, canvas);
    case 'hexgrid2d':
      return renderHexGrid2DToCanvas(config as HexGrid2DConfig, canvas);
    case 'ridges2d':
      return renderRidges2DToCanvas(config as Ridges2DConfig, canvas);
    default:
      throw new Error(`Unknown wallpaper type: ${(config as any).type}`);
  }
}

import type { WallpaperConfig } from '../types.js';
import type { ExportResult } from './export-types.js';
import { generateBands2DSVG } from './svg/bands2d.js';
import { generateCircles2DSVG } from './svg/circles2d.js';
import { generateDiamondGrid2DSVG } from './svg/diamondgrid2d.js';
import { generateFlowlines2DSVG } from './svg/flowlines2d.js';
import { generateHexGrid2DSVG } from './svg/hexgrid2d.js';
import { generatePolygon2DSVG } from './svg/polygon2d.js';
import { generatePopsicleSVG } from './svg/popsicle.js';
import { generateRidges2DSVG } from './svg/ridges2d.js';
import { generateSpheres3DSVG } from './svg/spheres3d.js';
import { generateSvg2DSVG } from './svg/svg2d.js';
import { generateSvg3DSVG } from './svg/svg3d.js';
import { generateTriangles2DSVG } from './svg/triangles2d.js';
import { generateTriangles3DSVG } from './svg/triangles3d.js';

export async function exportToSVG(config: WallpaperConfig): Promise<ExportResult> {
  const svgContent = generateSVGContent(config);
  return { data: svgContent, format: 'svg', mimeType: 'image/svg+xml' };
}

function generateSVGContent(config: WallpaperConfig): string {
  switch (config.type) {
    case 'popsicle':
      return generatePopsicleSVG(config);
    case 'bands2d':
      return generateBands2DSVG(config);
    case 'circles2d':
      return generateCircles2DSVG(config);
    case 'polygon2d':
      return generatePolygon2DSVG(config);
    case 'diamondgrid2d':
      return generateDiamondGrid2DSVG(config);
    case 'svg2d':
      return generateSvg2DSVG(config);
    case 'triangles2d':
      return generateTriangles2DSVG(config);
    case 'ridges2d':
      return generateRidges2DSVG(config);
    case 'flowlines2d':
      return generateFlowlines2DSVG(config);
    case 'hexgrid2d':
      return generateHexGrid2DSVG(config);
    case 'spheres3d':
      return generateSpheres3DSVG(config);
    case 'triangles3d':
      return generateTriangles3DSVG(config);
    case 'svg3d':
      return generateSvg3DSVG(config);
    default:
      throw new Error(`SVG export not supported for type: ${(config as any).type}`);
  }
}

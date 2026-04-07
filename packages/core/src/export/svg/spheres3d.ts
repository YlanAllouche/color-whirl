import type { WallpaperConfig } from '../../types.js';
import { cellRand01, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateSpheres3DSVG(config: Extract<WallpaperConfig, { type: 'spheres3d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.spheres.count));
  const rMin = Math.max(0.1, config.spheres.radiusMin * 120);
  const rMax = Math.max(rMin, config.spheres.radiusMax * 120);

  const spread = Math.max(0, Number(config.spheres.spread) || 0);
  const depth = Math.max(0, Number(config.spheres.depth) || 0);
  const layers = Math.max(1, Math.round(Number(config.spheres.layers) || 1));
  const distribution = config.spheres.distribution;

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.spheres.colorWeights, n);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const posForIndex = (i: number): { x: number; y: number; z: number } => {
    if (distribution === 'layeredDepth') {
      const layer = i % layers;
      const zBase = layers === 1 ? 0 : -(depth * 0.5) + (depth * layer) / (layers - 1);
      const z = zBase + (rand01(i, 21) - 0.5) * (depth / layers) * 0.75;
      const x = (rand01(i, 22) - 0.5) * 2 * spread;
      const y = (rand01(i, 23) - 0.5) * 2 * spread;
      return { x, y, z };
    }

    if (distribution === 'jitteredGrid') {
      const gx = Math.max(1, Math.round(Math.sqrt(count * (width / Math.max(1, height)))));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = spread === 0 ? 0 : (spread * 2) / gx;
      const cellH = spread === 0 ? 0 : (spread * 2) / gy;
      const x = -spread + (cx + 0.5) * cellW + (rand01(i, 24) - 0.5) * cellW * 0.85;
      const y = -spread + (cy + 0.5) * cellH + (rand01(i, 25) - 0.5) * cellH * 0.85;
      const z = (rand01(i, 26) - 0.5) * depth;
      return { x, y, z };
    }

    const x = (rand01(i, 22) - 0.5) * 2 * spread;
    const y = (rand01(i, 23) - 0.5) * 2 * spread;
    const z = (rand01(i, 26) - 0.5) * depth;
    return { x, y, z };
  };

  const instances: Array<{ cx: number; cy: number; r: number; col: string; z: number }> = [];
  for (let i = 0; i < count; i++) {
    const p = posForIndex(i);
    const u = rand01(i, 1);
    const rr = rMin + rand01(i, 2) * (rMax - rMin);
    const idx = config.spheres.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const denom = Math.max(0.0001, spread * 2);
    const cx = (p.x / denom + 0.5) * width;
    const cy = (p.y / denom + 0.5) * height;
    instances.push({ cx, cy, r: rr, col, z: p.z });
  }

  if (distribution === 'layeredDepth') {
    instances.sort((a, b) => a.z - b.z);
  }

  let svg = svgStart(width, height, backgroundColor);
  const opacity = clamp01(Number(config.spheres.opacity) || 0);
  for (const it of instances) {
    svg += `  <circle cx="${it.cx}" cy="${it.cy}" r="${it.r}" fill="${it.col}" opacity="${opacity}"/>\n`;
  }
  svg += svgEnd();
  return svg;
}

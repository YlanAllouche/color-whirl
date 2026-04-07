import type { WallpaperConfig } from '../../types.js';
import { clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generatePolygon2DSVG(config: Extract<WallpaperConfig, { type: 'polygon2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(config.polygons.count));
  const edges = Math.max(3, Math.round(Number(config.polygons.edges) || 3));
  const rMin = Math.max(0.1, Number(config.polygons.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.polygons.rMaxPx) || rMin);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => {
    const x = ((seed ^ (i * 0x9e3779b1)) + ch * 0x85ebca6b) >>> 0;
    let t = x;
    t ^= t >>> 16;
    t = Math.imul(t, 0x7feb352d);
    t ^= t >>> 15;
    t = Math.imul(t, 0x846ca68b);
    t ^= t >>> 16;
    return (t >>> 0) / 4294967296;
  };

  const w = normalizeWeights(config.polygons.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.polygons.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), w);
  };

  const fillOpacity = clamp01(Number(config.polygons.fillOpacity) || 0);
  const j = clamp01(Number(config.polygons.jitter) || 0);
  const rotJ = ((Number(config.polygons.rotateJitterDeg) || 0) * Math.PI) / 180;

  const mode = (config as any).polygons?.mode === 'grid' ? 'grid' : 'scatter';
  const shape = (config as any).polygons?.shape === 'star' ? 'star' : 'polygon';
  const starInner = clamp(Number((config as any).polygons?.star?.innerScale) || 0.5, 0.05, 0.95);
  const grid: any = (config as any).polygons?.grid ?? {};
  const gridKind = grid.kind === 'diamond' ? 'diamond' : 'square';
  const cellPx = Math.max(6, Number(grid.cellPx) || 6);
  const gridJitter = clamp01(Number(grid.jitter) || 0);

  const strokeEnabled = !!config.polygons.stroke.enabled;
  const strokeW = Math.max(0, Number(config.polygons.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.polygons.stroke.opacity) || 0);
  const strokeAttr =
    strokeEnabled && strokeW > 0 && strokeOpacity > 0
      ? ` stroke="${config.polygons.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
      : '';

  let svg = svgStart(width, height, backgroundColor);

  const buildPoints = (cx: number, cy: number, r: number, theta: number): string[] => {
    if (shape === 'star') {
      const pts: string[] = [];
      const nPts = edges * 2;
      const rIn = Math.max(0.1, r * starInner);
      for (let k = 0; k < nPts; k++) {
        const a = theta + (k / nPts) * Math.PI * 2;
        const rr = k % 2 === 0 ? r : rIn;
        pts.push(`${(cx + Math.cos(a) * rr).toFixed(3)},${(cy + Math.sin(a) * rr).toFixed(3)}`);
      }
      return pts;
    }

    const pts: string[] = [];
    for (let k = 0; k < edges; k++) {
      const a = theta + (k / edges) * Math.PI * 2;
      pts.push(`${(cx + Math.cos(a) * r).toFixed(3)},${(cy + Math.sin(a) * r).toFixed(3)}`);
    }
    return pts;
  };

  if (mode === 'grid') {
    let i = 0;
    if (gridKind === 'square') {
      const cols = Math.ceil(width / cellPx) + 2;
      const rows = Math.ceil(height / cellPx) + 2;
      for (let gy = -1; gy <= rows; gy++) {
        for (let gx = -1; gx <= cols; gx++) {
          if (i >= count) break;
          const baseX = (gx + 0.5) * cellPx;
          const baseY = (gy + 0.5) * cellPx;
          const jx = (rand01(i, 11) - 0.5) * cellPx * 0.9 * gridJitter;
          const jy = (rand01(i, 12) - 0.5) * cellPx * 0.9 * gridJitter;
          const r0 = rMin + rand01(i, 2) * (rMax - rMin);
          const r = Math.min(r0, cellPx * 0.55);
          const cx0 = baseX + jx;
          const cy0 = baseY + jy;
          const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
          const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
          const theta = (rand01(i, 8) - 0.5) * rotJ;
          const idx = pickIndex(i);
          const color = colors[idx] ?? '#ffffff';
          const pts = buildPoints(cx, cy, r, theta);
          svg += `  <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${fillOpacity.toFixed(3)}"${strokeAttr}/>` + '\n';
          i++;
        }
        if (i >= count) break;
      }
    } else {
      const a = cellPx * 0.5;
      const b = cellPx * 0.5;
      const originX = 0;
      const originY = 0;
      const invU = (x: number, y: number) => 0.5 * ((x - originX) / a + (y - originY) / b);
      const invV = (x: number, y: number) => 0.5 * ((y - originY) / b - (x - originX) / a);
      const corners = [
        { x: -cellPx, y: -cellPx },
        { x: width + cellPx, y: -cellPx },
        { x: -cellPx, y: height + cellPx },
        { x: width + cellPx, y: height + cellPx }
      ];
      let uMin = Infinity;
      let uMax = -Infinity;
      let vMin = Infinity;
      let vMax = -Infinity;
      for (const p of corners) {
        const uu = invU(p.x, p.y);
        const vv = invV(p.x, p.y);
        if (uu < uMin) uMin = uu;
        if (uu > uMax) uMax = uu;
        if (vv < vMin) vMin = vv;
        if (vv > vMax) vMax = vv;
      }
      const pad = 2;
      const u0 = Math.floor(uMin) - pad;
      const u1 = Math.ceil(uMax) + pad;
      const v0 = Math.floor(vMin) - pad;
      const v1 = Math.ceil(vMax) + pad;

      for (let vv = v0; vv <= v1; vv++) {
        for (let uu = u0; uu <= u1; uu++) {
          if (i >= count) break;
          const baseX = originX + (uu - vv) * a;
          const baseY = originY + (uu + vv) * b;
          if (baseX < -cellPx || baseX > width + cellPx || baseY < -cellPx || baseY > height + cellPx) continue;
          const jx = (rand01(i, 11) - 0.5) * cellPx * 0.9 * gridJitter;
          const jy = (rand01(i, 12) - 0.5) * cellPx * 0.9 * gridJitter;
          const r0 = rMin + rand01(i, 2) * (rMax - rMin);
          const r = Math.min(r0, cellPx * 0.55);
          const cx0 = baseX + jx;
          const cy0 = baseY + jy;
          const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
          const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
          const theta = (rand01(i, 8) - 0.5) * rotJ;
          const idx = pickIndex(i);
          const color = colors[idx] ?? '#ffffff';
          const pts = buildPoints(cx, cy, r, theta);
          svg += `  <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${fillOpacity.toFixed(3)}"${strokeAttr}/>` + '\n';
          i++;
        }
        if (i >= count) break;
      }
    }
  } else {
    for (let i = 0; i < count; i++) {
      const r = rMin + rand01(i, 2) * (rMax - rMin);
      const cx0 = rand01(i, 3) * width;
      const cy0 = rand01(i, 4) * height;
      const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
      const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
      const theta = (rand01(i, 8) - 0.5) * rotJ;
      const idx = pickIndex(i);
      const color = colors[idx] ?? '#ffffff';
      const pts = buildPoints(cx, cy, r, theta);
      svg += `  <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${fillOpacity.toFixed(3)}"${strokeAttr}/>` + '\n';
    }
  }

  svg += svgEnd();
  return svg;
}

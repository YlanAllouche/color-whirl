import type { WallpaperConfig } from '../../types.js';
import { adjustHex, cellRand01, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateHexGrid2DSVG(config: Extract<WallpaperConfig, { type: 'hexgrid2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const seed = config.seed >>> 0;
  const n = Math.max(1, colors.length);
  const R = Math.max(0.5, Number(config.hexgrid.radiusPx) || 1);
  const overscan = Math.max(0, Number(config.hexgrid.overscanPx) || 0);
  const ox = Number(config.hexgrid.originPx.x) || 0;
  const oy = Number(config.hexgrid.originPx.y) || 0;
  const margin = Math.max(0, Number(config.hexgrid.marginPx) || 0);
  const sw = config.hexgrid.stroke.enabled ? Math.max(0, Number(config.hexgrid.stroke.widthPx) || 0) : 0;
  const drawR = Math.max(0.01, R - margin * 0.5 - sw * 0.5);
  const fillOpacity = clamp01(Number(config.hexgrid.fillOpacity) || 0);

  const xMin = -overscan;
  const yMin = -overscan;
  const xMax = width + overscan;
  const yMax = height + overscan;
  const dy = 1.5 * R;
  const dx = 1.7320508075688772 * R;

  const rMin = Math.floor((yMin - oy) / dy) - 2;
  const rMax = Math.ceil((yMax - oy) / dy) + 2;

  let svg = svgStart(width, height, backgroundColor);
  const strokeAttr = config.hexgrid.stroke.enabled
    ? ` stroke="${config.hexgrid.stroke.color}" stroke-opacity="${Math.max(0, Math.min(1, config.hexgrid.stroke.opacity))}" stroke-width="${sw}" stroke-linejoin="${config.hexgrid.stroke.join}"`
    : '';

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const buildWeights = (): number[] => {
    const mode = config.hexgrid.coloring.weightsMode;
    const preset = config.hexgrid.coloring.preset;

    if (mode === 'custom') {
      return normalizeWeights(config.hexgrid.coloring.weights, n);
    }

    if (mode === 'preset') {
      if (preset === 'equal') return normalizeWeights(Array(n).fill(1), n);
      if (preset === 'dominant') {
        const domIndex = Math.floor(cellRand01(seed, 17, 23, 9901) * n);
        const dom = 0.6;
        const rest = (1 - dom) / Math.max(1, n - 1);
        const w = Array(n).fill(rest);
        w[domIndex] = dom;
        return normalizeWeights(w, n);
      }
      if (preset === 'accents') {
        const w = Array(n).fill(1);
        if (n >= 2) w[0] = 2.2;
        if (n >= 3) w[n - 1] = 1.8;
        return normalizeWeights(w, n);
      }
      const w = Array(n).fill(1);
      if (n >= 2) w[n - 1] = 0.2;
      return normalizeWeights(w, n);
    }

    const domIndex = Math.floor(cellRand01(seed, 91, 7, 9902) * n);
    const dom = 0.5;
    const rest = (1 - dom) / Math.max(1, n - 1);
    const w = Array(n).fill(rest);
    w[domIndex] = dom;
    return normalizeWeights(w, n);
  };

  const weightsNorm = buildWeights();

  type Cell = { q: number; r: number; cx: number; cy: number; groupId: number; colorIndex: number };
  const cells: Cell[] = [];

  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(((xMin - ox) / dx) - r * 0.5) - 2;
    const qMax = Math.ceil(((xMax - ox) / dx) - r * 0.5) + 2;
    for (let q = qMin; q <= qMax; q++) {
      const cx = ox + R * 1.7320508075688772 * (q + r * 0.5);
      const cy = oy + R * 1.5 * r;
      if (cx < xMin - R || cx > xMax + R || cy < yMin - R || cy > yMax + R) continue;
      cells.push({ q, r, cx, cy, groupId: 0, colorIndex: 0 });
    }
  }

  const groupingMode = config.hexgrid.grouping.mode;
  const strength = clamp01(Number(config.hexgrid.grouping.strength) || 0);
  const k = Math.max(1, Math.round(Number(config.hexgrid.grouping.targetGroupCount) || 1));
  if (groupingMode === 'noise') {
    const scale = clamp(lerp(0.0015, 0.02, 1 - strength), 0.0001, 1);
    for (const c of cells) {
      const xi = Math.floor(c.cx * scale);
      const yi = Math.floor(c.cy * scale);
      const t = cellRand01(seed, xi, yi, 2001);
      c.groupId = Math.min(k - 1, Math.floor(t * k));
    }
  }

  const groupToColor = new Map<number, number>();
  for (const c of cells) {
    if (groupToColor.has(c.groupId)) continue;
    if (config.hexgrid.coloring.paletteMode === 'cycle') {
      groupToColor.set(c.groupId, ((c.groupId % n) + n) % n);
    } else {
      const u = cellRand01(seed, c.groupId, 0, 5001);
      groupToColor.set(c.groupId, sampleWeightedIndex01(u, weightsNorm));
    }
  }
  for (const c of cells) {
    c.colorIndex = groupToColor.get(c.groupId) ?? 0;
    c.colorIndex = Math.max(0, Math.min(n - 1, c.colorIndex));
  }

  const effectKind = config.hexgrid.effect.kind;
  const effectAmt = clamp01(Number(config.hexgrid.effect.amount) || 0);
  const gradAngle = cellRand01(seed, 11, 17, 6001) * Math.PI * 2;
  const gx = Math.cos(gradAngle);
  const gy = Math.sin(gradAngle);

  for (const cell of cells) {
    let col = colors[cell.colorIndex] ?? '#ffffff';
    if (effectKind === 'grain' && effectAmt > 0) {
      const g = (cellRand01(seed, cell.q, cell.r, 7001) - 0.5) * 2;
      col = adjustHex(col, g * effectAmt * 0.06);
    }
    if (effectKind === 'gradient' && effectAmt > 0) {
      const nx = (cell.cx - width * 0.5) / Math.max(1, width);
      const ny = (cell.cy - height * 0.5) / Math.max(1, height);
      const d = clamp(nx * gx + ny * gy, -1, 1);
      col = adjustHex(col, d * 0.18 * effectAmt);
    }

    const pts: string[] = [];
    for (let i = 0; i < 6; i++) {
      const ang = ((-90 + i * 60) * Math.PI) / 180;
      pts.push(`${cell.cx + Math.cos(ang) * drawR},${cell.cy + Math.sin(ang) * drawR}`);
    }

    svg += `  <polygon points="${pts.join(' ')}" fill="${col}" fill-opacity="${fillOpacity}"${strokeAttr}/>` + '\n';
  }

  svg += svgEnd();
  return svg;
}

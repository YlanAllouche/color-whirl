import type {
  HexGrid2DConfig,
  HexColorWeightsPreset,
  HexGroupingMode,
  HexColorWeightsMode,
  HexEffectKind
} from '../types.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function rgba(hex: string, alpha: number): string {
  const a = clamp(alpha, 0, 1);
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return `rgba(255,255,255,${a})`;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${a})`;
}

function adjustHex(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  const adj = (v: number) => Math.round(clamp(v + k * 255, 0, 255));
  const rr = adj(r);
  const gg = adj(g);
  const bb = adj(b);
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(rr)}${toHex(gg)}${toHex(bb)}`;
}

function hashU32(x: number): number {
  x >>>= 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function cellRand01(seedU32: number, q: number, r: number, channel: number): number {
  let x = seedU32 ^ hashU32(q * 0x9e3779b1) ^ hashU32(r * 0x85ebca6b) ^ hashU32(channel * 0xc2b2ae35);
  x = hashU32(x);
  return (x >>> 0) / 4294967296;
}

const SQRT3 = 1.7320508075688772;

type Cell = { q: number; r: number; cx: number; cy: number; groupId: number; colorIndex: number };

function axialToPixelPointyTop(q: number, r: number, radiusPx: number, originX: number, originY: number): { x: number; y: number } {
  const x = originX + radiusPx * SQRT3 * (q + r * 0.5);
  const y = originY + radiusPx * 1.5 * r;
  return { x, y };
}

function enumerateCells(cfg: HexGrid2DConfig): Cell[] {
  const R = Math.max(0.5, Number(cfg.hexgrid.radiusPx) || 1);
  const overscan = Math.max(0, Number(cfg.hexgrid.overscanPx) || 0);
  const ox = Number(cfg.hexgrid.originPx.x) || 0;
  const oy = Number(cfg.hexgrid.originPx.y) || 0;

  const xMin = -overscan;
  const yMin = -overscan;
  const xMax = cfg.width + overscan;
  const yMax = cfg.height + overscan;

  const dy = 1.5 * R;
  const rMin = Math.floor((yMin - oy) / dy) - 2;
  const rMax = Math.ceil((yMax - oy) / dy) + 2;
  const dx = SQRT3 * R;

  const out: Cell[] = [];
  for (let r = rMin; r <= rMax; r++) {
    const qMin = Math.floor(((xMin - ox) / dx) - r * 0.5) - 2;
    const qMax = Math.ceil(((xMax - ox) / dx) - r * 0.5) + 2;
    for (let q = qMin; q <= qMax; q++) {
      const p = axialToPixelPointyTop(q, r, R, ox, oy);
      if (p.x < xMin - R || p.x > xMax + R || p.y < yMin - R || p.y > yMax + R) continue;
      out.push({ q, r, cx: p.x, cy: p.y, groupId: -1, colorIndex: 0 });
    }
  }

  out.sort((a, b) => (a.r - b.r) || (a.q - b.q));
  return out;
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function buildWeights(cfg: HexGrid2DConfig, mode: HexColorWeightsMode, preset: HexColorWeightsPreset, weights: number[]): number[] {
  const n = Math.max(1, cfg.colors.length);
  const seed = cfg.seed >>> 0;

  if (mode === 'custom') {
    return normalizeWeights(weights, n);
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
    // rare-accents
    const w = Array(n).fill(1);
    if (n >= 2) w[n - 1] = 0.2;
    return normalizeWeights(w, n);
  }

  // auto
  const domIndex = Math.floor(cellRand01(seed, 91, 7, 9902) * n);
  const dom = 0.5;
  const rest = (1 - dom) / Math.max(1, n - 1);
  const w = Array(n).fill(rest);
  w[domIndex] = dom;
  return normalizeWeights(w, n);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (u <= acc) return i;
  }
  return wNorm.length - 1;
}

function assignGroups(cfg: HexGrid2DConfig, cells: Cell[]): void {
  const seed = cfg.seed >>> 0;
  const mode: HexGroupingMode = cfg.hexgrid.grouping.mode;
  const strength = clamp(cfg.hexgrid.grouping.strength, 0, 1);
  const k = Math.max(1, Math.round(Number(cfg.hexgrid.grouping.targetGroupCount) || 1));
  if (mode === 'none') {
    for (const c of cells) c.groupId = 0;
    return;
  }

  if (mode === 'noise') {
    const scale = clamp(lerp(0.0015, 0.02, 1 - strength), 0.0001, 1);
    for (const c of cells) {
      const x = c.cx * scale;
      const y = c.cy * scale;
      const xi = Math.floor(x);
      const yi = Math.floor(y);
      const xf = x - xi;
      const yf = y - yi;
      const u = xf * xf * (3 - 2 * xf);
      const v = yf * yf * (3 - 2 * yf);

      const a = cellRand01(seed, xi, yi, 2001);
      const b = cellRand01(seed, xi + 1, yi, 2001);
      const c0 = cellRand01(seed, xi, yi + 1, 2001);
      const d = cellRand01(seed, xi + 1, yi + 1, 2001);
      const ab = a + (b - a) * u;
      const cd = c0 + (d - c0) * u;
      const t = ab + (cd - ab) * v;
      c.groupId = Math.min(k - 1, Math.floor(t * k));
    }
    return;
  }

  if (mode === 'voronoi') {
    // Pick K sites by smallest hash.
    const sites = [...cells]
      .map((c) => ({ c, s: cellRand01(seed, c.q, c.r, 3001) }))
      .sort((a, b) => a.s - b.s)
      .slice(0, k)
      .map((x, i) => ({ id: i, cx: x.c.cx, cy: x.c.cy }));

    for (const c of cells) {
      let best = 0;
      let bestD = Infinity;
      for (const s of sites) {
        const dx = c.cx - s.cx;
        const dy = c.cy - s.cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < bestD) {
          bestD = d2;
          best = s.id;
        }
      }
      c.groupId = best;
    }
    return;
  }

  // random-walk (simplified)
  const byKey = new Map<string, Cell>();
  for (const c of cells) byKey.set(`${c.q},${c.r}`, c);
  const dirs = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 }
  ];

  const walkers = Math.max(1, Math.round(lerp(k, Math.max(1, Math.floor(k / 2)), strength)));
  const starts = [...cells]
    .map((c) => ({ c, s: cellRand01(seed, c.q, c.r, 4001) }))
    .sort((a, b) => a.s - b.s)
    .slice(0, walkers)
    .map((x, i) => ({ id: i, q: x.c.q, r: x.c.r }));

  const stepsPer = Math.max(20, Math.round(lerp(60, 900, strength)));
  let gid = 0;
  for (const w of starts) {
    let q = w.q;
    let r = w.r;
    let dir = Math.floor(cellRand01(seed, q, r, 4002) * 6);
    for (let s = 0; s < stepsPer; s++) {
      const cell = byKey.get(`${q},${r}`);
      if (cell) cell.groupId = gid;
      if (cellRand01(seed, q, r, 4003) < 0.35) dir = Math.floor(cellRand01(seed, q, r, 4004) * 6);
      q += dirs[dir].q;
      r += dirs[dir].r;
    }
    gid++;
  }

  // Fill unassigned.
  for (const c of cells) {
    if (c.groupId !== -1) continue;
    c.groupId = Math.floor(cellRand01(seed, c.q, c.r, 4010) * gid);
  }
}

function assignColors(cfg: HexGrid2DConfig, cells: Cell[]): void {
  const seed = cfg.seed >>> 0;
  const n = Math.max(1, cfg.colors.length);
  const w = buildWeights(cfg, cfg.hexgrid.coloring.weightsMode, cfg.hexgrid.coloring.preset, cfg.hexgrid.coloring.weights);

  const groupToColor = new Map<number, number>();
  for (const c of cells) {
    if (groupToColor.has(c.groupId)) continue;
    if (cfg.hexgrid.coloring.paletteMode === 'cycle') {
      groupToColor.set(c.groupId, ((c.groupId % n) + n) % n);
    } else {
      const u = cellRand01(seed, c.groupId, 0, 5001);
      groupToColor.set(c.groupId, sampleWeightedIndex01(u, w));
    }
  }

  for (const c of cells) {
    c.colorIndex = groupToColor.get(c.groupId) ?? 0;
    c.colorIndex = Math.max(0, Math.min(n - 1, c.colorIndex));
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function hexPoints(cx: number, cy: number, radius: number): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = [];
  for (let i = 0; i < 6; i++) {
    const ang = ((-90 + i * 60) * Math.PI) / 180;
    pts.push({ x: cx + Math.cos(ang) * radius, y: cy + Math.sin(ang) * radius });
  }
  return pts;
}

function drawHex(
  ctx: CanvasRenderingContext2D,
  pts: Array<{ x: number; y: number }>,
  fill: string,
  fillOpacity: number,
  stroke: HexGrid2DConfig['hexgrid']['stroke']
): void {
  const p = new Path2D();
  p.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
  p.closePath();

  ctx.fillStyle = rgba(fill, fillOpacity);
  ctx.fill(p);
  if (stroke.enabled && stroke.widthPx > 0 && stroke.opacity > 0) {
    ctx.lineWidth = stroke.widthPx;
    ctx.lineJoin = stroke.join;
    ctx.strokeStyle = rgba(stroke.color, stroke.opacity);
    ctx.stroke(p);
  }
}

function applyGrainOverlay(ctx: CanvasRenderingContext2D, cfg: HexGrid2DConfig): void {
  const amount = clamp(cfg.hexgrid.effect.amount, 0, 1);
  if (!(amount > 0)) return;

  const freq = Math.max(0.1, Number(cfg.hexgrid.effect.frequency) || 1);
  const w = cfg.width;
  const h = cfg.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const seed = cfg.seed >>> 0;

  const scale = 0.6 + freq * 0.55;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const u = Math.floor(x * scale);
      const v = Math.floor(y * scale);
      const n = cellRand01(seed, u, v, 7001);
      const g = (n - 0.5) * 2;
      const k = g * amount * 16;
      d[i + 0] = clamp(d[i + 0] + k, 0, 255);
      d[i + 1] = clamp(d[i + 1] + k, 0, 255);
      d[i + 2] = clamp(d[i + 2] + k, 0, 255);
    }
  }
  ctx.putImageData(img, 0, 0);
}

export function renderHexGrid2DToCanvas(config: HexGrid2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const cells = enumerateCells(config);
  assignGroups(config, cells);
  assignColors(config, cells);

  const R = Math.max(0.5, Number(config.hexgrid.radiusPx) || 1);
  const margin = Math.max(0, Number(config.hexgrid.marginPx) || 0);
  const sw = config.hexgrid.stroke.enabled ? Math.max(0, Number(config.hexgrid.stroke.widthPx) || 0) : 0;
  const drawR = Math.max(0.01, R - margin * 0.5 - sw * 0.5);
  const fillOpacity = clamp(config.hexgrid.fillOpacity, 0, 1);

  const effect: HexEffectKind = config.hexgrid.effect.kind;
  const bevelAmt = clamp(config.hexgrid.effect.amount, 0, 1);
  const seed = config.seed >>> 0;
  const gradAngle = cellRand01(seed, 11, 17, 6001) * Math.PI * 2;
  const gx = Math.cos(gradAngle);
  const gy = Math.sin(gradAngle);

  for (const cell of cells) {
    const idx = cell.colorIndex;
    const base = config.colors[idx] ?? '#ffffff';

    if (effect === 'bevel' && bevelAmt > 0) {
      const pts = hexPoints(cell.cx, cell.cy, drawR);
      const minX = Math.min(...pts.map((p) => p.x));
      const maxX = Math.max(...pts.map((p) => p.x));
      const minY = Math.min(...pts.map((p) => p.y));
      const maxY = Math.max(...pts.map((p) => p.y));
      const x1 = minX + (maxX - minX) * (0.5 - gx * 0.5);
      const y1 = minY + (maxY - minY) * (0.5 - gy * 0.5);
      const x2 = minX + (maxX - minX) * (0.5 + gx * 0.5);
      const y2 = minY + (maxY - minY) * (0.5 + gy * 0.5);

      const grad = ctx.createLinearGradient(x1, y1, x2, y2);
      grad.addColorStop(0, rgba(adjustHex(base, 0.16 * bevelAmt), fillOpacity));
      grad.addColorStop(1, rgba(adjustHex(base, -0.12 * bevelAmt), fillOpacity));

      const p = new Path2D();
      p.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
      p.closePath();

      ctx.fillStyle = grad;
      ctx.fill(p);
      if (config.hexgrid.stroke.enabled && config.hexgrid.stroke.widthPx > 0 && config.hexgrid.stroke.opacity > 0) {
        ctx.lineWidth = config.hexgrid.stroke.widthPx;
        ctx.lineJoin = config.hexgrid.stroke.join;
        ctx.strokeStyle = rgba(config.hexgrid.stroke.color, config.hexgrid.stroke.opacity);
        ctx.stroke(p);
      }
    } else {
      drawHex(ctx, hexPoints(cell.cx, cell.cy, drawR), base, fillOpacity, config.hexgrid.stroke);
    }
  }

  if (effect === 'grain') {
    applyGrainOverlay(ctx, config);
  }

  // Note: emission/bloom on 2D hexgrid is currently not simulated; keep it crisp.
  return c;
}

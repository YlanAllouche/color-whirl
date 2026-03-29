import type { Flowlines2DConfig, PaletteAssignMode } from '../types.js';

type Vec2 = { x: number; y: number };

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
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
  const toHex = (v: number) => v.toString(16).padStart(2, '0');
  return `#${toHex(adj(r))}${toHex(adj(g))}${toHex(adj(b))}`;
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

function cellRand01(seedU32: number, a: number, b: number, channel: number): number {
  let x = (seedU32 ^ hashU32(a * 0x9e3779b1) ^ hashU32(b * 0x85ebca6b) ^ hashU32(channel * 0xc2b2ae35)) >>> 0;
  x = hashU32(x);
  return (x >>> 0) / 4294967296;
}

function smoothstep01(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function valueNoise2D(seedU32: number, x: number, y: number, channel: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;
  const v00 = cellRand01(seedU32, xi, yi, channel);
  const v10 = cellRand01(seedU32, xi + 1, yi, channel);
  const v01 = cellRand01(seedU32, xi, yi + 1, channel);
  const v11 = cellRand01(seedU32, xi + 1, yi + 1, channel);
  const sx = smoothstep01(tx);
  const sy = smoothstep01(ty);
  const a = lerp(v00, v10, sx);
  const b = lerp(v01, v11, sx);
  return lerp(a, b, sy);
}

function fbm2D(seedU32: number, x: number, y: number, frequency: number, octaves: number, channelBase: number): number {
  const oct = Math.max(1, Math.min(16, Math.round(octaves)));
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let f = Math.max(0.000001, frequency);
  for (let i = 0; i < oct; i++) {
    sum += amp * valueNoise2D(seedU32, x * f, y * f, channelBase + i * 97);
    norm += amp;
    amp *= 0.5;
    f *= 2.0;
  }
  return norm > 0 ? sum / norm : 0;
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  const uu = clamp(u, 0, 0.999999999);
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (uu < acc) return i;
  }
  return Math.max(0, wNorm.length - 1);
}

function pickPaletteIndex(seedU32: number, mode: PaletteAssignMode, weightsNorm: number[], i: number, ch: number): number {
  const n = Math.max(1, weightsNorm.length);
  if (mode === 'cycle') return ((i % n) + n) % n;
  return sampleWeightedIndex01(cellRand01(seedU32, i, 0, ch), weightsNorm);
}

export type FlowlineInstance = { points: Vec2[]; colorIndex: number };

export function buildFlowlines2D(config: Flowlines2DConfig): FlowlineInstance[] {
  const w = Math.max(1, Math.round(config.width));
  const h = Math.max(1, Math.round(config.height));

  const flow = (config as any).flowlines;
  const seedU32 = ((config.seed >>> 0) ^ (Number(flow?.seedOffset) || 0)) >>> 0;

  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const weightsNorm = normalizeWeights((flow?.colorWeights ?? []) as number[], Math.max(1, colors.length));
  const paletteMode: PaletteAssignMode = flow?.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  const frequency = Math.max(0.000001, Number(flow?.frequency) || 1);
  const octaves = Math.max(1, Math.min(8, Math.round(Number(flow?.octaves) || 1)));
  const warpAmount = Math.max(0, Number(flow?.warpAmount) || 0);
  const warpFrequency = Math.max(0.000001, Number(flow?.warpFrequency) || 1);
  const strength = Math.max(0, Number(flow?.strength) || 0);
  const epsilonPx = Math.max(0.1, Number(flow?.epsilonPx) || 1);

  const density = clamp01(Number(flow?.density) || 0);
  const spacingPx = Math.max(2, Number(flow?.spacingPx) || 2);
  const marginPx = Math.max(0, Number(flow?.marginPx) || 0);
  const stepPx = Math.max(0.1, Number(flow?.stepPx) || 1);
  const maxSteps = Math.max(1, Math.round(Number(flow?.maxSteps) || 1));
  const maxLines = Math.max(0, Math.round(Number(flow?.maxLines) || 0));
  const minLengthPx = Math.max(0, Number(flow?.minLengthPx) || 0);
  const jitter = clamp01(Number(flow?.jitter) || 0);

  const spawn: 'grid' | 'random' = flow?.spawn === 'random' ? 'random' : 'grid';

  const cellSize = spacingPx;
  const gridW = Math.max(1, Math.ceil(w / cellSize));
  const gridH = Math.max(1, Math.ceil(h / cellSize));
  const occ = new Uint8Array(gridW * gridH);
  const occIdx = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(gridW - 1, Math.floor(x / cellSize)));
    const gy = Math.max(0, Math.min(gridH - 1, Math.floor(y / cellSize)));
    return gy * gridW + gx;
  };
  const isNearOccupied = (x: number, y: number) => {
    const gx = Math.max(0, Math.min(gridW - 1, Math.floor(x / cellSize)));
    const gy = Math.max(0, Math.min(gridH - 1, Math.floor(y / cellSize)));
    for (let oy = -1; oy <= 1; oy++) {
      const yy = gy + oy;
      if (yy < 0 || yy >= gridH) continue;
      for (let ox = -1; ox <= 1; ox++) {
        const xx = gx + ox;
        if (xx < 0 || xx >= gridW) continue;
        if (occ[yy * gridW + xx]) return true;
      }
    }
    return false;
  };
  const markOccupied = (x: number, y: number) => {
    occ[occIdx(x, y)] = 1;
  };

  const baseScale = Math.max(1, Math.min(w, h));

  // Cache the expensive scalar field on a coarse grid and bilinear-sample.
  // This keeps the curl field deterministic while reducing noise calls per step.
  const psiGridStepPx = clamp(spacingPx * 1.6, 6, 28);
  const psiGridW = Math.max(2, Math.ceil(w / psiGridStepPx) + 2);
  const psiGridH = Math.max(2, Math.ceil(h / psiGridStepPx) + 2);
  const psiGrid = new Float32Array(psiGridW * psiGridH);
  psiGrid.fill(Number.NaN);
  const psiIdx = (gx: number, gy: number) => gy * psiGridW + gx;

  const psiNoiseAt = (xPx: number, yPx: number): number => {
    const nx0 = (xPx / baseScale) * frequency;
    const ny0 = (yPx / baseScale) * frequency;

    let wx = 0;
    let wy = 0;
    if (warpAmount > 0) {
      wx = (fbm2D(seedU32 ^ 0x1b873593, nx0, ny0, warpFrequency, Math.max(1, Math.min(6, octaves)), 2001) - 0.5) * 2;
      wy = (fbm2D(seedU32 ^ 0x85ebca6b, nx0 + 11.7, ny0 - 7.3, warpFrequency, Math.max(1, Math.min(6, octaves)), 3001) - 0.5) * 2;
    }
    const nx = nx0 + wx * warpAmount;
    const ny = ny0 + wy * warpAmount;
    return fbm2D(seedU32, nx, ny, 1.0, octaves, 1001);
  };

  const psiGridAt = (gx: number, gy: number): number => {
    const x = gx * psiGridStepPx;
    const y = gy * psiGridStepPx;
    const i = psiIdx(gx, gy);
    const cur = psiGrid[i];
    if (!Number.isNaN(cur)) return cur;
    const v = psiNoiseAt(x, y);
    psiGrid[i] = v;
    return v;
  };

  const psiAt = (xPx: number, yPx: number): number => {
    const x = clamp(xPx, 0, w);
    const y = clamp(yPx, 0, h);
    const gx0 = Math.floor(x / psiGridStepPx);
    const gy0 = Math.floor(y / psiGridStepPx);
    const gx1 = Math.max(0, Math.min(psiGridW - 1, gx0 + 1));
    const gy1 = Math.max(0, Math.min(psiGridH - 1, gy0 + 1));
    const gx = Math.max(0, Math.min(psiGridW - 1, gx0));
    const gy = Math.max(0, Math.min(psiGridH - 1, gy0));

    const fx = (x - gx * psiGridStepPx) / psiGridStepPx;
    const fy = (y - gy * psiGridStepPx) / psiGridStepPx;

    const v00 = psiGridAt(gx, gy);
    const v10 = psiGridAt(gx1, gy);
    const v01 = psiGridAt(gx, gy1);
    const v11 = psiGridAt(gx1, gy1);

    const a = lerp(v00, v10, fx);
    const b = lerp(v01, v11, fx);
    return lerp(a, b, fy);
  };

  const fieldAt = (xPx: number, yPx: number): Vec2 => {
    const e = epsilonPx;
    const ppx = psiAt(xPx + e, yPx);
    const pmx = psiAt(xPx - e, yPx);
    const ppy = psiAt(xPx, yPx + e);
    const pmy = psiAt(xPx, yPx - e);
    const dpsiDx = (ppx - pmx) / (2 * e);
    const dpsiDy = (ppy - pmy) / (2 * e);

    let vx = dpsiDy;
    let vy = -dpsiDx;
    const len = Math.hypot(vx, vy);
    if (len < 1e-9) return { x: 0, y: 0 };
    vx = (vx / len) * strength;
    vy = (vy / len) * strength;
    return { x: vx, y: vy };
  };

  const integrate = (seed: Vec2): Vec2[] => {
    // IMPORTANT: do not mark occupancy while integrating, otherwise the line blocks itself
    // (stepPx is typically < spacingPx). We only commit occupancy after the line is accepted.
    let p: Vec2 = { x: seed.x, y: seed.y };
    const pts: Vec2[] = [{ x: p.x, y: p.y }];
    for (let s = 0; s < maxSteps; s++) {
      const v1 = fieldAt(p.x, p.y);
      if (Math.hypot(v1.x, v1.y) < 1e-7) break;
      const mid = { x: p.x + v1.x * stepPx * 0.5, y: p.y + v1.y * stepPx * 0.5 };
      const v2 = fieldAt(mid.x, mid.y);
      const next = { x: p.x + v2.x * stepPx, y: p.y + v2.y * stepPx };
      if (next.x < marginPx || next.x > w - marginPx || next.y < marginPx || next.y > h - marginPx) break;
      if (isNearOccupied(next.x, next.y)) break;
      p = next;
      pts.push({ x: p.x, y: p.y });
    }
    return pts;
  };

  const commitOccupancy = (pts: Vec2[]) => {
    // Mark points along the path at roughly `spacingPx` arc-length intervals.
    if (pts.length === 0) return;
    let acc = 0;
    markOccupied(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1];
      const b = pts[i];
      const d = Math.hypot(b.x - a.x, b.y - a.y);
      acc += d;
      if (acc >= spacingPx * 0.75) {
        acc = 0;
        markOccupied(b.x, b.y);
      }
    }
  };

  const instances: FlowlineInstance[] = [];
  const addLineFromSeed = (seed: Vec2, lineIndex: number) => {
    if (instances.length >= maxLines) return;
    if (seed.x < marginPx || seed.x > w - marginPx || seed.y < marginPx || seed.y > h - marginPx) return;
    if (isNearOccupied(seed.x, seed.y)) return;

    const pts = integrate(seed);
    if (pts.length < 2) return;
    let len = 0;
    for (let i = 1; i < pts.length; i++) {
      len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    }
    if (len < minLengthPx) return;

    const colorIndex = pickPaletteIndex(seedU32, paletteMode, weightsNorm, lineIndex, 9001);
    commitOccupancy(pts);
    instances.push({ points: pts, colorIndex });
  };

  const spawnStep = clamp(lerp(38, 7, density), 4, 120);
  let lineIndex = 0;

  if (spawn === 'grid') {
    const cols = Math.max(1, Math.floor((w - marginPx * 2) / spawnStep));
    const rows = Math.max(1, Math.floor((h - marginPx * 2) / spawnStep));
    for (let gy = 0; gy <= rows; gy++) {
      for (let gx = 0; gx <= cols; gx++) {
        if (instances.length >= maxLines) break;
        const u = cellRand01(seedU32, gx, gy, 7001);
        const v = cellRand01(seedU32, gx, gy, 7002);
        const jx = (u - 0.5) * spawnStep * jitter;
        const jy = (v - 0.5) * spawnStep * jitter;
        const x = marginPx + gx * spawnStep + jx;
        const y = marginPx + gy * spawnStep + jy;
        addLineFromSeed({ x, y }, lineIndex++);
      }
      if (instances.length >= maxLines) break;
    }
  } else {
    const attempts = Math.max(1, Math.round(maxLines * 3));
    for (let i = 0; i < attempts; i++) {
      if (instances.length >= maxLines) break;
      const rx = cellRand01(seedU32, i, 0, 7101);
      const ry = cellRand01(seedU32, i, 0, 7102);
      const x = marginPx + rx * (w - marginPx * 2);
      const y = marginPx + ry * (h - marginPx * 2);
      addLineFromSeed({ x, y }, lineIndex++);
    }
  }

  return instances;
}

export function renderFlowlines2DToCanvas(config: Flowlines2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const flow = (config as any).flowlines;
  const strokeWidth = Math.max(0.05, Number(flow?.stroke?.widthPx) || 1);
  const baseOpacity = clamp01(Number(flow?.stroke?.opacity) || 0);
  const taper = clamp01(Number(flow?.stroke?.taper) || 0);
  const colorJitter = clamp01(Number(flow?.colorJitter) || 0);

  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];

  const instances = buildFlowlines2D({ ...config, width: c.width, height: c.height } as any);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.lineWidth = strokeWidth;

  const fade = (t: number): number => {
    if (!(taper > 0)) return 1;
    const edge = Math.min(t, 1 - t);
    const k = clamp(edge / Math.max(1e-6, taper), 0, 1);
    return smoothstep01(k);
  };

  for (let li = 0; li < instances.length; li++) {
    const inst = instances[li];
    const base = colors[inst.colorIndex % colors.length] ?? '#ffffff';
    const jitterK = colorJitter > 0 ? (cellRand01((config.seed >>> 0) ^ 0xabc123, li, 0, 9901) - 0.5) * 2 * 0.16 * colorJitter : 0;
    const col = jitterK !== 0 ? adjustHex(base, jitterK) : base;

    const pts = inst.points;
    if (pts.length < 2) continue;

    if (!(taper > 0)) {
      ctx.globalAlpha = baseOpacity;
      ctx.strokeStyle = rgba(col, 1);
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
      continue;
    }

    // Tapered: per-segment alpha.
    ctx.strokeStyle = rgba(col, 1);
    for (let i = 1; i < pts.length; i++) {
      const t = i / Math.max(1, pts.length - 1);
      ctx.globalAlpha = baseOpacity * fade(t);
      ctx.beginPath();
      ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
      ctx.lineTo(pts[i].x, pts[i].y);
      ctx.stroke();
    }
  }

  ctx.globalAlpha = 1;
  return c;
}

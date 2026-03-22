import type { PaletteAssignMode, Ridges2DConfig } from '../types.js';

type Vec2 = { x: number; y: number };
type Segment = { a: Vec2; b: Vec2 };

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

function smoothstep(t: number): number {
  const x = clamp01(t);
  return x * x * (3 - 2 * x);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function applyContrastBias(value: number, contrast: number, bias: number): number {
  const c = Math.max(0.25, Math.min(4, contrast));
  const b = clamp(bias, -0.5, 0.5);
  const scaled = 0.5 + (value - 0.5) * c;
  return clamp01(scaled + b);
}

function valueNoise2D(seed: number, x: number, y: number, channel: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const tx = x - xi;
  const ty = y - yi;

  const v00 = cellRand01(seed, xi, yi, channel);
  const v10 = cellRand01(seed, xi + 1, yi, channel);
  const v01 = cellRand01(seed, xi, yi + 1, channel);
  const v11 = cellRand01(seed, xi + 1, yi + 1, channel);

  const sx = smoothstep(tx);
  const sy = smoothstep(ty);

  const a = lerp(v00, v10, sx);
  const b = lerp(v01, v11, sx);
  return lerp(a, b, sy);
}

function fbm2D(
  seed: number,
  x: number,
  y: number,
  frequency: number,
  octaves: number,
  channelBase: number,
  octaveScale?: (i: number, octaves: number) => number
): number {
  const oct = Math.max(1, Math.min(16, Math.round(octaves)));
  let amp = 1;
  let sum = 0;
  let norm = 0;
  let f = Math.max(0.000001, frequency);
  for (let i = 0; i < oct; i++) {
    const scale = octaveScale ? Math.max(0, octaveScale(i, oct)) : 1;
    const weight = amp * scale;
    if (weight > 0) {
      sum += weight * valueNoise2D(seed, x * f, y * f, channelBase + i * 97);
      norm += weight;
    }
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

function sampleWeightedIndex01(u01: number, weightsNorm: number[]): number {
  const u = Math.max(0, Math.min(0.999999999, u01));
  let acc = 0;
  for (let i = 0; i < weightsNorm.length; i++) {
    acc += weightsNorm[i];
    if (u < acc) return i;
  }
  return Math.max(0, weightsNorm.length - 1);
}

function pickPaletteIndex(seedU32: number, mode: PaletteAssignMode, weightsNorm: number[], i: number, ch: number): number {
  const n = Math.max(1, weightsNorm.length);
  if (mode === 'cycle') return ((i % n) + n) % n;
  return sampleWeightedIndex01(cellRand01(seedU32, i, 0, ch), weightsNorm);
}

function blurField(values: Float32Array, w: number, h: number, iterations: number): void {
  const it = Math.max(0, Math.min(8, Math.round(iterations)));
  if (it <= 0) return;

  const tmp = new Float32Array(values.length);
  const idx = (x: number, y: number) => y * w + x;

  for (let k = 0; k < it; k++) {
    // Horizontal
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const x0 = Math.max(0, x - 1);
        const x1 = x;
        const x2 = Math.min(w - 1, x + 1);
        tmp[idx(x, y)] = (values[idx(x0, y)] + values[idx(x1, y)] + values[idx(x2, y)]) / 3;
      }
    }
    // Vertical
    for (let y = 0; y < h; y++) {
      const y0 = Math.max(0, y - 1);
      const y1 = y;
      const y2 = Math.min(h - 1, y + 1);
      for (let x = 0; x < w; x++) {
        values[idx(x, y)] = (tmp[idx(x, y0)] + tmp[idx(x, y1)] + tmp[idx(x, y2)]) / 3;
      }
    }
  }
}

function segmentKey(p: Vec2): string {
  // Quantize to 1/1024px to robustly match endpoints.
  const kx = Math.round(p.x * 1024);
  const ky = Math.round(p.y * 1024);
  return `${kx},${ky}`;
}

function connectSegmentsToPolylines(segments: Segment[]): Vec2[][] {
  if (segments.length === 0) return [];
  const used = new Uint8Array(segments.length);

  const adjacency = new Map<string, Array<{ si: number; end: 0 | 1 }>>();
  const pushAdj = (p: Vec2, si: number, end: 0 | 1) => {
    const k = segmentKey(p);
    const arr = adjacency.get(k);
    if (arr) arr.push({ si, end });
    else adjacency.set(k, [{ si, end }]);
  };

  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    pushAdj(s.a, i, 0);
    pushAdj(s.b, i, 1);
  }

  const takeNext = (p: Vec2): { si: number; next: Vec2 } | null => {
    const arr = adjacency.get(segmentKey(p));
    if (!arr) return null;
    for (const it of arr) {
      if (used[it.si]) continue;
      const seg = segments[it.si];
      used[it.si] = 1;
      return it.end === 0 ? { si: it.si, next: seg.b } : { si: it.si, next: seg.a };
    }
    return null;
  };

  const out: Vec2[][] = [];

  for (let i = 0; i < segments.length; i++) {
    if (used[i]) continue;
    used[i] = 1;
    const s = segments[i];
    const line: Vec2[] = [{ x: s.a.x, y: s.a.y }, { x: s.b.x, y: s.b.y }];

    // Extend forward
    while (true) {
      const cur = line[line.length - 1];
      const nxt = takeNext(cur);
      if (!nxt) break;
      line.push({ x: nxt.next.x, y: nxt.next.y });
    }

    // Extend backward
    while (true) {
      const cur = line[0];
      const nxt = takeNext(cur);
      if (!nxt) break;
      line.unshift({ x: nxt.next.x, y: nxt.next.y });
    }

    out.push(line);
  }

  return out;
}

function chaikinSmooth(points: Vec2[], iterations: number): Vec2[] {
  let pts = points;
  const it = Math.max(0, Math.min(3, Math.round(iterations)));
  for (let k = 0; k < it; k++) {
    if (pts.length < 3) return pts;
    const next: Vec2[] = [];
    next.push(pts[0]);
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i];
      const b = pts[i + 1];
      const q = { x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) };
      const r = { x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) };
      next.push(q, r);
    }
    next.push(pts[pts.length - 1]);
    pts = next;
  }
  return pts;
}

export function buildRidges2DFieldGrid(config: Ridges2DConfig): {
  values01: Float32Array;
  gridW: number;
  gridH: number;
  stepPx: number;
} {
  const seed = config.seed >>> 0;
  const stepPx = Math.max(2, Math.round(Number(config.ridges.gridStepPx) || 6));
  const gridW = Math.floor(config.width / stepPx) + 1;
  const gridH = Math.floor(config.height / stepPx) + 1;
  const values = new Float32Array(gridW * gridH);

  const baseScale = Math.max(1, Math.min(config.width, config.height));
  const freq = Math.max(0.000001, Number(config.ridges.frequency) || 1);
  const octaves = Math.max(1, Math.round(Number(config.ridges.octaves) || 1));
  const warpAmount = Math.max(0, Number(config.ridges.warpAmount) || 0);
  const warpFreq = Math.max(0.000001, Number(config.ridges.warpFrequency) || 1);
  const detailFreq = Math.max(0.000001, Number(config.ridges.detailFrequency) || freq * 2);
  const detailAmp = clamp01(Number(config.ridges.detailAmplitude) || 0);
  const warpDepth = clamp01(Number(config.ridges.warpDepth) || 0);
  const contrast = Number(config.ridges.contrast) || 1;
  const bias = Number(config.ridges.bias) || 0;

  let vMin = Number.POSITIVE_INFINITY;
  let vMax = Number.NEGATIVE_INFINITY;

  for (let gy = 0; gy < gridH; gy++) {
    const yPx = gy * stepPx;
    const ny0 = (yPx / baseScale) * freq;
    for (let gx = 0; gx < gridW; gx++) {
      const xPx = gx * stepPx;
      const nx0 = (xPx / baseScale) * freq;

      // Domain warp in noise space with depth mixing
      const wxBase =
        warpAmount > 0 ? (fbm2D(seed, nx0, ny0, warpFreq, Math.max(1, Math.round(octaves)), 2001) - 0.5) * 2 : 0;
      const wyBase =
        warpAmount > 0 ? (fbm2D(seed, nx0 + 14.1, ny0 - 8.2, warpFreq, Math.max(1, Math.round(octaves)), 3001) - 0.5) * 2 : 0;
      const wxDetail =
        warpDepth > 0
          ? (fbm2D(seed ^ 0x3213f0b, nx0 * 1.2, ny0 * 0.8, warpFreq * 2.5, Math.max(1, Math.round(octaves)), 4001) - 0.5) * 2
          : 0;
      const wyDetail =
        warpDepth > 0
          ? (fbm2D(seed ^ 0x432f5a1, nx0 * 0.7 + 7.3, ny0 * 1.3 - 2.1, warpFreq * 1.8, Math.max(1, Math.round(octaves)), 5001) - 0.5) * 2
          : 0;

      const wx = warpDepth > 0 ? wxBase * (1 - warpDepth) + wxDetail * warpDepth : wxBase;
      const wy = warpDepth > 0 ? wyBase * (1 - warpDepth) + wyDetail * warpDepth : wyBase;

      const nx = nx0 + wx * warpAmount;
      const ny = ny0 + wy * warpAmount;

      // Height field before detail blending
      let value = fbm2D(seed, nx, ny, 1.0, octaves, 1001);
      if (detailAmp > 0 && detailFreq > 0) {
        const detailOctaves = Math.max(1, Math.round(octaves * 1.3));
        const detail = fbm2D(seed ^ 0x5a1d2c7, nx, ny, detailFreq, detailOctaves, 4101);
        value += (detail - 0.5) * detailAmp;
      }
      values[gy * gridW + gx] = value;
      if (value < vMin) vMin = value;
      if (value > vMax) vMax = value;
    }
  }

  // Normalize to [0,1]
  const denom = Math.max(1e-9, vMax - vMin);
  for (let i = 0; i < values.length; i++) {
    values[i] = clamp01((values[i] - vMin) / denom);
  }

  const smooth = clamp01(Number(config.ridges.smoothing) || 0);
  if (smooth > 0) {
    const it = Math.max(0, Math.min(6, Math.round(smooth * 4)));
    blurField(values, gridW, gridH, it);
  }

  for (let i = 0; i < values.length; i++) {
    values[i] = applyContrastBias(values[i], contrast, bias);
  }

  return { values01: values, gridW, gridH, stepPx };
}

export function buildRidges2DContourPolylines(options: {
  values01: Float32Array;
  gridW: number;
  gridH: number;
  stepPx: number;
  levels: number;
  smoothing: number;
  seed: number;
  levelJitter: number;
}): Vec2[][][] {
  const { values01, gridW, gridH, stepPx } = options;
  const levels = Math.max(1, Math.round(options.levels));
  const polySmooth = clamp01(options.smoothing);
  const polySmoothIts = Math.max(0, Math.min(2, Math.round(polySmooth * 2)));
  const jitterAmount = clamp01(options.levelJitter);
  const seedU32 = options.seed >>> 0;

  const idx = (x: number, y: number) => y * gridW + x;

  const edgeT = (a: number, b: number, t: number): number => {
    const d = b - a;
    if (Math.abs(d) < 1e-9) return 0.5;
    return clamp01((t - a) / d);
  };

  const perLevel: Vec2[][][] = [];

  for (let li = 0; li < levels; li++) {
    const baseT = (li + 1) / (levels + 1);
    const jitter =
      jitterAmount > 0 ? (cellRand01(seedU32, li, 0, 6001) * 2 - 1) * jitterAmount : 0;
    const t = clamp01(baseT + jitter);
    const segments: Segment[] = [];

    for (let y = 0; y < gridH - 1; y++) {
      const py = y * stepPx;
      for (let x = 0; x < gridW - 1; x++) {
        const px = x * stepPx;

        const a = values01[idx(x, y)];
        const b = values01[idx(x + 1, y)];
        const c = values01[idx(x + 1, y + 1)];
        const d = values01[idx(x, y + 1)];

        const ia = a > t ? 1 : 0;
        const ib = b > t ? 2 : 0;
        const ic = c > t ? 4 : 0;
        const id = d > t ? 8 : 0;
        const code = ia | ib | ic | id;
        if (code === 0 || code === 15) continue;

        const top: Vec2 = { x: px + stepPx * edgeT(a, b, t), y: py };
        const right: Vec2 = { x: px + stepPx, y: py + stepPx * edgeT(b, c, t) };
        const bottom: Vec2 = { x: px + stepPx * edgeT(d, c, t), y: py + stepPx };
        const left: Vec2 = { x: px, y: py + stepPx * edgeT(a, d, t) };

        // Ambiguous cases (5/10): use center value as a simple decider.
        const center = (a + b + c + d) * 0.25;
        const highCenter = center > t;

        switch (code) {
          case 1:
            segments.push({ a: left, b: top });
            break;
          case 2:
            segments.push({ a: top, b: right });
            break;
          case 3:
            segments.push({ a: left, b: right });
            break;
          case 4:
            segments.push({ a: right, b: bottom });
            break;
          case 5:
            if (highCenter) {
              segments.push({ a: top, b: right });
              segments.push({ a: left, b: bottom });
            } else {
              segments.push({ a: left, b: top });
              segments.push({ a: right, b: bottom });
            }
            break;
          case 6:
            segments.push({ a: top, b: bottom });
            break;
          case 7:
            segments.push({ a: left, b: bottom });
            break;
          case 8:
            segments.push({ a: bottom, b: left });
            break;
          case 9:
            segments.push({ a: top, b: bottom });
            break;
          case 10:
            if (highCenter) {
              segments.push({ a: left, b: top });
              segments.push({ a: right, b: bottom });
            } else {
              segments.push({ a: top, b: right });
              segments.push({ a: left, b: bottom });
            }
            break;
          case 11:
            segments.push({ a: right, b: bottom });
            break;
          case 12:
            segments.push({ a: right, b: left });
            break;
          case 13:
            segments.push({ a: top, b: right });
            break;
          case 14:
            segments.push({ a: left, b: top });
            break;
        }
      }
    }

    let polylines = connectSegmentsToPolylines(segments);
    if (polySmoothIts > 0) {
      polylines = polylines.map((p) => chaikinSmooth(p, polySmoothIts));
    }

    perLevel.push(polylines);
  }

  return perLevel;
}

export function renderRidges2DToCanvas(config: Ridges2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const ridges = config.ridges;
  const { values01, gridW, gridH, stepPx } = buildRidges2DFieldGrid({ ...config, width: c.width, height: c.height });
  const levels = Math.max(1, Math.round(Number(ridges.levels) || 1));

  const palette = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const weightsNorm = normalizeWeights(ridges.colorWeights ?? [], Math.max(1, palette.length));
  const seed = config.seed >>> 0;
  const paletteMode: PaletteAssignMode = ridges.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  if (ridges.fillBands?.enabled) {
    const op = clamp01(Number(ridges.fillBands.opacity) || 0);
    if (op > 0) {
      // Fill per grid cell using the average of its corners.
      const idx = (x: number, y: number) => y * gridW + x;
      for (let y = 0; y < gridH - 1; y++) {
        const py = y * stepPx;
        for (let x = 0; x < gridW - 1; x++) {
          const px = x * stepPx;
          const a = values01[idx(x, y)];
          const b = values01[idx(x + 1, y)];
          const cc = values01[idx(x + 1, y + 1)];
          const d = values01[idx(x, y + 1)];
          const v = (a + b + cc + d) * 0.25;
          const band = Math.max(0, Math.min(levels - 1, Math.floor(v * levels)));
          const ci = pickPaletteIndex(seed, paletteMode, weightsNorm, band, 9101);
          const col = palette[ci] ?? '#ffffff';
          ctx.fillStyle = rgba(col, op);
          ctx.fillRect(px, py, stepPx, stepPx);
        }
      }
    }
  }

  const polylinesByLevel = buildRidges2DContourPolylines({
    values01,
    gridW,
    gridH,
    stepPx,
    levels,
    smoothing: clamp01(Number(ridges.smoothing) || 0),
    seed,
    levelJitter: clamp01(Number(ridges.levelJitter) || 0)
  });

  const lineOpacity = clamp01(Number(ridges.lineOpacity) || 0);
  const lineWidth = Math.max(0.1, Number(ridges.lineWidthPx) || 1);
  if (lineOpacity > 0 && lineWidth > 0) {
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.lineWidth = lineWidth;

    for (let li = 0; li < polylinesByLevel.length; li++) {
      const ci = pickPaletteIndex(seed, paletteMode, weightsNorm, li, 9201);
      const col = palette[ci] ?? '#ffffff';
      ctx.strokeStyle = rgba(col, lineOpacity);

      ctx.beginPath();
      const polylines = polylinesByLevel[li];
      for (const p of polylines) {
        if (p.length < 2) continue;
        ctx.moveTo(p[0].x, p[0].y);
        for (let i = 1; i < p.length; i++) {
          ctx.lineTo(p[i].x, p[i].y);
        }
      }
      ctx.stroke();
    }
  }

  return c;
}

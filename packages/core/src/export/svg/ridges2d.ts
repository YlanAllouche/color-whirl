import type { WallpaperConfig } from '../../types.js';
import { cellRand01, clamp, clamp01, normalizeWeights, sampleWeightedIndex01, svgEnd, svgStart } from './utils.js';

export function generateRidges2DSVG(config: Extract<WallpaperConfig, { type: 'ridges2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const palette = colors.length > 0 ? colors : ['#ffffff'];
  const n = Math.max(1, palette.length);

  const stepPx = Math.max(2, Math.round(Number(config.ridges.gridStepPx) || 6));
  const gridW = Math.floor(width / stepPx) + 1;
  const gridH = Math.floor(height / stepPx) + 1;

  const levels = Math.max(1, Math.round(Number(config.ridges.levels) || 1));
  const lineOpacity = clamp01(Number(config.ridges.lineOpacity) || 0);
  const lineWidth = Math.max(0.1, Number(config.ridges.lineWidthPx) || 1);
  const smoothing = clamp01(Number(config.ridges.smoothing) || 0);
  const blurIts = Math.max(0, Math.min(6, Math.round(smoothing * 4)));
  const polyIts = Math.max(0, Math.min(2, Math.round(smoothing * 2)));

  const seed = config.seed >>> 0;
  const weightsNorm = normalizeWeights(config.ridges.colorWeights ?? [], n);
  const paletteMode = config.ridges.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  const smoothstep = (t: number) => {
    const x = clamp01(t);
    return x * x * (3 - 2 * x);
  };

  const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

  const valueNoise2D = (x: number, y: number, ch: number): number => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const tx = x - xi;
    const ty = y - yi;
    const v00 = cellRand01(seed, xi, yi, ch);
    const v10 = cellRand01(seed, xi + 1, yi, ch);
    const v01 = cellRand01(seed, xi, yi + 1, ch);
    const v11 = cellRand01(seed, xi + 1, yi + 1, ch);
    const sx = smoothstep(tx);
    const sy = smoothstep(ty);
    const a = lerp(v00, v10, sx);
    const b = lerp(v01, v11, sx);
    return lerp(a, b, sy);
  };

  const fbm2D = (x: number, y: number, frequency: number, octaves: number, chBase: number): number => {
    const oct = Math.max(1, Math.min(16, Math.round(octaves)));
    let amp = 1;
    let sum = 0;
    let norm = 0;
    let f = Math.max(0.000001, frequency);
    for (let i = 0; i < oct; i++) {
      sum += amp * valueNoise2D(x * f, y * f, chBase + i * 97);
      norm += amp;
      amp *= 0.5;
      f *= 2.0;
    }
    return norm > 0 ? sum / norm : 0;
  };

  const baseScale = Math.max(1, Math.min(width, height));
  const freq = Math.max(0.000001, Number(config.ridges.frequency) || 1);
  const octaves = Math.max(1, Math.round(Number(config.ridges.octaves) || 1));
  const warpAmount = Math.max(0, Number(config.ridges.warpAmount) || 0);
  const warpFreq = Math.max(0.000001, Number(config.ridges.warpFrequency) || 1);

  const field = new Float32Array(gridW * gridH);
  let vMin = Number.POSITIVE_INFINITY;
  let vMax = Number.NEGATIVE_INFINITY;
  for (let gy = 0; gy < gridH; gy++) {
    const yPx = gy * stepPx;
    const ny0 = (yPx / baseScale) * freq;
    for (let gx = 0; gx < gridW; gx++) {
      const xPx = gx * stepPx;
      const nx0 = (xPx / baseScale) * freq;

      const wx =
        warpAmount > 0 ? (fbm2D(nx0, ny0, warpFreq, Math.max(1, Math.min(6, octaves)), 2001) - 0.5) * 2 : 0;
      const wy =
        warpAmount > 0 ? (fbm2D(nx0 + 13.1, ny0 - 9.2, warpFreq, Math.max(1, Math.min(6, octaves)), 3001) - 0.5) * 2 : 0;
      const nx = nx0 + wx * warpAmount;
      const ny = ny0 + wy * warpAmount;

      const v = fbm2D(nx, ny, 1.0, octaves, 1001);
      field[gy * gridW + gx] = v;
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
  }
  const denom = Math.max(1e-9, vMax - vMin);
  for (let i = 0; i < field.length; i++) field[i] = clamp01((field[i] - vMin) / denom);

  if (blurIts > 0) {
    const tmp = new Float32Array(field.length);
    const idx = (x: number, y: number) => y * gridW + x;
    for (let k = 0; k < blurIts; k++) {
      for (let y = 0; y < gridH; y++) {
        for (let x = 0; x < gridW; x++) {
          const x0 = Math.max(0, x - 1);
          const x1 = x;
          const x2 = Math.min(gridW - 1, x + 1);
          tmp[idx(x, y)] = (field[idx(x0, y)] + field[idx(x1, y)] + field[idx(x2, y)]) / 3;
        }
      }
      for (let y = 0; y < gridH; y++) {
        const y0 = Math.max(0, y - 1);
        const y1 = y;
        const y2 = Math.min(gridH - 1, y + 1);
        for (let x = 0; x < gridW; x++) {
          field[idx(x, y)] = (tmp[idx(x, y0)] + tmp[idx(x, y1)] + tmp[idx(x, y2)]) / 3;
        }
      }
    }
  }

  type Vec2 = { x: number; y: number };
  type Segment = { a: Vec2; b: Vec2 };
  const segmentKey = (p: Vec2) => `${Math.round(p.x * 1024)},${Math.round(p.y * 1024)}`;
  const connectSegments = (segments: Segment[]): Vec2[][] => {
    if (segments.length === 0) return [];
    const used = new Uint8Array(segments.length);
    const adj = new Map<string, Array<{ si: number; end: 0 | 1 }>>();
    const pushAdj = (p: Vec2, si: number, end: 0 | 1) => {
      const k = segmentKey(p);
      const arr = adj.get(k);
      if (arr) arr.push({ si, end });
      else adj.set(k, [{ si, end }]);
    };
    for (let i = 0; i < segments.length; i++) {
      pushAdj(segments[i].a, i, 0);
      pushAdj(segments[i].b, i, 1);
    }
    const takeNext = (p: Vec2): Vec2 | null => {
      const arr = adj.get(segmentKey(p));
      if (!arr) return null;
      for (const it of arr) {
        if (used[it.si]) continue;
        used[it.si] = 1;
        const s = segments[it.si];
        return it.end === 0 ? s.b : s.a;
      }
      return null;
    };

    const out: Vec2[][] = [];
    for (let i = 0; i < segments.length; i++) {
      if (used[i]) continue;
      used[i] = 1;
      const s = segments[i];
      const line: Vec2[] = [{ x: s.a.x, y: s.a.y }, { x: s.b.x, y: s.b.y }];
      while (true) {
        const nxt = takeNext(line[line.length - 1]);
        if (!nxt) break;
        line.push({ x: nxt.x, y: nxt.y });
      }
      while (true) {
        const nxt = takeNext(line[0]);
        if (!nxt) break;
        line.unshift({ x: nxt.x, y: nxt.y });
      }
      out.push(line);
    }
    return out;
  };

  const chaikin = (pts: Vec2[], its: number): Vec2[] => {
    let p = pts;
    const it = Math.max(0, Math.min(3, Math.round(its)));
    for (let k = 0; k < it; k++) {
      if (p.length < 3) return p;
      const next: Vec2[] = [];
      next.push(p[0]);
      for (let i = 0; i < p.length - 1; i++) {
        const a = p[i];
        const b = p[i + 1];
        next.push(
          { x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) },
          { x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) }
        );
      }
      next.push(p[p.length - 1]);
      p = next;
    }
    return p;
  };

  const pickIndex = (i: number, ch: number): number => {
    if (paletteMode === 'cycle') return ((i % n) + n) % n;
    return sampleWeightedIndex01(cellRand01(seed, i, 0, ch), weightsNorm);
  };

  const idx = (x: number, y: number) => y * gridW + x;
  const edgeT = (a: number, b: number, t: number): number => {
    const d = b - a;
    if (Math.abs(d) < 1e-9) return 0.5;
    return clamp01((t - a) / d);
  };

  let svg = svgStart(width, height, backgroundColor);
  if (!(lineOpacity > 0) || !(lineWidth > 0)) {
    svg += svgEnd();
    return svg;
  }

  for (let li = 0; li < levels; li++) {
    const t = (li + 1) / (levels + 1);
    const segments: Segment[] = [];

    for (let y = 0; y < gridH - 1; y++) {
      const py = y * stepPx;
      for (let x = 0; x < gridW - 1; x++) {
        const px = x * stepPx;
        const a = field[idx(x, y)];
        const b = field[idx(x + 1, y)];
        const c = field[idx(x + 1, y + 1)];
        const d = field[idx(x, y + 1)];

        const code = (a > t ? 1 : 0) | (b > t ? 2 : 0) | (c > t ? 4 : 0) | (d > t ? 8 : 0);
        if (code === 0 || code === 15) continue;

        const top: Vec2 = { x: px + stepPx * edgeT(a, b, t), y: py };
        const right: Vec2 = { x: px + stepPx, y: py + stepPx * edgeT(b, c, t) };
        const bottom: Vec2 = { x: px + stepPx * edgeT(d, c, t), y: py + stepPx };
        const left: Vec2 = { x: px, y: py + stepPx * edgeT(a, d, t) };
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

    let polylines = connectSegments(segments);
    if (polyIts > 0) polylines = polylines.map((p) => chaikin(p, polyIts));

    const ci = pickIndex(li, 9201);
    const col = palette[ci] ?? '#ffffff';

    for (const p of polylines) {
      if (p.length < 2) continue;
      const d =
        'M ' +
        p
          .map((pt, idx2) => {
            const cmd = idx2 === 0 ? '' : 'L ';
            return `${cmd}${pt.x.toFixed(3)} ${pt.y.toFixed(3)}`;
          })
          .join(' ');
      svg += `  <path d="${d}" fill="none" stroke="${col}" stroke-width="${lineWidth}" stroke-opacity="${lineOpacity}" stroke-linejoin="round" stroke-linecap="round"/>\n`;
    }
  }

  svg += svgEnd();
  return svg;
}

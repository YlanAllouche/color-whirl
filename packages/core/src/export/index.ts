import type { ExportOptions, WallpaperConfig } from '../types.js';
import { extractSvgRootAttributes, stripSvgPresentationAttributes, validateSvgSource } from '../svg-utils.js';

export interface ExportResult {
  data: Uint8Array | string;
  format: string;
  mimeType: string;
}

export async function exportToPNG(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/png', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export PNG');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'png',
    mimeType: 'image/png'
  };
}

export async function exportToJPG(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export JPG');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'jpg',
    mimeType: 'image/jpeg'
  };
}

export async function exportToWebP(
  canvas: HTMLCanvasElement,
  options: ExportOptions
): Promise<ExportResult> {
  const quality = options.quality ?? 0.95;
  
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/webp', quality);
  });
  
  if (!blob) {
    throw new Error('Failed to export WebP');
  }
  
  const arrayBuffer = await blob.arrayBuffer();
  
  return {
    data: new Uint8Array(arrayBuffer),
    format: 'webp',
    mimeType: 'image/webp'
  };
}

export async function exportToSVG(config: WallpaperConfig): Promise<ExportResult> {
  const svgContent = generateSVGContent(config);
  return { data: svgContent, format: 'svg', mimeType: 'image/svg+xml' };
}

function svgStart(width: number, height: number, backgroundColor: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">\n  <rect width="100%" height="100%" fill="${backgroundColor}"/>\n`;
}

function svgEnd(): string {
  return '</svg>';
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

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
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

function generateSVGContent(config: WallpaperConfig): string {
  switch (config.type) {
    case 'popsicle':
      return generatePopsicleSVG(config);
    case 'circles2d':
      return generateCircles2DSVG(config);
    case 'polygon2d':
      return generatePolygon2DSVG(config);
    case 'svg2d':
      return generateSvg2DSVG(config);
    case 'triangles2d':
      return generateTriangles2DSVG(config);
    case 'ridges2d':
      return generateRidges2DSVG(config);
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

function generateRidges2DSVG(config: Extract<WallpaperConfig, { type: 'ridges2d' }>): string {
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

      const wx = warpAmount > 0 ? (fbm2D(nx0, ny0, warpFreq, Math.max(1, Math.min(6, octaves)), 2001) - 0.5) * 2 : 0;
      const wy = warpAmount > 0 ? (fbm2D(nx0 + 13.1, ny0 - 9.2, warpFreq, Math.max(1, Math.min(6, octaves)), 3001) - 0.5) * 2 : 0;
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
        next.push({ x: lerp(a.x, b.x, 0.25), y: lerp(a.y, b.y, 0.25) }, { x: lerp(a.x, b.x, 0.75), y: lerp(a.y, b.y, 0.75) });
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

function generatePopsicleSVG(config: Extract<WallpaperConfig, { type: 'popsicle' }>): string {
  const { width, height, colors, backgroundColor, stickCount, stickOverhang, rotationCenterOffsetX, rotationCenterOffsetY } = config;
  const opacityValue = Number(config.stickOpacity);
  const stickOpacity = Number.isFinite(opacityValue) ? Math.max(0, Math.min(1, opacityValue)) : 1;

  const palette = colors.length > 0 ? colors : ['#ffffff'];

  const safeSize = Math.max(0.01, Number.isFinite(Number(config.stickSize)) ? Number(config.stickSize) : 1.0);
  const safeRatio = Math.max(0.05, Number.isFinite(Number(config.stickRatio)) ? Number(config.stickRatio) : 3.0);

  const baseStickWidth = width * 0.15 * safeSize;
  const baseStickHeight = height * 0.8 * safeSize;
  const area = baseStickWidth * baseStickHeight;
  const stickWidth = Math.sqrt(area / safeRatio);
  const stickHeight = Math.sqrt(area * safeRatio);

  let svg = svgStart(width, height, backgroundColor);
  const centerX = width / 2;
  const centerY = height / 2;

  for (let i = 0; i < stickCount; i++) {
    const color = palette[i % palette.length];
    let x = centerX;
    let y = centerY;

    const rotationAngle = (i * stickOverhang * Math.PI) / 180;
    const offsetXPercent = rotationCenterOffsetX / 100;
    const offsetYPercent = rotationCenterOffsetY / 100;
    const pivotX = offsetXPercent * (stickWidth / 2);
    const pivotY = offsetYPercent * (stickHeight / 2);
    const cos = Math.cos(rotationAngle);
    const sin = Math.sin(rotationAngle);
    const offsetX = pivotX * (1 - cos) + pivotY * sin;
    const offsetY = pivotY * (1 - cos) - pivotX * sin;

    x += offsetX;
    y += offsetY;
    const rotation = (rotationAngle * 180) / Math.PI;

    const profile = (config as any).stickEndProfile === 'chamfer' || (config as any).stickEndProfile === 'chipped' ? (config as any).stickEndProfile : 'rounded';
    const maxRadius = Math.min(stickWidth, stickHeight) / 2;
    const r = maxRadius * Math.max(0, Math.min(1, Number((config as any).stickRoundness) || 0));

    if (profile === 'rounded' || r <= 0) {
      svg += `  <rect x="${x - stickWidth / 2}" y="${y - stickHeight / 2}" width="${stickWidth}" height="${stickHeight}" rx="${r}" ry="${r}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>\n`;
      continue;
    }

    const chipAmount = Math.max(0, Math.min(1, Number((config as any).stickChipAmount) || 0));
    const chipJag = Math.max(0, Math.min(1, Number((config as any).stickChipJaggedness) || 0));
    const x0 = x - stickWidth / 2;
    const y0 = y - stickHeight / 2;
    const c = r;

    const rng = (() => {
      let t = (((config.seed >>> 0) || 1) ^ 0x9e3779b9) >>> 0;
      return () => {
        t += 0x6D2B79F5;
        let xx = Math.imul(t ^ (t >>> 15), 1 | t);
        xx ^= xx + Math.imul(xx ^ (xx >>> 7), 61 | xx);
        return ((xx ^ (xx >>> 14)) >>> 0) / 4294967296;
      };
    })();

    const pts: Array<[number, number]> = [];
    const push = (px: number, py: number) => pts.push([px, py]);
    const addChippedCorner = (fromX: number, fromY: number, toX: number, toY: number, inwardX: number, inwardY: number) => {
      if (profile !== 'chipped' || chipAmount <= 0) return;
      const segBase = 2 + Math.round(chipJag * 6);
      const segs = Math.max(2, Math.min(10, segBase));
      const invLen = 1 / Math.max(1e-6, Math.hypot(inwardX, inwardY));
      const ix = inwardX * invLen;
      const iy = inwardY * invLen;
      for (let si = 1; si < segs; si++) {
        const tt = si / segs;
        const bx = fromX + (toX - fromX) * tt;
        const by = fromY + (toY - fromY) * tt;
        const jitter = (rng() - 0.5) * 2;
        const amt = chipAmount * c * (0.25 + 0.55 * chipJag) * (0.35 + 0.65 * Math.abs(jitter));
        push(bx + ix * amt, by + iy * amt);
      }
    };

    push(x0 + c, y0);
    push(x0 + stickWidth - c, y0);
    addChippedCorner(x0 + stickWidth - c, y0, x0 + stickWidth, y0 + c, -1, 1);
    push(x0 + stickWidth, y0 + c);
    push(x0 + stickWidth, y0 + stickHeight - c);
    addChippedCorner(x0 + stickWidth, y0 + stickHeight - c, x0 + stickWidth - c, y0 + stickHeight, -1, -1);
    push(x0 + stickWidth - c, y0 + stickHeight);
    push(x0 + c, y0 + stickHeight);
    addChippedCorner(x0 + c, y0 + stickHeight, x0, y0 + stickHeight - c, 1, -1);
    push(x0, y0 + stickHeight - c);
    push(x0, y0 + c);
    addChippedCorner(x0, y0 + c, x0 + c, y0, 1, 1);
    push(x0 + c, y0);

    const d =
      'M ' +
      pts
        .map(([px, py], idx) => {
          const cmd = idx === 0 ? '' : 'L ';
          return `${cmd}${px.toFixed(3)} ${py.toFixed(3)}`;
        })
        .join(' ') +
      ' Z';

    svg += `  <path d="${d}" fill="${color}" transform="rotate(${rotation} ${x} ${y})" opacity="${stickOpacity}"/>\n`;
  }

  svg += svgEnd();
  return svg;
}

function generateCircles2DSVG(config: Extract<WallpaperConfig, { type: 'circles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(config.circles.count));
  const rMin = Math.max(0.1, Number(config.circles.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.circles.rMaxPx) || rMin);

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

  const w = normalizeWeights(config.circles.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.circles.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), w);
  };

  const fillOpacity = clamp01(Number(config.circles.fillOpacity) || 0);
  const j = clamp01(Number(config.circles.jitter) || 0);
  const strokeEnabled = !!config.circles.stroke.enabled;
  const strokeW = Math.max(0, Number(config.circles.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.circles.stroke.opacity) || 0);
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
    ? ` stroke="${config.circles.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
    : '';

  let svg = svgStart(width, height, backgroundColor);

  if (config.circles.mode === 'grid') {
    const grid = Math.max(1, Math.round(Math.sqrt(count)));
    const gx = grid;
    const gy = Math.max(1, Math.round(count / grid));
    const cellW = width / gx;
    const cellH = height / gy;

    let i = 0;
    for (let y = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) {
        if (i >= count) break;
        const r = rMin + rand01(i, 2) * (rMax - rMin);
        const cx = (x + 0.5) * cellW + (rand01(i, 3) - 0.5) * cellW * j;
        const cy = (y + 0.5) * cellH + (rand01(i, 4) - 0.5) * cellH * j;
        const idx = pickIndex(i);
        const color = colors[idx] ?? '#ffffff';

        if (config.circles.croissant.enabled) {
          const innerScale = Math.max(0.01, Math.min(0.99, config.circles.croissant.innerScale));
          const offset = Math.max(0, Math.min(1, config.circles.croissant.offset));
          const phi = ((rand01(i, 5) - 0.5) * (config.circles.croissant.angleJitterDeg || 0) * Math.PI) / 180;
          const dx = Math.cos(phi) * r * offset;
          const dy = Math.sin(phi) * r * offset;

      const d = [
        `M ${cx + r} ${cy}`,
        `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
        `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
        'Z',
        `M ${cx + dx + r * innerScale} ${cy + dy}`,
        `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx - r * innerScale} ${cy + dy}`,
        `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx + r * innerScale} ${cy + dy}`,
        'Z'
      ].join(' ');

          svg += `  <path d="${d}" fill="${color}" fill-rule="evenodd" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        } else {
          svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        }

        i++;
      }
    }
  } else {
    // scatter
    for (let i = 0; i < count; i++) {
      const r = rMin + rand01(i, 2) * (rMax - rMin);
      const cx0 = rand01(i, 3) * width;
      const cy0 = rand01(i, 4) * height;
      const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
      const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
      const idx = pickIndex(i);
      const color = colors[idx] ?? '#ffffff';

      if (config.circles.croissant.enabled) {
        const innerScale = Math.max(0.01, Math.min(0.99, config.circles.croissant.innerScale));
        const offset = Math.max(0, Math.min(1, config.circles.croissant.offset));
        const phi = ((rand01(i, 5) - 0.5) * (config.circles.croissant.angleJitterDeg || 0) * Math.PI) / 180;
        const dx = Math.cos(phi) * r * offset;
        const dy = Math.sin(phi) * r * offset;

        const d = [
          `M ${cx + r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx - r} ${cy}`,
          `A ${r} ${r} 0 1 1 ${cx + r} ${cy}`,
          'Z',
          `M ${cx + dx + r * innerScale} ${cy + dy}`,
          `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx - r * innerScale} ${cy + dy}`,
          `A ${r * innerScale} ${r * innerScale} 0 1 0 ${cx + dx + r * innerScale} ${cy + dy}`,
          'Z'
        ].join(' ');

        svg += `  <path d="${d}" fill="${color}" fill-rule="evenodd" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      } else {
        svg += `  <circle cx="${cx}" cy="${cy}" r="${r}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      }
    }
  }

  svg += svgEnd();
  return svg;
}

function generatePolygon2DSVG(config: Extract<WallpaperConfig, { type: 'polygon2d' }>): string {
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

  const strokeEnabled = !!config.polygons.stroke.enabled;
  const strokeW = Math.max(0, Number(config.polygons.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.polygons.stroke.opacity) || 0);
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
    ? ` stroke="${config.polygons.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
    : '';

  let svg = svgStart(width, height, backgroundColor);

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx0 = rand01(i, 3) * width;
    const cy0 = rand01(i, 4) * height;
    const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * j;
    const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * j;
    const theta = (rand01(i, 8) - 0.5) * rotJ;

    const idx = pickIndex(i);
    const color = colors[idx] ?? '#ffffff';

    const pts: string[] = [];
    for (let k = 0; k < edges; k++) {
      const a = theta + (k / edges) * Math.PI * 2;
      pts.push(`${cx + Math.cos(a) * r},${cy + Math.sin(a) * r}`);
    }

    svg += `  <polygon points="${pts.join(' ')}" fill="${color}" fill-opacity="${fillOpacity}"${strokeAttr}/>` + '\n';
  }

  svg += svgEnd();
  return svg;
}

function generateSvg2DSVG(config: Extract<WallpaperConfig, { type: 'svg2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(Number(config.svg.count) || 0));
  const rMin = Math.max(0.1, Number(config.svg.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.svg.rMaxPx) || rMin);
  const fillOpacity = clamp01(Number(config.svg.fillOpacity) || 0);
  const jitter = clamp01(Number(config.svg.jitter) || 0);
  const rotJ = ((Number(config.svg.rotateJitterDeg) || 0) * Math.PI) / 180;

  // Validate early for a friendly error.
  validateSvgSource(config.svg.source);
  const { viewBox, inner } = extractSvgRootAttributes(config.svg.source);
  const vbMinX = viewBox.minX;
  const vbMinY = viewBox.minY;
  const vbW = Math.max(1e-9, viewBox.width);
  const vbH = Math.max(1e-9, viewBox.height);
  const vbMax = Math.max(vbW, vbH);
  const vbCx = vbMinX + vbW * 0.5;
  const vbCy = vbMinY + vbH * 0.5;
  const cleanInner = stripSvgPresentationAttributes(inner);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], n);
  const pickIndex = (i: number) => {
    if (config.svg.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  const strokeEnabled = !!config.svg.stroke?.enabled;
  const strokeW = Math.max(0, Number(config.svg.stroke?.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.svg.stroke?.opacity) || 0);
  const strokeColor = typeof config.svg.stroke?.color === 'string' ? config.svg.stroke.color : '#000000';

  let svg = svgStart(width, height, backgroundColor);
  svg += `  <defs><symbol id="wmSvgShape" viewBox="${vbMinX} ${vbMinY} ${vbW} ${vbH}">${cleanInner}</symbol></defs>\n`;

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx0 = rand01(i, 3) * width;
    const cy0 = rand01(i, 4) * height;
    const cx = cx0 + (rand01(i, 6) - 0.5) * r * 2 * jitter;
    const cy = cy0 + (rand01(i, 7) - 0.5) * r * 2 * jitter;
    const theta = (rand01(i, 8) - 0.5) * rotJ;
    const rotDeg = (theta * 180) / Math.PI;

    const scale = r / vbMax;
    const idx = pickIndex(i);
    const col = colors[idx] ?? '#ffffff';

    const strokeAttrs = strokeEnabled && strokeW > 0 && strokeOpacity > 0
      ? ` stroke="${strokeColor}" stroke-opacity="${strokeOpacity}" stroke-width="${(strokeW / Math.max(1e-9, scale)).toFixed(3)}" stroke-linejoin="round" stroke-linecap="round"`
      : ' stroke="none"';

    const transform = `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) rotate(${rotDeg.toFixed(3)}) scale(${scale.toFixed(6)}) translate(${(-vbCx).toFixed(3)} ${(-vbCy).toFixed(3)})`;

    svg += `  <g transform="${transform}" fill="${col}" fill-opacity="${fillOpacity}"${strokeAttrs}><use href="#wmSvgShape"/></g>\n`;
  }

  svg += svgEnd();
  return svg;
}

function generateSvg3DSVG(config: Extract<WallpaperConfig, { type: 'svg3d' }>): string {
  // 2D approximation.
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const count = Math.max(0, Math.round(Number(config.svg.count) || 0));

  validateSvgSource(config.svg.source);
  const { viewBox, inner } = extractSvgRootAttributes(config.svg.source);
  const vbMinX = viewBox.minX;
  const vbMinY = viewBox.minY;
  const vbW = Math.max(1e-9, viewBox.width);
  const vbH = Math.max(1e-9, viewBox.height);
  const vbMax = Math.max(vbW, vbH);
  const vbCx = vbMinX + vbW * 0.5;
  const vbCy = vbMinY + vbH * 0.5;
  const cleanInner = stripSvgPresentationAttributes(inner);

  const rMin = Math.max(0.1, Number(config.svg.sizeMin) * 180);
  const rMax = Math.max(rMin, Number(config.svg.sizeMax) * 180);
  const opacity = clamp01(Number(config.svg.opacity) || 1);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);
  const weightsNorm = normalizeWeights(config.svg.colorWeights ?? [], n);
  const pickIndex = (i: number) => {
    if (config.svg.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  let svg = svgStart(width, height, backgroundColor);
  svg += `  <defs><symbol id="wmSvgShape" viewBox="${vbMinX} ${vbMinY} ${vbW} ${vbH}">${cleanInner}</symbol></defs>\n`;

  for (let i = 0; i < count; i++) {
    const r = rMin + rand01(i, 2) * (rMax - rMin);
    const cx = rand01(i, 3) * width;
    const cy = rand01(i, 4) * height;
    const theta = rand01(i, 8) * Math.PI * 2;
    const rotDeg = (theta * 180) / Math.PI;
    const scale = r / vbMax;
    const idx = pickIndex(i);
    const col = colors[idx] ?? '#ffffff';
    const transform = `translate(${cx.toFixed(3)} ${cy.toFixed(3)}) rotate(${rotDeg.toFixed(3)}) scale(${scale.toFixed(6)}) translate(${(-vbCx).toFixed(3)} ${(-vbCy).toFixed(3)})`;
    svg += `  <g transform="${transform}" fill="${col}" fill-opacity="${opacity}" stroke="none"><use href="#wmSvgShape"/></g>\n`;
  }

  svg += svgEnd();
  return svg;
}

function generateTriangles2DSVG(config: Extract<WallpaperConfig, { type: 'triangles2d' }>): string {
  const { width, height, colors, backgroundColor } = config;
  const n = Math.max(1, colors.length);
  const scale = Math.max(4, Number(config.triangles.scalePx) || 60);
  const inset = Math.max(0, Number(config.triangles.insetPx) || 0);
  const fillOpacity = clamp01(Number(config.triangles.fillOpacity) || 0);

  const strokeEnabled = !!config.triangles.stroke.enabled;
  const strokeW = Math.max(0, Number(config.triangles.stroke.widthPx) || 0);
  const strokeOpacity = clamp01(Number(config.triangles.stroke.opacity) || 0);
  const strokeAttr = strokeEnabled && strokeW > 0 && strokeOpacity > 0
    ? ` stroke="${config.triangles.stroke.color}" stroke-width="${strokeW}" stroke-opacity="${strokeOpacity}" stroke-linejoin="round"`
    : '';

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

  const weightsNorm = normalizeWeights(config.triangles.colorWeights, n);
  const pickIndex = (i: number) => {
    if (config.triangles.paletteMode === 'cycle') return i % n;
    return sampleWeightedIndex01(rand01(i, 1), weightsNorm);
  };

  const shadingEnabled = !!config.triangles.shading.enabled;
  const shadeStrength = clamp01(Number(config.triangles.shading.strength) || 0);
  const lightRad = ((Number(config.triangles.shading.lightDeg) || 0) * Math.PI) / 180;
  const lx = Math.cos(lightRad);
  const ly = Math.sin(lightRad);

  const shadeFill = (base: string, ax: number, ay: number, bx: number, by: number, cx: number, cy: number): string => {
    if (!shadingEnabled || !(shadeStrength > 0)) return base;
    const mx = (ax + bx + cx) / 3;
    const my = (ay + by + cy) / 3;
    const nx = (mx - width * 0.5) / Math.max(1, width);
    const ny = (my - height * 0.5) / Math.max(1, height);
    const d = clamp(nx * lx + ny * ly, -1, 1);
    const k = d * 0.18 * shadeStrength;
    return adjustHex(base, k);
  };

  const jitter = clamp01(Number(config.triangles.jitter) || 0);
  const mode = config.triangles.mode;

  let svg = svgStart(width, height, backgroundColor);

  const sqrt3 = 1.7320508075688772;

  if (mode === 'scatter') {
    const density = Math.max(0.05, Number(config.triangles.density) || 1);
    const approxCount = Math.round((density * (width * height)) / (scale * scale));
    const count = Math.max(1, Math.min(6000, approxCount));
    const rotJ = ((Number(config.triangles.rotateJitterDeg) || 0) * Math.PI) / 180;

    for (let i = 0; i < count; i++) {
      const idx = pickIndex(i);
      const base = colors[idx] ?? '#ffffff';

      const cx0 = inset + rand01(i, 2) * (width - inset * 2);
      const cy0 = inset + rand01(i, 3) * (height - inset * 2);
      const s = scale * (0.4 + rand01(i, 4) * 0.8);
      const a = rand01(i, 5) * Math.PI * 2;
      const theta = a + (rand01(i, 6) - 0.5) * rotJ;

      const ax = cx0 + Math.cos(theta) * s;
      const ay = cy0 + Math.sin(theta) * s;
      const bx = cx0 + Math.cos(theta + (2 * Math.PI) / 3) * s;
      const by = cy0 + Math.sin(theta + (2 * Math.PI) / 3) * s;
      const cx = cx0 + Math.cos(theta + (4 * Math.PI) / 3) * s;
      const cy = cy0 + Math.sin(theta + (4 * Math.PI) / 3) * s;

      const fill = shadeFill(base, ax, ay, bx, by, cx, cy);
      svg += `  <polygon points="${ax},${ay} ${bx},${by} ${cx},${cy}" fill="${fill}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
    }
  } else if (mode === 'lowpoly') {
    const step = Math.max(12, scale);
    const cols = Math.ceil((width - inset * 2) / step) + 2;
    const rows = Math.ceil((height - inset * 2) / step) + 2;
    const pts: Array<{ x: number; y: number }> = [];

    let p = 0;
    for (let y = 0; y < rows; y++) {
      for (let x = 0; x < cols; x++) {
        const px = inset + x * step + (rand01(p, 2) - 0.5) * step * jitter;
        const py = inset + y * step + (rand01(p, 3) - 0.5) * step * jitter;
        pts.push({ x: px, y: py });
        p++;
      }
    }

    const idxAt = (x: number, y: number) => y * cols + x;
    let t = 0;
    for (let y = 0; y < rows - 1; y++) {
      for (let x = 0; x < cols - 1; x++) {
        const p00 = pts[idxAt(x, y)];
        const p10 = pts[idxAt(x + 1, y)];
        const p01 = pts[idxAt(x, y + 1)];
        const p11 = pts[idxAt(x + 1, y + 1)];

        const flip = rand01(t, 9) < 0.5;
        const i0 = pickIndex(t++);
        const i1 = pickIndex(t++);

        const base0 = colors[i0] ?? '#ffffff';
        const base1 = colors[i1] ?? '#ffffff';

        if (flip) {
          const fill0 = shadeFill(base0, p00.x, p00.y, p10.x, p10.y, p11.x, p11.y);
          const fill1 = shadeFill(base1, p00.x, p00.y, p11.x, p11.y, p01.x, p01.y);
          svg += `  <polygon points="${p00.x},${p00.y} ${p10.x},${p10.y} ${p11.x},${p11.y}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
          svg += `  <polygon points="${p00.x},${p00.y} ${p11.x},${p11.y} ${p01.x},${p01.y}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        } else {
          const fill0 = shadeFill(base0, p00.x, p00.y, p10.x, p10.y, p01.x, p01.y);
          const fill1 = shadeFill(base1, p10.x, p10.y, p11.x, p11.y, p01.x, p01.y);
          svg += `  <polygon points="${p00.x},${p00.y} ${p10.x},${p10.y} ${p01.x},${p01.y}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
          svg += `  <polygon points="${p10.x},${p10.y} ${p11.x},${p11.y} ${p01.x},${p01.y}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        }
      }
    }
  } else {
    // tessellation
    const s = scale;
    const h = (s * sqrt3) / 2;
    const cols = Math.ceil((width - inset * 2) / s) + 3;
    const rows = Math.ceil((height - inset * 2) / h) + 3;

    let t = 0;
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const x0 = inset + rx * s + (ry % 2 === 0 ? 0 : s / 2);
        const y0 = inset + ry * h;
        const jx = (rand01(t, 2) - 0.5) * s * jitter;
        const jy = (rand01(t, 3) - 0.5) * h * jitter;

        const idx0 = pickIndex(t++);
        const idx1 = pickIndex(t++);
        const base0 = colors[idx0] ?? '#ffffff';
        const base1 = colors[idx1] ?? '#ffffff';

        const ax1 = x0 + jx;
        const ay1 = y0 + jy;
        const bx1 = x0 + s / 2 + jx;
        const by1 = y0 + h + jy;
        const cx1 = x0 - s / 2 + jx;
        const cy1 = y0 + h + jy;

        const ax2 = x0 + jx;
        const ay2 = y0 + 2 * h + jy;
        const bx2 = x0 + s / 2 + jx;
        const by2 = y0 + h + jy;
        const cx2 = x0 - s / 2 + jx;
        const cy2 = y0 + h + jy;

        const fill0 = shadeFill(base0, ax1, ay1, bx1, by1, cx1, cy1);
        const fill1 = shadeFill(base1, ax2, ay2, bx2, by2, cx2, cy2);
        svg += `  <polygon points="${ax1},${ay1} ${bx1},${by1} ${cx1},${cy1}" fill="${fill0}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
        svg += `  <polygon points="${ax2},${ay2} ${bx2},${by2} ${cx2},${cy2}" fill="${fill1}" fill-opacity="${fillOpacity}"${strokeAttr}/>\n`;
      }
    }
  }

  svg += svgEnd();
  return svg;
}

function generateHexGrid2DSVG(config: Extract<WallpaperConfig, { type: 'hexgrid2d' }>): string {
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

  // Grouping (bounded): none / noise
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

  // Colors (by group)
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

function generateSpheres3DSVG(config: Extract<WallpaperConfig, { type: 'spheres3d' }>): string {
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
      const zBase = layers === 1 ? 0 : (-(depth * 0.5) + (depth * layer) / (layers - 1));
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

    // scatter
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
    const cx = ((p.x / denom) + 0.5) * width;
    const cy = ((p.y / denom) + 0.5) * height;
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

function generateTriangles3DSVG(config: Extract<WallpaperConfig, { type: 'triangles3d' }>): string {
  // Approximation: draw 2D base polygons (triangle/square) with optional taper hint.
  const { width, height, colors, backgroundColor } = config;
  const count = Math.max(0, Math.round(config.prisms.count));
  const s = Math.max(12, config.prisms.radius * 180);

  const base = config.prisms.base === 'square' ? 'square' : 'triangle';
  const taper = clamp(Number(config.prisms.taper ?? 1), 0, 1);
  const sides = base === 'square' ? 4 : 3;
  const a0 = base === 'square' ? Math.PI / 4 : Math.PI / 6;

  const spread = Math.max(0, Number(config.prisms.spread) || 0);
  const jitter = clamp01(Number(config.prisms.jitter) || 0);
  const radius = Math.max(0.0001, Number(config.prisms.radius) || 0.2);

  const n = Math.max(1, colors.length);
  const weightsNorm = normalizeWeights(config.prisms.colorWeights, n);
  let svg = svgStart(width, height, backgroundColor);

  const seed = config.seed >>> 0;
  const rand01 = (i: number, ch: number) => cellRand01(seed, i, 0, ch);

  const mode = config.prisms.mode;
  const posForIndex = (i: number): { x: number; y: number } => {
    let x = 0;
    let y = 0;
    if (mode === 'tessellation') {
      const gx = Math.max(1, Math.round(Math.sqrt(count)));
      const gy = Math.max(1, Math.round(count / gx));
      const cx = i % gx;
      const cy = Math.floor(i / gx) % gy;
      const cellW = spread === 0 ? 0 : (spread * 2) / gx;
      const cellH = spread === 0 ? 0 : (spread * 2) / gy;
      x = -spread + (cx + 0.5) * cellW;
      y = -spread + (cy + 0.5) * cellH;
    } else {
      x = (rand01(i, 2) - 0.5) * 2 * spread;
      y = (rand01(i, 3) - 0.5) * 2 * spread;
    }

    x += (rand01(i, 4) - 0.5) * jitter * radius * 2;
    y += (rand01(i, 5) - 0.5) * jitter * radius * 2;
    return { x, y };
  };

  const denom = Math.max(0.0001, spread * 2);
  const opacity = clamp01(Number(config.prisms.opacity) || 0);
  for (let i = 0; i < count; i++) {
    const p = posForIndex(i);
    const u = rand01(i, 1);
    const a = rand01(i, 6) * Math.PI * 2;
    const cx = ((p.x / denom) + 0.5) * width;
    const cy = ((p.y / denom) + 0.5) * height;

    const idx = config.prisms.paletteMode === 'cycle' ? i % n : sampleWeightedIndex01(u, weightsNorm);
    const col = colors[idx] ?? '#ffffff';

    const pts: string[] = [];
    for (let k = 0; k < sides; k++) {
      const ang = a + a0 + (k / sides) * Math.PI * 2;
      pts.push(`${cx + Math.cos(ang) * s},${cy + Math.sin(ang) * s}`);
    }
    svg += `  <polygon points="${pts.join(' ')}" fill="${col}" opacity="${opacity}"/>\n`;

    // Taper hint: draw a smaller, slightly darkened top face.
    if (taper < 0.999999) {
      const s2 = s * taper;
      const topCol = adjustHex(col, -0.08 * (1 - taper));
      const op2 = opacity * 0.55;
      if (s2 < 0.75) {
        const rr = Math.max(1, s * 0.08);
        svg += `  <circle cx="${cx}" cy="${cy}" r="${rr}" fill="${topCol}" opacity="${op2}"/>\n`;
      } else {
        const pts2: string[] = [];
        for (let k = 0; k < sides; k++) {
          const ang = a + a0 + (k / sides) * Math.PI * 2;
          pts2.push(`${cx + Math.cos(ang) * s2},${cy + Math.sin(ang) * s2}`);
        }
        svg += `  <polygon points="${pts2.join(' ')}" fill="${topCol}" opacity="${op2}"/>\n`;
      }
    }
  }
  svg += svgEnd();
  return svg;
}

export async function exportWallpaper(
  canvas: HTMLCanvasElement,
  config: WallpaperConfig,
  options: ExportOptions
): Promise<ExportResult> {
  switch (options.format) {
    case 'png':
      return exportToPNG(canvas, options);
    case 'jpg':
      return exportToJPG(canvas, options);
    case 'webp':
      return exportToWebP(canvas, options);
    case 'svg':
      return exportToSVG(config);
    default:
      throw new Error(`Unsupported format: ${options.format}`);
  }
}

export function downloadFile(data: Uint8Array | string, filename: string, mimeType: string): void {
  const blob = data instanceof Uint8Array 
    ? new Blob([data as BlobPart], { type: mimeType })
    : new Blob([data], { type: mimeType });
  
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

import type { Bands2DConfig, PaletteAssignMode } from '../types.js';

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

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u01: number, weightsNorm: number[]): number {
  const u = clamp(u01, 0, 0.999999999);
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

function frac(x: number): number {
  return x - Math.floor(x);
}

function triWave01(t: number): number {
  // [-1,1]
  const f = frac(t);
  return 1 - 4 * Math.abs(f - 0.5);
}

function roundRectPath(p: Path2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w * 0.5, h * 0.5));
  if (rr <= 0) {
    p.rect(x, y, w, h);
    return;
  }
  const x0 = x;
  const y0 = y;
  const x1 = x + w;
  const y1 = y + h;
  p.moveTo(x0 + rr, y0);
  p.lineTo(x1 - rr, y0);
  p.arcTo(x1, y0, x1, y0 + rr, rr);
  p.lineTo(x1, y1 - rr);
  p.arcTo(x1, y1, x1 - rr, y1, rr);
  p.lineTo(x0 + rr, y1);
  p.arcTo(x0, y1, x0, y1 - rr, rr);
  p.lineTo(x0, y0 + rr);
  p.arcTo(x0, y0, x0 + rr, y0, rr);
  p.closePath();
}

export function renderBands2DToCanvas(config: Bands2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const bands = (config as any).bands;
  const seedU32 = ((config.seed >>> 0) ^ (Number(bands?.seedOffset) || 0)) >>> 0;

  const colors = config.colors.length > 0 ? config.colors : ['#ffffff'];
  const weightsNorm = normalizeWeights((bands?.colorWeights ?? []) as number[], Math.max(1, colors.length));
  const paletteMode: PaletteAssignMode = bands?.paletteMode === 'cycle' ? 'cycle' : 'weighted';

  const mode = (bands?.mode === 'straight' || bands?.mode === 'chevron' || bands?.mode === 'waves') ? bands.mode : 'straight';
  const angleDeg = Number(bands?.angleDeg) || 0;
  const angleRad = (angleDeg * Math.PI) / 180;

  const bandWidth = Math.max(0.1, Number(bands?.bandWidthPx) || 1);
  const gap = Math.max(0, Number(bands?.gapPx) || 0);
  const period = bandWidth + gap;
  const offsetPx = Number(bands?.offsetPx) || 0;
  const jitterPx = Math.max(0, Number(bands?.jitterPx) || 0);

  const fillEnabled = !!bands?.fill?.enabled;
  const fillOpacity = clamp01(Number(bands?.fill?.opacity) || 0);
  const strokeEnabled = !!bands?.stroke?.enabled;
  const strokeWidth = Math.max(0, Number(bands?.stroke?.widthPx) || 0);
  const strokeOpacity = clamp01(Number(bands?.stroke?.opacity) || 0);
  const strokeColor = typeof bands?.stroke?.color === 'string' ? String(bands.stroke.color) : '#000000';

  const w = c.width;
  const h = c.height;
  const cx = w * 0.5;
  const cy = h * 0.5;
  const diag = Math.hypot(w, h);
  const overscan = Math.max(w, h, diag);

  const xStart = -overscan;
  const xEnd = w + overscan;
  const yStart = -overscan + offsetPx;
  const yEnd = h + overscan;
  const maxBands = Math.max(1, Math.ceil((yEnd - yStart) / Math.max(1e-6, period)) + 4);

  const waves = bands?.waves ?? {};
  const waveAmp = Math.max(0, Number(waves.amplitudePx) || 0);
  const waveLen = Math.max(1, Number(waves.wavelengthPx) || 1);
  const waveNoiseAmt = clamp01(Number(waves.noiseAmount) || 0);
  const waveNoiseScale = Math.max(0.000001, Number(waves.noiseScale) || 1);

  const chevron = bands?.chevron ?? {};
  const chevAmp = Math.max(0, Number(chevron.amplitudePx) || 0);
  const chevLen = Math.max(1, Number(chevron.wavelengthPx) || 1);
  const chevSharp = clamp(Number(chevron.sharpness) || 1, 0.1, 8);
  const chevShared = typeof chevron.sharedPhase === 'boolean' ? chevron.sharedPhase : true;
  const chevSharedPhase = cellRand01(seedU32, 0x51a, 0x9b1, 9301);

  const bandOffset = (x: number, bandIndex: number): number => {
    if (mode === 'waves') {
      const phase = cellRand01(seedU32, bandIndex, 0, 9101) * Math.PI * 2;
      const s = Math.sin(((x / waveLen) * Math.PI * 2) + phase);
      const n = (valueNoise2D(seedU32 ^ 0x51f0d3a, (x / waveLen) * waveNoiseScale, bandIndex * 0.31, 9201) - 0.5) * 2;
      return waveAmp * (s + n * waveNoiseAmt);
    }

    if (mode === 'chevron') {
      const phase = chevShared ? chevSharedPhase : cellRand01(seedU32, bandIndex, 0, 9301);
      const t = (x / chevLen) + phase;
      const tri = triWave01(t);
      const shaped = Math.sign(tri) * Math.pow(Math.abs(tri), chevSharp);
      return shaped * chevAmp;
    }

    return 0;
  };

  const stepPx = (() => {
    if (mode === 'straight') return Math.max(8, Math.round(period * 0.4));
    if (mode === 'chevron') return Math.max(8, Math.round(chevLen / 26));
    return Math.max(8, Math.round(waveLen / 34));
  })();

  const panel = bands?.panel ?? {};
  const panelEnabled = !!panel.enabled;
  const rectFrac = panel.rectFrac ?? { x: 0, y: 0, w: 1, h: 1 };
  const rx = clamp01(Number(rectFrac.x) || 0) * w;
  const ry = clamp01(Number(rectFrac.y) || 0) * h;
  const rw = Math.max(1, clamp01(Number(rectFrac.w) || 1) * w);
  const rh = Math.max(1, clamp01(Number(rectFrac.h) || 1) * h);
  const radiusPx = Math.max(0, Number(panel.radiusPx) || 0);

  ctx.save();
  if (panelEnabled) {
    const p = new Path2D();
    roundRectPath(p, rx, ry, rw, rh, radiusPx);
    ctx.clip(p);
    const pf = panel.fill ?? {};
    const pfEnabled = !!pf.enabled;
    const pfOpacity = clamp01(Number(pf.opacity) || 0);
    const pfColor = typeof pf.color === 'string' ? String(pf.color) : '#000000';
    if (pfEnabled && pfOpacity > 0) {
      ctx.fillStyle = rgba(pfColor, pfOpacity);
      ctx.fill(p);
    }
  }

  ctx.translate(cx, cy);
  ctx.rotate(angleRad);
  ctx.translate(-cx, -cy);

  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  for (let bi = 0; bi < maxBands; bi++) {
    const baseY = yStart + bi * period;
    const j = jitterPx > 0 ? (cellRand01(seedU32, bi, 0, 9001) - 0.5) * 2 * jitterPx : 0;
    const y0 = baseY + j;
    const y1 = y0 + bandWidth;
    if (y1 < yStart - period || y0 > yEnd + period) continue;

    const colorIndex = pickPaletteIndex(seedU32, paletteMode, weightsNorm, bi, 9401);
    const col = colors[colorIndex % colors.length] ?? '#ffffff';

    if (mode === 'straight') {
      if (fillEnabled && fillOpacity > 0) {
        ctx.fillStyle = rgba(col, fillOpacity);
        ctx.fillRect(xStart, y0, xEnd - xStart, bandWidth);
      }
      if (strokeEnabled && strokeWidth > 0 && strokeOpacity > 0) {
        ctx.strokeStyle = rgba(strokeColor, strokeOpacity);
        ctx.lineWidth = strokeWidth;
        ctx.strokeRect(xStart, y0, xEnd - xStart, bandWidth);
      }
      continue;
    }

    const p = new Path2D();
    p.moveTo(xStart, y0 + bandOffset(xStart, bi));
    for (let x = xStart + stepPx; x <= xEnd + 0.1; x += stepPx) {
      p.lineTo(x, y0 + bandOffset(x, bi));
    }
    for (let x = xEnd; x >= xStart - 0.1; x -= stepPx) {
      p.lineTo(x, y1 + bandOffset(x, bi));
    }
    p.closePath();

    if (fillEnabled && fillOpacity > 0) {
      ctx.fillStyle = rgba(col, fillOpacity);
      ctx.fill(p);
    }
    if (strokeEnabled && strokeWidth > 0 && strokeOpacity > 0) {
      ctx.strokeStyle = rgba(strokeColor, strokeOpacity);
      ctx.lineWidth = strokeWidth;
      ctx.stroke(p);
    }
  }

  ctx.restore();
  return c;
}

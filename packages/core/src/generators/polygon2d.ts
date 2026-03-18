import type { Polygon2DConfig } from '../types.js';
import { createRng } from '../types.js';

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function normalizeWeights(weights: number[], n: number): number[] {
  const w = Array.from({ length: n }, (_, i) => Math.max(0, Number(weights[i] ?? 0)));
  const sum = w.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return Array.from({ length: n }, () => 1 / n);
  return w.map((x) => x / sum);
}

function sampleWeightedIndex01(u: number, wNorm: number[]): number {
  let acc = 0;
  for (let i = 0; i < wNorm.length; i++) {
    acc += wNorm[i];
    if (u <= acc) return i;
  }
  return wNorm.length - 1;
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

function applyCanvasBloom(options: {
  ctx: CanvasRenderingContext2D;
  glowCanvas: HTMLCanvasElement;
  strength: number;
  radius: number;
  threshold: number;
}): void {
  const { ctx, glowCanvas, strength, radius, threshold } = options;
  if (!(strength > 0) || glowCanvas.width === 0 || glowCanvas.height === 0) return;

  const w = glowCanvas.width;
  const h = glowCanvas.height;
  const tmp = document.createElement('canvas');
  tmp.width = w;
  tmp.height = h;
  const tctx = tmp.getContext('2d');
  if (!tctx) return;

  const blurPx = Math.max(0, radius) * 40;
  const passes = Math.max(1, Math.min(6, Math.round(1 + strength * 1.5)));

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.filter = 'none';
  tctx.drawImage(glowCanvas, 0, 0);

  const th = clamp(threshold, 0, 1);
  if (th > 0) {
    tctx.globalCompositeOperation = 'source-in';
    tctx.fillStyle = `rgba(255,255,255,${clamp(1 - th, 0, 1)})`;
    tctx.fillRect(0, 0, w, h);
  }

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.filter = `blur(${blurPx.toFixed(2)}px)`;

  for (let i = 0; i < passes; i++) {
    const a = clamp(strength * 0.22, 0, 1);
    ctx.globalAlpha = a;
    ctx.drawImage(tmp, 0, 0);
  }

  ctx.restore();
}

function buildPolygonPath(cx: number, cy: number, r: number, edges: number, thetaRad: number): Path2D {
  const e = Math.max(3, Math.round(edges));
  const path = new Path2D();
  for (let i = 0; i < e; i++) {
    const a = thetaRad + (i / e) * Math.PI * 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r;
    if (i === 0) path.moveTo(x, y);
    else path.lineTo(x, y);
  }
  path.closePath();
  return path;
}

export function renderPolygon2DToCanvas(config: Polygon2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
  const c = canvas ?? document.createElement('canvas');
  c.width = Math.max(1, Math.round(config.width));
  c.height = Math.max(1, Math.round(config.height));
  const ctx = c.getContext('2d');
  if (!ctx) throw new Error('2D canvas not available');

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, c.width, c.height);
  ctx.fillStyle = config.backgroundColor;
  ctx.fillRect(0, 0, c.width, c.height);

  const rng = createRng(config.seed);
  const nColors = Math.max(1, config.colors.length);
  const weights = normalizeWeights(config.polygons.colorWeights, nColors);

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const fillOpacity = clamp(config.polygons.fillOpacity, 0, 1);
  const strokeEnabled = !!config.polygons.stroke.enabled;
  const strokeW = Math.max(0, config.polygons.stroke.widthPx);
  const strokeOpacity = clamp(config.polygons.stroke.opacity, 0, 1);
  const edges = Math.max(3, Math.round(config.polygons.edges));

  const pickIndex = (i: number): number => {
    if (config.polygons.paletteMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weights);
  };

  const count = Math.max(0, Math.round(config.polygons.count));
  const rMin = Math.max(0.1, Number(config.polygons.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.polygons.rMaxPx) || rMin);
  const j = clamp(config.polygons.jitter, 0, 1);
  const rotJ = ((Number(config.polygons.rotateJitterDeg) || 0) * Math.PI) / 180;

  for (let i = 0; i < count; i++) {
    const r = rMin + rng() * (rMax - rMin);
    const cx = rng() * c.width;
    const cy = rng() * c.height;
    const cxJ = cx + (rng() - 0.5) * r * 2 * j;
    const cyJ = cy + (rng() - 0.5) * r * 2 * j;
    const theta = (rng() - 0.5) * rotJ;

    const paletteIndex = pickIndex(i);
    const color = config.colors[paletteIndex] ?? '#ffffff';

    const path = buildPolygonPath(cxJ, cyJ, r, edges, theta);
    ctx.fillStyle = rgba(color, fillOpacity);
    ctx.fill(path);

    if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
      ctx.lineWidth = strokeW;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = rgba(config.polygons.stroke.color, strokeOpacity);
      ctx.stroke(path);
    }

    if (config.emission.enabled && paletteIndex === Math.round(config.emission.paletteIndex) && config.bloom.enabled) {
      const emit = Math.max(0, Number(config.emission.intensity) || 0);
      if (emit > 0) {
        const s = 1.0 + clamp(emit * 0.03, 0, 0.8);
        const glowPath = buildPolygonPath(cxJ, cyJ, r * s, edges, theta);
        gctx.fillStyle = rgba(color, clamp(0.06 + emit * 0.02, 0, 1));
        gctx.fill(glowPath);
      }
    }
  }

  if (config.bloom.enabled) {
    applyCanvasBloom({
      ctx,
      glowCanvas: glow,
      strength: Number(config.bloom.strength) || 0,
      radius: Number(config.bloom.radius) || 0,
      threshold: Number(config.bloom.threshold) || 0
    });
  }

  return c;
}

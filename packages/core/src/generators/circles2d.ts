import type { Circles2DConfig } from '../types.js';
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

  // Cheap bloom: blur + additive screen blends.
  const blurPx = Math.max(0, radius) * 40;
  const passes = Math.max(1, Math.min(6, Math.round(1 + strength * 1.5)));

  tctx.clearRect(0, 0, w, h);
  tctx.globalCompositeOperation = 'source-over';
  tctx.filter = 'none';
  tctx.drawImage(glowCanvas, 0, 0);

  // A crude threshold: fade out dim pixels by drawing with reduced alpha.
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

export function renderCircles2DToCanvas(config: Circles2DConfig, canvas?: HTMLCanvasElement): HTMLCanvasElement {
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
  const weights = normalizeWeights(config.circles.colorWeights, nColors);

  const glow = document.createElement('canvas');
  glow.width = c.width;
  glow.height = c.height;
  const gctx = glow.getContext('2d');
  if (!gctx) throw new Error('2D canvas not available');

  const inset = 0;
  const fillOpacity = clamp(config.circles.fillOpacity, 0, 1);
  const strokeEnabled = !!config.circles.stroke.enabled;
  const strokeW = Math.max(0, config.circles.stroke.widthPx);
  const strokeOpacity = clamp(config.circles.stroke.opacity, 0, 1);
  const croissant = config.circles.croissant;

  const pickIndex = (i: number): number => {
    if (config.circles.paletteMode === 'cycle') return i % nColors;
    return sampleWeightedIndex01(rng(), weights);
  };

  const drawShape = (cx: number, cy: number, r: number, paletteIndex: number) => {
    const color = config.colors[paletteIndex] ?? '#ffffff';

    const path = new Path2D();
    if (croissant.enabled) {
      const innerScale = clamp(croissant.innerScale, 0.01, 0.99);
      const offset = clamp(croissant.offset, 0, 1);
      const phi = ((rng() - 0.5) * croissant.angleJitterDeg * Math.PI) / 180;
      const dx = Math.cos(phi) * r * offset;
      const dy = Math.sin(phi) * r * offset;

      path.arc(cx, cy, r, 0, Math.PI * 2);
      path.closePath();
      path.moveTo(cx + dx + r * innerScale, cy + dy);
      // Reverse winding for even-odd cutout.
      path.arc(cx + dx, cy + dy, r * innerScale, 0, Math.PI * 2, true);
      path.closePath();

      ctx.fillStyle = rgba(color, fillOpacity);
      ctx.fill(path, 'evenodd');

      if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
        ctx.lineWidth = strokeW;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(config.circles.stroke.color, strokeOpacity);
        ctx.stroke(path);
      }
    } else {
      path.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fillStyle = rgba(color, fillOpacity);
      ctx.fill(path);
      if (strokeEnabled && strokeW > 0 && strokeOpacity > 0) {
        ctx.lineWidth = strokeW;
        ctx.lineJoin = 'round';
        ctx.strokeStyle = rgba(config.circles.stroke.color, strokeOpacity);
        ctx.stroke(path);
      }
    }

    // Emission -> glow canvas
    if (config.emission.enabled && paletteIndex === Math.round(config.emission.paletteIndex) && config.bloom.enabled) {
      const emit = Math.max(0, Number(config.emission.intensity) || 0);
      if (emit > 0) {
        gctx.fillStyle = rgba(color, clamp(0.06 + emit * 0.02, 0, 1));
        gctx.beginPath();
        gctx.arc(cx, cy, r * (1.0 + clamp(emit * 0.03, 0, 0.8)), 0, Math.PI * 2);
        gctx.fill();
      }
    }
  };

  const count = Math.max(0, Math.round(config.circles.count));
  const rMin = Math.max(0.1, Number(config.circles.rMinPx) || 1);
  const rMax = Math.max(rMin, Number(config.circles.rMaxPx) || rMin);

  if (config.circles.mode === 'grid') {
    const grid = Math.max(1, Math.round(Math.sqrt(count)));
    const gx = grid;
    const gy = Math.max(1, Math.round(count / grid));
    const cellW = (c.width - inset * 2) / gx;
    const cellH = (c.height - inset * 2) / gy;
    const j = clamp(config.circles.jitter, 0, 1);

    let i = 0;
    for (let y = 0; y < gy; y++) {
      for (let x = 0; x < gx; x++) {
        if (i >= count) break;
        const cx = inset + (x + 0.5) * cellW + (rng() - 0.5) * cellW * j;
        const cy = inset + (y + 0.5) * cellH + (rng() - 0.5) * cellH * j;
        const r = rMin + rng() * (rMax - rMin);
        const paletteIndex = pickIndex(i);
        drawShape(cx, cy, r, paletteIndex);
        i++;
      }
    }
  } else {
    // scatter
    const j = clamp(config.circles.jitter, 0, 1);
    for (let i = 0; i < count; i++) {
      const r = rMin + rng() * (rMax - rMin);
      const cx = inset + rng() * (c.width - inset * 2);
      const cy = inset + rng() * (c.height - inset * 2);
      const cxJ = cx + (rng() - 0.5) * r * 2 * j;
      const cyJ = cy + (rng() - 0.5) * r * 2 * j;
      const paletteIndex = pickIndex(i);
      drawShape(cxJ, cyJ, r, paletteIndex);
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
